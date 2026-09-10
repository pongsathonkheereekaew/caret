# SEARCH index evidence — product module (2026-09-10)

Daemon: `search-index.ts` (chunk store + versioned JSON persistence with
loud rejection + max-pool ranking over caller vectors) + 3 keepers.
Embeddings still arrive through the measured local-nomic seam
(`SEARCH-embed-evidence.md`: recall@3 = 1.0 file-level).

## Proven

- Overlap chunking, round-trip persistence, corrupt-shape rejection
  (non-JSON / non-object / version / chunks / chunk-shape).
- Vector-count guard; ranking order by best chunk.
- Full daemon suite 84/84.

## Open

Embed-server wiring, incremental updates, symbol granularity, search UI.
