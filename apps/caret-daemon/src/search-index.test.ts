// File index conformance (SEARCH-02): chunking, persistence round-trip
// with loud rejection, vector-count guard, ranking. Fixture vectors.
import { describe, expect, it } from "vitest";

import { buildFileIndex, indexToJSON, indexFromJSON, rankIndex } from "./search-index.ts";

describe("FileIndex", () => {
  it("chunks files with overlap and round-trips", () => {
    const index = buildFileIndex(
      [
        { path: "a.ts", text: "alpha " + "x".repeat(2000) },
        { path: "b.ts", text: "beta" },
      ],
      900,
      100,
    );
    expect(index.version).toBe(1);
    expect(index.chunks.length).toBeGreaterThan(2);
    expect(index.chunks[0]).toMatchObject({ doc: "a.ts" });
    const back = indexFromJSON(indexToJSON(index));
    expect(back).toEqual(index);
  });

  it("rejects corrupt persisted indexes", () => {
    expect(() => indexFromJSON("{nope")).toThrow(/not JSON/);
    expect(() => indexFromJSON("[1,2]")).toThrow(/not an object/);
    expect(() => indexFromJSON(JSON.stringify({ version: 2, chunks: [] }))).toThrow(/version/);
    expect(() => indexFromJSON(JSON.stringify({ version: 1, chunks: [{ doc: 1 }] }))).toThrow(/chunk shape/);
  });

  it("ranks by max chunk with vector-count guard", () => {
    const index = buildFileIndex([{ path: "a.ts", text: "one two" }], 4, 0);
    // "one two" (7 chars) → ["one ", "two"] (2 chunks).
    expect(index.chunks).toHaveLength(2);
    const ranked = rankIndex(index, [1, 0], [[0, 1], [1, 0]], 5);
    expect(ranked.map((r) => r.id)).toEqual(["a.ts"]);
    expect(() => rankIndex(index, [1, 0], [[0, 1]], 5)).toThrow(/vectors/);
  });
});
