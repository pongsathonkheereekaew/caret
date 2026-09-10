// Caret worktree isolation fixtures (WT-01…03/05). Real git in tmpdir,
// no mocks: isolation, clean bring-back, collision refusal, dirty-remove refusal.
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync, utimesSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

import * as NodeServices from "@effect/platform-node/NodeServices";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { Effect, Layer, ManagedRuntime } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import {
  bringBackRun,
  createIsolatedRun,
  listCaretRuns,
  listIsolatedRuns,
  pruneOldRuns,
  pruneRunsBeyondCap,
  pruneOrphanWorktreeDirs,
  removeIsolatedRun,
  removeWorktreeDir,
  runSetupHooks,
  worktreeDiff,
  type IsolatedRun,
} from "./worktree.ts";
import { GitCoreLive } from "../../server/src/git/Layers/GitCore.ts";
import { ServerConfig } from "../../server/src/config.ts";

const git = (cwd: string, args: string[]) =>
  execFileSync("git", ["-c", "user.name=caret", "-c", "user.email=caret@test", "-c", "commit.gpgsign=false", "-c", "init.defaultBranch=main", ...args], { cwd, stdio: "pipe" });

describe("CaretWorktree", () => {
  interface TestRuntime {
    runPromise: <A, E>(effect: Effect.Effect<A, E>) => Promise<A>;
    dispose: () => Promise<void>;
  }
  let runtime: TestRuntime | null = null;
  let mainDir = "";
  let counter = 0;
  const boot = () => {
    mainDir = mkdtempSync(join(tmpdir(), "caret-wt-main-"));
    git(mainDir, ["init"]);
    writeFileSync(join(mainDir, "tracked.txt"), "base\n");
    git(mainDir, ["add", "-A"]);
    git(mainDir, ["commit", "-qm", "base"]);
    // Upstream idiom (GitCore.test.ts): feed each live layer explicitly AND
    // merge NodeServices at top for direct consumers.
    const serverConfigLayer = ServerConfig.layerTest(mainDir, { prefix: "caret-wt-test-" });
    const gitLive = GitCoreLive.pipe(
      Layer.provide(serverConfigLayer),
      Layer.provide(NodeServices.layer),
    );
    const layer = Layer.mergeAll(gitLive, NodeServices.layer);
    runtime = ManagedRuntime.make(layer) as unknown as TestRuntime;
    counter += 1;
    return `t${counter}-${Date.now() % 100000}`;
  };
  afterEach(async () => {
    if (runtime) {
      await runtime.dispose();
      runtime = null;
    }
    if (mainDir) {
      try {
        execFileSync("git", ["worktree", "list", "--porcelain"], { cwd: mainDir, stdio: "pipe" })
          .toString().split("\n").filter((line) => line.startsWith("worktree "))
          .map((line) => line.slice("worktree ".length))
          .filter((dir) => dir !== mainDir)
          .forEach((dir) => {
            try { execFileSync("git", ["-C", mainDir, "worktree", "remove", "--force", dir], { stdio: "pipe" }); } catch { /* best effort */ }
          });
      } catch { /* best effort */ }
      rmSync(mainDir, { recursive: true, force: true });
      mainDir = "";
    }
  });

  const run = <A, E>(effect: Effect.Effect<A, E>) => (runtime as ManagedRuntime.ManagedRuntime<never, never>).runPromise(effect as Effect.Effect<A, never>);

  it("isolates engine writes from the main checkout", async () => {
    const id = boot();
    const isolated = await run(createIsolatedRun(mainDir, id));
    writeFileSync(join(isolated.worktreeDir, "agent.txt"), "agent work\n");
    expect(existsSync(join(mainDir, "agent.txt"))).toBe(false);
    const diff = await run(worktreeDiff(isolated));
    expect(diff).toContain("agent.txt");
    await run(removeIsolatedRun(isolated).pipe(Effect.catch(() => Effect.succeed(false))));
  });

  it("brings back a clean delta onto main", async () => {
    const id = boot();
    const isolated: IsolatedRun = await run(createIsolatedRun(mainDir, id));
    writeFileSync(join(isolated.worktreeDir, "agent.txt"), "agent work\n");
    expect(await run(bringBackRun(isolated))).toBe(true);
    expect(readFileSync(join(mainDir, "agent.txt"), "utf8")).toBe("agent work\n");
  });

  it("refuses bring-back on overlapping dirty main files", async () => {
    const id = boot();
    const isolated: IsolatedRun = await run(createIsolatedRun(mainDir, id));
    writeFileSync(join(isolated.worktreeDir, "tracked.txt"), "agent edit\n");
    writeFileSync(join(mainDir, "tracked.txt"), "user edit\n");
    expect(await run(bringBackRun(isolated))).toBe(false);
    expect(readFileSync(join(mainDir, "tracked.txt"), "utf8")).toBe("user edit\n");
  });

  it("refuses to remove a dirty worktree, removes once clean", async () => {
    const id = boot();
    const isolated: IsolatedRun = await run(createIsolatedRun(mainDir, id));
    writeFileSync(join(isolated.worktreeDir, "agent.txt"), "agent work\n");
    expect(await run(removeIsolatedRun(isolated))).toBe(false);
    await run(bringBackRun(isolated));
    git(mainDir, ["add", "-A"]);
    git(mainDir, ["commit", "-qm", "brought back"]);
    // worktree still dirty (its own files) until reversed; clean it via checkout
    execFileSync("git", ["-C", isolated.worktreeDir, "checkout", "--", "."], { stdio: "pipe" });
    rmSync(join(isolated.worktreeDir, "agent.txt"), { force: true });
    expect(await run(removeIsolatedRun(isolated))).toBe(true);
    const remaining = await run(listIsolatedRuns(mainDir));
    expect(remaining).not.toContain(isolated.worktreeDir);
  });
  it("prunes orphan dirs, keeps registered and foreign ones", async () => {
    const id = boot();
    void id;
    const now = Date.now();
    const old = new Date(now - 120_000);
    // Live registered run, aged artificially: must survive via registration.
    const live: IsolatedRun = await run(createIsolatedRun(mainDir, `live${counter}`));
    utimesSync(live.worktreeDir, old, old);
    // Orphan: caret prefix, old, no registration anywhere.
    const orphanRoot = mkdtempSync(join(tmpdir(), "caret-prune-root-"));
    const canonRoot = realpathSync(orphanRoot);
    const orphan = join(canonRoot, "caret-wt-orphan-1");
    mkdirSync(orphan);
    writeFileSync(join(orphan, "junk.txt"), "junk\n");
    utimesSync(orphan, old, old);
    // Foreign old dir: never touched (wrong prefix).
    const foreign = join(canonRoot, "not-caret-stuff");
    mkdirSync(foreign);
    writeFileSync(join(foreign, "keep.txt"), "keep\n");
    utimesSync(foreign, old, old);
    const removedRoots = await run(pruneOrphanWorktreeDirs(orphanRoot, 60_000, now));
    expect(removedRoots).toEqual([orphan]);
    expect(existsSync(foreign)).toBe(true);
    const removedTmp = await run(pruneOrphanWorktreeDirs(tmpdir(), 60_000, now));
    expect(removedTmp).not.toContain(live.worktreeDir);
    expect(existsSync(live.worktreeDir)).toBe(true);
    rmSync(orphanRoot, { recursive: true, force: true });
  });

  it("prunes old clean runs, keeps dirty and young ones", async () => {
    const id = boot();
    void id;
    const now = Date.now();
    const old = new Date(now - 120_000);
    const oldRun: IsolatedRun = await run(createIsolatedRun(mainDir, `old${counter}`));
    utimesSync(oldRun.worktreeDir, old, old);
    const dirtyRun: IsolatedRun = await run(createIsolatedRun(mainDir, `dirty${counter}`));
    writeFileSync(join(dirtyRun.worktreeDir, "wip.txt"), "wip\n");
    utimesSync(dirtyRun.worktreeDir, old, old);
    const youngRun: IsolatedRun = await run(createIsolatedRun(mainDir, `young${counter}`));
    const { removed, keptDirty } = await run(pruneOldRuns(mainDir, 60_000, now));
    expect(removed).toContain(oldRun.worktreeDir);
    expect(keptDirty).toContain(dirtyRun.worktreeDir);
    expect(removed).not.toContain(dirtyRun.worktreeDir);
    expect(removed).not.toContain(youngRun.worktreeDir);
    const remaining = await run(listIsolatedRuns(mainDir));
    expect(remaining).not.toContain(oldRun.worktreeDir);
    expect(remaining).toContain(dirtyRun.worktreeDir);
  });

  it("picker lists caret runs only, removes clean ones by path", async () => {
    const id = boot();
    const isolated: IsolatedRun = await run(createIsolatedRun(mainDir, id));
    // Foreign linked checkout: visible to git, never picker-managed.
    const foreign = mkdtempSync(join(tmpdir(), "foreign-wt-"));
    git(mainDir, ["worktree", "add", foreign]);
    try {
      const listed = await run(listCaretRuns(mainDir));
      expect(listed).toContain(isolated.worktreeDir);
      expect(listed).not.toContain(foreign);
      expect(listed).not.toContain(mainDir);
      expect(await run(removeWorktreeDir(mainDir, isolated.worktreeDir))).toBe(true);
      expect(existsSync(isolated.worktreeDir)).toBe(false);
      expect(await run(listCaretRuns(mainDir))).not.toContain(isolated.worktreeDir);
    } finally {
      try { execFileSync("git", ["-C", mainDir, "worktree", "remove", "--force", foreign], { stdio: "pipe" }); } catch { /* best effort */ }
      rmSync(foreign, { recursive: true, force: true });
    }
  });

  it("picker remove refuses dirty runs, dirs survive", async () => {
    const id = boot();
    const isolated: IsolatedRun = await run(createIsolatedRun(mainDir, id));
    writeFileSync(join(isolated.worktreeDir, "wip.txt"), "wip\n");
    expect(await run(removeWorktreeDir(mainDir, isolated.worktreeDir))).toBe(false);
    expect(existsSync(isolated.worktreeDir)).toBe(true);
  });

  it("picker remove refuses main checkout, foreign dirs, live dir, spoofs", async () => {
    const id = boot();
    const isolated: IsolatedRun = await run(createIsolatedRun(mainDir, id));
    await expect(run(removeWorktreeDir(mainDir, mainDir))).rejects.toThrow(/main checkout/);
    await expect(run(removeWorktreeDir(mainDir, join(tmpdir(), "caret-wt-gone-xyz")))).rejects.toThrow(/not found/);
    const junk = mkdtempSync(join(tmpdir(), "junk-"));
    try {
      await expect(run(removeWorktreeDir(mainDir, junk))).rejects.toThrow(/not a Caret worktree/);
    } finally {
      rmSync(junk, { recursive: true, force: true });
    }
    await expect(run(removeWorktreeDir(mainDir, isolated.worktreeDir, isolated.worktreeDir))).rejects.toThrow(/live session/);
    // Caret prefix but outside the tmp root: the tmp-root guard fires first.
    const outside = join(dirname(realpathSync(tmpdir())), `caret-wt-outside-${Date.now() % 100000}`);
    mkdirSync(outside);
    try {
      await expect(run(removeWorktreeDir(mainDir, outside))).rejects.toThrow(/outside the tmp root/);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
    // Caret prefix inside the repo tree but never registered as a worktree:
    // guards pass (fixtures live under tmp) and git itself refuses loudly.
    // Unregistered orphans stay on the prune path — never rm -rf'd here.
    const spoof = join(mainDir, "caret-wt-spoof");
    mkdirSync(spoof);
    await expect(run(removeWorktreeDir(mainDir, spoof))).rejects.toThrow(/not a working tree/);
    expect(existsSync(isolated.worktreeDir)).toBe(true);
  });



  it("setup hooks run in order and skip foreign platforms", async () => {
    boot();
    const dir = mkdtempSync(join(tmpdir(), "caret-hook-"));
    try {
      const node = process.execPath;
      const results = await run(runSetupHooks(dir, [
        { command: node, args: ["-e", "require('fs').appendFileSync('order.txt','one\\n')"] },
        { command: node, args: ["-e", "require('fs').appendFileSync('order.txt','two\\n')"], os: [process.platform] },
        { command: node, args: ["-e", "process.exit(1)"], os: [process.platform === "darwin" ? "linux" : "darwin"] },
      ]));
      expect(readFileSync(join(dir, "order.txt"), "utf8")).toBe("one\ntwo\n");
      expect(results).toEqual([
        { command: node, skipped: false, ms: expect.any(Number), code: 0 },
        { command: node, skipped: false, ms: expect.any(Number), code: 0 },
        { command: node, skipped: true, ms: expect.any(Number), code: 0 },
      ]);
      expect(await run(runSetupHooks(dir, []))).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("setup hooks fail loud: exit codes, timeouts, no shell", async () => {
    boot();
    const dir = mkdtempSync(join(tmpdir(), "caret-hook-"));
    try {
      const node = process.execPath;
      await expect(run(runSetupHooks(dir, [
        { command: node, args: ["-e", "console.error('hook-boom');process.exit(3)"] },
      ]))).rejects.toThrow(/hook-boom/);
      // Real-timer exception: the kill lives in the child-process timeout
      // (libuv), not the JS clock — fake timers cannot drive it.
      await expect(run(runSetupHooks(dir, [
        { command: node, args: ["-e", "setTimeout(()=>{},30000)"], timeoutMs: 300 },
      ]))).rejects.toThrow(/timed out/);
      // A spaced binary name is NOT split: execFile goes direct, no shell.
      await expect(run(runSetupHooks(dir, [
        { command: `${node} -e`, args: [] },
      ]))).rejects.toThrow(/ENOENT/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("retention cap keeps newest N clean runs, removes older ones", async () => {
    boot();
    const now = Date.now();
    const mk = async (tag: string, ageMs: number) => {
      const r: IsolatedRun = await run(createIsolatedRun(mainDir, `${tag}${counter}`));
      const t = new Date(now - ageMs);
      utimesSync(r.worktreeDir, t, t);
      return r;
    };
    const oldest = await mk("cap-oldest-", 400_000);
    const middle = await mk("cap-middle-", 300_000);
    const newer = await mk("cap-newer-", 200_000);
    const newest = await mk("cap-newest-", 100_000);
    const { removed, keptDirty, kept } = await run(pruneRunsBeyondCap(mainDir, 2));
    expect(removed).toEqual(expect.arrayContaining([oldest.worktreeDir, middle.worktreeDir]));
    expect(removed).not.toContain(newer.worktreeDir);
    expect(removed).not.toContain(newest.worktreeDir);
    expect(keptDirty).toEqual([]);
    expect(kept).toEqual(expect.arrayContaining([newer.worktreeDir, newest.worktreeDir]));
    expect(existsSync(oldest.worktreeDir)).toBe(false);
    expect(existsSync(newest.worktreeDir)).toBe(true);
  });

  it("retention cap never takes the live dir or dirty runs", async () => {
    boot();
    const now = Date.now();
    const live: IsolatedRun = await run(createIsolatedRun(mainDir, `cap-live-${counter}`));
    utimesSync(live.worktreeDir, new Date(now - 500_000), new Date(now - 500_000));
    const dirty: IsolatedRun = await run(createIsolatedRun(mainDir, `cap-dirty-${counter}`));
    writeFileSync(join(dirty.worktreeDir, "wip.txt"), "wip\n");
    utimesSync(dirty.worktreeDir, new Date(now - 400_000), new Date(now - 400_000));
    const fresh: IsolatedRun = await run(createIsolatedRun(mainDir, `cap-fresh-${counter}`));
    const { removed, keptDirty, kept } = await run(pruneRunsBeyondCap(mainDir, 1, live.worktreeDir));
    expect(removed).not.toContain(live.worktreeDir);
    expect(removed).not.toContain(dirty.worktreeDir);
    expect(keptDirty).toContain(dirty.worktreeDir);
    expect(kept).toEqual(expect.arrayContaining([live.worktreeDir, fresh.worktreeDir]));
    expect(existsSync(live.worktreeDir)).toBe(true);
    expect(existsSync(dirty.worktreeDir)).toBe(true);
  });

  it("retention cap rejects negative keep", async () => {
    boot();
    await expect(run(pruneRunsBeyondCap(mainDir, -1))).rejects.toThrow(/non-negative integer/);
  });


});
