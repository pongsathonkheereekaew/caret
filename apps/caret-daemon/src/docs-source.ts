import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { assertPublicHttpUrl } from "./fetch-policy.ts";

export const DOCS_TTL_MS = 24 * 60 * 60 * 1000;
export const DOCS_MAX_BYTES = 64 * 1024;

export interface DocsRecord {
  readonly url: string;
  readonly fetchedAt: string;
  readonly bytes: number;
  readonly truncated: boolean;
  readonly text: string;
}

export type DocsFetcher = (url: string) => Promise<{ text: string; truncated: boolean }>;

const keyFor = (url: string): string => createHash("sha256").update(url).digest("hex").slice(0, 32);

const defaultFetch: DocsFetcher = async (url) => {
  assertPublicHttpUrl(url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`docs.fetch: HTTP ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) throw new Error("docs.fetch: no body");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    let truncated = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > DOCS_MAX_BYTES) {
        truncated = true;
        await reader.cancel().catch(() => {});
        break;
      }
      chunks.push(value);
    }
    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    return { text: buf.toString("utf8").slice(0, DOCS_MAX_BYTES), truncated };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("docs.fetch: timed out after 15000ms");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

export class DocsCache {
  constructor(
    readonly dir: string,
    private readonly fetcher: DocsFetcher = defaultFetch,
    private readonly ttlMs = DOCS_TTL_MS,
  ) {
    fs.mkdirSync(dir, { recursive: true });
  }

  list(): Array<Omit<DocsRecord, "text">> {
    if (!fs.existsSync(this.dir)) return [];
    const out: Array<Omit<DocsRecord, "text">> = [];
    for (const name of fs.readdirSync(this.dir)) {
      if (!name.endsWith(".json")) continue;
      try {
        const rec = JSON.parse(fs.readFileSync(path.join(this.dir, name), "utf8")) as DocsRecord;
        out.push({ url: rec.url, fetchedAt: rec.fetchedAt, bytes: rec.bytes, truncated: rec.truncated });
      } catch {
        /* skip corrupt */
      }
    }
    return out.sort((a, b) => a.url.localeCompare(b.url));
  }

  get(url: string): (DocsRecord & { stale: boolean }) | null {
    assertPublicHttpUrl(url);
    const rec = this.read(url);
    if (!rec) return null;
    return { ...rec, stale: this.isStale(rec) };
  }

  async fetch(url: string, force = false): Promise<DocsRecord & { cached: boolean; stale: boolean }> {
    assertPublicHttpUrl(url);
    const existing = this.read(url);
    if (existing && !force && !this.isStale(existing)) {
      return { ...existing, cached: true, stale: false };
    }
    const got = await this.fetcher(url);
    const rec: DocsRecord = {
      url,
      fetchedAt: new Date().toISOString(),
      bytes: Buffer.byteLength(got.text),
      truncated: got.truncated,
      text: got.text,
    };
    fs.writeFileSync(this.fileFor(url), JSON.stringify(rec));
    return { ...rec, cached: false, stale: false };
  }

  refresh(url: string): Promise<DocsRecord & { cached: boolean; stale: boolean }> {
    return this.fetch(url, true);
  }

  private isStale(rec: DocsRecord): boolean {
    const at = Date.parse(rec.fetchedAt);
    if (!Number.isFinite(at)) return true;
    return Date.now() - at > this.ttlMs;
  }

  private fileFor(url: string): string {
    return path.join(this.dir, `${keyFor(url)}.json`);
  }

  private read(url: string): DocsRecord | null {
    try {
      const rec = JSON.parse(fs.readFileSync(this.fileFor(url), "utf8")) as DocsRecord;
      if (rec.url !== url || typeof rec.text !== "string") return null;
      return rec;
    } catch {
      return null;
    }
  }
}
