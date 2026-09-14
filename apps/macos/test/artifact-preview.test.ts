import { describe, expect, it } from "bun:test";
import {
	INLINE_PREVIEW_MAX_BYTES,
	NO_AUTOPLAY_REASON,
	UNKNOWN_MIME_REASON,
	canInlinePreviewBytes,
	classifyArtifactPreview,
	inlinePreviewMime,
	mapArtifactsForWebview,
	retainLastGoodPreview,
	type ArtifactPreview,
} from "../src/artifact-preview.ts";

const HASH_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function expectNoExecute(preview: ArtifactPreview): void {
	expect(preview.kind).not.toBe("execute" as ArtifactPreview["kind"]);
	expect(preview.viewer).not.toBe("execute" as ArtifactPreview["viewer"]);
	expect(JSON.stringify(preview).toLowerCase()).not.toContain('"execute"');
}

describe("classifyArtifactPreview", () => {
	it("classifies image, audio, video, pdf, and text from MIME first", () => {
		expect(classifyArtifactPreview({ mime: "image/png", name: "shot.png" })).toMatchObject({
			kind: "image",
			viewer: "inline",
		});
		expect(classifyArtifactPreview({ mime: "image/jpeg", name: "photo.jpg" })).toMatchObject({
			kind: "image",
			viewer: "inline",
		});
		expect(classifyArtifactPreview({ mime: "image/svg+xml", name: "unsafe.svg" })).toMatchObject({
			kind: "image",
			viewer: "inline",
		});

		const wav = classifyArtifactPreview({ mime: "audio/wav", name: "tone.wav" });
		expect(wav).toMatchObject({ kind: "audio", viewer: "inline", reason: NO_AUTOPLAY_REASON });
		const mp3 = classifyArtifactPreview({ mime: "audio/mpeg", name: "clip.mp3" });
		expect(mp3).toMatchObject({ kind: "audio", viewer: "inline", reason: NO_AUTOPLAY_REASON });

		const mp4 = classifyArtifactPreview({ mime: "video/mp4", name: "walk.mp4" });
		expect(mp4).toMatchObject({ kind: "video", viewer: "inline", reason: NO_AUTOPLAY_REASON });

		expect(classifyArtifactPreview({ mime: "application/pdf", name: "spec.pdf" })).toMatchObject({
			kind: "pdf",
			viewer: "inline",
		});
		expect(classifyArtifactPreview({ mime: "text/markdown", name: "notes.md" })).toMatchObject({
			kind: "text",
			viewer: "inline",
		});
		expect(classifyArtifactPreview({ mime: "application/json", name: "receipt.json" })).toMatchObject({
			kind: "text",
			viewer: "inline",
		});
		expect(classifyArtifactPreview({ mime: "application/ld+json", name: "graph.json" })).toMatchObject({
			kind: "text",
			viewer: "inline",
		});
	});

	it("falls back to extension when MIME is missing or unknown", () => {
		expect(classifyArtifactPreview({ name: "shot.PNG" })).toMatchObject({ kind: "image", viewer: "inline" });
		expect(classifyArtifactPreview({ name: "dir/tone.wav" })).toMatchObject({ kind: "audio", viewer: "inline" });
		expect(classifyArtifactPreview({ name: "walk.mp4" })).toMatchObject({ kind: "video", viewer: "inline" });
		expect(classifyArtifactPreview({ name: "spec.pdf" })).toMatchObject({ kind: "pdf", viewer: "inline" });
		expect(classifyArtifactPreview({ mime: "unknown", name: "notes.md" })).toMatchObject({
			kind: "text",
			viewer: "inline",
		});
		expect(classifyArtifactPreview({ mime: "  ", name: "receipt.json" })).toMatchObject({
			kind: "text",
			viewer: "inline",
		});
	});

	it("does not let a previewable extension override a non-preview MIME", () => {
		const guessed = classifyArtifactPreview({
			mime: "application/octet-stream",
			name: "shot.png",
		});
		expect(guessed).toMatchObject({
			kind: "binary",
			viewer: "download",
			reason: UNKNOWN_MIME_REASON,
		});
		expectNoExecute(guessed);
	});

	it("treats failed and unknown MIME as download only and never invents execute", () => {
		const empty = classifyArtifactPreview({});
		expect(empty).toMatchObject({
			kind: "unknown",
			viewer: "download",
			reason: UNKNOWN_MIME_REASON,
		});
		expectNoExecute(empty);

		const unknown = classifyArtifactPreview({ mime: "unknown", name: "payload" });
		expect(unknown.kind).toBe("unknown");
		expect(unknown.viewer).toBe("download");
		expect(unknown.reason).toBe(UNKNOWN_MIME_REASON);
		expectNoExecute(unknown);

		const exe = classifyArtifactPreview({
			mime: "application/x-executable",
			name: "tool.exe",
		});
		expect(exe).toMatchObject({
			kind: "binary",
			viewer: "download",
			reason: UNKNOWN_MIME_REASON,
		});
		expectNoExecute(exe);

		const zero = classifyArtifactPreview({ mime: "unknown", name: "empty.bin", size: 0 });
		expect(zero.kind).toBe("binary");
		expect(zero.viewer).toBe("download");
		expect(zero.reason).toBe(UNKNOWN_MIME_REASON);
		expect(zero.header).toContain("0 bytes");
		expectNoExecute(zero);
	});

	it("builds a header from name, MIME, size, 12-char hash prefix, and buildId", () => {
		const preview = classifyArtifactPreview({
			mime: "image/png",
			name: "shot.png",
			size: 2048,
			sha256: HASH_A,
			buildId: "A",
		});
		expect(preview.header).toBe(`shot.png · image/png · 2048 bytes · ${HASH_A.slice(0, 12)} · A`);
		expect(HASH_A.slice(0, 12)).toHaveLength(12);

		const sparse = classifyArtifactPreview({ name: "only-name" });
		expect(sparse.header).toBe("only-name");
	});
});

describe("retainLastGoodPreview", () => {
	it("keeps a good inline preview when the incoming build is failed or unknown", () => {
		const lastGood = classifyArtifactPreview({
			mime: "image/png",
			name: "build.png",
			sha256: HASH_A,
			size: 128,
			buildId: "A",
		});
		const failed = classifyArtifactPreview({
			mime: "unknown",
			name: "broken",
			sha256: HASH_B,
			buildId: "B",
		});
		expect(failed.kind).toBe("unknown");
		expect(failed.reason).toBe(UNKNOWN_MIME_REASON);

		const retained = retainLastGoodPreview(lastGood, failed);
		expect(retained).toBe(lastGood);
		expect(retained).not.toBe(failed);
		expect(retained.kind).toBe("image");
		expect(retained.viewer).toBe("inline");
		expect(retained.header).toContain(HASH_A.slice(0, 12));
		expect(retained.header).toContain("A");
		expectNoExecute(failed);
	});

	it("replaces last-good when the incoming preview is a good inline build", () => {
		const buildA = classifyArtifactPreview({
			mime: "image/png",
			name: "a.png",
			sha256: HASH_A,
			buildId: "A",
		});
		const buildB = classifyArtifactPreview({
			mime: "image/jpeg",
			name: "b.jpg",
			sha256: HASH_B,
			buildId: "B",
		});
		expect(retainLastGoodPreview(buildA, buildB)).toBe(buildB);
		expect(retainLastGoodPreview(undefined, buildB)).toBe(buildB);
		expect(retainLastGoodPreview(undefined, classifyArtifactPreview({}))).toMatchObject({
			kind: "unknown",
			viewer: "download",
		});
	});

	it("maps failed builds to last-good without executing", () => {
		const good = {
			name: "shot.png",
			sha256: HASH_A,
			size: 32,
			mime: "image/png",
			buildId: "A",
		};
		const first = mapArtifactsForWebview([good], {});
		expect(first.artifacts[0]?.retainedLastGood).toBe(false);
		expect(first.lastGoodByName["shot.png"]?.kind).toBe("image");
		const failed = mapArtifactsForWebview([{ name: "shot.png", sha256: HASH_B, size: 8, mime: "application/octet-stream", buildId: "B" }], first.lastGoodByName);
		expect(failed.artifacts[0]?.retainedLastGood).toBe(true);
		expect(failed.artifacts[0]?.preview.kind).toBe("image");
		expect(failed.artifacts[0]?.incomingPreview.kind).toBe("binary");
		expectNoExecute(failed.artifacts[0]!.incomingPreview);
	});

	it("inlines only small raster images and text, never SVG or unknown MIME", () => {
		expect(canInlinePreviewBytes("image", 32, { mime: "image/png", name: "shot.png" })).toBe(true);
		expect(inlinePreviewMime("image", { mime: "image/jpeg", name: "shot.jpg" })).toBe("image/jpeg");
		expect(inlinePreviewMime("image", { name: "shot.webp" })).toBe("image/webp");
		expect(canInlinePreviewBytes("text", 80, { mime: "text/plain", name: "notes.txt" })).toBe(true);
		expect(canInlinePreviewBytes("image", INLINE_PREVIEW_MAX_BYTES + 1, { mime: "image/png", name: "shot.png" })).toBe(false);
		expect(canInlinePreviewBytes("image", 32, { mime: "image/svg+xml", name: "icon.svg" })).toBe(false);
		expect(canInlinePreviewBytes("image", 32, { name: "icon.svg" })).toBe(false);
		expect(canInlinePreviewBytes("binary", 32, { mime: "application/octet-stream", name: "blob.bin" })).toBe(false);
		expect(inlinePreviewMime("unknown", { mime: "application/octet-stream" })).toBeUndefined();
	});
});
