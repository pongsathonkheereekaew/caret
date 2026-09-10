// Caret session API (M5 refactor): the engine-facing method map extracted
// from server.ts so stdio and the TCP gateway serve the SAME handlers over
// shared run state. No behavior change — `send` became an injected sink.
import * as Effect from "effect/Effect";
import {
  startCaretRun,
  sendCaretTurn,
  reviewCaretRun,
  rejectCaretRun,
  bringBackCaretRun,
  recaptureCaretRun,
  stopCaretRun,
  summarizeRunForHandoff,
  type ApprovalAnswer,
  type CaretRun,
} from "./daemon.ts";
import { listCaretRuns, removeWorktreeDir } from "./worktree.ts";
import { assembleRunBundle, writeRunBundle } from "./export.ts";

export type SessionApi = Record<string, (params: never) => Effect.Effect<unknown, Error>>;

export const createSessionApi = (notify: (msg: unknown) => void): SessionApi => {
  let run: CaretRun | null = null;
  let seen: Array<{ type: unknown; payload?: unknown }> = [];
  const parked = new Map<string, (a: ApprovalAnswer) => void>();
  let reviewCount = 0;
  let lastGoal = "";
  return {
    "session.start": (p: { repoDir: string; runId: string }) =>
      Effect.gen(function* () {
        const started = yield* startCaretRun(
          {
            configCwd: p.repoDir,
            journalPath: process.env["CARET_JOURNAL"] ?? "/tmp/caret-daemon-journal.jsonl",
            onApproval: (q) =>
              new Promise<ApprovalAnswer>((resolve) => {
                const id = `appr_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
                parked.set(id, resolve);
                notify({ event: "approval.requested", requestId: id, requestType: q.requestType, detail: String(q.detail)?.slice(0, 500) });
              }),
          },
          p.repoDir,
          p.runId,
        );
        run = started.run;
        seen = started.seen;
        reviewCount = 0;
        lastGoal = "";
        return { threadId: String(started.run.threadId) };
      }),
    "turn.send": (p: { input: string }) =>
      Effect.gen(function* () {
        if (!run) return yield* Effect.fail(new Error("no session"));
        lastGoal = p.input;
        const done = (yield* sendCaretTurn(run, seen, p.input)) as { payload?: { state?: string } };
        return { state: (done.payload as { state?: string } | undefined)?.state ?? "completed" };
      }),
    "run.review": () =>
      Effect.gen(function* () {
        if (!run) return yield* Effect.fail(new Error("no session"));
        reviewCount += 1;
        const diff = yield* reviewCaretRun(run, reviewCount);
        return { diff: diff.slice(0, 20000) };
      }),
    "run.reject": () =>
      Effect.gen(function* () {
        if (!run) return yield* Effect.fail(new Error("no session"));
        return { reversed: yield* rejectCaretRun(run) };
      }),
    "run.bringBack": () =>
      Effect.gen(function* () {
        if (!run) return yield* Effect.fail(new Error("no session"));
        const brought = yield* bringBackCaretRun(run);
        return { brought };
      }),
    "run.list": () =>
      Effect.gen(function* () {
        if (!run) return yield* Effect.fail(new Error("no session"));
        return { runs: yield* listCaretRuns(run.repoDir) };
      }),
    "run.remove": (p: { worktreeDir: string }) =>
      Effect.gen(function* () {
        if (!run) return yield* Effect.fail(new Error("no session"));
        const removed = yield* removeWorktreeDir(run.repoDir, p.worktreeDir, run.isolated?.worktreeDir);
        return { removed };
      }),
    "run.export": (p: { dir: string; overwrite?: boolean }) =>
      Effect.gen(function* () {
        if (!run) return yield* Effect.fail(new Error("no session"));
        const handoff = yield* summarizeRunForHandoff(run, seen, lastGoal);
        const bundle = assembleRunBundle({
          threadId: String(run.threadId),
          goal: lastGoal,
          handoff,
          journal: seen.slice(-500),
        });
        const path = yield* writeRunBundle(p.dir, bundle, p.overwrite ?? false);
        return { path, files: handoff.filesChanged.length, events: bundle.journal.length };
      }),
    "run.recapture": (p: { label: string }) =>
      Effect.gen(function* () {
        if (!run) return yield* Effect.fail(new Error("no session"));
        yield* recaptureCaretRun(run, p.label);
        return {};
      }),
    "session.stop": () =>
      Effect.gen(function* () {
        if (run) yield* stopCaretRun(run);
        run = null;
        return {};
      }),
    "approval.answer": (p: { requestId: string; answer: ApprovalAnswer }) =>
      Effect.gen(function* () {
        const resolve = parked.get(p.requestId);
        if (!resolve) return yield* Effect.fail(new Error(`unknown approval ${p.requestId}`));
        parked.delete(p.requestId);
        resolve(p.answer === "accept" ? "accept" : "decline");
        return {};
      }),
  };
};
