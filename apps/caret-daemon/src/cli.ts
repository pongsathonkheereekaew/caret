// Caret headless CLI (PX-25 thin entry): argv → commands over TCP.
// Env: CARET_HOST (default 127.0.0.1), CARET_PORT (required),
// CARET_PAIRING (required). Engine/approval events stream to stderr so
// approvals are visible while a turn runs. Exit 0 ok, 2 usage, 1 failure.
// --json envelopes one command's lines as a single JSON object on stdout.
// send --ask answers approvals interactively on stdin (one prompt per
// request id, sequential; empty/EOF declines; refuses --json, which owns
// stdout).
import * as readline from "node:readline";
import { CaretClient } from "./client.ts";
import {
  cmdStatus,
  cmdStart,
  cmdSend,
  cmdSteer,
  cmdAnswer,
  cmdReview,
  cmdReject,
  cmdBringBack,
  cmdList,
  cmdRemove,
  cmdExport,
  cmdStop,
  createApprovalLoop,
  createJsonLog,
} from "./commands.ts";

const HELP = `caret <command> [args]
  status                              pairing check
  start <repoDir> [runId]             start session
  send <input...> [--id ID] [--ask]   send turn (waits; --ask answers approvals on stdin)
  steer <input...>                    steer live turn
  answer <requestId> accept|decline   answer approval
  review | reject | bringback         review flows
  list | remove <worktreeDir>         run management
  export <dir> [--overwrite]         run bundle
  stop                                stop session
  [--json]                            emit one JSON envelope on stdout (not with --ask)`;

const die = (message: string, code: number): never => {
  console.error(message);
  process.exit(code);
};

const askStdin = (question: string): Promise<string> =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let done = false;
    const finish = (answer: string) => {
      if (done) return;
      done = true;
      rl.close();
      resolve(answer);
    };
    process.stdin.once("end", () => finish(""));
    rl.question(question, (answer) => finish(answer ?? ""));
  });

const rawArgs = process.argv.slice(2);
const jsonMode = rawArgs.includes("--json");
const argv = rawArgs.filter((word) => word !== "--json");
const [command = "help", ...rest] = argv;
if (command === "help" || command === "--help" || command === "-h") {
  if (jsonMode) {
    console.log(JSON.stringify({ command: "help", ok: true, lines: HELP.split("\n") }));
  } else {
    console.log(HELP);
  }
  process.exit(0);
}
const port = Number(process.env["CARET_PORT"] ?? "");
const token = process.env["CARET_PAIRING"] ?? "";
if (!Number.isInteger(port) || port <= 0) die("CARET_PORT required (serve-tcp port)", 2);
if (!token) die("CARET_PAIRING required", 2);

let eventSink: (event: unknown) => void = (event) =>
  console.error(`event: ${JSON.stringify(event).slice(0, 300)}`);
const client = new CaretClient({
  host: process.env["CARET_HOST"] ?? "127.0.0.1",
  port,
  token,
  onEvent: (event) => eventSink(event),
});

const json = jsonMode ? createJsonLog(command, (line) => console.log(line)) : null;
const log = json ? json.log : (line: string) => console.log(line);

try {
  await client.connect();
  switch (command) {
    case "status": await cmdStatus(client, log); break;
    case "start": await cmdStart(client, log, rest[0] ?? "", rest[1] ?? ""); break;
    case "send": {
      const askMode = rest.includes("--ask");
      if (askMode && jsonMode) throw new Error("usage: --ask owns stdin/stdout, not with --json");
      const at = rest.indexOf("--id");
      const raw = at >= 0 ? rest[at + 1] : undefined;
      const words = rest.filter((word, i) => word !== "--ask" && i !== at && i !== at + 1);
      const id = raw === undefined ? undefined : /^\d+$/.test(raw) ? Number(raw) : raw;
      if (!askMode) {
        await cmdSend(client, log, words.join(" "), id);
      } else {
        if (!process.stdin.isTTY) console.error("warning: stdin is not a TTY; EOF answers decline");
        const loop = createApprovalLoop({
          answer: (requestId, verdict) => client.answerApproval(requestId, verdict),
          ask: askStdin,
          log,
        });
        let chain: Promise<unknown> = Promise.resolve();
        const stream = (event: unknown) => {
          console.error(`event: ${JSON.stringify(event).slice(0, 300)}`);
          chain = chain.then(() => loop.push(event as Record<string, unknown>).catch((error) => console.error(String(error))));
        };
        eventSink = stream;
        await cmdSend(client, log, words.join(" "), id);
        eventSink = (event) => console.error(`event: ${JSON.stringify(event).slice(0, 300)}`);
        await chain;
      }
      break;
    }
    case "steer": await cmdSteer(client, log, rest.join(" ")); break;
    case "answer": await cmdAnswer(client, log, rest[0] ?? "", rest[1] ?? ""); break;
    case "review": await cmdReview(client, log); break;
    case "reject": await cmdReject(client, log); break;
    case "bringback": await cmdBringBack(client, log); break;
    case "list": await cmdList(client, log); break;
    case "remove": await cmdRemove(client, log, rest[0] ?? ""); break;
    case "export":
      await cmdExport(client, log, rest[0] ?? "", rest.includes("--overwrite"));
      break;
    case "stop": await cmdStop(client, log); break;
    default: console.log(HELP); break;
  }
  client.close();
  json?.finish();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (json) {
    json.finish(error);
    client.close();
    process.exit(/usage:/.test(message) ? 2 : 1);
  }
  die(message, /usage:/.test(message) ? 2 : 1);
}
