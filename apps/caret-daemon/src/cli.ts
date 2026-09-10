// Caret headless CLI (PX-25 thin entry): argv → commands over TCP.
// Env: CARET_HOST (default 127.0.0.1), CARET_PORT (required),
// CARET_PAIRING (required). Engine/approval events stream to stderr so
// approvals are visible while a turn runs. Exit 0 ok, 2 usage, 1 failure.
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
} from "./commands.ts";

const HELP = `caret <command> [args]
  status                              pairing check
  start <repoDir> [runId]             start session
  send <input...>                     send turn (waits)
  steer <input...>                    steer live turn
  answer <requestId> accept|decline   answer approval
  review | reject | bringback         review flows
  list | remove <worktreeDir>         run management
  export <dir> [--overwrite]         run bundle
  stop                                stop session`;

const die = (message: string, code: number): never => {
  console.error(message);
  process.exit(code);
};

const [command = "help", ...rest] = process.argv.slice(2);
if (command === "help" || command === "--help" || command === "-h") {
  console.log(HELP);
  process.exit(0);
}
const port = Number(process.env["CARET_PORT"] ?? "");
const token = process.env["CARET_PAIRING"] ?? "";
if (!Number.isInteger(port) || port <= 0) die("CARET_PORT required (serve-tcp port)", 2);
if (!token) die("CARET_PAIRING required", 2);

const log = (line: string) => console.log(line);
const client = new CaretClient({
  host: process.env["CARET_HOST"] ?? "127.0.0.1",
  port,
  token,
  onEvent: (event) => console.error(`event: ${JSON.stringify(event).slice(0, 300)}`),
});

try {
  await client.connect();
  switch (command) {
    case "status": await cmdStatus(client, log); break;
    case "start": await cmdStart(client, log, rest[0] ?? "", rest[1] ?? ""); break;
    case "send": await cmdSend(client, log, rest.join(" ")); break;
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
} catch (error) {
  die(error instanceof Error ? error.message : String(error), /usage:/.test(error instanceof Error ? error.message : "") ? 2 : 1);
}
