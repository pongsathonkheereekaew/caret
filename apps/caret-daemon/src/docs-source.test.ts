import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assertPublicHttpUrl } from "./fetch-policy.ts";
import { DocsCache } from "./docs-source.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("DocsCache", () => {
  it("refuses private and credentialed URLs before fetch", () => {
    expect(() => assertPublicHttpUrl("ftp://x/y")).toThrow(/http\(s\) only/);
    expect(() => assertPublicHttpUrl("http://localhost/x")).toThrow(/refused/);
    expect(() => assertPublicHttpUrl("https://user:pw@example.com/")).toThrow(/credentials/);
  });

  it("caches until TTL, then refresh bypasses the cache", async () => {
    const dir = mkdtempSync(join(tmpdir(), "caret-docs-"));
    dirs.push(dir);
    let calls = 0;
    const cache = new DocsCache(
      dir,
      async (url) => {
        calls += 1;
        return { text: `body-${calls}-${url}`, truncated: false };
      },
      60_000,
    );
    const url = "https://example.com/guide.md";
    const first = await cache.fetch(url);
    expect(first.cached).toBe(false);
    expect(first.text).toContain("body-1-");
    const hit = await cache.fetch(url);
    expect(hit.cached).toBe(true);
    expect(calls).toBe(1);
    const refreshed = await cache.refresh(url);
    expect(refreshed.cached).toBe(false);
    expect(calls).toBe(2);
    expect(cache.list()).toEqual([
      expect.objectContaining({ url, truncated: false }),
    ]);
    expect(cache.get(url)?.stale).toBe(false);
  });

  it("marks records stale after TTL and refetches on next fetch", async () => {
    const dir = mkdtempSync(join(tmpdir(), "caret-docs-"));
    dirs.push(dir);
    let calls = 0;
    const cache = new DocsCache(dir, async () => {
      calls += 1;
      return { text: `n${calls}`, truncated: true };
    }, 1);
    const url = "https://docs.example.com/a";
    await cache.fetch(url);
    await new Promise((r) => setTimeout(r, 5));
    expect(cache.get(url)?.stale).toBe(true);
    const next = await cache.fetch(url);
    expect(next.cached).toBe(false);
    expect(next.truncated).toBe(true);
    expect(calls).toBe(2);
  });
});
