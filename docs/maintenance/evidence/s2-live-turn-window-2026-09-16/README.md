# Attempting a live turn from the Agents window (2026-09-16) — it did not pass, and the real cause was found

Goal: close S2's "still missing: a live turn in the real Agents window" gap by typing a real prompt
into the Agents window's composer and watching the transcript stream back.

**Result: no turn happened** — no request reached the extension at all (the extension log was
silent, the host had no new `prompt` command, and the session count stayed at 9) ⇒ **not a single
provider credit was spent**, and the user's approval was not consumed either.

## What is confirmed (for real)

1. **Text really can be entered**: the text was exactly in the composer
   (`[...document.querySelectorAll(".view-line")]` → `"Reply with exactly this line and nothing else:
   caret live turn ok"`) and the Send button went from disabled to enabled (AX: `button Send` with no
   `(disabled)`), `.chat-submit-button` had neither the `disabled` class nor `aria-disabled`.
2. **CDP really does reach the DOM in this window**: clicking a child of the button produced real
   `mousedown`/`click` on the element (confirmed with an attached listener), and clicking another DOM
   button in the same window worked (rail `File` → a `caret-apps-tab` "File" appeared) ⇒ the input
   path is not dead across the whole window.
3. **But submit is never dispatched**: (a) a CDP trusted click on `.chat-submit-button`,
   (b) a CDP click on the inner `.action-label`, and (c) a real `Return` key through Computer Use
   ⇒ nothing happened and the text stayed in the field.

## What was found along the way (more valuable than the turn)

**A session with no turns uses the base's welcome input, not Caret's chat view**

| State opened | What the window showed |
|---|---|
| A session with 0 events (6 of the 9 sidebar rows) | `Build with Agent` · `AI responses may be inaccurate` · `Generate Agent Instructions to onboard AI onto your codebase` — the base's welcome/onboarding, and that surface's Send button does nothing in Caret |
| A session with a transcript (`Caret live turn check`) | `onboarding: false` with 5 `.interactive-item-container` items ⇒ a real chat view with the provider's composer |

⇒ The Send button that would not fire belongs to the **empty-session surface**, and even after
opening a session with history the submit was still not dispatched, which points at **the composer's
submit action not being bound to Caret's provider** — this is the true S2 blocker, not OMP or
credentials.

## Measurable limits of the test method

- **CDP cannot enter text into Monaco here**: Monaco in this window uses the **EditContext API**
  (`div.native-edit-context`); `Input.insertText` and `Input.dispatchKeyEvent` (both `char` and
  `keyDown`+`keyUp`) leave the editor unchanged ⇒ typing tests must use real keys only.
- **Real keys require the window to be frontmost**: `sky.type_text`/`press_key` work when the window
  is raised (through Window menu → Agents) with nothing stealing focus in between, and my own tool
  calls can steal it ⇒ "raise → act" must happen in a single call (proved to work: the text did land
  in the composer).
- `sky.paste` failed with `Timed out waiting for the application to read the clipboard` when the app
  was not frontmost.

## Not done / next steps

1. Find why `chat-submit-button` does not dispatch: read the base's `ChatSubmitAction` /
   `chatInputPart` to see what it checks before sending (the focused widget, `chatSessionType`, the
   agent host that died) — if the action references the base's agent host, which broke when we
   removed Copilot, it needs a patch to route through Caret's provider instead.
2. After the fix: open a session with history (not an empty one) and send one short prompt ⇒ only
   then spend the user's still-unused approval.
3. Separate question: what a session with 0 events should display (hide it from the sidebar, or use
   Caret's own surface).

## Raw evidence

- Everything was checked through the host API (no token printed), the CDP DOM, and the Agents
  window's AX.
- No prompt, no response, no credential and no session content was recorded in this receipt.
