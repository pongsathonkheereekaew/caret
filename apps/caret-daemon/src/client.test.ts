// Daemon client conformance (PX-26 seed): typed calls, error envelopes,
// events, explicit-id retry without re-execution, revoke rotation,
// timeout — against the real gateway with a stub API. No engine.
import { afterAll, describe, expect, it } from "vitest";
import * as Effect from "effect/Effect";

import { serveRemote, type RemoteServer } from "./remote.ts";
import { CaretClient, CaretClientError } from "./client.ts";

const HOST = "127.0.0.1";

describe("CaretClient", () => {
  let counter = 0;
  const events: unknown[] = [];

  // Fresh gateway + token per test: the idempotency cache is keyed by
  // token:id and clients auto-number from 1, so sharing either replays.
  let serial = 0;
  const booted: Array<{ gateway: RemoteServer; token: string }> = [];
  const boot = async () => {
    serial += 1;
    const token = `sdk-token-${serial}`;
    const next = await serveRemote(
      (notify) => ({
        "test.count": () =>
          Effect.gen(function* () {
            counter += 1;
            return { n: counter };
          }),
        "test.emit": () =>
          Effect.gen(function* () {
            notify({ event: "test.ping", n: counter });
            return { emitted: true };
          }),
        "test.fail": () => Effect.fail(new Error("stub boom")),
        "test.hang": () => Effect.never,
      }),
      (eff) => Effect.runPromise(eff as Effect.Effect<never, never>),
      { host: HOST, port: 0, token },
    );
    booted.push({ gateway: next, token });
    return { gateway: next, token };
  };

  const connect = async () => {
    const { gateway, token } = await boot();
    const client = new CaretClient({
      port: gateway.port,
      token,
      onEvent: (event) => events.push(event),
    });
    await client.connect();
    return client;
  };

  afterAll(async () => {
    for (const { gateway } of booted.splice(0)) {
      await gateway.close().catch(() => {});
    }
  });

  it("calls methods and surfaces error envelopes typed", async () => {
    const c = await connect();
    try {
      const before = counter;
      expect(await c.call<{ n: number }>("test.count", {})).toEqual({ n: before + 1 });
      const failure = await c.call("test.fail", {}).then(
        () => "resolved",
        (e: unknown) => e,
      );
      expect(failure).toBeInstanceOf(CaretClientError);
      expect((failure as CaretClientError).message).toContain("stub boom");
    } finally {
      c.close();
    }
  });

  it("delivers engine events to the handler", async () => {
    const c = await connect();
    try {
      events.length = 0;
      await c.call("test.emit", {});
      await c.call("pairing.status", {});
      expect(events).toContainEqual({ event: "test.ping", n: counter });
    } finally {
      c.close();
    }
  });

  it("retries an explicit id without re-executing", async () => {
    const c = await connect();
    try {
      const before = counter;
      const first = await c.call<{ n: number }>("test.count", {}, 500);
      const replay = await c.call<{ n: number }>("test.count", {}, 500);
      expect(replay).toEqual(first);
      expect(counter).toBe(before + 1);
    } finally {
      c.close();
    }
  });

  it("rotates pairing and times out hangs locally", async () => {
    const c = await connect();
    const mine = booted[booted.length - 1];
    if (!mine) throw new Error("no booted gateway");
    const stale = mine.token;
    try {
      const fresh = await c.revokePairing();
      expect(typeof fresh).toBe("string");
      expect(fresh).not.toBe(stale);
      // Old token is dead on this gateway; the client already switched.
      const probe = new CaretClient({ port: mine.gateway.port, token: stale });
      await probe.connect();
      try {
        await expect(probe.call("pairing.status", {})).rejects.toThrow(/unauthorized/);
      } finally {
        probe.close();
      }
      await expect(c.call("test.hang", {}, undefined, 150)).rejects.toThrow(/timed out/);
    } finally {
      c.close();
    }
  });
});
