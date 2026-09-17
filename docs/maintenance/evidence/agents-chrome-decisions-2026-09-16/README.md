# The Agents window's Copilot-flavoured composer controls are gone (2026-09-16)

The plan listed four "chrome decisions" (each: wire to OMP / hide / disable with a reason).
All four are decided and landed on macOS. The question behind them is the same one the
removed "Allow connections" icon and the account widget answered: the window must not show a
control it cannot honour.

| decision | choice | why |
| --- | --- | --- |
| `Configure Tools…` | hide in the Agents window | it configures the base's tool set for the default agent, and the window runs on OMP, which owns its tools end to end |
| Permission picker (`Default permissions / Allow all / Autopilot`) | hide in the Agents window | those levels are the Copilot permission model; this window's approvals come from OMP |
| `Configure Custom Agents…` (inside the mode menu) | hide the entry, keep the mode menu | custom agents are a Copilot-chat surface with nothing behind it here; the mode menu itself still switches Ask/Edit/Agent |
| the sidebar's empty `Chats` group | switch it off | the reference groups sessions by project and has no empty `Chats` group |

## How

- `patches/desktop/0033-caret-agents-no-copilot-composer-controls.patch` scopes the three
  controls out with `IsSessionsWindowContext.toNegated()`, the same mechanism patch `0008`/`0027`
  use: the IDE window keeps every one of them. Two of the three edits also gate the action's
  `precondition`, so a command-palette entry is disabled rather than dead. Files:
  `chatToolActions.ts`, `chatExecuteActions.ts`, `chatModeActions.ts` — all base files no
  earlier patch owns.
- The fourth decision is a setting, not a patch: `syncAgentsWindowTheme` in the Caret
  extension now writes `sessions.list.showEmptyDefaultGroups: false` into the Agents window's
  own workspace file beside the theme keys, because that file is the only scope the window
  reads.

## Verification

| gate | result |
| --- | --- |
| `bun scripts/prepare-desktop.ts` | 31 patches / 18 removals, every digest and reverse-check passes |
| `bun test apps/macos/test/desktop-patch-set.test.ts` | applies in manifest order, reproduces the checkout |
| `bun test apps/macos/test/ide-native-workbench.test.ts` | 66 pass, including the new needle test (three files, three Caret comments, four gated expressions) and the theme-handoff test extended to assert the written workspace setting |
| `cd desktop && npm run typecheck-client` | 0 errors |
| `bun run typecheck`, `check:cursor-parity`, `ci-validate` | clean; parity 340 keys / 0 mismatches |
| `bun run test` | suite green apart from the environmental `rg` failure |
| packaged app, fresh profile, on screen | sidebar rows are `Automations · cedia · New task` — **no `Chats`/`No chats` group**; the composer's chips are `Local · Agent · DeepSeek V4.1 Flash` with **no `Configure Tools…` and no `Permission picker` anywhere in the window**; opening the mode menu lists only `Agent`, with **no `Configure Custom Agents…`**; the IDE window still boots normally |

The setting reaches the window end to end: an IDE-window launch with a scratch profile wrote
`sessions.list.showEmptyDefaultGroups: false` into that profile's
`User/agent-sessions.code-workspace`, and the Agents window launched from the same profile
rendered the sidebar without the group.

## Not verified / next

- The IDE window's chat is disabled by default in this fork (`chat.disableAIFeatures`), so its
  copies of these controls were not exercised on screen; they are scoped by the sessions-window
  context key and covered by typecheck, not by a run.
- The mode menu still offers `Ask / Edit / Agent`. Whether those modes change anything OMP does
  is unverified — the real mode work is the reference's `Plan`/`Build` chips (plan item 11),
  which need a composer mode that does not exist yet.
