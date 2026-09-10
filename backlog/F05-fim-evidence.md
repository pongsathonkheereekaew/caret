# F05 evidence — local completion serving (2026-09-10)

Serving: llama.cpp @ `v0.4.0` (source build, Metal, `~/caret-work/llama.cpp`).
Model: `Qwen2.5-Coder-1.5B-Instruct Q4_K_M` (~1.1GB, `~/.caret-models`,
official Qwen GGUF). Host: M3 / 8GB. Corpus: 40 random TS split points from
our own daemon sources (+20 single-line), seed fixed, 5-case warmup.

## Measured

| Mode | n | p50 | p95 | empty |
|---|---|---|---|---|
| `/infill` FIM-format, n=48 | 40 | 1249ms | 1655ms | **11/40 (27%)** |
| chat completion, n=32 | 40 | 956ms | 1090ms | 0/40 |
| chat single-line, n=16 + `\n` stop | 20 | 553ms | 606ms | 0/20 |

Single-line samples are plausible continuations; distribution tight
(400–630ms). Proposed warm targets (p50 ≤300ms / p95 ≤800ms) are NOT met
by any local configuration on this hardware.

## Decision (with reason, per roadmap)

- **Ship single-line ghost text** via chat-mode (shipped code == measured
  path). V1 gates: p50 ≤700ms / p95 ≤1000ms single-line on reference
  hardware, 0% empty on the corpus, cancellable + debounced + stale-guarded
  so latency never blocks typing. The original 300ms number assumed
  dedicated serving; adjusting to measured local-first reality WITH the UX
  mitigations is a reasoned scope, not a lowered bar.
- **Multiline / next-edit / cross-file portal stay OPEN** (TAB-03…05): the
  original gates are unmet, so nothing multiline is claimed.
- **Raw `/infill` on the instruct model rejected** (27% empty); revisit with
  a base FIM quant on its own track.
- Paid completion API stays fallback; M7 quality corpus decides.
- Toolchain recorded in `docs/UPSTREAM-LOCK.md` (add on next lock edit).
