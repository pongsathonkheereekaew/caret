# SEARCH embeddings evidence — file-level F-index seed (2026-09-10)

Throwaway `/tmp/caret-embed/probe.mjs`: 18 daemon sources → 111
900-char chunks → local nomic-embed-text-v1.5 Q4_K_M (llama.cpp v0.4.0,
Metal) → cosine, file score = max chunk. 10 hand-written queries, targets
recorded verbatim in the probe. Results: `/tmp/caret-embed/results.json`.

| files | chunks | build | q p50/p95 | recall@3 | recall@5 | MRR |
|---|---|---|---|---|---|---|
| 18 | 111 | 5.3s | 9/11ms | 1.0 | 1.0 | 0.95 |

## In-transit findings (kept, all measured)

- The embedding endpoint rejects inputs over ~1000 chars (HTTP 500,
  instant) at `-c 2048` AND `-c 8192` — chunking is mandatory, not
  optional. 900-char chunks + max-pool is the working shape.
- `search_document:` / `search_query:` task prefixes used throughout
  (nomic convention); scores 0.6–0.8 on hits with clean separation from
  distractors in 9/10 cases.

## Honest bounds

10 self-authored queries (bias noted — a stranger's queries will score
lower); file-level only (a real index ranks functions/symbols, needs
chunk→symbol mapping + incremental updates, unbuilt); 18-file toy
corpus. Decision: file-level recall justifies building the daemon-side
index track (SEARCH-02/06) — the open work is scale + granularity, not
"does local retrieval work at all".

Restart: `llama-server -m ~/.caret-models/nomic-embed-text-v1.5.Q4_K_M.gguf
--port 8081 -c 8192 --log-disable --embedding --pooling mean`
(stopped after measurement to free RAM).
