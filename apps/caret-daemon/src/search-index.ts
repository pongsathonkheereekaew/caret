// Caret file index (SEARCH-02 product): text chunk store with versioned
// persistence + max-pool ranking over caller-supplied vectors. Embeddings
// arrive through the embed-server seam (local nomic Q4 measured); this
// module owns chunking, storage shape, and ranking — keeper-pinned
// without a model.
import { chunkText, rankChunks } from "./semantic.ts";

export interface IndexedChunk {
  readonly doc: string;
  readonly text: string;
}

export interface FileIndex {
  readonly version: 1;
  readonly chunkSize: number;
  readonly overlap: number;
  readonly chunks: ReadonlyArray<IndexedChunk>;
}

export const buildFileIndex = (
  files: ReadonlyArray<{ path: string; text: string }>,
  chunkSize = 900,
  overlap = 100,
): FileIndex => {
  const chunks: IndexedChunk[] = [];
  for (const file of files) {
    for (const text of chunkText(file.text, chunkSize, overlap)) {
      chunks.push({ doc: file.path, text });
    }
  }
  return { version: 1, chunkSize, overlap, chunks };
};

export const indexToJSON = (index: FileIndex): string => JSON.stringify(index);

export const indexFromJSON = (raw: string): FileIndex => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("index: not JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("index: not an object");
  }
  const index = parsed as { version?: unknown; chunks?: unknown };
  if (index.version !== 1) throw new Error("index: version !== 1");
  if (!Array.isArray(index.chunks)) throw new Error("index: chunks missing");
  for (const chunk of index.chunks) {
    const entry = chunk as { doc?: unknown; text?: unknown };
    if (typeof entry.doc !== "string" || typeof entry.text !== "string") {
      throw new Error("index: bad chunk shape");
    }
  }
  return parsed as FileIndex;
};

/** Rank docs by max chunk cosine. chunkVecs aligns 1:1 with index.chunks. */
export const rankIndex = (
  index: FileIndex,
  queryVec: ReadonlyArray<number>,
  chunkVecs: ReadonlyArray<ReadonlyArray<number>>,
  k: number,
) => {
  if (chunkVecs.length !== index.chunks.length) {
    throw new Error(`index: ${chunkVecs.length} vectors for ${index.chunks.length} chunks`);
  }
  return rankChunks(
    queryVec,
    index.chunks.map((chunk, i) => ({ doc: chunk.doc, vec: chunkVecs[i] as ReadonlyArray<number> })),
    k,
  );
};
