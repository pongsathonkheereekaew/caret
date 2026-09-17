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

The generated reports are `chrome-report-open-session.txt` and `chrome-report-empty-draft.txt`.
After the normalisation pass below they read: reference 45, Caret 30, **shared 11, renamed 3,
absent by decision 3, missing 28**.

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

## The normalisation pass, and what it found

The first comparison was dominated by two capture effects, and both are now handled in the tool:

- **A hidden control is not a control.** The reference side is an accessibility tree of the rendered
  window; the DOM side was reading every matching element, including hidden panel actions and a
  collapsed find widget (51 controls against the reference's 45). The query now skips anything with
  no client rect or `aria-hidden="true"`.
- **A shortcut is not part of the name.** A DOM label carries its key (`Toggle Side Bar (⌘B)`) where
  the AX node carries the label and the key as separate nodes. The parser strips a parenthesised
  shortcut, and leaves product names alone (`Models, DeepSeek V4.1 Flash (Command Code)`).

Three further categories were separated, so the failure list is only unexplained differences:

- **Absent by decision (3)** — `Enter Full Screen` and `Hide Apps` (section 5, keep the current
  panel) and `Account menu` (patch `0029`). Each carries its reason in the report, because a label
  on that list without a reason would be an excuse rather than a decision.
- **Same control, different words (3)** — `Go Back` ≤ `Go Back One Session`, `Go Forward` ≤
  `Go Forward One Session`, and `Projects New Project` ≤ `New Project`. The last one is the AX
  capture merging a row's text children into its parent button; the middle two are Caret's own
  wording.
- **Not a match just because a name appears inside another.** The first attempt used a substring
  test, which paired the reference's starter card `Debug an issue Find root causes and fix tricky
  bugs` with Caret's transcript `Find` box, and would have hidden a real difference. Matching is now
  an edge match — a whole-word prefix or suffix with at most two words of slack — and a test pins
  the pair that exposed it.

## What the 28 remaining misses are

24 of them are the empty-draft state the reference was captured in: the four starter cards and their
`Dismiss recommendation`, `Plan New Idea`, `Multitask`, `Run in Cloud`, `Start voice input`,
`Add agents, context, tools`, `High`, `This Mac`, the composer placeholder
`Plan, Build, / for skills, @ for context`, `Connect Slack` and `Skip step 2 of 3` from Getting
Started, plus the sidebar's repo rows and section actions (`sortable cedia`, `Repositories …`,
`Customize Sidebar`, `Open Workspace`, `combo box main`, `toggle button Settings`, `Chat actions`).

Four are real differences, and they are now the concrete to-do list of this check:

1. `Hide Sidebar` (reference) against Caret's `Toggle Side Bar` — same control, different words.
2. `splitter Resize panel` and `splitter Resize sidebar` — Cursor names its splitters; Caret's
   `role=separator` elements carry no accessible name.
3. `tab group Tabs` — Cursor names the tab group; Caret's editor tabs expose no group name.
4. `New Project` appears twice in the reference tree (a group row and a button); only one matches.
   This one is a capture artefact on the reference side, kept visible rather than suppressed.

## The first desktop fix, verified in a rebuilt app (same day)

The comparison named four non-state differences. Two were wording, and the fork's own sessions
navigation carried a longer tooltip than the reference: `Go Back One Session` /
`Go Forward One Session` where Cursor's accessible names are `Go Back` / `Go Forward`. Patch
`0035-caret-sessions-nav-copy.patch` sets both tooltips to the reference's words. It is a separate
patch rather than a fold into `0015`, because `0015` and `0017` both already edit that file in other
regions and folding would have broken `0017`'s reverse-check.

This is the first desktop change in this project verified end to end in a *rebuilt* app:

```
cd desktop && npx gulp vscode-darwin-arm64-min        # 3.1 min: workbench bundle + app bundle
CARET_HOST_NODE=$HOME/.caret-tools/node-v24.18.0-darwin-arm64/bin/node bun run package:mac
open -n -a VSCode-darwin-arm64/Caret.app --args --agents --remote-debugging-port=9333
bun scripts/agents-chrome-inventory.ts capture 9333 --write <file>
```

Result: `shared` rose from 11 to 13, `renamed` fell from 3 to 1, and the two navigation labels now
match exactly (`chrome-report-after-nav-copy.txt`, `caret-agents-chrome-after-nav-copy.txt`). The one
remaining "renamed" entry is the AX capture's own merge (`Projects New Project` against Caret's
`New Project`), not a UI difference.

Two toolchain facts cost real time here and belong in the record:

- `upstream/omp` was a git **worktree** whose parent lived in `/private/tmp` and had been cleaned, so
  `git rev-parse HEAD` failed and `bun run package:mac` could not start. Moving the stale checkout
  aside lets `prepare-omp-runtime.ts` re-clone at the pinned revision; the clone is 4.5 GB and the
  first package after it rebuilds the Rust native (`cargo build -p pi-natives`, ~10 min), after which
  the built runtime is reused.
- `bun run package:mac` needs `CARET_HOST_NODE` pointing at the Node 24 executable
  (`~/.caret-tools/node-v24.18.0-darwin-arm64/bin/node` here); without it the package step stops
  after the runtime build.

## Why the state did not match

Probing the live window over CDP (`/tmp` helper, not committed) showed why clicking `New Chat` did
not produce an empty draft: the control is Caret's own Agent Home nav row
(`caret-agent-home-nav-row.selected`) and the window already sat on a *read-only chat* — the sessions
part read `New task … This chat is read-only … Caret picked up this …`. So the window had adopted a
session that belongs to the host rather than opening a fresh draft, and no control in that state
offers one. Reaching the fair state is therefore about how that window decides what to show, not
about the comparison tool.

## The empty draft is unreachable because `New Chat` is inert

Clicking that nav row changes nothing at all, and this was measured rather than assumed: the control
inventory before and after the click is byte-identical (`caret-agents-chrome-newchat-inert.txt` is
the dump; `diff` against the post-click dump is empty), the window still holds one chat input, no
starter card appears, and 43 visible elements still match `read-only`.

The chain, read from the pinned fork:

1. `agentHomeNav.ts:117` (patch `0022`) runs `workbench.action.sessions.newChat`.
2. `NewChatInSessionsWindowAction.run` (`sessions/contrib/chat/browser/chat.contribution.ts:194`)
   calls `openNewSession({ folderUri: activeSession.workspace.uri })`.
3. `sessionsService._openNewSession` (`sessionsService.ts:1091`) takes the folder branch and calls
   `sessionsManagementService.createNewSession(folderUri)`.
4. `sessionsManagementService._resolveProviderForNewSession` (`sessionsManagementService.ts:875`)
   walks the registered providers and needs `provider.resolveWorkspace(folderUri)` to return a
   workspace **for one of this window's own folders**.
5. Caret's provider resolves it that way on purpose —
   `workspaceContextService.getWorkspace().folders.find(...)`
   (`extensionSessionsProvider.contribution.ts:186`) — so a session whose workspace is a different
   folder resolves to `undefined`. The other provider was the base agent host, which `0032` now
   answers with the null client.
6. Nothing resolves, `createNewSession` throws `No sessions provider can resolve folder '<uri>'`,
   and `_openNewSession` catches it (`sessionsService.ts:1124`) and falls into the folder-less path
   while `folderUri` is still set — which activates nothing.

Two consequences worth naming:

- The window shows a control that does nothing. Section 5's rule is that a missing capability is
  *disabled with a reason*, so this is a violation of the plan's own contract, not just a gap.
- It is what blocks the fair-state capture: the reference's empty draft is exactly what this control
  is supposed to open.

The fix is a session-creation slice, and it has three shapes: resolve a workspace from the session's
folder as well as the window's (the provider change, patch `0010`), run Caret's own new-task flow
from that nav row instead (patch `0022`), or disable the control with a reason until one of the
first two lands. The first is the one that makes the base action work; the third is the honest stop
gap.
