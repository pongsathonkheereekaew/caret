import { createHash } from "node:crypto";

interface Entry { text: string; bytes: number; accessedAt: number; deviceId: string }
/** Bounded transport cache only. Authoritative commands/events remain in the durable store. */
export class ResponseChunks {
  readonly #entries = new Map<string, Entry>();
  #bytes = 0;
  wrap(deviceId: string, body: unknown): unknown {
    const text = JSON.stringify(body); const bytes = Buffer.byteLength(text);
    if (bytes <= 128_000) return body;
    if (bytes > 64 * 1024 * 1024) throw new Error("Response exceeds 64 MiB; request a smaller page");
    const sha256 = createHash("sha256").update(text).digest("hex"); const key = `${deviceId}:${sha256}`;
    this.#sweep();
    if (!this.#entries.has(key)) {
      while (this.#bytes + bytes > 128 * 1024 * 1024 && this.#entries.size) this.#remove(this.#entries.keys().next().value!);
      this.#entries.set(key, { text, bytes, accessedAt: Date.now(), deviceId }); this.#bytes += bytes;
    }
    return { cediaResponseReference: { sha256, length: text.length } };
  }
  read(deviceId: string, sha256: string, offset: number) {
    if (!/^[a-f0-9]{64}$/.test(sha256) || !Number.isSafeInteger(offset) || offset < 0) throw new Error("Invalid response range");
    this.#sweep(); const entry = this.#entries.get(`${deviceId}:${sha256}`);
    if (!entry) throw new Error("Response reference expired; retrieve the original result again");
    if (offset >= entry.text.length) throw new Error("Response range is outside the body");
    entry.accessedAt = Date.now();
    return { sha256, offset, length: entry.text.length, text: entry.text.slice(offset, offset + 24_000) };
  }
  #remove(key: string) { const entry = this.#entries.get(key); if (entry) this.#bytes -= entry.bytes; this.#entries.delete(key); }
  #sweep() { for (const [key, entry] of this.#entries) if (Date.now() - entry.accessedAt > 10 * 60_000) this.#remove(key); }
}
