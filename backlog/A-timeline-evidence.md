# Phase A timeline evidence — typed engine rows (2026-09-10)

Daemon (`caret-adapter`): `DaemonOptions.onEvent` sink +
`shouldForwardEngineEvent`/`engineRowKind` in `session-state.ts`;
`session-api.ts` forwards `{event:'engine', type, kind, detail}` over
BOTH transports (stdio + TCP broadcast). Fork (`caret`): `trow` rows
(▶ start / ✓ done / ✕ failed-red / • info) + handler + audit.

## Filter contract (keeper-pinned)

Forward states, drop flood: any `*delta*` (either case) dropped,
`request.opened` excluded (approval.requested carries it richer with the
parked resolver), empty/unknown types dropped. Kinds: fail|error →
failed; complet|done|resolved|restored → done; start|opened|created|
running|progress → start; else info.

## Proven (machine)

- 6/6 session-state keepers (filter matrix + kind samples incl.
  `session/threadOpenResolved` → done); full daemon suite 67/67.
- `tsc` 0; all 7 webview message types handled; no second store (sink
  reads the same stream the journal records).

## Open (needs engine run / human)

- Live observation of rows during a real turn (next engine run will show
  them; none claimed now).
- Collapse, elapsed time, per-tool expand, virtualized list — later
  Phase A slices. Deltas intentionally never leave the daemon.
