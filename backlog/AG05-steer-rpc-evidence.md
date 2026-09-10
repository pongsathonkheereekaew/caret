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
