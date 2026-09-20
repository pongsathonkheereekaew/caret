# SEARCH-07 Documentation sources — implemented, not verified (2026-09-11)

Explicit URL fetch/cache/refresh. **Cursor `@Docs` is not claimed** — it
needs a reference capture before any index/picker parity.

## Proven

- `fetch-policy.ts` shared with MCP `web_fetch`: http(s) only, no URL
  credentials, localhost/RFC1918/link-local/metadata refused.
- `DocsCache` (`docs-source.ts`): SHA-256 file cache, 24h TTL, 64KB cap
  with `truncated`, `fetch` hits cache, `refresh` always refetches.
- RPCs: `docs.list` / `docs.get` / `docs.fetch` / `docs.refresh` (no
  session required). Cache dir `~/.caret/docs-cache` or `CARET_DOCS_CACHE`.
- Composer: explicit URL box, Fetch docs, Cached docs, Open, Refresh.
  Empty state names that `@Docs` is unverified.
- Keepers: refuse private URLs; cache-then-refresh; stale TTL refetch.
  Daemon suite **141/141**.

## Open

- Live fetch of a public page from the Agents UI.
- Cursor `@Docs` library/index/sync — reference-gated (SEARCH-07-C02).
