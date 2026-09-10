# M9 webhook evidence — intake guard without infrastructure (2026-09-10)

Daemon (`caret-adapter` branch): `webhook.ts` (WebhookDedup) + 4 sync
keepers in `webhook.test.ts`. Pure logic — no HTTP server, no provider.

## Proven

- First delivery applies; redelivery by id skips (`duplicate delivery`),
  even with a newer timestamp (id wins over time).
- Late/out-of-order per (kind, key) skips (`stale …`) while equal/newer
  timestamps apply; entities and kinds track independently.
- Honest window bound (keeper-pinned): the id memory is capped (default
  1000); a redelivery evicted from the window applies again — providers
  must redeliver inside it. Missing delivery ids throw (fail loud, never
  silently apply-or-drop).
- Full daemon suite 46/46 with these keepers.

## Deliberately NOT here (blocked-external)

HTTP intake endpoint, per-SCM/chat/issue connectors, PR autopilot,
loop-stop/backoff, secret handling — all need real providers + accounts.
The guard is the M9 gate kernel (duplicate/late/out-of-order never act
twice); wiring comes with the first connector.
