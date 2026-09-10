import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Stream from "effect/Stream";
import * as readline from "node:readline";
import { bootDaemonLayer } from "./daemon.ts";
import { createSessionApi, type SessionApi } from "./session-api.ts";

const send = (msg: unknown) => process.stdout.write(`${JSON.stringify(msg)}\n`);

const program = Effect.gen(function* () {
  const api: SessionApi = createSessionApi(send);

  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  yield* Effect.sync(() => send({ event: "daemon.ready", version: "0.0.1" }));
  yield* Stream.runForEach(Stream.fromAsyncIterable(rl, (e) => e as Error), (line) =>
    Effect.gen(function* () {
      const trimmed = String(line).trim();
      if (!trimmed) return;
      let req: { id?: number; method?: string; params?: Record<string, never> };
      try {
        req = JSON.parse(trimmed) as typeof req;
      } catch {
        return yield* Effect.sync(() => send({ id: null, ok: false, error: "invalid json" }));
      }
      const handler = (api as Record<string, (p: never) => Effect.Effect<unknown, Error>>)[req.method ?? ""];
      if (!handler) {
        return yield* Effect.sync(() => send({ id: req.id, ok: false, error: `unknown method ${req.method}` }));
      }
      const exit = yield* Effect.exit(handler(req.params as never));
      if (Exit.isFailure(exit)) {
        const detail = Cause.squash(exit.cause);
        const message = detail instanceof Error ? detail.message : String(detail);
        yield* Effect.sync(() => send({ id: req.id, ok: false, error: message.slice(0, 500) }));
      } else {
        yield* Effect.sync(() => send({ id: req.id, ok: true, result: exit.value }));
      }
    }),
  );
});

await Effect.runPromise(program.pipe(Effect.scoped, Effect.provide(bootDaemonLayer(process.cwd()))));
