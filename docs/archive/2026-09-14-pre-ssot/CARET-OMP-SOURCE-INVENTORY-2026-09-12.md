# OMP core capability inventory (source-derived, bounded)

Pinned source: /tmp/omp-source.nmo5hX, HEAD 00085d4e7dfdcfbf302c122fa2682b410a0f43d1 (v18.1.18). This report inventories executable registries and call paths in that checkout. Dynamic/user names are intentionally marked unknown.

## Bounded denominator

- Agent tools: BUILTIN_TOOL_NAMES (28) + HIDDEN_TOOL_NAMES (3) at packages/coding-agent/src/tools/builtin-names.ts:1-36; factories at tools/index.ts:461-496; gates/partition at tools/index.ts:503-799.
- Slash commands: six static arrays concatenated at slash-commands/builtin-registry.ts:28-45 (79 top-level specs by array count: modes 17, collaboration 11, session 19, lifecycle 25, marketplace 3, control 4). Dynamic source union is builtin|skill|extension|custom|mcp_prompt|file in available-commands.ts:11-19,33-100.
- RPC: 42 command variants at modes/rpc/rpc-types.ts:28-93. RPC drives prompt/session state and host bridges; it has no direct arbitrary “call builtin tool” command.
- Internal URL handlers: 15 process-global handlers at internal-urls/router.ts:32-54: omp, agent, artifact, memory, local, vault, skill, rule, security, mcp, issue, pr, history, ssh, xd.
- Provider catalog: 74 static IDs at packages/catalog/src/provider-models/descriptors.ts:75-604. Dynamic model discovery means model count is unbounded.
- Eval dynamic registry: EvalPreludeDefinition at eval/preludes.ts:20-45; browser/computer are built-ins; extensions may add any prelude.

## Built-in tools (exact names)

All names below come from tools/builtin-names.ts and factories from tools/index.ts:461-496. Approval is read/write/exec; settings gates are tools/index.ts:623-678.

| Name(s) | Source and behavior | Gate/exposure | Acceptance case |
|---|---|---|---|
| read | tools/read.ts:709; files/dirs/archives/SQLite/internal URLs/images/docs/notebooks/profiler/web URLs, snapshots/hashlines | essential (essential-tools.ts:23-46); URL fetch uses fetch.enabled | Read local, archive and agent:// resources; immutable URL write rejection |
| write | tools/write.ts:517; filesystem/internal/archive/SQLite writes and xd:// dispatch | essential; write approval; xdev transport tools/index.ts:716-749 | Write/read back; explicit read + xdev permits device write only, not filesystem write |
| edit | packages/coding-agent/src/edit/index.ts; hashline, replace, apply_patch, patch, delete/move | essential; write/delete approval | Edit and delete; stale hash fails safely |
| glob, grep; aliases find→glob, search→grep | tools/glob.ts:118; tools/grep.ts:928; aliases builtin-names.ts:38-50 | glob/grep gates tools/index.ts:640-642; read | Workspace and internal URL search; directory resources not treated as files |
| ast_grep, ast_edit | tools/ast-grep.ts:161; tools/ast-edit.ts:180; structural search/rewrite | astGrep.enabled/astEdit.enabled; auto inclusion tools/index.ts:567-594 | Structural query and rewrite/preview |
| bash | tools/bash.ts:595; shell env/cwd/timeout/PTY/async/background/abort | essential; bash.enabled; async.enabled | Run, stream, abort and background; inspect /jobs |
| ask | tools/ask.ts:792; select/confirm/input/editor | ask.enabled; read; needs UI if approval prompt | TUI and rpc-ui answer path; plain rpc fails closed without UI |
| debug | tools/debug.ts:679; DAP debugger | debug.enabled; exec | Breakpoint/variables/abort and missing adapter error |
| eval | tools/eval.ts:94-99,257-365,393-558; persistent Python/JS cells, artifacts/images, auto-background, @tool/workpool/agent bridges | essential; exec, exclusive; eval.py/eval.js/eval.tools.enabled | State reuse across cells, timeout/abort, long call converts to background job |
| lsp | packages/coding-agent/src/lsp; diagnostics/navigation/code actions/rename/file rename/request | enableLsp && lsp.enabled | Diagnostics, definitions/references, rename; disabled path |
| github | tools/gh.ts:205; repository/issue/PR/diff/search/checkout/push/Actions watch | github.enabled; network/auth, mutations exec | Read issue/PR, checkout, push, watch action |
| checkpoint, rewind | tools/checkpoint.ts:53-120; git/session checkpoint pair | checkpoint.enabled, read; one auto-adds the other tools/index.ts:555-565 | checkpoint, mutate, rewind report; duplicate/missing errors |
| context_notes, new_context | tools/context-notes.ts:77,148; experimental context management | compaction.experimentalContextManagement plus read+grep unrestricted set | Add/read notes and context reset |
| security_scan | tools/security-scan.ts:106; native plan/scan/status/cancel/list/show/import/export/validate/compare/disposition and security:// | security.enabled | Plan, scan/cancel, SARIF import/export, disposition |
| task | task/index.ts:1-15,501-739; discovers bundled/user/project agents; single/batch/async/progress/artifacts | essential, exec; task.maxRecursionDepth | Single/batch structured output, timeout, isolation patch/branch |
| hub | tools/hub/index.ts:1-16,80-127,141-179,268-358; peer messaging, jobs, launch process supervisor | essential; IRC gate; messaging/inspection read; process start/stop/restart and stdin exec | DM/inbox/wait; start PTY process, readiness/log follow/restart/cancel |
| todo | tools/todo.ts:799; phased tracker | todo.enabled; read | Append/start/done/drop/remove and persistence/reminders |
| web_search | packages/coding-agent/src/web/search | web_search.enabled; read/network | Search result/source metadata; unavailable provider error |
| memory_edit, retain, recall, reflect | tools/memory-edit.ts:17, memory-retain.ts:18, memory-recall.ts:15, memory-reflect.ts:16 | retain/recall/reflect for hindsight|mnemopi; memory_edit for mnemopi; auto inclusion tools/index.ts:595-602 | Recall/retain/reflect round trip; backend diagnosis/clear |
| learn, manage_skill | tools/learn.ts:30; tools/manage-skill.ts:39 | autolearn.enabled; learn also local|hindsight|mnemopi | Create/update/delete skill and learn |
| hidden think | tools/think.ts:74-95; private scratchpad | externalThinking active only tools/index.ts:603-605,647; read | Private thought call does not expose text to user |
| hidden yield | tools/yield.ts:246-365; structured terminal/incremental/workpool result, schema retries | requireYieldTool; read; strict schema | Child yields data/error, incremental sections, bounded retries |
| hidden goal | goals/tools/goal-tool.ts:17-120; create/get/complete/resume/drop, token budget | goal.enabled and active state; auto-added tools/index.ts:519-525,578-580,629-633 | Goal lifecycle, positive integer budget, completion report |

Load mode is a contract: essential exactly read, write, bash, edit, glob, eval, task, hub, learn, manage_skill, context_notes, new_context. Other enabled tools default discoverable at adapter boundaries. With tools.xdev, discoverables/custom/MCP mount as xd:// devices; read without write receives device-only write transport.

## Dynamic host capabilities

- EvalPreludeDefinition is a privileged bridge, not a model tool. Enabled definitions are name-deduplicated (later wins); authorization is checked before and after await/replacement; stale closures fail closed (eval/preludes.ts:47-64,77-132).
- browser: tools/browser.ts:66-88,103-156,185-218,220-407. Actions open/close/run/call; persistent named tabs, CDP/spawned/relay/cmux/headless backends, viewport/navigation/dialogs, JS/function/call chains, screenshots/artifacts, freeze/idle-close. Gate browser.enabled, approval exec.
- computer: tools/computer.ts:43-85,98-151,159-190,211-259. Actions run/call/capabilities/close; desktop/wait/assert JS scope, screenshots/AX/input; read_only and inspection chains read approval, mutations exec. Gate computer.enabled; native macOS permissions under crates/pi-natives/src/desktop.
- generate_image: sdk.ts:2089-2104 and image-gen.ts:1224-1231,1779+; generate_image.enabled, write approval, provider fallback/image artifact, xdev device.
- tts: tts.ts:321-356; speechgen.enabled, write approval; Kokoro or xAI/DeepInfra cloud audio artifact.
- Vibe: tools/vibe.ts:50-289 names vibe_spawn,vibe_send,vibe_wait,vibe_kill,vibe_list; persistent read-only workers, async jobs/TV wall. /vibe mutually exclusive with plan/goal (session/session-tools.ts:558-591).

## Task/subagent and remote process policy

Task schemas are task/types.ts:114-182 (single name?,agent,task,outputSchema?,schemaMode?,tools?,isolated?; batch context,tasks[]). Preflight at task/structured-subagent.ts:260-348 resolves spawn policy, plan/depth, disabled agents, output schema, model role/override, isolation merge/apply and LSP/IRC. canSpawnAtDepth is :342-348. Plan mode blocks eval tools/isolation and limits children to read/search.

Hub schema supports PTY, readiness by log/port, restart, persist/detached, log cursor/follow, stdin text/keys/signals (hub/index.ts:80-127). detached implies persist and disables PTY input. Async jobs settings and manager are settings-schema.ts:4773-4809.

Remote SSH URL access is internal-urls/ssh-protocol.ts:257-366 and ssh/file-transfer.ts:70-200: POSIX UTF-8 text file/dir read/write, 1 MiB cap, OpenSSH key/agent auth, no password/Windows/special-file transfer. It is not a remote-agent execution API (use bash over SSH or sshfs).

Encrypted collab is separate: collab/protocol.ts:5-18,151-248 and relay-client.ts:2-5,35-205 use AES-256-GCM WebSocket frames. CollabHost host.ts:124-250 shares live state/entries/participants and guest UI; CollabGuestLink guest.ts:161-247,403-464,671-773 supports read-only guests/reconnect. Link fragment holds key; relay sees opaque data; guest mutating commands are host-only.

## Slash command registry (all static top-level names)

- Modes builtin-modes.ts:151-627: security (plan,scan,status,cancel,scans,show,import,export,validate,compare,disposition); settings; setup (alias providers; subcommand providers); plan; plan-review; vibe; goal (set,show,pause,resume,drop,budget); guided-goal; loop; queue; model (alias models); switch; fast (on,off,status); skillful (on,off,status); extended-context (on,off,status); computer (on,off,status); prewalk (restart).
- Collaboration builtin-collaboration.ts:53-548: advisor (on,off,status,dump [raw],configure); export; trace; dump; share; collab (view,status,stop; handler also accepts start); join; leave; browser (headless,visible); copy; open.
- Session builtin-session.ts:139-627: todo (edit,copy,expand,collapse,export,import,append,start,done,drop,rm); session (info,delete,pin [account]); jobs; usage (show,reset); stats; changelog (full); hotkeys; tools; context; extensions (alias status); agents; git; hub; branch (alias rewind); fork; tree; login; logout; mcp (add,list,remove,test,reauth,unauth,enable,disable,smithery-search,smithery-login,smithery-logout,reconnect,reload,resources,prompts,notifications,help).
- Lifecycle builtin-lifecycle.ts:170-869: ssh (add,list,remove,help); new; fresh; clear; drop; compact (soft,remote,snapcompact from session/compact-modes.ts:15-57); shake (elide,images,thinking); handoff; resume; pin; btw; tan; omfg; cleanse; retry; debug; memory (view,stats,diagnose,queue,sync,clear,reset,enqueue,rebuild,mm list,mm show,mm refresh,mm history,mm seed,mm delete,mm reload); rename; move; wt (alias worktree); add-dir; remove-dir; dirs; exit; restart.
- Marketplace builtin-marketplace.ts:42-63,424-432,555-559: marketplace (add,remove,update,list,discover,install,uninstall,installed,upgrade,help); plugins (list,enable,disable); reload-plugins.
- Control builtin-control.ts:6-80: force (alias force:); live; pause; quit (alias q).

TUI executes handleTui; ACP exposes only specs with handle (available-commands.ts:50-63). Dynamic skill/extension/custom/MCP prompt/file commands are deduplicated and carry source metadata. Collab guests use COLLAB_GUEST_ALLOWED_COMMANDS (builtin-registry.ts:143-150).

## RPC transport and UI

RpcCommand exact names are modes/rpc/rpc-types.ts:28-93: negotiate_protocol; prompt,steer,follow_up,abort,abort_and_prompt,new_session; get_state,set_fast_mode,get_available_commands,set_todos,set_host_tools,set_host_uri_schemes,set_subagent_subscription,get_subagents,get_subagent_messages; set_model,cycle_model,get_available_models; set_thinking_level,cycle_thinking_level; set_steering_mode,set_follow_up_mode,set_interrupt_mode; compact,set_auto_compaction; set_auto_retry,abort_retry; bash,abort_bash; get_session_stats,export_html,switch_session,branch,get_branch_messages,get_last_assistant_text,set_session_name,handoff; get_messages,get_messages_page; get_login_providers,login.

State fields and tool dump are :99-122; ready protocol/frame limits :144-150; subagent subscription off|progress|events :165-189. Host tool definitions and bidirectional frames are :446-485; URI scheme frames :491-540; UI requests select/confirm/input/editor/cancel/notify/status/widget/title/editor-text/open-url :375-440. rpc-mode.ts:1620-1650 serializes ordinary commands but side-channel host/UI/URI frames overtake; malformed lines report errors, stdin EOF rejects pending calls then drains/disposes.

rpc-ui distinction:
- main.ts:1545-1547 sets PI_NO_PTY=1 whenever mode is rpc-ui (or no-pty), and PI_NO_TITLE for rpc/rpc-ui/acp at :1548-1554.
- main.ts:1842-1845 sets hasUI true only for interactive or rpc-ui.
- main.ts:2058-2062 passes setToolUIContext only for rpc-ui; plain rpc passes undefined. rpc-mode.ts:1050-1072 creates RpcExtensionUIContext. Therefore rpc-ui can answer ask/approval/extension/login UI over frames while keeping PTY disabled; plain rpc must fail closed for UI-required approvals. Caret uses rpc-ui as the initial adapter path; PTY semantics need a bridge/patch/SDK gate. Two concurrent execution owners are not required or allowed.

## Session/history/compaction/goal/plan

AgentSession owns model/tool registry, prewalk, provider boundary, advisors, maintenance, handoff, recovery, todo, BashRunner, EvalRunner, IRC and turn loops (session/agent-session.ts initialization 1248+, runtime 537-827). Session manager/storage/history/tree/fork/branch/pin/worktree modules persist JSONL trees; HookCommandContext exposes newSession/branch/navigateTree (hooks/types.ts:209-250). RPC and slash surfaces map to these operations.

Compaction is builtin-lifecycle.ts:246-311; modes soft/remote/snapcompact and parser session/compact-modes.ts:15-96. Handoff is session/session-handoff.ts:57-237 (oneshot summary then compact; user abort must not append out-of-turn output). Auto compaction/retry/fallback events are in extension event union.

Plan settings and autosave are settings-schema.ts:4931-4978; goal settings are :4980-5011. Queue has RPC steering/follow-up/interrupt modes and slash /queue. Jobs settings are :4773-4809. Acceptance must cover session fork/tree, queue mode semantics, compaction/handoff/abort, goal budget, plan read-only restrictions, job once-only delivery/cancel.

## SDK/extensibility/hooks

SDK CreateAgentSessionOptions is sdk.ts:377-659 (cwd/dirs, auth/model registry, model roles/fallback, thinking/tiers, prompts/cache/deadline, custom tools, extensions/discovery, events/subagents, skills/rules/context/workspace/slash commands, MCP/LSP/IRC, Python, restrict/allow tools, output schema/yield, depth/memory/session manager/settings/hasUI/interactive/telemetry/autoApprove). Result and setToolUIContext are :661-680; discovery/reexports :699-907; tool assembly/prelude/image/TTS/xdev :1925-2140 and :2840-3010,:3231-3372.

Extension API:
- UI methods (select/confirm/input/askDialog/notify/status/working/widgets/header/footer/title/custom/editor/autocomplete/themes/tool expansion): extensibility/extensions/types.ts:256-371.
- Context/session/model/usage/jobs/compact/abort/queue/shutdown/memory/timers/native same-tool invoke: :455-547. isProjectTrusted always true; project inputs load unconditionally.
- ToolDefinition/registerTool/file write/delete fallbacks: :620-676,:1306-1364.
- Commands/shortcuts/flags :1370-1397; message/render/action/model/service-tier/session-name :1409-1494.
- Provider registration (base URL, API/key, stream, headers, OAuth, usage, dynamic models): :1497-1620.
- Event union includes resources/session switch/branch/compact/tree/shutdown, context/provider, agent/turn/message/tool, auto compact/retry/fallback, TTSR/todo/goal/credentials/MCP notifications, input/approval/user bash/python: :1075-1111.

Hooks narrow context and command controls are extensibility/hooks/types.ts:176-250; events :388-403; API :476-597; runner :48-249. Event hooks cannot call extension-only mutation methods to avoid agent-loop deadlocks. Skills and dynamic commands are sdk.ts:751-907 and available-commands.ts:33-100. MCP tool names use mcp__<server>_<tool> (builtin-names.ts:66-68).

## Providers

Static 74 IDs from descriptors.ts:75-604:
abliteration, aiand, aimlapi, alibaba-coding-plan, alibaba-token-plan, baseten, amazon-bedrock, bedrock-mantle, anthropic, azure, cerebras, cloudflare-ai-gateway, commandcode, cursor, deepinfra, deepseek, devin, cline-pass, firepass, fireworks, github-copilot, gitlab-duo, gitlab-duo-agent, gmi-cloud, google, google-antigravity, google-gemini-cli, google-vertex, groq, huggingface, kilo, kimi-code, litellm, lm-studio, minimax, minimax-code, minimax-code-cn, mistral, muse-code, meta, moonshot, nanogpt, nvidia, novita, ollama, ollama-cloud, openai, openai-codex, opencode-go, opencode-zen, openrouter, qianfan, qwen-portal, sakana, siliconflow, siliconflow-cn, synthetic, together, umans, venice, vercel-ai-gateway, vllm, wafer-serverless, coreweave, xai, xai-oauth, xiaomi, xiaomi-token-plan-ams, xiaomi-token-plan-cn, xiaomi-token-plan-sgp, yolo-auto, zai, zenmux, zhipu-coding-plan.

Provider auth/login: rpc-mode.ts:1525-1582. Extension providers can register/override streams, OAuth and dynamic models. Runtime auth/model availability must come from ModelRegistry. register-builtins.ts:480-507 notes lazy streams are not currently wired into main stream path.

## Caret reuse/acceptance surface

Reuse OMP's canonical registries and runtime; OMP retains its agent loop, model registry, tools and transcript. Caret adds adapter/host/UI contracts, not a replacement engine. Stack and ownership are defined by [the root architecture decision](CARET-IMPLEMENTATION-DIRECTION-2026-09-12.th.md): retained Code-OSS Mac workbench and Paseo-derived mobile/transport candidate. This inventory is source evidence, not an independent stack decision.

Minimum acceptance:
1. Registry drift: 28+3 tools, six slash arrays, 42 RPC commands, 15 URI handlers; dynamic manifests carry source/provenance.
2. Every tool family: read/write/edit/search/AST/bash/eval/task/hub/todo/memory/GitHub/LSP/browser/computer/security/checkpoint/goal/yield and approvals/gates.
3. Eval persistence/timeout/background; browser tab lifecycle; computer read-only vs mutation/permission.
4. Task batch/isolation/recursion/structured yield; hub PTY/readiness/restart/cancel; async job delivery.
5. Session tree/fork/branch/resume, queues, compaction/handoff/retry, plan/goal budgets, artifacts.
6. MCP/xdev/host tools/URI/UI bridges; plain rpc vs rpc-ui UI/no-PTY contract.
7. Extension/hook/skill/provider registration, events, native same-tool delegation and write/delete fallback.
8. Collab encrypted host/read-only guest/reconnect and SSH URL read/write restrictions.

## Unknowns

Dynamic plugin/marketplace/extension/MCP/skill/file command/tool/prelude names, runtime model lists/auth, relay/CDP endpoints, desktop permissions and Python availability are environment-dependent. No providers, relays, browser/computer, plugins or user settings were executed or modified.


## Integration note

Root independently verified 28 built-ins, 3 hidden names, 42 RPC commands and 79 top-level static slash specifications. Source evidence and conditional gates here are not execution results. [Coverage mapping](CARET-OMP-COVERAGE-2026-09-12.th.md) defines Caret work; [bounded probe](../../maintenance/evidence/omp-rpc-2026-09-12/README.md) defines the actual tested subset.
