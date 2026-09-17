# The composer's context chips are React now (2026-09-16)

Item 1 of the parity queue the user approved: close the remaining React-coverage gap in the
Caret-authored Agent Home surfaces, so the window is written the way the reference writes it. Only
the harness is allowed to differ; §5's other deviations stay.

## What the gap actually was

The earlier review listed three "hand-built DOM" files. Two of them build no DOM at all, which the
grep that produced the list could not see:

| file | reality |
|---|---|
| `agentHomePromptOptions.ts` | a 52-line controller attached to the base's own prompt-options API; the rows are the base's |
| `agentHomeUtilityInput.ts` | an `EditorInput` (model); no rendering |
| `agentHomeContextRow.ts` | **did** build the two chips by hand - the only real remaining gap |

`agentHomeContextRowReact.ts` now owns the markup: `mountAgentHomeContextRow(host, model, handlers)`
renders the branch chip (a button, so it can run the base's copy-branch command) and the runtime
chip from a model, with the class names `media/agentHomeContextRow.css` already targets.

The contribution keeps every decision - whether a chip exists at all, what the branch is, whether
this window runs locally - and holds a `MutableDisposable` for the wrapper plus its root, because
the composer rebuilds the picker row and a rebuilt row needs a new root rather than an update into
a detached element. The wrapper is `display: contents` (the same trick `mountAppsStripActions`
uses), so React's root element does not become a flex item of the picker row.

## Where this leaves the React coverage of the Agents window

Every Caret-authored Agent Home surface that renders is now React:

| surface | renderer |
|---|---|
| Apps panel: rail, instance tabs, `+`/summary actions, summary, empty-state cards | React |
| Sidebar navigation: rows, Projects/Repositories, filter, entries | React |
| Composer context chips | React (this change) |
| Starter rows | the base's own composer (not ours to move) |
| Pane scaffolding: containers, terminal attach, native browser bounds | DOM by necessity |

## Verification

| check | result |
|---|---|
| `cd desktop && npm run typecheck-client` | 0 errors |
| packaged app, CDP | `.caret-agent-home-context-chips` present with `display: contents` and one chip; the runtime chip carries `aria-label="Runs on this Mac"` and reads `This Mac`; the wrapper sits inside the composer's picker row (`.sessions-workspace-category-picker`) |
| `bun scripts/prepare-desktop.ts` | `27 patches, 18 removals` |
| `bun test apps/macos/test` | 593 pass / 0 fail, including the re-pinned `0024` needles and `desktop-patch-set.test.ts` applying the whole set onto the pinned base |

## Not verified

- **The branch chip.** This window's session has no git branch, so only the runtime chip rendered -
  which is the intended conditional behaviour, but it means the branch chip's markup and its
  copy-branch click were not exercised on screen.
- Whether a composer rebuild (the case the MutationObserver guard exists for) re-mounts the React
  root correctly was not reproduced: the guard's condition was observed to hold, but no rebuild was
  forced.

## Item 2: JSX, so new components are written the way the reference writes them

The reference's agent UI is JSX; Caret's was `createElement` because nothing compiled JSX. Three
things had to line up, and they are three files:

| piece | file | patch |
|---|---|---|
| the type-checker accepts `.tsx` | `src/tsconfig.json` - `"jsx": "react-jsx"`, `./vs/**/*.tsx` in `include`, and the diffing fixtures excluded (they are deliberately malformed samples read as text) | new `0030-caret-jsx-for-react-surfaces.patch` |
| the bundler compiles JSX to the automatic runtime | `build/next/index.ts` - esbuild `jsx: 'automatic'` | folded into `0028`, which owns that file |
| the renderer can resolve that runtime | `build/next/index.ts` - `inlineReactPlugin` also inlines `react/jsx-runtime` | folded into `0028` |

`agentHomeContextRowReact.ts` became `agentHomeContextRowReact.tsx`, written in JSX, as the proof
that the three pieces work together rather than as a syntax exercise.

**Verified**: `npm run typecheck-client` clean with `.tsx` in the program; the bundle contains no
external `react/jsx-runtime` import; and in the packaged app the window loads (which it could not if
the runtime were unresolvable) with the JSX component rendering - the runtime chip carries
`aria-label="Runs on this Mac"`, and the other React surfaces are unaffected (rail `Changes ·
Browser · Terminal · File`, four sidebar rows).
