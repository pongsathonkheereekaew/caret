// Caret worktree isolation (WT-01…03/05). Thin wrapper over `git worktree`
// through GitCore — deliberately NOT reusing upstream's managedWorktrees,
// which couples retention to orchestration thread archival. Runs execute at
// detached HEAD in tmpdir (never inside the repo tree); bring-back flows
// through overlap refusal + 3way apply onto the main checkout.
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as NodePath from "node:path";
import * as NodeOs from "node:os";
import * as NodeFs from "node:fs";
import * as NodeCp from "node:child_process";
import * as Path from "effect/Path";
import { GitCore } from "../../server/src/git/Services/GitCore.ts";
import { GitCommandError } from "../../server/src/git/Errors.ts";

export interface IsolatedRun {
  readonly repoDir: string;
  readonly worktreeDir: string;
  readonly baseCommit: string;
  readonly runId: string;
}

const git = (args: ReadonlyArray<string>, cwd: string, allowNonZeroExit = false) =>
  Effect.gen(function* () {
    const gitCore = yield* GitCore;
    return yield* gitCore.execute({ operation: "CaretWorktree", cwd, args: [...args], allowNonZeroExit });
  });

const fail = (command: string, cwd: string, detail: string) => {
  const trimmed = detail.length > 600 ? `${detail.slice(0, 300)} … ${detail.slice(-300)}` : detail;
  return Effect.fail(new GitCommandError({ operation: "CaretWorktree", command, cwd, detail: trimmed }));
};
export const resolveBaseCommit = (repoDir: string, baseRef?: string) =>
  Effect.gen(function* () {
    const out = yield* git(["rev-parse", "--verify", baseRef ?? "HEAD"], repoDir);
    const commit = out.stdout.trim().split("\n")[0] ?? "";
    if (!commit) {
      return yield* fail("git rev-parse", repoDir, "empty base commit");
    }
    return commit;
  });

/** Create a detached-HEAD worktree in tmpdir (never inside the repo tree). */
export const createIsolatedRun = (repoDir: string, runId: string, baseRef?: string) =>
  Effect.gen(function* () {
    const baseCommit = yield* resolveBaseCommit(repoDir, baseRef);
    // Unique per run: a crashed run's directory survives repo deletion, and a
    // fixed name would collide with it (fatal: already exists) and serialize
    // parallel runs. Count-based retention lives in pruneRunsBeyondCap below.
    const provisional = NodePath.join(NodeOs.tmpdir(), `caret-wt-${runId}-${Date.now().toString(36)}`);
    const add = yield* git(["worktree", "add", "--detach", provisional, baseCommit], repoDir, true);
    if (add.code !== 0) {
      return yield* fail("git worktree add", repoDir, add.stderr);
    }
    // Canonicalize: /tmp is a symlink (/private/tmp) and git reports real
    // paths. String comparisons (list membership, overlap checks) break on
    // mixed forms, so every path leaving this boundary is realpath'd.
    const real = yield* Effect.tryPromise({
      try: () => NodeFs.promises.realpath(provisional),
      catch: () => new Error("realpath worktree failed"),
    }).pipe(Effect.catch(() => Effect.succeed(provisional)));
    const canonRepo = yield* Effect.tryPromise({
      try: () => NodeFs.promises.realpath(repoDir),
      catch: () => new Error("realpath repo failed"),
    }).pipe(Effect.catch(() => Effect.succeed(repoDir)));
    const run: IsolatedRun = { repoDir: canonRepo, worktreeDir: real, baseCommit, runId };
    return run;
  });

const porcelainPaths = (stdout: string): string[] =>
  stdout.split("\0").filter((entry) => entry.length > 0).map((entry) => entry.slice(3));

export const worktreeStatus = (run: IsolatedRun) =>
  Effect.gen(function* () {
    const out = yield* git(["status", "--porcelain=v1", "-z"], run.worktreeDir);
    return porcelainPaths(out.stdout);
  });

/** Untracked-but-present files in the worktree (agent-created candidates). */
export const worktreeUntracked = (run: IsolatedRun) =>
  Effect.gen(function* () {
    const out = yield* git(["status", "--porcelain=v1", "-z"], run.worktreeDir);
    return out.stdout
      .split("\0")
      .filter((entry) => entry.startsWith("?? "))
      .map((entry) => entry.slice(3));
  });

const MAX_NEW_FILE_PREVIEW = 100_000;

const previewNewFile = (absolute: string) =>
  Effect.gen(function* () {
    const stat = yield* Effect.tryPromise({
      try: () => NodeFs.promises.stat(absolute),
      catch: () => new Error("stat failed"),
    }).pipe(Effect.catch(() => Effect.succeed(null)));
    if (stat === null || !stat.isFile()) {
      return "(new, unreadable: skipped)";
    }
    if (stat.size > MAX_NEW_FILE_PREVIEW) {
      return `(new, ${stat.size} bytes: content omitted)`;
    }
    const content = yield* Effect.tryPromise({
      try: () => NodeFs.promises.readFile(absolute, "utf8"),
      catch: () => new Error("unreadable"),
    }).pipe(Effect.catch(() => Effect.succeed("<binary or unreadable: skipped>")));
    if (content.includes("")) {
      return "(new, binary: content omitted)";
    }
    return `(new file)\n${content}`;
  });

/**
 * Diff of worktree against its base: tracked patch plus new-file sections.
 * `git diff` alone cannot see untracked files, so review would silently drop
 * agent-created files — the exact data-loss class F04 exists to prevent.
 */
export const worktreeDiff = (run: IsolatedRun) =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const out = yield* git(["diff", "--binary", "--full-index", run.baseCommit, "--"], run.worktreeDir);
    const sections = [out.stdout];
    const untracked = yield* worktreeUntracked(run);
    for (const file of untracked) {
      sections.push(`\n--- ${file} ${yield* previewNewFile(path.join(run.worktreeDir, file))} ---\n`);
    }
    return sections.join("");
  });

/**
 * Bring back: 3way-apply the tracked delta onto the MAIN checkout and copy
 * agent-created files that do not collide. Returns false (caller shows
 * conflict UI, never forces) on overlapping dirty main paths, collisions
 * with existing main files, or a failed apply.
 */
export const bringBackRun = (run: IsolatedRun) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const trackedPatch = yield* git(["diff", "--binary", "--full-index", run.baseCommit, "--"], run.worktreeDir).pipe(
      Effect.map((out) => out.stdout),
    );
    const changed = yield* git(["diff", "--name-only", "-z", run.baseCommit, "--"], run.worktreeDir);
    const touchedTracked = changed.stdout.split("\0").filter((entry) => entry.length > 0);
    const untracked = yield* worktreeUntracked(run);
    const mainStatus = yield* git(["status", "--porcelain=v1", "-z"], run.repoDir);
    const mainDirty = new Set(porcelainPaths(mainStatus.stdout));
    if ([...touchedTracked, ...untracked].some((file) => mainDirty.has(file))) {
      return false;
    }
    if (trackedPatch.length > 0) {
      const tmp = yield* fs.makeTempDirectory({ prefix: "caret-bringback-" });
      const patchPath = path.join(tmp, "run.patch");
      yield* fs.writeFileString(patchPath, trackedPatch);
      const applied = yield* git(["apply", "--3way", "--whitespace=nowarn", "--", patchPath], run.repoDir, true);
      if (applied.code !== 0) {
        return false;
      }
    }
    for (const file of untracked) {
      const target = path.join(run.repoDir, file);
      if (yield* fs.exists(target)) {
        return false;
      }
      yield* fs.makeDirectory(path.dirname(target), { recursive: true }).pipe(Effect.ignore);
      yield* fs.copyFile(path.join(run.worktreeDir, file), target);
    }
    return true;
  });

/** Remove the worktree. Refuses when the worktree itself is dirty (WT-05:
 *  pinned/running/dirty worktrees must not lose work); reverse first.
 *  `force` is only for post-bring-back cleanup, where the delta is verified
 *  onto main and removal cannot lose reviewed work. */
export const removeIsolatedRun = (run: IsolatedRun, options?: { force?: boolean }) =>
  Effect.gen(function* () {
    if (!options?.force) {
      const dirty = yield* worktreeStatus(run);
      if (dirty.length > 0) {
        return false;
      }
    }
    const removed = yield* git(["worktree", "remove", "--force", run.worktreeDir], run.repoDir, true);
    if (removed.code !== 0) {
      return yield* fail("git worktree remove", run.repoDir, removed.stderr);
    }
    yield* git(["worktree", "prune"], run.repoDir, true);
    return true;
  });
export const listIsolatedRuns = (repoDir: string) =>
  Effect.gen(function* () {
    const out = yield* git(["worktree", "list", "--porcelain"], repoDir, true);
    if (out.code !== 0) {
      return [] as string[];
    }
    return out.stdout.split("\n").filter((line) => line.startsWith("worktree ")).map((line) => line.slice("worktree ".length));
  });
export const CARET_WORKTREE_PREFIX = "caret-wt-";

/** Caret-owned isolated runs for a repo (picker source). Foreign worktrees
 *  (other tools, linked checkouts) are listed by git but never managed here.
 *  The main checkout itself is excluded even when its own basename carries
 *  the caret prefix — it must never appear as a removable run. */
export const listCaretRuns = (repoDir: string) =>
  Effect.gen(function* () {
    const all = yield* listIsolatedRuns(repoDir);
    const canonRepo = yield* Effect.tryPromise({
      try: () => NodeFs.promises.realpath(repoDir),
      catch: () => new Error("realpath repo failed"),
    }).pipe(Effect.catch(() => Effect.succeed(repoDir)));
    return all.filter((dir) => dir !== canonRepo && NodePath.basename(dir).startsWith(CARET_WORKTREE_PREFIX));
  });

/** Remove one worktree dir by path (picker action). Guard order is the
 *  safety case: canonicalize → refuse the main checkout → caret prefix
 *  only → tmp-root only (prefix spoofing inside the repo still refuses) →
 *  never the live run's dir → refuse dirty (no force on this path; reverse
 *  or bring back first). `true` = removed, `false` = refused-dirty; guard
 *  violations fail with the reason. Unregistered orphan dirs are NOT
 *  removed here (`git worktree remove` refuses them) — they stay on the
 *  prune path (WT-05, proven). */
export const removeWorktreeDir = (repoDir: string, worktreeDir: string, liveDir?: string) =>
  Effect.gen(function* () {
    let realRepo: string;
    let realTarget: string;
    try {
      realRepo = NodeFs.realpathSync(repoDir);
      realTarget = NodeFs.realpathSync(worktreeDir);
    } catch {
      return yield* fail("worktree remove", repoDir, `not found: ${worktreeDir}`);
    }
    if (realTarget === realRepo) {
      return yield* fail("worktree remove", repoDir, "refusing the main checkout");
    }
    if (!NodePath.basename(realTarget).startsWith(CARET_WORKTREE_PREFIX)) {
      return yield* fail("worktree remove", repoDir, `not a Caret worktree: ${worktreeDir}`);
    }
    const tmpRoot = NodeFs.realpathSync(NodeOs.tmpdir());
    if (realTarget !== tmpRoot && !realTarget.startsWith(tmpRoot + NodePath.sep)) {
      return yield* fail("worktree remove", repoDir, `outside the tmp root: ${worktreeDir}`);
    }
    if (liveDir !== undefined) {
      try {
        if (NodeFs.realpathSync(liveDir) === realTarget) {
          return yield* fail("worktree remove", repoDir, "stop the live session first");
        }
      } catch {
        // Live dir already gone — nothing to protect, fall through.
      }
    }
    const handle: IsolatedRun = {
      repoDir: realRepo,
      worktreeDir: realTarget,
      baseCommit: "",
      runId: NodePath.basename(realTarget),
    };
    return yield* removeIsolatedRun(handle);
  });

export interface SetupHook {
  /** Binary to execute (no shell lookup/splitting — execFile directly). */
  readonly command: string;
  readonly args?: ReadonlyArray<string>;
  /** Platforms this hook applies to. Omitted = all. Skipped hooks report. */
  readonly os?: ReadonlyArray<typeof process.platform>;
  readonly timeoutMs?: number;
}

export interface SetupHookResult {
  readonly command: string;
  readonly skipped: boolean;
  readonly ms: number;
  readonly code: number;
}

/** Run explicit post-create setup hooks in the worktree (M4 tail). No
 *  auto-discovery: hooks arrive only via the call param, never from repo
 *  scripts — an untrusted checkout must not auto-execute. Sequential (later
 *  hooks may depend on earlier ones); failure fails with command + tail. */
export const runSetupHooks = (workDir: string, hooks: ReadonlyArray<SetupHook>) =>
  Effect.gen(function* () {
    const results: SetupHookResult[] = [];
    for (const hook of hooks) {
      const t0 = Date.now();
      if (hook.os !== undefined && !hook.os.includes(process.platform)) {
        results.push({ command: hook.command, skipped: true, ms: Date.now() - t0, code: 0 });
        continue;
      }
      const timeoutMs = hook.timeoutMs ?? 60000;
      const execed = yield* Effect.tryPromise({
        try: () =>
          new Promise<{ failed: string | null; stdout: string; stderr: string }>((resolve) => {
            NodeCp.execFile(
              hook.command,
              [...(hook.args ?? [])],
              { cwd: workDir, timeout: timeoutMs, maxBuffer: 1024 * 1024 },
              (error, stdout, stderr) => {
                const err = error as (NodeJS.ErrnoException & { killed?: boolean }) | null;
                resolve({
                  failed: err === null ? null : err.killed === true ? `timed out after ${timeoutMs}ms` : err.message,
                  stdout: String(stdout ?? ""),
                  stderr: String((err as { stderr?: unknown } | null)?.stderr ?? stderr ?? ""),
                });
              },
            );
          }),
        catch: () => new Error(`hook spawn failed: ${hook.command}`),
      });
      if (execed.failed !== null) {
        return yield* fail("setup hook", workDir, `${hook.command}: ${execed.failed}\n${execed.stdout}\n${execed.stderr}`);
      }
      results.push({ command: hook.command, skipped: false, ms: Date.now() - t0, code: 0 });
    }
    return results;
  });

export const pruneOrphanWorktreeDirs = (tmpRoot: string, olderThanMs: number, nowMs = Date.now()) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = yield* Effect.tryPromise({
      try: () => NodeFs.promises.realpath(tmpRoot),
      catch: () => new Error("realpath tmp root failed"),
    }).pipe(Effect.catch(() => Effect.succeed(tmpRoot)));
    const entries = yield* fs.readDirectory(root).pipe(Effect.catch(() => Effect.succeed([] as string[])));
    const removed: string[] = [];
    for (const entry of entries) {
      if (!entry.startsWith(CARET_WORKTREE_PREFIX)) continue;
      const dir = path.join(root, entry);
      const stat = yield* Effect.tryPromise({
        try: () => NodeFs.promises.stat(dir),
        catch: () => new Error("stat failed"),
      }).pipe(Effect.catch(() => Effect.succeed(null)));
      if (stat === null || !stat.isDirectory()) continue;
      if (nowMs - stat.mtimeMs < olderThanMs) continue;
      // Registered worktrees are owned by their repo; only orphans die here.
      // A dir with a .git pointer file whose repo still lists it is live.
      const pointer = path.join(dir, ".git");
      const pointerExists = yield* fs.exists(pointer);
      if (pointerExists) {
        const content = yield* fs.readFileString(pointer).pipe(Effect.catch(() => Effect.succeed("")));
        const match = /^gitdir: (.+)$/m.exec(content);
        if (match?.[1]) {
          const adminDir = match[1].trim();
          // Resolve the owning repo: <x>/.git/worktrees/<entry> -> repo root.
          const marker = `${path.sep}.git${path.sep}worktrees${path.sep}`;
          const idx = adminDir.lastIndexOf(marker);
          if (idx >= 0) {
            const repoRoot = adminDir.slice(0, idx);
            const stillListed = yield* git(["worktree", "list", "--porcelain"], repoRoot, true).pipe(
              Effect.map((out) => out.code === 0 && out.stdout.includes(dir)),
              Effect.catch(() => Effect.succeed(false)),
            );
            if (stillListed) continue;
          }
        }
      }
      yield* Effect.promise(() => NodeFs.promises.rm(dir, { recursive: true, force: true })).pipe(
        Effect.catch(() => Effect.succeed(undefined)),
      );
      removed.push(dir);
    }
    return removed;
  });

/**
 * Remove registered caret worktrees older than the cutoff that are clean.
 * Dirty ones are kept (WT-05) and reported; callers surface them, never force.
 */
export const pruneOldRuns = (repoDir: string, olderThanMs: number, nowMs = Date.now()) =>
  Effect.gen(function* () {
    const listed = yield* listIsolatedRuns(repoDir);
    const removed: string[] = [];
    const keptDirty: string[] = [];
    for (const dir of listed) {
      const base = dir.split("/").pop() ?? "";
      if (!base.startsWith(CARET_WORKTREE_PREFIX)) continue;
      const stat = yield* Effect.tryPromise({
        try: () => NodeFs.promises.stat(dir),
        catch: () => new Error("stat failed"),
      }).pipe(Effect.catch(() => Effect.succeed(null)));
      if (stat === null || nowMs - stat.mtimeMs < olderThanMs) continue;
      const fauxRun: IsolatedRun = { repoDir, worktreeDir: dir, baseCommit: "", runId: base };
      const dirty = yield* worktreeStatus(fauxRun).pipe(Effect.catch(() => Effect.succeed(["unknown"])));
      if (dirty.length > 0) {
        keptDirty.push(dir);
        continue;
      }
      const gone = yield* removeIsolatedRun(fauxRun).pipe(Effect.catch(() => Effect.succeed(false)));
      if (gone) removed.push(dir);
    }
    return { removed, keptDirty };
  });
/** Default retained runs per repo (M4 tail). The Runs picker stays bounded; */
/** older clean runs are pruned on session stop. Live and dirty runs never */
/** count against the cap. */
export const DEFAULT_RUN_RETENTION = 20;

/**
 * Count-based retention cap: keep the newest `keep` caret runs, remove
 * older ones that are clean. The live run's dir and dirty runs are never
 * removed (dirty ones reported in keptDirty, same contract as
 * pruneOldRuns). Removal reuses removeWorktreeDir's guard chain, so
 * foreign/main-checkout/outside-tmp dirs fail loud instead of vanishing.
 * Unstatable dirs are kept — never prune what cannot be inspected.
 */
export const pruneRunsBeyondCap = (repoDir: string, keep: number, liveDir?: string) =>
  Effect.gen(function* () {
    if (!Number.isInteger(keep) || keep < 0) {
      return yield* fail("retention cap", repoDir, `keep must be a non-negative integer: ${keep}`);
    }
    const listed = yield* listCaretRuns(repoDir);
    const ranked: Array<{ dir: string; mtime: number }> = [];
    for (const dir of listed) {
      const stat = yield* Effect.tryPromise({
        try: () => NodeFs.promises.stat(dir),
        catch: () => new Error("stat failed"),
      }).pipe(Effect.catch(() => Effect.succeed(null)));
      ranked.push({ dir, mtime: stat === null ? Number.POSITIVE_INFINITY : stat.mtimeMs });
    }
    ranked.sort((a, b) => b.mtime - a.mtime || (a.dir < b.dir ? 1 : a.dir > b.dir ? -1 : 0));
    const kept: string[] = ranked.slice(0, keep).map((entry) => entry.dir);
    const removed: string[] = [];
    const keptDirty: string[] = [];
    for (const entry of ranked.slice(keep)) {
      const gone = yield* removeWorktreeDir(repoDir, entry.dir, liveDir).pipe(
        Effect.catch(() => Effect.succeed("skipped" as const)),
      );
      if (gone === true) removed.push(entry.dir);
      else if (gone === false) keptDirty.push(entry.dir);
      else kept.push(entry.dir);
    }
    return { removed, keptDirty, kept };
  });
