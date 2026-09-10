// Session scoping conformance (multi-session): empty list, unknown ids,
// no-session errors, silent stop — all without an engine (every path here
// fails before touching a service). Positive interleaving needs live runs:
// see the WT-04 two-session proof (throwaway, evidence-linked).
import { describe, expect, it } from "vitest";
import * as Effect from "effect/Effect";

import { createSessionApi } from "./session-api.ts";

const run = <A>(eff: Effect.Effect<A, Error>) => Effect.runPromise(eff as Effect.Effect<A, never>);

describe("SessionScoping", () => {
  it("lists nothing and fails clean with zero sessions", async () => {
    const api = createSessionApi(() => {});
    expect(await run(api["session.list"]({} as never))).toEqual([]);
    await expect(run(api["turn.send"]({ input: "x" } as never))).rejects.toThrow(/no session/);
    await expect(run(api["run.review"]({} as never))).rejects.toThrow(/no session/);
    await expect(run(api["approval.answer"]({ requestId: "a", answer: "accept" } as never))).rejects.toThrow(
      /unknown approval/,
    );
    expect(await run(api["session.stop"]({} as never))).toEqual({});
  });

  it("names unknown sessions instead of touching the current", async () => {
    const api = createSessionApi(() => {});
    await expect(run(api["turn.send"]({ input: "x", session: "caret-slice-nope" } as never))).rejects.toThrow(
      /unknown session caret-slice-nope/,
    );
    await expect(run(api["run.export"]({ dir: "/tmp/x", session: "caret-slice-nope" } as never))).rejects.toThrow(
      /unknown session/,
    );
    expect(await run(api["session.list"]({} as never))).toEqual([]);
  });
});
