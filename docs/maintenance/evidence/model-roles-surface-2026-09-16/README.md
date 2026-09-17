# Model roles surface — 2026-09-16

The user runs several models through OMP and asked whether a team-config distributor (Tencent's
`teamai-cli`) could help with that, then chose to build the model-role surface in Caret instead.

## The finding that shaped the work

OMP already has the whole model-role system: `modelRoles`, `modelTags`, `cycleOrder`,
`modelRoleStorage`, nine built-in roles (`default`, `smol`, `slow`, `vision`, `plan`, `commit`,
`tiny`, `task`, `advisor`) plus custom ones, resolved by `src/config/model-roles.ts` and
`settings.ts`, with `getRoleModelCycle`/`cycleRoleModels` driving the TUI carousel.

**What was missing was any way to reach it from outside the TUI.** The complete RPC command set is
46 types and contains exactly five model/thinking commands — `set_model`, `cycle_model`,
`get_available_models`, `set_thinking_level`, `cycle_thinking_level` — and `get_state` reports only
`model` and `thinkingLevel`. A host could either read `config.yml` itself and reimplement OMP's
layer resolution, or the role surface could be added to OMP's RPC. Section 6 of the plan forbids a
second owner of any responsibility, and reimplementing the merge order is exactly the divergence
that caused the model-picker bug, so the surface went into Caret's pinned OMP patch.

Rejected alternatives, both measured rather than assumed:

- **Reading `~/.omp/agent/config.yml` from the host** — would miss runtime overrides and duplicate
  OMP's global/project/overlay resolution.
- **`omp config get/set --json`** — works (whole-record set succeeds; dotted keys such as
  `modelRoles.smol` are rejected), but it costs a process per read and replacing the whole record
  clobbers a concurrent external edit to a sibling role. OMP's own `setModelRole` persists
  per-role for precisely that reason.

## What shipped

| Layer | Change |
|---|---|
| `patches/omp/0001-caret-rpc-bridges.patch` | Two commands: `caret_get_model_roles`, `caret_set_model_role`; `RpcReadyFrame.caretModelRolesVersion: 1` |
| `packages/omp-adapter` | Both in `CARET_UI_COMMAND_TYPES`; per-capability gating via `#caretCommandAdvertised` |
| `apps/macos/src/chat-sessions-map.ts` | `normalizeOmpModelRoles`, `rolesByModelSelector`, `annotateModelsWithRoles`, `modelRoleLabel`, request builders |
| `apps/macos/src/chat-sessions.ts` | `fetchOmpModelRoles`; the option catalog annotates the rows the picker already shows |

The projection lists only roles that resolve to a model (an empty role is not a capability), leads
with `cycleOrder` because that is the order the switcher steps through, resolves `@role` aliases so
an aliased role is not silently lost, and keys grouping on `provider/id` because OMP's catalog can
carry the same short id under two providers.

## Verified

The prepared runtime (`sourceTree 5b257fa1f1c1226397d838e4b9a54c0b4ca7ff14`) answered with the
user's real configuration — `cycleOrder [smol, default, slow]` and four roles, all
`source: global`. A same-value write round-tripped and left `config.yml` byte-identical. Driving the
catalog and roles through the real adapter's own projection produced the rows the picker now shows:

```
Grok 4.6                            cursor
DeepSeek V4.1 Flash (Command Code)  commandcode · Default
Muse Spark 1.3 Contributor          opencode-go · Architect
DeepSeek V4.1 Flash                 opencode-go
GPT-5.6-Luna                        openai-codex · Fast
GPT-6-Astra                         openai-codex · Thinking
```

The user's stock OMP binary advertises no marker and refuses the command, so a patch command is
never sent to stock OMP.

## Seen on screen, in the packaged app

The packaged app (launched with `--agents` against a fresh profile) logged
`Caret session option catalog: 6 model(s) advertised by OMP, 4 role(s) configured`, and opening the
model picker rendered the roles beside each model name:

| Picker row | Role shown |
|---|---|
| DeepSeek V4.1 Flash (Command Code) | Default |
| GPT-5.6-Luna | Fast |
| GPT-6-Astra | Thinking |
| Muse Spark 1.3 Contributor | Architect |
| Grok 4.6 | *(none — it holds no role)* |

Screenshot: [`model-picker-roles.png`](model-picker-roles.png).

## A mistake worth recording

The **first** implementation put the role labels in the chat-session option group's item
`description`. The API documents that field as tooltip-only, and reading the open picker's DOM
proved the labels went nowhere: no element carried a `title` or `aria-label` containing Fast,
Thinking or Architect. The rows the picker actually draws come from the **language-model provider**,
whose `LanguageModelChatInformation.detail` is the field rendered beside the model name.

So the RPC surface, the projection and the unit tests all passed while **the user-visible label
rendered nowhere**. Only opening the packaged window and reading the picker DOM showed it. The fix
moved the labels onto the language-model rows (and into the tooltip), and the now-dead option-group
annotation was deleted rather than left in place; an existing test caught the row-shape change.

## Not yet confirmed

- **Role assignment has no UI control.** The write path is proven over RPC, but no Caret surface
  calls it yet — the round shipped the read surface (labels on rows) and the verified write. The
  unused function is even tree-shaken out of the packaged bundle, which is the same fact from the
  build side.
- The tooltip wording (`Roles: Fast`) was not visually verified; only the row detail was.
- `cycleOrder` and path-scoped `enabledModels` are read but not enforced by any UI.
- `task.agentModelOverrides` and the advisor runtime are a separate, untouched surface.
