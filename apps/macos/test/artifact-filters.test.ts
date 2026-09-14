import { describe, expect, it } from "bun:test";
import { filterArtifacts, normalizeArtifactTypeFilter } from "../src/artifact-filters.ts";

describe("filterArtifacts", () => {
	const items = [
		{ name: "shot.png", sha256: "aaa", mime: "image/png", buildId: "A", preview: { kind: "image", header: "shot.png · A" } },
		{ name: "notes.txt", sha256: "bbb", mime: "text/plain", buildId: "B", preview: { kind: "text", header: "notes.txt · B" } },
		{ name: "blob.bin", sha256: "ccc", mime: "application/octet-stream", preview: { kind: "binary", header: "blob.bin" } },
	];

	it("filters by type, build, and source without inventing a latest mutable path", () => {
		expect(normalizeArtifactTypeFilter("image")).toBe("image");
		expect(normalizeArtifactTypeFilter("exe")).toBe("all");
		expect(filterArtifacts(items, { type: "image" }).map((item) => item.name)).toEqual(["shot.png"]);
		expect(filterArtifacts(items, { build: "b" }).map((item) => item.name)).toEqual(["notes.txt"]);
		expect(filterArtifacts(items, { source: "ccc" }).map((item) => item.name)).toEqual(["blob.bin"]);
	});
});
