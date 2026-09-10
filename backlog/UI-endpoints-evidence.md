# Multi-endpoint UI evidence — TCP endpoints in composer (2026-09-10)

Fork (`caret`): `tcp-client.ts` (pure TCP NDJSON client, 5/5 checks vs
the real gateway: request, events, blackhole timeout, auth refusal) +
endpoint registry (globalState), Add (manual or pairing-file read with
port parsed from filename) / Switch flows, endpoint status bar, and all
composer flows routed through the active endpoint (stdio default =
previous behavior, zero regression path).

## Proven (machine)

- `TCP-CLIENT-OK 5 checks` (bun direct, no harness needed).
- `tsc` 0; command cross-check (manifest ↔ registration ↔ nls, the
  toggleTab-family registers in its own modules — pre-existing pattern);
  all posted commands have cases.
- Sessions live per daemon: switching resets session state by design
  (stated in UX copy, not silent).

## Open (needs human)

- Click: add endpoint from a real pairing file, switch mid-work,
  approval card over TCP, status bar text. Secrets note: tokens rest in
  globalState today — OS keychain migration tracked (needs Mac hands).
