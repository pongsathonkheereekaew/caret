# SEARCH embed-client evidence — HTTP seam (2026-09-11)

Daemon: `embed-client.ts` POSTs to a local llama.cpp-shaped `/embedding`
endpoint with nomic `search_document:` / `search_query:` prefixes and
the measured 900-char cap (SEARCH-embed-evidence.md). Ranking/chunking
stay in `search-index.ts`. Keepers use a fixture vector server — no
model this round.

## Proven

- Flat and nested `{ embedding }` shapes.
- Prefix split (document vs query).
- Oversized chunk refused; HTTP 500 and local timeout surface as
  `EmbedError` (no silent retry, no billed fallback).
- Full daemon suite 120/120 (embed 2/2).

## Open

Live nomic wiring + independent-query benchmark still needs the embed
server started on demand (`llama-server --embedding`). UI for semantic
hits is not this module.
