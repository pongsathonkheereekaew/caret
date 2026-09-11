// Caret session API (multi-session): the engine-facing method map over a
// per-thread state map, served identically over stdio and TCP. Every
// run-scoped method takes an optional `session` (thread id); omitted means
// the current (last-started) session, so single-session clients (composer,
// CLI) work unchanged. Approvals park per session; unknown ids fail loud.
import * as Effect from "effect/Effect";
import * as fs from "node:fs";
import {
  startCaretRun,
  sendCaretTurn,
  reviewCaretRun,
  rejectCaretRun,
  steerCaretTurn,
  bringBackCaretRun,
  recaptureCaretRun,
  stopCaretRun,
  summarizeRunForHandoff,
  type ApprovalAnswer,
  type CaretRun,
} from "./daemon.ts";
import { DEFAULT_RUN_RETENTION, listCaretRuns, pruneRunsBeyondCap, removeWorktreeDir } from "./worktree.ts";
import { assembleRunBundle, writeRunBundle } from "./export.ts";
import { engineRowKind } from "./session-state.ts";
import { searchChats } from "./search.ts";
import * as Fiber from "effect/Fiber";

export type SessionApi = Record<string, (params: never) => Effect.Effect<unknown, Error>>;

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

  return {
    "session.start": (p: { repoDir: string; runId: string }) =>
      Effect.gen(function* () {
        if (sessions.size > 0) {
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
        };
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
            onEvent: (type, payload) =>
              notify({
                event: "engine",
                type,
                kind: engineRowKind(type),
                detail: typeof payload === "string" ? payload.slice(0, 500) : undefined,
              }),
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
    "session.list": () =>
      Effect.gen(function* () {
        return [...sessions].map(([threadId, st]) => ({
          threadId,
          runId: st.runId,
          repoDir: st.repoDir,
          goal: st.lastGoal,
          live: st.run !== null,
          current: threadId === current,
        }));
      }),
    "turn.send": (p: { input: string; session?: string }) =>
      Effect.gen(function* () {
        const st = need(p.session);
        const run = live(st);
        st.lastGoal = p.input;
        const done = (yield* sendCaretTurn(run, st.seen, p.input)) as { payload?: { state?: string } };
        return { state: (done.payload as { state?: string } | undefined)?.state ?? "completed" };
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
        if (st?.fiber) yield* Fiber.interrupt(st.fiber).pipe(Effect.catch(() => Effect.succeed(false)));
        if (st?.run) yield* stopCaretRun(st.run);
        // Retention cap (M4 tail): bound retained run worktrees on the way
        // out. Best-effort — retention must never fail session teardown.
        if (st) {
          yield* pruneRunsBeyondCap(st.repoDir, DEFAULT_RUN_RETENTION, st.run?.isolated?.worktreeDir).pipe(
            Effect.catch(() => Effect.succeed({ removed: [], keptDirty: [], kept: [] })),
          );
        }
        sessions.delete(id);
        if (current === id) {
          const remaining = [...sessions.keys()];
          current = remaining.length > 0 ? (remaining[remaining.length - 1] as string) : null;
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
  };
};
