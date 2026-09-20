import { afterEach, describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	fileSha256,
	isShellFresh,
	newestPatchMtime,
	patchSetDigest,
	readPatchSet,
	type PatchSetManifest,
} from "./patch-set-digest.ts";

const temps: string[] = [];

function tempRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "cedia-patch-set-"));
	temps.push(root);
	return root;
}

function sha256(text: string): string {
	return createHash("sha256").update(text).digest("hex");
}

/** A temp root with `patches/desktop/manifest.json` and patch files whose bytes match. */
function fixture(contents: readonly string[]): { root: string; manifest: PatchSetManifest } {
	const root = tempRoot();
	const patchDir = join(root, "patches", "desktop");
	mkdirSync(patchDir, { recursive: true });
	const patches = contents.map((content, index) => {
		const file = `00${String(index + 1).padStart(2, "0")}-fixture.patch`;
		writeFileSync(join(patchDir, file), content);
		return { file, sha256: sha256(content) };
	});
	const manifest: PatchSetManifest = { baseRevision: "base-revision", patches };
	writeFileSync(join(patchDir, "manifest.json"), JSON.stringify(manifest));
	return { root, manifest };
}

afterEach(() => {
	for (const root of temps.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("patchSetDigest", () => {
	it("is deterministic for the same manifest", () => {
		const { manifest } = fixture(["one", "two", "three"]);
		expect(patchSetDigest(manifest)).toBe(patchSetDigest(manifest));
		expect(patchSetDigest(manifest)).toMatch(/^[0-9a-f]{64}$/);
	});

	it("changes when a patch sha256 changes", () => {
		const { manifest } = fixture(["one", "two"]);
		const changed: PatchSetManifest = { ...manifest, patches: manifest.patches.map((patch, index) => (index === 1 ? { ...patch, sha256: sha256("other") } : patch)) };
		expect(patchSetDigest(changed)).not.toBe(patchSetDigest(manifest));
	});

	it("changes when two entries swap order", () => {
		const { manifest } = fixture(["one", "two"]);
		const swapped: PatchSetManifest = { ...manifest, patches: [manifest.patches[1]!, manifest.patches[0]!] };
		expect(patchSetDigest(swapped)).not.toBe(patchSetDigest(manifest));
	});

	it("changes when the base revision changes", () => {
		const { manifest } = fixture(["one"]);
		expect(patchSetDigest({ ...manifest, baseRevision: "another-revision" })).not.toBe(patchSetDigest(manifest));
	});
});

describe("readPatchSet", () => {
	it("returns the manifest and its digest for a fixture whose bytes match", () => {
		const { root, manifest } = fixture(["alpha", "beta"]);
		const read = readPatchSet(root);
		expect(read.manifest).toEqual(manifest);
		expect(read.digest).toBe(patchSetDigest(manifest));
	});

	it("throws when a patch file's bytes were tampered with", () => {
		const { root, manifest } = fixture(["alpha"]);
		writeFileSync(join(root, "patches", "desktop", manifest.patches[0]!.file), "tampered");
		expect(() => readPatchSet(root)).toThrow("does not match its recorded sha256");
	});

	it("throws when a patch file is missing", () => {
		const { root, manifest } = fixture(["alpha"]);
		rmSync(join(root, "patches", "desktop", manifest.patches[0]!.file));
		expect(() => readPatchSet(root)).toThrow("missing");
	});

	it("throws when the manifest is missing", () => {
		expect(() => readPatchSet(tempRoot())).toThrow();
	});
});

describe("fileSha256", () => {
	it("hashes a file and stays undefined for a path that cannot be read", () => {
		const root = tempRoot();
		writeFileSync(join(root, "artifact.js"), "bytes");
		expect(fileSha256(join(root, "artifact.js"))).toBe(sha256("bytes"));
		expect(fileSha256(join(root, "no-such-artifact.js"))).toBeUndefined();
	});
});

describe("newestPatchMtime", () => {
	it("returns a number for a fixture with patch files", () => {
		const { root, manifest } = fixture(["one", "two"]);
		expect(typeof newestPatchMtime(root, manifest)).toBe("number");
	});

	it("returns undefined when no patch can be stat'ed", () => {
		expect(newestPatchMtime(tempRoot(), { baseRevision: "base", patches: [] })).toBeUndefined();
	});
});

describe("isShellFresh", () => {
	it("treats unknown patch time as fresh", () => {
		expect(isShellFresh(undefined, undefined)).toBe(true);
		expect(isShellFresh(123, undefined)).toBe(true);
	});

	it("treats a bundle at or after the newest patch as fresh", () => {
		expect(isShellFresh(100, 100)).toBe(true);
		expect(isShellFresh(101, 100)).toBe(true);
	});

	it("treats a bundle older than the newest patch as stale", () => {
		expect(isShellFresh(99, 100)).toBe(false);
	});

	it("treats a missing bundle as stale when a patch time is known", () => {
		expect(isShellFresh(undefined, 100)).toBe(false);
	});
});
