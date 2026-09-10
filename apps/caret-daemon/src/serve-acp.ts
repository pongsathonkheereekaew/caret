// Caret ACP stdio entry (PX-24 thin loop): NDJSON JSON-RPC on stdin,
// responses on stdout — the same shape as server.ts, speaking ACP through
// the session API. Pairing token via CARET_PAIRING (required: ACP clients
// authenticate explicitly, no ambient trust).
import * as readline from "node:readline";
import * as Effect from "effect/Effect";
import * as Scope from "effect/Scope";
import { ManagedRuntime } from "effect";
import { bootDaemonLayer } from "./daemon.ts";
import { createSessionApi } from "./session-api.ts";
import { createAcpAdapter, serveAcpLines } from "./acp.ts";

const token = process.env["CARET_PAIRING"] ?? "";
if (!token) {
  console.error("CARET_PAIRING required");
  process.exit(2);
}

const runtime = ManagedRuntime.make(bootDaemonLayer(process.cwd()));
const scope = await runtime.runPromise(Scope.make());
const withScope = <A, E, R>(eff: Effect.Effect<A, E, R>) =>
  Effect.provideService(Scope.Scope)(scope)(eff);
const runEffect = <A>(eff: Effect.Effect<A, unknown>): Promise<A> =>
  runtime.runPromise(withScope(eff) as Effect.Effect<A, never>);

const send = (msg: unknown) => process.stdout.write(`${JSON.stringify(msg)}\n`);

// The API sink translates itself once the adapter exists.
let adapter: ReturnType<typeof createAcpAdapter>;
const api = createSessionApi((msg) =>
  adapter.onApiNotify(msg as { event?: unknown; [key: string]: unknown }),
);
adapter = createAcpAdapter({
  api,
  runEffect,
  notify: send,
  expectedToken: token,
  newRunId: () => `acp${Date.now().toString(36)}`,
});

send({ jsonrpc: "2.0", method: "caret/ready", params: { transports: ["acp"] } });

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
await serveAcpLines({ lines: rl, send, handle: (msg) => adapter.handle(msg) });
