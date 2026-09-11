// Caret file index (SEARCH-02 product): text chunk store with versioned
// persistence + max-pool ranking over caller-supplied vectors. Embeddings
// arrive through the embed-server seam (local nomic Q4 measured); this
// module owns chunking, storage shape, and ranking — keeper-pinned
// without a model.
import { MAX_EMBED_CHARS, PREFIX_DOC, PREFIX_QUERY } from "./embed-client.ts";
import { chunkText, rankChunks, type RankedDoc } from "./semantic.ts";

export interface IndexedChunk {
  readonly doc: string;
  readonly text: string;
  /** Enclosing symbol at chunk start (best effort, may be absent). */
  readonly symbol?: string;
}

export interface FileIndex {
  readonly version: 1;
  readonly chunkSize: number;
  readonly overlap: number;
  readonly chunks: ReadonlyArray<IndexedChunk>;
}

export interface FileChange {
  readonly path: string;
  /** New text, or null to delete the file from the index. */
  readonly text: string | null;
}

// Coarse symbol scan: TS/JS definitions, Python def/class, Markdown
// headings. Deliberately shallow — it attributes chunks, it does not
// parse. Anything unmatched attributes to no symbol (undefined).
const SYMBOL_PATTERNS: ReadonlyArray<RegExp> = [
  /^\s*(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|enum|const|let|var)\s+([A-Za-z_$][\w$]*)/,
  /^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=[^=]*=>/,
  /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)/,
  /^\s*class\s+([A-Za-z_]\w*)/,
  /^\s*#{1,6}\s+(.+?)\s*$/,
];

const symbolAtLine = (lines: ReadonlyArray<string>, line: number): string | undefined => {
  for (let at = line; at >= 0; at--) {
    const text = lines[at] ?? "";
    for (const pattern of SYMBOL_PATTERNS) {
      const match = pattern.exec(text);
      if (match?.[1]) return match[1].trim();
    }
  }
  return undefined;
};

/** Attribute each chunk to its enclosing symbol (by chunk-start line). */
export const attributeSymbols = (
  path: string,
  text: string,
  chunkSize: number,
  overlap: number,
): IndexedChunk[] => {
  const lines = text.split("\n");
  // Offset of each line start in the raw text.
  const starts: number[] = [];
  let at = 0;
  for (const line of lines) {
    starts.push(at);
    at += line.length + 1;
  }
  const lineOf = (offset: number): number => {
    let line = 0;
    for (let i = 0; i < starts.length; i++) {
      if ((starts[i] ?? 0) <= offset) line = i;
      else break;
    }
    return line;
  };
  const chunks: IndexedChunk[] = [];
  let offset = 0;
  for (const chunk of chunkText(text, chunkSize, overlap)) {
    const symbol = symbolAtLine(lines, lineOf(offset));
    chunks.push(symbol === undefined ? { doc: path, text: chunk } : { doc: path, text: chunk, symbol });
    offset += chunk.length - overlap;
    if (offset < 0) offset = 0;
  }
  return chunks;
};

export const buildFileIndex = (
  files: ReadonlyArray<{ path: string; text: string }>,
  chunkSize = 900,
  overlap = 100,
): FileIndex => {
  const chunks: IndexedChunk[] = [];
  for (const file of files) {
    chunks.push(...attributeSymbols(file.path, file.text, chunkSize, overlap));
  }
  return { version: 1, chunkSize, overlap, chunks };
};

/** Incremental update: re-chunk changed files in place, drop deleted ones. */
export const updateFileIndex = (
  index: FileIndex,
  changes: ReadonlyArray<FileChange>,
  chunkSize = index.chunkSize,
  overlap = index.overlap,
): FileIndex => {
  if (chunkSize !== index.chunkSize || overlap !== index.overlap) {
    throw new Error(
      `index: shape mismatch (have ${index.chunkSize}/${index.overlap}, want ${chunkSize}/${overlap})`,
    );
  }
  const changed = new Map(changes.map((c) => [c.path, c.text]));
  const chunks: IndexedChunk[] = [];
  for (const chunk of index.chunks) {
    if (!changed.has(chunk.doc)) chunks.push(chunk);
  }
  for (const change of changes) {
    if (change.text !== null) {
      chunks.push(...attributeSymbols(change.path, change.text, chunkSize, overlap));
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
    const entry = chunk as { doc?: unknown; text?: unknown; symbol?: unknown };
    if (typeof entry.doc !== "string" || typeof entry.text !== "string") {
      throw new Error("index: bad chunk shape");
    }
    if (entry.symbol !== undefined && typeof entry.symbol !== "string") {
      throw new Error("index: bad symbol shape");
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

/** Keep prefixed payload under the measured llama.cpp ~1000-char reject. */
export const clipForEmbed = (text: string, kind: "document" | "query"): string => {
  const prefix = kind === "query" ? PREFIX_QUERY : PREFIX_DOC;
  const budget = MAX_EMBED_CHARS - prefix.length - 1;
  return text.slice(0, Math.max(0, budget));
};

export interface Embedder {
  embed(text: string, kind: "document" | "query"): Promise<number[]>;
}

/** Embed every chunk + the query, then rank. Caller owns the HTTP client. */
export const embedAndRank = async (
  embed: Embedder,
  index: FileIndex,
  query: string,
  k: number,
): Promise<RankedDoc[]> => {
  const chunkVecs = await Promise.all(
    index.chunks.map((chunk) => embed.embed(clipForEmbed(chunk.text, "document"), "document")),
  );
  const queryVec = await embed.embed(clipForEmbed(query, "query"), "query");
  return rankIndex(index, queryVec, chunkVecs, k);
};
