// Caret session API (multi-session): the engine-facing method map over a
// per-thread state map, served identically over stdio and TCP. Every
// run-scoped method takes an optional `session` (thread id); omitted means
// the current (last-started) session, so single-session clients (composer,
// CLI) work unchanged. Approvals park per session; unknown ids fail loud.
import * as Effect from "effect/Effect";
import * as fs from "node:fs";
import * as os from "node:os";
import {
  startCaretRun,
  sendCaretTurn,
  reviewCaretRun,
  rejectCaretRun,
  steerCaretTurn,
  interruptCaretTurn,
  bringBackCaretRun,
  recaptureCaretRun,
  stopCaretRun,
  summarizeRunForHandoff,
  type ApprovalAnswer,
  type CaretRun,
} from "./daemon.ts";
import { DEFAULT_RUN_RETENTION, listCaretRuns, pruneRunsBeyondCap, removeWorktreeDir } from "./worktree.ts";
import { collectArtifacts, listChangedPaths } from "./artifacts.ts";
import { DocsCache } from "./docs-source.ts";
import { assembleRunBundle, writeRunBundle } from "./export.ts";
import { engineRowKind } from "./session-state.ts";
import { searchChats } from "./search.ts";
import { EmbedClient } from "./embed-client.ts";
import { buildFileIndex, embedAndRank } from "./search-index.ts";
import { IndexJob } from "./index-job.ts";
import { canAttachToPrompt } from "./context-policy.ts";
import { isIgnored } from "./ignore.ts";
import { canonRoot } from "./path-id.ts";
import { readIgnorePatterns, scanRepoTexts } from "./scan-repo.ts";
import {
  applyPlanEvent,
  createPlan,
  revisePlan,
  type PlanDocument,
} from "./plan.ts";
import * as Fiber from "effect/Fiber";
import * as path from "node:path";

export type SessionApi = Record<string, (params: never) => Effect.Effect<unknown, Error>>;

const engineDetail = (payload: unknown): string | undefined => {
  if (typeof payload === "string") return payload.slice(0, 500);
  if (payload && typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    for (const key of ["message", "detail", "text", "warning", "reason"] as const) {
      const v = o[key];
      if (typeof v === "string" && v.length > 0) return v.slice(0, 500);
    }
    try {
      return JSON.stringify(payload).slice(0, 500);
    } catch {
      return undefined;
    }
  }
  return undefined;
};

interface SessionState {
  run: CaretRun | null;
  seen: Array<{ type: unknown; payload?: unknown }>;
  parked: Map<string, (a: ApprovalAnswer) => void>;
  reviewCount: number;
  lastGoal: string;
  repoDir: string;
  runId: string;
  createdAt: number;
  fiber: Fiber.RuntimeFiber<unknown, unknown> | null;
  /** Mutable token for the in-flight turn.send wait loop. */
  turnCancel: { cancelled: boolean } | null;
  title: string;
  archived: boolean;
  pinned: boolean;
  plan: PlanDocument;
}

type JournalEvent = {
  t?: unknown;
  type?: unknown;
  payload?: unknown;
  goal?: unknown;
  workDir?: unknown;
};

const readJournalEvents = (path: string): JournalEvent[] => {
  try {
    const text = fs.readFileSync(path, "utf8");
    const out: JournalEvent[] = [];
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        out.push(JSON.parse(trimmed) as JournalEvent);
      } catch {
        // Corrupt lines stay out of the index instead of failing search.
      }
    }
    return out;
  } catch {
    return [];
  }
};

export const createSessionApi = (notify: (msg: unknown) => void): SessionApi => {
  const sessions = new Map<string, SessionState>();
  const indexJobs = new Map<string, IndexJob>();
  const docs = new DocsCache(process.env["CARET_DOCS_CACHE"] ?? path.join(os.homedir(), ".caret", "docs-cache"));
  let current: string | null = null;

  const sel = (session?: string): SessionState | null => {
    const id = session ?? current;
    if (!id) return null;
    return sessions.get(id) ?? null;
  };

  const need = (session?: string): SessionState => {
    const st = sel(session);
    if (!st) {
      throw new Error(session ? `unknown session ${session}` : "no session");
    }
    return st;
  };

  const live = (st: SessionState): CaretRun => {
    if (!st.run) throw new Error("session has no live run");
    return st.run;
  };

  const indexJob = (root: string): IndexJob => {
    root = canonRoot(root);
    const existing = indexJobs.get(root);
    if (existing) return existing;
    const url = process.env["CARET_EMBED_URL"];
    if (!url) {
      throw new Error("CARET_EMBED_URL not set — start llama-server --embedding (see SEARCH-embed-evidence.md)");
    }
    const job = new IndexJob(
      root,
      async () => scanRepoTexts(root),
      new EmbedClient(url),
      (status) => notify({ event: "index.progress", status }),
    );
    indexJobs.set(root, job);
    return job;
  };

  return {
    "session.start": (p: { repoDir: string; runId: string }) =>
      Effect.gen(function* () {
        if ([...sessions.values()].some((s) => s.run !== null)) {
          return yield* Effect.fail(
            new Error("another session is live (stop it first — one live subscription per daemon)"),
          );
        }
        const threadId = `caret-slice-${p.runId}`;
        const st: SessionState = {
          run: null,
          seen: [],
          parked: new Map(),
          reviewCount: 0,
          lastGoal: "",
          repoDir: p.repoDir,
          runId: p.runId,
          createdAt: Date.now(),
          fiber: null,
          turnCancel: null,
          title: "",
          archived: false,
          pinned: false,
          plan: createPlan(`plan-${p.runId}`, p.runId),
        };
        const pushPlan = () =>
          notify({
            event: "plan",
            threadId,
            title: st.plan.title,
            revision: st.plan.revision,
            tasks: st.plan.tasks,
          });
        const started = yield* startCaretRun(
          {
            configCwd: p.repoDir,
            journalPath: process.env["CARET_JOURNAL"] ?? "/tmp/caret-daemon-journal.jsonl",
            onApproval: (q) =>
              new Promise<ApprovalAnswer>((resolve) => {
                const id = `appr_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
                st.parked.set(id, resolve);
                notify({ event: "approval.requested", requestId: id, requestType: q.requestType, detail: String(q.detail)?.slice(0, 500) });
              }),
            onEvent: (type, payload) => {
              const next = applyPlanEvent(st.plan, type, payload);
              if (next !== st.plan) {
                st.plan = next;
                pushPlan();
              }
              notify({
                event: "engine",
                type,
                kind: engineRowKind(type),
                detail: engineDetail(payload),
              });
            },
          },
          p.repoDir,
          p.runId,
        );
        st.run = started.run;
        st.seen = started.seen;
        st.fiber = started.eventsFiber;
        sessions.set(threadId, st);
        current = threadId;
        return { threadId };
      }),
    "session.list": (p: { query?: string; archived?: boolean } = {}) =>
      Effect.sync(() => {
        const q = String(p?.query ?? "").trim().toLowerCase();
        return [...sessions]
          .filter(([, st]) => {
            if (p?.archived === true) return st.archived;
            if (st.archived) return false;
            if (!q) return true;
            const hay = `${st.title} ${st.lastGoal} ${st.repoDir} ${st.runId}`.toLowerCase();
            return hay.includes(q);
          })
          .sort((a, b) => Number(b[1].pinned) - Number(a[1].pinned) || b[1].createdAt - a[1].createdAt)
          .map(([threadId, st]) => ({
            threadId,
            runId: st.runId,
            repoDir: st.repoDir,
            goal: st.lastGoal,
            title: st.title || st.lastGoal || st.runId,
            live: st.run !== null,
            current: threadId === current,
            archived: st.archived,
            pinned: st.pinned,
          }));
      }),
    "session.select": (p: { session: string }) =>
      Effect.sync(() => {
        const st = need(p.session);
        current = p.session;
        return { threadId: p.session, live: st.run !== null };
      }),
    "session.rename": (p: { title: string; session?: string }) =>
      Effect.sync(() => {
        const st = need(p.session);
        const title = (p.title ?? "").trim();
        if (!title) throw new Error("title required");
        st.title = title.slice(0, 120);
        return { title: st.title };
      }),
    "session.pin": (p: { pinned?: boolean; session?: string }) =>
      Effect.sync(() => {
        const st = need(p.session);
        st.pinned = p.pinned !== false;
        if (p.pinned === false) st.pinned = false;
        return { pinned: st.pinned };
      }),
    "session.archive": (p: { archived?: boolean; session?: string }) =>
      Effect.sync(() => {
        const st = need(p.session);
        st.archived = p.archived !== false;
        if (p.archived === false) st.archived = false;
        return { archived: st.archived };
      }),
    "session.forget": (p: { session?: string }) =>
      Effect.sync(() => {
        const st = need(p.session);
        if (st.run) throw new Error("stop the live session before forget");
        const id = p.session ?? current;
        if (!id) return {};
        sessions.delete(id);
        if (current === id) {
          const remaining = [...sessions.keys()];
          current = remaining.length > 0 ? (remaining[remaining.length - 1] as string) : null;
        }
        return { forgotten: true };
      }),
    "plan.get": (p: { session?: string }) =>
      Effect.sync(() => {
        const st = need(p.session);
        return { title: st.plan.title, revision: st.plan.revision, tasks: st.plan.tasks };
      }),
    "plan.revise": (p: { title?: string; tasks?: Array<{ title: string; done?: boolean }>; session?: string }) =>
      Effect.sync(() => {
        const st = need(p.session);
        st.plan = revisePlan(st.plan, { title: p.title, tasks: p.tasks });
        notify({
          event: "plan",
          title: st.plan.title,
          revision: st.plan.revision,
          tasks: st.plan.tasks,
        });
        return { title: st.plan.title, revision: st.plan.revision, tasks: st.plan.tasks };
      }),
    "turn.send": (p: { input: string; session?: string }) =>
      Effect.gen(function* () {
        const st = need(p.session);
        const run = live(st);
        st.lastGoal = p.input;
        if (!st.title) st.title = p.input.slice(0, 80);
        const cancel = { cancelled: false };
        st.turnCancel = cancel;
        try {
          const done = (yield* sendCaretTurn(run, st.seen, p.input, 200_000, cancel)) as {
            payload?: { state?: string };
          };
          return { state: (done.payload as { state?: string } | undefined)?.state ?? "completed" };
        } finally {
          if (st.turnCancel === cancel) st.turnCancel = null;
        }
      }),
    "turn.cancel": (p: { session?: string }) =>
      Effect.gen(function* () {
        const st = need(p.session);
        const hadTurn = st.turnCancel !== null;
        if (st.turnCancel) st.turnCancel.cancelled = true;
        // Unblock a turn parked on an approval card.
        for (const [, resolve] of st.parked) {
          resolve("decline");
        }
        st.parked.clear();
        if (st.run) yield* interruptCaretTurn(st.run);
        return { cancelled: true, hadTurn };
      }),
    "turn.steer": (p: { input: string; session?: string }) =>
      Effect.gen(function* () {
        const st = need(p.session);
        const run = live(st);
        st.lastGoal = p.input;
        yield* steerCaretTurn(run, p.input);
        return { steered: true };
      }),
    "run.review": (p: { session?: string }) =>
      Effect.gen(function* () {
        const st = need(p.session);
        const run = live(st);
        st.reviewCount += 1;
        const diff = yield* reviewCaretRun(run, st.reviewCount);
        return { diff: diff.slice(0, 20000) };
      }),
    "run.reject": (p: { session?: string }) =>
      Effect.gen(function* () {
        const st = need(p.session);
        const run = live(st);
        return { reversed: yield* rejectCaretRun(run) };
      }),
    "run.bringBack": (p: { session?: string }) =>
      Effect.gen(function* () {
        const st = need(p.session);
        const run = live(st);
        const brought = yield* bringBackCaretRun(run);
        return { brought };
      }),
    "run.list": (p: { session?: string }) =>
      Effect.gen(function* () {
        const st = need(p.session);
        const run = live(st);
        return { runs: yield* listCaretRuns(run.repoDir) };
      }),
    "run.remove": (p: { worktreeDir: string; session?: string }) =>
      Effect.gen(function* () {
        const st = need(p.session);
        const run = live(st);
        const removed = yield* removeWorktreeDir(run.repoDir, p.worktreeDir, run.isolated?.worktreeDir);
        return { removed };
      }),
    "run.export": (p: { dir: string; overwrite?: boolean; session?: string }) =>
      Effect.gen(function* () {
        const st = need(p.session);
        const run = live(st);
        const handoff = yield* summarizeRunForHandoff(run, st.seen, st.lastGoal);
        const bundle = assembleRunBundle({
          threadId: String(run.threadId),
          goal: st.lastGoal,
          handoff,
          journal: st.seen.slice(-500),
        });
        const path = yield* writeRunBundle(p.dir, bundle, p.overwrite ?? false);
        return { path, files: handoff.filesChanged.length, events: bundle.journal.length };
      }),
    "run.artifacts": (p: { session?: string }) =>
      Effect.sync(() => {
        const st = need(p.session);
        const run = live(st);
        const revision = run.postRef || run.preRef || "uncommitted";
        const changed = listChangedPaths(run.workDir, run.preRef);
        const items = collectArtifacts({
          runId: String(run.threadId),
          revision,
          workDir: run.workDir,
          changed,
          journal: st.seen,
        });
        return { runId: String(run.threadId), revision, items };
      }),
    "run.recapture": (p: { label: string; session?: string }) =>
      Effect.gen(function* () {
        const st = need(p.session);
        const run = live(st);
        yield* recaptureCaretRun(run, p.label);
        return {};
      }),
    "session.stop": (p: { session?: string }) =>
      Effect.gen(function* () {
        const id = p.session ?? current;
        if (!id) return {};
        const st = sessions.get(id);
        if (st?.turnCancel) st.turnCancel.cancelled = true;
        if (st?.parked.size) {
          for (const [, resolve] of st.parked) resolve("decline");
          st.parked.clear();
        }
        if (st?.fiber) yield* Fiber.interrupt(st.fiber).pipe(Effect.catch(() => Effect.succeed(false)));
        if (st?.run) yield* stopCaretRun(st.run);
        // Keep a metadata row for the task list (AG-02). Worktree teardown
        // still happens in stopCaretRun; this record is title/goal only.
        if (st) {
          st.run = null;
          st.fiber = null;
          st.turnCancel = null;
          yield* pruneRunsBeyondCap(st.repoDir, DEFAULT_RUN_RETENTION, undefined).pipe(
            Effect.catch(() => Effect.succeed({ removed: [], keptDirty: [], kept: [] })),
          );
        }
        return {};
      }),
    "approval.answer": (p: { requestId: string; answer: ApprovalAnswer; session?: string }) =>
      Effect.gen(function* () {
        const target = p.session ? sessions.get(p.session) ?? null : null;
        const scopes = target ? [target] : [...sessions.values()];
        for (const st of scopes) {
          const resolve = st.parked.get(p.requestId);
          if (resolve) {
            st.parked.delete(p.requestId);
            resolve(p.answer === "accept" ? "accept" : "decline");
            return {};
          }
        }
        return yield* Effect.fail(new Error(`unknown approval ${p.requestId}`));
      }),
    "chat.search": (p: {
      query: string;
      types?: string[];
      since?: string;
      until?: string;
      limit?: number;
      session?: string;
    }) =>
      Effect.sync(() => {
        const events: JournalEvent[] = [];
        const journalPath = process.env["CARET_JOURNAL"];
        if (journalPath) events.push(...readJournalEvents(journalPath));
        const st = p.session ? (sessions.get(p.session) ?? null) : current ? (sessions.get(current) ?? null) : null;
        if (st) {
          for (const [i, entry] of st.seen.entries()) {
            events.push({
              t: `live-${i}`,
              type: entry.type,
              payload: entry.payload,
              goal: st.lastGoal,
            });
          }
        }
        return {
          hits: searchChats(events, {
            query: p.query ?? "",
            types: p.types,
            since: p.since,
            until: p.until,
            limit: p.limit,
          }),
        };
      }),
    "index.status": (p: { root?: string; session?: string }) =>
      Effect.sync(() => {
        const st = need(p.session);
        const root = canonRoot(p.root ?? st.repoDir);
        return indexJobs.get(root)?.status() ?? {
          root,
          phase: "idle",
          filesDone: 0,
          filesTotal: 0,
          chunksDone: 0,
          chunksTotal: 0,
          generation: 0,
          failures: [],
        };
      }),
    "index.rebuild": (p: { root?: string; session?: string }) =>
      Effect.sync(() => {
        const st = need(p.session);
        const job = indexJob(p.root ?? st.repoDir);
        void job.rebuild();
        return { started: true, status: job.status() };
      }),
    "index.pause": (p: { root?: string; session?: string }) =>
      Effect.sync(() => {
        const st = need(p.session);
        return indexJob(p.root ?? st.repoDir).pause();
      }),
    "index.resume": (p: { root?: string; session?: string }) =>
      Effect.sync(() => {
        const st = need(p.session);
        const job = indexJob(p.root ?? st.repoDir);
        void job.resume();
        return { started: true, status: job.status() };
      }),
    "code.search": (p: {
      query: string;
      files?: Array<{ path: string; text: string }>;
      limit?: number;
      session?: string;
    }) =>
      Effect.gen(function* () {
        const url = process.env["CARET_EMBED_URL"];
        if (!url) {
          return yield* Effect.fail(
            new Error("CARET_EMBED_URL not set — start llama-server --embedding (see SEARCH-embed-evidence.md)"),
          );
        }
        const query = (p.query ?? "").trim();
        if (!query) return { hits: [] as Array<{ id: string; score: number; snippet: string }> };
        let files = p.files;
        if (files) {
          const st = p.session
            ? (sessions.get(p.session) ?? null)
            : current
              ? (sessions.get(current) ?? null)
              : null;
          const patterns = st ? readIgnorePatterns(st.repoDir) : [];
          files = files.filter((file) =>
            canAttachToPrompt({ ignored: isIgnored(file.path, patterns), sandboxDenied: false }),
          );
        }
        if (!files) {
          const st = p.session
            ? (sessions.get(p.session) ?? null)
            : current
              ? (sessions.get(current) ?? null)
              : null;
          if (!st) return yield* Effect.fail(new Error("no session"));
          const job = indexJob(st.repoDir);
          if (job.status().phase === "idle") {
            void job.rebuild();
            return yield* Effect.fail(new Error("index build started — retry when index status is ready"));
          }
          const ranked = yield* Effect.tryPromise({
            try: () => job.search(query, p.limit ?? 8),
            catch: (e) => new Error(e instanceof Error ? e.message : String(e)),
          });
          return { hits: ranked.map((hit) => ({ id: hit.id, score: hit.score, snippet: hit.id })) };
        }
        const index = buildFileIndex(files, 900, 100);
        const ranked = yield* Effect.tryPromise({
          try: () => embedAndRank(new EmbedClient(url), index, query, p.limit ?? 8),
          catch: (e) => new Error(e instanceof Error ? e.message : String(e)),
        });
        const byDoc = new Map(index.chunks.map((c) => [c.doc, c.text]));
        return {
          hits: ranked.map((hit) => ({
            id: hit.id,
            score: hit.score,
            snippet: (byDoc.get(hit.id) ?? hit.id).slice(0, 120),
          })),
        };
      }),
    "docs.list": () => Effect.sync(() => ({ items: docs.list() })),
    "docs.get": (p: { url: string }) =>
      Effect.sync(() => {
        const rec = docs.get(p.url);
        if (!rec) throw new Error(`no cached docs for ${p.url}`);
        return rec;
      }),
    "docs.fetch": (p: { url: string; force?: boolean }) =>
      Effect.tryPromise({
        try: () => docs.fetch(p.url, p.force ?? false),
        catch: (e) => new Error(e instanceof Error ? e.message : String(e)),
      }),
    "docs.refresh": (p: { url: string }) =>
      Effect.tryPromise({
        try: () => docs.refresh(p.url),
        catch: (e) => new Error(e instanceof Error ? e.message : String(e)),
      }),
  };
};
