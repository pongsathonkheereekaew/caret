# M8 lease/handoff evidence — F08 logic without infrastructure (2026-09-10)

Daemon (`caret-adapter` branch): `lease.ts` (LeaseRegistry) +
`handoff.ts` (manifest + check) + 6 sync keepers in `lease.test.ts`.
Pure logic on a fake clock — zero timers, zero I/O, zero provider.

## Proven

- Ownership: one holder per resource, steal refused with the holder
  named; renew extends for the owner only; strangers, expired, and
  unknown ids fail with reasons; release frees; sweep drops the expired
  (restart/lease-expiry path) and freed resources re-acquire.
- Transfer: intact bundle in the same env passes; a single appended byte
  fails integrity (sha256 + length, both checked); os/arch/node-major
  drift fails with explicit per-field reasons (never resumes into a lie);
  node patch drift passes (not a handoff break).

## Deliberately NOT here (blocked-external)

VM provisioning/builds, secret boundaries, artifact stores, destroy
cleanup, failed-build fallback — all need a real provider + budget
(cloud decision still open). This is the F08 evidence seed: transfer
conflict/restart/lease-expiry semantics proven; infrastructure later.
Full daemon suite 42/42.
