// Embed-server seam keepers: real HTTP against a tiny fixture that speaks
// llama.cpp's /embedding shape. No model — the vector is deterministic so
// ranking tests stay in search-index.test.ts.
import * as http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { EmbedClient, EmbedError, MAX_EMBED_CHARS, PREFIX_DOC, PREFIX_QUERY } from "./embed-client.ts";

const PORT = 18925;

const server = http.createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/embedding") {
    res.writeHead(404);
    res.end();
    return;
  }
  let raw = "";
  req.on("data", (chunk: Buffer) => {
    raw += chunk.toString("utf8");
  });
  req.on("end", () => {
    let content = "";
    try {
      content = String((JSON.parse(raw) as { content?: unknown }).content ?? "");
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    if (content.includes("boom")) {
      res.writeHead(500);
      res.end("fail");
      return;
    }
    if (content.includes("sleep")) {
      setTimeout(() => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ embedding: [1, 0] }));
      }, 800);
      return;
    }
    const nested = content.includes("nested");
    const vec = content.startsWith(PREFIX_QUERY) ? [0, 1] : [1, 0];
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ embedding: nested ? [vec] : vec }));
  });
});

describe("EmbedClient", () => {
  let client: EmbedClient;

  beforeAll(
    () =>
      new Promise<void>((resolve) => {
        server.listen(PORT, () => resolve());
      }),
  );
  afterAll(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  );

  it("prefixes document vs query and accepts nested or flat vectors", async () => {
    client = new EmbedClient(`http://127.0.0.1:${PORT}`);
    const doc = await client.embed("hello", "document");
    expect(doc).toEqual([1, 0]);
    const query = await client.embed("hello", "query");
    expect(query).toEqual([0, 1]);
    const nested = await client.embed("nested", "document");
    expect(nested).toEqual([1, 0]);
    expect(PREFIX_DOC.endsWith(":")).toBe(true);
    expect(PREFIX_QUERY.endsWith(":")).toBe(true);
  });

  it("refuses oversized chunks and surfaces HTTP/timeout errors", async () => {
    const c = new EmbedClient(`http://127.0.0.1:${PORT}`, 80);
    await expect(c.embed("x".repeat(MAX_EMBED_CHARS), "document")).rejects.toThrow(/chunk too large/);
    await expect(c.embed("boom", "document")).rejects.toThrow(EmbedError);
    await expect(c.embed("sleep", "document")).rejects.toThrow(/timed out/);
  });
});
