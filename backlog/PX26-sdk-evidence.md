# PX-26 SDK evidence — typed daemon client (2026-09-10)

Daemon (`caret-adapter` branch): `client.ts` (CaretClient: all 12
session-API methods typed, error envelopes as CaretClientError, event
subscription, explicit-id retry, pairing revoke with auto re-token) +
4 keepers in `client.test.ts` against the real gateway (stub API).

## Proven

- Typed calls + error envelopes; events to handler (synced on the
  follower's own response — same-socket-order rule as the fan-out fix).
- Explicit-id replay across the client executes once server-side.
- Revoke rotates; stale token dies; hangs time out locally (150ms).
- Full daemon suite 55/55 with these keepers.

## Test bugs caught (same family as remote.test)

Shared token + auto-ids from 1 replayed across tests through the
idempotency cache (by design server-side). Fix: fresh gateway + token
per test; the cache behaves exactly as specified throughout.

## Follow-ups

- SDK lives in-tree (`apps/caret-daemon/src/client.ts`); extraction to
  `packages/` rides the vendor-out track with the rest of the daemon.
- CLI (PX-25) and REST (PX-27) are natural next consumers of this client;
  ACP (PX-24) is a separate wire protocol, unstarted.
