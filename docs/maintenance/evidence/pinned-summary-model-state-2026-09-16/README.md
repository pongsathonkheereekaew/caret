# The pinned summary's state belongs to the window, not the pane (2026-09-16)

The user asked what Cursor and Codex do with the pinned summary, and whether it should be a floating
window. The answer has two parts, and only the second is work.

## What the reference does: nothing

Cursor has no such feature. Its workbench bundle contains `Open new tab menu` (the Apps panel's `+`)
but no `Toggle Pinned Summary`, no `summary-pinned`, and no equivalent under any name we could
match. Cursor's right side is the panel; per-session information lives in the sidebar rows. The
summary is Caret's own, recorded as such in the plan's §4 (the surface Cursor does not have), and
the plan notes it was modelled on Codex rather than taken from the reference.

The Codex app itself could not be inspected: Computer Use refuses to read it (`not allowed to use
the app 'com.openai.codex' for safety reasons`), so nothing here claims anything about its window
behaviour beyond what the plan already recorded.

**Decision: it stays in the pane, and it does not become a floating window.** A floating summary
would be a third window over one session; the SSOT says one execution/transcript owner with the
windows as projections of it, so an always-on-top overlay adds a lifecycle to own (show/hide on mode
switch, on host restart, on display change) and, on macOS, native work rather than CSS. The case a
float would serve - seeing the summary while working in the IDE - is already the Caret dock's job in
the IDE window. What the pin is actually for is staying visible across pane changes, which is a
model problem, not a window one.

## The fix it needed

The pin was DOM-only: `toggleSummary` flipped `summary-pinned` on the pane's own element, the
summary was mounted per pane, and nothing stored the choice. Since the Agents window's layout
closes and re-creates non-docked editors when it collapses the editor area, the pane could be
rebuilt and the pin would go with it - the same failure the tab instances avoid by living in the
window-scoped `IAppsPanelModel`.

`IAppsPanelModel` now owns `summaryPinned` and `toggleSummaryPinned()`; the pane's `toggleSummary()`
calls the model, and `applySummaryPinned()` (run from `renderTabs`, so also on construction) mirrors
the model onto the panel element and the React strip button. Both files are created by patch `0021`,
so the change is folded into it.

## Verification

| check | result |
|---|---|
| `cd desktop && npm run typecheck-client` | 0 errors |
| packaged app, CDP | the toggle's pressed class and the summary strip's `display: flex` both follow the model; `No active session` is shown, which is correct for a window with no session |
| packages/app-host/macos suites, `prepare-desktop`, parity, `ci-validate`, repo `typecheck` | all green (736 tests, 27 patches / 18 removals, 340 parity keys) |
| needle pin | `apps/macos/test/ide-native-workbench.test.ts` pins `readonly summaryPinned: boolean;`, `toggleSummaryPinned(): void;`, `this.panelModel.toggleSummaryPinned();` and `private applySummaryPinned(): void {` in patch `0021` |

## Not verified

**The rebuild path itself was not reproduced.** Driving the side-panel toggle (hide then show) and
opening the File card left the panel element in place - a tag put on it before the round trip
survived both - so the pane was never actually torn down on screen. The fix is therefore verified by
construction and by the behaviour checks above, not by an observed teardown. Whoever reproduces a
real teardown (collapsing the editor area with a layout that drops non-docked editors, or the
Agents → IDE → Agents round trip with the panel on screen) should see the pin still on; if they do
not, the model is the place to look.
