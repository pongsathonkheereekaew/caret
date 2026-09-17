# Caret — SSOT plan

This is the **single authoritative plan and spec** for the Caret project. Every other plan,
spec, brief or handoff that ever existed has been deleted from this repository. If the plan
changes, this file changes; there is no second owner of truth anywhere in the tree.

- Revision: 2026-09-16 (English-only rewrite; all superseded documents removed).
- Repository: `/Users/pond/caret` on branch `main`. Layout is one repo; `apps/*` and
  `packages/*` are module boundaries, not remotes.
- Language rule: **every document in this repository is written in English.** No `.th.md`
  files, no mixed-language sections. This keeps a new session able to read the whole plan
  without translation cost and removes the ambiguity of two parallel names for one artifact.
  User-facing product copy may still be localized; documentation may not.
- Section order in this file is stable and intended: read §0 forward. Section numbers are
  identifiers and never reorder.

Read order for a new session:

1. [`AGENTS.md`](../../AGENTS.md) — project rules and invariants, applied every turn.
2. This file — §0 for the definition, §6 for the SSOT split, §8 for the plan, §10 for what is
   open right now.
3. `docs/maintenance/evidence/<receipt>/` — the runtime receipts this plan cites.

---

## 0. Product definition

**Caret is a Cursor-class agent IDE that we own, running OMP as its harness.**

- We copy Cursor's product spec — surfaces, interaction, architecture, visual design — because
  we fork the same OSS base Cursor forks (Code-OSS).
- What we replace: **the harness is OMP and only OMP**. Brand, icons and product name are
  Caret's. We ship no Cursor-proprietary capability (Tab engine, cloud agents, private models).
- References: **Cursor 3.20.17** (macOS, on the user's machine) for everything visual and
  behavioural; **OMP** for execution, transcript and the surfaces Cursor does not have.
- The product target is the Codex/Cursor class of OMP+IDE surfaces: composer, models, MCP,
  review, terminal, browser, mobile continue. It is not Cursor Tab, not Cursor cloud, and not
  private inference engines.

## 1. Reference precedence

| Layer | Reference |
|---|---|
| Product, surfaces, interaction, window chrome, colour / geometry / motion | **Cursor 3.20.17 (macOS)** |
| Behaviour Cursor does not have (plan / goal / subagent / MCP / approval schema / queue) | OMP contract |
| Execution and transcript ownership | **OMP** — one owner, never a second |
| Legacy screen reference | Codex, only for surfaces neither Cursor nor OMP has |

When the layers disagree about a surface Cursor owns, Cursor wins. When they disagree about a
surface only OMP has, OMP wins — but its *appearance* still uses Caret's token layer (§3.3).

## 2. Architecture

```
Caret.app  (Code-OSS fork, Caret brand, pinned ea1912fd…)
├─ Agents window   ← the base's native Agents window (sessions workbench flavour)
│      sidebar (New Chat / Search / Automations / Customize / Projects / Repositories)
│      composer · right-hand Apps panel (Changes / Browser / Terminal / File)
├─ IDE window      ← the normal workbench (Explorer / editor / LSP / debug / terminal)
└─ one Caret host  ← lifecycle · journal · artifacts · relay · devices
        │
   OMP — the only harness, owner of execution + transcript
```

Rules:

1. The Agents surface is a **native window of the base**, not a webview we draw. It opens with
   `--agents` / `workbench.action.openAgentsWindow`; its menus, layout and title bar come from
   `desktop/src/vs/sessions/**`.
2. The Agents window's sessions, composer and transcript are fed by **Caret's provider** through
   the proposed `chatSessionsProvider` API (allowlisted in `patches/desktop/0003`), reading from
   the host and OMP.
3. **OMP is the only harness.** Registering or using `copilot` / `claude` / `codex` harnesses is
   forbidden, as is wiring GitHub Copilot auth, sign-in or BYOK. The base's
   `src/vs/platform/agentHost/**` is Copilot-bound and serves only as a shape reference.
4. The IDE window: Code-OSS owns buffers, undo, LSP, debug and extensions.
5. The host owns lifecycle, journal, artifacts, relay and devices. The iPhone client is a
   projection of the same session, never a second owner.
6. OMP owns execution and transcript. The UI never creates a second agent loop.

## 3. Cursor parity contract (measured from Cursor 3.20.17)

```text
Cursor Agents (window)
├─ Title bar: close / minimize / fullscreen; no editor tab, no editor title actions
├─ Sidebar (single column)
│  ├─ Hide Sidebar · Go Back · Go Forward
│  ├─ New Chat ⌘N · Search ⌘K · Automations · Customize
│  ├─ Projects (+ New Project)
│  ├─ Repositories (+ Customize Sidebar, Open Workspace)
│  ├─ session rows: grouped by project, row = state + name + relative time
│  ├─ Getting Started card (Skip step, Connect Slack)
│  └─ Account menu · Settings
├─ Main
│  ├─ Header: IDE · Chat actions · Show Apps
│  ├─ Session transcript (when there is work)
│  └─ Composer: project popup · branch combo · environment ("This Mac") ·
│              input (placeholder "Plan, Build, / for skills, @ for context") ·
│              toolbar: Add agents/context/tools · reasoning popup · voice input · Send
├─ Recommendation rows (Dismiss where present): Plan New Idea ⇧Tab · Multitask ·
│  Run in Cloud · Build from a design · Deploy my prototype · Start with a plan · Debug an issue
└─ Notifications (alt+T)
```

| Region | Element | Behaviour to match |
|---|---|---|
| Window | menu bar | the Agents window's menu set: `Caret · File · Edit · View · Window · Help` (no Selection/Go/Run/Terminal) |
| Sidebar | New Chat / Search | shortcut hints that actually resolve; Search opens search, it is not a permanent field |
| Sidebar | Automations / Customize | entry points to real product capability |
| Sidebar | Projects + New Project | separate from Repositories |
| Sidebar | Repositories + Customize Sidebar / Open Workspace | manage repo groups and open a workspace |
| Sidebar | session rows | state + name + relative time, grouped by project |
| Sidebar | recommendation card | dismissible/skippable, never permanently stuck |
| Sidebar | Account + Settings | entry points to account and settings |
| Header | IDE | switches to the editor window (a different window) |
| Header | Chat actions / Show Apps | task context menu and apps entry |
| Composer | project / branch / environment | name the real workspace per task before sending |
| Composer | input + IME | same placeholder; Enter sends, Shift+Enter newline |
| Composer | toolbar | agents/context/tools, reasoning, voice input, send/stop by state |
| Recommendation rows | idea rows + Dismiss | create a draft from the text; dismiss per row |
| Panels | Changes · Files · Browser · Terminal · preview/artifacts | per task, carrying workspace identity |

### 3.1 Measured values (light theme, empty draft, 1710×1073, default zoom)

| Element | Measured | Note |
|---|---|---|
| Sidebar width | 255px | there is a "Resize sidebar" splitter, so it is adjustable, not constant |
| Sidebar row inset | 8px left/right | the selected row's fill spans x8..246 |
| Sidebar row box | 30px | token `--ui-sidebar-menu-button-min-height` = 28px → **token and rendered box disagree**; trust the rendered value |
| Sidebar row pitch | ~30.7px | measured from text-row spacing |
| Sidebar row fill (selected) | `rgb(223,224,225)` on chrome `rgb(236,237,238)` | — |
| Composer card (empty draft) | **608 × 106px** including a 1px border, centred in the main pane | x679..1286, y506..611 · 423px margin each side |
| Composer card border | 1px `rgb(234,234,234)` | all four sides |
| Composer card fill | `#FCFCFC` = `editor.background` = **lighter than the page behind it** | token: `--prompt-input-container-bg` = `--cursor-bg-input-surface` = `color-mix(in srgb, var(--cursor-base) 6%, transparent)` |
| Composer shadow | none | token `--prompt-input-container-shadow: none`; never add elevation |
| Composer radius / editor | radius 18 (`radius-4xl`) · editor min-height 36 (`spacing-9`) | matches `--prompt-input-border-radius-expanded` / `--prompt-input-editor-min-height` |
| Idea rows (empty state) | 4 rows below the card, occupying y624..793 (~42px/row) | separator inset 12px from the card edge; mode pills sit below the card |
| Type scale the agent CSS actually uses | 11/12/13/14 (tokens) **plus 16/17/18/20px classes** | `.ui-osj86m{font-size:18px}` → an 18px heading is not outside Cursor's own scale |
| Motion | instant/fast/normal/slow = 50/100/150/200ms · `--cursor-easing-out-cubic` = `cubic-bezier(0.215, 0.61, 0.355, 1)` | values declared in the bundle (real animation timing not yet observed) |

**Colour measurement rule (read this before chasing ghosts).** Cursor's chrome and chat
surfaces are **translucent (glass)**, not opaque. `screencapture -l <windowID>` composites them
against a transparent backdrop and reads roughly 7 units darker (chrome reads
`rgb(236,237,238)`) while a full-screen capture of the same display reads `rgb(250,250,251)`.
In one full-screen capture containing both apps, Cursor's sidebar and Caret's read identically.
The ~7-unit delta is a **capture artefact, not a product difference**. To close §11 gate 2, use a
full-screen capture containing both apps, or treat the theme file as the base and verify against
a full-screen capture. Never compare colours with `screencapture -l` alone.

### 3.2 AX correction pass (2026-09-14)

§3's tree and table above were summarised from an earlier pass. This pass pulled the
**accessibility tree of the running `Cursor Agents` window** (Computer Use → `@oai/sky`; raw dump
at [`evidence/cursor-agents-ax-2026-09-14/cursor-agents-ax-tree.txt`](evidence/cursor-agents-ax-2026-09-14/cursor-agents-ax-tree.txt))
and found the following corrections. Where they disagree with §3, **these win**:

- **No in-window menu bar**: `Cursor | File | Edit | View | Window | Help` is the macOS menu bar
  (an AX sibling of the window), not drawn in the window, and there is **no title bar band** —
  the traffic lights float over the sidebar itself.
- **The right side is one panel, not a list of panels**: `Panel editor-panel-group` is headed by
  `Tabs` + an `Open new tab menu` button + `Enter Full Screen` + `Hide Apps`, with
  `Changes · Browser · Terminal · File` laid out as tab-strip entries. `Show Apps` / `Hide Apps`
  toggles this panel (storage key `cursor/glass.rightPane`) and it is about 608px wide — the same
  as the composer.
- **The empty composer has no Send button**: the toolbar holds only `Add agents, context, tools` ▾,
  `High` ▾ (reasoning) and `Start voice input`; the row above is the project popup + branch combo
  (`main`) + `This Mac`.
- **Recommendation rows carry subtitles and not every row has Dismiss**: `Plan New Idea ⇧Tab` ·
  `Multitask` · `Run in Cloud` (no subtitle) · `Build from a design — Turn a frame into working UI
  in this repo` + Dismiss · `Deploy my prototype — Put it on a live link anyone can open` +
  Dismiss · `Start with a plan — Align on implementation before writing code` · `Debug an issue —
  Find root causes and fix tricky bugs`. `Run in Cloud` denotes a cloud runtime option (it appears
  in Cursor's own source as a label in the Autopilot PR menu), not a full cloud-agent entry point.
- **Real sidebar order**: Hide Sidebar · Go Back (disabled) · Go Forward (disabled) ·
  New Chat ⌘N · Search ⌘K · Automations · Customize · Projects (+ New Project) ·
  Repositories (+ Customize Sidebar ▾, Open Workspace ▾) · sortable project groups ·
  Getting Started card (Skip step n of m, Connect Slack) · Account menu · Settings ·
  `Resize sidebar` splitter. There is **no** `Sessions` label and no pet.
  **Corrected again from a real screenshot (2026-09-15)**: in an actual Agents window screenshot
  (3420×2224) the sidebar ends at `Repositories` + repo rows — **no Getting Started card and no
  Account/Settings row** — while `Go Back/Go Forward` are in the title bar, not the sidebar, and
  the `Repositories` heading has two icons (filter, add) rather than a `Customize Sidebar ▾`.
  The AX list above therefore describes another pass or another state, not this empty home. The
  user chose Cursor's rendering over the spec draft, so both blocks were removed and a test pins
  their absence.
- **Colours read from the real screen (dark)**: chrome/sidebar `rgb(35,35,37)` · main pane
  `rgb(27,27,27)` · composer card `rgb(34,34,34)` (lighter than its background) · right panel
  `rgb(26,26,26)`; the composer is 608 wide and ~107 tall, centred in the main pane at the
  1710×1073 rig (consistent with §3.1, which was measured in light).
- **Still unverified**: running/approval/error states, the dark half of the light-theme pair, and
  real animation timing.

### 3.3 Colour tokens and the parity gate

Two authoritative sources, both recorded in
[`evidence/ui-cursor-parity-lock-2026-09-14/`](evidence/ui-cursor-parity-lock-2026-09-14/):

1. **The theme file Cursor ships** —
   `/Applications/Cursor.app/Contents/Resources/app/extensions/theme-cursor/themes/cursor-dark-color-theme.json`,
   named `Cursor Dark Anysphere v0.0.3`. Values are read from the file, not from a screenshot.
2. **CUA/AX capture of the Cursor Agents window** (1224×768 logical, Cursor 3.20.17, dark) for
   the geometry and IA the theme file does not carry.

Dark palette (from the theme file — authoritative):

| Key | Cursor value | Used in Caret as |
|---|---|---|
| `editor.background` | `#181818` | `--caret-bg` (main/transcript) |
| `sideBar/activityBar/statusBar/titleBar/panel/editorWidget/terminal/tabsBackground` | `#141414` | `--caret-panel` |
| `tab.activeBackground`, `dropdown.background` | `#181818` | raised panel surfaces |
| `foreground` | `#F0F0F0` | `--caret-text` |
| muted (`statusBar.foreground` 60%) | `#F0F0F099` | `--caret-muted` |
| `panel.border`/`sideBar.border`/`input.border` | `#F0F0F013` | `--caret-border`, `--caret-control-border` |
| `focusBorder` | `#F0F0F026` | `--caret-focus` |
| `button.background` / `badge.background` | `#81A1C1` / `#88C0D0` | `--caret-accent` / badge |
| `list.activeSelectionBackground` / `list.hoverBackground` | `#F0F0F01E` / `#F0F0F011` | `--caret-selected-bg` / `--caret-hover-bg` |
| `textLink.foreground` | `#81A1C1` | `--caret-link` |
| `input.background` | `#F0F0F00A` | `--caret-input` |
| `editor.selectionBackground` / `editor.lineHighlightBackground` | `#40404099` / `#262626` | editor selection/highlight |

**Invariant that must hold:** chrome (`#141414`) is **darker** than the editor/transcript
(`#181818`). This is what separates Cursor from the Code-OSS default (chrome `#191A1B`, lighter
than editor `#121314`). The full mapping lives in `apps/macos/src/caret-theme.ts`
(`CARET_DARK_ANCHORS`, `CARET_WORKBENCH_COLORS`).

Light palette (added 2026-09-14 after a runtime check — Cursor on this machine runs in light,
while Caret was forcing dark chrome over a light workbench, which was a real parity gap; Cursor
ships five themes: `cursor-dark`, `cursor-dark-hc`, `cursor-dark-midnight`, `cursor-light`,
`cursor-light-colorblind`):

| Key | Cursor Light value | Used in Caret as |
|---|---|---|
| `editor.background` | `#FCFCFC` | `--caret-bg` |
| `sideBar/activityBar/statusBar/titleBar/panel/editorWidget/terminal/tabsBackground` | `#F3F3F3` | `--caret-panel` |
| `foreground` | `#141414` | `--caret-text` |
| `descriptionForeground` | `#141414BD` | `--caret-muted` |
| `panel.border`/`sideBar.border` | `#14141414` | `--caret-border` |
| `input.border` | `#14141433` | `--caret-control-border` |
| `focusBorder` | `#14141433` | `--caret-focus` |
| `button.background` / hover | `#2778C1` / `#246AAB` | `--caret-accent` |
| `textLink.foreground` | `#0064B0` | `--caret-link` |
| `list.activeSelectionBackground` / `list.hoverBackground` | `#14141414` | `--caret-selected-bg` / `--caret-hover-bg` |
| `input.background` | `#FCFCFC` | `--caret-input` |
| `editor.lineHighlightBackground` | `#EAEAEA` | editor highlight |

**Light invariant:** chrome `#F3F3F3` (243) is still **darker** than editor `#FCFCFC` (252) — the
relationship is not inverted. The palette is selected from `window.activeColorTheme.kind` via
`caretThemeKindFromVscode()` and repainted on `onDidChangeActiveColorTheme`.

**Follow the OS like the reference does:** Cursor sets `window.autoDetectColorScheme`, so its
chrome follows the machine's light/dark setting. Caret sets it too, but only when the user has
not set it themselves (checked with `globalValue === undefined`, not truthiness, so a deliberate
`false` is never overridden). The `dark-hc`, `light-colorblind` and `midnight` palettes were
added later on 2026-09-14 — see §11 for their status.

**First screen without a folder:** the Agents window can start with no folder open, and then it
cannot write workspace settings. The palette used to be skipped entirely, leaving the first
screen (New task) in engine colours. Fixed by falling back to global scope when there is no
folder, plus `isCaretWorkbenchPalette()` to distinguish the palette Caret wrote from values the
user set, so Caret's own footprint is not read back as "the user chose this" and repainting stops.
Verified at runtime: the first screen gets `#F3F3F3` / `#FCFCFC`.

**Agent design tokens of the reference** (measured from the real bundle, 2026-09-14). Cursor ships
its agent-window design system inside `workbench.desktop.main.js` as 405 CSS custom properties
named `--cursor-*`, so Caret's tokens can be compared directly instead of guessed from a
screenshot:

| Group | Reference token | Value | Caret | Match |
|---|---|---|---|---|
| font-size | `--cursor-font-size-xs/sm/base/lg` | 11/12/13/14 | `--caret-font-*` | ✅ |
| line-height | `--cursor-line-height-*` | 14/16/18/22 | `--caret-lh-*` | ✅ |
| height | `--cursor-height-*` | 20/24/28/32 | `--caret-height-*` | ✅ |
| radius | `--cursor-radius-xs/sm/base/lg/xl/2xl/3xl/4xl/full` | 2/4/6/8/12/14/16/18/9999 | `--caret-radius-*` | ✅ |
| control radius | `--cursor-radius-base` | 6 | `--caret-control-radius` | ✅ |
| composer surface | `--conversation-surface-border-radius` → `radius-xl` | **12** | `--caret-composer-radius` | changed 10 → **12** |
| conversation type | `--conversation-font-size` → `font-size-lg` | 14 | `--caret-font-lg` (transcript body) | ✅ |
| focus ring (dark) | `--cursor-stroke-focused` = `--cursor-focus` 15% | `#F0F0F026` | palette `focusBorder` | ✅ exact |
| spacing | `--cursor-spacing-1/1-5/2/2-5/3/4…` | 4,6,8,10,12,16,20,24,28,32,40,44,48 | `--caret-space-*` | ✅ (Caret names by px, reference by step) |
| duration | `--cursor-duration-instant/fast/normal/slow` | 50/100/150/200 | `--caret-motion-*` | corrected to match |
| easing | `--cursor-easing-out-cubic` | `cubic-bezier(0.215, 0.61, 0.355, 1)` | `--caret-motion-curve` | corrected to match |

**Motion correction (fixing a regression from the previous pass):** an earlier pass changed the
motion tokens to equal `DEFAULT_MOTION_TOKENS` in `ui-a11y.ts` so the two sources agreed
(instant 0, drawer 180/120, curve `cubic-bezier(.2,0,0,1)`) — but that set is **not** the
reference's. The reference values are instant 50, feedback 100, surfaceIn 150, surfaceOut 100,
drawerIn 200, drawerOut 150, curve `cubic-bezier(0.215,0.61,0.355,1)` (`--cursor-easing-out-cubic`).
Both `ui-a11y.ts` and the CSS fallbacks in `webview.ts` were corrected to the reference values.
`--cursor-easing-out-quint` (`cubic-bezier(0.16,1,0.3,1)`) is kept as `MOTION_CURVE_STRONG` for
a future emphasis transition, with no unused CSS. D15's intent still holds (mode switch commits
at 0ms, reduced-motion zeroes durations, no decorative motion); use this table for the numbers.

**Agent surface colour (checked 2026-09-14 — confirmed no change needed):** the reference sets
`--cursor-sidebar` = `--cursor-editor` = `#181818` and `--cursor-chrome` = `#141414` in dark,
which looks like the agent sidebar should be `#181818` (lighter than Caret's). But the code that
actually paints the surface reads
`r.style.background = "var(--glass-chat-surface-background, var(--cursor-bg-chrome))"` — i.e.
**`--cursor-bg-chrome` = `#141414`**, the same as the `sideBar.background` Caret uses.
`--cursor-sidebar` has no consumer that paints the chat surface. Caret therefore keeps its current
value, and this question is closed.

**Inactive/unfocused state (fixed 2026-09-14):** the reference theme does not declare
`statusBar.inactiveBackground`, so its status bar keeps its colour when the window is unfocused —
but the engine Caret pins ships its own default themes (`Light 2026` / `Dark 2026`) that **do**
declare it, so Caret once showed the engine colour (`#FAFAFD`) instead of the palette colour in
an unfocused window. Fixed by adding the inactive/unfocused keys the engine declares and the
reference does not (`statusBar.inactiveBackground`, `statusBar.inactiveForeground`,
`activityBar.inactiveForeground`, `panelTitle.inactiveForeground`) to all five palettes. Verified
at runtime: the IDE window's light status bar reads `rgb(243,243,243)` across its full width
(previously `rgb(250,250,253)`).

**Shell scale audit (2026-09-14):** every px value in the shell's CSS was checked against the
reference's scales **by property kind** (radius against radius scale, type against type scale)
and off-scale values were fixed: `border-radius: 11px` (`.attention`) → `var(--caret-radius-full)`
(a pill badge); `border-radius: 5px` (`.pane-chip`, `.pane-draft`) →
`var(--caret-control-radius)`; `border-radius: 1px` (`.pane-chip` chevron) →
`var(--caret-radius-xs)`. A test enforcing the invariant that no border-radius escapes the scale
`[0,2,4,6,8,12,14,16,18,9999]` lives in `apps/macos/test/webview.test.ts`.

**Composer geometry (corrected 2026-09-14).** Cursor names its prompt-input tokens directly, so
they compare one-to-one:

| Measured | Reference token | Value | Caret | Result |
|---|---|---|---|---|
| radius (expanded) | `--prompt-input-border-radius-expanded` | `radius-4xl` = **18px** | `--caret-composer-radius` | changed 10 → 12 → **18** |
| editor min-height | `--prompt-input-editor-min-height` | `spacing-9` = **36px** | `--caret-composer-editor-min` | was 44px → 36px |
| editor max-height | `--prompt-input-editor-max-height` | **200px** | `--caret-composer-editor-max` | was 180px → 200px |
| editor padding | `--prompt-input-editor-padding` | `spacing-2 spacing-3` = **8px 12px** | `.composer textarea` | was 12px all round |

**18px confirmed by measurement, not just by token:** that token has two definitions (default
`radius-4xl` = 18, variant `embedded` = `radius-base` = 6), so the real corner curvature was
measured from the reference window — the composer box's left edge insets 14px at the topmost row
and reaches the inner edge about 18 rows down, which matches r≈18 (first-row inset formula
r−√(r−0.25): r=18→13.8, r=16→12.0, r=12→8.6, r=6→3.6). The composer's real size in the reference
window (1710×1073) is **604×104px**, centred in the main pane with ~424px margins.

**Still open (needs a picture to decide):** the shell's headings use `font-size: 18px;
line-height: 26px` (`.task-title`, `.empty strong`, `.settings-page h2`), but the reference's type
scale is only xs/sm/base/lg = 11/12/13/14 and `--conversation-font-size` is also 14 — there is no
18px step. Changing headings to 14px is a visible change, so it stays unfixed until an image
comparison is possible.

**Open items that must not be changed without evidence:**

- **The agent window's chrome reads ~7 units darker than its theme.** A colour-accurate capture of
  the real reference window (`screencapture -l <windowid>`) reads sidebar `rgb(236,237,238)` and
  composer surface `rgb(245,245,246)` while the transcript area reads `rgb(252,252,252)` =
  `#FCFCFC` **exactly** (no shift). The delta is therefore in the chrome, not the whole window,
  and it is **not** a colour-management shift as previously believed (that explanation was
  withdrawn). The cause is unconfirmed — the light `--cursor-*` values are set at runtime and
  cannot be read from the bundle, and fitting an overlay formula to both surfaces does not agree —
  so the palette is **not** changed. The provable method: read the values the reference sets at
  runtime, or compare two windows in one same-scale image. (Measurement note: Computer Use
  screenshots are shifted ~7 per channel — never use them for colour comparison.)
- `--cursor-accent` = `#599CE7` (blue) while the reference's VS Code theme sets
  `button.background` dark = `#81A1C1` (grey-blue) and light = `#2778C1` (blue). The agent UI's
  accent and the theme's accent therefore disagree with each other; Caret uses the theme file's
  value. A capture of a real button is needed before deciding.
- `--conversation-block-gap` = `0px` and `--conversation-text-inset` = `0px` (one definition
  each) but **no consumer was found in the bundle**, so the reference's effective message-block
  spacing cannot be concluded; Caret uses its own spacing.

**The gate.** `bun run check:cursor-parity` (`scripts/cursor-parity-check.ts`) reads Cursor's real
installed theme files and compares every key Caret declares against them. Keys Caret authors are
reported as `derived`; keys deliberately overridden (the accessibility focus ring) must be
declared in the script's `ALLOWED_OVERRIDES` with a reason. The first run **caught a real bug**:
the dark palette set `titleBar.inactiveForeground` to `#F0F0F05C` (36%) where the reference uses
`#F0F0F099` (60%), making the window title too faint when unfocused. Fixed and pinned by a test.
Current state: **340 keys checked, 0 mismatches** (derived 32, overrides 3). The check SKIPs when
Cursor is not installed, and **a SKIP does not count as a pass**.

### 3.4 Geometry, type, radius and motion tokens

From the capture plus locked implementations:

| Token | Parity value | Note |
|---|---|---|
| sidebar width | **180px** (min 160, max 360) | ≈14.5% of the 1224px window in the capture |
| list/task row height | **28px** (`--cursor-height-base`) | what the reference really uses: `--ui-sidebar-menu-button-min-height` and `--ui-tray-row-min-height` = `height-base` (28) with row `padding-top/bottom` = 0. The earlier 22px came from an uncertain-scale capture; OCR measurement of the real reference window gives ~31px pitch (28 + ~3px unexplained) |
| sidebar icon | **13px** (`--ui-sidebar-action-icon-size` = spacing-3-25) | was 12px |
| type roles xs/sm/base/lg | **11 / 12 / 13 / 14 px** | line-height 14 / 16 / 18 / 22 |
| task/page heading | 18/26/600 | |
| code | 13/20 | tool output, terminal, diff hunks |
| transcript/composer column | **437px** | ≈435px measured in the capture (41.8% of the main pane) |
| header | min 46px | |
| gutter | 24 / 16 / 12px | ≥900 / 620–899 / <620 |
| control radius / card / composer | **6 / 8 / 10px** | `--caret-control-radius` = 6px |
| radius scale | 2 / 4 / 6 / 8 / 12 / 14 / 16 / 18 / full | |
| spacing scale | 4 / 6 / 8 / 10 / 12 / 16 / 20 / 24 / 28 / 32 / 40 / 44 / 48 | |
| motion (default token) | instant 0, feedback 100, surfaceIn 150, surfaceOut 100, drawerIn 180, drawerOut 120 ms | curve `cubic-bezier(.2, 0, 0, 1)`; §3.3 supersedes these numbers with the reference's |

### 3.5 Real sidebar IA (locked from the reference capture)

New Chat / Search / Automations / Customize are icon-prefixed rows · no persistent search field
and no scope chips in the sidebar · one Projects heading with a trailing `+` · a New Project row ·
a Repositories heading ending in filter buttons, followed by repo groups and task rows (status
dot, title, worktree icon, relative time) · a compact inline selector row above the composer
(project / branch / environment, each with a chevron) · the home column, mode pills and idea rows
share one left edge · idea rows are icon + title + muted description with a divider per row.

## 4. Surfaces Cursor does not have (Caret's own design, driven by OMP)

Not counted as parity, but they live in the same window:

- approvals/questions per OMP's schema (select/multi-select/input/editor + scope/cwd/tool)
- plan/goals/queue/subagent lineage + token budget
- models/providers/MCP/skills/hooks catalog exactly as OMP advertises it
- worktree/branch bring-back receipt + artifacts (MIME/hash/buildId)
- honest-unavailable states (e.g. `Run in Cloud`, `Automations` with no backend) → disabled + reason

## 5. Deliberate deviations (must be recorded, not missed parity)

| Item | Cursor | Caret | Reason |
|---|---|---|---|
| harness | Anysphere engine | **OMP** | our product |
| Tab / cloud / private models | yes | no | out of scope |
| touch / control target | smaller | ≥32px desktop / ≥44pt mobile | accessibility floor |
| focus ring (high contrast) | transparent | `#F0F0F066` | focus must be visible |
| missing capability | available | disabled + reason | honesty marker |
| syntax token colours in the IDE | Cursor theme | Code-OSS default | licensing |
| Agents-window panel controls | no Show Panel / Toggle Side Panel; the panel header carries `Enter Full Screen` + `Hide Apps` | keeps the inherited `Show Panel` (hidden by `0026`) and `Toggle Side Panel` | **decided 2026-09-17: keep the current panel.** Removing the toggle and adding the reference's `Hide Apps` / `Enter Full Screen` is a real change to shared layout actions; the user chose to keep what works today rather than chase these three controls. Revisit only if the panel is rebuilt (section 7's React pass). |
| terminal rendering in the IDE | xterm.js | **xterm.js** | decided 2026-09-17: replacing the workbench renderer drags the xterm-specific addons (image, ligatures, search, serialize, the terminal API) out with it for no user-visible gain while Cursor parity is the goal. Recorded here rather than left as open parity; the engine work goes to the surface Caret owns (the iOS WebView terminal), gated by the corpus in `apps/macos/src/terminal-conformance.ts`. |

Deviation values that must stay different from Cursor, each requiring a receipt, because they are
Caret's accessibility floor rather than missed parity. Never remove one to make a number match:

| Item | Cursor | Caret | Reason |
|---|---|---|---|
| touch target (iPhone) | — | ≥44pt | platform HIG; applies to S14/S15 |
| desktop primary control | smaller | ≥32×32 | hit area, not the drawn image |
| `Run in Cloud` pill | absent | disabled pill | honest unavailable-capability marker |
| Thai label wrapping | — | wraps without clipping | locale rule; the only surviving Thai concern, since documentation itself is English now |
| high-contrast `focusBorder` | transparent | `#F0F0F066` | focus perimeter must be visible; the reference relies on other indicators |
| high-contrast `statusBar.border` | transparent | `#F0F0F01a` | separation must not depend on shadow |
| high-contrast **light** | theme does not exist | uses the light palette | the reference ships no HC-light; not a parity failure |

## 6. SSOT (one responsibility, one live path)

| Responsibility | SSOT | Forbidden |
|---|---|---|
| Agents window + menus + layout | `desktop/src/vs/sessions/**` + patches in `patches/desktop/` | drawing our own shell in a webview |
| Agents session/composer/transcript | Caret's provider + host + OMP | anyone else's provider/harness |
| IDE | the normal workbench | wrapping the IDE in our shell |
| execution/transcript | OMP | a second daemon or agent loop |
| host/lifecycle/journal/relay | `apps/host/**` | a second host |
| layout/token knowledge | `apps/macos/src/caret-theme.ts` + `check:cursor-parity` | hardcoding outside tokens |
| edits inside `desktop/` | `patches/desktop/*.patch` + digests in `manifest.json` | editing the checkout without capturing a patch |

### 6.1 Patch mechanism constraints (measured, not theoretical)

`prepare-desktop.ts` proves "already applied" with `git apply --reverse --check` **per patch**.
Three structural consequences, each hit in practice:

1. **A new patch that edits a file created by an earlier patch cannot verify.** If a later patch
   touches a file a previous patch *created* (e.g. `0021` creates `agentHomeUtilityEditor.ts`),
   the creator's reverse-check fails because the file no longer matches its post-image. Fold that
   work back into the patch that creates the file. **A patch that only edits base files can be a
   separate patch normally** (`0027` editing `editorTabsControl.ts` and `0028` editing
   `build/next/index.ts` both pass).
2. **`git apply` writes the worktree, not the index.** After applying earlier patches, `git diff`
   still compares against the base commit (a base-relative diff), which does not match the state
   the patch will really be applied to. This stays invisible until files are shared: when
   `sessions.common.main.ts` was also edited by `0005`, the apply failed because the patch tried
   to delete an import `0005` had already removed. **`git apply --index` the earlier patches
   before re-cutting.**
3. **Re-cut from the tree only for files that patch itself creates.** Files an earlier patch
   already edited, or a later patch will edit, must keep their original hunks instead of a
   regenerated section. Real case: `0022` creates `agentHomeNav.ts` but also edits
   `sessions.desktop.main.ts`, which `0023`/`0024` edit further — regenerating the whole file
   list from the working tree pulls `0023`/`0024`'s work in, and those two then fail to apply.

### 6.2 Retirement ledger

| Artifact | Retire when | Status |
|---|---|---|
| `apps/macos/src/webview.ts` + `TASK_WEBVIEW_CSS` + the tests bound to the shell | S3 | **still live** (see §10) — it is the dock in a plain IDE window (`caretComposerDock`), not the Agents window |
| `caretComposer` view + its `caretAgents` activity-bar container | 2026-09-17 | **retired** — a second agent surface for one window; the dock is the only Caret view left |
| the `caret.agentsShell` editor + `openAgentsShellEditor()` + the `.caret-shell` document | 2026-09-17 | **retired** — the shell-in-an-editor-column route the Agents window already refused to mount |
| `scripts/shell-render-fixture.ts` | with `webview.ts` | **kept on purpose**: the shell it renders is still the live IDE dock, and headless render is how the open AX/DOM parity check (§10 item 16) measures it |
| `patches/desktop/0002` + context key `caret.agentsWindow` + chrome hiding on mode switch | S1 | **retired** (replaced by `0008`; context key removed from the extension) |
| drift of `agentWorkbenchActions.ts` edited in the checkout without a patch | S1 | **retired 2026-09-17** — the whole `src/vs/workbench/contrib/agentWorkbench/` island is recorded as a `removals` entry, and patch `0034` drops its one import; nothing in `desktop/` registers it any more |
| the fork's `caret.openAgentsWindow` command that still opens the `caretComposer` webview | S3 | **retired 2026-09-17** (patch `0034`): the command, its `caret.openIde` twin, the mode service behind them and the context key `caretWorkbenchShell` all went with the island. The one remaining route is `caret.showAgents` → `workbench.action.openAgentsWindow`. |
| the Agents window mounting Caret's shell editor (`caret.agentsShell`) inside itself | S3 | **deleted 2026-09-17**: it stopped mounting on 2026-09-14, and the editor, the fallback panel and the `window.caret-shell` document are now gone from the extension too. What is left of S3 is `webview.ts` + `TASK_WEBVIEW_CSS` + the shell-bound tests (the dock). |
| the Agents-window architecture note | immediately | **deleted** — it had been reduced to a redirect stub |
| Copilot provider in the sessions workbench | 2026-09-14 | removed by `patches/desktop/0005` |

### 6.3 Tree audit (2026-09-15)

The whole tree was scanned (excluding `desktop/`, which is the base's build output) with these
results:

| Group | Status | Evidence / what remains |
|---|---|---|
| **Caret's webview shell** — `apps/macos/src/webview.ts` (2,836 lines), `TASK_WEBVIEW_CSS`, the `caretComposer`/`caretComposerDock` views, the `caret.agentsShell` custom editor, the restricted-mode stub, `scripts/shell-render-fixture.ts` and ~8 shell-bound test files | **not all dead code — this corrects an earlier note (2026-09-15)**: it really is no longer mounted in the *Agents window* since 2026-09-14, but in the *IDE window* the shell is still a live dock — a `caretDock` container → the `caretComposerDock` view, the `caret.focusDock` command (`extension.ts:4006`), and `focusAgentSurface()` sending `focus_composer`/`focus_search`/`focus_task` plus `prefill` from IDE-side actions (add selection to composer, inline edit) all land in those views ⇒ **deleting the set now would cut working features** (there is no way to send a message into the Agents window's composer from the extension instead) | Two mandatory preconditions remain: (1) ~~move the token source to `caret-theme.ts`~~ **done 2026-09-15** — 76 tokens live in `CARET_TOKENS`/`caretTokenCss()` in `caret-theme.ts` and `check:cursor-parity` reads from there (340 keys, 0 mismatches), no longer bound to the shell's CSS; (2) `webview.ts` can be deleted once an IDE-side replacement for the dock exists, which is **S4/S2 work, not S3** — until then `rg "webview.ts\|TASK_WEBVIEW_CSS"` is not 0 and **S3 has not passed its exit gate** |
| The four kickoff-pack documents (parity spec 2.0, backlog CSV, golden-state template, kickoff prompt) | **deleted 2026-09-16** | Superseded by this plan in full |
| Brand/icon work left in the working tree (`assets/brand/**`, iOS icons, `scripts/lib/app-icon.ts`, `scripts/build-caret.ts`) | **not committed** (from another session) | `scripts/build-caret.ts` in the working tree imports `scripts/lib/app-icon.ts`, which is still untracked — keeping this work means committing the whole set together, otherwise HEAD and the tree disagree |
| `.DS_Store` (2 tracked files + untracked) | **cleaned** (2026-09-15) | Files removed and `.DS_Store`, `.vscode/`, `.commandcode/` added to `.gitignore` |
| `patches/desktop/0002` + `0004` | retired | No patch files remain in `patches/desktop/` and the manifest has no entries (recorded in `patches/desktop/README.md`) |
| Copilot/Claude/Codex providers in desktop | removed | `patches/desktop/0005`–`0007` + the 18 `removals` entries in the manifest |
| **OMP runtime gate** — exact `omp/18.1.18` comparison in `apps/host/src/service.ts`, three smokes and `prepare-omp-runtime.ts` | **fixed (2026-09-15)**: `isSupportedOmpVersion()` in `packages/omp-adapter/src/types.ts` accepts the baseline or a newer patch in the same minor (accepting this machine's `18.1.22`) and rejects other minors, older versions or non-version strings. The host still probes with the same env it spawns with; `prepare-omp-runtime` still pins exactly because it builds the shipped artifact | Receipt [`evidence/s2-omp-version-gate-2026-09-15/`](evidence/s2-omp-version-gate-2026-09-15/) · the repo's smokes pass against a real OMP 18.1.22 · `apps/host` is green across the set |
**Re-audited 2026-09-17.** The shell row above is a 2026-09-15 snapshot; the current state is §6.2.
What that pass found, and what this one changed:

- gone: the `caretComposer` view and its `caretAgents` container, the `caret.agentsShell` editor, the
  `*.caret-shell` document and the `window.caret-shell` fallback panel, `agentsWindowOpenMode()`, the
  duplicate `caret.openTask` command, and `desktop/`'s `contrib/agentWorkbench` island (13 files);
- gone with no replacement needed: `artifact-filters`, `artifact-lineage`, `markdown-table`,
  `settings-hits` and `transcript-find` — five modules whose only importer was their own test;
- still live on purpose: the dock (`webview.ts` + `TASK_WEBVIEW_CSS` + shell-bound tests) and
  `scripts/shell-render-fixture.ts`, which renders that dock headlessly for the open AX/DOM check.

Receipt: [`evidence/dead-code-retirement-2026-09-17/`](evidence/dead-code-retirement-2026-09-17/).

## 7. React for the Agents surfaces (decided 2026-09-15)

**"Is Cursor fully React?" — answered from evidence (2026-09-15): no.** Both
`workbench.desktop.main.js` (IDE) and `workbench.glass.main.js` (Agents) still contain VS Code
workbench components (`EditorPart` 18/15, `StatusbarPart` 2/2, `TitlebarPart` 2/2, `QuickInput`
7/12 occurrences) ⇒ the chrome, editor and sidebar are still TypeScript + DOM, not React. React
*is* bundled into the whole app (`esm-jsx-runtime` 704 occurrences in the IDE bundle, 1462 in
glass) and **the Agents window uses it most heavily** — real React components appear in the glass
bundle (minified jsx aliases, `Trigger`, icon buttons). The correct target is therefore
**React islands inside the workbench**, not rewriting the workbench — which is what R1/R2 did, and
what the reference itself does. (Whether the reference's IDE window uses much React is neither
measured nor needed: the IDE is upstream Code-OSS that we do not author.)

The user asked for "React like Cursor" and proposed Untitled UI React as the component set. Those
are two separate questions, because the evidence says they are not the same thing.

### 7.1 Measured facts

- The reference builds agent UI with **real React**: `out/vs/workbench/react-runtime/` (react +
  react-dom + jsx runtime, 248K) and its Apps panel is a React component — a **fixed** pane
  switcher (`changes`/`browser`/`terminal`/`file`) plus a `+` button with
  `aria-label="Open new tab menu"`. Details in
  [`evidence/cursor-agent-window-architecture-2026-09-15/`](evidence/cursor-agent-window-architecture-2026-09-15/).
- Our checkout: `desktop/node_modules` already had `react` + `react-dom` **18.3.1**, but as an
  indirect dependency, and `src/vs/sessions/**` contained no React at all (0 files; the only
  React imports in `src/vs` are under `workbench/test/**/componentFixtures/*`). The base
  `package.json` declares no react/tailwind/aria.
- Untitled UI React (the component page the user supplied) states it is "Built with React Aria
  v1.20 and styled with Tailwind CSS 4.3" and has both free/open-source and a "Get PRO" tier.

### 7.2 Decisions

1. **Use React for the Agents surfaces: yes.** It matches the reference and is the only route
   that really closes the panel/sidebar gaps listed in §10. The right starting point is a pane
   whose model and view are already separated (`appsPanelModel.ts` + `agentHomeUtilityEditor.ts`):
   replace the view layer with `createRoot` and let React render from the existing model.
2. **Do not import all of Untitled UI into the parity surface**, because:
   - Cursor does not use Untitled UI — importing it makes Caret *less* like the thing it promised
     to match: `check:cursor-parity` locks 340 keys from `CARET_TOKENS`/`CARET_WORKBENCH_COLORS`,
     while Untitled UI brings its own spacing/radius/font scales ⇒ every component would be
     restyled back into our tokens anyway (you get React Aria's a11y and structure, not its look).
   - Tailwind 4 in the workbench renderer means a global preflight colliding with workbench CSS;
     that has to be scoped before anything else.
   - react/react-dom must become **production dependencies** of the fork and enter
     ThirdPartyNotices ⇒ a licensing/release task, not just an import.
   - What is worth borrowing from Untitled UI is the *pattern* (component structure, states,
     React Aria's a11y), assembled from our tokens — not its scales.
3. **Do not touch the deliberate deviations** in §5 (`harness = OMP`, no Cursor Tab/cloud, touch
   targets ≥32px/≥44pt, visible focus ring, missing capability → disabled + reason, IDE syntax
   colours).

### 7.3 Slice order

| Slice | Work | Verified by |
|---|---|---|
| R1 | Make React a production dependency of the fork + one React root in `src/vs/sessions/**` (the Apps panel pane), rendering from the existing `IAppsPanelModel` | `node build/next/index.ts transpile` + open `--agents` and see the pane still work |
| R2 | Move the pane switcher to React per the reference spec (Changes · Browser · Terminal · File + `+`) with React Aria states/shortcuts | AX/DOM comparison with the reference + parity gate |
| R3 | Sidebar Projects/Repositories/Search as the same React surface | AX/DOM comparison with the reference + parity gate |
| R4 | Re-evaluate Untitled UI concretely: which components earn their place, and how many restyle into `CARET_TOKENS` | the parity gate must not regress |

**Status**: R1, R2 and R3 all landed by 2026-09-15 — see §9 for the receipts. R4 has not started
and is the only React item still open; note that the JSX setup added on 2026-09-16 (§9, item 10)
removes the main cost R4 was meant to evaluate, so R4 is now a question about component
*sourcing*, not about build capability.

## 8. Execution plan

| Step | Work | Owner | Exit evidence |
|---|---|---|---|
| **S1 Remove Copilot, open the real window** (done) | S1a unregister Copilot (provider/harness/auth) · S1b delete the dead Copilot/Claude/Codex code · S1c route to the base's window (patch `0008`), retire patch `0002` + its context key, make the base tolerate a missing `defaultChatAgent` (patch `0009`) | root | The Agents window really mounts (title `Agents`, workbench + sidebar + composer); no Copilot gate/sign-in; no `Session Type: Copilot`; the IDE window boots normally; the bundle registers no Selection/Go/Terminal in the Agents window |
| **S2 Caret's provider** | Register our own `chatSessionsProvider`; list sessions from the host; send work through the host to OMP; no other provider | root | **Met**: the extension activates in the Agents window, the provider reads the host, `patches/desktop/0010` bridges items into `ISessionsProvidersService`, the sidebar shows real host sessions and opens a chat, `provideChatSessionContent()` returns a `requestHandler` → `runTurn()` (startSession → `sendCommand(promptRequest)` → poll events → stream markdown/tool progress → abort on cancel), and the model picker reads OMP's catalogue (`get_available_models`/`get_state`/`set_model`). What remains is listed in §10. |
| **S3 Delete the duplicate** | Remove the webview shell + CSS + the shell-bound tests; move capability still in use to the native side | root | `rg "webview.ts|TASK_WEBVIEW_CSS"` has no remaining users; the suite passes |
| **S4 Close parity §3** | Build every component in §3 and measure the real geometry/colour | root + reviewer | Capture at the same viewport/theme + every §3 row passing |
| **S5 Mobile continuity** | The iPhone as a projection of the same session (relay/approval/replay) | root | Receipt: real iPhone + cellular |

## 9. Landed work ledger (append-only registry, no authority over §3-§8)

This section records what landed and when, with a receipt for each. It is a registry, not a spec:
if an entry contradicts §3, §5, §6 or §8, **those sections win** and the entry is what to fix.
Append new entries at the end; never rewrite an old one except to correct a factual error, and
say in the entry that you corrected it.

### S1a/S1b/S1c (2026-09-14) — Copilot removal

- `patches/desktop/0003` — product.json: allowlists `chatSessionsProvider`, removes
  `defaultChatAgent` (the source of the welcome/sign-in flow), removes Copilot from
  `trustedExtensionAuthAccess` and `builtInExtensionsEnabledWithAutoUpdates`. `product.json` now
  contains no Copilot references (`grep -c copilot` = 0).
- `patches/desktop/0005` — stops loading the Copilot chat session provider (desktop + web entry).
- `patches/desktop/0006` — removes all harness registrations (Copilot/Claude/Codex) plus the BYOK
  proxy, the Claude/Codex proxies, the pending-edit provider and Copilot API wiring;
  `providerConfigurations` is `[]`; `npm run typecheck-client` = 0 errors.
- `patches/desktop/0007` — removes the last production references to the Copilot harness (the
  Copilot-schema picker family, `sessionPluginBundler.ts`'s Copilot import, and the
  remote-agent-host contribution's load of the deleted picker).
- S1b deleted `node/{copilot,claude,codex}` (920 files), the whole `platform/agentHost/test` tree,
  `sessions/contrib/providers/copilotChatSessions`, and the picker families bound to
  Copilot/Claude/Codex schemas. The deletions are kept as **`removals` in
  `patches/desktop/manifest.json`** (18 entries) applied by `scripts/prepare-desktop.ts` rather
  than as a multi-megabyte deletion patch, so the list stays reviewable and every path is still
  tracked and confined to the checkout.
- **Reproduction proved**: restoring all files (102 Copilot files) → `bun scripts/prepare-desktop.ts`
  (7 patches + 18 removals) → the same Copilot-free tree, with `npm run typecheck-client` = 0 errors.
- **Correcting an earlier note**: an earlier summary said "the window is blank as expected because
  Caret's provider is not written yet". **Wrong.** The window was blank because the **workbench
  did not boot** after `patches/desktop/0003` removed `defaultChatAgent` from product.json — the
  base read it without an undefined guard in two places: `toDefaultAccountConfig()`
  (`workbench/services/accounts/browser/defaultAccount.ts`) and a module-level
  `assertDefined(product.defaultChatAgent, …)` in `welcomeOnboarding` (the latter killed the
  **entire IDE window**). Evidence: renderer exceptions captured over CDP —
  `Cannot read properties of undefined (reading 'chatExtensionId')` and
  `Onboarding requires a default chat agent product configuration.` The AX finding that the word
  `Copilot` was absent was therefore an artefact of nothing mounting, not proof of a clean surface.
- `patches/desktop/0009` — makes the `defaultChatAgent` readers tolerate its absence (accounts,
  extension gallery/deprecation, pack-uninstall, composer welcome copy, onboarding) without
  changing behaviour when product.json has a value.
- `patches/desktop/0008` — removes `Selection`/`Go`/`Terminal` from the Agents window's
  `src/vs/sessions/browser/parts/menubar.contribution.ts`; the IDE window keeps its menu set
  (verified in the real built bundle: `"mSelection"`/`"mGo"`/`"mTerminal"` are 0 occurrences in
  `out/vs/sessions/sessions.desktop.main.js` and still present in the workbench bundle).
- Routing: `apps/macos/src/extension.ts#openAgentsWindow` calls
  `workbench.action.openAgentsWindow` (the base's window, opened with `--agents`); it no longer
  switches mode in the existing window and no longer opens a webview.
- After rebuilding, the Agents window really mounts with title `Agents`, and its whole innerText
  contains no `Copilot`.
- **Measured twice** (same machine, same build, fresh profile, `--remote-debugging-port`):

| Window | time to first window | workbench mounted | steady RSS (sum over processes) |
|---|---|---|---|
| Agents (`--agents`) | 1.65s | 1.80s | 721MB / 7 processes |
| IDE | 1.48s | 1.61s | 642MB / 8 processes |

  Method note: RSS is the sum of every process's RSS in that profile (shared pages counted more
  than once). It compares Caret's two windows to each other, not to any other application.
- **Remaining naming debt**: 15 files whose names contain "copilot" but which are not the harness
  (`copilotCliConfig`, `copilotHome`, `copilotManagedSettings`, `copilotToolIds`, and the
  slash-command and prompt-syntax compat helpers). They register nothing and gate nothing.

### S2 provider and bridge (2026-09-14)

- `apps/macos/src/chat-sessions-map.ts` — a pure projection (uri/session item/turn plans/command)
  with 14 test cases in `apps/macos/test/chat-sessions-map.test.ts` (fixtures only, no provider).
- `apps/macos/src/chat-sessions.ts` — registers the participant + `createChatSessionItemController`
  + `registerChatSessionContentProvider`; feeds history from `state.ts`'s `applyEvent`; sends work
  with the `prompt` command through `CaretHostClient` and streams by reading events from a cursor
  (aborting when the token is cancelled). OMP still owns execution and transcript.
- `patches/desktop/0003` adds `chatParticipantPrivate` to `extensionEnabledApiProposals` and
  **`sessionsWindowAllowedExtensions: ["caret.caret"]`** — genuinely required: without the
  allow-list, an extension with `main` + contributed `views` is disabled in the Agents window
  (`extensionEnablementService#_isDisabledBySessionsWindow`).
- `patches/desktop/0010` — `contrib/providers/extensionSessions/browser/extensionSessionsProvider.contribution.ts`
  is a general bridge: it reads `IChatSessionsService.getChatSessionItems()` and exposes them as an
  `ISessionsProvider` (the model the sidebar actually uses), sending work with
  `chatService.sendRequest`, so no third-party provider is needed; registered in
  `sessions.desktop.main.ts`. Fail-safe: if items cannot be read, the provider returns an empty
  list and logs a warning — the window does not break.
- Not advertised, and therefore not shown as buttons: rename/archive/delete/fork/side-chat/
  multi-chat and the model picker (`capabilities` = false and `getModelPickerOptions` disables all)
  — these wait for the OMP binding to finish, per §5's "missing capability → disabled + reason".
- **Verified** (packaged app + `--agents` + CDP): the sidebar shows
  `treeitem: caret-ui-acceptance, 1` (grouped by the session's real workspace) and
  `treeitem: New task, updated 2 days ago, State: Completed`; clicking opens that session's chat
  view in the Agents window with a full composer and welcome — no errors in the exthost log and no
  read-only banner (the element exists in the DOM but is `display:none`).
- Receipts: [`evidence/agents-window-boot-2026-09-14/`](evidence/agents-window-boot-2026-09-14/),
  [`evidence/agents-window-sessions-2026-09-14/`](evidence/agents-window-sessions-2026-09-14/),
  [`evidence/agents-window-sessions-bridge-2026-09-14/`](evidence/agents-window-sessions-bridge-2026-09-14/).

### S2 live turn through the host API (2026-09-15)

- `smoke:omp:live` (`scripts/omp-live-turn.ts`) fires one real turn through the same path the
  Agents window uses (host HTTP API → `startSession` → command `prompt` → OMP → event stream),
  getting the exact instructed answer in 3.4s over 184 frames ending with `agent_end` and the
  command `completed`. Receipt: [`evidence/s2-live-turn-2026-09-15/`](evidence/s2-live-turn-2026-09-15/).
- **What the receipt corrected**: OMP does **not** send `prompt_result` for a real turn —
  `prompt_result` is reserved for a prompt that is scheduled but does not invoke the agent
  (`upstream/omp/docs/rpc.md` §9). The turn terminator is `agent_end` + `message_end`, and `start`
  **emits a new incarnation every time** (`service.ts:134`), so the post-start value must be used;
  the app side already did the right thing (`chat-sessions.ts:487-491`).

### S2 live turn from the on-screen composer (2026-09-16)

Receipt: [`evidence/s2-agents-window-live-turn-2026-09-16/`](evidence/s2-agents-window-live-turn-2026-09-16/).

- **Gate 1 (closed)**: `ChatServiceImpl.sendRequest` refuses every request with no *default agent*
  for its location (upstream that agent is Copilot Chat's participant, removed in S1), so every
  click ended at `sendRequest No default agent for location panel` before reaching Caret's
  provider. Fixed by making `caret.omp` the default agent: `patches/desktop/0003` adds the
  `defaultChatParticipant` proposal for `caret.caret`, `apps/macos/package.json` declares
  `isDefault: true` + `modes`, and `apps/macos/src/chat-sessions.ts` runs the real turn from the
  participant handler (`runTurn`, the same path as the session content provider). After a rebuild
  and repackage, the `No default agent contributed` symptom at boot disappeared and requests
  reached the Agents window's transcript.
- **Gates 2+3 (closed, 2026-09-16)**: Caret registers its own language model provider from OMP's
  catalogue (`apps/macos/src/omp-language-models.ts`, vendor `caret-omp`), because the extension
  host always attaches `vscode.ChatRequest.model` for a handler
  (`extHostChatAgents2.getModelForRequest`) and can only resolve models belonging to the
  requesting extension. Three things had to agree: (i) `patches/desktop/0010` declares the vendor
  descriptor (`deltaLanguageModelChatProviderDescriptors`), otherwise
  `Chat model provider uses UNKNOWN vendor caret-omp`; (ii) the picker identifier must be
  `<vendor>/<id>` to match what the extension host builds (`getVendorFromModelIdentifier`), hence
  the prefix in `0010` (sessions bridge) and `0011` (chat widget), with the extension stripping it
  before writing `set_model`; (iii) the provider must announce itself
  (`onDidChangeLanguageModelChatInformation`) because `registerLanguageModelProvider` does not
  resolve on its own — after announcing, the workbench logs
  `[LM] Resolved language models for vendor caret-omp` and the chip can pick a model.
  `patches/desktop/0003` adds the `chatProvider` proposal for `caret.caret`.
- **Result**: a prompt typed into the Agents window's composer (built and packaged from this
  revision) reached OMP and the answer flowed back into the transcript — evidence: a
  `Caret participant turn for session 94e8b9bd-…` line in the Caret channel, the session journal
  (`user: 'Reply with exactly this and nothing else: caret-ui-turn-ok-2'` /
  `assistant: 'caret-ui-turn-ok-2'`), and the transcript showing `Sent 11:23 AM` → `Completed 11:23 AM`.
- **Earlier same-day attempt** (`evidence/s2-live-turn-window-2026-09-16/`): typing worked (text
  landed in `.view-line`, Send became enabled, `.chat-submit-button` had no `disabled`) but
  **submit was never dispatched** — a CDP trusted click on the button (confirmed by a listener
  that `mousedown`/`click` reached the element), a CDP click on `.action-label`, and a real
  `Return` through Computer Use all produced no request to the extension, no new `prompt` command
  on the host, and the session still at 9, so **no provider credit was spent**. The important
  finding was that a session **with no turns** shows the base's welcome (`Build with Agent` /
  `Generate Agent Instructions`) rather than Caret's chat view; that was the real S2 blocker, not
  OMP or credentials. Chronology note: this attempt (10:18) happened *before* the 11:23 default
  participant work above. What remains true from it: **a session with 0 events still shows the
  base's welcome, not Caret's chat view.** Measurable test constraint: Monaco in this window uses
  the **EditContext API**, so `Input.insertText` and `Input.dispatchKeyEvent` cannot enter text —
  real keys through Computer Use are required, and the window must be raised to frontmost in the
  *same call* as the action (proved to work). `sky.paste` fails with a clipboard timeout when the
  app is not frontmost.

### OMP version gate (2026-09-15)

The old gate compared `omp/18.1.18` exactly in `apps/host/src/service.ts`, three smokes and
`prepare-omp-runtime.ts`. `isSupportedOmpVersion()` in `packages/omp-adapter/src/types.ts` now
accepts the baseline or a newer patch in the same minor (accepting this machine's `18.1.22`) and
rejects other minors, older versions, or non-version strings. The host still probes with the same
env it spawns with; `prepare-omp-runtime` still pins exactly because it builds the shipped
artifact. Receipt: [`evidence/s2-omp-version-gate-2026-09-15/`](evidence/s2-omp-version-gate-2026-09-15/).

### S4 slice 1 — Cursor copy and the IDE header (2026-09-14)

- `patches/desktop/0015` (7 files, all under `src/vs/sessions/**`, so the IDE window is untouched):
  the composer placeholder is reduced to Cursor's single string, the header entry point becomes
  `IDE` (both the action this window registers and the hover widget), the sidebar button
  `New` → `New Chat`, and `sessions.developerJoy.enabled` defaults `true` → `false` (the pet
  button leaves the window).
- **Verified** (dev build + `--agents` + CDP DOM): the window text begins with `IDE`, there is no
  `Open in VS Code`/`Open in Editor`, the composer shows `Plan, Build, / for skills, @ for context`
  with `Pitch your idea` gone, the sidebar reads `New Chat ⌘N`, and the pet element remains in the
  DOM but `hidden` at size 0. Receipt:
  [`evidence/s4-agents-cursor-copy-2026-09-14/`](evidence/s4-agents-cursor-copy-2026-09-14/).
- **External corroboration**: `cursor.com/docs` confirms the product really has two windows — the
  Agents Window (opened from the editor with `Cmd+Shift+P → Open Agents Window`) and the IDE
  (`→ Open IDE`), and "you can switch back to the editor anytime, or have both open
  simultaneously" ([/docs/agent/agents-window](https://cursor.com/docs/agent/agents-window)) ⇒ our
  two-window architecture matches the source product.

### S4 slice 2 — Agents window chrome (2026-09-14)

- `patches/desktop/0016` (3 files, `src/vs/sessions/**` only): removes the `Sessions` label from
  the sidebar (Cursor has no name for this pane — the element stays because it is the flex spacer
  the header actions and find widget use), removes the `Run` button and its permanently disabled
  `Run Task is not available for this session type` placeholder from `Menus.TitleBarCenterRight`
  (the command stays in the palette and on F5), and makes this window's model picker report
  `isSessionsWindow: true` — without it the core picker treated an empty catalogue as Copilot's
  sign-in gate and the chip read `Models, sign in to use Copilot`.
- **Verified** (dev build + `--agents` + CDP DOM, fresh profile): the sidebar starts with
  `New Chat ⌘N` and has no `Sessions`; the title bar has no `Run Task…` (the IDE entry moved to
  x948); the whole window has 0 aria-labels containing `Copilot`; the chip reads `Models, Auto`
  and is still `disabled` (no real model in that profile ⇒ the base's fallback, not a claim of
  readiness); the IDE window (launched without `--agents`) still boots normally. Receipt:
  [`evidence/s4-agents-cursor-chrome-2026-09-14/`](evidence/s4-agents-cursor-chrome-2026-09-14/).

### S4 slice 3 — right panel wording and composer microphone (2026-09-14)

- `patches/desktop/0017` names the panel controls per §3.2 (`Enter Full Screen` /
  `Exit Full Screen` / `Hide Apps` on both the editor-title and empty-group toolbar sides) and
  hides the editor watermark in this window only via `browser/media/workbench.css` (the reference
  has none; it targets the watermark element rather than its wrapper, because the wrapper also
  hosts the panel toolbar §3.2 requires).
- `patches/desktop/0018` renames the composer microphone to `Start voice input` per §3.2.
- **Verified** (fresh profile + CDP): watermark `display:none` (was flex 272×859), toolbar reads
  `Hide Apps` (was `Close Editor Area`), mic aria is `Start voice input`; both patches stay inside
  `src/vs/sessions/**` and have tests pinning their text + digest. Receipt:
  [`evidence/s4-agents-app-panel-2026-09-14/`](evidence/s4-agents-app-panel-2026-09-14/).

### S4 slice 4 — Customize moves into the sidebar (2026-09-14)

`patches/desktop/0019` changes the default of `chat.agentSessions.customizationEntryPoints`
(`product.quality !== 'stable'` → `false`), because that setting *is* the base's existing choice
between "composer/header" and "Agents window sidebar", and §3 lists `Customize` in the sidebar.
**Verified** (fresh profile + CDP): `.sessions-customize-trigger` in the composer is 0×0 in a
`display:none` slot while `.agent-sessions-customizations-section` in the sidebar shows 129px with
a `Customizations` heading. It is the only patch that touches `src/vs/workbench/**`, so it is
deliberately a one-line configuration default, and every consumer of the setting lives under
`src/vs/sessions/**` (the IDE window is untouched). Receipt:
[`evidence/s4-customize-sidebar-2026-09-14/`](evidence/s4-customize-sidebar-2026-09-14/).

### S4 slice 5 — the pet does not mount when the easter egg is off (2026-09-14)

`patches/desktop/0020` changes three places under `src/vs/sessions/**` (no core file), because
*registering the host* is what actually creates the pet (DOM, listeners, timers, a11y nodes) and
unregistering can only park an already-created one: `chatView.ts` ANDs the setting into the
host-preference observable, `newChatInput.ts` registers from an autorun that tracks the setting,
and `newChatWidget.ts` only mounts the aquarium toggle while it is on.
**Verified** (fresh profile + CDP): `[class*=chat-pet]` = 0 nodes, `[class*=aquarium]` = 0 nodes,
and the strings `chat-pet`/`aquarium` do not appear in `body.innerHTML` at all (before, an overlay
and a 0×0 toggle button lingered). No automated DOM test exists in this repo (it would need the
desktop component-fixture infrastructure) — recorded as a gap. The 1710×1073 geometry check was
not possible in that pass: the renderer exposes no resize API and `Browser.getWindowForTarget`
over Electron's CDP does not answer, so it needs a manual run. Receipt:
[`evidence/s5-pet-unmounted-2026-09-14/`](evidence/s5-pet-unmounted-2026-09-14/).

### Agent Home sprint, slices 1-5 (2026-09-14 → 2026-09-15)

- **Slice 1** — `patches/desktop/0021` replaces the empty right-hand editor group with a **Caret
  utility pane** holding four launcher cards (Changes/Browser/Terminal/File), each invoking a real
  command Caret already had (`newChangesTab`, `newBrowserTab`, `toggleTerminal`, `quickOpen`), and
  sets the three column proportions per the reference (sidebar 255px, utility 22.5%) plus the
  608px centred composer. **Verified** (dev build + CDP on a real window): sidebar 255×861,
  centre 853 (59.4%), utility 324 (22.6% against the reference's 22.5%), composer 608×86 centred,
  cards 2×2 at 1153/1290 × 350/487 sized 129×129, no editor tab strip and no blank canvas.
  Note: the two reference screenshots the brief named were not supplied as files, so the recorded
  measurement in `docs/caret-ui-reference-baseline.json` was used as the baseline, and vision
  checking was impossible that pass (the image tool answered HTTP 429). Receipt:
  [`evidence/agent-home-visual-2026-09-14/`](evidence/agent-home-visual-2026-09-14/).
- **Slice 2** — `patches/desktop/0022` does the title bar, sidebar and column proportions:
  (1) `SessionsTitleBarContribution` is no longer mounted, so the 448px-wide `Show Sessions`
  widget leaves the middle of the title bar (that file is loaded only by the Sessions workbench,
  so the IDE never had this widget); (2) the sidebar gains the reference navigation — full-width
  New Chat/Search/Automations/Customize rows, a Projects section (a real `New Project` row and a
  `+` in the header), and a Repositories section built from the real workspace folders with a
  filter that reveals a working input — ending there, per the reference; every row calls an
  existing command, and `.agent-sessions-header-row` and `.agent-sessions-customizations-section`
  are removed from the DOM; (3) the sidebar/utility shares become the reference proportions
  (15.625% / 22.51%); (4) the utility pane draws no header/toolbar/divider in the empty home
  (title strip `display:none`, rect 0×0). **Verified** (dev build `VSCODE_DEV=1` + CDP):
  command-centre width = 0, the four nav rows in order, no detached Customizations, no old New
  Chat button, cards 75×60 CSS (150×120 captured against the reference's 148×120), the filter
  toggle really opens/focuses/resets, and divider ratios 15.669%/22.563% against 15.625%/22.510%
  ⇒ 321/1586 captured against 320/1587. Receipt:
  [`evidence/agent-home-visual-2026-09-14/receipt-slice-b1.json`](evidence/agent-home-visual-2026-09-14/receipt-slice-b1.json).
- **Slice B1 — launcher cards corrected once the real screenshot arrived (2026-09-15)**: the user
  supplied real screenshots of Cursor's Agents and IDE windows (3420×2224 = CSS 1710×1112 at DPR 2),
  measured with `scripts/image-ocr.swift` + `scripts/png-pixel-probe.py` (the vision model still
  answered 429), and the cards were **wrong**: the reference has 121×96 CSS cards with 13px gaps
  (grid 255×205), not 75×60/7. The spec's numbers (148×120 captured at 2048×1331) were the *same
  image downscaled from 3420 to 2048*, not device pixels of a 2x display
  (148 × 3420/2048 = 247 device px = 123.5 CSS). After fixing `agentHomeNav.css` and re-measuring
  at the same window size: cards 121×96 with 13px gaps in a 255×205 grid, sidebar 267 CSS (the
  reference's 267 exactly), utility starting at 1321 against the reference's 1325 — 4 CSS from the
  workbench's right gutter consuming 1706 of 1710. So both the share and the card size now match.
  A discovered conflict was also closed: the reference has **no** Getting Started card and **no**
  profile/settings row, while the spec draft required them — **the user chose Cursor's rendering**,
  so both blocks were removed (the ability to open a folder remains in the `New Project` row, the
  Projects `+` and the Repositories add button) and a test pins their absence.
- **Slice 3 — composer starters (2026-09-15)**: `patches/desktop/0023` gives the empty home the
  starter rows below the composer card. Caret already owns that surface (`INewSessionComposer`
  renders prompt options and inserts the chosen prompt with its placeholder selected) but the base
  only showed them from the `sessions.onboarding.newSessionViewV3` onboarding tour, behind a
  Copilot experiment flag and a "no recent sessions" trigger, so the Agents window never showed
  them; the patch attaches the controller directly and **writes no new copy** — the three starters
  are the base's existing strings (implement a feature / fix a bug / fix CI) exported from the file
  that owned them rather than copied. CSS takes the card to the reference's 104px height (103.5)
  and puts the starters below it, one line each. **Verified** (dev build + CDP): card 608×104,
  three starter rows of 28px each 12px below the card. Receipt:
  [`evidence/agent-home-visual-2026-09-14/receipt-composer-starters.json`](evidence/agent-home-visual-2026-09-14/receipt-composer-starters.json).
- **Slice 4 — composer context row (2026-09-15)**: `patches/desktop/0024` adds the two chips the
  reference puts beside the Agent Home workspace picker. The **branch chip** reads
  `session.workspace.folders[0].gitRepository.branchName` (the same value the base's own session
  actions read) and clicking it runs the base's real
  `sessionsViewPane.agentHost.copySessionBranchName` command, so it copies the branch name rather
  than implying a selection Caret cannot make; it is not rendered when there is no branch. The
  **runtime chip** reads `This Mac` only while no remote agent host is connected
  (`IAgentHostConnectionsService.connections`), the truthful reading of the single execution target
  Caret offers, and it is a label rather than a button because there is no target picker to open.
  **Verified** (dev build + CDP): the `This Mac` chip is 83×24 in the picker row (608×24 at y=292),
  the composer card is 608×104, and there are three starter rows. Receipt:
  [`evidence/agent-home-visual-2026-09-14/receipt-context-row.json`](evidence/agent-home-visual-2026-09-14/receipt-context-row.json).
  Still unverified live: the branch chip (the test profile has no workspace open in the Agents
  window, and the IDE→Agents handoff launch did not boot in the available time — recorded as "not
  done", not as "passed"). Still missing: the `High` effort chip (needs a provider config action,
  the same S2 gap as the model picker) and the `Plan New Idea`/`Multitask` chips (no such concept
  exists in the code; it needs a new composer mode). The reference also draws a chevron on the
  chip; Caret uses an icon and no chevron.
- **Slice 5 — title bar regions (2026-09-15)**: `patches/desktop/0025` moves the buttons as the
  user instructed and to match the reference: **left** = [Toggle Side Bar][Go Back][Go Forward]
  (previously back/forward came first), **right** = [IDE][Show Panel][Toggle Side Panel]
  (previously IDE was rightmost). It edits `browser/parts/titlebarPart.ts` (mounting nav into
  `.titlebar-left` and open-in-VS-Code into `.titlebar-right`) and
  `browser/parts/media/titlebarpart.css` (order 1/2 on the left, 1/2/3 on the right).
  **Verified** (dev build + CDP): left `Toggle Side Bar @84, Go Back @112, Go Forward @135`; right
  `IDE @1337, Show Panel @1365, Toggle Side Panel @1388`. Receipt:
  [`evidence/agent-home-visual-2026-09-14/receipt-titlebar-regions.json`](evidence/agent-home-visual-2026-09-14/receipt-titlebar-regions.json).
  **Important**: the first half of this work (mounting the toolbars into left/right) had been
  sitting in the desktop checkout with **no patch covering it** — a scan of all 51 dirty files in
  `src/vs/sessions` found exactly these two files uncovered ⇒ the patch also closes a
  reproducibility hole (previously `prepare-desktop` on a clean checkout produced a title bar
  without this placement). Still open: the reference has no Show Panel/Toggle Side Panel buttons
  at all, but ours do because they use layout actions shared with the IDE (removing them needs a
  decision about how much the Agents window may hide).
- **Investigation into why Terminal/Browser/File did not open as right-hand tabs (2026-09-15)**:
  the user asked for the three cards to open as tabs in the right pane (they were landing in the
  bottom panel). Findings:
  - The Terminal card called `workbench.action.terminal.toggleTerminal`, measured landing in
    `.part.panel` at `[225,600,1211,296]` (the bottom) — real.
  - **Structural cause**: the Agents window **pins** the `terminal.integrated.defaultLocation`
    setting to `'view'` with `readOnly` in
    `src/vs/workbench/contrib/terminal/common/terminalConfiguration.ts`
    (`agentsWindow: { default: 'view', readOnly: true }`) — that setting is the "terminal becomes
    an editor tab" switch, but the file is core (outside `src/vs/sessions/**`).
  - Switching the card to `workbench.action.terminal.createTerminalEditor` (the real command that
    creates a terminal in the editor area) produced **no terminal at all** — editor group had 1
    group, 0 tabs, no terminal element ⇒ the sessions workbench's terminal surface does not
    support the editor location.
  - The card was therefore **reverted to `toggleTerminal`** so it does not die, and patch 0021 +
    manifest + tests were recomputed.
  - **Option (A) tried and insufficient** (the user chose A): changing
    `agentsWindow: { default: 'view' }` → `'editor'` in core and then measuring three commands
    live showed `toggleTerminal` still landing in the panel (`terminalInPanel: true`, panel
    `[225,600,1211,296]`) while `terminal.new` and `createTerminalEditor` created **no terminal at
    all** (panel `[0,0,0,0]`, editor group 1 with 0 tabs, `.terminal-outer-container` 0) ⇒ the
    limiting factor is not the setting but the sessions workbench's terminal integration, which
    only allows creation as a view (panel). Both changes were reverted (core back to `'view'`, card
    back to `toggleTerminal`) to return to the last verified state — the route that will work is
    (B) or a new surface in the right pane.
  - Browser (`NEW_BROWSER_TAB_COMMAND_ID`) and File (`workbench.action.quickOpen`) were **not
    checked live** in that pass (the harness hung after clicking Browser) — File presumably already
    lands in the right editor group because quickOpen opens in the active editor group.
- **Route B: all causes found (2026-09-15)** — using the command palette driven by CDP trusted
  keyboard to fire real commands in the running window:
  - `Terminal: Create New Terminal` **works** → the panel appears at `[225,600,1211,296]` with a
    terminal inside ⇒ creation + profile/cwd are fine.
  - `Terminal: Create New Terminal in Editor Area` → **nothing happens** (panel `[0,0,0,0]`, no
    tab, no `.terminal-outer-container`, no error or log).
  - `Terminal: Create New Terminal in Editor Area to the Side` → the **editor group resizes**
    (322 → 444 wide) but **no terminal renders** ⇒ creation begins but the terminal editor pane is
    never shown.
  - The pane is genuinely registered in this entry: `terminal.all.js` → `terminal.contribution.js`
    registers `EditorPaneDescriptor(TerminalEditor)` + serializer + `ITerminalEditorService`.
  - **Structural cause**: the Agents window locks the panel to the bottom **in code**, not by
    setting — `src/vs/sessions/browser/workbench.ts` returns `Position.BOTTOM` from
    `getPanelPosition()`, `setPanelPosition()` is a no-op, `getPanelAlignment()` is `'justify'`, and
    the **grid is hard-coded** by putting `panelNode` as the second child of the right column
    (`data: [topRightSection, panelNode]`) ⇒ even `View: Move Panel Right` does nothing (confirmed
    live), and `workbench.panel.defaultLocation` is pinned to
    `agentsWindow: { default: 'bottom', readOnly: true }` too.
  - **Conclusion**: "move the panel to the right" is not a setting question (it would mean
    rebuilding the sessions grid, risking the column proportions just calibrated), but the route
    that matches Cursor is to **host the terminal in our own right-hand pane**, because
    `ITerminalInstance.attachToElement(container)` exists (`terminal.ts:1286`,
    `terminalInstance.ts:1066`) — exactly what Cursor does (a `zsh` tab in the right pane) and
    entirely within `src/vs/sessions/**`.
  - All experiments were **reverted** (both the pin and `getPanelPosition`), returning the tree to
    the last verified state (23 patches, 55 pass, ci-validate OK).
- **D: Apps panel strip — one strip, one tab per instance (2026-09-15)**:
  - **The terminal really lives in the right pane**: `AgentHomeUtilityEditor` creates its own
    instance with `ITerminalService.createTerminal({})` and calls
    `ITerminalInstance.attachToElement(container)` ⇒ the Terminal card (and the `+` card) opens
    **one tab per instance** in the panel's strip rather than the bottom panel (measured live:
    2 `zsh` tabs, 2 xterms, 1 active container sized 322×788, `.part.panel` width 0 throughout; the
    active instance's buffer read `echo apps-tab-ok` → `apps-tab-ok`).
  - **"Tabs do not line up" fixed at the cause**: previously, as soon as a Browser tab existed the
    editor group drew its own title strip (upper row) while the panel drew its own (lower row), so
    Browser sat one row above the terminal. Now the panel draws the pane's **single strip**
    (`:has(> .editor-container .caret-apps-panel) > .title { display:none }`) ⇒ every control sits
    on one row at top 42 with height 24 (Review, Browser, Terminal, File, `zsh` ×2, `+`, toggle),
    and when a real editor tab is active (e.g. Browser) the panel is not in the DOM so only the
    group's strip remains (`Apps | Browser`, top 36).
  - **`workbench.editor.showTabs` for the Agents window = `multiple`** (was `none`, which forced a
    single label) because the reference panel is a tab group; changed in
    `apps/macos/src/workbench-mode.ts` + `extension.ts`, with a guard against reading Caret's own
    value back as the IDE's layout (`AGENTS_EDITOR_SHOW_TABS`).
  - **The first entry became `Review`** as the user specified (the same surface as the old Changes
    tab, `NEW_CHANGES_TAB_COMMAND_ID`), with `Browser`/`Terminal`/`File` as before. Entries in the
    strip are icon + tooltip because the column is 322px wide (the reference is wide enough for
    labels); the same entry's label form is the card in the empty body.
  - **Toggle Pinned Summary** (after Codex): a pin button at the end of the strip toggling a
    summary bar above the body, reading the **real session** from `ISessionsService.activeSession`
    (title/status/branch) and saying `No active session` plainly when the page has none.
  - **Show Apps command** (`caret.agentHome.showApps`): the base only had the hide half
    (`Hide Apps`), so opening Browser/File over the panel left no way back. It is now invocable from
    the palette, and selecting the `Apps` tab in the group's strip also returns (confirmed live
    that the terminal survives and still takes input).
  - **Column proportions unchanged**: the right column stays 324px (22.6%) — the share is
    recomputed only when the *container size* changes, because on first open the layout is not yet
    settled and the share was computed from the old width, coming out at 30% (430px); dragging the
    sash is not overridden.
  - Receipt: [`evidence/agent-home-apps-panel-2026-09-15/`](evidence/agent-home-apps-panel-2026-09-15/)
    (with screenshot) · 570 pass, ci-validate OK.
- **D2: everything in one strip + a choosable `+` + browser fitted to the pane (2026-09-15)**:
  - **`+` = the reference's `Open new tab menu`**: it opens a picker for Review / Browser /
    Terminal / File (previously `+` created only a terminal).
  - **Browser is a tab in our own pane**: `IBrowserViewWorkbenchService` → `IBrowserViewModel`, with
    the pane owning the overlay bounds (`model.layout({ windowId, x, y, width, height, zoomFactor,
    cornerRadius })` from each tab's container rect on every layout, plus `setVisible` per active
    tab and `setEditorVisible`) ⇒ the page **fits the pane** (measured container
    `[1113, 72, 322, 791]` against pane `x=1112 width=324`; the previous editor-tab route let the
    page spill outside the pane).
  - **No URL bar in the hosted view yet**: opening a browser tab asked for an address once and then
    called `model.loadURL()`; in-page links and redirects keep working. Full chrome would mean
    mounting `BrowserUrlBarWidget` into the pane (recorded in the receipt).
  - **Confirmed live**: `+` → Browser → `example.com` produced a tab named `Example Domain` in the
    panel's strip (the group still had the single `Apps` tab, no separate Browser tab) and
    `.part.panel` width 0.
- **D3: entry and `+` share one path (2026-09-15)** — the user reported that Browser still lived
  inside the app rather than in the same strip as terminal and file. Cause: the **Browser icon in
  the strip** still ran the sessions command that opens a real editor tab in the group (only the
  `+` route hosted it in the pane). Fixed by making the entry and `+` call the same `runLauncher`:
  an entry the pane can host itself (Browser, Terminal) opens in the pane as one tab per instance.
  Measured live: all on one row at top 42 with height 24 — `Review · Browser · Terminal · File ·
  zsh · Browser · + · pin`; the group still had the single `Apps` tab, `.part.panel` width 0, and
  the browser container `[1113, 72, 322, 791]`. Note: `Review` and `File` still opened real editor
  tabs in the group at that point (hosting a diff/text editor in the pane is a separate body of
  work).
- **D4: browser "not working" = a tab with no URL + the `+` menu in the middle of the screen
  (2026-09-15)** — the user reported "browser is not working (still show only tab)" and "the `+`
  button appears in the middle of the screen".
  - **Cause 1**: the option list used `IQuickInputService.pick`, a window-centred overlay ⇒
    replaced with `IContextMenuService.showContextMenu` anchored to the button (measured live:
    button `[1379, 42, 24, 24]`, menu `[1241, 90, 162, 106]`, items
    `Review / Browser / Terminal / File`), sharing the entry's action set.
  - **Cause 2 (the real reason for "I only see a tab")**: if the user cancelled the address prompt,
    the old code still created a tab with no URL ⇒ an empty pane that looks like a broken browser.
    Now cancelling or leaving it empty **disposes the view and creates no tab at all**.
  - **Confirmed the view really renders** with a window capture compositing the overlay
    (`screencapture -l`) plus a pixel probe: the pane's upper zone contained 10,806 px of
    `rgb(48,48,48)` page text on a `rgb(238,238,238)` ground while the lower zone was uniform; the
    renderer read back `model.visible=true` and bounds
    `{windowId:1, x:1113, y:72, width:322, height:791}`.
  - 570 pass, ci-validate OK · receipt + screenshot `apps-panel-browser-rendering-pixels.png`.
- **D5: instances moved out of the pane + the browser gets its own address bar (2026-09-15)** —
  the user reported that `+` still could not open a browser.
  - **`IAppsPanelModel`** (`contrib/home/browser/appsPanelModel.ts`) is a window-scoped singleton:
    the pane attaches the instances' DOM while shown and detaches it when it goes away, rather than
    owning them ⇒ terminals and browsers survive closing/reopening or switching the pane (before,
    the pane owned them and disposed them with itself). A newly created instance becomes the active
    tab (otherwise a terminal that was never shown never opens its xterm).
  - **The dialog is gone** — a browser tab has **its own address bar** (back / forward / reload /
    address + Enter), so pressing Browser is immediately usable. Overlay size follows the address
    bar: view `[1113, 105, 322, 758]`.
  - **Confirmed live**: `+` → Browser produced a tab with an address bar → typing `example.com` +
    Enter changed the title to `Example Domain`, bounds `{windowId:1,x:1113,y:105,width:322,
    height:758}`, `visible=true`; zsh and Example Domain sat on the same row; the group still had
    the single `Apps` tab; collapsing/expanding the side pane kept both tab and page.
  - **Correcting an earlier note**: the tabs disappearing mid-session were caused by an agent
    relaunching the dev build with a fresh `--user-data-dir`, not by the layout closing the pane.
  - 570 pass, ci-validate OK · screenshot `apps-panel-browser-address-bar.png`.
### R1 + R2 close-out (2026-09-15)

Landed and **confirmed with typecheck + the real built output + the repo suite** (no part of it was
confirmed on screen, because an app cannot be left open across tool calls in that environment):

1. `react`/`react-dom` 18.3.1 are real dependencies of the fork (+ `@types/react`,
   `@types/react-dom`).
2. **The Apps panel strip is 100% React** — rail (`mountAppsLauncherRail`), instance tabs
   (`mountAppsTabStrip`), `+` + summary toggle (`mountAppsStripActions`), summary panel
   (`mountAppsSummary`) and empty-state cards (`mountAppsEmptyState`). The pane keeps only each
   tab's "body", the address bar, the context menu and the model. Evidence: the built output
   contains all five mounts and `agentHomeUtilityEditor.js` no longer contains the strip markup the
   pane used to build.
3. **Vocabulary matches the reference**: the first entry is `Changes`, and `+` carries
   `aria-label="Open new tab menu"` (patch 0027 turns `Add Tab` into `Open new tab menu` in the
   Agents window only, using `IsSessionsWindowContext`; the IDE keeps the original wording).
4. **One geometry for the strip**: a single `--caret-apps-control-size` + `--caret-apps-gap`
   across the whole row (previously 24×26 / 24 / 22×22 mixed, so browser and terminal tabs did not
   share a baseline).
5. **The token layer covers the Agents window**: the CSS reads `var(--caret-*, <fallback>)` and a
   test enforces that every fallback equals the real value in `CARET_TOKENS`. The extension cannot
   write CSS into the workbench DOM, so the real injection has to happen at the workbench level
   (not done yet).
6. **Pane switcher semantics (corrected to match the code, 2026-09-15)**: currently **every entry
   opens its own instance** — the rail and the `+` menu choose from the same app set, and pressing
   an entry again is how a second terminal/browser is opened. (An earlier version made the rail a
   pane selector that reused an open instance, which read as "nothing happened"; the user confirmed
   on screen that opening a new one is the correct behaviour.) So converting to the reference's
   single fixed pane switcher is not "a small wiring job" but the same class of structural work as
   item (1).
7. Bugs typecheck caught along the way: `Action` taking a `ThemeIcon` instead of a CSS class (icons
   in the `+` menu never appeared), an unused import, and the browser tab not showing a page (the
   model's `visible` started `false` and the pane never set it back).

**Next steps in order of impact** (correcting an earlier claim that `changes`/`file` active state
was "a small wiring job" — **it is not**, verified 2026-09-15): our `changes`/`file` ran
`workbench.action.agentSessions.newChangesTab` / quick open from `contrib/editor/browser/
addTabActions.ts`, i.e. **add-tab actions that open managed editor tabs**, so those two were never
panes of the Apps panel at all, and marking them active was a *side effect* of structural work
rather than a standalone task. The order was therefore:

1. **Make the panel's four entries switch panes inside the panel** (Changes/Browser/Terminal/File
   as real panes of the panel, matching the reference) — the genuine remaining structural piece,
   and the reason the S4 receipt still said our panel was "editor group, not the reference's
   fixed-tab panel" → landed 2026-09-16, see "pane switcher" and "changes/file as panes" below.
2. **R3 sidebar Projects/Repositories/Search as React** (the largest remaining item) → landed
   2026-09-15, see below.
3. The composer (reasoning popup `High` + the project/branch/`This Mac` row) → context chips landed
   2026-09-16.
4. Injecting `--caret-*` at the workbench level.
5. **Comparing AX/DOM against the reference**, never done yet and the real decider for "identical".

**A real hazard encountered**: files under `desktop/src/vs/sessions/contrib/home/browser/` were
being edited from several directions during that round (edits that were not mine broke patches
mid-flight twice) ⇒ always re-read the latest state before editing that group, and never revert
work you did not do.

### Patch drift closed + the user's theme reaching the Agents window (2026-09-15)

Receipt: [`evidence/agent-window-theme-profile-2026-09-15/`](evidence/agent-window-theme-profile-2026-09-15/).

1. **`prepare-desktop` was red before this round** because the checkout had drifted past three
   files (`agentHomeUtilityEditor.ts`, `agentHomeUtility.css`, `build/next/index.ts`) ⇒ `0021` was
   re-cut from the checkout (not reverted, because that state is what the user had confirmed on
   screen) and `0028` was added for React inlining. The correct re-cut procedure is in §6.1 (it
   requires `--index`).
2. **`0027` went back to being a normal patch** — it edits the base's `editorTabsControl.ts`, not a
   file `0021` creates, so it does not hit the reverse-check limitation (this corrects an earlier
   note in §6.1 that said to withdraw 0027).
3. **The theme needs two layers fixed, not one**:
   (a) **Why the theme was not registered**: `canExecuteOnSessionsWindow()` disables every
   extension with `main`/`browser` ⇒ a theme that also has its own settings section (Catppuccin
   pairs `configuration` with `themes`) is not registered in that window. The escape hatch upstream
   provides is `extensions.supportAgentsWindow`.
   (b) **Where that window reads settings from**: *not* `profiles/builtin/agents/settings.json` as
   first assumed — `AGENTS_WINDOW_PROFILE_FLAGS.settings = true` makes that profile use the default
   profile's `settingsResource`, and nothing reads the file in the `agents` profile (confirmed on
   the real app: an override placed there left the theme stock). What the window actually reads is
   its own workspace file (`agentSessionsWorkspace` = `User/agent-sessions.code-workspace`, which
   the sessions workbench already uses to write `chat.disableAIFeatures`).
   ⇒ `syncAgentsWindowTheme()` writes to that workspace file both on activate and on settings
   change: theme keys + the user's `extensions.supportAgentsWindow` + the list of extensions that
   *provide the user's selected theme* (matching both id and label), without hardcoding names. See
   the receipt for detail.
4. **Confirmed**: `prepare-desktop` = 26 patches/18 removals · applying the whole set to a clean
   worktree reproduces the checkout for every source file · `bun run typecheck` · `ci-validate` ·
   `cursor-parity-check` (340 keys, 0 mismatches) · suite 734 pass · `workbench-mode.test.ts` 20
   pass · **on screen (CDP)**: the Agents window ran
   `Catppuccin-catppuccin-vsc-themes-mocha-json` (`--vscode-editor-background: #1e1e2e`) and the
   Apps panel still matched the brief (4-entry rail, readable `+` menu, two rail presses producing
   two instance tabs).
5. **Remaining**: the theme in the light slot and live theme switching with both windows open. The
   earlier "must tell the user" case (Latte in the dark slot) is gone because the carry overwrites
   with the user's real values each round — but Caret never touches the values in the user's own
   `settings.json`.
6. **R3 landed (2026-09-15)**: the sidebar navigation is a React surface like the Apps panel.
   `agentHomeNav.ts` keeps "model + wiring" (which rows exist, what command each runs, filter
   open/close, and which rows to hide because which workspace folder is a repository, plus the
   delegated context menu), while `agentHomeNavReact.ts` owns the markup. The seam is
   `onRow`/`onAction`/`onFilterInput` with the pane holding a `Map<string, () => void>`, and every
   class name is unchanged ⇒ CSS, tokens and the parity gate see no difference. Confirmed on screen
   (CDP): the rows match the reference, `Projects` has a `New Project` action, `Repositories` has a
   filter toggle with `aria-expanded=false` plus `Add Repository` and an empty note, and pressing
   the toggle really opens the input. Receipt:
   [`evidence/r3-sidebar-react-surface-2026-09-15/`](evidence/r3-sidebar-react-surface-2026-09-15/).
   Not yet confirmed: that profile had no workspace folder, so filtering rows was not exercised
   (toggle/input work), nor was drag-reordering project groups. R4 has not started.
7. **Two bugs the user hit (same round, 2026-09-15)**: (a) "cannot open another browser tab from
   `+`" — the `+` did create a new instance correctly, but the **rail** still reused because the
   workbench bundle in the app was the 21:21 build while the source had changed at 21:49, and
   `--package` only rebuilds the Caret extension ⇒ the fix is
   `node build/next/index.ts bundle --minify` + copying `desktop/out-vscode` over `app/out/` and
   packaging again (writing after sealing requires re-signing). (b) The user icon in the top-right
   of the Agents window is the sessions workbench's account widget, and Caret has no account to
   show there ⇒ patch `0029` sets `when: ContextKeyExpr.false()`. Both confirmed on screen (the
   rail/`+` does add tabs and the new tab is the shown one · the widget is gone).
8. **A bug a DOM probe cannot see (2026-09-16)**: (a) `+` could not open a second browser tab — the
   previous round concluded "the `+` menu is fine" because the probe fired through **CDP, which
   injects into the renderer**, while the browser screen is a **native view painted over the DOM**
   ⇒ a real click hits the page, not the menu. Fix: `0021` (`agentHomeUtilityEditor.ts`) hides the
   hosted page before opening the menu (`hideBrowserForPopup`) and restores it on `onHide`
   (`restoreAfterPopup` → `applyActiveTab`). (b) The "installation appears to be corrupt"
   notification on every launch did not come from copying bundles but from all 10
   `product.json.checksums` entries being wrong since the app was assembled (even files nobody
   touched) ⇒ `scripts/build-caret.ts --package` recomputes checksums against the real files before
   signing, and they must be **sha256 base64 with the `=` stripped**, because
   `ChecksumService.checksum` uses `digest('base64').replace(/=+$/, '')`. Confirmed with a real
   mouse (Computer Use): `+`→Browser twice in a row gave 4 → 5 tabs, and the new window showed no
   corruption notification. Receipt:
   [`evidence/apps-panel-popup-over-native-view-2026-09-15/`](evidence/apps-panel-popup-over-native-view-2026-09-15/).
   **Durable lesson**: anything the pane paints as DOM over its own bounds (menus, dropdowns) must
   be tested with real input only — a renderer-level probe cannot see a native page. Check any
   future popup (pinned summary, etc.) the same way.
9. **Pinned summary (2026-09-16)**: **Cursor has no such feature at all** — its bundle contains
   `Open new tab menu` but no `Toggle Pinned Summary`/`summary-pinned`, and §4 classifies this
   surface as Caret's own (inspired by Codex). The Codex app could not be inspected (Computer Use
   refused `com.openai.codex`), so nothing is claimed about its window. **Decision: not a floating
   window** — the SSOT is one owner of execution/transcript and windows are projections, so an
   always-on-top overlay would add new lifecycle (mode switches, host restart, display changes) and
   would need native work on macOS; the case it would help (watching the summary while in the IDE)
   is already the dock's job. What pinning really needs to do is "survive the pane being recreated"
   ⇒ `summaryPinned` + `toggleSummaryPinned()` moved into `IAppsPanelModel` and the pane mirrors
   from the model (`applySummaryPinned`, called from `renderTabs` so it applies on pane creation
   too), folded into patch `0021`. Receipt:
   [`evidence/pinned-summary-model-state-2026-09-16/`](evidence/pinned-summary-model-state-2026-09-16/).
   Not yet confirmed: the path where the pane is genuinely torn down could not be reproduced
   (toggling the side panel and opening a File card both left the panel element alive — the tag
   survived both routes), so this is confirmed by structure and on-screen behaviour rather than by
   an observed teardown.
10. **Closing the remaining parity queue (user-approved 2026-09-16)**: keep all §5 deviations, skip
    what only Cursor has (Tab/cloud/subagent/private model) and work the queue 1-4.
    **Item 1 done**: the composer's context chips are React (`agentHomeContextRowReact.ts`) ⇒ every
    Agent Home surface Caret authors and renders is now **entirely React** (Apps panel, sidebar nav,
    context chips), while the starter rows belong to the base and the pane scaffolding is
    necessarily DOM (container/terminal attach/native bounds). This also corrects an earlier review:
    `agentHomePromptOptions.ts` and `agentHomeUtilityInput.ts` **create no DOM at all** (the first
    is a controller into the base's API, the second is an `EditorInput`) ⇒ the React gap was
    genuinely one file. Folded into patch `0024`. Receipt:
    [`evidence/context-row-react-surface-2026-09-16/`](evidence/context-row-react-surface-2026-09-16/).
    Not yet confirmed: the branch chip (that session had no branch, so only the runtime chip was
    visible) and the React root re-mounting when the composer rebuilds itself (the guard works, but
    a rebuild was not forced).
    **Item 2 done (JSX)**: `src/tsconfig.json` sets `jsx: react-jsx`, includes `.tsx` and excludes
    the diffing fixtures (new patch `0030`); `build/next/index.ts` sets esbuild `jsx: 'automatic'`
    and inlines `react/jsx-runtime` as well (folded into `0028`); and
    `agentHomeContextRowReact.tsx` is written in JSX as proof ⇒ new components can now be written
    the way the reference does it. Confirmed: typecheck-client clean, the bundle has no external
    `react/jsx-runtime` import left, the window loads and the JSX component really renders, suite
    593 pass (with a new test covering the JSX config).
    **Item 3 slice 1 done**: the Apps panel strip is a real pane switcher matching the reference —
    `runLauncher(launcher, mode: 'reuse' | 'new')` separates the two halves explicitly: a strip
    entry is `reuse` (switch to the existing pane + mark active), the `+` menu is `new` (add an
    instance), and the empty-state card is `new`. They share one path so the two halves cannot
    interpret "Browser" differently, which is what had happened before. Confirmed on screen: the
    first rail press on Browser gave 1 tab and marked it active, a second press still 1 tab
    (switching panes, not adding), and `+` → Browser gave 2 tabs ⇒ matching the reference behaviour.
    Receipt: [`evidence/panel-pane-switcher-2026-09-16/`](evidence/panel-pane-switcher-2026-09-16/).
    Not yet confirmed: the pane actually visible after switching was read from tab state + rail
    marks rather than from the native overlay (no real-mouse run), and **`changes`/`file` were still
    editor-group tabs**, which is the rest of item 3.
11. **Item 3b done (2026-09-16): `changes`/`file` are real panes of the panel.** Those two entries
    used to run commands (`newChangesTab`, quick open) ⇒ their surface appeared as an editor-group
    tab, and in an empty window the command opened nothing at all ⇒ the two buttons looked dead.
    Now all four entries are `hosted`: `createChanges()`/`createFiles()` are single-instance (one
    active session, one workspace ⇒ a second tab would repeat the same content) and the pane hosts
    **the base's own surfaces** — Changes = `ChangesViewPane` (inside a `PaneView`; `pane.render()`
    must be called manually because there is no view container to do it), File = `EmptyFileEditor`
    (empty state + the Files tab's Search Files). The file tree itself remains the base's Files
    view, because `IExplorerService.registerView()` has a single `view` slot and a second explorer
    inside the panel would take it from the window. **Bug found during verification**: the rail
    mark was updated in `renderTabs` (a model change), so switching to an already-open pane did not
    re-mark it → moved to `applyActiveTab`.
    Confirmed with a **real mouse** (Computer Use, path-targeted): the Agents window's AX shows four
    rail toggle buttons + `Open new tab menu` + `Toggle Pinned Summary`, and the menu bar has no
    Selection/Go/Run/Terminal · `+` → File/Changes produced a pane in the panel with the rail
    marked, switching the rail back and forth added no tab, `+` → Browser twice (the menu opening
    over the hosted page) gave 1 then 2 tabs, and switching the rail between the hosted pane and
    the hosted browser worked in both directions · CDP confirmed the editor group still had the
    single `Apps` tab and the title strip was still `display:none` ⇒ no Changes/File tabs in the
    group any more · gates: `prepare-desktop` (28/18), `desktop-patch-set.test.ts` (apply per
    manifest then byte-compare with the checkout), typecheck-client, `apps/macos/test` 594 pass,
    typecheck, cursor-parity (340 keys, 0 mismatches), ci-validate · the `0021` needle that pinned
    the old `commandId` was replaced with a hosted-pane needle and `0021`'s digest was re-cut with
    it. Receipt:
    [`evidence/apps-panel-changes-file-panes-2026-09-16/`](evidence/apps-panel-changes-file-panes-2026-09-16/).
    Not yet confirmed: any **picture** (vision returned HTTP 429 for both the sky screenshot and the
    window capture ⇒ nobody "looked" at either pane; colour, type and spacing are unmeasured) · the
    File pane is an empty state + Search Files, not a tree · the Changes pane is a changes view,
    not a multi-diff ⇒ **it remains an open question what the reference puts under the `Changes`
    entry** (AX only yielded the entry's name) · nothing was run against a real session with
    changes (there was no session that round, and the base showed an `Agent Host failed to start`
    banner that predates this round).
12. **The model picker's open question is closed (2026-09-16)** — "is OMP not advertising models,
    or did our bridge lose them?" Answer: **OMP advertises 6 models and the bridge's normaliser was
    correct, but there was no OMP process to ask when the read happened.** Measured through the
    host API: a session the host has not started answers `not_dispatched` ("Start or reconcile the
    OMP session before sending commands" — the host's own guard) ⇒ an empty snapshot ⇒ an honestly
    disabled picker. After `POST /start`, `ack.data.models` gave 6 rows (`cursor-agent` ×1,
    `openai-completions` ×2, `openai-responses` ×1, `openai-codex-responses` ×2) and
    `get_login_providers` gave 72 rows. A second bug surfaced: starting **changes the incarnation**
    ⇒ a command sent with the old incarnation got HTTP **409 `stale_incarnation`**.
    Fixed in `apps/macos/src/chat-sessions.ts` (`snapshotWithOmpRuntime`): read the catalogue once,
    and if it is `not_dispatched`, start the session **once** and re-read with the incarnation the
    start returned (host down = do not start and stay empty; start failure = fall back to the
    refused answer ⇒ still honestly disabled). This is used by both the registration/draft probe and
    the session-open path, and `fetchOmpModelSnapshot` gained a `catalog` option so the successful
    path does not ask twice ⇒ there is no second path for the catalogue (OMP's RPC still owns it;
    nothing reads `omp models`/`models.db`).
    Confirmed: 3 new unit tests (refused→start→retry with the new incarnation; warm→no start and
    exactly one catalogue call; host down→no start) · suite 740 pass (was 737) · typecheck clean ·
    a live host with 3 sessions answers the catalogue (before the fix only 1, the manually started
    one) · **on screen (packaged app)**: opening a session gave a picker of `139×22`,
    `disabled: false`, label `DeepSeek V4.1 Flash`, and a **real mouse** click opened a menu with
    `Search models` + a `Current model` mark + the 6 catalogue rows.
    The cost paid: a window that has never sent a prompt starts one OMP process to read the
    picker (the same process the first prompt would have started). Receipt:
    [`evidence/omp-model-catalog-2026-09-16/`](evidence/omp-model-catalog-2026-09-16/).
    Not yet confirmed: the composer in draft state (no session open) is still `0×0` and disabled —
    that is the new-chat widget's condition, not the catalogue's; a fresh install with no session is
    still honestly empty (showing a model before there is work would need a read path not tied to a
    session, such as a host-owned route), and this round did not press a model and verify that
    `set_model` actually writes.
13. **The "connection" icon was removed + an audit of the Agents window chrome (2026-09-16)**: the
    user reported that the top-right icon (on the right-panel side, "connection") does not work.
    CDP identified it exactly: `li.action-item.tunnel-host-toggle` at 1386,7 with aria-label
    **"Allow connections from other machines"**, which `SessionsTunnelHostTitlebarContribution`
    appends to `Menus.TitleBarRightLayout` and which runs
    `executeToggleRemoteConnections(..., { authenticationProviderId: 'github' })` — a remote tunnel
    requiring GitHub sign-in, which this fork does not ship ⇒ it opened a flow that cannot finish.
    Fixed with **new patch `0031`** (a base file no other patch touches, so it stands alone per
    §6.1): `when: ContextKeyExpr.false()` + removal of the import that only the old gate used +
    manifest digest + a paragraph in `patches/desktop/README.md` + a new needle test. The
    declaration and view item stay registered, exactly as in `0029`.
    **Drift repaired along the way**: `prepare-desktop` was red beforehand (`integrity mismatch:
    0003`) because `0003`/`0010` had been re-cut a second time in the working tree after their
    digests were updated. Updating the digests to match the real files gave **29 patches / 18
    removals** passing + `desktop-patch-set.test.ts` reproducing.
    Confirmed: typecheck-client 0 errors · typecheck · ci-validate · parity (340 keys, 0
    mismatches) · suite 749 pass (1 failure = `menus-contract.test.ts`, which needs an `rg` binary
    this machine lacks) · on screen (real packaged app): before `.tunnel-host-toggle` = 1 → after =
    **0**, `codicon-radio-tower` = 0, no aria-label containing "connection"; that row is left with
    `Toggle Side Panel · Show Apps · IDE`; the IDE window still boots normally. Receipt:
    [`evidence/agents-no-remote-connections-2026-09-16/`](evidence/agents-no-remote-connections-2026-09-16/).
    **Chrome audit still open (each needs a decision, not a silent hide)**: this window's composer
    still shows Copilot-chat concepts above a harness that does not implement them —
    **`Configure Tools…`** (the base's tool set, "applied globally for all chat sessions that use
    the default agent" ⇒ no effect on OMP), the **Permission picker** (`Default permissions /
    Allow all / Autopilot` ⇒ a different model from OMP's approvals per §4), and the **`Agent` mode
    picker** (`Configure Custom Agents…`, with no surface) · and the sidebar list still has an empty
    `Chats` group ("No chats") that the reference does not have (there is a setting,
    `sessions.list.showEmptyDefaultGroups`). Each must be either wired to OMP, hidden, or
    disabled with a reason (§5).

14. **The base Agent Host is no longer started, so the "Agent Host failed to start" banner is gone
    (2026-09-16)**: the user reported that the banner appears every time the window opens ("why
    failed? we use OMP and it worked already?"). It was never about OMP: the Agents window starts
    the base **Agent Host** utility process (the host for the Copilot/Claude/Codex harnesses) at
    restore, and that process cannot boot because S1 removed the Copilot services its node-side
    graph still requires — the log says it plainly:
    `[AgentHost:stderr] [createInstance] agentHostCustomizationEnablementService depends on
    copilotApiService which is NOT registered`, then `AgentHostProcessManager: agent host terminated
    with code 1, giving up after 5 restarts`, and the renderer turns that into
    "The Agent Host failed to start. Restart the application to try again."
    `AgentBranchNameGenerator`, `agentHostPullRequestOperationHandler` and
    `agentHostCommitOperationHandler` are the remaining required Copilot injections; booting the
    process again would mean restoring the layer the plan removes.
    Fixed with **new patch `0032`**: `AgentHostPrewarmContribution` no longer starts the host (the
    prewarmer class, the enablement autorun and the assignment-context forwarding are gone; the
    contribution stays registered with the reason in a comment), and the base's own suite for that
    contribution now pins the Caret contract ("does not start the agent host while enabled").
    Confirmed: `prepare-desktop` 30/18 · patch-set test reproduces the checkout · typecheck-client
    0 errors (the unused prewarmer symbols had to go for that) · typecheck · parity · ci-validate ·
    suite 754 pass (1 environmental failure: `menus-contract.test.ts` needs `rg`) ·
    **on screen, twice**: `main.log` carries **0** agent-host lines (no process is spawned) and the
    window has no element or notification matching `/Agent Host|failed to start/i`. Receipt:
    [`evidence/agents-no-base-agent-host-2026-09-16/`](evidence/agents-no-base-agent-host-2026-09-16/).
15. **Delete chat in the session list (2026-09-16)**: the user asked for delete alongside the
    existing Archive, and the base already owned the whole flow (menu item
    `sessionsViewPane.deleteSession` gated on `sessionSupportsDelete`, plus the
    "Are you sure you want to delete this session? This action cannot be undone." dialog) — what was
    missing were three pieces behind it: the host (`DELETE /v1/sessions/:id`, `DurableStore.deleteSession`
    with cascaded commands/events, `CaretHost.deleteSession` stopping the runtime and removing
    `sessions/<id>` + `artifacts/<id>`; a session worktree is deliberately left on disk), the
    extension (`CaretHostClient.deleteSession`, command `caret.session.delete`, declared as
    "Delete Chat"), and the bridge (`0010`: `supportsDelete: true` +
    `deleteSession`/`deleteSessions` executing that command and refreshing the list).
    Confirmed: host tests 26 pass (row + commands + events gone, transcript and artifact directories
    removed, second delete is `not_found`) · `prepare-desktop` 30/18 (0010 re-cut) · typechecks ·
    suite · parity · ci-validate · **on screen (packaged app, scratch sessions created through the
    host API)**: the row menu now reads `… Archive · Delete… · Create Group`, the dialog appears,
    confirming shows "Deleted 1 chat.", that row disappears while its sibling in the same group
    stays, and the host record plus `sessions/<id>` are gone. Receipt:
    [`evidence/agents-session-delete-2026-09-16/`](evidence/agents-session-delete-2026-09-16/).

16. **Terminal conformance corpus + Ghostty VT evaluation (2026-09-16)**: the terminal was
    the one surface with no tests at all, and the user asked what Ghostty could add to it.
    The answer was measured, not guessed. **Landed:** an engine-agnostic corpus
    (`apps/macos/src/terminal-conformance.ts`, 12 cases: OSC 633/133, OSC 8, `CSI ?2026`,
    Thai combining marks, CJK width, box drawing, DECSC/DECRC, scroll region + reverse
    index, erase+CR, alternate-screen round trip, ZWJ emoji recorded only), adapters in
    `scripts/lib/terminal-engines.ts`, the report `bun run check:terminal`, and the gate
    `apps/macos/test/terminal-conformance.test.ts` that holds every required case against
    the engine the workbench ships (xterm.js `6.1.0-beta.302`, the version `desktop`
    pins; added as a root devDependency so the corpus runs the real engine).
    **Measured** against `@coder/libghostty-vt-node` `0.1.0-beta.0` (libghostty-vt, MIT,
    darwin-arm64 prebuild, Node 24): at the chunk size a PTY actually delivers (8 KiB)
    **131.1 MB/s vs xterm's 5.1 MB/s (25.7×)**; **1.63 MB vs 7.27 MB RSS per live
    terminal**; xterm wins the rare visible-text read (5.7 ms vs 46.7 ms per 1000) and
    has no structured-snapshot API at all (ghostty: 0.475 ms per snapshot with cells).
    Behavioural parity: **12/12 on both engines**. Caveats: the binding is beta and
    upstream's C API is untagged/unstable (pin the commit), no Windows prebuild, and the
    visible terminal is untouched — the workbench still renders xterm.js, as Cursor does.
    Receipt: [`evidence/terminal-vt-spike-2026-09-16/`](evidence/terminal-vt-spike-2026-09-16/).

### The Copilot-flavoured composer controls are gone (2026-09-16)

Receipt: [`evidence/agents-chrome-decisions-2026-09-16/`](evidence/agents-chrome-decisions-2026-09-16/).

The four chrome decisions the audit left open are decided and landed. `Configure Tools…` (the
base's tool set for the default agent), the permission picker (manual / allow all / autopilot —
the Copilot permission model, while this window's approvals come from OMP) and the
`Configure Custom Agents…` entry in the mode menu are scoped out of the Agents window with
`IsSessionsWindowContext.toNegated()`: patch `0033`, three base files no earlier patch owns, each
with the reason in a comment; the IDE window keeps all three, and two of them also gate the
action's `precondition` so a command-palette entry is disabled rather than dead. The sidebar's
empty `Chats` group is a setting instead of a patch — the extension writes
`sessions.list.showEmptyDefaultGroups: false` into the Agents window's own workspace file beside
the theme keys. Confirmed with the packaged app on a scratch profile: the sidebar lists
`Automations · cedia · New task` with no `Chats`/`No chats` group; the composer's chips are
`Local · Agent · DeepSeek V4.1 Flash` with no `Configure Tools…` and no permission picker anywhere
in the window; the mode menu lists only `Agent`; the IDE window still boots. Gates:
`prepare-desktop` 31/18, the patch-set test, typecheck-client, typecheck, parity (340 keys / 0
mismatches), the suites and ci-validate.

### Caret follows the OMP line: the baseline is a floor, not a pin (2026-09-16)

Receipts: [`evidence/omp-version-floor-2026-09-16/`](evidence/omp-version-floor-2026-09-16/) (the
policy change) and [`evidence/omp-18-2-envelope-probe-2026-09-16/`](evidence/omp-18-2-envelope-probe-2026-09-16/)
(why it was needed).

This machine's stock OMP moved to `omp/18.2.1`, the gate accepted `18.1.x` only, and `apps/host`
therefore refused the runtime the user actually has — their instruction was not to pin it. The
predicate now accepts the baseline or anything newer (later patch, later minor, later major) and
refuses anything older or malformed by name; `OMP_SUPPORTED_MAJOR_MINOR` is deleted rather than
left as a second, contradicting policy. What carries the weight a version number cannot is the
runtime's own `ready` frame — the protocol versions it speaks and the Caret bridges it advertises
are capability-gated, so a runtime without them degrades honestly per command — plus the three
contract suites, which are now the acceptance test for any newer release and were all run green
against the machine's stock 18.2.1 (`omp-smoke` exit 0 with `"version": "omp/18.2.1"` in its
receipt, `omp-g1-smoke` exit 0, `omp-ui-smoke` exit 0). A Caret build still packages a runtime it
contract-tested when it was built; the floor governs the runtime a user points Caret at, and
`patches/omp/` still applies to the 18.1 source, so a stock 18.2.1 keeps those bridge surfaces
off. The earlier `s2-omp-version-gate-2026-09-15` receipt stays as the record of the policy it
described; this supersedes it.

### The host keeps a terminal checkpoint (2026-09-16)

Receipt: [`evidence/host-terminal-checkpoint-2026-09-16/`](evidence/host-terminal-checkpoint-2026-09-16/).

First slice of §10 item 27. The mobile renderer replays a bounded chunk history (4 MiB / 4096
chunks), so after a trim or a reconnect there is nothing to restore the screen from and it can
only ask OMP for a redraw. The host is the one process that sees every `caret_terminal_*` frame,
so it now keeps the screen there: `TerminalStateRegistry`
(`apps/host/src/terminal-state.ts`) holds one headless terminal per virtual terminal with
libghostty-vt, fed from the same hook that records events, with the clients' sequence rules
(duplicates ignored; a gap marks `historyIncomplete` instead of pretending the bytes were seen;
a reopen keeps the screen and follows the new size; a close keeps the final screen readable).
`GET /v1/sessions/:id/terminals` publishes them as `TerminalCheckpoint`
(`packages/protocol`), and a `caret_terminal_resize` applies only after OMP acknowledges it. The
engine is optional: without the package the host keeps nothing and the session runs as before.
OMP still owns the PTY.

Confirmed: registry tests plus a real-engine test that fails when the platform prebuild is
missing (6 pass) · the route contract (honest `{ terminals: [] }`, 404 for an unknown session,
checkpoint passed through) · `bun scripts/build-caret.ts` marks the native addon external, ships
it beside the host bundle (verified to load under plain Node from the shipped copy) and throws
when the platform prebuild is missing · licence notices added for Ghostty and the binding ·
`bun scripts/omp-virtual-ui-smoke.ts` against real OMP (scripted loopback model, no provider
credentials) passes with a new check `host-terminal-checkpoint-matches-omp-frames` — the
checkpoint matches the negotiated open frame and shows the terminal's real output. Suite 776
(1 environmental failure), typecheck clean, ci-validate CI-OK.

**Client half landed the same day** (receipt:
[`evidence/mobile-terminal-checkpoint-2026-09-16/`](evidence/mobile-terminal-checkpoint-2026-09-16/)):
the mobile renderer now consumes the route when its bounded history was trimmed —
`terminalCheckpointSeed` turns the grid into terminal bytes, the coordinator seeds from it
instead of requesting an OMP redraw (advancing its watermark to the checkpoint's sequence so
live output continues), the renderer document suppresses the "history expired" notice when a
seed follows, and `App.tsx` fetches the checkpoint through the session-scoped API client.
Confirmed: `bun run test:mobile` 146 pass (141 before) with new cases for the seed bytes, the
seed-vs-recovery decision and the fallback, plus the document notice behaviour; repo typecheck
clean, suite 776 (1 environmental), ci-validate CI-OK. The iOS `tsc --noEmit` keeps two
pre-existing failures in untouched test files, recorded rather than fixed here.

**Still open (the rest of item 27):** no device receipt yet (the closure asks for a real
iPhone over the relay), the checkpoint carries text but not cell styles, and the React mount
wiring has no component test.

### Model roles on the model picker (2026-09-16)

Receipt: [`evidence/model-roles-surface-2026-09-16/`](evidence/model-roles-surface-2026-09-16/).

The user runs several models through OMP. OMP already owns the whole role system (`modelRoles`,
`modelTags`, `cycleOrder`, `modelRoleStorage`; nine built-in roles plus custom ones) and drives it
from the TUI carousel, but **no RPC command exposed it**: the command set is 46 types and held only
`set_model`, `cycle_model`, `get_available_models`, `set_thinking_level` and `cycle_thinking_level`,
with `get_state` reporting just `model` and `thinkingLevel`. A host could only read `config.yml`
itself and reimplement OMP's layer resolution — the divergence that caused the model-picker bug —
so the surface was added to Caret's pinned OMP patch instead, and OMP keeps ownership through its
own `setModelRole`/`getModelRoleProvenance`.

- `patches/omp/0001-caret-rpc-bridges.patch` — `caret_get_model_roles` and `caret_set_model_role`,
  plus `RpcReadyFrame.caretModelRolesVersion: 1`. The projection unions `getKnownRoleIds` with the
  configured roles, leads with `cycleOrder`, lists only roles that resolve to a model, and reports
  the provenance layer per role.
- `packages/omp-adapter` — both commands in `CARET_UI_COMMAND_TYPES`, gated per capability so a
  runtime carrying one bridge does not accept the other's command.
- `apps/macos/src/chat-sessions-map.ts` / `chat-sessions.ts` — `normalizeOmpModelRoles`,
  `rolesByModelSelector`, `annotateModelsWithRoles`, `modelRoleLabel`, the request builders, and
  `fetchOmpModelRoles`; the option catalog annotates the rows the picker already shows.

Verified over the real prepared runtime with the user's own configuration: `cycleOrder
[smol, default, slow]`; roles `smol`=openai-codex/gpt-5.6-luna, `default`=commandcode/deepseek-v4.1-flash,
`slow`=openai-codex/gpt-6-astra, `plan`=opencode-go/muse-spark-1.3-contributor, all `source: global`.
A same-value write round-tripped and left `config.yml` byte-identical. The rows the picker now shows,
produced by the same projection the extension calls:

```
Grok 4.6                            cursor
DeepSeek V4.1 Flash (Command Code)  commandcode · Default
Muse Spark 1.3 Contributor          opencode-go · Architect
DeepSeek V4.1 Flash                 opencode-go
GPT-5.6-Luna                        openai-codex · Fast
GPT-6-Astra                         openai-codex · Thinking
```

The user's stock OMP binary advertises no marker and refuses the command, so a patch command is
never sent to stock OMP. Ten new test cases cover cycle-order filtering, `@role` alias resolution,
ambiguous-id refusal, honest-empty and request shape; two mutation checks prove the suite fails when
the cycle filter or the alias resolution is broken. Gates: typecheck clean, 775 pass / 1 pre-existing
environmental failure, ci-validate CI-OK, cursor-parity 340 keys / 0 mismatches.

**Seen on screen** (packaged app, `--agents`, fresh profile): the app logged `Caret session option
catalog: 6 model(s) advertised by OMP, 4 role(s) configured`, and the open model picker rendered the
roles beside the model names — `DeepSeek V4.1 Flash (Command Code)`**Default**, `GPT-5.6-Luna`**Fast**,
`GPT-6-Astra`**Thinking**, `Muse Spark 1.3 Contributor`**Architect**, with `Grok 4.6` carrying none.
Screenshot: `evidence/model-roles-surface-2026-09-16/model-picker-roles.png`.

**A mistake this round made and caught**: the first implementation put the labels in the
chat-session option group's item `description`, which the API documents as tooltip-only. The RPC
surface, the projection and the tests all passed while **the user-visible label rendered nowhere**;
only opening the packaged window and reading the picker's DOM showed it (no `title`/`aria-label`
carried the role words). The labels now travel on the language-model rows as
`LanguageModelChatInformation.detail` — the field the picker draws beside the model name — the dead
option-group annotation was deleted rather than left behind, and an existing test caught the row
shape change. Recorded because it is the failure mode §11 gate 2 exists to prevent: a value can be
measured, unit-tested and still invisible.

**Assignment surface**: `caret.models.configureRoles` (`Caret: Configure Model Roles...`) lists the
roles OMP reports and assigns or clears one through the host — the same `caret_set_model_role`
command. Exercised against the real runtime through the same helpers the command imports: it reports
`Fast=openai-codex/gpt-5.6-luna`, `Default=commandcode/deepseek/deepseek-v4.1-flash`,
`Thinking=openai-codex/gpt-6-astra`, `Architect=opencode-go/muse-spark-1.3-contributor` (all
`global`) and builds `{"role":"smol","modelId":"openai-codex/gpt-5.6-luna"}`.

**Why it is a command and not a composer chip** (investigated, not assumed): the chat-session
option-group API documents **0-2 groups**, and in the Agents window the composer renders only the
`models` group — the sessions bridge projects that one group into the dedicated model picker, and no
other group becomes a chip. With 5 groups produced (the extension log said
`Caret input state: 5 group(s) for draft (models + 4 role group(s))`) the composer still showed only
caret / Agent / model / Default permissions. An inline chip therefore needs a desktop patch; the
command reaches the same host surface without one. Two dead ends were tried and disproved first
(provider options never seed a session option and are filtered out; input state does seed, and the
groups still do not render), and the disproved projection plus its tests were **deleted** rather than
left behind — the bundle no longer contains them.

**Not confirmed**: the command was not driven from the running window, because this window's inputs
are EditContext-based (synthetic CDP keys/text do not reach the palette) and Screen Recording is not
granted for the Computer Use path. Its data path and payload are verified against the runtime
instead. That is §10.

**A bug this surface had, found by using it (2026-09-16)**: clearing roles reported success and the
same session read back an empty list, but a **fresh process still saw all four roles** and
`config.yml` was byte-identical with an unchanged mtime. Cause: OMP persists a role through
`Settings.setModelRole` → `#queueSave()`, which is **debounced by 100 ms**; the handler answered
immediately, so a client that exits on the ack closed before the timer fired and the write was lost.
Nothing in the ack distinguished "saved" from "queued". The handler now awaits
`session.settings.flush()` before answering, so `success` means the write landed. This is the failure
the earlier same-value round-trip could not catch — a no-op write makes a lost save invisible — and
it took using the feature on the user's own config to expose it.

**Patch hazard hit again**: the first re-cut failed `prepare-omp-runtime`'s reverse-check because
files were edited after the patch was cut. Re-cutting from `upstream/omp` after the last edit, then
verifying both `git apply --reverse --check` against the working tree and `git apply --check` on a
clean worktree of the pinned commit, is the procedure that works — the same constraint §6.1 records
for `patches/desktop`.

### Zen's free stealth model in OMP (2026-09-16)

The user asked for OpenCode Zen's new `union-alpha` ("Union Alpha Free") to show in OMP. The row
already listed — zen is `dynamicModelsAuthoritative`, so the credential's live list replaces the
bundled slice — but OMP's catalog routes a gateway-first id it carries no pin for to
`openai-completions`, which the gateway answers 500; `/v1/messages` is the lane that works. No pin
exists in the pinned revision or in upstream main (`60c9a115b2` pins `muse-spark-`, `minimax-m3`,
`gpt-6-astra` for zen — not this id), and §6 keeps `patches/omp` for surfaces OMP cannot expose
rather than catalog policy, so the route was fixed where the file already scopes providers: one
`models:` row on the real `opencode-zen` id in `~/.omp/agent/models.yml` (the free tier's
`x-opencode-session` gate is satisfied only for the exact `opencode-go`/`opencode-zen` ids, so a
custom provider id would lose it). Verified with a real turn through the pinned runtime —
`--model opencode-zen/union-alpha -p …` answered `caret-union-ok` — and against the live config
through OMP's own registry: 71 zen rows with `union-alpha` on `anthropic-messages`, every other row
keeping its route. Receipt:
[`evidence/opencode-zen-union-alpha-2026-09-16/`](evidence/opencode-zen-union-alpha-2026-09-16/).
The go twin stays a dead row; that is §10.

### The dead code around the shell is gone (2026-09-17)

The user asked whether the tree still carries dead code — the chrome shell we no longer use, and the
things that conflict with each other. Three kinds came out of it, and each one is now either gone or
recorded as staying.

- **Five modules no production code called.** `artifact-filters`, `artifact-lineage`,
  `markdown-table`, `settings-hits` and `transcript-find` were reachable only from their own test
  files; the shell draws the same behaviour inline (`webview.ts:495` has the markdown-table
  separator rule `markdown-table.ts` also had, and `settings-hits`/`artifact-filters` are
  re-implemented at `webview.ts:1428`/`1915`). They were the residue of the pre-SSOT `D`/`A` item
  set, which no longer exists anywhere in `docs/` or `backlog/`. Deleted with their five test files.
- **One agent surface per window, not two.** `caretComposer` (with its `caretAgents` activity-bar
  container), the `caret.agentsShell` custom editor, its `*.caret-shell` document and the
  `window.caret-shell` fallback panel are gone; the paths that used to reveal them now reveal the
  dock instead (`revealAgentSurface()` → `caretComposerDock.focus`). The dock itself is
  untouched — it is still the live IDE-window surface, so `webview.ts` and S3 stay exactly as §10
  item 10 now states.
- **The conflicting third route in `desktop/`.** `src/vs/workbench/contrib/agentWorkbench/` was a
  self-contained island (13 files) whose only live effect was two command-palette entries:
  `caret.openAgentsWindow`, which mounted the retired `caretComposer` webview, and `caret.openIde`,
  which recorded a mode flag nothing read (`caretWorkbenchShell` appears in no `when` clause).
  Removed as a manifest `removals` entry plus patch `0034` for its single import line. Opening the
  Agents surface is now one route: `caret.showAgents` → `workbench.action.openAgentsWindow`.
- **One duplicated palette entry.** `caret.openTask` and `caret.showAgents` were the same handler
  with two titles; `caret.openTask` is gone.

Verification: `apps/macos/test` 611 pass / 0 fail, `bun run typecheck` 0 errors,
`desktop` `tsc --project src/tsconfig.json` 0 errors, `npm run compile-client` exit 0 with
`caret.openAgentsWindow` = 0 occurrences in the rebuilt `out/` bundle (it was present in the
previous one), `prepare-desktop.ts` = 32 patches / 19 removals, `desktop-patch-set.test.ts` rebuilds
from the pinned base and finds no drift, `check:repo` and `check:cursor-parity` green. Receipt:
[`evidence/dead-code-retirement-2026-09-17/`](evidence/dead-code-retirement-2026-09-17/).

### The decision pass: what Cursor actually does, and what Caret chose (2026-09-17)

The user asked what they had to decide, then answered. Each one is now a fact in §5/§10 or a change
in the tree, so a later session does not re-derive it:

- **The Agent Host is gone from the window's decision surface.** `0032` gained a second half: the
  desktop DI shim returns the base's `NullAgentHostService` for the local branch, so asking for that
  host yields one sentence instead of a utility process that dies on boot and a
  "failed to start" banner. 25 injection sites stay; nothing enables agent-host features, so none
  resolves the client eagerly. §10 item 22 closed.
- **The IDE window keeps its dock, and the Agents window keeps its panel.** Measured for the first
  time: Cursor's IDE window has a live chat surface too (`workbench.panel.aichat`,
  `workbench.panel.aichat.view`, a `Hide Chat` command) beside the buttons that open the Agents
  window (`workbench.agentsWindowButton.enabled`); so the dock is parity, not surplus.
  The reference's Agents-window chrome is `Hide Sidebar` plus `Enter Full Screen` / `Hide Apps` in
  the panel header — no Show Panel or Toggle Side Panel — and the user chose to keep Caret's current
  panel regardless. Both are recorded in §5.
- **The composer's mode chips are measured, not guessed.** The reference has real modes, not
  decoration: `Plan New Idea ⇧Tab` and `Multitask` are CTAs on a mode state (`composerMode.multitask`,
  `cycleMode`, `changeToAsk`/`changeToDebug`/`changeToMultitask`), each mode carrying its own
  placeholder and description. They stay unrendered in Caret until a mode exists whose Plan and
  Multitask paths map to real OMP behaviour. §10 item 11 states the closure.
- **The terminal decision is split.** The workbench keeps xterm.js (recorded in §5); only the iOS
  WebView terminal is still open. §10 item 30.
- **Two things are deliberately left alone.** The Copilot-named helper files are referenced, not
  dead (§10 item 26 now carries the counts), and `opencode-go/union-alpha` stays a visible dead row
  rather than Caret inventing catalog policy (§10 item 31).
- **The AX/DOM comparison has a tool.** `scripts/agents-chrome-inventory.ts` parses the captured
  reference tree into a control inventory, captures the Caret side over CDP, and reports the
  reference controls that Caret lacks; it exits non-zero on any. §10 item 16 carries the remaining
  half — nobody has run it against a live window yet.
- **`.omp/` is not repository content.** A byte-identical copy of the global
  `~/.omp/agent/config.yml` (provider credentials included) had been left in the tree; it is removed
  and ignored, with `.omp/config.yml` — the one file OMP reads at project scope — excepted so a
  shared project config stays committable. `.agents/AGENTS.md` is committed, because
  `~/.agents/AGENTS.md` is a symlink into this repository and that file is the shared policy.

Receipt: [`evidence/dead-code-followup-decisions-2026-09-17/`](evidence/dead-code-followup-decisions-2026-09-17/).

## 10. Open work (the only authoritative list of what is not done)

Anything not listed here is either done (§9) or out of scope (§5). Each item states what closes it.

**S2 — provider completeness**

1. Tool calls, permissions, approvals, attachments, images, abort/steer and multi-turn have none
   of them been exercised on the Agents-window path. Close by running a turn that produces a tool
   call and a permission prompt from the on-screen composer, with a receipt.
2. The provider-level catalogue fetch at start can lose a race with a host refresh
   (`Caret could not list OMP models: Refresh the task before submitting this command`), leaving
   the option-group picker empty at boot. The language-model provider resolving later masks it, but
   a retry is needed.
3. A session with **0 events** still shows the base's welcome (`Build with Agent` /
   `Generate Agent Instructions`) instead of Caret's chat view. This is the real remaining S2
   blocker at the UI level (6 of 9 sidebar rows were in this state).
4. The composer in draft state (no session) is `0×0` and disabled. Showing a model before there is
   work needs a read path not tied to a session, e.g. a host-owned route.
5. Choosing a model in the picker and verifying that `set_model` actually writes has not been done.
   (Distinct from model *roles*, which were added and seen on screen on 2026-09-16 — see §9.)

**Model roles (opened 2026-09-16, see §9)**

6. `caret.models.configureRoles` assigns roles, but it has not been driven from the running window
   (EditContext inputs defeat synthetic keys; Screen Recording is not granted). Close by invoking it
   with real input and capturing the result. An **inline** role chip needs a desktop patch to render
   a second option group, which the base does not do today.
7. `cycleOrder` is read but not enforced by any Caret control, and path-scoped `enabledModels` was
   never exercised.
8. `task.agentModelOverrides` (per-subagent routing) and the `advisor` runtime are untouched
   surfaces.
9. The role tooltip wording (`Roles: Fast`) was not visually verified; only the row detail was.

**S3 — remove the webview shell**

10. What is left is exactly the dock: `webview.ts` (2,836 lines), `TASK_WEBVIEW_CSS`, the
    `caretComposerDock` view, its restricted-mode renderer and the ~8 shell-bound tests. They can
    only be deleted once an IDE-side replacement for the dock's capability exists
    (`caret.focusDock`, `focusAgentSurface()` and the `prefill` handoffs from IDE actions). Until
    then `rg "webview.ts|TASK_WEBVIEW_CSS"` is not 0 and S3's exit gate is open. **Closed
    2026-09-17, out of this item:** the `caretComposer` view and its `caretAgents` container, the
    `caret.agentsShell` editor, the fallback panel, the duplicate `caret.openTask` command and the
    fork's `caret.openAgentsWindow`/`caret.openIde` island are gone — those were the *second*
    agent surface for one window, not the dock. The same pass deleted the unreachable
    new-window path they belonged to (`openCaretAgentsWindow`, `writeCaretAgentsWorkspace`,
    `serializeCaretAgentsWorkspace`): nothing called it, and `caret.showAgents` already opens the
    window through the base's own command. `CARET_AGENTS_WORKSPACE` stays as a recognised identity,
    because a build before that date could have left `caret-agents.code-workspace` on disk.

**S4 — remaining parity**

11. The composer still lacks the `High` reasoning popup and the `Plan New Idea`/`Multitask` chips.
   The effort chip needs a provider config action (the same S2 gap as the model picker). **The two
   mode chips are now measured, not guessed** (2026-09-17, from the reference's own AX tree and its
   bundled composer): the reference has a real mode system, not decorative chips —
   `Plan New Idea ⇧Tab` and `Multitask` are calls to action attached to a mode state
   (`composerMode.multitask`, `cycleMode`, `changeToAsk`/`changeToDebug`/`changeToMultitask`), and
   each mode carries its own placeholder and description (`Coordinate tasks` /
   `Orchestrate multiple subagents in parallel` for Multitask, `Ask questions` /
   `Answer questions without making edits` for Ask; the window's own placeholder reads
   `Plan, Build, / for skills, @ for context`, which Caret already copies). Closes with a composer
   mode in Caret whose Plan path maps to a real OMP behaviour (a plan-first turn over `ompPlan`) and
   whose Multitask path maps to parallel subagents (§10 item 8); until both exist the chips stay
   unrendered, because a chip that changes nothing is the fake button §5 forbids.
12. The reference's chip draws a chevron; Caret uses an icon and no chevron.
13. What the reference puts under the `Changes` entry is unknown (AX only gives the entry name), and
   our Changes pane is a changes view rather than a multi-diff, and the File pane is an empty state
   + Search Files rather than a tree. A real session with changes has never been used to verify
   either.
14. The reference has no Show Panel / Toggle Side Panel buttons in this window; ours do because they
    share layout actions with the IDE. **Decided 2026-09-17: keep the current panel** — the user
    chose not to remove the toggle or add the reference's `Hide Apps` / `Enter Full Screen` to the
    panel header. Recorded as a deviation in §5 rather than left open; it becomes live again only if
    the panel is rebuilt (§7's React pass).
15. `--caret-*` is not injected at the workbench level (the extension cannot write CSS into the
    workbench DOM), so the token layer currently relies on CSS fallbacks that a test pins.
16. **AX/DOM comparison against the reference has never been run against a live Caret window.** It is
    the real decider for "identical" (§11 gate 2) and the largest single verification gap in the
    project. The comparison tool now exists: `scripts/agents-chrome-inventory.ts` (reference, from
    the captured Cursor tree; Cursor's chrome is 45 controls, and the two layout controls §10 item 14
    keeps are absent from the reference — a test pins both facts). The capture half is what remains:
    run `capture <debugPort>` against a launched Caret with `--remote-debugging-port`, or capture the
    same AX tree with Computer Use, then read the `missing from Caret` list.
17. Vision-side verification is repeatedly unavailable (the image tool answers HTTP 429), so no
    pane's colour, type or spacing has ever been checked against a picture.

**Chrome decisions (closed 2026-09-16, see §9)**

18-21. All four Copilot-flavoured controls are decided and hidden in the Agents window —
    `Configure Tools…`, the Permission picker, `Configure Custom Agents…` and the empty `Chats`
    group. Receipt: `evidence/agents-chrome-decisions-2026-09-16/`. **Still open from that work**:
    the mode menu's `Ask / Edit / Agent` modes are unverified as to whether they change anything OMP
    does (the real mode work is the reference's `Plan`/`Build` chips, item 11 above), and the IDE
    window's copies of these controls were not exercised on screen because its chat is disabled by
    default in this fork.

**Agent Host (Caret does not run it)**

22. ~~`0032` stops the window from starting the base Agent Host, but the client and the
    `IAgentHostService` singleton registration are untouched.~~ **Closed 2026-09-17** by the first of
    its two options: the desktop DI shim now returns the base's `NullAgentHostService` for the local
    branch, so a surface that asks gets one sentence
    (`Caret ships no agent host: OMP is the only harness this build runs.`) instead of a utility
    process that dies on boot. The remote branch is untouched. The 25 injection sites that made
    "remove the Copilot services the node graph still requires" the expensive option stay as they
    are; nothing enables agent-host features in this build, so none of them resolves the client
    eagerly. `0032` carries both halves.

**S5 — mobile**

23. Not started. The iPhone is a projection of the same session (relay/approval/replay) and needs a
    receipt from a real iPhone on cellular.

**Sessions**

24. Delete is Agents-window-only: the shell (the IDE window's Caret composer) session menu still
    offers Archive and no Delete, although the host route now exists. Add it there, or record that
    the shell stays archive-only.

**Repository hygiene**

25. The brand/icon work in the working tree (`assets/brand/**`, iOS icons, `scripts/lib/app-icon.ts`,
    `scripts/build-caret.ts`) is uncommitted and must be committed as one set, otherwise HEAD and
    the tree disagree.
26. Copilot-named helper files that are not the harness remain as naming debt. **Checked 2026-09-17:
    they are not dead code.** `copilotManagedSettings` is referenced by 35 files, `copilotCliEventsUri`
    by 18, `copilotCliConfig` by 12, and only two files have no importer at all
    (`src/typings/copilot-api.d.ts`, a type-only declaration, and
    `src/vs/sessions/copilot-customizations-spec.md`, a spec). Decided: keep them, because renaming
    referenced upstream files is rebase churn that buys nothing, and the files that die with the
    Agent Host (item 22) leave with it. Re-count before any rename pass.

**Terminal (Ghostty VT)**

The evaluation and the corpus are landed (§9 item 16). These two items are what the numbers
opened; each states what closes it.

27. **Serialized terminal state on the host/mobile path.** *(Both halves landed 2026-09-16 — §9,
    "The host keeps a terminal checkpoint" and its client half in `evidence/mobile-terminal-checkpoint-2026-09-16/`:
    the host keeps the screen, serves `GET /v1/sessions/:id/terminals`, and the phone seeds its
    renderer from it instead of asking OMP for a redraw.)* What is left: a receipt from a real
    iPhone over the relay (the closure the item always stated), cell styles in the checkpoint (it
    carries text and a cursor today, so a seeded screen has no colours), and a component test for
    the mount wiring. Keep OMP as the PTY owner: the host keeps state, it does not start a second
    shell.
**OMP runtime line**

29. **Closed 2026-09-16** (§9, "Caret follows the OMP line"): the baseline is a floor, not a pin,
    so a runtime newer than `18.1.18` runs and a newer-than-baseline release is judged by its
    `ready` frame and the three contract suites rather than by its number. The surviving work is
    different and smaller: `patches/omp/` still applies to the 18.1 source, so a *shipped*
    runtime update — building and contract-testing a newer patched OMP and refreshing
    `docs/UPSTREAM-LOCK.md` — is what a Caret release must do when it adopts a newer OMP, and a
    stock newer runtime keeps the Caret bridge surfaces off until then.
30. **Renderer decision for the terminal Caret owns.** **Split decided 2026-09-17.**
    The workbench half is closed: the IDE window keeps xterm.js, recorded as a deviation in §5,
    because replacing it drags the xterm-specific addons (image, ligatures, search, serialize, the
    terminal API) out with it for no user-visible gain while Cursor parity is the goal. What is still
    open is the half Caret renders itself, the iOS WebView terminal
    (`apps/ios/src/components/VirtualTerminal.tsx`, xterm.js 6.0.0 bundled into the document):
    it closes with a candidate engine passing every required case in the corpus
    (`apps/macos/src/terminal-conformance.ts`, report attached) and the mobile terminal switched with
    a real-device receipt.

**Model catalogue (opened 2026-09-16)**

31. ~~`opencode-go/union-alpha` is a dead row in the picker.~~ **Decided 2026-09-17: leave the row,
    take no action in Caret.** The facts are unchanged (OMP routes the gateway-first id to chat
    completions, which Zen answers 500, and its `/messages` lane did not answer within 100 s, while
    the same model on `opencode-zen` was put on the working route by operator config — §9, "Zen's
    free stealth model in OMP"), and any gateway model published after the pin lands the same way.
    Hiding the row would be Caret inventing catalog policy, which the plan forbids in `patches/omp`;
    the working twin is already reachable. Act only on a deliberate OMP pin bump whose upstream
    catalog carries the pin.

## 11. Acceptance criteria: "identical to Cursor"

The project only claims parity when every criterion below passes. Each is binary and has a stated
method, so there is no room for a judgement call.

1. **Tokens** — `bun run check:cursor-parity` passes (340 keys, 0 mismatches). **Currently passing.**
   A SKIP because Cursor is not installed does not count.
2. **Surfaces** — every row of §3 exists and its geometry and colour are measured from the real DOM
   or compositor at the same viewport and theme as Cursor. Looking at it is not measurement, and a
   single screenshot is not a pass. Colour must be compared with the §3.1 method (full-screen
   capture containing both apps, or theme-file values verified against a full-screen capture);
   `screencapture -l` alone is invalid.
3. **SSOT** — one responsibility has exactly one live path (§6) **and the retirement ledger (§6.2)
   is empty**.
4. **Honest states** — everything not yet possible is disabled with a reason; there are no fake
   buttons.

## 12. Risks that affect whether the result will really match

| Risk | Effect if unaddressed | Mitigation |
|---|---|---|
| The base's Agents window is bound to Copilot (harness + auth gate + `node/copilot/**`) | The window opens but stalls at sign-in with none of our sessions | S1 must remove every Copilot provider first; prove with AX that no gate remains. **Closed 2026-09-14.** |
| Caret's provider was not written | An empty, unusable window | Do S2 before S3/S4. **Closed 2026-09-14/16 for the basic path; see §10.** |
| IDE syntax token colours are still Code-OSS (licensing) | The IDE will not match Cursor with code open | Decide the licensing question or author our own token palette |
| Some geometry has token ≠ rendered value (e.g. sidebar row 30 vs 28) | The numbers look right but the eye sees a difference | Trust the rendered value and record it in §3.1 |
| Two tasks on the same repo | Duplicated, overwritten or colliding rebuilds | Clear per-file ownership and one task at a time (see §6) |
| A DOM-level probe cannot see native overlays (browser pages, menus over them) | "Verified" states that a real click invalidates | Test anything painted over native bounds with real input only (§9 item 8) |
| The image tool is unavailable, so nothing is checked visually | Colour/type/spacing drift goes unnoticed while the numbers are "measured" | Treat vision as a required check, not a nice-to-have; a picture is the only way to close §11 gate 2 fully |

**Short answer:** the spec matches Cursor at the level of information architecture, structure,
behaviour and colour tone, and the SSOT is settled. "The result will look the same" is **not**
guaranteed until §11 gate 2 passes — the AX/DOM comparison is the decisive check and it has never
been run. Everything the plan claims is verified is listed with a receipt in §9; everything else is
listed in §10.
## 13. Evidence index

Every receipt under `docs/maintenance/evidence/` is listed exactly once: either inline in §9
(where it backs a specific landed claim) or in this index. A receipt that appears nowhere is a
defect, because an unindexed run is a run whose result nobody can find.

**Agents window and Agent Home parity (2026-09-15/16)**

| Receipt | What it records |
|---|---|
| [`agent-home-ide-entry-2026-09-15`](evidence/agent-home-ide-entry-2026-09-15/) | The IDE entry opens an editor window and returns to it (patch `0015` correction) |
| [`agent-home-no-bottom-panel-2026-09-15`](evidence/agent-home-no-bottom-panel-2026-09-15/) | The Agents window has no bottom panel |
| [`agent-home-project-menu-2026-09-15`](evidence/agent-home-project-menu-2026-09-15/) | The project row right-click menu matches the reference |
| [`agent-home-project-remove-2026-09-15`](evidence/agent-home-project-remove-2026-09-15/) | Remove Project really removes the row, and the desktop patch set applies from the pinned base |
| [`agent-home-sidebar-projects-2026-09-15`](evidence/agent-home-sidebar-projects-2026-09-15/) | The sidebar's Projects section is the reference's header, and projects stay the session groups |
| [`agent-home-window-parity-2026-09-15`](evidence/agent-home-window-parity-2026-09-15/) | No bottom panel, one IDE entry, a real New Project and the user's own theme, together |
| [`agents-show-apps-removed-2026-09-16`](evidence/agents-show-apps-removed-2026-09-16/) | The `Show Apps` title-bar icon removed: it could only close a panel that was already the active editor |
| [`apps-panel-browser-search-2026-09-15`](evidence/apps-panel-browser-search-2026-09-15/) | The Apps panel's address bar searches, not just navigates |
| [`apps-panel-browser-suggest-2026-09-15`](evidence/apps-panel-browser-suggest-2026-09-15/) | The address bar completes what is typed, from the search engine |
| [`s4-apps-panel-browser-visible-2026-09-15`](evidence/s4-apps-panel-browser-visible-2026-09-15/) | A `+`-opened browser tab is actually visible |
| [`caret-host-lifetime-2026-09-15`](evidence/caret-host-lifetime-2026-09-15/) | Caret stops when it is closed: the host no longer outlives the app |
| [`react-agent-surface-decision-2026-09-15`](evidence/react-agent-surface-decision-2026-09-15/) | The evidence behind §7's React decision |
| [`model-roles-surface-2026-09-16`](evidence/model-roles-surface-2026-09-16/) | OMP's configured model roles appear on the model picker rows; the read/write surface added to the pinned OMP patch |
| [`agents-chrome-decisions-2026-09-16`](evidence/agents-chrome-decisions-2026-09-16/) | The four Copilot-flavoured composer controls decided and hidden in the Agents window |

**OMP native tool smokes (2026-09-13)**

All of these run a real OMP subprocess against the pinned patched runtime with temporary fixtures
and no provider credentials, and record `paidModelCalls` and `sourceRevision`.

| Receipt | What it records |
|---|---|
| [`omp-rpc-2026-09-12`](evidence/omp-rpc-2026-09-12/) | Provider-free probe of the installed OMP binary; source of the RPC inventory |
| [`omp-native-permission-2026-09-13`](evidence/omp-native-permission-2026-09-13/) | The native permission ClientBridge (`bun run smoke:omp:permissions`) |
| [`omp-native-editor-2026-09-13`](evidence/omp-native-editor-2026-09-13/) | The native editor bridge |
| [`omp-native-ast-2026-09-13`](evidence/omp-native-ast-2026-09-13/) | The native AST tool path |
| [`omp-native-ast-headless-2026-09-13`](evidence/omp-native-ast-headless-2026-09-13/) | The AST path in headless mode |
| [`omp-native-ast-headless-reject-2026-09-13`](evidence/omp-native-ast-headless-reject-2026-09-13/) | The headless AST path rejecting an invalid request |
| [`omp-virtual-ui-2026-09-13`](evidence/omp-virtual-ui-2026-09-13/) | Virtual TUI transport (`CARET_RPC_VIRTUAL_UI=1`) against the dev launcher |
| [`omp-o11-2026-09-13`](evidence/omp-o11-2026-09-13/) | The O11 command set |

**Desktop shell and parity passes (2026-09-12 → 2026-09-14)**

| Receipt | What it records |
|---|---|
| [`mac-build-2026-09-12`](evidence/mac-build-2026-09-12/) | A clean Mac baseline build of the retained Code-OSS fork |
| [`mac-packaged-startup-2026-09-13`](evidence/mac-packaged-startup-2026-09-13/) | Packaged startup checks (extension activated, upstream agent host not started, no missing WASM) |
| [`packaged-caret-2026-09-13`](evidence/packaged-caret-2026-09-13/) | The packaged Caret.app runtime, with the OMP and host hashes |
| [`packaged-shell-2026-09-13`](evidence/packaged-shell-2026-09-13/) | Packaged verification of the spec-aligned Agents shell (after the D01/D02/C01 restore) |
| [`portable-runtime-2026-09-13`](evidence/portable-runtime-2026-09-13/) | The portable runtime, including a relocated path containing a space |
| [`ui-cursor-parity-2026-09-13`](evidence/ui-cursor-parity-2026-09-13/) | Agents shell parity pass 1: sidebar IA and empty-draft composition against measured Cursor |
| [`ui-parity-sweep-2026-09-14`](evidence/ui-parity-sweep-2026-09-14/) | Parity sweep: Agents window against §3 plus IDE window boot and cleanliness |
| [`ui-process-2026-09-13`](evidence/ui-process-2026-09-13/) | UI plan process: local implementation |
| [`ui-shell-runtime-2026-09-13`](evidence/ui-shell-runtime-2026-09-13/) | UI shell packaged runtime: chrome fix, window review, Copilot error attribution |
| [`d19-ca-2026-09-13`](evidence/d19-ca-2026-09-13/) | Behavioural gap fixes CA-01..CA-06 (composer gating, pairing entry, first Files open, non-Git review, task-actions menu, idle composer) plus a packaged rebuild |

**IDE-native shell work (2026-09-14)**

| Receipt | What it records |
|---|---|
| [`ide-native-shell-2026-09-14`](evidence/ide-native-shell-2026-09-14/) | Why the packaged app did not behave like Cursor on a rebuilt bundle, and what fixed it |
| [`ide-native-agents-first-2026-09-14`](evidence/ide-native-agents-first-2026-09-14/) | Why the app looked unchanged, and what makes the first screen match the reference |
| [`ide-native-cursor-palette-2026-09-14`](evidence/ide-native-cursor-palette-2026-09-14/) | Why the window still read as upstream VS Code, and the measured chrome fix |
| [`ide-native-agent-mark-2026-09-14`](evidence/ide-native-agent-mark-2026-09-14/) | The agent mark in the packaged app editor |

**S2 picker and binding (2026-09-14)**

| Receipt | What it records |
|---|---|
| [`s2-composer-picker-2026-09-14`](evidence/s2-composer-picker-2026-09-14/) | Composer prompt path and the OMP model picker binding in the native window |
| [`s2-picker-binding-2026-09-14`](evidence/s2-picker-binding-2026-09-14/) | The picker lists the OMP catalogue with zero Copilot surfaces |
| [`s2-writethrough-login-2026-09-14`](evidence/s2-writethrough-login-2026-09-14/) | A picker choice reaches the host as `set_model`; auth awareness from OMP terminal logins |

**S3**

| Receipt | What it records |
|---|---|
| [`s3-shell-retired-in-agents-window-2026-09-14`](evidence/s3-shell-retired-in-agents-window-2026-09-14/) | The legacy webview shell no longer mounts inside the native Agents window |

**Runtime, mobile and relay (2026-09-12/13)**

| Receipt | What it records |
|---|---|
| [`g0-omp-2026-09-12`](evidence/g0-omp-2026-09-12/) | The G0 adapter smoke against installed OMP |
| [`g1-omp-2026-09-12`](evidence/g1-omp-2026-09-12/) | The adapter against installed OMP 18.1.18 from the pinned source |
| [`mobile-build-2026-09-13`](evidence/mobile-build-2026-09-13/) | Expo build checks: dependency check, tests, typecheck, web export, iOS prebuild; native build and device acceptance **not run** |
| [`mobile-terminal-browser-2026-09-13`](evidence/mobile-terminal-browser-2026-09-13/) | A desktop-Chromium run of the terminal browser fixture — **not** an iPhone or cellular run |
| [`mobile-terminal-recovery-2026-09-13`](evidence/mobile-terminal-recovery-2026-09-13/) | Mobile test and typecheck state; native iPhone verification **not run** |
| [`remote-gateway-2026-09-12`](evidence/remote-gateway-2026-09-12/) | Continuity gaps reproduced without changing production code |

**External reading**

| Receipt | What it records |
|---|---|
| [`external-orca-review-2026-09-16`](evidence/external-orca-review-2026-09-16/) | A reading of `stablyai/orca` against this plan, with observations separated from inferences. **It has no authority**: it is input, not a requirement |

**Hazard for every receipt above**: one that records a *negative* or *not-run* result (mobile device
acceptance, vision checks that answered 429, a probe that could not observe a native overlay) is
exactly as valuable as a passing one. Never read a receipt as a pass unless it says `pass`, and
never delete one because its result was inconvenient.
