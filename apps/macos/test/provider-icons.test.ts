import { describe, expect, it } from "bun:test";
import { providerGlyph, providerGlyphMap, providerGlyphSlug } from "../src/provider-icons.ts";

describe("provider marks", () => {
	it("bundles a glyph for the providers OMP actually routes to", () => {
		// The dock's picker groups models by provider and marks each row with the provider's own
		// glyph, falling back to a monogram for anything unbundled. These are the ids the live
		// catalogue uses (measured 2026-09-18), so a regression that drops one shows up here rather
		// than as a silently monogram-only picker.
		const map = providerGlyphMap();
		for (const provider of [
			"anthropic",
			"openai",
			"openai-codex",
			"google",
			"x-ai",
			"meta",
			"mistralai",
			"deepseek",
			"z-ai",
			"moonshotai",
			"minimax",
			"nvidia",
			"cohere",
			"amazon",
			"openrouter",
			"cursor",
			"opencode-go",
		]) {
			expect(map[provider]?.paths.length ?? 0).toBeGreaterThan(0);
		}
	});

	it("hands back path data only, and nothing for a provider it has no mark for", () => {
		const glyph = providerGlyph("anthropic");
		expect(glyph?.viewBox).toBe("0 0 24 24");
		// The dock builds each mark with createElementNS, so a bundled glyph must be geometry, never
		// markup: a `<` in a path would mean an SVG (or an injected node) travelled as a string.
		for (const path of glyph?.paths ?? []) {
			expect(path).not.toContain("<");
		}
		// Unknown providers, an empty id and a missing id all fall through to the monogram.
		expect(providerGlyph("commandcode")).toBeUndefined();
		expect(providerGlyph("")).toBeUndefined();
		expect(providerGlyph(undefined)).toBeUndefined();
		expect(providerGlyphSlug("commandcode")).toBeUndefined();
	});

	it("carries path data a browser can draw, for every bundled mark", () => {
		// The dock builds each mark with createElementNS, so a glyph that is not valid SVG path data
		// would render as nothing at all - silently, in the picker. This checks the payload rather
		// than the pixels: a real viewBox, at least one path, and only path-grammar characters.
		const pathGrammar = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\-+\s]+$/;
		const viewBoxGrammar = /^-?[\d.]+ -?[\d.]+ [\d.]+ [\d.]+$/;
		const entries = Object.entries(providerGlyphMap());
		expect(entries.length).toBeGreaterThanOrEqual(30);
		for (const [provider, glyph] of entries) {
			expect(viewBoxGrammar.test(glyph.viewBox), provider + " viewBox").toBe(true);
			expect(glyph.paths.length, provider + " paths").toBeGreaterThan(0);
			for (const d of glyph.paths) {
				expect(pathGrammar.test(d), provider + " path grammar").toBe(true);
			}
		}
	});

	it("resolves an alias to the vendor's mark", () => {
		// `openai-codex`, `zai-org` and `xai` are spellings OMP uses for the same vendors.
		expect(providerGlyphSlug("openai-codex")).toBe("openai");
		expect(providerGlyphSlug("openai-codex")).toBe(providerGlyphSlug("openai"));
		expect(providerGlyphSlug("xai")).toBe(providerGlyphSlug("x-ai"));
		expect(providerGlyphSlug("zai-org")).toBe(providerGlyphSlug("z-ai"));
		expect(providerGlyph("OPENAI-CODEX")?.paths).toEqual(providerGlyph("openai")?.paths);
		// resolveProviderGlyphId returns the package slug for these provider ids;
		// the asset lookup must remain idempotent when given that slug.
		for (const provider of ["mistralai", "z-ai", "moonshotai", "amazon", "arcee-ai", "bytedance-seed"]) {
			const slug = providerGlyphSlug(provider);
			expect(slug, provider).toBeDefined();
			expect(providerGlyph(slug)?.paths.length ?? 0, `${provider} -> ${slug}`).toBeGreaterThan(0);
		}
	});
});
