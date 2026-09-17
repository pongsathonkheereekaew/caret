# Caret desktop defaults

Base: `ea1912fd6a05b80a56b2ad9b955075211deea521` (retained Caret Code-OSS fork).

`manifest.json` lists every patch and its digest; `scripts/prepare-desktop.ts`
verifies the base revision and each digest before applying.

`0001-caret-startup-defaults.patch` changes only initial settings: disable upstream
AI surfaces, start without the VS Code welcome editor, and disable experimental
Copilot onboarding. These remain settings, not policy overrides. The Caret task
extension supplies the shell, including a non-executing Restricted Mode surface.
Workspace trust enforcement remains enabled.

`0002-caret-agents-window-menus.patch` drops Selection, Go, Run and Terminal from
the menu bar while the `caret.agentsWindow` context key is set. The reference
agent window shows Cursor/File/Edit/View/Window/Help, and the pinned Code-OSS
already uses the same mechanism to hide Run in its own sessions window. The key
is set by the Caret extension when the window shows the Agents shell
(`CARET_AGENTS_WINDOW_CONTEXT` in `apps/macos/src/workbench-mode.ts`), so the IDE
window keeps the editor menus. `apps/macos/test/ide-native-workbench.test.ts`
pins the key, the patch text, and the manifest digest together.

**Retired.** The base Agents window registers its own menu set now, so hiding
editor menus by context key is no longer needed: the patch file and its manifest
entry are gone, and the context key it depended on was removed with it.

`0003-caret-agents-window-proposals.patch` is Caret's product identity for the
Agents window: it allows the built-in `caret.caret` extension to use the proposed
`chatSessionsProvider`, `chatParticipantPrivate` and `defaultChatParticipant`
APIs, and it removes the Copilot product identity —
`defaultChatAgent` (the key that made the sessions window run Copilot's
welcome/sign-in flow), the Copilot entries in `trustedExtensionAuthAccess`, and
`GitHub.copilot-chat` from `builtInExtensionsEnabledWithAutoUpdates`. After this
patch `product.json` contains no Copilot references. It is a prerequisite for
`docs/maintenance/CARET-PLAN.md` step S1 and has no effect until the
next Code-OSS build. The 0002 menu patch is scheduled for retirement in that same
plan: the base Agents window registers its own menu set, so hiding editor menus by
context key stops being necessary once the Agents window is the real surface.

`defaultChatParticipant` is the half of that identity that keeps the window
sendable. The base's `ChatServiceImpl.sendRequest` refuses every request that has
no *default* agent for its location, because upstream that agent is Copilot
Chat's participant; a session type's own agent does not satisfy it (the base
registers those with `isDefault: false`), and this fork ships no Copilot
participant to be the fallback. With `defaultChatAgent` gone the window therefore
had no sender at all: every composer send ended as
`sendRequest No default agent for location panel` and never reached Caret's
provider. The proposal is what lets `caret.caret` declare its own participant
`isDefault`, which is the honest owner of that role here — Caret is the only
harness this build runs. `apps/macos/package.json` carries the declaration and
`apps/macos/src/chat-sessions.ts` implements the participant handler that runs the
turn, so both halves are pinned to this allowlist entry.

`chatProvider` is the other half: the extension host hands a chat request a
`vscode.ChatRequest` with a language model attached and refuses to build one for
an extension that has no models of its own, so Caret registers OMP's advertised
catalogue as vendor `caret-omp` (`apps/macos/src/omp-language-models.ts`). Three
pieces have to agree for that model to be resolvable, and all three live in this
patch stack: `0010` declares the vendor descriptor (an undeclared vendor is
rejected with `Chat model provider uses UNKNOWN vendor`), `0010` and `0011`
prefix their picker identifiers with that vendor, because the extension host
derives `<vendor>/<model id>` and resolves the request by exactly that string,
and the extension strips the prefix again before writing the bare OMP id to
`set_model`. The vendor literal is duplicated on both sides of the extension
boundary (the workbench cannot import from `apps/macos`), so
`apps/macos/test/ide-native-workbench.test.ts` pins the extension's
`CARET_OMP_MODEL_VENDOR` against the text of both patches.

`0004-caret-agents-entry.patch` is the drift that used to live only in the
checkout: it routes the workbench "Open Agents" action to the Caret extension
instead of the base Agents window. It exists so the tree has no unreviewed
modification. Step S1 of `docs/maintenance/CARET-PLAN.md` inverts
this patch (route to `workbench.action.openAgentsWindow` and delete the comment
that calls that window Copilot's) once the Copilot harness is gone and the Caret
provider serves the window.

**Retired.** Step S1 landed: `workbench.action.openAgentsWindow` is the route
again, so the patch file and its manifest entry are gone.

`0005-caret-remove-copilot-sessions.patch` stops the sessions workbench (the
Agents window) from loading the Copilot chat session provider in both the desktop
and web entry points. After this patch nothing imports
`copilotChatSessions.contribution.js`, so the window no longer offers
`Session Type: Copilot`; Caret's own provider is the only session source once
step S2 lands. The Copilot harness directories are still on disk at this step —
removing the registration before deleting the code keeps every intermediate tree
buildable.

`0006-caret-unwire-agent-harnesses.patch` removes the agent-harness registrations
themselves: no Copilot/Claude/Codex provider is registered in `agentHostMain` or
`agentHostServerMain`, `providerConfigurations` is empty, and the Copilot BYOK
proxy, Claude/Codex proxy services, pending-edit content provider and the Copilot
API service wiring in `agentHostServices`/`agentHostBootstrap` are gone. Verified
with `npm run typecheck-client` (0 errors) and the import resolver check. The
harness directories are still on disk; deleting them (and the sessions pickers
that import the Copilot pickers) is step S1b.

`0007-caret-drop-harness-pickers.patch` removes the last production references to
the Copilot harness: the Copilot-schema picker family is gone (mode, permission,
approval, agent pickers plus their mobile variants), `sessionPluginBundler.ts`
declares the discovery shape it used to import from the Copilot module, and the
remote-agent-host contribution no longer loads the deleted picker.

Patch files `0008`-`0015` are the plan's S1-S4 work; their intent is recorded in
the evidence receipts under `docs/maintenance/evidence/` rather than here.

`0016-caret-agents-window-cursor-chrome.patch` closes three S4 rows from section 3
of `docs/maintenance/CARET-PLAN.md`, all inside the Agents window:
the sidebar pane no longer renders a "Sessions" title the reference does not have
(the element stays as the flex spacer the header actions and find widget use); the
`Run` split button and its permanently disabled `Run Task is not available…`
placeholder leave `Menus.TitleBarCenterRight` (the command stays in the palette
and on F5); and the Agents-window model picker finally reports
`isSessionsWindow: true`, without which the core picker treated an empty catalog
as a Copilot sign-in gate and the chip read "Models, sign in to use Copilot". The
patch touches only `src/vs/sessions/**`, and `apps/macos/test/ide-native-workbench.test.ts`
pins its content and digest against `manifest.json`.

`0017-caret-agents-app-panel-chrome.patch` gives the right-hand app panel the names
section 3.2 uses: the single-pane editor-title controls become Enter Full Screen /
Exit Full Screen / Hide Apps, the empty-group toolbar's close action becomes Hide
Apps, and `browser/media/workbench.css` hides the editor watermark for this window
only (the reference panel has none). The CSS targets the watermark element rather
than its wrapper because the wrapper also hosts the panel's own toolbar.

`0018-caret-agents-composer-voice-copy.patch` renames the composer microphone to
`Start voice input`, the reference's name for that control. The localize id is
unchanged, so the dictation wiring and hover copy are unaffected.

`0019-caret-customize-in-sidebar.patch` is the one Caret patch that edits
`src/vs/workbench/**`, so it is deliberately a single configuration default:
`chat.agentSessions.customizationEntryPoints` goes from `product.quality !== 'stable'`
to `false`. That setting's own description is the choice between the new-session
composer and the Agents Window sidebar; section 3 of the plan lists `Customize` in
the sidebar, so Caret selects the sidebar placement. Every consumer of the setting
lives under `src/vs/sessions/**`, so the IDE window is untouched. It is recorded in
`docs/maintenance/evidence/s4-customize-sidebar-2026-09-14/`.

`0020-caret-agents-pet-unmounted.patch` stops the chat pet from being mounted at
all in the Agents window while the easter egg is off. Registering a pet host is
what creates the pet (its DOM, listeners, timers and accessibility nodes), and the
coordinator only parks an already-created pet on unregister, so the three sessions
call sites are gated on `sessions.developerJoy.enabled` instead: `chatView.ts` ANDs
the setting into the host-preference observable, `newChatInput.ts` registers from an
autorun that tracks the setting, and `newChatWidget.ts` only mounts the aquarium
toggle while it is on. No core chat file is touched, so the IDE window keeps its own
pet behaviour.

`0021-caret-agent-home-utility.patch` is the Agent Home visual sprint, and it now
carries the Apps panel's behaviour too. The empty home used to be a bare editor
group - a blank canvas with `Add Tab` and a close control at roughly 40% of the
window. This patch puts the reference's right utility area there instead: a Caret
`EditorPane`/`EditorInput` pair draws the panel's single strip and, beneath it, the
four app tiles of the reference (Review, Browser, Terminal, File). The strip entry and
`+` share one path, so no entry opens its surface somewhere else in the window. All
four are panes of this panel: Browser and Terminal are hosted by the panel itself -
`ITerminalService.createTerminal` plus `ITerminalInstance.attachToElement` put a real
terminal in this pane, **one tab per instance**, and never reveal the bottom panel -
while Changes and Files are the window's two single-instance panes, whose content the
panel hosts from the base's own surfaces (`ChangesViewPane` in a `PaneView`; the Files
empty state and Search Files of `EmptyFileEditor`). They were editor-group tabs before,
which is why the strip could not switch to them in place. The file tree itself stays
the base's Files view: `IExplorerService.registerView()` keeps one `view` slot, so a
second explorer inside the panel would take it over from the window's own.
`+` is the reference's `Open new tab menu` - it picks Review / Browser / Terminal /
File - and Browser is hosted here too: the pane resolves an
`IBrowserViewModel` itself and pushes the overlay bounds from the tab's own
container on every layout (`model.layout`, `model.setVisible`), so the page is
fitted to the pane instead of spilling past it. The tab carries its own address bar
(back / forward / reload / address), so opening Browser is usable immediately.
`+` opens that same list as a context menu anchored to the button. The tab state and
the instances live in a window-scoped singleton (`appsPanelModel.ts`), not in the
pane: the pane attaches their DOM while it is on screen and detaches it when it goes
away, so a pane the layout closes and re-creates does not take the tabs with it.
The strip also carries a `Toggle Pinned Summary` control that reads the real active
session from `ISessionsService.activeSession`. Because the
panel draws the pane's only strip, the host group's title strip is suppressed while
the panel is the editor that group shows - two strips put the group's tabs
(Browser) one row above the panel's tabs (a terminal), which is the misalignment
this replaces. A `caret.agentHome.showApps` action supplies the `Show Apps` half the
base lacks, so a browser or file tab is not a dead end. It is a command only: it was
also a title-bar icon until 2026-09-16, when the packaged app showed it did nothing -
it can only close the panel while the Apps editor is the active editor, and the
editor it would "open" is already in the group - and the reference's own control is
`Hide Apps` in the panel header, not a title-bar icon. The same contribution sizes
the three columns to the reference profile (sidebar 255px, utility 22.5% of the
window - `0022` replaces the fixed 255px sidebar with the reference's 15.625% share)
and re-applies that share only when the container *size* changes, the CSS narrows
the composer to the reference's 608px centred card, and the instance containers
reuse the upstream `terminal-overflow-guard`/`terminal-editor` classes so the
wrapper and xterm are sized by the terminal contribution's own CSS. Everything is
Sessions-window scoped.

`0022-caret-agent-home-chrome-navigation.patch` continues that sprint on the window
chrome and the sidebar. The `SessionsTitleBarContribution` is no longer mounted, so
the wide `Show Sessions` pill leaves the middle of the Agents Window title bar (that
contribution is only loaded by the Sessions workbench, so the IDE never had it). The
sidebar gains the reference navigation: full-width `New Chat`, `Search`,
`Automations` and `Customize` rows, a `Projects` section, a `Repositories` section
built from the open workspace folders - with a `New Project` row and a repository
filter whose toggle reveals an input that hides the rows that do not match. The
sidebar ends there, because the reference capture does: an earlier draft also had a
`Getting Started` card and a local profile row with Settings, and both were dropped
once the real reference screenshot arrived and the user chose it over the brief.
Every row runs an existing command
(`workbench.action.sessions.newChat`, `sessionsViewPane.find`,
`sessions.customView.automations`, `sessions.customization.overview`,
`workbench.action.files.openFolder`, `workbench.action.openSettings`). The base
sidebar header (the small New Chat pill plus filter/find icons) and the detached
`Customizations` footer are removed from the DOM, and the column shares become the
reference proportions so the sidebar and utility dividers land where the reference
capture measures them - sidebar 15.625% and utility 22.51% of the window, i.e. 320
and 1587 of the reference's 2048 captured pixels. It is five files: three new
(`agentHomeNav.ts`, `agentHomeNav.contribution.ts`, `media/agentHomeNav.css`) and
the two registration/entry files the chrome changes live in
(`contrib/sessions/browser/sessions.contribution.ts`, `sessions.desktop.main.ts`).
Its stylesheet also owns the "no second strip" rule for the Caret Apps panel (see
`0021`): the group's title strip is hidden while that panel is the shown editor, so
the panel's own strip is the only one in the pane.

`0023-caret-agent-home-composer-starters.patch` gives the empty Agent Home the
starter rows the reference shows under the composer. Caret already owns that surface:
`INewSessionComposer` renders prompt options and inserts the chosen prompt into the
input with its placeholder selected. In the base those rows only appear from the
`sessions.onboarding.newSessionViewV3` onboarding tour, which sits behind a Copilot
experiment flag and a "no recent sessions" trigger, so the Agents Window never showed
them; this attaches the controller directly. The three starters are the base's own
localized strings (implement a feature, fix a bug, fix CI), exported from the file
that already owned them rather than copied, and the stylesheet also takes the card to
the reference's 104px height and puts the starters below the card as one line each.
Nothing under `src/vs/workbench/**`.

`0024-caret-agent-home-context-row.patch` adds the two chips the reference puts beside
the Agent Home workspace picker. The branch chip reads
`session.workspace.folders[0].gitRepository.branchName` - the same value the base's own
session actions read - and clicking it runs the base's real
`sessionsViewPane.agentHost.copySessionBranchName` command, so the chip copies the
branch rather than implying a selection Caret cannot make; no chip is rendered when
there is no branch. The runtime chip reads "This Mac" only while no remote agent host is
connected, which is the truthful reading of the single execution target Caret offers,
and it is a label rather than a button because there is no target picker to open. The
composer rebuilds the picker row on state changes, so the chips are re-rendered from a
guarded MutationObserver as well as from the session autorun. Nothing under
`src/vs/workbench/**`.

`0025-caret-agents-titlebar-regions.patch` places the Agents window title bar controls
where the reference has them: session navigation after the sidebar toggle in the left
section, and the "IDE" button before the panel and side-panel toggles in the right
section. `titlebarPart.ts` mounts the navigation and Open-in-VS-Code toolbars into the
left and right sections, and `titlebarpart.css` orders them (sidebar toggle 1 then
navigation 2; IDE 1, session actions 2, right layout 3). Both files are the same
decision, and the mount half had been sitting uncommitted in the desktop checkout with
no patch covering it - the only two uncovered files in a scan of all dirty sessions
files - so this patch also makes the placement reproducible from the stack.

`0026-caret-agents-no-bottom-panel.patch` removes the Agents window's bottom panel.
The window's terminal is a tab in the Apps panel on the right, so the bottom part was
leftover chrome that the panel toggle (cmd+J) could still open as an empty strip with
Output and Terminal in it. The workbench keeps the part in its layout bookkeeping -
every other call site still resolves - but `_effectiveVisible` never reports the panel
as visible, `setPanelHidden` refuses to show it, and a saved "visible" is not restored
on load. Building the window, opening a terminal from the Apps panel and pressing
cmd+J all leave the panel at height 0.

`0027-caret-agents-open-new-tab-menu.patch` renames the editor group's `+` in the
Agents window to the reference's wording. `editorTabsControl.ts` reads its label from
the active context key, so the patch adds `IsSessionsWindowContext` to the condition
that picks between `Add Tab` and `Open new tab menu`: the Agents window shows the
reference's label, the IDE keeps upstream's. It is a separate patch rather than part
of `0021` because it edits a base file, not a file `0021` creates - the case that
forced the earlier `0027` to be folded in was the opposite one.

`0028-caret-inline-react-in-client-bundles.patch` inlines React into the workbench
client bundles. The Apps panel's strip, tab row and empty-state cards are React
(`0021`), and the workbench renderer is a browser ESM context that cannot resolve a
bare specifier at runtime, while this build leaves every `node_modules` import
external. Without the plugin the whole Agents window fails to load with
`Failed to resolve module specifier "react"`. The plugin mirrors the treatment
`minimist` already gets for the bootstrap bundles and is applied to both bundle
branches; `process.env.NODE_ENV` is substituted at build time because the inlined
CommonJS branches on it and a renderer has no `process`.

Both `0021` and `0028` were re-cut on 2026-09-15 from the working tree, because the
checkout had drifted past what the patches said: `agentHomeUtilityEditor.ts` had
moved on (the strip entries open an instance of their own), the Agents window's
context-menu surface was added to `agentHomeUtility.css`, and the React inlining
existed only in the checkout. `bun scripts/prepare-desktop.ts` was red until then,
because a patch that does not match the tree cannot pass its own reverse-check.

`0029-caret-agents-no-account-widget.patch` takes the account control out of the
Agents window's title bar. The sessions workbench registers an account/status action
into `Menus.TitleBarRightLayout` and draws it with its own view item, but Caret has
no account to show there: the window is fed by the local host, which is authenticated
by the descriptor it publishes, and no sign-in provider ships with this fork. What
the control could draw was a Copilot-flavoured "signed out" avatar, which the user
read as a Copilot login that had not been removed. The `when` clause is a false
expression, so the declaration and its view item stay reachable for the type checker
and for the base's own wiring while the control never appears. Scoped to
`src/vs/sessions/contrib/accountMenu/`, which only the Agents window loads.

`0031-caret-agents-no-remote-connections.patch` takes the neighbouring control out
of the same row. The sessions workbench appends an "Allow Remote Connections"
toggle (`Codicon.radioTower`) into `Menus.TitleBarRightLayout` and draws it with a
view item; the command behind it starts a GitHub-authenticated dev tunnel, and this
fork ships no GitHub sign-in, so the control could only open a flow it cannot
finish. Its `when` is a false expression for the same reason as `0029`: the
declaration and its view item stay reachable for the type checker and the base's
wiring while the control never appears. It edits a base file that no earlier patch
touches, so it stands alone rather than folding into `0029`.

`0032-caret-no-base-agent-host.patch` is Caret's whole answer to the base Agent Host, in
two halves. Both are needed: stopping the prewarm alone left the client in place, so any
surface that asked that host for work still started the process.

1. **The prewarm stops.** The utility process exists to host the Copilot/Claude/Codex
   harnesses, and S1 removed that layer - but the process's node-side graph still requires
   Copilot services that no longer exist (`agentHostCustomizationEnablementService depends
   on copilotApiService which is NOT registered`), so a process started at restore dies on
   boot, `AgentHostProcessManager` restarts it five times and the window shows "The Agent
   Host failed to start". `AgentHostPrewarmContribution` no longer starts it, and the
   base's own suite for that contribution pins the Caret contract ("does not start the
   agent host while enabled").
2. **The client is the base's null implementation.** `NullAgentHostService` already
   exists for browser contexts where no local host is available; the desktop DI shim now
   returns it for the local branch, with a Caret reason
   (`Caret ships no agent host: OMP is the only harness this build runs.`) instead of the
   browser-worded default. The remote branch is untouched for a window attached to a
   remote authority. Every call into it now throws that one sentence, which is the honest
   reading of this build: the harness layer it would host is removed, and OMP is the only
   execution owner.

Three base files, none touched by an earlier patch: the workbench service that carries the
shim and the prewarm contribution, its test, and `NullAgentHostService` itself (the reason
becomes a constructor argument, and the module-private `notSupported` const becomes a
protected method so a caller's build can name itself). Booting the process instead would
mean restoring Copilot services across `agentHostServices.ts`, `agentBranchNameGenerator.ts`
and the changeset handlers, which is the layer the plan removes rather than re-adds.

`0033-caret-agents-no-copilot-composer-controls.patch` closes three of the plan's chrome
decisions in the Agents window, all by scoping a base chat control out of that window with
`IsSessionsWindowContext.toNegated()` (the IDE window keeps every one of them):

- `chatToolActions.ts` - `Configure Tools...` configures the base's tool set for the default
  agent, and the window runs on OMP, which owns its tools end to end; offering it would promise
  a setting nothing reads.
- `chatExecuteActions.ts` - the permission picker's levels (manual / allow all / autopilot) are
  the Copilot permission model, while this window's approvals come from OMP.
- `chatModeActions.ts` - `Configure Custom Agents...` opens a Copilot-chat surface that does not
  exist here; the gate applies to both the menu entry and the action's precondition, so the
  command palette entry is disabled rather than dead.

The fourth decision (the sidebar's empty `Chats` group) is a setting, not a patch: the
extension writes `sessions.list.showEmptyDefaultGroups: false` into the Agents window's own
workspace file beside the theme keys.

`0034-caret-drop-agent-workbench-shell.patch` is one hunk: it drops the
`./contrib/agentWorkbench/electron-sandbox/agentWorkbench.contribution.js` import from
`src/vs/workbench/workbench.common.main.ts`. Everything that import loaded lives in
`src/vs/workbench/contrib/agentWorkbench/`, which is a `removals` entry below, so the patch and the
removal are one change in two files.

Why it exists: that island was Caret's earliest shell scaffold, and by the time this landed its only
live effect was two command-palette entries. `caret.openAgentsWindow` ran a mode service and then
opened the view id `caretComposer` - the extension webview shell that the native Agents window
replaced - so the palette offered a second route to a retired surface beside the base's own
`workbench.action.openAgentsWindow`. `caret.openIde` recorded the same mode flag and told the user
they were already in the IDE. Nothing read that flag: the context key `caretWorkbenchShell` appears
in no `when` clause in the tree, and `getLastShellState()` had no caller. Opening the Agents surface
is now one route (`caret.showAgents` in the extension). See the plan's §6.2 ledger.

## Removals

`manifest.json` also carries a `removals` list: whole trees and files Caret does
not ship (the `copilot`/`claude`/`codex` harness directories, the agent-host test
tree, the Copilot chat-session provider, the picker files above, and Caret's own
retired `src/vs/workbench/contrib/agentWorkbench/` island). They are
deleted by `prepare-desktop.ts` instead of living in a multi-megabyte deletion
patch, so the list stays reviewable and every path is still tracked. Restoring the
pinned checkout and re-running `bun scripts/prepare-desktop.ts` reproduces the
Copilot-free tree; that state passes `npm run typecheck-client` with 0 errors.

Not yet removed: 15 Copilot-named helper files that are not part of the harness
(`copilotCliConfig`, `copilotHome`, `copilotManagedSettings`, `copilotToolIds`,
slash-command and prompt-syntax compat helpers). They register nothing and gate
nothing; they are naming/identity debt for a later S1 follow-up.

Run `bun scripts/prepare-desktop.ts` before the pinned Code-OSS package task;
`bun scripts/build-caret.ts --portable --desktop` also applies this patch and the
tracked Caret extension/icon overlay. The script verifies base and patch digest,
accepts an already-applied patch, and refuses a conflicting checkout.

Then build `vscode-darwin-arm64-min` from `desktop` with the installed Node 24
runtime, followed by `CARET_HOST_NODE=/absolute/path/to/node bun run package:mac`.
The latter replaces the generated Caret extension, copies the packager's filtered
Tree-sitter WASM assets to their real filesystem lookup path, and locally ad-hoc
signs the app. This is not Developer ID signing or notarization.
