// One-off generator: fetches AI-provider glyphs and emits a checked-in TS module.
import { writeFileSync } from 'node:fs';

const VERSION = '1.95.0';
const BASE = `https://unpkg.com/@lobehub/icons-static-svg@${VERSION}/icons`;

// Our OMP provider id (and its aliases) -> the icon package's slug.
const MAP = {
  anthropic: 'anthropic',
  openai: 'openai',
  'openai-codex': 'openai',
  google: 'google',
  'google-antigravity': 'google',
  'x-ai': 'xai',
  xai: 'xai',
  meta: 'meta',
  'meta-llama': 'meta',
  mistralai: 'mistral',
  deepseek: 'deepseek',
  qwen: 'qwen',
  'z-ai': 'zhipu',
  'zai-org': 'zhipu',
  moonshotai: 'moonshot',
  minimax: 'minimax',
  nvidia: 'nvidia',
  cohere: 'cohere',
  amazon: 'aws',
  xiaomi: 'xiaomi',
  inclusionai: 'inclusionai',
  poolside: 'poolside',
  'arcee-ai': 'arcee',
  baidu: 'baidu',
  ai21: 'ai21',
  liquid: 'liquid',
  'bytedance-seed': 'bytedance',
  stepfun: 'stepfun',
  upstage: 'upstage',
  tencent: 'tencent',
  openrouter: 'openrouter',
  cursor: 'cursor',
  opencode: 'opencode',
  'opencode-go': 'opencode',
  'opencode-zen': 'opencode',
  grok: 'grok',
};

const slugs = [...new Set(Object.values(MAP))].sort();
const glyphs = {};
const missing = [];
for (const slug of slugs) {
  const response = await fetch(`${BASE}/${slug}.svg`);
  if (!response.ok) { missing.push(slug); continue; }
  const svg = await response.text();
  const viewBox = (svg.match(/viewBox="([^"]+)"/) || [])[1];
  const paths = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map(m => m[1]);
  if (!viewBox || paths.length === 0) { missing.push(`${slug} (no path)`); continue; }
  glyphs[slug] = { viewBox, paths };
}
const entries = Object.entries(MAP).filter(([, slug]) => glyphs[slug]);
const out = `/*
 * Provider marks for the AI vendors OMP routes to.
 *
 * Generated from \`@lobehub/icons-static-svg@${VERSION}\` (MIT) by scripts/generate-provider-icons.mjs
 * (\`bun scripts/generate-provider-icons.mjs\`), reduced to the path data a webview can build with
 * createElementNS - no markup strings, no remote fetches at runtime. The marks themselves are the
 * vendors' brand assets, used here to identify the provider a model runs on; they stay the property of
 * their owners, and anything without a glyph falls back to the dock's monogram chip.
 */
export interface ProviderGlyph {
	readonly viewBox: string;
	readonly paths: readonly string[];
}

/** Icon-package slug for an OMP provider id, or undefined when no mark is bundled for it. */
export function providerGlyphSlug(providerId: string | undefined): string | undefined {
	const key = (providerId ?? "").trim().toLowerCase();
	// Callers may pass either OMP's provider id (`mistralai`) or the
	// already-resolved icon-package slug (`mistral`). Keeping slugs idempotent
	// avoids losing a mark when a resolver feeds its result back to this lookup.
	return PROVIDER_PROVIDER_SLUGS[key] ?? (Object.hasOwn(PROVIDER_GLYPHS, key) ? key : undefined);
}

/** The provider's mark, or undefined so the caller can fall back to a monogram. */
export function providerGlyph(providerId: string | undefined): ProviderGlyph | undefined {
	const slug = providerGlyphSlug(providerId);
	return slug ? PROVIDER_GLYPHS[slug] : undefined;
}

const PROVIDER_PROVIDER_SLUGS: Record<string, string> = ${JSON.stringify(Object.fromEntries(entries), null, '\t')};

const PROVIDER_GLYPHS: Record<string, ProviderGlyph> = ${JSON.stringify(glyphs, null, '\t')};
`;
writeFileSync('/Users/pond/cedia/apps/macos/src/provider-icons.ts', out);
console.log('glyphs', Object.keys(glyphs).length, 'mapped providers', entries.length, 'missing', missing.join(', '));
