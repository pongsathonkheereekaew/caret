# M3 completion corpus evidence — 200 seeded edits (2026-09-10)

Throwaway `/tmp/caret-corpus200/probe.mjs` (seed 20260911, daemon +
extension TS sources, 5 warmup). Shipped single-line path replica
(n_predict 16, T 0.1, `\n` stop). Raw results:
`/tmp/caret-corpus200/results.json` (all 200 samples).

| n | p50 | p95 | max | ship ≤1200ms | empty |
|---|---|---|---|---|---|
| 200 | 521ms | 683ms | 755ms | 100% | 0/200 |

Pre-declared V1 gates (F05) all PASS with headroom. Validity auto-checks
(single-line, no fence, ≤160 chars, no prefix-echo): 193/200 strict-clean.
The 7 flags adjudicated: 4× fence-opener (```json/```typescript —
genuinely unshippable as ghost text) + 3× echo (mid-token completions,
plausibly correct, audit-noted).

## Shipped hardening from this corpus

`LlamaServerFimClient.complete` now strips a leading ```lang marker and
trailing fence: fence-only replies become empty (discarded), never ghost
text (fork commit, `tsc` 0). With the strip, effective validity is
196–200/200 depending on the 3 echo audits (samples preserved).

Human spot-audit of all 200 samples stays open (recorded, not claimed).
