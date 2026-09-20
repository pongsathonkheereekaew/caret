# M3 gated-multiline evidence — REJECTED again, deterministically (2026-09-10)

Throwaway `/tmp/caret-multiline2/probe.mjs`: same 20-case seed as the
first rejection (20260910), n_predict 96, T 0.2, no stop. Acceptance
filter (all must pass): no truncation (usage.completion_tokens < 96,
heuristic fallback), no line repeated 3×+, ≥2 lines. Results:
`/tmp/caret-multiline2/results.json`.

| n | accept | p50 acc | p95 acc | truncated | repetition |
|---|---|---|---|---|---|
| 20 | 8/20 (40%) | 698ms | 1178ms | 9 | 3 |

Pre-declared ship bar (accept ≥60% AND p95 ≤2500ms): NOT met on rate.
The `usage` token count fires exactly at the ceiling (used=96 on all 9
truncations) — the detector is validated, and the accepted set is clean
by construction. Raising the budget trades truncation for worse latency
(first probe: p95 1756ms already over single-line gates).

Decision: V1 Tab stays single-line (200-case corpus green). The gate
itself ships conceptually with the next model: re-run this exact probe
against a base FIM quant — no new harness needed.
