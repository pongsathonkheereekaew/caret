# Remote gateway reuse probe — 2026-09-12

Purpose: reproduce gaps relevant to Caret Mac/iPhone continuity, without changing production code.

- Source: `caret-adapter` commit `76f859d60f661039ef9bf2de4c95e36c9b163141`, `apps/caret-daemon/src/remote.ts`.
- Exact extracted source SHA-256: `d34195c275ba8d3da07ee08f50bd10636b921a0e9321405165f7f31af540682a`.
- Runtime observed: Bun 1.4.2. No dependency install; the Effect import is used only for types and elided by Bun.
- [Probe](probe.ts) supplies an in-memory fixture API and promise-based `runEffect`, binds loopback on an ephemeral port, and closes all connections in `finally`.

Run from any directory:

```bash
bash /Users/pond/caret/source/docs/maintenance/evidence/remote-gateway-2026-09-12/run-probe.sh
```

An optional first argument selects another clone containing the pinned commit. The script extracts exact source into a temporary directory and removes it afterward. [Recorded output](result.txt) came from a fresh root-agent verification after the tester's initial reproduction.

Observed:

1. Two identical request IDs sent before the first handler resolves invoke the handler twice.
2. A socket that has sent no authenticated request receives a broadcast event.
3. An existing socket continues receiving events after token rotation; a subsequent request using the old token is correctly rejected as unauthorized.

`assertion=PASS` means the defect was reproduced, not that the product passed a security or continuity gate. This is a runtime fixture probe, not a TypeScript typecheck, full Effect/daemon integration suite, or LAN/cellular/relay test. Production code remains unchanged.
