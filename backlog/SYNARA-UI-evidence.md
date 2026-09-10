# Synara UI reuse evidence — inventory + tokens (2026-09-10)

Source: `~/caret-work/upstream-synara/apps/web` (React+Vite chat app,
MIT; component files carry no per-file headers — repo LICENSE covers;
T3 + Emanuele notices recorded in OPS inventory and retained).

## Component map (lift-later, not lifted)

| Synara | Caret need | Note |
|---|---|---|
| ChatView + logic/selectors + queuedAutoDispatch | typed timeline + queue | compare queue semantics at port time |
| ComposerPromptEditor + mentions + drafts | @ popover, draft persistence | Lexical — heavy; adopt patterns first |
| ChatMarkdown(.streaming) | narrative streaming | streaming stays daemon-gated |
| DiffPanel + logic | review surface | Monaco overlay is native-side work |
| BranchToolbar | worktree picker | our QuickPick covers V1 |
| BrowserPanel/DevicePanel | browser/design modes | P1, structures noted |
| theme/ (logic + seed catalog) | token system | namespace studied, engine NOT imported |

## Adopted now

`--agent-*` namespace extended to full §13 roles, every value resolving
from the active VS Code theme (real + adaptive today), all composer
rules converted (no literals left in the webview stylesheet). Deliberate
distance kept: Synara theme engine + Codex-styled skins stay theirs
(trade-dress caution per blueprint §20); frozen Cursor-3.19 values
replace ours when reference lands.

## Proven

`tsc` 0; grep audit (zero literal agent colors outside `:root`).

## Phase B vehicle (recorded in PARITY-ROADMAP)

Agents shell = React app (Synara-derived components) in an editor
webview panel + extension-host bridge to daemon RPC (webviews cannot do
raw TCP). Build toolchain (esbuild bundle into the extension) is the
next step, not this one.
