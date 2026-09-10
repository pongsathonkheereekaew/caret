// Caret remote daemon entry (M5): the session API over TCP for second
// clients (desktop LAN, future mobile). Prints one NDJSON
// `remote.ready{host,port,pairingFile}` line on stdout. The pairing token
// NEVER prints: set CARET_PAIRING env, or read the 0600 pairing file it
// names (pair over a trusted channel; LAN bind is an explicit flag).
//
// Lifetime: one process-wide scope feeds every request, so session fibers
// (approval stream) outlive any single envelope — the server.ts posture.
import * as Fs from "node:fs";
import * as Os from "node:os";
import * as NodePath from "node:path";
import { parsePort } from "./startup.ts";
import * as Effect from "effect/Effect";
import * as Scope from "effect/Scope";
import { ManagedRuntime } from "effect";
import { bootDaemonLayer } from "./daemon.ts";
import { createSessionApi } from "./session-api.ts";
import { serveRemote } from "./remote.ts";

const host = process.env["CARET_HOST"]?.trim() || "127.0.0.1";
const port = parsePort(process.env["CARET_PORT"], 0);
const runtime = ManagedRuntime.make(bootDaemonLayer(process.cwd()));
// One process-lifetime scope (never closed before exit): session fibers
// forked under it outlive any single envelope — the server.ts posture.
const scope = await runtime.runPromise(Scope.make());
const withScope = <A, E, R>(eff: Effect.Effect<A, E, R>) => Effect.provideService(Scope.Scope)(scope)(eff);
const runEffect = <A>(eff: Effect.Effect<A, unknown>): Promise<A> =>
  runtime.runPromise(withScope(eff) as Effect.Effect<A, never>);

const gateway = await serveRemote((notify) => createSessionApi(notify), runEffect, {
  host,
  port,
  token: process.env["CARET_PAIRING"],
});

let pairingFile: string | null = null;
if (!process.env["CARET_PAIRING"]) {
  pairingFile =
    process.env["CARET_PAIRING_FILE"] ?? NodePath.join(Os.tmpdir(), `caret-pairing-${gateway.port}.token`);
  Fs.writeFileSync(pairingFile, `${gateway.token}\n`, { mode: 0o600 });
}

console.log(JSON.stringify({ event: "remote.ready", host, port: gateway.port, pairingFile }));
