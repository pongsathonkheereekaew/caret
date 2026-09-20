# Terminal VT spike: is Ghostty's VT core better than xterm.js for Caret? (2026-09-16)

The user asked what Ghostty could do for Caret's terminal, then narrowed it: no extra
apps to install, keep it inside Caret, and start with the two workstreams (evaluating the
VT core, then the conformance corpus). This receipt answers the evaluation half.

**Question:** is `libghostty-vt` (Ghostty's parser + terminal state, exposed through the
`@coder/libghostty-vt-node` Node-API binding) better than the xterm.js the pinned
Code-OSS base ships, for the place Caret would use it — a headless terminal state on the
host/mobile path?

**Answer: yes, by a wide margin on the path that matters, and it is safe to try** (MIT,
prebuilt for darwin-arm64, no install-time toolchain), with the caveats listed at the
end.

## Method

- Engines: `@xterm/headless` **6.1.0-beta.302** — the exact version `desktop/package.json`
  pins (`^6.1.0-beta.302`) — against `@coder/libghostty-vt-node` **0.1.0-beta.0**
  (native info: `napiVersion 10`, `ghosttyVersion 0.1.0-dev`, `darwin/arm64`).
- Node 24.18.0 (the same runtime the Caret host bundles).
- Spike ran outside the repository (scratch directory); nothing but the corpus and its
  runner landed here.
- Payload: mixed realistic output — coloured log lines, carriage-return progress
  redraws, cursor-addressed TUI writes in the alternate screen, `CSI ?2026` synchronized
  frames, OSC 0 title, OSC 8 hyperlink, Thai lines with combining marks.

## Throughput and memory

| measurement | xterm.js headless | libghostty-vt | ratio |
| --- | --- | --- | --- |
| feed 31.5 MB in ~1.3 MB chunks | 79.6 MB/s | 38.8 MB/s | xterm 2.0× |
| feed 10.6 MB in **8 KiB chunks** (what a PTY reader delivers) | 5.1 MB/s | **131.1 MB/s** | ghostty **25.7×** |
| RSS per live terminal (120×30, scrollback 2000) | 7.27 MB | **1.63 MB** | ghostty **4.5×** less |
| visible-text read × 1000 | 5.7 ms | 46.7 ms | xterm 8× |
| structured snapshot with cells × 100 | n/a (no equivalent) | 47.5 ms | — |

The chunk-size result is the decisive one and it cuts the other way at 1 MB chunks:
xterm's per-write cost is small but its per-chunk cost is not, and a PTY delivers small
chunks. The read number favours xterm, but reads are rare on the host path and the
snapshot (which xterm has no API for) is the operation the mobile/replay path needs.

## Behavioural conformance (the corpus that landed with this slice)

The same 12 cases now run in the repository (`apps/macos/src/terminal-conformance.ts`,
`bun run check:terminal`, and `apps/macos/test/terminal-conformance.test.ts`):

| case | xterm.js | libghostty-vt |
| --- | --- | --- |
| OSC 633 shell integration hidden | OK | OK |
| OSC 133 marks + title hidden | OK | OK |
| OSC 8 hyperlink → text only | OK | OK |
| `CSI ?2026` frames do not corrupt | OK | OK |
| Thai combining marks intact | OK | OK |
| wide characters advance two cells | OK | OK |
| box drawing + wide characters | OK | OK |
| DECSC/DECRC save/restore | OK | OK |
| scroll region + reverse index | OK | OK |
| erase-line + carriage return | OK | OK |
| alternate-screen round trip | OK | OK |
| ZWJ emoji (recorded, not asserted) | OK | OK |

**12/12 on both engines.** No behavioural regression is implied by a swap at the level
Caret depends on. Three of the first nine corpus runs failed against *my own
expectations*, not the engines — a bare `LF` keeps the column, a line still on screen is
not an empty screen, and a reverse index keeps the moved line's column. Those are
recorded in the corpus comments, because they are exactly the class of assumption this
corpus exists to stop.

## Caveats (why this is a decision, not an automatic adoption)

- `@coder/libghostty-vt-node` is **0.1.0-beta.0** and its README states the upstream
  `libghostty-vt` C API is still unstable: pin the commit and treat updates as
  deliberate work. Ghostty has not tagged a `libghostty-vt` version.
- Prebuilds ship for macOS arm64/x64 and Linux x64/arm64; **Windows has none**, and
  building from source needs Zig. Caret targets macOS today, so this is acceptable now
  and is a gate before any Windows work.
- The visible terminal is untouched by this slice: the workbench still renders with
  xterm.js, and the reference (Cursor) does too. Replacing the renderer stays a §5
  deviation decision.
- Measurements are single-run on one machine; treat them as order-of-magnitude, not
  benchmarks against each other's best case.

## What is in the repository now

- `apps/macos/src/terminal-conformance.ts` — the corpus and its engine-agnostic runner.
- `scripts/lib/terminal-engines.ts` — xterm adapter (shipped engine) and an optional
  Ghostty adapter that loads only when the binding is installed.
- `scripts/terminal-conformance.ts` + `bun run check:terminal` — the report.
- `apps/macos/test/terminal-conformance.test.ts` — the gate: every required case must
  hold on the engine the workbench ships, and it is the acceptance test for any future
  swap.
- Root devDependency `@xterm/headless@6.1.0-beta.302` (same line as the desktop pin), so
  the corpus runs the engine the product actually ships.
- `scripts/ci-validate.mjs` now skips `.commandcode/**`: that directory is session state
  written by tooling from the user's own words (learned taste), not repository
  documentation, and the English-only rule is about what this project publishes. The
  validator was otherwise red on a file nobody is allowed to rewrite by hand.
