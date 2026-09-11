# SEARCH index evidence — product module (2026-09-10)

Daemon: `search-index.ts` (chunk store + versioned JSON persistence with
loud rejection + max-pool ranking over caller vectors) + 3 keepers.
Embeddings still arrive through the measured local-nomic seam
(`SEARCH-embed-evidence.md`: recall@3 = 1.0 file-level).

## Proven

- Overlap chunking, round-trip persistence, corrupt-shape rejection
  (non-JSON / non-object / version / chunks / chunk-shape / symbol-shape).
- Vector-count guard; ranking order by best chunk.
- Incremental updates: re-chunk changed files, drop deleted ones, immutable
  input, shape-mismatch refusal (`updateFileIndex`, 2 keepers).
- Symbol attribution: coarse scan (TS/JS defs, Python def/class, Markdown
  headings) recorded per chunk, survives persistence (1 keeper).
- Full daemon suite 107/107.

## Open

`embedAndRank` + `code.search` RPC wired through the fixture HTTP seam
(2026-09-11). Live nomic + independent-query benchmark still need
`CARET_EMBED_URL` / `llama-server --embedding`. Search UI implemented in
composer (click unverified).

## SEARCH-03 lifecycle slice (2026-09-11)

- `index-job.ts`: one in-flight build per root; terminal phases
  `ready | paused | failed`; generation invalidation and cached vectors.
- Progress reports file/chunk totals. RPCs: `index.status`,
  `index.rebuild`, `index.pause`, `index.resume`; push event:
  `index.progress`.
- `code.search` starts an idle background index and fails with an
  actionable retry message instead of waiting indefinitely.
- Composer renders the phase and bounded counters with Rebuild, Pause,
  and Resume controls.
- Fixture keepers cover ready/search, in-flight dedupe, failure, pause,
  and resume. Per-file failure details and multi-root aggregation remain
  open.
