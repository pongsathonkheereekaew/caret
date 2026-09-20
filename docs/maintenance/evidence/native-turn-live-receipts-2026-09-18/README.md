# A live turn ran a model the composer never showed, and its failure was never rendered (2026-09-18)

Found while starting §10 item 1's live receipts (a tool call and a permission prompt driven from the
on-screen composer). Item 44 landed earlier the same day; this is the first live turn taken since.

## What happened (one turn, packaged build, patch set `74c6ca5cbb28`)

`New Chat` on the draft over workspace `cedia`; the composer's model pill read `DeepSeek V4.1 Flash`;
the prompt was:

> Run the shell command `echo caret-live-ok` and show me its output. Then create a file named
> caret-live-permission.txt containing exactly: ok. Report both results.

The send created host session `8d8402c7-d803-43bf-aef2-97aada7c062c`, which recorded
(`host-session-8d8402c7.jsonl`):

```json
{"type":"model_change","model":"cursor/claude-4.6-opus-high","resolvedModelIsFallback":false}
{"type":"message","message":{"role":"assistant","content":[],"api":"cursor-agent","provider":"cursor",
 "model":"claude-4.6-opus-high","stopReason":"error",
 "errorClassificationMessage":"Connect error resource_exhausted: Error",
 "errorMessage":"... \"error\":\"ERROR_RATE_LIMITED\" ... \"You're out of usage. Switch to Auto ...\""}}
```

Nothing of that reached the window: the chat stayed empty, the session row read `Completed`, and the
composer had claimed a different model than the one that ran.

## Why (two defects, both in the extension; neither needs a desktop patch)

1. **Model binding.** A draft's catalogue comes from `fetchGlobalOmpModelSnapshot`
   (`apps/macos/src/chat-sessions.ts:281-297`), which probes the first non-archived session for a
   snapshot. That probe's `selectedModelId` is the bare `claude-4.6-opus-high` that OMP's `get_state`
   reports, while `get_available_models` lists the same model provider-qualified
   (`cursor/claude-4.6-opus-high`). `modelPickerGroupFromSnapshot`
   (`apps/macos/src/chat-sessions-map.ts:499-513`) finds no row for it and therefore publishes no
   `selected`. `applyDraftModelChoice` (`apps/macos/src/chat-sessions.ts:154-179`) reads the
   workbench's stored option, cannot resolve a provider for it, and logs
   `Caret kept the host's current model: the picked model 'claude-4.6-opus-high' is not in OMP's catalogue.`
   (`extension-log-caret.caret.txt`, last line) — so OMP's own default model ran instead.
2. **Error rendering.** `emitEntryUpdate` (`apps/macos/src/chat-sessions.ts:881-908`) renders an
   entry's text or a tool card. An error-terminated assistant message has empty content, so nothing
   is emitted and the turn reads as an ordinary completion.

## How Cursor does it (measured the same session, same state)

`reference-cursor-empty-draft.ax.txt` / `.png` are the running `Cursor Agents` window in the same
empty-draft state Caret was in. Its composer carries `Add agents, context, tools` ▾, `High` ▾ and
`Start voice input` and **no model pill at all**; its right pane is `splitter "Resize panel"` →
`container Panel editor-panel-group` → `tab group Tabs` holding a real instance tab (`Browser`), with
`combo box "Open new tab menu"`, `Enter Full Screen` and `Hide Apps`.

So the pill is Caret's own surface rather than a parity gap, and the rule it breaks is the project's
own §11 gate 4: honest states, no control that shows something other than what will happen. (The same
capture is the same-state reference §10 item 16 and item 42 ask for; Caret's side of it is
`caret-draft-empty.ax.txt`.)

## Fix direction

Neither half is a desktop change, so the loop is `bun run package:mac` plus a relaunch, not a
`gulp` rebuild:

- make the model id one thing: resolve a pick against the catalogue by exact id first and then by a
  unique provider-qualified suffix, publish a real catalogue row as `selected` so the pill and the
  bound value cannot disagree, and when nothing resolves, display the host's current model instead
  of the first row;
- render the failure: map an error-terminated assistant message to a visible error and the failed
  session state instead of an empty completion.

Both need OMP's real id shapes confirmed first (catalogue ids versus `get_state` ids), which is what
the next measurement is for; the plan forbids inventing catalog policy, so the resolution rule has to
follow what OMP actually reports.

## What was implemented, and what the second measurement returned

Implemented the same session (all extension-side, `apps/macos/src`):

- `chat-sessions-map.ts#ompModelRowForPick` — exact id first, then a unique provider-qualified
  suffix; an ambiguous suffix matches nothing rather than guessing a provider.
  `projectOmpModelSnapshot` and `modelPickerGroupFromSnapshot` both use it, so a current id that
  arrives bare still marks its catalogue row, and `resolveOmpModelPickProvider` uses it plus the
  leading segment of a qualified id, so such a pick can actually be applied. `applyDraftModelChoice`
  now sends the catalogue's own spelling of the resolved row.
- `chat-sessions-map.ts#entryFailureText` + `chat-sessions.ts#emitEntryUpdate` — a failed
  transcript entry with no text renders the provider's own message (`**Caret stopped this turn.** …`)
  instead of nothing.

Unit-verified: `bun run test` 883 pass / 0 fail (two new cases pin the bare-id row match, the
ambiguous refusal, and the failure text from a raw frame), `bun run typecheck` clean,
`bun run package:mac` + `bun run check:packaged` green at patch set `74c6ca5cbb28`.

**The second live measurement was a negative result, and it moves the remaining work.** After
re-packaging and relaunching, a fresh draft over the same window still shows the pill reading
`DeepSeek V4.1 Flash` while the session the previous send created ran `cursor/claude-4.6-opus-high`:
so the pill's *label* is not produced from the `models` option group's selection that this fix
corrects. The resolution fix still removes a real failure mode (a pick arriving in `get_state`'s
bare spelling used to be dropped and silently replaced by the host's model), but the label's real
source is still unidentified and needs one more measurement before the honesty half of item 45 can
be claimed — the candidates are the workbench's own remembered session-option value for the session
type, and the point at which Caret publishes the group into the session option state. The failure
rendering has no live receipt yet either: the new build has not been driven through a failing turn.

Environment note: the OMP catalogue changed between the two runs of this session (871 advertised
models, then 780), and `~/.omp/agent/config.yml` is a symlink whose target does not exist, while the
`cedia` checkout has its own `.omp/agent/config.yml` staged as deleted. Nothing here was touched, but
a changing catalogue is worth controlling for when measuring model ids.

## Second pass: the failure now renders (live receipt), and the label's source is the workbench

Two temporary probe logs in `getChatSessionInputState`/`applyDraftModelChoice` (removed again) plus one
more draft send answer both open questions. `probe-extension-log.txt` is that log; `probe2-draft.*`
and `turn2-after-send.*` are the states around the send.

**The failure rendering is fixed and receipted.** The same rate-limited turn now paints the
transcript instead of an empty chat:

```
**Caret stopped this turn.** Connect error resource_exhausted: Error [details: aiserver.v1.ErrorDetails:
{"error":"ERROR_RATE_LIMITED","details":{"title":"Increase limits for faster responses","detail":"You're
out of usage. Switch to Auto, or ask your admin to increase your limit to continue." ...
```

(`turn2-after-send.ax.txt` element 94/97.) So a turn that dies on the provider's side is now visible
with the provider's own sentence, which is what §11 gate 4 asks of a failed state.

**The pill's label is not Caret's published selection.** The probe shows what Caret publishes and what
comes back:

```
[model-label probe] hostSession=no current=claude-4.6-opus-high carried=- selected=claude-4.6-opus-high
  name=Claude Opus 4.6 1M first=claude-4-sonnet|Claude Sonnet 4 ; claude-4.5-opus-high|Claude Opus 4.5
[model-pick probe] picked=claude-4.6-opus-high id=claude-4.6-opus-high name=Claude Opus 4.6 1M
```

So the catalogue row exists (`claude-4.6-opus-high`, labelled `Claude Opus 4.6 1M`), Caret publishes it
as the group's `selected`, and the workbench hands the same id and name back at session creation -
while the same control draws `DeepSeek V4.1 Flash`, a label from a model the draft catalogue puts
third at best. The mismatch is therefore inside the workbench's session-option presentation (its
persisted option value's label), not in what Caret publishes or in what the host receives. The
remaining work on the honesty half is desktop-side: find where that control takes its label from
(and why the persisted name survives the provider's published `selected`), then either refresh it
with the group or, if the workbench cannot be made to re-render, stop publishing a model the user
believes is chosen elsewhere. Cursor is the reference for the end state here: its Agents composer
carries no model control at all, so "no model pill unless it is the thing that runs" is a legitimate
outcome.

## Third pass: the composer's model control is the workbench's picker, and its pick never ran

Opening that control (`pick3-after-pick.ax.txt`) shows a list that is not OMP's catalogue at all: its
rows are `Auto, openrouter`, `Claude Opus 4.6 1M, cursor`, `DeepSeek V4.1 Flash, opencode-go`
(marked **Current model**), `DeepSeek V4.1 Flash (Command Code), commandcode` and
`Muse Spark 1.3 Contributor, opencode-go` — the workbench's own language-model picker, fed by the
model providers the user has installed. So the pill can only be honest if the pick is written to the
host, which nothing did.

That is now wired: `ompModelForPickedLanguageModel` resolves the attached model against OMP's
catalogue and the participant handler — the path a submitted prompt actually takes, per the comment
on `createChatParticipant` — calls `applyRequestedModel` before `runTurn`, so the pick is applied when
OMP runs that model and an honest line is written when it does not. Two log lines from the live run
prove the path executes:

```
Caret participant turn for session faed46de-598c-4986-9086-3be53521e20b
Caret did not apply the composer's model 'claude-4.6-opus-high': it is not in OMP's catalogue.
```

And that second line is the surprising part: the model attached to the request is
`claude-4.6-opus-high` (what Caret published as the group's selection), not the
`DeepSeek V4.1 Flash, opencode-go` row the picker marks as current and draws in the pill. So the
composer's whole model affordance — the pill's label, the picker's "Current model" marker and the
user's pick — is stale in the workbench, while the model that actually runs is the one Caret
published from OMP's `get_state`. The turn therefore ran `cursor/claude-4.6-opus-high` again, which
is why it hit the same rate limit.

Recorded consequence: with a stale marker, a user cannot choose a working model from this window at
all, so items 1/32/33/34/35 cannot be receipted until either the workbench's selection is honoured or
the model is chosen somewhere the user can actually see take effect. The remaining honest options are
desktop-side: make the pill reflect the provider's published selection, or stop presenting a model
control whose pick has no effect.

## What this blocks

§10 items 1, 32, 33, 34 and 35 all close with a successful live turn. Until the turn above can
complete, those receipts cannot be taken.

## Fourth pass: the picker changes the label and nothing else

In an existing session (`ddfcd677-4ecc-412c-8751-a46bd653a1f5`) the composer's model control listed
`Auto` / `Claude Opus 4.6 1M` / `DeepSeek V4.1 Flash` (*Current model*, with `Pin Model`) /
`Muse Spark 1.3 Contributor` / `Other Models` / `Manage Language Models`, and picking
`Muse Spark 1.3 Contributor` changed the pill's label to that model. Nothing else happened: the
session's journal still holds exactly one `model_change`, the original
`cursor/claude-4.6-opus-high` at 02:34Z, and the extension log recorded no `set_model` attempt. The
workbench's language-model picker is display-only for this window, so the model a turn runs cannot be
changed from it — which is why every send in this session kept hitting the exhausted Cursor quota,
and why the live receipts for items 1/32/33/34/35 cannot be taken from this build until the
composer's model control is either wired to the host or removed.

## Hand-off note for the desktop fix (2026-09-18)

The first shape tried for removing the fake control — registering the OMP catalogue with
`isUserSelectable: false` in `omp-language-models.ts` so the composer stops offering rows whose pick
does nothing — builds and packages, but it fails the pinned contract test
`Caret language models ... registers the OMP catalogue under the vendor the pickers prefix with`
(`apps/macos/test/ide-native-workbench.test.ts`). So the change was reverted, not forced: removing
the control is a deliberate contract change that has to update that pin and say why, in the same
commit as the desktop patch, rather than a side edit to the extension.

## Fifth pass: the pick does reach the host, and the row it names may not be runnable (2026-09-18)

Measured on the packaged build (patch set `74c6ca5cbb28`) in an existing Caret session
(`ddfcd677-4ecc-412c-8751-a46bd653a1f5`, with the workbench's chat-input model control open).

**The composer's model control is the workbench's own picker, and its pick is not decorative.** Its
dropdown carries `Auto`, `Other Models`, `Pin Model` and `Manage Language Models`
(`pick3-after-pick.ax.txt`), which is the workbench's rich picker fed with OMP's catalogue - not
Caret's `models` option-group chip, whose items are drawn as a plain option picker. Picking a row
logs a workbench selection and nothing else:

```
[ChatModelSelection] event=set-model surface="workbench" sessionKey=undefined conversationKey=undefined
  modelTarget=undefined storageKey="chat.currentLanguageModel.panel" widgetViewKind="quick"
  model="caret-omp/deepseek/deepseek-v4.1-flash" isUserAction=true persistSelection=true
```

(`renderer-model-selection-live-pick.txt`.) No host write happens at that moment, which is what the
fourth pass measured - and it is not the moment the write belongs to. **Sending the prompt is**:
`extension-log-live-pick.txt` records `Caret participant turn for session ddfcd677-4ecc-...`, and the
host journal then holds

```json
{"type":"model_change","id":"86182395","parentId":"02d516a0","timestamp":"2026-09-18T10:23:28.341Z",
 "model":"openrouter/deepseek/deepseek-v4.1-flash","role":"default","resolvedModelIsFallback":false}
```

(`host-session-ddfcd677-live-pick.jsonl`.) The turn ran the model the pill showed, applied to the host
at send, so the affordance is honest in the direction that matters: the model the composer claims is
the model the turn runs. The fourth pass's "the pick is decorative" reading measured the pick instead
of the send, and the live run here corrects it.

**That turn then failed, and the failure rendered.** The assistant record is `provider: "openrouter"`,
`model: "deepseek/deepseek-v4.1-flash"`, `stopReason: "error"`, and the transcript painted
`**Caret stopped this turn.** 401 User not found.` (`caret-live-pick-run.ax.txt` and
`caret-live-pick-run.png`). That is a third failure shape for the rendering half - an auth failure
rather than the rate limit - and it reached the transcript instead of an empty chat.

**What is left is the row's provider, not the control.** `deepseek/deepseek-v4.1-flash` resolved to
`openrouter`, which this machine has no credentials for, while the same model id is also advertised
by `commandcode`, the provider the user has configured (`~/.omp/agent/models.yml`:
`commandcode.models[0].id: deepseek/deepseek-v4.1-flash`). `ompModelRowForPick` returns the *first*
exact id match, so an id that several providers advertise resolves silently to whichever row OMP
lists first. The user cannot tell the rows apart either: the featured list shows names only, so the
row labelled `DeepSeek V4.1 Flash` could be either provider's.

The remaining honest change set is therefore:

1. `ompModelRowForPick` must refuse an id that names more than one provider unless OMP's own answers
   single one out (an authenticated provider, or the qualifier in the pick), instead of taking the
   first row, and the refusal has to reach the transcript the way `applyRequestedModel` already does
   for an unknown model.
2. The composer has to be able to show which provider a row means - the option group already carries
   the provider as each item's `description`, and the featured list drops it.

Until that lands a pick can still name a model that cannot run, which is the state §11 gate 4
forbids and the reason the live receipts for items 1/32/33/34/35 stay blocked: a runnable row is
reachable (`DeepSeek V4.1 Flash (Command Code)`), but an ambiguous one wins first.

One fix was attempted and reverted here, recorded so it is not re-derived: making the bridge adopt
the host's published model as the session's model changed nothing the live run showed, and it could
clobber a confirmed pick, because the option group's published selection is not the pick. After the
revert, `patches/desktop/0010-caret-sessions-bridge.patch`, `patches/desktop/manifest.json` and
`apps/macos/test/ide-native-workbench.test.ts` are byte-identical to their session-3 state, and the
packaged patch set is `74c6ca5cbb28` again.

## Sixth pass: the safe half landed, and provider-qualified identity was measured and halted (2026-09-18)

**Landed and unit-verified: a pick that names more than one provider is refused, not guessed.** The
live 401 above came from `ompModelRowForPick` taking the *first* exact id match, and the catalogue
advertises `deepseek/deepseek-v4.1-flash` from both `openrouter` (no credentials here) and
`commandcode` (configured). The row lookup now disambiguates through OMP's own answers and the
pick's own provider: `uniqueRowForPick` prefers the provider the picker drew for the row, then the
only row OMP reports as runnable (`available !== false`, no needs-auth reason), and otherwise
returns nothing; `resolveOmpModelPickProvider` no longer falls back to the id's own prefix when the
catalogue names that id but cannot single out a provider (that is exactly the case where the rows
disagree). Both `set_model` paths now send the catalogue row's own model id rather than the pick's
spelling, and `applyRequestedModel` paints the choice in the transcript when a name is ambiguous
("More than one provider advertises ... pick the row for the provider you have configured").
`bun run test` 886 pass / 0 fail, `bun run typecheck` clean, `ci-validate` CI-OK, patch set
`74c6ca5cbb28` (36 patches) with the app repackaged and relaunched.

**Provider-qualified identity plus picker grouping: implemented, packaged, measured, reverted.** The
change made every row's identity OMP's own selector - the extension registered
`<provider>/<model id>` (`id: ompModelSelector(model)`), the option group's items and both workbench
projections followed, the resolver gained selector matching as a read-alias, and both projections
carried `metadata.modelGroup = { id: provider, sourceId: provider }` as a new patch `0040`. Two live
findings stopped it, and both are required for it to be shippable:

1. **The grouping never reached the picker.** The Agents window's composer lists the *registered*
   rows (its `[ChatModelSelection]` diagnostics carry `sessionKey=undefined`, so the projection that
   sets `modelGroup` never runs for it). The workbench groups registered rows only from provider
   *groups*, which come from the vendor descriptor's groups
   (`languageModelsService.getLanguageModelGroups(vendor)`, filled by
   `provideLanguageModelChatInfo({ group: group.name })` and drawn as the section headers/tabs -
   `showHeaders` needs more than one group). The extension-facing
   `LanguageModelChatInformation` has no group field. So grouping needs the vendor descriptor to
   declare one group per OMP provider (bridge, patch-side) and
   `omp-language-models.ts` to honour `options.group` when it lists models.
2. **The identity change strands every persisted selection.** `chat.currentLanguageModel.panel` and
   `.panel.caret.omp` in the Agents profile still held the pre-change ids, which no longer resolve,
   so both model-selection controllers stayed `selection="pending"` and the composer's send was
   silently blocked (`hasSendableModelSelection` gates on a pending selection). The change therefore
   needs the stored preferences and the stored session options migrated in the same patch, not just
   a read-alias in the resolver.

After the halt the tree is the session-3 state plus the landed refusal: `0010` is byte-identical to
session 3 (digest `6101ce98...`), `0040` is gone, the manifest is back to 36 patches, the desktop
shell was rebuilt and the app repackaged (`check:packaged` green) and relaunched. The one preference
the experiment wrote was repaired in place (`chat.currentLanguageModel.panel` ->
`caret-omp/aion-labs/aion-2.0`; backup at `/tmp/caret-state-before-cleanup.vscdb`).

## Seventh pass: every provider keeps a row when a model id is shared (2026-09-18, extension only)

The identity change above was reverted because it needed a migration. The same problem has a smaller
shape that needs none: keep OMP's own id for the **first** row of every model id, and give every later
row its provider-qualified selector. Nothing that was already picked or remembered changes spelling,
and the second provider's row stops being dropped.

`ompModelRows` (`apps/macos/src/chat-sessions-map.ts`) applies that to the catalogue once, and both
the registered rows (`omp-language-models.ts`) and the option-group items
(`modelPickerGroupFromSnapshot`) are built from it, so the picker and the option store agree on every
identity. A label two providers share gets the provider appended (`GPT-5.6-Luna · cursor`) only where
the labels would otherwise read the same; a row OMP lists twice for one provider is one row.

Receipts:

- Unit: `bun run test` 887 pass / 0 fail (the new case pins a three-way collision, the label rule, the
  same-provider duplicate, and that both spellings still resolve to their provider), `bun run typecheck`
  clean, `ci-validate` CI-OK, patch set unchanged at `74c6ca5cbb28` (36 patches), `check:packaged` green.
- Live (packaged build, relaunched): the extension log now reports
  `Caret language models: 873 advertised by OMP` and `873 rows after collapsing OMP's duplicate ids`,
  and the workbench logged **zero** `already registered. Skipping.` warnings, where the same class of
  run produced about twenty of them before (e.g. `[LM] Model caret-omp/gpt-5.6-luna is already
  registered. Skipping.`). The pool the picker draws from now carries both spellings of those models
  (`caret-omp/gpt-5.6-luna` and `caret-omp/openai/gpt-5.6-luna`, `caret-omp/meta/muse-spark-1.3` and
  `caret-omp/muse-spark-1.3`), so the second provider's row is selectable instead of absent.

**Click-through and a completing turn, live (same build).** Searching the picker for `Command Code`
now offers one row OMP does not otherwise expose - `DeepSeek V4.1 Flash (Command Code)` - and choosing
it and sending ran the turn on that provider instead of the credential-less `openrouter` row that the
same model id used to resolve to:

```
model_change -> commandcode/deepseek/deepseek-v4.1-flash   (host journal, 2026-09-18T12:53:01Z)
message user  ... Reply with exactly: caret-live-ok
message assistant commandcode deepseek/deepseek-v4.1-flash stop | caret-live-ok
```

Receipts: `host-session-82fd1d28-live-commandcode.jsonl`,
`extension-log-live-commandcode.txt`, `caret-live-commandcode-turn.ax.txt` / `.png` (the transcript
with the model's answer, session row `State: Completed`). This is the first turn this window has
completed since item 45 opened, so the pipeline a live receipt needs is whole again: picker row →
`set_model` on the named provider → streamed turn → transcript.

Still open: the item-specific receipts (item 1's tool call, permission prompt, abort/steer and
multi-turn; items 32-35's approvals, streaming, attachments and tool work) each need their own prompt
against this now-working path, and grouping rows by provider in that picker stays unreachable for
registered models (see the sixth pass) and belongs with the Caret-owned picker work in items 5-9.

## Eighth pass: the dock's own model picker groups by provider (2026-09-18, extension only)

The Agents-window pill is the workbench's picker and cannot be restyled without a desktop patch, but
the Caret **dock** is ours: `apps/macos/src/webview.ts` builds the composer bar, and its model control
was one flat `<select>` fed by `state.models`. `renderModels()` now builds one `<optgroup>` per OMP
provider (falling back to `Other` when a row reports none) and appends the reason to a row OMP reports
as unusable (`label · Provider is not authenticated`) instead of only greying it out, so the provider
a model would run on is visible where the model is chosen - the same distinction the Agents-window
picker gained in the seventh pass by giving duplicate ids their own rows.

**Then the control itself, with a provider icon.** `<optgroup>` cannot carry one, so the dock's
`<select>` became a picker the dock owns: a trigger button (same `model-select` id, so the composer
snapshot still disables it through `controls.modelEnabled`) showing a provider monogram chip, the
model label and a chevron, opening a panel with a search field, one header per provider (chip + name +
count) and a row per model (`Current` on the selected one, the reason on a row OMP reports as
unusable). The chip is the provider's initials on a hue derived from its id, because the dock ships no
brand marks: stable per provider, distinguishable at a glance, and honest about being a monogram
rather than a logo. Row identity stays OMP's, so `select_model` posts exactly what it did before.

**And the marks are real vendor glyphs now.** `apps/macos/src/provider-icons.ts` (generated by
`scripts/generate-provider-icons.mjs` from `@lobehub/icons-static-svg@1.95.0`, MIT) bundles 27 glyphs
covering 34 OMP provider ids - anthropic, openai/openai-codex, google, x-ai, meta, mistralai,
deepseek, z-ai, moonshotai, minimax, nvidia, cohere, amazon, alibaba/qwen, xiaomi, poolside, arcee-ai,
baidu, ai21, liquid, bytedance-seed, stepfun, upstage, tencent, openrouter, cursor, opencode-go and
more. The map travels with the snapshot, so the dock script stays framework-free and builds each mark
with `createElementNS` from path data (never markup). Both the composer trigger **and every row in the
picker list** draw through one `chipFor()` helper, and a provider with no bundled mark (measured:
`commandcode`, `inclusionai`, `xiaomi`) falls back to the monogram, so nothing is ever blank. The marks
are the vendors' own brand assets, bundled by that MIT package to identify the provider; they stay the
property of their owners.

`bun run test` 891 pass / 0 fail (98 files): `provider-icons.test.ts` pins the coverage list, the
geometry-only rule (`<` may not appear in a path), the fallback for an unknown provider, and alias
resolution (`openai-codex` -> `openai`, `zai-org` -> `z-ai`, `xai` -> `x-ai`); the webview pin covers
the `createElementNS` construction, the per-row mark and the shared trigger helper.

Two more receipts for that work, taken because the pixel one is still blocked (below):

- **Shipped artifact**: the packaged app's extension bundle carries the marks -
  `rg -l "M13.827 3.52" VSCode-darwin-arm64/Caret.app/Contents/Resources/app/extensions/caret/out/extension.js`
  (the Anthropic path) matches, so the icons are in the build that runs, not only in the source tree.
- **Payload correctness** (`bun run test` 892 pass / 0 fail): every bundled glyph has a real viewBox,
  at least one path, and path-grammar-only characters, because a glyph that is not valid path data
  would render as nothing at all, silently, in the picker.

**Still the missing receipt**: the dock's picker with those marks on screen. The dock's catalogue is
session-scoped (with no task open the extension has no OMP session to ask, so the trigger stays
disabled with "Choose a model. Use Add -> Model to refresh"), and the dock's own "Caret ready ... click
to open the task" opens the task in the Agents window instead of selecting it in the dock - three
attempts landed there. To capture it: select a task **inside the dock's own session list**, then
Add -> Model, then open the trigger.

## Ninth pass: how complete the marks are, measured against the live catalogue (2026-09-18)

The extension now logs the providers the catalogue actually uses, so this is measured rather than
assumed:

```
Caret language models: 7 provider(s): openrouter(528), cursor(119), commandcode(70),
  opencode-go(30), google-antigravity(20), opencode-zen(10), openai-codex(5)
```

- **6 of the 7 have a bundled mark**: `openrouter`, `cursor`, `opencode-go` and `opencode-zen` (the
  OpenCode mark), `google-antigravity` (Google's), `openai-codex` (OpenAI's).
- **`commandcode` has no mark anywhere**: `@lobehub/icons-static-svg@1.95.0` answers 404 for
  `commandcode`, `command-code`, `cmdcode` and `commandcodeai`, so its rows keep the initials monogram
  (`CC`). That is the honest end state until Command Code publishes a logo we can point at.
- **Rows wear the provider's mark, not the vendor's.** A vendor badge was tried and removed the same
  day: `openrouter` carries 528 of the ~880 rows, so a DeepSeek model served through OpenRouter showed
  DeepSeek's logo, which reads as "this runs on DeepSeek's API" when it does not. The mark answers the
  question this picker actually asks - *which provider will run this model* - so every row, the group
  header and the composer trigger draw the same provider mark, and the model's own name carries the
  vendor. The reference does the same: `ComposerModelPickerRow.tsx:75` in Synara resolves
  `PROVIDER_ICON_COMPONENT_BY_PROVIDER[row.provider]` for every row, with the same map the tab strip
  uses. `bun run test` 892 pass / 0 fail, `typecheck` clean, `ci-validate` CI-OK, `check:packaged`
  green (36 patches), app repackaged and relaunched, and the packaged bundle still carries the marks.

## Tenth pass: the panel became the reference's two-column shape (2026-09-18)

The owner supplied a screenshot of Synara's picker, and it settled the layout question: search across
the top, **providers down the left** (mark, name, count, chevron; the active one highlighted) and the
chosen provider's **models down the right** (name, `Current` or the reason a row is unusable, chevron).
Our panel was one flat list with headers, which meant scrolling 528 `openrouter` rows to find a model,
so it now matches: `#model-providers` and `#model-options` are two columns under a shared search field,
clicking a provider fills the model column, and a query searches **both** columns at once - matches
from different providers then show the provider on the row, because one column no longer stands for
one provider. Enter picks the first usable row; Escape and an outside click still close it.

What is deliberately different from the screenshot: no "Add Providers" row (our providers come from
OMP, there is nothing for the window to add), and the model rows do not repeat the provider mark
because the column already names it - the marks live on the provider rows and on the composer trigger,
which is what the icon is for. One helper call (`chipFor`) re-adds a mark per model row if that is
wanted. `bun run test` 892 pass / 0 fail (the pin now covers the two columns, the provider row, the
active-provider switch and the search placeholder), `typecheck` clean, `ci-validate` CI-OK,
`check:packaged` green, app repackaged and relaunched.

## Eleventh pass: the blank Agents window was a vendor-declaration race (2026-09-18)

The owner reported the Agents window with no chat box at all - an empty middle pane with the sessions
sidebar and the Changes/Browser/Terminal/File panel around it. It was not the picker work: the
extension log for that run (21:16) has the session-option lines but **no** `Caret language models: ...
advertised by OMP`, and the renderer log has one new line none of the seven previous runs had:

```
[error] Chat model provider uses UNKNOWN vendor caret-omp.
```

`registerLanguageModelProvider` (`languageModels.ts:1424`) throws while the vendor has no descriptor,
and the descriptor is declared by Caret's workbench bridge when the window restores
(`WorkbenchPhase.AfterRestored`) while the extension is activated as soon as the window asks for the
`caret.omp` session type. The two can cross; when they did, the extension's registration threw once,
its catch logged and gave up for the life of that window, no models were published, and the composer
had no model to attach - so it drew nothing.

The fix is order-independence on Caret's side: registration now retries on a bounded backoff
(`0, 120, 250, 500, 900, 1500 ms`) while the error is `UNKNOWN vendor`, fires the model-change event
once it lands (so an open picker re-reads the catalogue), and reports the honest failure line only when
the budget is spent. Two tests pin both ends of that: a stub that refuses the first two registrations
then succeeds (asserting the vendor is registered and the retry is logged), and one that refuses every
attempt (asserting no provider is registered and the failure is reported). `bun run test` 894 pass /
0 fail, `typecheck` clean, `ci-validate` CI-OK, `check:packaged` green, app repackaged and relaunched;
the next run logs the catalogue again (`873 rows`, `provider(s): openrouter(528), cursor(119), ...`)
with no `UNKNOWN vendor` line, and the Agents window's composer is present in the AX tree
(`editor (settable)`, `Models, DeepSeek V4.1 Flash`). The race is timing-dependent, so the unit tests -
not a lucky relaunch - are what prove the fix.

## Twelfth pass: why the Agents-window pill had no provider mark (2026-09-18)

The owner asked why the icon and the provider->models sub-list from Synara's picker do not appear in
Caret's chat UI. The answer has two halves, and both are structural rather than cosmetic:

1. **That control is not ours.** The pill in the Agents window is the workbench's `chatInputPart` model
   widget; Caret's own picker - the two-column provider list with the model fly-out, search, `Current`
   and the real brand marks - lives in the dock (`webview.ts` + `provider-icons.ts`). The workbench
   picker has no provider->model fly-out at all and cannot be given one without owning that control.
2. **The workbench picks a glyph from a hardcoded identity list.** `modelProviderIcons.ts` maps
   `vendor + family + id + name` substrings to claude / gemini / kimi / xai / microsoft / openai and
   falls back to a generic sparkle; openrouter, cursor, commandcode and the opencode providers matched
   nothing, and Caret had never sent the field the picker actually prefers (`getModelPickerIcon` =
   `metadata.statusIcon ?? heuristic`).

Changed (extension only, no desktop patch): Caret now sends `statusIcon` per provider -
openai-codex/openai -> `openai`, anthropic -> `claude`, google-antigravity -> `google-gemini`,
moonshotai -> `kimi`, x-ai -> `xai`, cursor -> `cursor`, openrouter -> `globe`, commandcode ->
`terminal`, opencode-go/zen -> `plug` - with `providerStatusIconId` in `chat-sessions-map.ts` (pure,
unit-tested) and the `vscode.ThemeIcon` built at the extension edge. `bun run test` 896 pass / 0 fail,
`typecheck` clean, `ci-validate` CI-OK, `check:packaged` green, app repackaged and relaunched;
`caret-agents-composer-provider-mark.png` is that window after the change.

**Still open, measured rather than assumed**: at this zoom the composer trigger still draws the generic
sparkle, i.e. the model the trigger holds carries no `statusIcon` yet. The likely cause is the pool's
merge with the cached model metadata (`chat.cachedLanguageModels.v2`, written before this change):
`getAllMergedModels` keeps the cached row for an identifier whose identity did not change, so the live
row's new field never reaches the picker. The next change is to let the live row win over the cached
one (or drop the stale entry) and re-shoot the pill; the picker's *rows* read `metadata.statusIcon`
directly (`modelPickerItemPrimitives.ts:156`), so they should show the provider mark as soon as the
same field survives the merge.

Verification: `bun run test` 888 pass / 0 fail with the pin on the chip, the group header, the reason
label and the row payload (`apps/macos/test/webview.test.ts`; the dock's radius scale is locked to the
reference, so the chip is 4px, not 5px), `bun run typecheck` clean, `ci-validate` CI-OK,
`check:packaged` green at patch set `74c6ca5cbb28` (36 patches, no desktop patch), app repackaged and
relaunched. Live: the control is reachable in the running app (`pop up button Description: Model`
inside the dock webview), but its catalogue is session-scoped - with no task open the extension has
no OMP session to ask, so the trigger stays disabled with "Choose a model. Use Add -> Model to
refresh" and the panel has **no screenshot receipt yet**. To capture it: open a task in the dock,
Add -> Model, then open the trigger.
