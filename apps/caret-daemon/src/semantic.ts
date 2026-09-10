// Caret semantic rank (SEARCH-02 product seed): chunking + cosine top-k
// over caller-supplied vectors. Embedding itself stays behind the
// embed-server seam (local nomic Q4 measured: recall@3 = 1.0 file-level)
// — this module is the deterministic half, keeper-pinned without a model.
export interface RankedDoc {
  readonly id: string;
  readonly score: number;
}

/** Split text into windows; overlap keeps boundary context. */
export const chunkText = (text: string, size: number, overlap = 0): string[] => {
  if (size <= 0) throw new Error(`bad chunk size ${size}`);
  if (overlap < 0 || overlap >= size) throw new Error(`bad overlap ${overlap}`);
  if (text.length === 0) return [];
  const chunks: string[] = [];
  for (let at = 0; at < text.length; at += size - overlap) {
    chunks.push(text.slice(at, at + size));
    if (at + size >= text.length) break;
  }
  return chunks;
};

export const cosine = (a: ReadonlyArray<number>, b: ReadonlyArray<number>): number => {
  if (a.length !== b.length || a.length === 0) {
    throw new Error(`cosine dimension mismatch ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

/** Top-k document ids by max chunk score (file score = best chunk). */
export const rankChunks = (
  query: ReadonlyArray<number>,
  chunks: ReadonlyArray<{ doc: string; vec: ReadonlyArray<number> }>,
  k: number,
): RankedDoc[] => {
  const best = new Map<string, number>();
  for (const chunk of chunks) {
    const score = cosine(query, chunk.vec);
    if (score > (best.get(chunk.doc) ?? Number.NEGATIVE_INFINITY)) {
      best.set(chunk.doc, score);
    }
  }
  return [...best]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, k));
};
