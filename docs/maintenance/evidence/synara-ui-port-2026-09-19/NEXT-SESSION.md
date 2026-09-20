# Caret handoff — Synara agent-window port (2026-09-19)

Read [`README.md`](README.md) in this directory first: it carries the measured facts (licence,
architecture, component inventory, the take/do-not-take boundary). This file is the navigation for
the session that starts the port. The authoritative work list stays
[`../../CEDIA-PLAN.md`](../../CEDIA-PLAN.md) §10 — items 48-51 are this workstream; nothing here
overrides them.

**Steps 0, 1a, 1b, 2, 2b, 4 and the effort control landed.** `0048` proves the Tailwind surface (the reference's entry and
token sheet vendored in `desktop/src/vs/sessions/contrib/home/browser/caretUi/`, compiled by
`scripts/synara-ui/build-css.ts` into a checked-in stylesheet scoped to `[data-caret-surface]`), and
`0049` puts the reference's own hero in the empty home: the question `What are we building in` with
the draft's project under it, in the reference's typography. `0050` re-chromes the evidence chips and
`0051` puts the reference's composer footer row (its classes and its send button) inside the home's
composer card. `0052` replaces Caret's model control with the reference's picker (its trigger, its
panel with the search field, its provider groups, its rows and their stars) over Caret's catalogue.
`0053` pins the reference's *runtime* palette and gives the home's composer card the reference's
raised-chrome recipe, so the agent window reads the reference's colours rather than the workbench's.
`0054` adds the reference's Environment panel: a title-bar control beside `IDE` and the reference's
own card, pinned to the chat column's top-right, carrying the rows this window can back. `0055`
(`0055-caret-synara-effort-control.patch`, renamed from `...-effort-chip`) puts the reasoning control
where the reference actually keeps it - the model trigger carries the chosen level as its muted
status label, and the picker panel's footer carries one `Effort … <value> ›` row that expands OMP's
ladder. The separate chip an earlier pass drew beside the model is gone with it: the reference's
composer footer renders no such control. `0022` (re-cut) turns the Agents sidebar into the
reference's: `Search` is a header icon button, the primary navigation reads `New thread` /
`Automations`, `Projects` is a header whose action is `Add project`, and Cursor's `Customize` row
and `Repositories` section are gone from this window (their commands stay registered). The receipt
is the "Step 0" to "Step 4" and "Item 49" sections of [`README.md`](README.md). **Nothing in this
workstream is open any more.** Item 49's second half closed the same day: a draft's picks reach the
session and OMP, because the draft now gets the chat session record its option store needs (see
[`README.md`](README.md), "Item 49 closed"). Step 3's second half, step 5 and the composer extras are
closed with reasons in §9, and the one rough edge the item-49 fix first left (a refused write per new
draft, before the store opens) closed with §10 item 52 the same day. Nothing here is open.

## Where things stand

- Checkout `/Users/pond/caret`, branch `main`, large uncommitted working tree. Nothing is committed
  (repository rule: commit only when asked).
- Health after the draft-pick fix, all re-run at handoff and green: `bun run test` 902 pass / 0 fail
  (99 files); `bun run typecheck` clean; `node scripts/ci-validate.mjs` CI-OK; `bun test
  apps/macos/test/desktop-patch-set.test.ts` 0 fail; `bun run check:packaged` green. The packaged app
  at `/Users/pond/caret/VSCode-darwin-arm64/Caret.app` carries patch set `b1b478a4fbc5` (52 patches,
  `0055` newest; `0010` and `0022` re-cut) and was relaunched by
  `bun scripts/launch-caret-personal.ts`; its
  left-most screen area is the home, with the reference's hero, the reference's card, the picker's
  trigger in the card's footer row, the Environment control beside `IDE` in the title bar, and the
  reference's sidebar (`Search` in the header, `New thread` / `Automations`, a `Projects` header with
  `Add project`) beside them.
- Desktop patch stack: base `ea1912fd6a05` + `0001..0055` (52 entries in
  `patches/desktop/manifest.json`). This workstream's patches: `0040` (provider-tabbed picker default
  for the agent window), `0041` (provider marks in the picker's identity heuristic), `0042` (home
  hero + composer pinned low + the composer-sizing stylesheet's import), `0043` (provider identity on
  projected rows), `0044` (no empty built-in tab), `0045` (provider read from the item's
  `modelMetadata.vendor`), `0046` (the option-picker slot in the agent window + the `Agent` mode chip
  hidden), `0047` (Caret's own picker: `caretModelPicker.ts`, its stylesheet, the
  `IModelPickerDelegate.getSessionResource/getSessionType` seam - retired again by `0052`), `0048`
  (the ported Tailwind surface: `caretUi/`, the generated stylesheet, the bundler's inline plugin),
  `0049` (the reference's hero: `caretUi/chatEmptyStateHero.tsx`, `caretUi/caretSynaraSurface.tsx`,
  and the mount in `newChatWidget.ts`), `0050` (the chips' toolbar chrome and the first two runtime
  tokens), `0051` (the reference's composer footer row and its slots), `0052` (the reference's model
  picker: `caretUi/modelPicker.tsx` over its vendored panel classes), `0053` (the runtime palette,
  the composer-surface tokens, and the home card's chrome), `0054` (the Environment panel: its
  service, the title-bar control, the vendored section/row primitives, and the host), `0055` (the
  reasoning control: the picker trigger's status label and the panel footer's `Effort` trait row,
  with the ladder resolved through the provider `get_state` names).
- `apps/macos` (extension) changes this workstream: `detail` on each registered model is now
  `"<roles> · <provider>"` (`omp-language-models.ts`), `OmpAdvertisedModel.thinking` parses OMP's
  per-model ladder (`normalizeOmpModels`), `thinkingPickerGroupForModel` publishes it as the
  `reasoning` option group, `applyDraftThinkingChoice` applies a draft's pick at session creation,
  and `modelPickerGroupFromSnapshot` publishes `modelMetadata.vendor` per item.

## What is already true in the live app (do not re-derive)

1. The agent window's home is the mark, the question `What should we build in caret?`, and a composer
   pinned low; the "Send your first prompt" starter card is gone.
2. The model control is the **reference's picker** (`0052`): a trigger in the composer footer that
   opens Caret's own in-tree panel - a `Search models` field, one group per OMP provider, one row per
   model with its star, no model counts. Its rows do not reach the accessibility tree (only the
   search field does), so read them from a screenshot. Provider inventory behind it, measured at
   `0047`'s step and unchanged since: `commandcode 71`, `cursor 119`, `google-antigravity 20`,
   `openai-codex 5`, `opencode-go 30`, `opencode-zen 10`, `openrouter 528`.
3. The `Agent` mode chip is hidden in this window, because OMP advertises no chat modes and the
   base's picker then renders its documented single-entry fallback (a control with nothing to choose,
   which §11 gate 4 forbids). OMP's plan machinery is slash-driven (`/plan`, `/vibe`, `/goal`).
4. The right panel (`Changes · Browser · Terminal · File`) is Caret's and stays exactly as it is; the
   owner asked explicitly that it not be touched.

## Known gaps, measured (each has its cause, do not re-measure from scratch)

- **The reasoning control renders; its pick is lost on a draft.** OMP advertises the ladder per model
  in `get_available_models` rows (`thinking: { efforts: [...], mode: "effort" }` — 662 of 878 rows on
  2026-09-19) and `get_state` answers with the current `thinkingLevel` beside the model, so the
  extension publishes the ladder as the `reasoning` option group and the composer draws the
  reference's `Effort` trait row from it. The chip that *never appeared* is superseded (2026-09-19,
  §9 "The reasoning control is the reference's, in the reference's place"): the row appears and
  expands OMP's levels, now that the current model's row is resolved with the provider `get_state`
  names (a bare id both `openrouter` and `commandcode` carry resolved to no row before). What is
  *not* solved: a draft's pick never reaches the extension. `provideHandleOptionsChange` logs every
  write-through as `Caret session option change: …`, and driving the picker on an untitled draft
  produces no line — for the model pick or the reasoning pick — and the trigger's status label does
  not change, because the workbench's option store needs a chat session record for the draft's
  resource (`chatSessions.contribution.ts` `updateSessionOptions`), and those options are what seed
  the session at creation (`prepareNewSession` → `getSessionOptions(draft.resource)`). Item 49
  carries it; the next move is workbench-side, not a port.
- **Permission has no control.** Patch `0033` hides the Copilot permission picker in this window on
  purpose (its `manual / allow all / autopilot` levels are Copilot's policy), and OMP exposes no
  approval level to set — it asks per tool call with its own options, which this window already
  answers. Closed as not portable; §9's "Step 5 measured" carries the reasoning.
- **Provider grouping in the picker is flat.** ~~`0047` draws a grouped list; the provider `Header`
  items did not render as headings (the list reads as one alphabetical list).~~ **Superseded
  2026-09-19** by step 2: the reference's panel renders its own group headers, and the live panel
  shows `commandcode` as a heading over its rows.
- **The Kanban and Pull requests sidebar rows have no data source** (OMP reports no board and no PR
  list through the RPC Caret uses). They stay out until one exists.

## The decision this port rests on, and what it rules out

Chosen: **take Synara's presentation layer into Caret's agent window** (its React components, its
shadcn primitives, Tailwind v4 and its tokens, scoped to that window), with Caret's adapter mapping
OMP data onto their props. Rejected: running Synara's app as the agent window — that would make their
Electron main process, server and provider adapters a second execution owner with its own database and
auth path, which `AGENTS.md` forbids. Also rejected: re-implementing their look by hand, which drifts
from upstream and costs more builds.

Open with the owner: **settled 2026-09-19, and revised the same day.** First answer: take the
reference's palette first and bind to the IDE later, which `0053` implemented (the ported tokens are
pinned at the reference's runtime values). Owner correction after seeing it: the **palette stays
Caret's own** - the same theme the IDE window uses - while the UX, UI, elements, layout, model picker
and chat-box elements come from Synara. A palette scoped to the agent window was built and then
removed (`0054` existed for under an hour and is not in the manifest), and nothing in the port
repaints this window today. What stays true from `0053`: the *composer card* wears the reference's
raised-chrome tokens, and those tokens are pinned rather than left at the reference's pre-hydration
fallback.

## The plan, one verified build per step

**Step 0 — prove the Tailwind surface. Landed 2026-09-19 (`0048`).** Vendor `apps/web/src/index.css`
(Tailwind v4 entry + token sheet) and the minimum of `components/ui` into a Caret-owned directory,
compile them into the sessions window's CSS, and mount a throwaway component inside the agent
window's React surface with the tokens scoped to that root. **Acceptance met**: the IDE shell is
byte-identical and the rest of the sessions stylesheet is too, apart from the inserted surface
block. Read the "Step 0" receipt in [`README.md`](README.md) before reusing anything from it.

**Step 1a — the hero. Landed 2026-09-19 (`0049`).** `ChatEmptyStateHero.tsx` is ported and mounted,
with the owner's copy and no brand mark. Step 0's probe and its files are gone with it.

**Step 1b — the composer row (first half landed 2026-09-19, `0050`).** The evidence chips
(`folder`, `Local`, branch) now wear the reference's chrome: `caretUi/composerChrome.ts` carries its
composer-toolbar class strings and `caretUi/themeRuntimeTokens.css` the runtime-injected tokens they
read, with the chips' React rendering through them. The `Temporary` chip has no source in Caret
(there is no temporary-thread concept), so it is omitted until one exists.

**Step 1b's second half landed 2026-09-19 (`0051`).** The reference's `ChatComposerFooter` row is
inside the home's composer card, with its own classes and its own send button (`ui/button.tsx`
vendored whole, Base UI 1.7.0 pinned to the reference's lockfile version). Caret's controls are
appended into the row's two slots, so they keep their workbench lifecycles; the base send button is
hidden. Measured live: `button (disabled) Send message` on an empty draft, `button Send message`
after a keystroke.

**Step 1 is done. Step 2 - the picker - is next, and its first attempt was reverted with a measured
blocker.** A full slice landed and then came back out on 2026-09-19: the reference's picker
primitives were vendored (`composerPickerStyles.ts`, `composerPickerSize.ts`, `ui/menu.tsx`,
`ui/switch.tsx`, `ui/input.tsx`, `ui/collapsible.tsx`, `modelStarButton.tsx`, the panel CSS from
`index.css` 2761-2895, plus small stubs for `nativeSurfaceOcclusion` and `disclosureMotion`), the
trigger was mounted in the footer with Caret's catalogue behind it, and the panel rendered its
search field, provider groups and model rows from that catalogue. **It was reverted because the
panel never painted**: Base UI's menu is portalled and, in this window, a portalled menu is
reachable through the accessibility tree while nothing appears on screen.

**The measurement, so the next attempt starts from it.**

- A portalled menu (Base UI's default `document.body`) shows in the AX tree
  (`text field (settable) Search models`, `container commandcode`, the model rows) and never appears
  in a window screenshot.
- Portalling into the workbench element instead (`Menu.Portal container`) changes nothing, and an
  inline positioner without a portal throws `Base UI error #32`.
- The control that proves the capture is honest: **Caret's own workspace picker**, an in-tree
  overlay, paints in the same screenshot.

So the next attempt should keep Base UI for behaviour but stop asking it to place the panel: render
the menu through `Menu.Portal` into the composer's own widget element **and** pass
`positionMethod="absolute"` to the positioner, so the panel is laid out inside the workbench tree
where the workbench paints its own overlays (the vendored `MenuPopupBase` needs both props
forwarded). If that still does not paint, the fallback is the workbench's action-widget host, which
is what Caret's own pickers use, with the reference's panel markup inside it.

Two further facts to carry into step 2:

- **The row takes Controls as DOM slots, not React.** `mountCaretSynaraComposerFooter` returns the
  `leadingSlot` and `actionsSlot` elements and `newChatInput.ts` appends its containers into them.
  The reference's `composerPickerControls` prop is where its own picker would go: when step 2 ports
  `ComposerModelPicker`, it should be rendered *by* the footer (React) and Caret's `0047` action
  item retired, rather than a third slot.
- **Their icons cannot travel** (`lib/icons.tsx` resolves central-icon SVGs from a Vite public path).
  The chips keep codicons at the reference's sizes and the send glyph is the reference's own
  `arrow-up.svg` drawn inline. The picker's icons need the same treatment until the icon set is
  served from the app, which is its own step.

Also outstanding from this row: the in-session composer still uses the base row, because the ported
footer does not render the stop state a running turn needs.

**Step 2 — the picker. Landed 2026-09-19 (`0052`).** `caretUi/modelPicker.tsx` composes the
reference's trigger, panel, option rows and star over Caret's catalogue (one group per provider, the
star on the base's pinned-model store), with the panel placed in-tree because Base UI's portalled
menu never paints in this window. The reasoning ladder it was meant to carry did not land with it -
that stays item 49 of the plan. Read the "Step 2" receipt in [`README.md`](README.md) before
touching the panel.

**Step 2b — the reference's palette. Landed 2026-09-19 (`0053`).** The runtime token layer is pinned
whole (`caretUi/themeRuntimeTokens.css`, 37 names), the reference's raised-chrome tokens are vendored
(`caretUi/composerSurfaceTokens.css`), and the home's composer card wears them
(`contrib/chat/browser/media/caretComposerSurface.css`). The compiled stylesheet's token rules now
also match `[data-caret-tokens]`, which the home column sets, so Caret's own chrome around the
composer reads the reference's colours without handing the column Tailwind's preflight.

**Step 3 (first half) — the Environment panel. Landed 2026-09-19 (`0054`).** The reference's
`EnvironmentPanel` is mounted as it is upstream: an overlay pinned to the chat column's top-right,
toggled from a title-bar control beside `IDE`. Its card, motion, title row and section/row primitives
are the reference's (`caretUi/environmentRow.tsx`, `caretUi/environmentPanelStyles.ts`,
`caretUi/environmentPanel.tsx`); its rows are the ones this window has state for - `Changes`,
`Local`, the branch, `Repository`, `Editor` -> `Open in IDE`. Read the "Step 3" receipt in
[`README.md`](README.md): it lists what is deliberately left out (`Commit & push`, `Local Servers`,
`Usage`, and the sections with no Caret source) so the next session does not re-derive it.

**Step 3 (second half) — the composer's environment picker and the `+` extras panel. Closed
2026-09-19 without porting them.** Measured: the extras panel's five rows have exactly one Caret
source - attachments, which the footer's `+` already does in one click - while the app-window list,
the goal insert, the plan/debug modes and fast mode have none at all. Porting it would put a menu in
front of a single action, so it stays out until a second row has a source. The environment picker's
rows (local / worktree / remote) map onto the chips `0050` already re-chromed. See §9's "Step 3
closed" entry.

## Step 4 — the sidebar. Landed 2026-09-19 (`0022`, re-cut)

**The sidebar is the reference's.** Its chrome was already close (Caret's rows 30px against the
reference's 28px, the same radius, the same 12px label), so the difference was **content**. The
reference's own source, read at `3333343` on 2026-09-19 (`apps/web/src/components/Sidebar.tsx`,
`sidebarNavOrdering.ts`, `sidebarRowStyles.ts`, `SidebarIconButton.tsx`) measures it like this - the
middle column is what Caret drew before the step, which is **Cursor's** agent window, the *IDE*
window's reference (§3.5 of the plan), not Synara's:

| Reference (Synara) | Caret before | Caret now |
|---|---|---|
| Header row: a surface picker plus `Search` and an activity bell as **icon buttons** (`SidebarIconButton size="header"` = `size-6 rounded-md`), not full-width rows | `New Chat` / `Search` / `Automations` / `Customize` as rows, with no header row at all | `Search` as a header icon button in a 24px box; the surface picker and bell have no counterpart here |
| Primary nav block (`SidebarGroup px-1.5 pt-1 pb-1.5`, rows `gap-0.5`): `New thread`, `Kanban`, `Pull requests`, `Automations` - 28px `SIDEBAR_HEADER_ROW_CLASS_NAME` rows with `px-2 py-0.5` | `New Chat`, `Search`, `Automations`, `Customize`, 30px rows | `New thread`, `Automations`; 28px rows with 8px/2px padding in the reference's `4px 6px 6px` block |
| `Projects` section header (`h-7`, 12px normal-weight muted label) with an overlay toolbar: collapse/expand all, a sort menu, `Add project` | `Projects` header, bold label, `+` | `Projects` header, normal-weight muted label, `Add project`; the sort menu and expand/collapse-all are not drawn |
| Projects with their threads nested under each project row (`pl-8`, 13px), a `Pinned` block, an optional `Chats` section | `Repositories` filter/add section, then a flat session list | `Repositories` and its filter are gone; the project/thread tree below the header is the sessions view's own groups, unchanged |
| Footer: a `Settings` row with a gear plus a help menu | `Customize` as a primary nav row | neither is drawn |

`Kanban` and `Pull requests` stay out for want of a source (OMP reports no board and no PR list
through the RPC Caret uses). Cursor's `Customize` row and `Repositories` section were removed rather
than kept to be safe: the reference has neither, and neither command was unregistered - the IDE
window keeps its Customizations view and both stay reachable from the command palette, so a row went
rather than a feature, and the parity test pins their absence. The plan's §9 entry ("The Agents
window's sidebar is the reference's") carries the receipt; the screenshot is
[`step4-sidebar-light.png`](step4-sidebar-light.png).

**Step 5 — permission. Closed 2026-09-19 as not portable.** OMP exposes no approval level to set: it
asks per tool call with its own option list (`allow_once` / `allow_always` / `reject_once` /
`reject_always`), and this window already answers those (`apps/host/src/service.ts` 511,
`apps/macos/src/approval-view.ts`). A chip here would be either a new auto-answer capability or a
control with nothing behind it. See §9's "Step 5 measured" entry.

**Item 49's effort control — closed 2026-09-19.** The rendering half landed with `0055` (the picker
trigger's status label and the panel footer's `Effort` row, its levels expanding in place), and the
persistence half closed later the same day:

- the extension publishes the ladder through `provideChatSessionProviderOptions`
  (`apps/macos/src/chat-sessions.ts`), resolving the current row with the provider `get_state` names,
  and stamps the group with the model it belongs to (`detail: caret-omp/<row id>`);
- the composer (`newChatInput.ts`) draws the reference's status label and trait row when the group's
  model is the model it is showing, and writes a pick through `setSessionOption`;
- that write had nowhere to land: the workbench's option store refuses every write for a resource it
  has no chat session record for, and nothing in this window ever resolved a session for a Caret
  draft. `prepareNewSession`'s `getSessionOptions(draft.resource)` — which is what seeds the session
  at creation — was therefore always `undefined`, and the model pick was refused and reverted.
  **Fix:** `extensionSessionsProvider.createNewSession` resolves the draft's session (`0010`), which
  opens the store. No host session is created: Caret's content provider answers a draft resource with
  an empty shell.

Verified live on patch set `b1b478a4fbc5`: the extension log carries
`Caret session option change: caret.omp:///untitled-684f71a5-… reasoning=high`, the trigger and the
panel footer show the level (`DeepSeek V4.1 Flash High`, `Effort  High  ›`), and OMP's own transcript
for the session that draft became records `model_change cursor/claude-4.6-opus-high` and
`thinking_level_change high`. The check sent one real turn (`hi`), because only a created session
produces that host record; `README.md`'s "Item 49 closed" carries the full receipt, including the
race the first fix left (the composer's very first write, before the store existed) and its own fix:
the provider now keeps the readiness promise and retries that write, so a fresh draft logs no
`model selection was not accepted` line and its store ends up agreeing with the model the window
shows.

**Step 3 — environment + extras.** Landed as far as this window can back it: `0054` is the
Environment sheet (Changes · Local · branch · Repository · Editor), and the composer's environment
picker and `+` extras panel are closed with reasons (§9, "Step 3 closed": the extras panel's five
rows have exactly one Caret source and it is already one click in the footer).

**Step 4 — sidebar.** Landed 2026-09-19: the header's `Search` icon button, `New thread` /
`Automations` as the primary navigation, the `Projects` header with `Add project`, and Cursor's
`Customize` / `Repositories` rows gone. Kanban and Pull requests stay out until a real source
exists; the reference's `Pinned` / `Chats` blocks, its section sort menu and its footer `Settings`
row are not drawn either.

**Step 5 — permission.** Closed as not portable (§9, "Step 5 measured"): OMP has no approval level
to set, and this window already answers its per-tool-call requests.

## Mechanics that will save the next session time

- **The ported surface's stylesheet has its own build.** `bun scripts/synara-ui/build-css.ts` compiles
  `caretUi/synaraTailwind.css` with the Tailwind CLI (installed at the repository root in
  `devDependencies`) and rewrites every selector to sit under `[data-caret-surface]`; `--check`
  compares without writing. Add a component by copying it in, rewriting only its import specifiers,
  listing that in `caretUi/VENDORED.md`, and re-running the script; the Tailwind CLI sees only the
  `.tsx` files in that directory (`@source`), never the repository around it.
- **Build loop**: desktop changes need `cd desktop && npx gulp vscode-darwin-arm64-min` (2.9-9.5 min,
  varies), then `CARET_HOST_NODE=~/.caret-tools/node-v24.18.0-darwin-arm64/bin/node bun run package:mac`,
  `bun run check:packaged`, then relaunch with `bun scripts/launch-caret-personal.ts`. Extension-only
  changes (`apps/macos`) need only the package step — do those separately, they cost ~20 seconds.
- **Typecheck before building** — the gulp min build does not typecheck the workbench:
  `cd desktop && npx tsc -p src/tsconfig.json --noEmit` (~30 s; needs `npx tsc` from `desktop`).
- **Patch generation**: `.patch` files carry real tabs and the manifest pins each digest. Generate a
  patch by diffing the *pre-state that the manifest order produces*, not the live checkout:
  `scripts/prepare-desktop.ts` and `apps/macos/test/desktop-patch-set.test.ts` both build a scratch
  tree from the base revision and apply patches in order, and the test then requires the result to be
  byte-identical to the checkout. A patch generated against the live tree inherits earlier patches'
  hunks and fails that test. New files need a `new file mode` section (`git add -N <path>`,
  `git diff -- <path>`, then `git reset -q -- <path>`).
- **Write the patch before the final build.** `bun run check:packaged` compares each shell's mtime
  with the newest patch file's, so a patch written after the last
  `npx gulp vscode-darwin-arm64-min` fails the freshness check, and the honest fix is another full
  build rather than touching timestamps. `0048` was generated first and built afterwards.
- **A later patch cannot modify a file an earlier patch creates** (the earlier patch's reverse-check
  breaks). Re-cut the owning patch instead, as `0023` was re-cut twice this week.
- **Every port step changes a file an earlier step created, so every port step re-cuts that patch.**
  The generated `caretUi/media/caretSynaraUi.css` and `caretUi/VENDORED.md` are created by `0048`,
  and each step's components and provenance rows change both; `0049` re-cut `0042` as well, because
  the stand-in hero it introduced is gone. Order that works: make the edits, regenerate the owning
  patch(es) against their own pre-states, update the manifest digests, then build - the shells must be
  newer than the newest patch, so a patch written after the last build costs another full build.
- **Two patches on one file need staging.** `0042`, `0049` and `0048` all touch
  `newChatWidget.ts`, so the later patch's diff must be taken against the tree with the earlier
  patch applied and the later one *not* applied. The generator has to be handed the right pre-state;
  diffing the live file for both folds the later change into the earlier patch.
- **Re-cutting a patch that both adds a file and modifies a shared one needs its add-file sections
  only.** `mk-patch.mjs` regenerates a whole patch from a list of created and modified paths, so it
  cannot re-cut a patch whose *modified* half is also touched by later patches: the diff against its
  pre-state folds those later changes in. When the change is only to a file that patch *creates*
  (`0022`'s navigation and stylesheet, `0052`'s picker, `0010`'s provider, `0051`'s footer files),
  splice in a fresh `git diff -- <path>` section for that path and leave every other section alone -
  which is what this workstream's re-cuts did. `bun test
  apps/macos/test/desktop-patch-set.test.ts` is the only thing that proves a spliced patch still
  applies in manifest order and lands on the checkout, so run it before building.
- **Verify live, always**: `@oai/sky` through `mcp__node_repl__js` reads the window's accessibility tree
  and screenshots it (`sky.get_app_state({ app: 'Caret', disableDiff: true })`). The AX tree cannot see
  composer text; click by element index from the fresh tree, never a stale one.

## Traps worth keeping

- **Tailwind's automatic source detection is off for this surface, on purpose.** With a plain
  `@import "tailwindcss"` Tailwind scans the working directory (minus `.gitignore`) for candidate
  class names, and this repository contains the desktop patch that *quotes the compiled stylesheet* —
  so the artifact fed itself new candidates and stopped matching itself the moment the patch landed
  (measured: 36,738 → 40,041 bytes, and the freshness test failed only in the full suite, where the
  patch file was present). The entry is `@import "tailwindcss" source(none)` plus one explicit
  `@source`. Do not remove it to "match upstream more closely".
- **The bundler inlines bare imports from the vendored surface, and their transitive dependencies.**
  `build/next/index.ts`'s `inlineCaretUiPlugin` resolves by importer: a bare specifier is inlined when
  a `caretUi/**` file or a file already inlined from the repository root's `node_modules` imports it.
  `packages: 'external'` also leaves the `require()` calls *inside* a dependency's own CommonJS alone,
  which shows up as `Dynamic require of "clsx" is not supported` at window load and nothing at build
  time (`class-variance-authority` requires `clsx`). When adding a dependency, no plugin change is
  needed — but the failed load is silent unless you launch the app with `--enable-logging` and read
  the console lines, which is the fastest way to diagnose a blank Agents window.
- The workbench document requires TrustedHTML: never set `innerHTML` in a workbench file (a throw
  there takes the whole view down, measured 2026-09-19 on the home hero).
- `chat.experimentalModelPicker` has an `agentsWindow: { default: true }` override from `0040`; the
  agent-window picker no longer depends on it (`0047` draws its own), so the override can be removed
  when something else needs the base's tabbed picker off — the base's own config chip, for instance.
- The option-group store is keyed by the content provider's type (`caret` vs `caret.omp`) and, for a
  pristine draft, may hold nothing at all: read the model list the composer already has, and treat the
  option groups as optional extras.
- `bun run check:packaged` fails on an app repackaged before the newest patch: repackage rather than
  reverting anything.
- The owner's reference screenshots live in the conversation, not the repository; the measured
  inventory in `README.md` is the durable copy of what they show.
