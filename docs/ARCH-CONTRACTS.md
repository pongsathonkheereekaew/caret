# ARCH contracts — daemon ⇄ fork seam map (2026-09-10)

Single owner per concern (L8.6). Daemon computes; fork renders. This file
is the cross-reference; code comments point here, not vice versa.

## RPC (daemon `session-api.ts` ⇄ fork composer + CLI + SDK)

| Method | Fork caller | Notes |
|---|---|---|
| session.start / stop / list | ensureSession, Stop, Runs flows | one live subscription enforced |
| turn.send / turn.steer | Send/queue drain, Steer… | steer lands at turn boundary |
| approval.answer | approval cards | parked per session |
| run.review / reject / bringBack | Review/Reject/Bring Back | refusal is data, never forced |
| run.list / run.remove | Runs… picker | 6-way guards daemon-side |
| run.export | Export… | single bundle.json, no overwrite |
| run.recapture | (no UI yet) | resume leg primitive |

## Events (daemon notify ⇄ webview rows)

`approval.requested` → approval card · `engine/*` (filtered: no deltas,
no request.opened duplicate) → typed rows (▶/✓/✕/•) · turn state +
elapsed → turn rows · queue/dequeue → queue list. Deltas never cross.

## Mirrored vocabularies (keep in lockstep, daemon is SSOT)

- Statuses/transitions: `session-state.ts` ⇄ `agentTypes.ts` (+ mode service)
- Event names/kinds/filter: `session-state.ts` ⇄ `agentEvents.ts`
- Commands: palette `caret.*` ⇄ `agentCommands.ts` (migrate with keybinding, never silently)
- Config: `caret.tab.*` ⇄ `agentConfiguration.ts`
- Storage: globalState keys ⇄ `agentStorage.ts` (tokens → keychain migration open)
- Tokens: `--agent-*` → VS Code theme (frozen values pending reference)

## Endpoints (multi-daemon)

`serve-tcp.ts` (one process per live session) ⇄ `TcpDaemonClient` +
endpoint registry + switcher. Pairing: env or 0600 file, never stdout.
`ProcessHost` spawns (used by proofs/scripts, not the extension yet).
