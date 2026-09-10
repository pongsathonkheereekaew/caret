# PX-25 CLI evidence — headless commands over TCP (2026-09-10)

Daemon (`caret-adapter`): `commands.ts` (12 async command functions over
an injected CaretClient; stable greppable line prefixes; explicit
per-id approval answers — no bulk accept) + `cli.ts` (argv/env dispatch;
help exits 0 pre-connect; missing env exits 2; failures exit 1; engine
events stream to stderr).

## Proven

- 4/4 keepers vs in-memory double (output lines, usage guards, both
  refusal branches, review truncation at 40 lines).
- Live against real `serve-tcp.ts`: `paired: true` exit 0; wrong token
  → `unauthorized` exit 1.
- Full daemon suite 74/74.

## Open

- `--json` output (tracked, not started); turn-attached approval loop
  UX (events already visible on stderr — operator answers by id).
