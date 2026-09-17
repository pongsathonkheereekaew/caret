# The mobile terminal paints the host checkpoint instead of asking for a redraw (2026-09-16)

Plan item 27, client half — the other half is
[`../host-terminal-checkpoint-2026-09-16/`](../host-terminal-checkpoint-2026-09-16/)
(the host keeps the screen and serves `GET /v1/sessions/:id/terminals`).

## What changed

| layer | change |
| --- | --- |
| `apps/ios/src/core/virtual-terminal.ts` | `terminalCheckpointSeed(checkpoint)` turns the host's grid into terminal bytes (hide cursor, clear, place each row, put the cursor back); `VirtualTerminalRendererCoordinator.ready(identity, terminal, checkpoint?)` seeds from the checkpoint whenever the history was trimmed, the terminal is live and the checkpoint is fresh (`terminalId` matches, `lastSequence >= 0`), and advances its own watermark to the checkpoint's sequence so live output continues seamlessly |
| the renderer document (`apps/ios/src/components/terminal/document.ts`) | `replay_start` carries `checkpoint: true`; when it does, the document does not print the "history expired"/"screen restoring" notice, because the seed paints the real screen a moment later |
| `apps/ios/src/core/api.ts` | `CaretApi.getTerminalCheckpoints(sessionId)` → `GET /v1/sessions/:id/terminals` |
| `apps/ios/src/components/VirtualTerminal.tsx` | new optional `onLoadCheckpoint` prop; the view fetches once when `historyTruncated` is set and hands the result to the coordinator on `ready`. A missing or failed fetch keeps the old path (ask OMP to redraw), and the retry button clears the fetch latch |
| `apps/ios/App.tsx` | `loadTerminalCheckpoint` builds the prop from the session-scoped `CaretApi`, guarded by the current session and incarnation |

The fallback is deliberate: no checkpoint (or an older host without the engine) means the
previous behaviour — a redraw request — so the phone is never worse off than before.

## Verification

| gate | result |
| --- | --- |
| `bun run test:mobile` | **146 pass** (was 141), including five new cases: the seed byte sequence and cursor clamp; the coordinator seeding instead of requesting recovery (and advancing the watermark); the fallback when the checkpoint is missing, stale or empty, and when nothing was trimmed; the document rendering a checkpoint seed **without** printing the expired notice (with the notice still printed when a redraw is requested) |
| `bun run typecheck` (repo root) | clean |
| `bun run test` (repo suite) | 776 tests, 1 failure — `menus-contract.test.ts` needs `rg` on `PATH` (environmental, pre-existing) |
| `node scripts/ci-validate.mjs` | CI-OK |

The iOS `tsc --noEmit` has two failures in files this slice does not touch
(`src/__tests__/activity-inbox.test.ts`, `src/__tests__/product-prefs.test.ts`); they were
already red and are recorded here rather than quietly fixed.

## Not verified / next

- **No device receipt yet**: nothing here has run on a real iPhone over the relay. The
  closure for item 27 asks for exactly that.
- **Text only**: the checkpoint carries rows and a cursor, not cell styles, so a seeded
  screen has the right text and no colours. Extending `TerminalCheckpoint` with styled
  runs (the engine's snapshot already exposes per-cell foreground/background/bold/italic/
  underline) is the next fidelity step.
- The `VirtualTerminalView` mount wiring still has no component test — the same gap the
  mobile terminal path had before this slice; the coordinator, document and api calls are
  unit-tested, the React glue is not.
