# Phase A queue evidence — composer pending queue + Stop (2026-09-10)

Fork (`caret` branch): `PendingQueue` (`extensions/caret/src/queue.ts`,
pure, 8/8 checks via bun) + host drain in `extension.ts` + queue list,
Drop buttons, and Stop button in the composer webview.

## Contract (parity §3E/§10 queue-vs-steer)

- Send while idle → runs now. Send while running → `queued #n` (FIFO,
  cap 20, loud refuse when full, empty prompts rejected).
- Turn completion auto-sends next; each drain posts queue state.
- Failed turn keeps the remainder queued (operator resumes with Send).
- Steer stays immediate (`sent as steering`); queued items render
  `Queued #n` with per-item Drop — visually distinct by construction.
- Stop: clears the queue, stops the session, reports drops.

## Proven (machine)

- `QUEUE-OK 8 checks` (enqueue positions, full/empty/out-of-range
  refusals, FIFO drain, clear) — bun direct, no harness needed.
- `tsc -p ./` exit 0; static audit: 9/9 buttons have handler+case, every
  posted command (incl. JS-only `dequeue`) has a case.
- Live click (queue ordering under a real turn, Drop mid-drain, Stop
  mid-turn) outstanding with the H05 human script.
