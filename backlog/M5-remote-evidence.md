# M5-remote evidence — TCP gateway + pairing + idempotency (2026-09-10)

Daemon (`caret-adapter` branch): `session-api.ts` (method map extracted
from `server.ts`, behavior-identical, `send` → injected sink),
`server.ts` thinned to the stdio loop (40 lines, bundles clean),
`remote.ts` (TCP NDJSON gateway), `remote.test.ts` (6 loopback keepers).

## What the slice proves (M5 exit-gate backbone, LOC-01/02/04)

- Second client, same run: the gateway serves the SHARED session factory —
  two loopback clients observe one counter state (stub) and the key-shape
  keeper pins the real 10-method surface (`session.*`, `turn.send`,
  `run.*`, `approval.answer`) without invoking the engine. Engine-over-TCP
  is the same code path H05 proved over stdio; a live engine-over-TCP turn
  stays open for the next engine-budget run.
- Retry never re-executes: per-token `id → ok-response` cache (cap 200,
  oldest-evict); replays return byte-equal responses with the executor at
  1. Failures are NOT cached (a failed retry runs again — operator intent).
- Pairing: per-envelope bearer token (constant-time compare), random by
  default, `CARET_PAIRING` override for dev. `pairing.revoke` rotates over
  the authed connection and returns the replacement (no self-lockout);
  old-token cache entries die with the rotation (token-prefixed keys).
- Events fan out to every connected client (approval path rides this;
  per-socket order preserved, broadcast precedes the triggering response).
- Malformed envelopes (bad JSON, missing id, unknown method, no/wrong
  auth) get typed errors, never a hang.

## Deliberately NOT here

LAN bind beyond the `host` flag, relay-vendor choice (both are deployment
flags over this gateway — handoff keeps the vendor decision open), full
OAuth (blocked-external, seam from M4 stands), GET-stream server pushes,
mobile clients (need devices — UI session track).

## Proven

6/6 gateway keepers (loopback, stub API + stub runner, no engine) + full
daemon suite 30/30 + `server.ts` bundles (277 modules). Bugs the keepers
caught: forgotten session-id capture, a dropped `ctrl/timer` pair from a
mis-anchored edit, test-client null-id routing, live-getter stale-token
assertion, and a CUT that ate the `events` field — all fixed, suite green.
