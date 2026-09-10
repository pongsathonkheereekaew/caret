// Caret chat search index (Phase A search/history): full-text search over
// recorded journal events — prompts, decisions, files, errors. Pure, sync,
// no I/O: the caller reads the JSONL. Scoring is transparent (title and
// prompt hits outrank detail hits; ties break newest-first) so results are
// explainable without a model.
export interface SearchEntry {
  readonly t: string;
  readonly type: string;
  readonly text: string;
}

export interface SearchHit {
  readonly t: string;
  readonly type: string;
  readonly score: number;
  readonly snippet: string;
}

export interface SearchFilter {
  readonly query: string;
  readonly types?: ReadonlyArray<string>;
  readonly since?: string;
  readonly until?: string;
  readonly limit?: number;
}

type JournalEvent = {
  t?: unknown;
  type?: unknown;
  payload?: unknown;
  goal?: unknown;
  workDir?: unknown;
  [key: string]: unknown;
};

const text = (value: unknown): string => (typeof value === "string" ? value : "");

/** Flatten one event to searchable text (prompt/goal/decision/detail). */
export const indexableText = (event: JournalEvent): string => {
  const parts: string[] = [];
  if (event.type === "request.resolved") {
    const payload = (event.payload ?? {}) as { requestType?: unknown; decision?: unknown; detail?: unknown };
    parts.push(text(payload.requestType), text(payload.decision), text(payload.detail));
  } else if (typeof event.type === "string" && event.type.startsWith("caret.run.")) {
    parts.push(text(event.goal), text(event.workDir));
  } else {
    const payload = event.payload;
    const flat = typeof payload === "string" ? payload : payload === undefined ? "" : JSON.stringify(payload);
    if (flat.length > 0) parts.push(flat);
  }
  if (typeof event.goal === "string") parts.push(event.goal);
  return parts.filter((part) => part.length > 0).join("\n");
};

const snippet = (haystack: string, needle: string): string => {
  const at = haystack.toLowerCase().indexOf(needle.toLowerCase());
  if (at < 0) return haystack.slice(0, 80);
  const from = Math.max(0, at - 40);
  const to = Math.min(haystack.length, at + needle.length + 40);
  return `${from > 0 ? "…" : ""}${haystack.slice(from, to)}${to < haystack.length ? "…" : ""}`;
};

export const searchChats = (events: ReadonlyArray<JournalEvent>, filter: SearchFilter): SearchHit[] => {
  const query = filter.query.trim().toLowerCase();
  if (!query) return [];
  const limit = filter.limit ?? 20;
  const hits: SearchHit[] = [];
  for (const event of events) {
    const type = text(event.type) || "unknown";
    if (filter.types && !filter.types.includes(type)) continue;
    const t = text(event.t);
    if (filter.since && t < filter.since) continue;
    if (filter.until && t > filter.until) continue;
    const flat = indexableText(event);
    const lower = flat.toLowerCase();
    if (!lower.includes(query)) continue;
    // Title-ish fields (goal, requestType) outrank detail text.
    const head = flat.slice(0, 120).toLowerCase().includes(query) ? 2 : 1;
    const count = lower.split(query).length - 1;
    hits.push({ t, type, score: head * 10 + Math.min(count, 5), snippet: snippet(flat, query) });
  }
  return hits
    .sort((a, b) => (b.score - a.score !== 0 ? b.score - a.score : b.t < a.t ? -1 : 1))
    .slice(0, Math.max(0, limit));
};
