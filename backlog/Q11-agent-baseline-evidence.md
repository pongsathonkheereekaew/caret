# Q11 agent baseline evidence — 30 tasks, unpaired (2026-09-10)

Runner `apps/caret-daemon/src/corpus.ts` (committed proof-script style),
OpenCode free-tier `big-pickle`, fresh thread per task, approvals
auto-accepted + counted. Raw rows: `backlog/agent-corpus-baseline.json`.

| n | pass | p50 turn | p95 turn | approvals |
|---|---|---|---|---|
| 30 | 30/30 (1.00) | 25s | 60s | 86 (~2.9/task) |

Coverage: create×5, edit×5, shell×5, multi-step×5, exact-instruction×5,
reasoning+exec×5 (incl. FizzBuzz written AND run by the agent, word
count, reverse, merge-sort, kv→json). Every check is file-observed
(existence/equality/valid-JSON/executed-output), never model-graded.

## Honest bounds (read before citing)

- UNPAIRED baseline: no reference side, no ×3 runs — the gate needs
  Cursor-paired comparison (blocked on reference access). This seeds it.
- Small tasks by design (instruction-following, not puzzles); p95 is
  free-tier latency, not a product SLO.
- One harness trait to watch: s12/i22 finished in ~6s with 1 approval
  (direct), while s11/c02 took 51–60s (multi-approval loops) — latency
  variance is approval-roundtrips, worth its own future corpus split.
