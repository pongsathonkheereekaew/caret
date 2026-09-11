// Session scoping conformance (multi-session): empty list, unknown ids,
// no-session errors, silent stop — all without an engine (every path here
// fails before touching a service). Positive interleaving needs live runs:
// see the WT-04 two-session proof (throwaway, evidence-linked).
import { describe, expect, it } from "vitest";
import * as Effect from "effect/Effect";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

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
    await expect(run(api["turn.cancel"]({} as never))).rejects.toThrow(/no session/);
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

  it("searches the journal without a live session and stays empty on misses", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "caret-chat-search-"));
    const journal = path.join(dir, "journal.jsonl");
    fs.writeFileSync(
      journal,
      [
        JSON.stringify({ t: "2026-09-11T00:00:00Z", type: "turn.completed", payload: "hello ui search" }),
        JSON.stringify({ t: "2026-09-11T00:01:00Z", type: "request.resolved", payload: { decision: "accept", detail: "rm hello" } }),
        "{not-json}",
        JSON.stringify({ t: "2026-09-11T00:02:00Z", type: "turn.completed", payload: "unrelated" }),
      ].join("\n") + "\n",
    );
    const prev = process.env["CARET_JOURNAL"];
    process.env["CARET_JOURNAL"] = journal;
    try {
      const api = createSessionApi(() => {});
      const empty = (await run(api["chat.search"]({ query: "" } as never))) as { hits: unknown[] };
      expect(empty.hits).toEqual([]);
      const miss = (await run(api["chat.search"]({ query: "zzz-nope" } as never))) as { hits: unknown[] };
      expect(miss.hits).toEqual([]);
      const hits = (await run(api["chat.search"]({ query: "ui search", limit: 5 } as never))) as {
        hits: Array<{ type: string; snippet: string }>;
      };
      expect(hits.hits.length).toBe(1);
      expect(hits.hits[0]?.type).toBe("turn.completed");
      expect(hits.hits[0]?.snippet).toMatch(/hello ui search/);
      const filtered = (await run(
        api["chat.search"]({ query: "ui search", types: ["request.resolved"] } as never),
      )) as { hits: unknown[] };
      expect(filtered.hits).toEqual([]);
    } finally {
      if (prev === undefined) delete process.env["CARET_JOURNAL"];
      else process.env["CARET_JOURNAL"] = prev;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
