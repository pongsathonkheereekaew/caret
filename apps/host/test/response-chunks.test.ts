import { afterEach, describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { ResponseChunks } from "../src/response-chunks.ts";

function largeBody(): { payload: string } {
	// Astral characters exercise the protocol's explicit UTF-16 length while
	// still making the UTF-8 payload large enough to use the chunk transport.
	return { payload: "🙂".repeat(40_000) };
}

function referenceOf(value: unknown): { sha256: string; length: number } {
	if (!value || typeof value !== "object" || !("cediaResponseReference" in value)) throw new Error("Expected a response reference");
	const reference = (value as { cediaResponseReference: { sha256: unknown; length: unknown } }).cediaResponseReference;
	if (!reference || typeof reference.sha256 !== "string" || typeof reference.length !== "number") throw new Error("Malformed response reference");
	return { sha256: reference.sha256, length: reference.length };
}

describe("ResponseChunks", () => {
	it("reconstructs a large unicode response and verifies its UTF-8 hash", () => {
		const chunks = new ResponseChunks();
		const body = largeBody();
		const serialized = JSON.stringify(body);
		const reference = referenceOf(chunks.wrap("mac", body));

		expect(reference.length).toBe(serialized.length);
		const reconstructed: string[] = [];
		for (let offset = 0; offset < reference.length; offset += 24_000) {
			const chunk = chunks.read("mac", reference.sha256, offset);
			expect(chunk).toMatchObject({ sha256: reference.sha256, offset, length: reference.length });
			reconstructed.push(chunk.text);
		}
		const text = reconstructed.join("");
		expect(text).toBe(serialized);
		expect(createHash("sha256").update(text).digest("hex")).toBe(reference.sha256);
	});

	it("isolates references by device even when the content hash is shared", () => {
		const chunks = new ResponseChunks();
		const body = largeBody();
		const mac = referenceOf(chunks.wrap("mac", body));
		// The same hash is intentionally produced for identical content, but the
		// cache key still includes the authenticated device identity.
		expect(() => chunks.read("phone", mac.sha256, 0)).toThrow(/expired|retrieve/i);
		const phone = referenceOf(chunks.wrap("phone", body));
		expect(phone.sha256).toBe(mac.sha256);
		expect(chunks.read("mac", mac.sha256, 0).text).toBe(chunks.read("phone", phone.sha256, 0).text);
	});

	it("rejects malformed and out-of-range chunk requests", () => {
		const chunks = new ResponseChunks();
		const reference = referenceOf(chunks.wrap("mac", largeBody()));
		expect(() => chunks.read("mac", "bad-hash", 0)).toThrow(/invalid response range/i);
		expect(() => chunks.read("mac", reference.sha256, -1)).toThrow(/invalid response range/i);
		expect(() => chunks.read("mac", reference.sha256, Number.MAX_SAFE_INTEGER + 1)).toThrow(/invalid response range/i);
		expect(() => chunks.read("mac", reference.sha256, reference.length)).toThrow(/outside the body/i);
	});

	it("expires inactive references after ten minutes and restores the clock", () => {
		const chunks = new ResponseChunks();
		const originalNow = Date.now;
		let now = 1_000;
		Date.now = () => now;
		try {
			const reference = referenceOf(chunks.wrap("mac", largeBody()));
			expect(chunks.read("mac", reference.sha256, 0).offset).toBe(0);
			now += 10 * 60_000 + 1;
			expect(() => chunks.read("mac", reference.sha256, 0)).toThrow(/expired|retrieve/i);
		} finally {
			Date.now = originalNow;
		}
		expect(Date.now).toBe(originalNow);
	});
});
