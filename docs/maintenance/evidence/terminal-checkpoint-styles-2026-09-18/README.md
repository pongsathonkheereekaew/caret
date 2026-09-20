# Terminal checkpoints carry cell styles (2026-09-18)

Closes the "cell styles in the checkpoint" piece of §10 item 27. The host's headless screen
checkpoint (`TerminalCheckpoint`) carried text and a cursor only, so a phone that seeded its
xterm.js renderer from it got a colourless screen. The native engine already knows the styles:
`@coder/libghostty-vt-node`'s `snapshot({ includeCells: true })` returns
`cells: [{ row, col, text, width, bold?, italic?, underline?, foreground?, background? }]`, with
colours resolved from the palette to `#rrggbb` (`native/terminal.cc:466-480`).

## What changed

- `packages/protocol`: `TerminalCheckpointRun` plus an optional `runs` on `TerminalCheckpoint`.
- `apps/host/src/terminal-state.ts`: `snapshots()` asks for cells and groups them into runs —
  adjacent cells merge only while every style field matches, columns must be contiguous
  (`col + accumulatedWidth`), absent styles stay absent, and the list is bounded at 5000 runs.
- `apps/ios/src/core/virtual-terminal.ts`: `terminalCheckpointSeed` paints a row with runs run by
  run, positioned explicitly, then resets and clears to the end of the line. A checkpoint without
  `runs` produces byte-identical output to before.

## The live check (and the bug it found)

`live-check.ts` (kept beside this file) drives the real native addon through the real registry,
feeds `ESC[31m ERR ESC[0m ok ESC[1;44m NOTE ESC[0m`, takes the checkpoint, seeds a real
`@xterm/headless` terminal and reads the cells back. Run from `apps/host`:

```
bun live-check.ts
LIVE-OK: native engine styles -> checkpoint runs -> xterm truecolour cells
```

The first run failed: a cursor move does not clear SGR state, so a style-less run inherited the
previous run's colour and a partial SGR kept the previous foreground. The fix emits a reset
(`ESC[0m`) before every run's own sequence; the fixture tests had pinned the buggy string and were
corrected with it. `live-check-output.txt` is the passing run.

## Verification

| gate | result |
| --- | --- |
| `bun test apps/host/test/terminal-state.test.ts` | 10 pass / 0 fail |
| `cd apps/ios && bun test` | 156 pass / 0 fail |
| `bun run test` | 858 tests, 1 fail — the standing environmental `rg` failure in `menus-contract.test.ts` |
| `bun run typecheck`, `bunx tsc --noEmit -p apps/ios/tsconfig.json` | clean |
| live check (above) | native engine → checkpoint runs → xterm true-colour cells |

## Not covered

The mount-wiring component test item 27 also asks for is still open: the iOS project has no
component renderer dependency, and the coordinator/seed paths the component calls are covered at
the logic level (`virtual-terminal.test.ts`). The real-iPhone-over-relay receipt remains item 23's.
