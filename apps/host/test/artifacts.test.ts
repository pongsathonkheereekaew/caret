import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ArtifactStore } from "../src/artifacts.ts";

test("artifact bytes remain immutable across workspace edits and bounded resume reconstructs the hash", () => {
  const dir = mkdtempSync(join(tmpdir(), "cedia-artifacts-"));
  try {
    const bytes = Buffer.alloc(150_000, 37);
    writeFileSync(join(dir, "plugin.bin"), bytes); writeFileSync(join(dir, "source.txt"), "source one");
    const store = new ArtifactStore(dir);
    const receipt = store.capture("task1", dir, "plugin.bin", ["source.txt"]);
    writeFileSync(join(dir, "plugin.bin"), "new output");
    const first = store.read("task1", receipt.sha256);
    const second = store.read("task1", receipt.sha256, 96 * 1024);
    expect(first.complete).toBe(false); expect(second.complete).toBe(true);
    expect(Buffer.concat([Buffer.from(first.data, "base64"), Buffer.from(second.data, "base64")])).toEqual(bytes);
    expect(receipt.sourceHashes).toHaveLength(1);
    expect(() => store.read("task2", receipt.sha256)).toThrow();
    expect(() => store.read("../task1", receipt.sha256)).toThrow();
    expect(() => store.read("task1", receipt.sha256, 0, 100_000)).toThrow();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
