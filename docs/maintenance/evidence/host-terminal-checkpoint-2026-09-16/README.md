# The host keeps a terminal checkpoint (2026-09-16)

Plan item 23, first slice: the state half of the Ghostty VT work. The evaluation and the
numbers that justified it are in
[`../terminal-vt-spike-2026-09-16/`](../terminal-vt-spike-2026-09-16/).

## The gap this closes

The mobile renderer replays a bounded chunk history (4 MiB / 4096 chunks) into an xterm.js
WebView. When that history is trimmed — or a client attaches after a reconnect — there is
nothing to restore the screen from, so the client can only ask OMP for a redraw. Its own
receipt says it plainly: "fresh redraw recovery is not a serialized terminal checkpoint"
(`mobile-terminal-recovery-2026-09-13`). The host is the one process that sees every
`caret_terminal_*` frame, so the checkpoint belongs there.

## The change

| layer | change |
| --- | --- |
| `apps/host/src/terminal-state.ts` | `TerminalStateRegistry`: one headless screen per terminal, fed from `caret_terminal_open` / `caret_terminal_output` / `caret_terminal_close` with the same sequence rules the clients use (duplicates ignored, a gap marks the screen `historyIncomplete` rather than pretending the bytes were seen, a reopen keeps the screen and follows the new size, a close keeps the final screen readable). The engine is loaded lazily and is **optional**: without the native package the registry keeps nothing and the session runs as before |
| `apps/host/src/service.ts` | the registry is created per runtime when the virtual UI is on, fed from `#onFrame` (the same hook that records events), resized when a `caret_terminal_resize` command is acknowledged, disposed with the runtime; `terminalSnapshots(sessionId)` exposes the checkpoints |
| `apps/host/src/router.ts` | `GET /v1/sessions/:id/terminals` → `{ terminals: [checkpoint…] }` (404 for an unknown session) |
| `packages/protocol/src/index.ts` | `TerminalCheckpoint`: terminalId, title, cols/rows, cursor, visible lines, lastSequence, closed/closeReason, historyIncomplete |
| `apps/host/package.json` | `@coder/libghostty-vt-node` pinned at `0.1.0-beta.0` (libghostty-vt, MIT) |
| `scripts/build-caret.ts` | the engine is a native addon, so it stays external to the host bundle and the package (prebuilds + `node-gyp-build`) is copied beside it; the build **fails** when the current platform has no prebuild |
| `docs/upstream-notices/` | `ghostty-LICENSE.txt` (Ghostty, MIT) and `libghostty-vt-node-LICENSE.txt` (binding, MIT) |

OMP still owns the PTY; the host only keeps state. Nothing here starts a second shell.

## Verification

| gate | result |
| --- | --- |
| `bun test apps/host/test/terminal-state.test.ts` | registry rules with a deterministic double (one screen per terminal, duplicate sequence ignored, gap → `historyIncomplete`, reopen keeps the screen, resize after acknowledgement, closed terminal stays closed) + **the real engine**: the prebuild loads on this platform and renders two rows from a raw stream (plain text, then a coloured row carrying a Thai word with combining marks written non-ASCII in the test itself) |
| `bun test apps/host/test/router.test.ts` | the route contract: `{ terminals: [] }` for a session with no frames (honest empty), 404 for an unknown session, and a checkpoint passed through unchanged |
| `bun run typecheck`, `bun run test`, `node scripts/ci-validate.mjs` | see the receipt fields below |
| `bun scripts/build-caret.ts` | ships the engine beside the host bundle; the shipped copy loads under plain Node (a Thai word written through the copied addon rendered to the visible line) and the build refuses to run when the platform prebuild is missing |
| `bun scripts/omp-virtual-ui-smoke.ts` (real OMP, scripted loopback model, no provider credentials) | the host's checkpoint follows the real frame stream — see the receipt |

## Not verified / next

- **No client consumes the checkpoint yet.** The mobile app still reduces frames and asks
  for a redraw; wiring the checkpoint into the mobile renderer (and the relay path) is the
  rest of item 23, and the closure still needs a real-device receipt.
- The host keeps state only while a runtime is live: a host restart loses the screen (the
  frames are still in the session journal, so a future slice can rebuild from those).
- `caret_terminal_input` is not mirrored into the headless screen — OMP echoes input back
  as output frames, which is what the screen follows.
