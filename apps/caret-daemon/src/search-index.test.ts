// File index conformance (SEARCH-02): chunking, persistence round-trip
// with loud rejection, vector-count guard, ranking. Fixture vectors.
import { describe, expect, it } from "vitest";

import {
  attributeSymbols,
  buildFileIndex,
  indexToJSON,
  indexFromJSON,
  rankIndex,
  updateFileIndex,
} from "./search-index.ts";

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
    expect(() =>
      indexFromJSON(JSON.stringify({ version: 1, chunks: [{ doc: "a", text: "b", symbol: 7 }] })),
    ).toThrow(/symbol shape/);
  });

  it("ranks by max chunk with vector-count guard", () => {
    const index = buildFileIndex([{ path: "a.ts", text: "one two" }], 4, 0);
    // "one two" (7 chars) → ["one ", "two"] (2 chunks).
    expect(index.chunks).toHaveLength(2);
    const ranked = rankIndex(index, [1, 0], [[0, 1], [1, 0]], 5);
    expect(ranked.map((r) => r.id)).toEqual(["a.ts"]);
    expect(() => rankIndex(index, [1, 0], [[0, 1]], 5)).toThrow(/vectors/);
  });

  it("attributes chunks to enclosing symbols", () => {
    const text = [
      "import { x } from './y';",
      "",
      "export function alpha() {",
      "  return 1;",
      "}",
      "",
      "export const beta = () => 2;",
      "",
      "const tail = 'end';",
    ].join("\n");
    const chunks = attributeSymbols("s.ts", text, 30, 0);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.symbol).toBeUndefined();
    expect(chunks.some((c) => c.symbol === "alpha")).toBe(true);
    expect(chunks.some((c) => c.symbol === "beta")).toBe(true);
    // Symbols survive the persistence round-trip.
    const back = indexFromJSON(indexToJSON({ version: 1, chunkSize: 30, overlap: 0, chunks }));
    expect(back.chunks.some((c) => c.symbol === "alpha")).toBe(true);
  });

  it("updates changed files incrementally and drops deleted ones", () => {
    const before = buildFileIndex(
      [
        { path: "a.ts", text: "aaa " + "x".repeat(2000) },
        { path: "b.ts", text: "beta" },
      ],
      900,
      100,
    );
    const after = updateFileIndex(before, [
      { path: "a.ts", text: "brand new content" },
      { path: "b.ts", text: null },
      { path: "c.ts", text: "added" },
    ]);
    expect(after.chunks.some((c) => c.doc === "b.ts")).toBe(false);
    expect(after.chunks.filter((c) => c.doc === "a.ts")).toHaveLength(1);
    expect(after.chunks.find((c) => c.doc === "a.ts")?.text).toBe("brand new content");
    expect(after.chunks.some((c) => c.doc === "c.ts")).toBe(true);
    // The input index is untouched (immutable update).
    expect(before.chunks.some((c) => c.doc === "b.ts")).toBe(true);
  });

  it("rejects incremental updates with a mismatched shape", () => {
    const index = buildFileIndex([{ path: "a.ts", text: "x" }], 900, 100);
    expect(() => updateFileIndex(index, [{ path: "a.ts", text: "y" }], 500, 100)).toThrow(/shape mismatch/);
  });
});
