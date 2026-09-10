# Small-items evidence — pairing hygiene, ACP loop, send retry (2026-09-10)

Daemon (`caret-adapter`): owner-only pairing-file helpers (write/read-
back/0600/remove/missing-false keepers) wired into `serve-tcp.ts`
(stale-file cleanup at boot); `serve-acp.ts` stdio loop (help-ready +
initialize + authenticate round-trip observed live); `send --id` for
safe retry after a dropped turn (id passthrough keeper).

## Proven

- PairingFiles keeper; ACP loop smoke (exit 2 without token, ready +
  auth round-trip with token); id reach-through keeper.
- Full daemon suite 86/86.
- `--json` intentionally deferred (greppable lines suffice; structured
  output comes with REST PX-27, not as a flag bolt-on).
