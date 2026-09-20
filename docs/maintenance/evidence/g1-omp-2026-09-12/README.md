# G1 OMP evidence — 2026-09-12

These receipts test the Caret adapter against installed OMP 18.1.18, pinned source
`00085d4e7dfdcfbf302c122fa2682b410a0f43d1`. Each JSON receipt includes the actual
binary SHA-256 and hashes of the exercised adapter source and smoke script.
Source pin and installed binary hash are separate evidence, not a reproducible
build attestation.

- [test-results.txt](test-results.txt): exact final commands, runtimes, suite/typecheck/repository results.
- [ui-bun.json](ui-bun.json), [ui-node.json](ui-node.json): actual RPC UI dialog/presentation round trips; zero model turns.
- [host-bun.json](host-bun.json), [host-node.json](host-node.json): actual OMP host tool/URI dispatch and abort; deterministic loopback completions.
- [g0-bun.json](g0-bun.json): original G0 smoke rerun against current adapter exports.

The host fixture has seven agent runs and 13 scripted HTTP completion requests
to a temporary server bound only to `127.0.0.1`. There is no external model
inference or model fee. The adapter returns tool updates/results, read/write URI
results, and propagates OMP cancellation into the registered handler. One
temporary file write and one in-memory URI write are allowed; deny/cancel paths
produce neither effect. A trusted fixture extension blocks one native write via
the OMP tool_call hook.

UI smoke uses an isolated trusted slash command, with deny/allow, select, input,
editor, upstream cancellation, timeout, and presentation/clear events. It does
not render Mac/iPhone controls or open a login URL. The `open_url` wire event is
covered by unit fixtures only; custom TUI components remain an open integration
gap.

Unit regressions additionally cover event-loop stalls across deadlines, stale
tokens, malformed duplicate IDs, deeply frozen authorization snapshots, bounded
request ledgers, cancellation during a queued terminal result, disposal during
hung authorization, and stalled output queues. Handlers must cooperate with
AbortSignal; a transport callback already invoked cannot be recalled.

All fixtures use temporary config/workspaces and omit ambient credentials from
the child environment. They do not certify dirty Code-OSS buffer protection,
all native tool policies, OS sandboxing, full OMP conformance, PTY, durable host,
Mac/iPhone visual parity, signing, or DAW compatibility. Historical G0 receipts
remain in their original directory with historical source hashes; these G1
receipts cover the current implementation.
