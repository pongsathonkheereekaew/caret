// Caret embed-server client (SEARCH-02 wiring): talks to a local llama.cpp
// /embedding endpoint. Chunking and ranking stay in search-index.ts; this
// module owns the HTTP seam, nomic task prefixes, and the 900-char cap
// measured in SEARCH-embed-evidence.md. No code leaves the machine.
export const PREFIX_DOC = "search_document:";
export const PREFIX_QUERY = "search_query:";
export const MAX_EMBED_CHARS = 900;

export class EmbedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbedError";
  }
}

export class EmbedClient {
  constructor(
    private readonly endpoint: string,
    private readonly timeoutMs = 5000,
  ) {}

  async embed(text: string, kind: "document" | "query"): Promise<number[]> {
    const prefixed = `${kind === "query" ? PREFIX_QUERY : PREFIX_DOC} ${text}`;
    if (prefixed.length > MAX_EMBED_CHARS) {
      throw new EmbedError(`chunk too large (${prefixed.length} > ${MAX_EMBED_CHARS}) — caller must split`);
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${this.endpoint.replace(/\/$/, "")}/embedding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: prefixed }),
        signal: ctrl.signal,
      });
    } catch {
      throw new EmbedError(`embed timed out after ${this.timeoutMs}ms`);
    } finally {
      clearTimeout(timer);
    }
    if (res.status < 200 || res.status >= 300) {
      throw new EmbedError(`embed HTTP ${res.status}`);
    }
    const body = (await res.json()) as { embedding?: unknown };
    const raw = body.embedding;
    const vec = Array.isArray(raw) && Array.isArray(raw[0]) ? raw[0] : raw;
    if (!Array.isArray(vec) || vec.length === 0 || vec.some((n) => typeof n !== "number")) {
      throw new EmbedError("embed returned no numeric vector");
    }
    return vec as number[];
  }
}
