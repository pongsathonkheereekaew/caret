# Adopting the Synara agent-window UI in Caret (2026-09-19)

The owner's request, verbatim in effect: build the open-source Caret fork so the **agent window looks
and behaves exactly like Synara**, while the **IDE window keeps Cursor parity** and the **OMP harness
stays the only execution and transcript owner**. This directory holds the measurements that decision
rests on, the boundary it must not cross, and the receipts of each ported element. Nothing has been
ported yet; this file records the ground truth that makes the first port safe to start.

## The source project, measured

`https://github.com/Emanuele-web04/synara`, cloned at commit
`33333439c4b9c74d0097bc01196cccc921f67cf3` ("Restore browser sizing and refine composer panel
controls", 2026-09-17).

**Licence: MIT** — `LICENSE` carries `Copyright (c) 2026 T3 Tools Inc.` and `Copyright (c) 2026
Emanuele Di Pietro`; `README.md:157` states "Synara is licensed under the MIT License"; there is no
`NOTICE` file and the licence text has no additional clauses. Reuse therefore requires only that the
copyright and permission notice travel with the copied code.

**Architecture** (Turborepo + Bun workspaces):

| Layer | Path | What it is |
|---|---|---|
| Desktop shell | `apps/desktop` | Electron main process; starts a backend process and supervises it (`backendStartup*.ts`, `backendShutdown*`) |
| Renderer | `apps/web` | React + Vite UI. `src/components/chat` holds 287 files, `src/components/ui` 46 shadcn primitives |
| Backend | `apps/server`, `apps/cli` | Their own server, SQLite through Effect |
| Contracts | `packages/contracts`, `packages/shared` | Cross-process schemas; provider adapters own provider protocol behaviour |

**UI stack**: React, **Tailwind CSS v4** (`@tailwindcss/vite`, `src/index.css` is
`@import "tailwindcss"`), shadcn/ui (`components.json`, 46 primitives under `components/ui`),
`class-variance-authority` + `tailwind-merge` behind a `cn()` helper (`~/lib/utils`), and their own
design tokens (`--background`, `--foreground`, `--muted-foreground`, `--ring`, `--app-sidebar-surface`,
`--app-composer-picker-surface`, `--app-font-size-ui-lg`, …). Component imports use the `~/` alias.

**The components the owner asked for**, with their measured size:

| Element | File | Lines |
|---|---|---|
| Empty-state mark + question | `components/chat/ChatEmptyStateHero.tsx` | 23 |
| Composer bottom row (`+`, permission, model, effort, voice, send) | `components/chat/ChatComposerFooter.tsx` | 322 |
| Provider-first picker (two columns) | `components/chat/ProviderModelPicker.tsx` | 612 |
| Model picker + rows + tabs + trait rows | `components/chat/ComposerModelPicker.tsx` (+ `Row` 158, `Tabs` 124, `TraitRows` 220) | 535 |
| Star toggle per row | `components/chat/ModelStarButton.tsx` | 40 |
| Environment picker | `components/chat/ComposerEnvironmentPicker.tsx` | 171 |
| Effort card | `components/chat/ComposerEffortSliderCard.tsx` | 193 |
| Extras trigger + panel, picker popup | `components/chat/ComposerExtrasTrigger.tsx` 34 · `ComposerExtrasPanel.tsx` 383 · `ComposerPickerMenuPopup.tsx` 105 | — |

## The boundary this port must respect

`AGENTS.md` and `docs/maintenance/CEDIA-PLAN.md` fix the ownership rules for this repository: OMP is
the sole agent execution and transcript owner, provider authentication boundaries are preserved, and
Cursor 3.20.x remains the primary UI/UX and architecture reference for the IDE window. The port is
therefore scoped as **presentation only**:

**Taken from Synara**
- `apps/web/src/components/chat/**` — the composer, picker, environment, effort, hero and their
  helper modules that are pure presentation.
- `apps/web/src/components/ui/**` — the shadcn primitives those components compose.
- The Tailwind v4 setup and the token sheet those components read, scoped to the agent window's root.

**Not taken**
- `apps/desktop` (its Electron main process and backend supervision), `apps/server`, `apps/cli`.
- `packages/contracts`, `packages/shared`, and any provider adapter or session store. Taking those
  would create a second execution owner, a second database and a second provider-auth path, which is
  exactly what this repository forbids.
- Anything for the IDE window: Synara has no IDE window, so the Code-OSS editor window keeps its
  Cursor-derived look and behaviour.

**Caret owns the seam**: a thin adapter module maps OMP's own answers — catalogue (with the provider
on each row), the per-model reasoning ladder (`thinking.efforts`), sessions, workspace and branch —
onto the props Synara's components expect. Their files stay as close to upstream as possible so a
future re-sync is a diff, not a rewrite; upstream commit `3333343` is the base for that diff, and each
ported file keeps the MIT notice plus a note naming this directory.

## State at handoff

**Updated 2026-09-19, after steps 0-2b.** The reference's presentation layer is in the repository and
running: the Tailwind surface and its token layers (`desktop/src/vs/sessions/contrib/home/browser/
caretUi/`), the empty-state hero, the evidence chips, the composer footer row, the model picker, and
the composer card's chrome - patches `0048` to `0053`. What remains is the environment sheet and the
composer extras (step 3), the sidebar (step 4) and permission (step 5); items 48-51 of the plan
carry it, and the per-step receipts below carry the measurements.

The work that precedes this directory landed in the sibling receipt
([`../agents-home-hero-and-provider-marks-2026-09-18/`](../agents-home-hero-and-provider-marks-2026-09-18/README.md)):
the markup's hero, the composer pinned low, the starter card removed, the meaningless `Agent` mode
chip hidden, and `0047` - Caret's own model picker, since retired by `0052` in favour of the
reference's.

## Receipts

Each ported element lands as its own build with a live screenshot in the sibling receipt directory and
its own entry in `docs/maintenance/CEDIA-PLAN.md` §9. This file grows as those land; the handoff notes
for the next session are in [`NEXT-SESSION.md`](NEXT-SESSION.md).

### Step 0 - the Tailwind surface is proven (2026-09-19)

**Landed.** `0048-caret-synara-ui-surface.patch` takes the reference's Tailwind v4 entry and token
sheet into `caretUi/`, compiles them into the sessions window's stylesheet with every selector
scoped to `[data-caret-surface]`, and mounts a throwaway probe in the empty Agent Home that renders
three vendored primitives (`Skeleton`, `Kbd`, `Empty`) plus the token sheet under that root.
Screenshots: [`step0-scoped-tailwind-probe-light.png`](step0-scoped-tailwind-probe-light.png) and
[`step0-scoped-tailwind-probe-dark.png`](step0-scoped-tailwind-probe-dark.png) - the probe card sits
at the top-right of the composer column in both workbench themes, above the untouched hero and
composer, and the readback through the accessibility tree is `text Synara surface ⌘K tokens scoped`,
`text Empty`, `text Ported primitive`.

**The three things the step had to settle, and what settled them.**

- *Tailwind reaches the sessions bundle.* The reference's `apps/web/src/index.css` (lines 5-77 and
  381-535) is vendored as `caretUi/synaraTailwind.css`; `scripts/synara-ui/build-css.ts` runs the
  Tailwind CLI over it, scanning the vendored `.tsx` through an explicit `@source`, and checks in
  the result. The artifact is 29,886 bytes and carries the theme layer, the mapped palette, the
  token sheet and the utilities the ported components use. The one edit to the reference's entry is
  `@import "tailwindcss" source(none)`: automatic source detection scans the working directory, and
  that directory contains the desktop patch which quotes this very artifact, so the compiled output
  fed itself new candidates on every regeneration - measured as an artifact that grew from 36,738
  to 40,041 bytes and stopped matching itself the moment the patch landed.
- *The tokens scope to a root, not to the document.* Tailwind's own entry cannot ship unscoped: its
  preflight resets `*`, `html`, `h1`-`h6`, `a`, `ul` and every form control, which in this window
  would restyle the Code-OSS chrome. The build script therefore rewrites every selector to sit
  under `[data-caret-surface]` (`:root`/`:host` become that element itself, so the token sheet lands
  on the surface root) and prefixes the keyframe names it emits, because the workbench already
  defines `@keyframes pulse`. A guard fails the build if any rule escapes.
- *A vendored component renders under the workbench's React.* The workbench inlines React 18
  (`0028`); the ported components import `class-variance-authority` and `tailwind-merge` by name,
  which the renderer cannot resolve, so `0048` extends the build's inline plugin. The rule is the
  importer rather than a package list - a bare specifier is inlined when a vendored file or an
  already-inlined root-`node_modules` file imports it - because `packages: 'external'` also leaves
  the `require()` calls inside a dependency's own CommonJS alone, which cost one build:
  `Dynamic require of "clsx" is not supported`, measured at window load.

**The acceptance, measured rather than argued.** The same tree was built twice, once with the
surface's import and once without: `sessions.desktop.main.css` differs only by a 25,476-byte
insertion, the 458 bytes of legal comments the bundler hoists to the end of the file, and one blank
line before the sourcemap comment - the rest of the 1.8 MB stylesheet is byte-identical. The IDE
window is untouched by construction and by artifact: `workbench.desktop.main.js` is byte-identical
to the shell that shipped before this change, and `data-caret-surface` appears 0 times in
`workbench.desktop.main.css` and `.js`. Nothing in the workbench reads a `--tw-*` variable, so the
compiled `@property` registrations are inert for it, and the artifact carries no `@font-face`.

`bun test apps/macos/test/synara-ui-css.test.ts` (4 assertions) recompiles the sources and fails if
the checked-in artifact drifts, if any rule escapes the surface, if a keyframe name is left global,
or if the attribute the React root sets and the one the stylesheet scopes by ever diverge.

**Not verified.** The reference's own per-component stylesheets are not vendored yet - each one
travels with the component that needs it, in the step that ports it, so the ported look so far is
the primitives and the token sheet, not Synara's composition. `--color-text-*` and the other tokens
the reference's runtime theme injects resolve to their fallbacks here, because nothing writes them;
that is the theme-runtime question the decision log still holds open.

### Step 1a - the reference's own hero (2026-09-19)

**Landed.** `0049-caret-synara-hero.patch` puts the reference's `ChatEmptyStateHero` where Caret's
hand-built stand-in was: `caretUi/chatEmptyStateHero.tsx` keeps upstream's element tree and classes
and drops only the brand mark, `caretUi/caretSynaraSurface.tsx` owns the React root and the
`[data-caret-surface]` attribute, and `newChatWidget.ts` mounts it into the home's column and
pushes it the draft's project name. The copy is the owner's:

```
        What are we building in          <- reference typography, text-2xl semibold, foreground/90
              cedia                      <- the workspace picker's selection, text-lg muted/40
```

Screenshot: [`step1a-hero-dark.png`](step1a-hero-dark.png), read back through the accessibility
tree as `heading What are we building in` / `text cedia`. That build was the dark workbench theme;
the surface's light half is the same token sheet the step 0 probe rendered in light
([`step0-scoped-tailwind-probe-light.png`](step0-scoped-tailwind-probe-light.png)), switched by the
same `dark` class.

**Decisions this step took, from the owner's answers.** The reference's own colour tokens stay
scoped to the ported surface and are not mapped onto the workbench palette yet (so the hero uses
Synara's `--foreground`/`--muted-foreground`, not `--vscode-*`, and follows the workbench's
light/dark switch through the surface's `dark` class). The brand is the copy: the reference's logo
is not taken, and the word "synara" appears nowhere in the window. `0042` was re-cut by this step -
its stand-in mark and heading, and the CSS rules that sized them, are gone; what stays is the
anchor stylesheet that gives the home's first flex item its place above the composer.

**Where the project name comes from, and the wrong turn.** `INewSessionComposerService` has one
`activeComposer` slot, set by whichever composer registered last; a standalone workbench
contribution reading it rendered the hero with no project name at all (`dbg composer=yes obs=yes
value=undefined`, read from the window's accessibility tree). The seam now runs the other way: the
widget that renders the home owns the mount, builds the name from its own workspace picker
(`onDidChangeSelection` -> `basename(selectedFolderUri)`), and pushes it into the mounted surface.

**Acceptance, re-measured for this build.** The IDE window's `workbench.desktop.main.js` is
identical to the previous build's after removing every numeric literal; the only differences are
NLS message indices, which shift by one because the removed stand-in string left the program. The
sessions stylesheet keeps the step 0 property: the same tree built without the surface's import is
byte-identical outside the inserted block.

### Step 1b (part) - the evidence chips (2026-09-19)

**Landed.** `0050-caret-synara-composer-chips.patch` takes the reference's composer-toolbar class
strings (`caretUi/composerChrome.ts`, from its `composerPickerStyles.ts`) and the two
runtime-injected tokens those classes read (`caretUi/themeRuntimeTokens.css`, valued from the
reference's own derivation), and Caret's branch and runtime chips now render with them: the chips
above the card are the reference's `h-8 … sm:h-7` capsule triggers with its ui-sm typography, its
muted-on-hover fill and its `this Mac`-in-one-capsule shape instead of Caret's own chip stylesheet.
Screenshot: [`step1b-evidence-chips.png`](step1b-evidence-chips.png) - `cedia · Caret · This Mac`,
read back through the accessibility tree as `container Runs on this Mac` / `text This Mac`.

**Three things this step had to settle.**

- *Their chips' classes need their second token layer.* The reference's `--color-text-foreground` and
  `--color-text-foreground-secondary` are not in its stylesheet; its runtime writes them from the
  active chrome theme. `themeRuntimeTokens.css` pins the two names, at the values its derivation
  produces for the default theme, and lists the derivation sites so the next component's token is a
  one-line addition.
- *Their icons cannot travel.* `lib/icons.tsx` renders `centralIconWrapper` SVGs resolved from a Vite
  public path the workbench has no equivalent for, so the chips keep Caret's codicons at the
  reference's sizes. Recorded in `VENDORED.md` as its own step.
- *The runtime chip was being hidden by a wrong condition.* `0024`'s model read "runs here" as
  `!hasRemoteTarget && (session === undefined || session.providerId === 'local-agent-host')`, and the
  second half is false for a draft served by the extension's own session provider - the ordinary
  case, so the chip disappeared as soon as a draft was registered (measured: `session=caret-extension-sessions
  remote=false local=false`, so the row read `cedia · Caret` alone). It is now `!hasRemoteTarget`,
  which is what the chip actually claims.

`0048` and `0024` were re-cut for this step: the artifact and `VENDORED.md` are theirs, and the chips'
React lives in the file `0024` creates.

### Step 1b (rest) - the composer footer row (2026-09-19)

**Landed.** `0051-caret-synara-composer-footer.patch` puts the reference's `ChatComposerFooter` row
inside the Agent Home's composer card. React owns the row: its classes, its layout, and its send
button (`ui/button.tsx`, vendored whole, with the reference's `prominent`/`icon-xs` circle and its
spinner). Caret's own controls are appended into the row's two slot elements - the attach `+` into
the leading slot, and the config toolbar (the model picker for now), the dictation/voice controls
and the loading spinner into the picker-controls slot ahead of the send button - so they keep their
workbench action lifecycles rather than being re-created as React. The base send button is hidden in
this composer, because the ported one is the visible control.

Screenshot: [`step1b-composer-footer.png`](step1b-composer-footer.png) - the card's row reads
`+` on the left and `DeepSeek V4.1 Flash · mic · (send)` on the right, the send button in the
reference's enabled state.

**What was measured live.** The button's own state follows Caret's: read back through the
accessibility tree as `button (disabled) Send message` on an empty draft, and `button Send message`
after a single keystroke landed in the composer (then `cmd+z` restored the empty draft). The click
path is the widget's own `submit()` - the same method the base button's click handler calls - so a
click was deliberately not exercised: sending starts a real OMP turn.

**Deviations this step took, all in the vendored file's header.** Four upstream branches are dropped
because Caret has no source for the state behind them: the interaction-mode chip and its reset (OMP's
plan/debug machinery is slash-driven), the sidebar action, the plan-follow-up menu, and the
pending-user-input / voice-recorder twins (Caret's voice control is its own action item and rides in
the picker slot). `onSubmit` replaces upstream's `<form>` submit, because this composer is not a
form. `ui/button.tsx` carries one type change: upstream's `interface ButtonProps extends
useRender.ComponentProps<"button">` resolves without the element's own props under the workbench's
type checker, so the same members are spelled as an intersection.

**Not taken yet.** The in-session composer keeps the base row, because the ported footer does not
render the stop state a running turn needs; that is the next slice of this row. The reference's own
icons are still not served (the send glyph is its `arrow-up.svg` drawn inline).

### Step 2 attempt - measured, then reverted (2026-09-19)

**Not landed.** The picker's primitives were vendored and its trigger, search field, provider groups
and model rows rendered from Caret's own catalogue - and the panel never painted, so the whole slice
came back out rather than ship a model control whose menu is invisible.

The measurement, kept because it decides the next design:

- Portal-led Base UI menus are in the accessibility tree and not on screen. With the menu open the
  window's AX tree reads `text field (settable) Search models`, `container commandcode`, and one
  `menu-radio-item` per model, while every screenshot of the same moment shows only the composer.
- The portal target is not the cause: the popup was first portalled to `document.body` (Base UI's
  default) and then to the workbench element by `Menu.Portal container`, with the same result.
- Rendering the positioner inline (no portal) is unsupported: `Base UI error #32`, and the home
  stopped rendering.
- Caret's own workspace picker - an in-tree overlay - paints in the very same screenshots, so the
  capture is not the thing that is wrong.

What the work was, so it can be redone quickly: `caretUi/composerPickerStyles.ts`,
`composerPickerSize.ts`, `ui/menu.tsx`, `ui/switch.tsx`, `ui/input.tsx`, `ui/collapsible.tsx`,
`modelStarButton.tsx`, the reference's panel CSS (`index.css` lines 2761-2895) and two small stubs
(`nativeSurfaceOcclusion`, `disclosureMotion`); plus `modelPicker.tsx`, a Caret composition of the
reference's trigger, popup shell, radio rows and star over Caret's catalogue (grouped by the
provider each row's `detail` carries, stars from the workbench's pinned-model store, selection
through the picker service). The next attempt should keep all of that and change only how the panel
is placed: `Menu.Portal` into the composer's widget element with `positionMethod="absolute"`, or the
workbench's action-widget host with the reference's markup inside it.

### Step 2 - the reference's picker (2026-09-19)

**Landed (`0052`).** The reverted slice above came back with one change and one deletion. The change
is how the panel is placed: it is no longer a Base UI portal at all. The panel is Caret's own
absolutely positioned element inside the composer's footer row, carrying the reference's panel,
option and label classes plus the `data-slot` attributes its stylesheet keys off - the way the
workbench paints its own overlays. The deletion is the smaller surface that came with it: `ui/menu.tsx`,
`ui/switch.tsx`, `ui/collapsible.tsx` and the two stubs (`nativeSurfaceOcclusion`,
`disclosureMotion`) are not needed once Base UI no longer owns placement, so `0052` ships
`composerPickerStyles.ts`, `composerPickerSize.ts`, `surfaceStyles.ts`, `ui/input.tsx`,
`modelStarButton.tsx`, `modelPicker.tsx` and the reference's panel geometry
(`composerPickerPanel.css`, from `index.css` 2761-2895) instead.

One level down it also retires `0047`: Caret's own action-widget picker (`caretModelPicker.ts`) is
deleted, and the reference's trigger is rendered *by* the ported footer through its
`composerPickerControls` slot rather than appended beside it. `rg caretModelPicker` is 0.

Measured live (patch set `35298d1f6dd8`, 49 patches, relaunched personal build):

| What | Value |
|---|---|
| Panel's own surface | `--app-composer-picker-surface` over `--popover` (runtime), i.e. `rgb(30, 30, 30)` at 70 % |
| Rows | Not in the AX tree. `sky.get_app_state` shows only `text field (settable) Search models`; the rows, the `commandcode` group heading and the per-row stars are read from the screenshot |
| Draft's pick | Trigger read `DeepSeek V4 Flash`; after clicking the `Claude Fable 5` row it read `Claude Fable 5`; clicking `DeepSeek V4 Flash` restored it |
| Star glyphs | Present per row, drawn from the vendored `modelStarButton.tsx` |

Traps that cost this step its first attempt, restated so they are not rediscovered: a portalled menu
here is in the AX tree and invisible on screen (`document.body` and the workbench element as the
portal target both, positioner z-index raised); an inline Base UI positioner throws
`Base UI error #32` and takes the home with it; and the card must not clip the panel, which is why
`caretComposerFooter.css` sets `overflow: visible` on the home's card and bottom row.

### Step 2b - the reference's palette, and Caret's own composer card (2026-09-19)

**Landed (`0053`), by the owner's decision: the reference's colours first, the workbench palette
later.** Two layers were involved, and only the first was already in the tree.

1. **The vendored token sheet is the reference's pre-hydration paint, not its palette.** The values
   it actually renders with are written at runtime by `theme/theme.logic.ts` from the active chrome
   theme. `caretUi/themeRuntimeTokens.css` now pins that layer - 37 names, both variants - computed
   from that derivation for `DEFAULT_CHROME_THEME_BY_VARIANT` rather than eyeballed. Two of its steps
   are worth knowing: `normalizeContrastStrength(0, variant)` is **negative** (the curve anchors
   above zero: `0/100 + (0 - 60)/60 * 0.7 = -0.7` for dark, `-0.525` for light), so
   `--color-text-foreground-secondary` is `0.58`, not `0.65`; and `--background` is the theme's
   "surface under" (`#161616` dark), which is *not* `--color-background-surface` (`#181818`), the
   value the chat column, the sidebar and `--card` are painted with.
2. **The composer card is the workbench's element, not a vendored one**, so it needed a bridge.
   `caretUi/composerSurfaceTokens.css` vendors the reference's raised-chrome family verbatim
   (`--surface-border` and its strength knob, `--composer-stacked-border`, `--composer-radius`, the
   `--composer-glass-*` trio), and `contrib/chat/browser/media/caretComposerSurface.css` applies the
   reference's own recipe to `.new-chat-input-area`: 1.2rem radius, `--surface-border` outline, the
   55 % glass fill, both shadow variants, and the blur on a `::before` (a `backdrop-filter` on the
   card itself would make it a containing block for the picker panel anchored inside it). The base's
   focus ring is kept, on the reference's `--app-composer-focus-border`.

The palette reaches that card through a **second root**. The compiler now emits the token rules
(everything it produces for `:root`/`:host`) under `[data-caret-tokens]` as well as
`[data-caret-surface]`, and `newChatWidget.ts` sets the new attribute on the home column. That split
exists because the surface stylesheet also carries Tailwind's preflight: widening
`[data-caret-surface]` to the column would reset every workbench element inside it
(`box-sizing`, margins, borders, fonts). `apps/macos/test/synara-ui-css.test.ts` now asserts both
roots, and that nothing but a token or an inherited-text default is scoped to the token root.

Measured from the screenshot (patch set `792af80a88b4`, 50 patches, relaunched personal build). The
chat column reads `#191a1d` in both builds, so the deltas below are the card's own:

| What | Before (`0052`) | After (`0053`) | Expected |
|---|---|---|---|
| Card fill | `#202122` (the workbench theme's `agentsChatInput.background`) | `#1c1c1e` | `color-mix(--popover 55%, transparent)` over `#191a1d` = `#1c1c1d` |
| Card outline | `#333536` (the workbench theme's `agentsChatInput.border`) | `rgba(255, 255, 255, 0.04)` | `--surface-border` = `--color-border-heavy` at 55 % |
| Corner radius | `--vscode-cornerRadius-large` (8 px: the straight edge is reached 2-3 rows down) | ~19 px: the straight edge is reached 12 rows down | `--composer-radius: 1.2rem` = 19.2 px |
| Picker panel surface | the vendored fallback `#101010` | `#1d1d1d` | `color-mix(--popover 70%)` over `#191a1d` = `#1c1c1d` |
| In-session composer card | `#202123` | `#202123` (unchanged) | scoped out on purpose: that composer keeps the base's card until its own step |

Read back through the accessibility tree in the same run: `heading What are we building in` /
`text cedia` / `text Plan, Build, / for skills, @ for context` / `button (disabled) Send message`,
and the footer trigger's `button Change model`.

### Step 3 (first half) - the Environment panel (2026-09-19)

**Landed (`0054`).** The reference's `EnvironmentPanel` is the second surface the port takes whole
after the composer: a card pinned to the chat column's top-right, toggled from a control in the
window's top bar. Three pieces, each with a job:

- `contrib/home/browser/caretEnvironmentPanelService.ts` holds the open state. It has to be a
  service because the reference's own panel receives `open` from its chat view, while here the
  control is a title-bar action and the card is a DOM host - neither can see the other.
- `contrib/home/browser/caretEnvironmentPanel.contribution.ts` mounts the card into
  `.sessions-chat-widget` (the chat column) and fills it from `ISessionsService`,
  `IAgentHostConnectionsService`, `IAppsPanelModel` and the command service. It also registers the
  top-bar action (`Menus.TitleBarCenterRight`, order 6, so it sits beside `IDE`), whose pressed
  state comes from a context key the host keeps in step with the service.
- `caretUi/environmentRow.tsx`, `caretUi/environmentPanelStyles.ts` and
  `caretUi/environmentPanel.tsx` are the presentation: the first two vendored from the reference's
  `components/chat/environment/` (`EnvironmentRow`, `EnvironmentRowBody`, `EnvironmentPanelTitle`,
  `EnvironmentSectionDivider`, `EnvironmentLabeledSection`, and the four label constants), the third
  Caret's composition of the card - overlay wrapper, `ENVIRONMENT_PANEL_SURFACE_CLASS_NAME` with
  `ENVIRONMENT_PANEL_MOTION_CLASS`, the title row, the `p-1.5` content column.

Two deviations are recorded in `caretUi/VENDORED.md`: the reference's `EnvironmentCollapsibleSection`
is not taken (it needs `ui/collapsible`, which lands with the section that uses it), and the title
row carries no trailing control (upstream's is a gear that navigates to its settings page).

**What it shows, and what it does not.** Live rows: `Changes` (creates the Apps panel's Changes pane,
then reveals the panel that owns it), `Local` (this Mac, or the connected remote host), the session's
branch (copies it), `Repository` (the draft's folder, with its path as the tooltip) and `Editor` ->
`Open in IDE`. Left out because this window has no source: `Commit & push` and `Local Servers` (the
git extension's actions and the host's terminals are not reachable from the renderer), `Usage`, and
the reference's Recap / Pinned / Pull requests / Sidechats / Automations / Studio outputs sections.
A row without an action renders as text, not as a button, so nothing looks like a control with
nothing behind it.

Measured live (patch set `661275570093`, 51 patches, relaunched personal build), light theme: the
top bar reads `toggle button Environment` immediately before `button IDE (⇧⌘A)`; opening it paints
`text Environment` / `button Changes` / `text Local` / `text Repository` / `text cedia` /
`text Editor` / `button Open in IDE`; pressing `Changes` selects the Apps panel's own pane
(`toggle button Description: Changes, Value: 1`, `tab (selected) Description: Changes`). The card
itself is the vendored surface - `rounded-2xl`, the raised-chrome border, `bg-popover` - so it
follows whatever palette the window is using.

Receipt: [`step3-environment-panel-light.png`](step3-environment-panel-light.png).

Trap worth keeping: this build's first cold start rendered the composer's model control as
`No models available`. That is the catalogue boot race item 2 of the plan's section 10 already
records - relaunching the same build loaded the catalogue in full and the trigger read
`DeepSeek V4 Flash` - so it is not a regression from this step, and it is written here so the next
session does not chase it.

### Item 49 - the reasoning control lands where the reference actually keeps it (2026-09-19)

`0055-caret-synara-effort-control.patch` (renamed from `...-effort-chip`), with `0048`, `0051` and
`0052` re-cut. The composer's control row is the reference's row now, which took removing something
the earlier attempt had added.

**The reference has no effort control beside the model.** Its composer footer renders
`contextMeter`, the model picker, voice and the submit button (`ChatComposerFooter.tsx`), and the
reasoning level lives in two places of the picker's own tree: the trigger carries it as its muted
`statusLabel` (`ComposerModelMenuTrigger.tsx`), and the panel's footer carries one
`<Trait> … <value> ›` row per control the model exposes (`ComposerModelPickerTraitRows.tsx`, the
`TraitRow` whose `Effort` options are the ladder). `effortChip.tsx` - a separate chip in the
composer row - was therefore not the reference's shape and is gone, along with the footer's `effort`
slot; the same `<Trait>` row replaces it.

**What the panel does now** (`caretUi/modelPicker.tsx`, re-cut into `0052`): the trigger draws the
chosen level where the reference draws it and carries the reference's own `aria-label`
`Change model and reasoning`; the panel's footer is the trait row, which expands the ladder inline
under itself (upstream's `MenuSub` popup is portalled, the same measured reason the panel is
in-tree); and the search matches a row's name, its id and its provider, which is the set
`buildProviderTabRows` matches. `0055` is the workbench wiring: the level the group publishes is
the chip's selection, the group arrives after the composer is built so the footer re-reads its
groups when they land, and the control is drawn only when the group's model is the model the
composer is showing.

**The ladder is resolved with the provider `get_state` names.** Before this step the extension asked
`ompModelRowForPick(snapshot, snapshot.selectedModelId)` for the current model and got nothing,
because `deepseek/deepseek-v4.1-flash` is advertised by both `openrouter` and `commandcode` and a
bare id is not a model (`rowsNamingPick`'s own rule). The measured line was
`selected='deepseek/deepseek-v4.1-flash' row=none ladder=none`. `currentModelFromOmpState` now keeps
`data.model.provider` (and the `thinkingLevel` beside it), `projectOmpModelSnapshot` uses it as the
tie-break, and the snapshot carries `selectedModelProvider` / `selectedThinkingLevel`. With the same
device the line reads `reasoning for 'commandcode:deepseek/deepseek-v4.1-flash' -> none` - the row
resolves, and *that row* advertises no ladder - and with a model that has one,
`reasoning for 'cursor:claude-4.6-opus-high' -> minimal/low/medium/high`.

**Measured live** (patch set after `0055`, `npx gulp vscode-darwin-arm64-min` 11 min under load,
then `bun run package:mac`; `bun run check:packaged` green; app relaunched with
`bun scripts/launch-caret-personal.ts`). The composer's trigger reads back as
`button Change model and reasoning`. With the host running `cursor/claude-4.6-opus-high` and the
draft showing the same model, the trigger reads `Claude Opus 4.6 1M Reasoning ⌄`, and opening it
paints the panel's footer as `Effort            Reasoning  ›`; pressing that row expands
`Minimal / Low / Medium / High` - OMP's ladder for that model, in the reference's own row shape.
Receipts: [`item49-effort-trait-row-light.png`](item49-effort-trait-row-light.png) and
[`item49-effort-levels-light.png`](item49-effort-levels-light.png).

**The measurement state, and how it was set.** This machine's host runs
`commandcode/deepseek/deepseek-v4.1-flash`, which advertises no ladder, so the control is honestly
absent for it - the reference draws neither a status label nor a trait row for such a model either.
To photograph the positive case the probe session's model was set to a ladder model through the
host's own API (the descriptor is written to `~/Library/Application Support/Caret/host/host.json`:
`POST /v1/sessions/<id>/commands` with `set_model`), and it was set back afterwards, so the last
launch of this session publishes `-> none` again. The draft's remembered model also changed while
the picker was being driven (clicking rows is what one does to a picker) and was left as the picker
left it.

**What is still open, measured here and left to item 49.** A draft's pick does not reach the
extension. `provideHandleOptionsChange` now logs every write-through it receives
(`Caret session option change: <resource> <optionId>=<value>`), and while the picker was driven on
an untitled draft the line never appeared - for the model pick (measured again, matching the note in
`extensionSessionsProvider`, "until a chat has run the picker treats its model as display-only") nor
for the reasoning pick - and choosing `High` left the trigger's status label unchanged, so the
workbench's option store did not keep it either. That store is keyed by a chat session record
(`chatSessions.contribution.ts` `updateSessionOptions` returns early when `_sessions` has none for
the resolved resource), and the rows a draft's options seed at creation come from exactly that store
(`extensionSessionsProvider.prepareNewSession` passes
`initialSessionOptions: getSessionOptions(draft.resource)`), so the missing piece is the draft's
record, not this control's wiring. That is the same gap section 10's item 5 records for the model
pick; the persistence half of item 49 stays open on it, and the next session starts from
`Caret session option change:` (absent = the workbench dropped the write).

### Step 4 - the sidebar is the reference's (2026-09-19)

`0022-caret-agent-home-chrome-navigation.patch`, re-cut: its four created files
(`agentHomeNav.ts`, `agentHomeNavReact.ts`, its contribution and its stylesheet) now carry the
reference's sidebar. The distinction that made this step necessary is worth stating, because the
plan says two different things about "the sidebar" and both are right about different windows:
[§3.5](../../CEDIA-PLAN.md) locked the sidebar IA from a **Cursor** capture
(`New Chat` / `Search` / `Automations` / `Customize`, a `Projects` heading, a `Repositories` heading
ending in filter buttons) because §3 is the *IDE window's* Cursor-parity contract. The Agents
window's reference is Synara, and its sidebar is a different animal.

**Measured from the reference's own source** (`apps/web/src/components/Sidebar.tsx`,
`sidebarNavOrdering.ts`, `sidebarRowStyles.ts`, `SidebarIconButton.tsx` at `3333343`):

- the header row (`flex items-center gap-1 pt-0 pb-1 pr-2.5 pl-1.5`) holds a surface picker, a
  `Search` **icon button** (`SidebarIconButton size="header"` = `size-6 rounded-md`) and an activity
  bell - `Search` is not a full-width row;
- the primary navigation block (`SidebarGroup px-1.5 pt-1 pb-1.5`, rows `gap-0.5`) is
  `New thread` / `Kanban` / `Pull requests` / `Automations`, each row `SIDEBAR_HEADER_ROW_CLASS_NAME`
  = `min-h/h-[1.75rem]` (28px) with `px-2 py-0.5` in a `rounded-md` box;
- `Projects` is a section header (`h-7`, `SIDEBAR_SECTION_LABEL_CLASS_NAME`: 12px, normal weight,
  muted) whose toolbar hangs off the right (expand/collapse all, a sort menu, `Add project`);
- there is no `Customize` row and no `Repositories` section anywhere in it: its project list *is*
  the repository list.

**What landed.** `agentHomeNav.ts` now publishes `headerActions: [Search]`, rows
`New thread` / `Automations`, and one `Projects` section whose trailing action is `Add project`
(`caret.project.add`); `agentHomeNavReact.ts` renders the header row as
`.caret-agent-home-nav-header` with a `.caret-agent-home-nav-header-action` button per action, and
the section model lost `entries` / `filter` / `filterEmpty` (nothing in the reference's IA produces
them); `agentHomeNav.css` takes the reference's geometry - header row padding and the 24px header
button box, 28px rows with 8px/2px padding, the group's `4px 6px 6px` block padding, a 20px section
action (`SidebarIconButton`'s `md` slot), and a normal-weight muted section label instead of a bold
one. The `Repositories` filter and its `hidden`-attribute plumbing are gone with the section.

**Removed from this window, and why that is not a capability loss.** Cursor's `Customize` row and
`Repositories` section run `OPEN_CUSTOMIZATIONS_COMMAND_ID` and `caret.project.add`. Neither command
was unregistered: the IDE window keeps its Customizations view, and both stay reachable from the
command palette here, so what went away is a row, not a feature. Restoring either is one object
literal in `buildModel`, and the parity test now pins their absence so it cannot creep back by
accident. `Kanban` and `Pull requests` stay out for want of a source (OMP reports no board and no PR
list through the RPC Caret uses); the reference's `Pinned` block, `Chats` section, section sort
menu and footer `Settings` row are not drawn either - the project and thread rows below the header
are the sessions tree this window already stacks there, and Synara's footer Settings has no
counterpart in this window's chrome yet.

**Measured live** (`npx gulp vscode-darwin-arm64-min` 9 min, then `bun run package:mac`,
`bun run check:packaged` green, relaunched with `bun scripts/launch-caret-personal.ts`): the
accessibility tree of the sidebar reads `button Search` (in the header row, above the rows),
`button New thread`, `button Automations`, `text Projects`, `button Add project`, then the
project groups and their task rows - and it no longer contains `Customize`, `Repositories`, or the
repository filter. Patch set `2568f3148462` (52 patches). `bun run test` 902 pass / 0 fail (99
files); `bun run typecheck` clean; `node scripts/ci-validate.mjs` CI-OK; `bun test
apps/macos/test/desktop-patch-set.test.ts` 0 fail.
Receipt: [`step4-sidebar-light.png`](step4-sidebar-light.png).

### Item 49 closed - a draft's picks survive into the session (2026-09-19)

The rendering half of item 49 landed earlier the same day (the trigger's status label and the picker
panel's `Effort` trait row). This closes the half it left open, and the cause was not in the port at
all: **a draft had no chat session record, so the workbench's option store refused every write for
it.**

`ChatSessionsService.updateSessionOptions` looks the resource up in its own `_sessions` map and
returns `false` when there is none, and in this window nothing ever resolved a session for
`caret.omp:/untitled-…`: `getOrCreateChatSession` is called by the base when it *opens* a session
(`mainThreadChatSessions`), by rename and by the base agent provider, none of which a Caret draft
goes through. Two consequences, both measured:

- the composer's model pick was refused and *reverted* - the renderer log said
  `[extensionSessions] model selection was not accepted; restored previous model.` on every draft;
- `extensionSessionsProvider.prepareNewSession` seeds the session it is about to create with
  `initialSessionOptions: this.chatSessionsService.getSessionOptions(draft.resource)`, which was
  therefore always `undefined`, so a draft's picks reached the created session as nothing.

**The fix is one call**, in Caret's own provider (`createNewSession` in
`extensionSessionsProvider.contribution.ts`, folded into `0010`): resolve the draft's session when
the draft is created, which is what opens the option store for it. It does not create a host
session - Caret's content provider answers a draft resource with an empty shell
(`chat-sessions.ts`, the `isCaretDraftUri` branch) rather than reading the host - and the record is
per draft, disposed with it. With the store open, the existing machinery does the rest: the workbench
asks for the draft's input state, the extension answers with the catalogue row the pick names and its
ladder, the store keeps both, and `prepareNewSession` hands them to `applyDraftModelChoice` /
`applyDraftThinkingChoice`.

**Measured live** (patch set `b1b478a4fbc5`, 52 patches; `npx gulp vscode-darwin-arm64-min` 5.8 min,
`bun run package:mac`, `bun run check:packaged` green, relaunched personal build):

1. the write-through the plan asked for, in the extension log, with the *draft's* resource:
   `Caret session option change: caret.omp:///untitled-684f71a5-… reasoning=high`;
2. the draft's trigger then reads `DeepSeek V4.1 Flash High` and the panel's footer row reads
   `Effort  High  ›`, so the pick survived in the window's own store
   ([`item49-draft-effort-high-light.png`](item49-draft-effort-high-light.png));
3. sending that draft created a session, and **OMP's own transcript** for it records both writes -
   `{"type": "model_change", "model": "cursor/claude-4.6-opus-high", "resolvedModelIsFallback":
   false}` and `{"type": "thinking_level_change", "thinkingLevel": "high", "configured": null}`
   (`~/Library/Application Support/Caret/host/sessions/<id>/session.jsonl`, 2026-09-19T08:09:20Z).
   That is the item's close condition: the Effort pick chosen before any host session existed
   reached OMP as `set_thinking_level`, and the model pick as `set_model`.

The verification created one session on this machine (title `hi`, model
`cursor/claude-4.6-opus-high`, level `high`) - a real turn was the only way to see the host's own
record of the two writes.

**The race the first fix left is closed too.** `newChatWidget` mounts the draft's composer in the
same turn the draft is created, so `SessionModelSelection` could write the draft's *remembered* model
before the record resolution above settled: that write still found no record, was refused, and was
rolled back with `[extensionSessions] model selection was not accepted; restored previous model.` -
one warning per new draft. The provider now holds that promise (`_draftOptionStore`) and, when a
write for the *current* draft is refused, retries it once the store exists instead of reverting; a
write for a resource the provider does not own still takes the honest revert and report. Measured on
the same build: creating a fresh draft produced **no** `not accepted` line, and the option log shows
the remembered model landing after the record exists
(`… models=claude-4.6-opus-high, reasoning=minimal`, then
`… models=caret-omp/deepseek-v4.1-flash`) - so the draft's store now ends up agreeing with the model
the window shows.

`bun run test` 902 pass / 0 fail (99 files); `bun run typecheck` clean;
`node scripts/ci-validate.mjs` CI-OK; `bun test apps/macos/test/desktop-patch-set.test.ts` 0 fail;
`bun run check:packaged` green.
