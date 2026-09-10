# PX-25 CLI evidence — headless commands over TCP (2026-09-10)

Daemon (`caret-adapter`): `commands.ts` (12 async command functions over
an injected CaretClient; stable greppable line prefixes; explicit
per-id approval answers — no bulk accept) + `cli.ts` (argv/env dispatch;
help exits 0 pre-connect; missing env exits 2; failures exit 1; engine
events stream to stderr).

## Proven

- 4/4 keepers vs in-memory double (output lines, usage guards, both
  refusal branches, review truncation at 40 lines).
- --json: one envelope per command (`{command, ok, lines|error}`) via
  `createJsonLog` (2 keepers: ok shape + usage-error shape; `--json help`
  smoked live, no daemon needed).
- Interactive approval loop: `send --ask` prompts once per approval id on
  stdin (sequential chained prompts, empty/EOF declines, answers explicit
  per id, no bulk accept) via `createApprovalLoop` (4 behaviors in 1
  keeper: accept / decline-default / dedupe / ignore non-approval).
- Live against real `serve-tcp.ts`: `paired: true` exit 0; wrong token
  → `unauthorized` exit 1.
- Full daemon suite 111/111.

## Open

- Multi-approval UX at scale (prompts are sequential; a flood of requests
  is usable but noisy). --json and --ask are mutually exclusive (--ask
  owns stdin/stdout).
