# M6 mobile boundary evidence — network-switch resync only (2026-09-10)

Deliberate non-build: no demo app, no web wrapper, no simulator run. The
locked decision stands (LAN web demo ≠ native mobile, simulator ≠ device
proof), so nothing here claims MOB progress beyond the one transport
kernel a phone actually needs.

## Proven (gateway keeper, loopback)

`resyncs across connections after a network switch` (`remote.test.ts`):
client A executes id 50, drops like a radio handover; client B reconnects
and replays id 50 → byte-equal cached response, executor still at 1. This
is the MOB-09 offline/reconnect kernel: Wi-Fi→cellular is a new socket
with the same id, and the M5 idempotency cache makes it safe.

## Test bug caught along the way (real race, now deterministic)

The fan-out keeper asserted client B's event right after client A's
response — but the two sockets are separate macrotasks, so B's line was
raci-ally absent. Fixed by syncing on B's OWN next response
(`pairing.status`): same-socket order guarantees the broadcast arrived.
No timers, no polling — 7/7 three consecutive runs.

## What remains honestly device-bound (all MOB-01…11 minus this kernel)

Real-device keyboard/gesture/voice/Pencil, push/Live Activities (needs
APNs sender + devices), offline drafts + action revalidation against
stale HEAD, native/web boundary, Android PWA. These need the 4 deferred
user decisions (mobile route, real devices, APNs sender, cloud
provider/budget) — `blocked-external`, never counted as pass.
