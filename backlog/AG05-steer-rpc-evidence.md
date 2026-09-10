# AG-05 steer RPC evidence — `turn.steer` over both transports (2026-09-10)

Daemon (`caret-adapter` branch): `turn.steer{input} → {steered:true}` in
`session-api.ts`, thin over the live-proven `steerCaretTurn` facade (Codex
mid-flight steer PASS with `turn.steered` event + injected content in all
3 files — see `backlog/M4-backend-evidence.md`). Steering input also
refreshes the export goal, so `run.export` reflects the latest intent.

## Posture (same as `run.export`)

- Dispatch + shape proven here (surface-shape keeper: 12 methods, full
  suite 35/35). Facade behavior proven earlier against the real engine.
- Live RPC-level steer (socket → Codex mid-turn) rides the next
  engine-budget run with the TCP-loop proof — not claimed yet.
- Per-driver truth still holds: steer targets the LIVE turn only; Codex
  resume-after-stop stays UNSUPPORTED (capability flag, handoff path).

## Follow-up (UI session)

Composer Steer affordance is yours: send-box-adjacent button enabled only
while a turn runs → `turn.steer{input}` → status `steered` / refusal text.
No new approval semantics (steer lands at the next turn boundary).

## Live RPC-level steer (2026-09-10) — PASS

Throwaway `/tmp/caret-steer-live/proof.mjs` over the TCP gateway, real
Codex, scratch repo. Wall 78.6s.

- Slow turn (`sleep 20` then write `slow.txt`) approved and running.
- `turn.steer{input: "also create steered.txt…"}` mid-sleep →
  `{steered:true}` acknowledged over the socket.
- Both follow-up writes raised their own approvals (3 approvals total,
  all exact-command-before-execution, all accepted) → `turn completed`.
- Review names BOTH `slow.txt` (base turn) and `steered.txt` (steered
  input), 323 chars. Steer demonstrably landed at the turn boundary
  instead of being dropped or double-applied.

No per-driver caveat change: steer targets the live turn; Codex
resume-after-stop stays unsupported.
