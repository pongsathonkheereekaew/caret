import { describe, expect, it } from "bun:test";
import { retainLastGood, sameBuild, unknownMimeSafe } from "../src/artifact-lineage.ts";

describe("artifact lineage", () => {
	it("keeps last-good when the current build failed and does not replace it", () => {
		const lastGood = { buildId: "A", hash: "h1", status: "ready", label: "good" };
		const failed = { buildId: "B", hash: "h2", status: "failed", label: "bad" };
		expect(retainLastGood(failed, lastGood)).toBe(lastGood);
		expect(retainLastGood(failed, lastGood)).not.toBe(failed);

		const nextGood = { buildId: "C", hash: "h3", status: "ready", label: "newer" };
		expect(retainLastGood(nextGood, lastGood)).toBe(nextGood);
	});

	it("treats two artifacts as the same build only when buildId and hash match", () => {
		expect(sameBuild({ buildId: "A", hash: "h1" }, { buildId: "A", hash: "h1" })).toBe(true);
		expect(sameBuild({ buildId: "A", hash: "h1" }, { buildId: "A", hash: "h2" })).toBe(false);
		expect(sameBuild({ buildId: "A", hash: "h1" }, { buildId: "B", hash: "h1" })).toBe(false);
		expect(sameBuild({ buildId: "", hash: "h1" }, { buildId: "", hash: "h1" })).toBe(false);
	});

	it("refuses preview for executable and unknown MIME types", () => {
		expect(unknownMimeSafe("application/x-executable")).toEqual({ preview: false, downloadOnly: true });
		expect(unknownMimeSafe("application/octet-stream")).toEqual({ preview: false, downloadOnly: true });
		expect(unknownMimeSafe("unknown")).toEqual({ preview: false, downloadOnly: true });
		expect(unknownMimeSafe("")).toEqual({ preview: false, downloadOnly: true });
		expect(unknownMimeSafe("application/x-custom-plugin")).toEqual({ preview: false, downloadOnly: true });
		expect(unknownMimeSafe("image/png")).toEqual({ preview: true, downloadOnly: false });
		expect(unknownMimeSafe("application/pdf")).toEqual({ preview: true, downloadOnly: false });
	});
});
