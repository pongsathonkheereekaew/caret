import * as Fs from "node:fs";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import * as Schema from "effect/Schema";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { CodexAdapter } from "../../server/src/provider/Services/CodexAdapter.ts";
import { makeCodexAdapterLive } from "../../server/src/provider/Layers/CodexAdapter.ts";
import { CheckpointStore } from "../../server/src/checkpointing/Services/CheckpointStore.ts";
import { CheckpointStoreLive } from "../../server/src/checkpointing/Layers/CheckpointStore.ts";
import { GitCoreLive } from "../../server/src/git/Layers/GitCore.ts";
import { ServerConfig } from "../../server/src/config.ts";
import { ThreadId, CheckpointRef } from "@synara/contracts";
import {
  createIsolatedRun,
  bringBackRun,
  removeIsolatedRun,
  runSetupHooks,
  type IsolatedRun,
  type SetupHook,
} from "./worktree.ts";
import { shouldForwardEngineEvent } from "./session-state.ts";

export interface ApprovalQuery {
  readonly requestType: unknown;
  readonly detail: unknown;
  readonly args: unknown;
}
export type ApprovalAnswer = "accept" | "decline";

/**
 * L8 capability envelope (seed). Each flag was earned by a live proof or a
 * root-caused failure — never declared from docs alone.
 */
export interface DriverCapabilities {
  /** Mid-turn steering lands at the next turn boundary (proven). */
  readonly steerLiveTurn: true;
  /** Pre-execution approval gating (proven). */
  readonly approvalBeforeSideEffects: true;
  /**
   * Resurrecting a STOPPED session via cursor. FALSE on Codex: stopSession
   * tears down the per-session provider process, and turn/start on the
   * orphaned native thread stalls silently (no response, no timeout).
   * Continuity across sessions uses semantic handoff instead.
   */
  readonly resumeStoppedSession: false;
  /**
   * Parallel LIVE sessions in one daemon. FALSE on Codex/OpenCode: their
   * adapters expose ONE competing-consumer queue (Stream.fromQueue), so a
   * second stream subscription steals events from the first and turn
   * waiters starve (proven 2026-09-10: completion journaled, waiter
   * blind). Sessions switch sequentially; true parallelism needs PubSub
   * adapters or one daemon process per session.
   */
  readonly parallelLiveSessions: false;
}

export const CODEX_DRIVER_CAPABILITIES: DriverCapabilities = {
  steerLiveTurn: true,
  approvalBeforeSideEffects: true,
  resumeStoppedSession: false,
  parallelLiveSessions: false,
};

export interface DaemonOptions {
  /** Scratch/config cwd for the (interim) test server config. */
  readonly configCwd: string;
  /** Called for every engine approval request. Must resolve explicitly. */
  readonly onApproval: (q: ApprovalQuery) => Promise<ApprovalAnswer>;
  /** JSONL journal path (Caret event journal seed). */
  readonly journalPath: string;
  /** Live sink for forwarded engine states (timeline UI). Optional. */
  readonly onEvent?: (type: string, payload: unknown) => void;
  /** Resume a prior native thread: opaque cursor (AG-06). */
  readonly resumeCursor?: unknown;
}

export interface CaretRun {
  readonly threadId: ThreadId;
  /** Main checkout (review target, bring-back destination). Never executed in. */
  readonly repoDir: string;
  /** Execution directory: the isolated worktree, or repoDir when isolation is off. */
  readonly workDir: string;
  readonly isolated: IsolatedRun | null;
  /** Set once bring-back verified the delta onto main: removal is then safe. */
  broughtBack: boolean;
  preRef: string;
  postRef: string;
}

const journal = (path: string, entry: unknown) =>
  Effect.sync(() =>
    Fs.appendFileSync(path, `${JSON.stringify({ t: new Date().toISOString(), ...entry })}\n`),
  );
export const bootDaemonLayer = (configCwd: string) => {
  const serverConfigLayer = ServerConfig.layerTest(configCwd, { prefix: "caret-daemon-" });
  const gitLive = GitCoreLive.pipe(
    Layer.provide(serverConfigLayer),
    Layer.provide(NodeServices.layer),
  );
  const storeLive = CheckpointStoreLive.pipe(
    Layer.provide(gitLive),
    Layer.provide(NodeServices.layer),
  );
  const adapterLive = makeCodexAdapterLive().pipe(
    Layer.provide(serverConfigLayer),
    Layer.provide(NodeServices.layer),
  );
  return Layer.mergeAll(adapterLive, storeLive, gitLive, NodeServices.layer);
};

/**
 * Start consumer + session. Execution is isolated by default: the engine
 * runs in a detached worktree and the main checkout is never executed in.
 * Pass `{ isolate: false }` only for scratch dirs.
 */
export const startCaretRun = (
  opts: DaemonOptions,
  repoDir: string,
  runId: string,
  runOptions?: { isolate?: boolean; setup?: ReadonlyArray<SetupHook> },
) =>
  Effect.gen(function* () {
    const adapter = yield* CodexAdapter;
    const store = yield* CheckpointStore;
    const threadId = Schema.decodeUnknownSync(ThreadId)(`caret-slice-${runId}`);
    const seen: Array<{ type: unknown; payload?: unknown }> = [];
    const eventsFiber = yield* Stream.runForEach(adapter.streamEvents, (event) =>
      Effect.gen(function* () {
        const t = (event as { type?: unknown }).type;
        const payload = (event as { payload?: unknown }).payload;
        seen.push({ type: t, payload });
        yield* journal(opts.journalPath, { type: t, payload: JSON.stringify(payload)?.slice(0, 2000) });
        if (typeof t === "string" && shouldForwardEngineEvent(t)) {
          const sink = opts.onEvent;
          if (sink) yield* Effect.sync(() => sink(t, payload));
        }
        if (t === "request.opened") {
          const rid = (event as { requestId?: string }).requestId;
          const answer = yield* Effect.promise(() =>
            opts.onApproval({
              requestType: (payload as { requestType?: unknown } | undefined)?.requestType,
              detail: (payload as { detail?: unknown } | undefined)?.detail,
              args: (payload as { args?: unknown } | undefined)?.args,
            }),
          );
          if (rid) {
            yield* adapter.respondToRequest(threadId, rid as never, answer === "accept" ? "accept" : "decline").pipe(Effect.ignore);
          }
        }
      }),
    ).pipe(Effect.forkScoped);

    const isolated = runOptions?.isolate === false
      ? null
      : yield* createIsolatedRun(repoDir, runId);
    const workDir = isolated ? isolated.worktreeDir : repoDir;
    if (runOptions?.setup !== undefined && runOptions.setup.length > 0) {
      const hookResults = yield* runSetupHooks(workDir, runOptions.setup);
      yield* journal(opts.journalPath, { type: "caret.run.setup", results: hookResults });
    }
    yield* adapter.startSession({
      threadId,
      cwd: workDir,
      runtimeMode: "approval-required",
      ...(opts.resumeCursor !== undefined ? { resumeCursor: opts.resumeCursor } : {}),
    });
    yield* journal(opts.journalPath, { type: "caret.run.isolated", workDir, baseCommit: isolated?.baseCommit ?? "(none)" });
    const preRef = `refs/caret-slice/${runId}/pre`;
    yield* store.captureCheckpoint({ cwd: workDir, checkpointRef: CheckpointRef.makeUnsafe(preRef) });
    const run: CaretRun = { threadId, repoDir, workDir, isolated, broughtBack: false, preRef, postRef: "" };
    return { run, seen, eventsFiber };
  });

/** Steer the live turn (AG-05): injected input lands at the next turn boundary. */
export const steerCaretTurn = (run: CaretRun, input: string) =>
  Effect.gen(function* () {
    const adapter = yield* CodexAdapter;
    return yield* adapter.steerTurn({ threadId: run.threadId, input, attachments: [] });
  });

/** Send one goal turn; resolves when turn.completed lands (or throws on timeout). */
export const sendCaretTurn = (
  run: CaretRun,
  seen: Array<{ type: unknown }>,
  input: string,
  timeoutMs = 200_000,
) =>
  Effect.gen(function* () {
    const adapter = yield* CodexAdapter;
    const before = seen.length;
    yield* adapter.sendTurn({ threadId: run.threadId, input, attachments: [] });
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const done = seen.slice(before).find((e) => e.type === "turn.completed");
      if (done) return done;
      yield* Effect.sleep("3 seconds");
    }
    return yield* Effect.fail(new Error(`turn.completed not observed within ${timeoutMs}ms`));
  });

/** Capture post-turn checkpoint; returns unified diff pre..post for review. */
export const reviewCaretRun = (run: CaretRun, n: number) =>
  Effect.gen(function* () {
    const store = yield* CheckpointStore;
    run.postRef = `refs/caret-slice/${run.threadId}/post-${n}`;
    yield* store.captureCheckpoint({ cwd: run.workDir, checkpointRef: CheckpointRef.makeUnsafe(run.postRef) });
    return yield* store.diffCheckpoints({
      cwd: run.workDir,
      fromCheckpointRef: CheckpointRef.makeUnsafe(run.preRef),
      toCheckpointRef: CheckpointRef.makeUnsafe(run.postRef),
      ignoreWhitespace: false,
    });
  });

/** Reject the run: reverse ONLY its delta; user/other content survives.
 *  Captures a post checkpoint if Review was never pressed — otherwise
 *  reverse has an empty toRef and looks like a no-op. */
export const rejectCaretRun = (run: CaretRun) =>
  Effect.gen(function* () {
    const store = yield* CheckpointStore;
    if (!run.postRef) {
      run.postRef = `refs/caret-slice/${run.threadId}/post-reject`;
      yield* store.captureCheckpoint({
        cwd: run.workDir,
        checkpointRef: CheckpointRef.makeUnsafe(run.postRef),
      });
    }
    return yield* store.reverseCheckpointDiff({
      cwd: run.workDir,
      fromCheckpointRef: CheckpointRef.makeUnsafe(run.preRef),
      toCheckpointRef: CheckpointRef.makeUnsafe(run.postRef),
    });
  });
/**
 * Semantic handoff: portable continuity for session switches and engine
 * changes (ARCHITECTURE: explicit handoff, never lossy native transfer).
 * Captures current state, diffs against pre-turn, and extracts the approval
 * record from the event log. No engine call — pure assembly.
 */
export interface RunHandoff {
  readonly goal: string;
  readonly workDir: string;
  readonly baseCommit: string | null;
  readonly filesChanged: string[];
  readonly approvals: Array<{ type: unknown; decision: unknown }>;
  readonly diff: string;
}

export const summarizeRunForHandoff = (
  run: CaretRun,
  seen: Array<{ type: unknown; payload?: unknown }>,
  goal: string,
) =>
  Effect.gen(function* () {
    const store = yield* CheckpointStore;
    const ref = `refs/caret-slice/${run.threadId}/handoff`;
    yield* store.captureCheckpoint({ cwd: run.workDir, checkpointRef: CheckpointRef.makeUnsafe(ref) });
    const diff = yield* store.diffCheckpoints({
      cwd: run.workDir,
      fromCheckpointRef: CheckpointRef.makeUnsafe(run.preRef),
      toCheckpointRef: CheckpointRef.makeUnsafe(ref),
      ignoreWhitespace: false,
    });
    const decisions = new Map<string, unknown>();
    for (const event of seen) {
      const payload = (event.payload ?? {}) as { requestType?: unknown; decision?: unknown };
      if (event.type === "request.resolved" && typeof payload.requestType === "string") {
        decisions.set(payload.requestType, payload.decision ?? "answered");
      }
    }
    const filesChanged = [...new Set(
      diff.split("\n").filter((line) => line.startsWith("+++ b/")).map((line) => line.slice("+++ b/".length)),
    )];
    const handoff: RunHandoff = {
      goal,
      workDir: run.workDir,
      baseCommit: run.isolated?.baseCommit ?? null,
      filesChanged,
      approvals: [...decisions].map(([type, decision]) => ({ type, decision })),
      diff: diff.slice(0, 20000),
    };
    return handoff;
  });
export const bringBackCaretRun = (run: CaretRun) =>
  Effect.gen(function* () {
    if (!run.isolated) {
      return true;
    }
    const brought = yield* bringBackRun(run.isolated);
    if (brought) {
      run.broughtBack = true;
    }
    return brought;
  });

export const stopCaretRun = (run: CaretRun) =>
  Effect.gen(function* () {
    const adapter = yield* CodexAdapter;
    yield* adapter.stopSession({ threadId: run.threadId }).pipe(Effect.ignore);
    if (run.isolated) {
      const removed = yield* removeIsolatedRun(run.isolated, { force: run.broughtBack }).pipe(
        Effect.catch(() => Effect.succeed(false)),
      );
      return { worktreeRemoved: removed };
    }
    return { worktreeRemoved: true };
  });

/** Re-capture pre-turn checkpoint on a live run (resume leg). */
export const recaptureCaretRun = (run: CaretRun, label: string) =>
  Effect.gen(function* () {
    const store = yield* CheckpointStore;
    run.preRef = `refs/caret-slice/${run.threadId}/${label}`;
    yield* store.captureCheckpoint({ cwd: run.workDir, checkpointRef: CheckpointRef.makeUnsafe(run.preRef) });
  });
