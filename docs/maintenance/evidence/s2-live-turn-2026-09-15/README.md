# S2 — one real OMP turn through the host (2026-09-15)

`receipt.json` is written by `bun run smoke:omp:live` (`scripts/omp-live-turn.ts`).
It is the first end-to-end turn that reaches a provider: earlier S2 evidence
covered the composer, the model picker and the write-through paths, and every
`scripts/omp-*-smoke.ts` is deliberately provider-free, so the streaming half of
the contract had never been exercised.

The turn uses the same path the Agents window uses — host HTTP API →
`POST /sessions/:id/start` → `POST /sessions/:id/commands` (`prompt`) → OMP →
`GET /sessions/:id/events` — and the prompt asks the model to touch no files and
reply with exactly `caret-live-turn-ok`.

## What it proves

- `start` allocates a new incarnation, and the command has to carry the
  post-start value (`apps/host/src/service.ts:134`; the app already re-reads it in
  `apps/macos/src/chat-sessions.ts:487-491`).
- A real turn streams `agent_start` → `turn_start` → `message_start` →
  `message_update` ×N → `message_end` → `turn_end` → `agent_end`, and the host
  completes the command on the terminal `agent_end`.
- The host persists the whole turn in its event journal and the command reaches
  `completed`; the answer returned by the model matches what was asked for.

## What it does not prove

`limitations` in the receipt is the short form. In full: this is one prompt over
whichever provider/model the operator's own OMP configuration selects. It covers
no tool call, no permission or approval prompt, no multi-turn continuity, no
abort/steer, no relay or mobile projection, and it was driven through the host
API rather than by typing into the composer of a running Agents window.

## Cost

The run is not free: it spends real provider credit. The 2026-09-15 runs cost
about US$0.0001 each (24k tokens, nearly all of it cache reads). The script is
therefore not part of `bun run test` or `check:repo`.
