import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { fromByteArray } from "base64-js";
import {
  CARET_MOBILE_ARTIFACT_MAX_BYTES,
  artifactKind,
  artifactMimeType,
  parseArtifactChunk,
  parseArtifactReceipt,
  readArtifactBytes,
  type ArtifactChunk,
  type ArtifactReceipt,
} from "../core/artifacts.ts";

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function receiptFor(bytes: Uint8Array, name = "demo.txt"): ArtifactReceipt {
  return {
    sha256: sha256(bytes),
    name,
    size: bytes.byteLength,
    sourcePath: "dist/demo.txt",
    sessionId: "s1",
    sourceHashes: [],
    createdAt: "2026-09-13T00:00:00.000Z",
  };
}

describe("mobile artifact integrity", () => {
  test("binds receipts to a task and classifies safe preview types", () => {
    const bytes = new TextEncoder().encode("hello");
    const receipt = receiptFor(bytes, "index.html");
    expect(parseArtifactReceipt(receipt, "s1").sessionId).toBe("s1");
    expect(() => parseArtifactReceipt(receipt, "other")).toThrow("different task");
    // HTML is text in the mobile preview; it is never sent to a WebView.
    expect(artifactKind(receipt)).toBe("text");
    expect(artifactMimeType(receipt)).toBe("text/plain");
    expect(artifactKind({ name: "mix.mp4" })).toBe("video");
  });

  test("reconstructs bounded chunks and verifies the immutable hash", async () => {
    const bytes = new TextEncoder().encode("an artifact streamed in order");
    const receipt = receiptFor(bytes);
    const chunks: ArtifactChunk[] = [];
    const reader = {
      readArtifact: async (_sessionId: string, _sha256: string, offset = 0): Promise<ArtifactChunk> => {
        const end = Math.min(bytes.byteLength, offset + 5);
        const chunk = { receipt, offset, data: fromByteArray(bytes.slice(offset, end)), complete: end === bytes.byteLength };
        chunks.push(chunk);
        return parseArtifactChunk(chunk, receipt.sessionId, receipt.sha256, offset);
      },
    };
    const result = await readArtifactBytes(reader, receipt);
    expect(new TextDecoder().decode(result)).toBe("an artifact streamed in order");
    expect(chunks.map(chunk => chunk.offset)).toEqual([0, 5, 10, 15, 20, 25]);
  });

  test("rejects tampered, truncated, and out-of-scope chunks", async () => {
    const bytes = new TextEncoder().encode("verified");
    const receipt = receiptFor(bytes);
    const tampered = { receipt, offset: 0, data: fromByteArray(new TextEncoder().encode("tampered")), complete: true };
    await expect(readArtifactBytes({ readArtifact: async () => tampered }, receipt)).rejects.toThrow("integrity verification");
    const truncated = { receipt, offset: 0, data: fromByteArray(bytes.slice(0, 3)), complete: true };
    await expect(readArtifactBytes({ readArtifact: async () => truncated }, receipt)).rejects.toThrow("completion flag");
    const otherTask = { ...receipt, sessionId: "s2" };
    const chunk = { receipt: otherTask, offset: 0, data: fromByteArray(bytes), complete: true };
    expect(() => parseArtifactChunk(chunk, "s1", receipt.sha256, 0)).toThrow("different task");
  });

  test("refuses to materialize a receipt above the explicit mobile cap", async () => {
    const receipt: ArtifactReceipt = { ...receiptFor(new Uint8Array(0), "large.bin"), size: CARET_MOBILE_ARTIFACT_MAX_BYTES + 1, sha256: "a".repeat(64) };
    await expect(readArtifactBytes({ readArtifact: async () => { throw new Error("must not fetch"); } }, receipt)).rejects.toThrow("mobile preview limit");
  });

  test("rejects a receipt that changes size during transfer", async () => {
    const receipt = receiptFor(new TextEncoder().encode("verified"));
    await expect(readArtifactBytes({ readArtifact: async () => ({
      receipt: { ...receipt, size: 0 }, offset: 0, data: "", complete: true,
    }) }, receipt)).rejects.toThrow("receipt changed");
  });
});
