# First live AX/DOM capture (2026-09-17)

The plan called the AX/DOM comparison "the real decider for *identical*" and "the largest single
verification gap in the project". This is the first time it has been run against a live Caret
window. The result is not a pass; it is the first honest reading, and it separates three things that
were previously one unknown.

## What was measured

| | |
|---|---|
| Reference | `cursor-agents-ax-2026-09-14/cursor-agents-ax-tree.txt` - Cursor 3.20.17, Agents window, empty draft, captured with Computer Use (AX) |
| Caret | `Caret.app` packaged 2026-09-16 23:43 (bundle 23:13), launched with `--agents --remote-debugging-port=9333`, captured over CDP |
| Command | `bun scripts/agents-chrome-inventory.ts capture 9333 [--empty-draft] --write <file>` |
| Controls | reference 45, Caret 30, shared 12 |

Both dumps are in this directory: `caret-agents-chrome-open-session.txt` (the window as it opened)
and `caret-agents-chrome-empty-draft.txt` (after clicking the window's own `New Chat`).

Note on revision: the packaged app predates this pass. Nothing changed today is chrome-visible - the
day's changes removed dead modules, a duplicate palette command, the retired `agentWorkbench` island
and the local agent-host client - so the capture describes the same window chrome the current source
produces. A re-capture belongs in the next packaging run.

## The 33 controls the reference has and Caret does not

**1. State (26).** The reference capture is an *empty draft*, so its inventory contains the empty
state's own controls. On both of Caret's captures those are absent, because Caret's window sits on a
chat: the four starter cards (`Build from a design`, `Deploy my prototype`, `Start with a plan`,
`Debug an issue`) and their `Dismiss recommendation`, `Plan New Idea`, `Multitask`, `Run in Cloud`,
`Start voice input`, `Add agents, context, tools`, `High`, `This Mac`, the composer placeholder
`Plan, Build, / for skills, @ for context`, `Connect Slack` and `Skip step 2 of 3` from Getting
Started, the sidebar's repo groups (`sortable cedia`), `Projects New Project`,
`Repositories Customize Sidebar Open Workspace`, `Customize Sidebar`, `Open Workspace`,
`Account menu`, `Chat actions`, `combo box main`, `toggle button Settings`, `tab group Tabs` and the
two labelled splitters. Clicking `New Chat` in the sidebar did not change the state, so Caret's
empty-draft inventory was not reached.

**2. Recorded deviations (3).** `Enter Full Screen` and `Hide Apps` are the Apps-panel header
controls the plan's section 5 records as *kept as they are* (the user chose to keep the current
panel), and `Account menu` is the account widget patch `0029` removes on purpose. This run confirms
those three are genuinely absent rather than merely renamed.

**3. Copy and a11y gaps that are neither state nor decision (4).**

| Reference | Caret | Reading |
|---|---|---|
| `button Hide Sidebar` | `button Toggle Side Bar` | the same control, two different words; the reference names the action the user is about to take |
| `button Go Back` / `Go Forward` | `button Go Back One Session` / `Go Forward One Session` | same control; Caret's label carries session wording the reference leaves to context |
| `splitter Resize panel` / `Resize sidebar` | no label | Cursor names its splitters; Caret's DOM exposes `role=separator` with no accessible name, so the control is invisible to the comparison and to a screen reader |
| `tab group Tabs` | no equivalent name | Cursor names the tab group; Caret's editor tabs carry no group role or name |

The remaining reference labels are grouped differently rather than missing: the AX capture merges a
row's text children into the parent button (`Projects New Project`), while the DOM side exposes them
as separate controls (`New Project`, `Filter Repositories`, `Add Repository`).

## What this changes

- "Never run" becomes "run, with the first result classified". The tool, the capture mode and the
  two dumps are reusable, and the classification tells the next pass exactly what to chase.
- The comparison is **not** yet a verdict: a fair run needs both windows in the same state (the
  reference's is the empty draft) and one normalisation pass over the two capture vocabularies (AX
  merges text children; the DOM does not).
- Four concrete, non-state differences are now named: two labels (`Hide Sidebar`, `Go Back` /
  `Go Forward`) and two accessible names Caret does not set (the splitters, the tab group).

The fair run needs Caret's Agents window in an empty draft. Finding out why `New Chat` in the
sidebar does not put this window there is the first step of that pass.
