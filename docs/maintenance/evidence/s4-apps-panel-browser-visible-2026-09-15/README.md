# S4 — the Apps panel's Browser tab shows its page again (2026-09-15)

Symptom the user reported: `+` in the Agents window's right pane opened a Browser
entry, a tab appeared, and **no page was ever drawn**.

## Root cause

A hosted browser page is a native view drawn above the window's DOM, and its
model starts at `visible: false`
(`src/vs/workbench/contrib/browserView/common/browserView.ts`, `_visible = false`).
The pane wrote visibility in exactly two places — `applyActiveTab` (a tab switch)
and `setEditorVisible` (a pane reveal) — while `layoutBrowserTab` could only ever
write `false`, on a zero-sized rect. Opening a browser into a pane that had not
been laid out yet therefore ran:

1. `applyActiveTab` → `setVisible(true)` (async, not awaited)
2. `layoutBrowserTab` → zero rect → `setVisible(false)`
3. the pane's later `layout()` → bounds only, **never** `setVisible(true)`

and the view stayed hidden for good. Nothing re-runs `applyActiveTab` for a tab
the user is already looking at.

## Fix (inside `patches/desktop/0021-caret-agent-home-utility.patch`)

- The pane tracks its own visibility (`isEditorVisible`), set in
  `setEditorVisible` and cleared in `detachInstances`.
- A zero rect only hides a tab the user is **not** looking at; the pane's own
  `layout()` shows the active one once it has bounds.
- Visibility is established before bounds are pushed:
  `setVisible(active).then(() => model.layout(bounds))`.

## Why the fix is not its own patch

`scripts/prepare-desktop.ts` proves "already applied" by reverse-checking each
patch **on its own**. Patch 0021 *creates* `agentHomeUtilityEditor.ts`, so its
reverse-check deletes that file and verifies its content; any later patch to the
same file makes that check fail by construction. This was found the hard way —
a separate `0027` was written, `prepare-desktop` went red, and the fix was folded
into 0021 (digest updated, 0027 removed). Recorded in the plan so the next slice
does not repeat it.

## Verification

- **Not verified on screen.** This environment cannot keep a dev build alive
  across tool calls, and the failure is a visibility flag on a native overlay,
  which a DOM read cannot see. What is proven here is the source shape and that
  the patch set reproduces the tree.
- `bun scripts/prepare-desktop.ts` → `24 patches, 18 removals` (green).
- Forward-apply of the full set onto a clean worktree at `ea1912fd6a0` produces a
  `agentHomeUtilityEditor.ts` byte-identical to the working tree, i.e. the patch
  set reproduces the tree again.
- `apps/macos/test/ide-native-workbench.test.ts` pins both the new source lines
  and 0021's digest (54 tests pass); `bun run typecheck`, `check:repo` and the
  full suite (730 tests) are green.
- **Still open**: a live run that opens `+ → Browser`, types an address and sees
  the page, plus the tab-strip alignment the user reported (browser/terminal tabs
  not sharing a baseline). Both need the packaged app on screen.
