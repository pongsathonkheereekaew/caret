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

  it("fails code.search loud without CARET_EMBED_URL", async () => {
    const api = createSessionApi(() => {});
    const prev = process.env["CARET_EMBED_URL"];
    delete process.env["CARET_EMBED_URL"];
    try {
      await expect(run(api["code.search"]({ query: "alpha" } as never))).rejects.toThrow(/CARET_EMBED_URL/);
    } finally {
      if (prev !== undefined) process.env["CARET_EMBED_URL"] = prev;
    }
  });

  it("ranks code.search hits through a fixture embed server", async () => {
    const http = await import("node:http");
    const server = http.createServer((req, res) => {
      let raw = "";
      req.on("data", (chunk: Buffer) => {
        raw += chunk.toString("utf8");
      });
      req.on("end", () => {
        const content = String((JSON.parse(raw) as { content?: unknown }).content ?? "");
        const vec = content.includes("alpha") ? [1, 0] : [0, 1];
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ embedding: vec }));
      });
    });
    const port = await new Promise<number>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        resolve(typeof addr === "object" && addr ? addr.port : 0);
      });
    });
    const prev = process.env["CARET_EMBED_URL"];
    process.env["CARET_EMBED_URL"] = `http://127.0.0.1:${port}`;
    try {
      const api = createSessionApi(() => {});
      const found = (await run(
        api["code.search"]({
          query: "alpha",
          files: [
            { path: "alpha.ts", text: "export const alpha = 1" },
            { path: "beta.ts", text: "export const beta = 2" },
          ],
          limit: 2,
        } as never),
      )) as { hits: Array<{ id: string }> };
      expect(found.hits[0]?.id).toBe("alpha.ts");
    } finally {
      if (prev === undefined) delete process.env["CARET_EMBED_URL"];
      else process.env["CARET_EMBED_URL"] = prev;
      await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    }
  });
});
