# What Cursor actually does, and what Caret chose (2026-09-17)

The user asked what they had to decide, then answered every item. This records the measurements
behind each answer, so the next session does not re-derive them.

## The reference, measured

Cursor 3.20.21 is installed on this machine (the plan's measured reference is 3.20.17, so the
bundle strings were cross-checked against the captured 3.20.17 accessibility tree).

**The IDE window keeps a chat surface too.** The desktop bundle carries
`workbench.panel.aichat` (a view container), `workbench.panel.aichat.view`, `aichat-container`, and a
command whose title is `Hide Chat` (`aichat.close-sidebar`). Beside it sit the entry points that open
the separate Agents window: `workbench.agentsWindowButton.enabled` (default `true`), plus
`agentsWindowOpenSource` values `ide_title_bar_button`, `ide_agents_sidebar`,
`ide_empty_editor_parallel_agents_button` and two banners. The Agents window itself is internally the
**Glass** window (`cursor.openOrFocusGlassWindow`).

So Caret's dock in the IDE window is parity, not surplus. What this does **not** establish is where
Cursor paints that surface on 3.20.21 (panel, secondary sidebar or right side) - no AX capture of its
IDE window was taken.

**The Agents window's chrome is thin.** From the captured tree: one sidebar control, `Hide Sidebar`;
in the Apps panel header, `Enter Full Screen` and `Hide Apps`; a resizable splitter. `Show Panel` and
`Toggle Side Panel` appear in neither bundle. Caret keeps both of those anyway - the user chose to
keep the current panel, and that choice is recorded as a deviation in the plan's section 5 rather
than left as open parity work.

**The composer's chips belong to a real mode system.** `Plan New Idea ⇧Tab` and `Multitask` are calls
to action attached to mode state, not decoration: the bundled composer has `composerMode.multitask`,
`cycleMode`, and `changeToAsk` / `changeToDebug` / `changeToMultitask`, and each mode carries its own
placeholder and description (`Coordinate tasks` / `Orchestrate multiple subagents in parallel` for
Multitask; `Ask questions` / `Answer questions without making edits` for Ask). The CTAs are pushed
conditionally - `Plan New Idea` only while the mode is not `plan`. The window's own placeholder is
`Plan, Build, / for skills, @ for context`, which Caret already copies.

## The Agent Host is now honest

`0032-caret-no-base-agent-host.patch` had stopped the *prewarm*, which left the client in place: any
surface that asked that host for work still started the utility process, whose node graph requires
Copilot services this fork removed. The patch now has a second half - the desktop DI shim's local
branch returns the base's own `NullAgentHostService`, with the reason
`Caret ships no agent host: OMP is the only harness this build runs.` `NullAgentHostService` gained an
optional constructor reason, and its module-private `notSupported` const became a protected method so
a caller's build can name itself. The remote branch is untouched.

The 25 `IAgentHostService` injection sites stay. Removing them is the other option the plan listed,
and it is the expensive one (the injections include the chat widget itself); with the null client
nothing has to be removed for the state to be honest, and nothing enables agent-host features, so
none of them resolves the client eagerly.

## `.omp/` is not repository content

`.omp/agent/config.yml` in the tree was **byte-identical** to `~/.omp/agent/config.yml` (same sha256)
and carries provider credentials; `models.yml` was a near copy. Neither Caret nor OMP reads a project
`.omp/agent/` directory - OMP's project-scope file is `.omp/config.yml`, its global directory is
`~/.omp/agent/` - so the copy was inert and only risked being committed. It is removed, and
`.gitignore` now ignores `.omp/` with `!.omp/config.yml` excepted, which is exactly the split the
user asked for: the file both tools read at project scope can be committed, the credential store
cannot.

`.agents/AGENTS.md` is committed, because `~/.agents/AGENTS.md` is a symlink into this repository;
the installer's `skills-enabled.json` and `skills.lock` are ignored as machine state.

## The AX/DOM comparison has a tool

The plan calls this the real decider for "identical" and it had never been run. It is now two halves
and one of them exists:

```
bun scripts/agents-chrome-inventory.ts reference                  # 45 controls, from the captured tree
bun scripts/agents-chrome-inventory.ts compare <captured-tree>   # diff, non-zero exit on a miss
bun scripts/agents-chrome-inventory.ts capture <debugPort> [--write <file>]
```

The parser reads the same indented accessibility-tree format the Computer Use capture writes, so both
sides stay in one vocabulary; `capture` reads the live workbench DOM over CDP for a run that needs no
human at the keyboard. The comparison reports reference controls missing from Caret as failures and
Caret-only controls as informational (Caret may legitimately offer more, per section 4). Verified
here: the reference parses to 45 controls, comparing it with itself reports nothing missing, and a
copy with `Multitask` removed reports exactly one.

## What is still open

## The dock can delete too (same day)

The plan's item 24 was the last asymmetry between the two agent surfaces. The Agents window's
session list could delete a chat — the host route and the extension path landed with patch `0010` —
while the dock in the IDE window offered Archive and nothing else.

The dock's session row menu now carries `Delete`. It posts a `delete_session` message, the extension
asks first (`Delete "<title>"? This action cannot be undone.`, a modal, because the host delete
removes the record and the transcript it wrote), and then calls the same `deleteChatSessions` the
list uses. One delete path, two front doors.

Verified in the suite rather than by eye: `bun test apps/macos/test` is 621 pass / 0 fail with a new
`ide-native-workbench.test.ts` case that pins the menu item, the parser branch, the message type and
the confirmation; `bun run typecheck` reports 0 errors; and `bun run build` puts `delete_session` and
the confirmation sentence into `dist/mac-extension/out/extension.js`, which is what a personal build
loads.

The capture half of the comparison: no packaged app was built and launched in this pass, so Caret has
no side to compare yet. That is the run that closes section 11 gate 2, and it is listed under
`notVerified` in the receipt along with the two other things that need a live window (the Agent Host
change was verified by types, the compiled module and the patch set - not by watching the window
boot).
