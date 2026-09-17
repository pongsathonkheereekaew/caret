# R3 — the sidebar navigation is a React surface (2026-09-15)

R1 and R2 moved the Apps panel to React; R3 is the same move for the sidebar. §7.3 names it as the
largest remaining slice, and the brief for this round expected it to be smaller than that because
the sections already exist - which is what it turned out to be, but not for the reason the brief
gave.

## What was actually there

The sidebar navigation (`src/vs/sessions/contrib/home/browser/agentHomeNav.ts`, created by patch
`0022`) already carried the reference's wording, order and commands: `New Chat`, `Search`,
`Automations`, `Customize`, then `Projects` with `+ New Project`, then `Repositories` with the
filter toggle, `+ Add Repository`, the repository rows and the two empty notes. It built all of
that by hand with `$`/`append`/`classList`, in 308 lines of DOM assembly interleaved with the
wiring.

So R3 was not "add the missing sections". It was: move the markup into React, leave the decisions
in the pane, and keep the class names so the stylesheet, the Caret token layer and the parity gate
see what they saw before.

## The split

| half | owner | what it holds |
|---|---|---|
| `agentHomeNav.ts` | the pane (model) | which rows exist, what each one runs (`ICommandService`, `ICustomViewService`), whether the filter is open and what it hides, the workspace folders the repository rows come from, and the delegated project context menu |
| `agentHomeNavReact.ts` | React | the rows, the section headers and their actions, the filter input, the repository rows, the notes, and the spacer |

The handlers are the seam: `onRow(id)`, `onAction(id)`, `onFilterInput(sectionId, query)`. The pane
keeps a `Map<string, () => void>` of what each control runs, so the React surface never sees a
command id it could run on its own, and a control that has nothing to run simply is not in the map.

`createElement` rather than JSX, for the same reason R1 recorded: the pinned base's
`src/tsconfig.json` sets no `jsx` option, and turning JSX on for the whole workbench is a separate,
reviewable change.

## Verification

| check | result |
|---|---|
| `cd desktop && npm run typecheck-client` | 0 errors |
| `desktop/out-vscode` rebuilt, copied into the app, app re-signed | the bundle contains the React surface's own literals and no longer contains the hand-built row factory (`button.caret-agent-home-nav-row`) |
| packaged app, Agents window, read over CDP | `.caret-agent-home-nav` present; rows `newChat`/`search`/`automations`/`customize` with the reference labels, `New Chat` selected and `aria-current="page"`; sections `Projects` (action `New Project`, no entries, no empty note) and `Repositories` (actions `Filter Repositories` with `aria-expanded="false"` and `Add Repository`, empty note `No repository open` in this profile, which has no folder) |
| packaged app, CDP, filter toggle | pressing `Filter Repositories` reveals `input.caret-agent-home-nav-filter` with placeholder `Filter repositories` |
| `bun scripts/prepare-desktop.ts` | `27 patches, 18 removals` (green) |
| `bun test apps/macos/test` | 593 pass / 0 fail, including `desktop-patch-set.test.ts` (applies the whole set in manifest order from the pinned base) and the re-pinned `0022` needles |

## Patch bookkeeping, and a trap worth remembering

`0022` *creates* `agentHomeNav.ts`, so the rewrite belongs in `0022` rather than in a new patch (the
rule in the plan's §6). Re-cutting it, though, hit a second version of the same trap: `0022` also
modifies `sessions.desktop.main.ts`, and `0023` and `0024` modify that file after it. Regenerating
`0022` from the working tree for its whole file list therefore folded the later patches' edits into
it, and both then failed to apply.

The rule, now written into §6: re-cut a patch from the tree **only for the files it creates**. For a
file an earlier patch already changed, or a later patch will change, keep the original hunks and
replace only the sections that belong to this patch.

## Not verified

- A window with a workspace folder open: this profile has no folder, so the repository rows,
  the filter narrowing real rows, and the "No matching repository" note were not exercised with
  data. The filter toggle and the input were.
- Drag-reordering the project groups in the session list below the navigation.
