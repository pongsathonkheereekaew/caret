// Caret headless commands (PX-25 seed): one async function per daemon
// operation over an injected CaretClient. Output goes through `log` lines
// (human-readable, stable prefixes) so scripts can grep; --json envelopes
// the same lines as one JSON object for machines. Approval answering is
// explicit per id — bulk --accept-all is deliberately absent (approval
// deserves a decision); the interactive loop asks once per request id.
import type { CaretClient } from "./client.ts";

export type Logger = (line: string) => void;

/** One JSON envelope per command (PX-25 --json): machines parse, humans read lines. */
export const createJsonLog = (
  command: string,
  out: (line: string) => void,
): { log: Logger; finish: (error?: unknown) => void } => {
  const lines: string[] = [];
  return {
    log: (line) => lines.push(line),
    finish: (error) => {
      if (error) {
        out(JSON.stringify({ command, ok: false, error: error instanceof Error ? error.message : String(error) }));
      } else {
        out(JSON.stringify({ command, ok: true, lines }));
      }
    },
  };
};

export type AskFn = (question: string) => Promise<string>;

/**
 * Interactive approval loop (PX-25): feed daemon events, prompt once per
 * approval request id, answer explicitly. Empty/anything-but-yes declines —
 * the safe default when the operator walks away or stdin hits EOF.
 */
export const createApprovalLoop = (opts: {
  answer: (requestId: string, answer: "accept" | "decline") => Promise<unknown>;
  ask: AskFn;
  log: Logger;
}): { push: (event: Record<string, unknown>) => Promise<void> } => {
  const seen = new Set<string>();
  return {
    push: async (event) => {
      if (event["event"] !== "approval.requested" || typeof event["requestId"] !== "string") return;
      const requestId = event["requestId"];
      if (seen.has(requestId)) return;
      seen.add(requestId);
      const detail = typeof event["detail"] === "string" && event["detail"] ? ` — ${event["detail"]}` : "";
      const reply = ((await opts.ask(`approve ${requestId} (${String(event["requestType"] ?? "unknown")})${detail}? [y/N] `)) ?? "")
        .trim()
        .toLowerCase();
      const verdict = reply === "y" || reply === "yes" ? "accept" : "decline";
      await opts.answer(requestId, verdict);
      opts.log(`approval ${requestId}: ${verdict}`);
    },
  };
};

const short = (value: string, n: number): string =>
  value.length > n ? `${value.slice(0, n)}…` : value;

export const cmdStatus = async (client: CaretClient, log: Logger): Promise<void> => {
  const status = await client.pairingStatus();
  log(`paired: ${status.paired}`);
};

export const cmdStart = async (
  client: CaretClient,
  log: Logger,
  repoDir: string,
  runId: string,
): Promise<void> => {
  if (!repoDir) throw new Error("usage: start <repoDir> [runId]");
  const started = await client.startSession(repoDir, runId || `cli-${Date.now() % 100000}`);
  log(`thread: ${started.threadId}`);
};

export const cmdSend = async (
  client: CaretClient,
  log: Logger,
  input: string,
  id?: string | number,
): Promise<void> => {
  if (!input.trim()) throw new Error("usage: send <input> [--id ID]");
  const done = await client.sendTurn(input, id);
  log(`turn: ${done.state}`);
};

export const cmdSteer = async (client: CaretClient, log: Logger, input: string): Promise<void> => {
  if (!input.trim()) throw new Error("usage: steer <input>");
  const done = await client.steerTurn(input);
  log(`steered: ${done.steered}`);
};

export const cmdAnswer = async (
  client: CaretClient,
  log: Logger,
  requestId: string,
  answer: string,
): Promise<void> => {
  if (!requestId || (answer !== "accept" && answer !== "decline")) {
    throw new Error("usage: answer <requestId> accept|decline");
  }
  await client.answerApproval(requestId, answer);
  log(`approval ${requestId}: ${answer}`);
};

export const cmdReview = async (client: CaretClient, log: Logger): Promise<void> => {
  const review = await client.reviewRun();
  log(`diff ${review.diff.length} chars:`);
  for (const line of review.diff.split("\n").slice(0, 40)) log(`  ${line}`);
};

export const cmdReject = async (client: CaretClient, log: Logger): Promise<void> => {
  const done = await client.rejectRun();
  log(`reversed: ${done.reversed}`);
};

export const cmdBringBack = async (client: CaretClient, log: Logger): Promise<void> => {
  const done = await client.bringBackRun();
  if (done.brought === true) {
    log("brought back onto the main checkout");
  } else {
    log("bring-back refused — resolve conflicts first");
  }
};

export const cmdList = async (client: CaretClient, log: Logger): Promise<void> => {
  const listed = await client.listRuns();
  if (listed.runs.length === 0) {
    log("no isolated runs");
    return;
  }
  for (const dir of listed.runs) log(`run: ${short(dir.split("/").pop() ?? dir, 40)} ${dir}`);
};

export const cmdRemove = async (client: CaretClient, log: Logger, worktreeDir: string): Promise<void> => {
  if (!worktreeDir) throw new Error("usage: remove <worktreeDir>");
  const done = await client.removeRun(worktreeDir);
  log(done.removed ? `removed ${worktreeDir}` : "refused — dirty run, review or reject first");
};

export const cmdExport = async (
  client: CaretClient,
  log: Logger,
  dir: string,
  overwrite: boolean,
): Promise<void> => {
  if (!dir) throw new Error("usage: export <dir> [--overwrite]");
  const done = await client.exportRun(dir, overwrite);
  log(`exported ${done.files} files, ${done.events} events → ${done.path}`);
};

export const cmdStop = async (client: CaretClient, log: Logger): Promise<void> => {
  await client.stopSession();
  log("stopped");
};
