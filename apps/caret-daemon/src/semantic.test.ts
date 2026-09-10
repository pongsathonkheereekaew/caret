// Semantic rank conformance (SEARCH-02): chunk boundaries, cosine
// geometry, max-pool ranking, k caps. Pure sync, fixture vectors.
import { describe, expect, it } from "vitest";

import { chunkText, cosine, rankChunks } from "./semantic.ts";

describe("SemanticRank", () => {
  it("chunks with overlap and guards bad shapes", () => {
    expect(chunkText("", 100)).toEqual([]);
    expect(chunkText("abcdef", 4, 0)).toEqual(["abcd", "ef"]);
    expect(chunkText("abcdefgh", 4, 2)).toEqual(["abcd", "cdef", "efgh"]);
    expect(() => chunkText("x", 0)).toThrow(/chunk size/);
    expect(() => chunkText("x", 4, 4)).toThrow(/overlap/);
  });

  it("scores cosine geometry", () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1, 9);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0, 9);
    expect(cosine([1, 1], [-1, -1])).toBeCloseTo(-1, 9);
    expect(cosine([0, 0], [1, 2])).toBe(0);
    expect(() => cosine([1], [1, 2])).toThrow(/mismatch/);
    expect(() => cosine([], [])).toThrow(/mismatch/);
  });

  it("ranks files by best chunk with k cap", () => {
    const chunks = [
      { doc: "a.ts", vec: [0.1, 0.9] },
      { doc: "a.ts", vec: [0.9, 0.1] },
      { doc: "b.ts", vec: [0.5, 0.5] },
    ];
    const top = rankChunks([1, 0], chunks, 2);
    expect(top.map((r) => r.id)).toEqual(["a.ts", "b.ts"]);
    expect(top[0]?.score ?? 0).toBeGreaterThan(top[1]?.score ?? 0);
    expect(rankChunks([1, 0], chunks, 1)).toHaveLength(1);
    expect(rankChunks([1, 0], chunks, 0)).toEqual([]);
    expect(rankChunks([1, 0], [], 5)).toEqual([]);
  });
});
