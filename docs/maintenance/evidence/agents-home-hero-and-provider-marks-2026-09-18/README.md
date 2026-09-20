# The Agents home leads with the Caret mark, and the picker's rows carry their provider's mark (2026-09-18)

Starting point: the user asked (a) for the chat surface to look like the Codex/Synara reference,
(b) to know why the model picker showed neither provider icons nor a provider split, and (c) to add a
reasoning control beside the model picker. This receipt covers (a) and the icon half of (b), and
records exactly where the remaining two stand.

## What landed, and the live evidence

App: `/Users/pond/caret/VSCode-darwin-arm64/Caret.app` (`com.caret.editor`), launched by
`bun scripts/launch-caret-personal.ts`. Patch stack: base `ea1912fd6a05` + `0001..0044`
(`bun run check:packaged` OK, `desktop-patch-set` green, `bun run test` 896 pass / 0 fail,
`ci-validate` CI-OK).

1. **The empty Agent Home leads with the mark and a question.** `caret-home-hero.png`: a 30px Caret
   mark and the heading `What should we build in caret?` sit above the composer, the way the
   reference apps open a draft. New patch `0042-caret-home-hero` (new CSS file plus a render hook in
   `newChatWidget.ts`), scoped so an in-session composer and the web-only no-agent-host body keep
   their own layout.
2. **Every model row carries the provider's own mark.** `caret-picker-provider-marks.png`: the
   OpenRouter rows show the globe and the Cursor row the Claude mark, where every row used to share
   the picker's generic sparkle. Cause and fix: the Agents-window picker builds its rows from
   Caret's projection of OMP's `models` option group (`getCaretSessionOptionModels`, patch `0011`),
   and that projection never set `statusIcon`, so the workbench fell back to its own heuristic,
   which only knows Claude/Gemini/Kimi/xAI/Microsoft/OpenAI. Patch `0011` now copies the mark off the
   model Caret registered for the same id, and `0041` teaches that heuristic the providers this
   window actually runs (Cursor, OpenRouter, OpenCode, Command Code) so a tab or a badge that only
   has a name to go on still gets the right mark.
3. **The Agents window uses the provider-tabbed picker.** New patch `0040`:
   `chat.experimentalModelPicker` gets `agentsWindow: { default: true }`, the fork's documented way
   to default a setting per window (the neighbouring `chat.experimentalSessionsWindowPreview`
   override is the precedent). The tab bar, the per-row provider label and the search view that
   names each row's provider all come with it; `0044` stops the built-in destination from appearing
   as an empty tab (and from sizing the popup) once a host supplies destinations of its own.

## Still open, with the cause measured

1. **The tab bar collapses to one `Caret` tab.** `caret-picker-provider-tabs.png` is that state. The
   rows the picker receives are the *registered* vendor rows (`vendor: 'caret-omp'`, no
   `modelGroup`), so `getProviderGroupForModel` has nothing finer than the vendor's display name to
   group by. The projection in `0011`/`0043` writes the provider into `vendor` and `modelGroup` from
   the option item's `description`, and that does not survive to the picker: the extension's own
   note in `apps/macos/src/chat-sessions.ts` records that an option item's `description` is
   tooltip-only. The documented channel is `IChatSessionProviderOptionItem.modelMetadata.vendor` —
   the field the base's own session picker reads in `chatSessionPickerActionItem.ts:173`. Next
   change set: publish `modelMetadata: { id, name, vendor: provider }` on each item in
   `modelPickerGroupFromSnapshot` and read `item.modelMetadata?.vendor ?? item.description ??
   item.detail` in the projection, then re-shoot the tab bar.
2. **The reasoning control has nothing to show, not nowhere to render.** The extension publishes the
   `reasoning` group only from OMP's answer for a *host session*
   (`apps/macos/src/chat-sessions.ts:555`), and only when that answer carries a ladder
   (`thinkingFromOmpState` accepts `thinkingLevels` / `thinking_levels` / `availableThinkingLevels` /
   `available_thinking_levels`). Measured in the host journals
   (`~/Library/Application Support/Caret/host/sessions/*/session.jsonl`): OMP does track levels —
   23 `thinking_level_change` events, `thinkingLevel: "high"` for `openrouter/aion-labs/aion-2.0` and
   `null` for `commandcode/deepseek/deepseek-v4.1-flash`. So a ladder exists for some models but the
   field the extension reads is not the one OMP answers with. Live check: switching a session from
   `DeepSeek V4.1 Flash (Command Code)` to `Aion-2.0` left the composer showing only `Models`, i.e.
   the honest-disabled path rather than a rendering gap. Next step is to capture OMP's raw
   `get_state` answer and either read the ladder from the field it really uses, or stop claiming a
   ladder exists.

`caret-picker-provider-marks.png` was taken with `chat.experimentalModelPicker` set to `false` for
the comparison, and that override has since been removed, so the packaged default (provider tabs in
the Agents window) is what the next launch shows.

## Second pass (2026-09-19): the home's shape, and where the reasoning chip really stops

Owner requests this pass: drop the "Send your first prompt" card, put the draft composer low in the
window like the reference, and answer two questions about the composer's controls.

1. **The starter card is gone.** `0023-caret-agent-home-composer-starters` became
   `0023-caret-agent-home-composer`: the patch no longer adds the prompt-option controller, its
   contribution or the exported starter set, and no longer imports itself from
   `sessions.desktop.main.ts`. It keeps only the reference composer card's sizing stylesheet, whose
   import moved into `0042`'s render hook. The live window shows no `Send your first prompt` card.
   `apps/macos/test/ide-native-workbench.test.ts` now asserts the absence (the patch carries one file
   and neither `createStandardPromptOptions` nor `setPromptOptionsController`).
2. **The composer sits low, with the mark and question floating above it.** `caret-home-composer-low.png`:
   the hero is mounted as a sibling *before* the composer column and carries `margin: auto 0 92px`, so
   the free space collects above it and the composer lands one card-height above the bottom edge. The
   first attempt mounted the hero inside the composer column, which put the question *below* the
   composer (measured, corrected in the same day's next build).
3. **Why the picker rows and the pill now carry the right mark** is the first half of this receipt;
   the provider *split* is item 46.

## Where the reasoning chip stops, measured this pass

OMP's catalogue advertises each model's ladder, and that is the only place it does: the probe
(`/tmp/caret-probe-models.ts`, run against the live host) prints
`thinking: {"defaultLevel":"high","efforts":["low","high","max"],"mode":"effort"}` for
`deepseek/deepseek-v4.1-flash` and `{"efforts":["minimal","low","medium","high"],"mode":"effort"}` for
175 of 873 rows, while a `get_state` answer carries `thinkingLevel` and no ladder at all. The
extension now parses that ladder (`normalizeOmpModels`), publishes a `reasoning` group from it, and
applies a draft's pick at session creation (`applyDraftThinkingChoice`), and `0046` opens the option
picker slot in the Agents window (it was gated on `lockedToCodingAgent` / the welcome state, so a
published group was silently unrendered) while `0045` keeps the `models` group out of it, since the
model control is the language-model picker.

The chip is still absent, and the log says why: the only publication point a draft reaches is the
provider-level catalog (`getChatSessionInputState` is not called before a session exists — measured
with a temporary log, no `Caret input state:` line in the extension log for an untouched draft), and
that catalog builds the group from the *probe* session's model (`snapshot.selectedModelId`), not from
the model the composer's pill shows. When the probe's model is one OMP advertises no ladder for, no
group is published — which is the honest outcome for that model but also the reason the chip is
missing next to a pill that names a model which does have a ladder. The next change set is to
re-publish the group when the composer's model option changes (`provideHandleOptionsChange` already
receives that pick) so the chip follows the model, which is what the extension's own comment always
intended.

## Third pass (2026-09-19): Caret draws its own picker in the Agents window

The owner asked for the reference's structure rather than another attempt at the base's component
("why is it still not matching — can we take theirs?"). Cursor's own composer was measured live for
the comparison (`Cursor Agents` AX, Cursor 3.20.21): it has **no model control at all** — the model
and the permission level live inside one `Add agents, context, tools` popup, and only the reasoning
level (`High`) and voice are drawn — which is why its order differs from the owner's request.

So the Agents window now draws Caret's own control (`0047-caret-own-model-picker-in-agents-window`):
`caretModelPicker.ts` builds one row per OMP provider — the provider's mark, its name, its model
count — whose submenu is that provider's models (the platform's action widget supplies the popup,
the keyboard and the submenu), plus an `Effort` row fed by the per-model reasoning ladder whenever
one is published. `modelPickerWidget.ts` calls it from `show()` when Caret's catalogue is present
and leaves the base's picker untouched everywhere else. `caret-own-provider-picker.png` is the live
result: `commandcode 71`, `cursor 119`, `google-antigravity 20`, `openai-codex 5`, `opencode-go 30`,
`opencode-zen 10`, `openrouter 528`, each with its own mark.

Two things this pass changed to make that possible, both measured rather than assumed:

1. **The provider is carried on the row's `detail`.** The picker receives the *registered* rows, and
   for them `vendor` is fixed to `caret-omp` and `modelGroup` cannot be set through the extension API
   at all (the API has `statusIcon` and no group field), while the option-group store is empty for a
   pristine draft — which is why three earlier attempts at provider identity never reached the rows.
   `omp-language-models.ts` now puts the provider in `detail` (`"<roles> · <provider>"`), the one
   free-form line the workbench draws beside a name and hands to every picker.
2. **The earlier attempt to read Caret's option groups from the picker was dropped** for the same
   measurement: `getOptionGroupsForSessionType` is keyed by the content provider's type and holds
   nothing before a session exists, so the picker draws from the model list it always has and uses
   the option group only for the reasoning ladder when it is present.

Still open from this pass: the `Effort` row does not appear yet (it needs the ladder published for
the model the composer has picked, which is item 47's remaining half), the permission control is
absent by design until OMP advertises a policy (item 49), and the Environment sheet is item 50.
