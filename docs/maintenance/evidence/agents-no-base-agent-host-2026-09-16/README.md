# Why the Agents window said "The Agent Host failed to start" (2026-09-16)

The user reported the banner appearing every time the Agents window opens, with the
question "we use OMP and it worked already?". The banner is not about OMP.

## What was happening

The Agents window starts the base **Agent Host** - a utility process
(`out/vs/platform/agentHost/node/agentHostMain.js`) that hosts the Copilot/Claude/Codex
harnesses - as soon as Agent Host features are enabled (`AgentHostPrewarmContribution` →
`LocalAgentHostServiceClient.connect()` → the main process spawns it). S1 removed that
harness layer, and the process's node-side graph still requires Copilot services that no
longer exist, so it dies on boot. From `window1/main.log` of a launch before this change:

```
[AgentHost:stderr] [createInstance] agentHostCustomizationEnablementService depends on copilotApiService which is NOT registered.
AgentHostProcessManager: agent host terminated with code 1, giving up after 5 restarts
AgentHostStarter: cannot create window connection: Agent Host process stopped after 5 restarts.
```

The renderer turns the failed initial connection into the notification the user saw
(`notifyOnFatalAgentHostStartError`, text in `localAgentHostService.ts`: "The Agent Host
failed to start. Restart the application to try again."). The remaining required
injections are `AgentBranchNameGenerator` (`agentBranchNameGenerator.ts`),
`agentHostPullRequestOperationHandler` and `agentHostCommitOperationHandler` - all
Copilot-API paths that patch `0006` un-wired without removing every consumer.

Booting it again instead of not starting it would mean restoring Copilot API wiring
across `agentHostServices.ts`, `agentBranchNameGenerator.ts` and the changeset handlers -
the layer the plan removes rather than re-adds.

## The change

`patches/desktop/0032-caret-no-base-agent-host.patch` (two base files, neither touched by
an earlier patch):

| file | change |
| --- | --- |
| `src/vs/workbench/services/agentHost/electron-browser/agentHostService.ts` | `AgentHostPrewarmContribution` no longer starts the host: the prewarmer class, the `autorun` on enablement, the assignment-context forwarding and their imports are gone, and the class carries a comment with the three-line reason. The contribution stays registered so the decision lives where the upstream behaviour was |
| `src/vs/workbench/services/agentHost/test/electron-browser/agentHostService.test.ts` | the base suite pinned "starts immediately when enabled" and the assignment-context dispatches; it now pins the Caret contract ("does not start the agent host while enabled", "does not forward assignment context to a host that is never started") |

`IAgentHostService` itself stays registered (`InstantiationType.Delayed`); nothing in
Caret asks it for work, so the client is never constructed and no process is spawned.

## Verification

| gate | result |
| --- | --- |
| `bun scripts/prepare-desktop.ts` | 30 patches / 18 removals, every digest and reverse-check passes |
| `bun test apps/macos/test/desktop-patch-set.test.ts` | applies in manifest order, reproduces the checkout |
| `cd desktop && npm run typecheck-client` | 0 errors |
| `bun run typecheck`, `check:cursor-parity`, `ci-validate` | clean; parity 340 keys / 0 mismatches |
| `bun run test` | 754 pass, 1 fail (`menus-contract.test.ts` needs `rg` on `PATH` - environmental) |
| packaged app, before | `AgentHostProcessManager` / `AgentHost:stderr` lines in `main.log`, 5 restarts, banner text in the window |
| packaged app, after | **0** agent-host lines in `main.log` (no process is started), no element or notification in the window matching `/Agent Host\|failed to start/i` |

Build loop: `node build/next/index.ts bundle --minify`, copy `desktop/out-vscode/.` into
the packaged `app/out/`, `CARET_HOST_NODE=… bun scripts/build-caret.ts --package`.

## Not verified / open

- The Agent Host is still *reachable* if something ever asks it for work: the client
  class and the singleton registration are untouched, so a future consumer would spawn
  the same crashing process. Making that state honest (a null client, or finishing the
  Copilot-service removal in the node graph) is follow-up work, not part of this slice.
- The `Chat model provider uses UNKNOWN vendor caret-omp` line still appears at startup in
  some launches; it predates this change (it is in the log of the 17:50 launch as well)
  and is the known race the S2 receipt records.
