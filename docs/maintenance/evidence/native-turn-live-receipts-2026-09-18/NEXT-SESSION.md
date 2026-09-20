# Caret handoff - 2026-09-18 (session 3)

This in-repo copy exists so the handoff survives the OS temp directory being cleared; the canonical
copy is
`/var/folders/r7/96w_6l296fnck1z_4vnydbp80000gn/T/opencode/caret-handoff-2026-09-18-session3.md`.
Delete this file when item 45 closes.

## Where things stand

- Checkout `/Users/pond/caret`, branch `main`, HEAD `e0a02ad8c6e`, large uncommitted working tree
  (previous sessions plus this one). Nothing was committed (repo rule: commit only when asked).
- Health at handoff, all re-run just now and green:
  - `bun run test` 885 pass / 0 fail (97 files).
  - `bun run typecheck` clean; `node scripts/ci-validate.mjs` CI-OK (evidence 90, doc-links 160).
  - `bun run check:packaged` green: patch set `74c6ca5cbb28`, 36 patches, base `ea1912fd`.
  - `bun test apps/macos/test/desktop-patch-set.test.ts` 0 fail.
  - `bun run check:cursor-parity` OK (340 keys, 0 mismatches; shell tokens 46).
- Exactly one Caret: `/Users/pond/caret/VSCode-darwin-arm64/Caret.app` (`com.caret.editor`). Daily
  driver `bun scripts/launch-caret-personal.ts`; a `kill` (SIGTERM) leaves a "window terminated
  unexpectedly" sheet on the next launch, dismiss it with `Reopen`. Cursor 3.20.21 is installed at
  `/Applications/Cursor.app`. The app on disk was repackaged from the current source and relaunched;
  no probe logging is left in the tree.

## Landed this session (receipts in the repo)

1. **Item 44 closed**: the Apps panel stays the pane while a session is open. Patch `0021` was
   re-cut (it owns `agentHomeUtility.contribution.ts`) and `0039` added for
   `singlePaneDockedTabsCoordinator.ts`; rebuilt, packaged, and receipted live with the four-pane
   strip `Changes · Browser · Terminal · File` on a cold launch, an empty draft and an existing
   session, plus a real `zsh` tab in the panel.
   Receipt: `docs/maintenance/evidence/apps-panel-stays-with-session-2026-09-18/`.
2. **Item 45 opened** (new): a live turn ran a model the composer never showed and its provider
   failure was never rendered. Receipt:
   `docs/maintenance/evidence/native-turn-live-receipts-2026-09-18/` (host journal, extension logs,
   Caret and Cursor AX/screenshots).
   - **Failure rendering closed and live-receipted**: the rate-limited turn now paints
     `**Caret stopped this turn.** Connect error resource_exhausted: ... ERROR_RATE_LIMITED ...` in
     the transcript instead of an empty chat. The session *row* still reads `In Progress` /
     `Completed` rather than failed; that half is host-side.
   - **The label/pick half is the next task** (below), measured down to its mechanism.
3. **Item 11's reasoning half landed and unit-verified**: a second session option group `reasoning`,
   built by `thinkingPickerGroupFromParams` from OMP's own `get_state` answer for the session's
   *current* model (`fetchOmpThinking` -> `thinkingFromOmpState`), applied through
   `set_thinking_level` only after re-checking that OMP still advertises that level for that model,
   and nothing published at all when OMP advertises none (no invented Fast/High). Live positive path
   not yet seen: the model measured advertised no levels, which is the honest-disabled path.
4. **iOS VM route evaluated and deliberately paused**: `Lakr233/vphone-cli` can carry the
   engineering half of items 23/27/30/39/41 but has no cellular radio, so it cannot produce item
   23's stated receipt. The user chose option 1 (a physical iPhone still closes item 23) and held all
   mobile work until the desktop items are done; no VM was created and no SIP/AMFI change was made.
   Receipt: `docs/maintenance/evidence/ios-vm-evaluation-2026-09-18/`.

## The next task: item 45's desktop half (the blocker)

Measured this session, do not re-derive:

- The composer's model control is the workbench's own picker. Picking a model there changes only the
  pill's label: the session journal gained no `model_change` and the extension log recorded no
  `set_model` attempt.
- On the participant path `request.model.id` was `claude-4.6-opus-high` (what Caret publishes from
  OMP's `get_state`) while the pill displayed a different model.
- `applyRequestedModel` (extension, `apps/macos/src/chat-sessions.ts`) already writes the attached
  model when it maps to OMP; it logged `did not apply ... not in OMP's catalogue` for that id, i.e.
  the attached model is not the pick.
- So what runs is Caret's published selection and the user's pick is decorative, which violates §11
  gate 4, and a working model therefore cannot be chosen from this window.
- First attempt at the honest removal (`isUserSelectable: false` in `omp-language-models.ts`) builds
  and packages but **fails the pinned contract test** `Caret language models ... registers the OMP
  catalogue under the vendor the pickers prefix with`
  (`apps/macos/test/ide-native-workbench.test.ts`). It was reverted and recorded in the item-45
  evidence README under "Hand-off note for the desktop fix".

Pick one route and do all of its parts together:

- **(a) remove the control** (Cursor's Agents composer has no model pill): a desktop patch hiding the
  Sessions-window model picker, `isUserSelectable: false` in the extension, and updating that pinned
  test with the reason; then `cd desktop && npx gulp vscode-darwin-arm64-min` (~3.5 min),
  `CARET_HOST_NODE=~/.caret-tools/node-v24.18.0-darwin-arm64/bin/node bun run package:mac`,
  `bun run check:packaged`, and a live receipt; or
- **(b) wire it**: find where the workbench attaches the model to a Caret chat request and make that
  id the one Caret writes to the host. Note `desktop/**` is partially redacted.

Any desktop patch: `.patch` files carry real tabs, so generate with
`git -C desktop diff -- <paths>` and write the file verbatim; re-cut the patch that owns the file
(`0021` owns `agentHomeUtility.contribution.ts`) because a later patch cannot modify a file another
patch creates; then update the manifest sha256 and run the patch-set test.

A successful live turn additionally needs a model that is not out of quota: OMP's default is
`cursor/claude-4.6-opus-high`, which is exhausted. Items 1/32/33/34/35 are implemented and
unit-verified and only need that live receipt.

## What is left, in priority order

1. Item 45's desktop half, then the live receipts for items 1, 32, 33, 34 and 35.
2. Items 16 and 42: the same-state AX/DOM comparison and the §3 re-baseline to Cursor 3.20.21. Both
   sides of the empty-draft capture already exist (`reference-cursor-empty-draft.ax.txt` and
   `caret-draft-empty.ax.txt` in the item-45 receipt).
3. Item 38 (task-level checkpoint/rollback), item 43 (MCP servers and hooks have no OMP RPC surface;
   Customize counts not fed), item 10 (delete the webview dock once an IDE-side replacement exists),
   item 37 (browser bridge and host URI schemes need real consumers), item 36 (the rest of
   settings/discovery), item 12 (chip chevron), item 5a(a) (draft workspace picker), item 5a(c)
   (starter cards), item 4 (draft composer 0x0 and disabled), item 5 (live `set_model` for an
   existing session), items 6-9 (model roles driven from the window, `cycleOrder`, per-subagent
   routing, tooltip wording), item 13 (Changes/File panes with a session that really has changes),
   item 15 (`--caret-*` at workbench level).
4. Hygiene: item 25 (the brand/icon work is uncommitted, and in fact the whole tree is), item 26
   (Copilot naming debt, decided keep), item 29 (the OMP pin-bump procedure).
5. Mobile 23/27/30/39/41: paused by decision until the desktop work is done; the VM route is
   evaluated in `docs/maintenance/evidence/ios-vm-evaluation-2026-09-18/` and needs the owner's
   Recovery-mode SIP/AMFI step if it is ever taken.

## Traps worth keeping

- The AX tree cannot show composer text. To type: click the `editor (settable)` node whose
  description contains `Placeholder: Describe what to build` (there is another such node in the
  transcript area), put the text on the clipboard with `pbcopy`, press `Cmd+V`, and confirm by the
  Send button becoming enabled. `sky.paste` times out but usually lands.
- The composer pill's AX reads `<group name>, <selected item name>`, which is why "Models, DeepSeek
  V4.1 Flash" could be either Caret's option group or the workbench picker; that ambiguity is the
  first thing route (b) has to settle.
- OMP's advertised catalogue changed during the session (871 -> 780 -> 871 models), and
  `~/.omp/agent/config.yml` is a dangling symlink while the `cedia` checkout has its own
  `.omp/agent/config.yml` staged as deleted. Control for that when measuring model ids.
- `thinking-params.ts` accepts four field spellings for levels
  (`thinkingLevels`/`thinking_levels`/`availableThinkingLevels`/`available_thinking_levels`); OMP
  advertised none for the cursor model.
- One subagent spawned this session (an explorer) errored on a provider usage limit, so delegation
  needs usage headroom.

## Suggested skills

- `astra-orchestrator` for the patch/rebuild/verify job; `verification-before-completion` before
  claiming item 45 or the receipts closed; `codex-computer-use` for the live window; `debug-mantra`
  or `systematic-debugging` for the `request.model` investigation; `handoff` when ending the session.

## Update (session 4, 2026-09-18): the pick reaches the host; the row's provider is what blocks it

Re-measured live on the packaged build at patch set `74c6ca5cbb28` (fourth pass's "the pick is
decorative" reading was taken at pick time; the write belongs to the send):

- Picking in the composer's model control is a **workbench** selection
  (`[ChatModelSelection] event=set-model surface="workbench" widgetViewKind="quick"
  model="caret-omp/deepseek/deepseek-v4.1-flash"`), and nothing reaches the host at that moment.
- **Sending** applies it: `Caret participant turn for session ddfcd677-…`, then the host journal's
  `model_change {model: "openrouter/deepseek/deepseek-v4.1-flash"}`. The model the composer shows is
  the model the turn runs.
- That turn's failure rendered: `**Caret stopped this turn.** 401 User not found.`
- The pick resolved to **openrouter**, a provider this machine has no credentials for, while
  `commandcode` (configured in `~/.omp/agent/models.yml`) advertises the same model id.
  `ompModelRowForPick` takes the first exact id match, so an ambiguous id silently names one
  provider, and the composer's featured list cannot show which.

The next change set is therefore (a) make `ompModelRowForPick` refuse an ambiguous id unless OMP's
own answers single one out, saying so in the transcript, and (b) let the composer show each row's
provider. Receipts for this pass are in `README.md` ("Fifth pass") and
`renderer-model-selection-live-pick.txt`, `extension-log-live-pick.txt`,
`host-session-ddfcd677-live-pick.jsonl`, `caret-live-pick-run.ax.txt`/`.png`.

## Update (sessions 4-5, 2026-09-18): what is now in the tree, and what is next

Everything here is extension-side unless stated; the desktop patch stack is unchanged at
`74c6ca5cbb28` (36 patches) and `check:packaged` is green. `bun run test` 892 pass / 0 fail,
`typecheck` clean, `ci-validate` CI-OK, app repackaged and relaunched after each change.

**Landed**

1. **A pick that names more than one provider is refused, not guessed** (`chat-sessions-map.ts`):
   `uniqueRowForPick` prefers the provider the picker drew for the row, then the only row OMP reports
   as runnable, otherwise nothing; `resolveOmpModelPickProvider` no longer falls back to the id's own
   prefix when the catalogue names that id but cannot single out a provider. Both `set_model` paths
   send the catalogue row's own model id, and `applyRequestedModel` says so in the transcript.
2. **Every provider keeps a row when a model id is shared** (`ompModelRows`): the first row of a model
   id keeps OMP's id, later rows take their provider-qualified selector, and a label two providers
   would share gets the provider appended. Live: `873 advertised by OMP` / `873 rows after collapsing
   OMP's duplicate ids`, **zero** `already registered. Skipping.` warnings where the same run class
   produced about twenty, and the picker now offers `DeepSeek V4.1 Flash (Command Code)` - a row that
   used not to exist. Choosing it recorded `model_change commandcode/deepseek/deepseek-v4.1-flash` and
   **completed the turn** (`assistant commandcode ... stop | caret-live-ok`).
3. **The dock's model picker is Caret's own control now** (`webview.ts`): a trigger with the provider
   mark, the model label and a chevron, opening a searchable panel with a header per provider, a row
   per model (`Current`, or the reason a row is unusable) and **the provider's own glyph on every
   row** - `apps/macos/src/provider-icons.ts`, generated by `scripts/generate-provider-icons.mjs` from
   `@lobehub/icons-static-svg@1.95.0` (MIT): 27 glyphs over 34 provider ids, monogram fallback where no
   mark exists. The mark is the provider (which API runs the model), not the vendor, matching Synara's
   picker rows (`ComposerModelPickerRow.tsx:75`).
4. **The extension logs the catalogue's providers**, so the next session does not have to guess:
   `Caret language models: 7 provider(s): openrouter(528), cursor(119), commandcode(70), opencode-go(30),
   google-antigravity(20), opencode-zen(10), openai-codex(5)`. Only `commandcode` has no bundled mark
   (404 for every spelling in the icon package) and keeps the `CC` monogram.

**Next, in order**

1. **Capture the dock picker's screenshot** - the one receipt still outstanding. Its catalogue is
   session-scoped, so: select a task **inside the dock's own session list**, then Add -> Model, then
   open the trigger. (Opening the task from the dock's "Caret ready" button lands in the Agents window
   instead; three attempts went there.)
2. **The Agents-window picker** - the pill in that window is the workbench's `chatInputPart` widget and
   cannot render provider tabs or marks without a desktop patch. The Synara-shaped panel (provider tabs
   -> sections per upstream -> rows with trait rows, ⌘1..⌘9, one shared provider-mark helper) belongs in
   the React surfaces Caret already mounts in the sessions window (`agentHomeNavReact.ts`,
   `appsPanelReact.ts`, `agentHomeContextRowReact.tsx` use `createRoot`). Reuse `providerGlyphMap()` and
   the `chipFor` shape from the dock; keep the identity OMP's.
3. **Item-specific live receipts** on the path that now completes turns: item 1 (tool call, permission
   prompt, abort/steer, multi-turn) and items 32-35 (approvals, streaming, attachments, tool work).
   Use `commandcode` rows or another provider this machine can authenticate.
4. Then the earlier list stands: items 5+6-9 (roles/`cycleOrder`/per-subagent routing from the window),
   4, 5a, 12, 13, 15, the §3 re-baseline (16/42), 38/43/10/37/36/41, hygiene (25/26/29), and mobile
   (23/27/30/39) which stays paused by decision.
# Caret handoff - 2026-09-18 (session 3)
