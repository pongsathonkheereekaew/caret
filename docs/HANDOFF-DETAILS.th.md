<a id="handoff-v4"></a>

## J. Handoff specification v4 — ข้อแก้ไขหลังเทียบ docs/help

ฉบับนี้เพิ่มรายละเอียดส่งต่องานจากการตรวจ 9 กันยายน 2026 รอบที่สอง ใช้ร่วมกับส่วน A–I ในไฟล์เดียว **ข้อกำหนดส่วน J ชนะข้อความสรุปเดิมเมื่อขัดกัน** ผล scrutinize อยู่ส่วน K

### J1. ผลตรวจ coverage และสิ่งที่แก้คำกล่าวเดิม

แผน 158 requirements เดิมเป็น parent-level coverage ไม่ใช่ field-level implementation specification และ source ledger 148 หน้ามีเฉพาะ docs index ยังไม่รวม help จึงไม่ควรเรียกว่าเอกสาร Cursor ทั้งหมดครบแล้ว รอบนี้ดึง help เพิ่ม 95 หน้าและ linked docs นอก index อีก 18 หน้า รวม retrieval inventory 261 URL สำเร็จ นี่เป็นขอบเขตการค้นและจัดหมวด ไม่ใช่รับรองว่าอ่าน/พิสูจน์ทุก field ทุกหน้า

พบรายละเอียดที่ต้องเพิ่มจริง: side chat/fork ต่างกัน, sharing/revocation, conversation search, desktop/CLI permission schemas ต่างกัน, sandbox merge, MCP transport/apps/OAuth/extension registration, callback ที่ block กับ notification, review-policy precedence, keyboard conflict และ native bot Android ที่แยกจาก Cursor coding mobile

Public docs อธิบายพฤติกรรมและ interfaces บางส่วน ไม่เปิดเผย production system prompts, hidden routing/training/index algorithms, exact private tool schemas หรือ model weights ทั้งหมด จึง **ไม่สามารถเขียนแผน engine ภายในแบบ 1:1 ที่ยืนยันได้จากแหล่งเหล่านี้** เป้าหมายที่ดำเนินการได้คือ public behavioral/visual/API-contract parity โดยใช้ engines และ infrastructure ที่เข้าถึงได้จริง นี่เป็นขอบเขตที่ต้องส่งต่ออย่างตรงไปตรงมา ไม่ใช่ให้ผู้ลงมือเดาระบบภายใน

### J2. Additional requirements — เพิ่มจาก 158 เป็น 198 parent requirements

PX เป็น namespace ของ requirements เพิ่มเติม ไม่ใช่รายการที่ทำเสร็จแล้ว ทุกแถวมีสถานะ planned Sources ของแต่ละ cluster อยู่หลังตาราง; ต้องเก็บ source section/hash ที่ระดับ child case

| ID | Requirement / precondition → action → expected result | Owner / phase / UI | Negative acceptance |
|---|---|---|---|
| PX-01 | Local parent มี history → /side หรือเลือก transcript/diff → เปิด durable child ที่ได้ parent reference context แต่ไม่แสดง parent transcript ซ้ำ | session / M4 / A14 | ไม่สร้าง nested side chat; cloud baseline ไม่เปิด capability นี้โดยเดา |
| PX-02 | Side child มี follow-up → @mention จาก parent → ใช้ child context; ปิด child เป็น archive และคง parent association | session / M4 / A14 | เปลี่ยน parent ไม่ย้าย child ผิด parent; close ไม่ลบประวัติ |
| PX-03 | Fork whole chat หรือ message boundary → copy transcript/subagents เฉพาะช่วงที่เลือกเป็น independent conversation | session / M4 / A15 | message fork ไม่พก descendants หลัง cutoff; checkpoint restore ไม่ตัด transcript |
| PX-04 | Agents Window ค้นข้ามแชต และ transcript ค้นภายใน → match counter, next/previous, jump และ local index | search / M3 / A16 | delete/revoke ต้องลบหรือซ่อนผล; virtualized history jump ไม่ผิดข้อความ |
| PX-05 | Share dialog → preview/redaction/Team/Public → read-only share; recipient fork ผ่าน import/deep link | sharing / M9 / A17,W14 | redaction best-effort ไม่รับรอง secret-free; no storage/team policy ต้องควบคุม; local files/credentials ไม่ถูกบรรจุ |
| PX-06 | Share owner/admin เปลี่ยน visibility/delete → viewer ถูก reauthorize/revoke; dashboard list ค้นได้ | sharing / M9 / W14 | cached URL ไม่ bypass revocation; public link ไม่สร้างสิทธิ์ local filesystem |
| PX-07 | Inline edit question mode กับ selection → answer/follow-up; ส่งต่อ Agent พร้อม selection context | editor / M3 / D04 | question ไม่แก้ไฟล์จนมี edit intent; focus/chord ไม่ชน terminal |
| PX-08 | Terminal inline prompt → เสนอ shell command → user execute ตาม state ที่ reference ระบุ | editor / M3 / D06 | ไม่ execute จาก preview; shell/cwd/profile ต้องตรง active terminal |
| PX-09 | Prompt/command/rule/MCP install deep link → decode/preview/confirm → appropriate draft/import/install flow | shell / M4 / S13 | ไม่ autorun prompt; traversal/oversized URL/unknown action ไม่เขียนไฟล์; 8,000 encoded-character prompt-link boundary fixture |
| PX-10 | Run Mode picker มี Auto-review/Allowlist/Run Everything ตาม reference; shell/MCP/fetch routing ผ่าน policy | permissions / M2 / S14 | classifier unavailable ต้องแสดง unavailable และ fallback ที่ชัด; ไม่เรียก classifier ว่า sandbox |
| PX-11 | permissions.json JSONC user+project → concatenate arrays per key, file overrides corresponding UI field, admin overrides; file watch reload | config / M2 / S14 | present-empty ไม่ fallback UI; invalid/missing/unknown/non-string handling มี cases; file-controlled UI read-only |
| PX-12 | sandbox.json → merge paths/network/flags ตาม schema; network deny wins, admin restrictions enforce; protected paths | sandbox / M2 / S15 | test child process, symlink, DNS/private IP, temp/cache และ unsupported platform; fallback ต้องขออนุมัติ ไม่ falsely sandbox |
| PX-13 | Local run modes กับ cloud isolated execution ใช้ policy profiles แยก; cloud ไม่ใช้ desktop approval loop เป็น default reference | runtime / M8 / W02,S14 | isolated VM ไม่แปลว่า credentials/external actions ปลอดภัยเอง; Caret policy additions บันทึก intentional delta |
| PX-14 | MCP stdio/SSE/Streamable HTTP initialize/discover/reconnect → tools/prompts/resources/roots/elicitation ใช้งานได้ | MCP / M4 / S07 | server crash แยก failure; schema/capability unsupported ไม่แสดง success |
| PX-15 | MCP Apps render isolated view พร้อม text fallback; remote OAuth static/dynamic client, state/callback matching | MCP / M4 / A18,S07 | app message origin/permissions validate; callback ผิด session ไม่ผูก credential; Caret callback ไม่ใช้ Cursor domain |
| PX-16 | MCP config interpolation/envFile และ extension register/unregister; distribution/install/allowlist เป็นคนละ state | config / M4 / S07,S09 | envFile เฉพาะ stdio; marketplace linking ไม่ install ทุกคน; secret ไม่ออก logs |
| PX-17 | Hook adapter มี event coverage ครบ inventory พร้อม input/output, matcher, cwd, timeout, sync/async และ exit semantics | hooks / M4 / S08 | preTool updated input ต้อง re-evaluate approval; post hook ไม่ replay side effect เมื่อ reconnect |
| PX-18 | Third-party hook compatibility import และ workspaceOpen lifecycle พร้อม provenance | hooks / M4 / S08 | อย่าส่ง fictional session fields ใน app lifecycle; event ไม่มี engine source ต้อง unsupported ไม่ fabricate |
| PX-19 | Plugin format discovery/manifest/variables/team marketplace installation mode/skill publishing และ canvas components | plugins / M4,M9 / S09,W15 | publish ไม่เท่ากับ auto-install; version/conflict/revoke/prerelease handling |
| PX-20 | Rules/skills source and activation map มี nested AGENTS, CLAUDE compatibility, globs, manual/auto/mode และ cloud sync | config / M4 / S05 | same-name collision/provenance; rules ไม่ถือว่าใช้กับ Tab เสมอ; scope per surface ต้องทดสอบ |
| PX-21 | Browser session permissions/origin allowlist/account isolation, console/network, design selection→source linkage | browser / M4 / A10,S16 | unsupported frame/origin/auth expiry ไม่ claim source mapping; SSRF/redirect and stale element cases |
| PX-22 | Canvas workspace list, source/render, rerun/revision และ publish/refresh/team gallery | artifacts / M4,M9 / A12,W16 | publish policy/no-storage respected; stale revision ไม่ overwrite newer share |
| PX-23 | Agent ask-question asynchronous กับ ACP blocking interactions แยก semantics; answers route ต่อ exact interaction | runtime / M2,M10 / A06 | no answer ไม่ใช่ approval; notification ไม่รอ response; cancel cleans waiter |
| PX-24 | ACP JSON-RPC stdio initialize/auth/session new/load/prompt/update/permission/cancel พร้อม richer extensions | API / M10 / W12 | stdout มี protocol เท่านั้น; malformed/cancel/unknown capability/permission timeout ครบ |
| PX-25 | CLI interactive/headless/output formats, resume/steer/goals, config/auth/permission precedence และ exit status | CLI / M10 / T01,T02 | print proposal กับ apply flags แยก; CLI permissions ไม่ reuse desktop parser โดยตรง |
| PX-26 | TS/Python SDK local/cloud agents/runs/messages/usage/artifacts/custom tools/hooks/subagents/store/stream/error lifecycle | SDK / M10 / W12 | sync/async disposal, busy, unsupported operation, retries ไม่ duplicate writes; parity ราย SDK ไม่สมมติเท่ากัน |
| PX-27 | REST v1 agents/runs/usage/artifacts/archive/unarchive/delete/models/repos/worker tokens/pools/claims | API / M10 / W12,W06 | auth scopes, paging, lease expiry, error envelope และ stream reconnect contract |
| PX-28 | Legacy v0 API/CLI changelog features ถูกแยก supported-current/compatibility/deprecated inventory | API / M10 / W12 | ไม่เอา API สองรุ่นปน schema; deprecated Kubernetes operator ไม่บังคับสร้างใหม่เพื่อเพิ่ม count |
| PX-29 | Team/org/analytics/AI tracking APIs มี endpoint/field/scope/paging/date/cache/rate-limit/error conformance ต่อ resource | admin / M11 / W13,W17 | tenant leakage, role escalation, deleted user, partial page และ CSV/JSON semantic mismatch |
| PX-30 | Review routing ใช้ exact approval-policy basename, ancestor specificity และ routing file; changed policy อิง base branch | review / M9 / W09 | PR แก้นโยบายตัวเองไม่ทำให้อนุมัติง่ายขึ้น; security/review checks pending ห้าม approve |
| PX-31 | Bug review incremental/full/effort/rules-used/learned rules/autofix/CI statuses และ admin trigger APIs | review / M9 / W09 | new HEAD invalidates old success; invalid rule/truncated scope เปิดเผย; external feedback loop bounded |
| PX-32 | Self-hosted workers/pools/My Machines เลือก execution environment, claim/lease, capacity/health, private SCM/computer use | cloud / M8 / W06 | pool arbitrary-repo routing และ machine owner access ทดสอบแยก; no inbound assumption ไม่แทน transport test |
| PX-33 | Cloud identity/metadata/env/OIDC/private connectivity/build freshness/attachments/no-repo routing | cloud / M8 / W04,W05 | credentials survive snapshot โดยไม่ตั้งใจไม่ได้; metadata scope ไม่ข้าม job; attachments limits ตรวจจาก pinned source |
| PX-34 | SCM adapter แยก GitHub/GHE/GitLab hosted+self-hosted/Bitbucket cloud+DC/Azure identity และ review triggers | SCM / M9 / W11 | common API facade ไม่ imply feature equality; webhook/permissions per provider cases |
| PX-35 | Slack/Teams/Jira/Linear/Notion ใช้ routing/option precedence/account linking/thread follow-up/visibility ของแต่ละบริการ | connectors / M9 / W11 | event sender/repo routing ไม่เชื่อ payload อย่างเดียว; replay ไม่โพสต์ซ้ำ; unavailable integration not completed |
| PX-36 | Origin rules/protections/apps/SSH/auth/ref naming/forge-local branch/PR lifecycle/thread commands และ mirror conflict handling | forge / M10 / W10,T02 | mirror lag/offline/detach และ reserved branch semantics; Git sync ไม่แทน review metadata |
| PX-37 | Enterprise usage/pools/groups/service accounts/model controls/network/privacy/audit/OTel exporter | admin / M11 / W13,W17 | no synthetic usage billed as real; revocation/enforcement และ export privacy tested; certification ไม่อ้างมีเอง |
| PX-38 | Public profile/handle/visibility/usage-sharing/account sessions/export/delete และ spend controls | account / M11 / W13,S12 | deletion ไม่ลบ provider account/remote repos; admin privacy overrides; personal Caret mode ไม่บังคับ billing purchase |
| PX-39 | Persistent bot native mobile iOS/Android account/computer continuity, recovery/secret entry และ desktop-only computer update | bot / M11 / B05,B06 | แยกจาก Cursor coding mobile Android status; ไม่เอา PWA มานับ native bot parity |
| PX-40 | Diagnostics/network/proxy/cert/extension isolation/performance/support export และ migration recovery | release / M1,M7 / S17,D07 | export ไม่มี secret; uninstall/import/update ไม่ลบต้นฉบับ; expose actionable error ไม่ส่ง user วน login |

Sources PX-01…09: [side chats](https://cursor.com/help/ai-features/side-chats.md), [conversation search](https://cursor.com/help/ai-features/conversation-search.md), [shared transcripts](https://cursor.com/help/ai-features/shared-transcripts.md), [inline edit](https://cursor.com/help/ai-features/inline-edit.md), [shortcuts](https://cursor.com/docs/reference/keyboard-shortcuts.md), [deep links](https://cursor.com/docs/reference/deeplinks.md).

Sources PX-10…23: [run modes](https://cursor.com/docs/agent/security/run-modes.md), [permissions schema](https://cursor.com/docs/reference/permissions.md), [sandbox schema](https://cursor.com/docs/reference/sandbox.md), [MCP](https://cursor.com/docs/mcp.md), [hooks](https://cursor.com/docs/hooks.md), [third-party hooks](https://cursor.com/docs/reference/third-party-hooks.md), [plugin reference](https://cursor.com/docs/reference/plugins.md), [rules](https://cursor.com/docs/rules.md), [skills](https://cursor.com/docs/skills.md), [browser](https://cursor.com/docs/agent/tools/browser.md), [canvases](https://cursor.com/docs/agent/tools/canvas.md), [agent](https://cursor.com/docs/agent/overview.md).

Sources PX-24…29: [ACP](https://cursor.com/docs/cli/acp.md), [CLI reference](https://cursor.com/docs/cli/reference/parameters.md), [TypeScript SDK](https://cursor.com/docs/sdk/typescript.md), [Python SDK](https://cursor.com/docs/sdk/python.md), [REST endpoints](https://cursor.com/docs/cloud-agent/api/endpoints.md), [legacy API](https://cursor.com/docs/cloud-agent/api/v0.md), [admin API](https://cursor.com/docs/account/teams/admin-api.md), [organization API](https://cursor.com/docs/account/organizations/organization-admin-api.md), [analytics API](https://cursor.com/docs/account/teams/analytics-api.md), [code tracking API](https://cursor.com/docs/account/teams/ai-code-tracking-api.md).

Sources PX-30…40: [routing/approval](https://cursor.com/docs/approval-agents.md), [Bugbot](https://cursor.com/docs/bugbot.md), [self-hosted](https://cursor.com/docs/cloud-agent/self-hosted.md), [cloud metadata](https://cursor.com/docs/cloud-agent/metadata.md), [integrations](https://cursor.com/docs/integrations/github.md), [Origin](https://cursor.com/docs/origin.md), [enterprise](https://cursor.com/docs/enterprise.md), [profiles](https://cursor.com/help/account-and-billing/profiles.md), [bot mobile](https://cursor.com/help/grok-bot/mobile.md), [troubleshooting](https://cursor.com/help/troubleshooting/reporting-bugs.md). Provider-specific pages อยู่ใน source ledger เพิ่มเติม ไม่ใช้ GitHub page เป็นหลักฐานว่า provider อื่นมี behavior เดียวกัน

### J3. UI inventory เพิ่ม — 18 screen families รวมเป็น 75

Screen family ไม่เท่ากับ screenshot เดียว แต่ละแถวต้องแตก applicable loading/empty/error/permission/offline/focus/modal states ตาม catalog แผนนี้ไม่อ้างวัด geometry แล้ว

| ID | Surface / controls / actions | State + navigation contract | Phase |
|---|---|---|---|
| A14 | Side chat panel, parent breadcrumb, prompt, @mention-return, archive | parent context ไม่ปรากฏเป็น transcript; parent continues; nonnested/local-only baseline | M4 |
| A15 | Fork menu/message action, source cutoff preview, destination/new chat | distinguish whole/message/side; descendants after cutoff absent | M4 |
| A16 | Global chat search + in-transcript find bar | query/results/snippet/highlight/count/next/previous, search index building/no matches/error, focus returns to source | M3 |
| A17 | Share preview, redaction notice, Team/Public visibility, copy/open/revoke | publishing/published/failure/disabled-by-policy; explicit publish action; unsent preview never share | M9 |
| A18 | MCP App panel, tool provenance, embedded controls, text fallback | loading/crashed/reconnect/auth; isolated origin and resize messages; keyboard escape returns host | M4 |
| D06 | Terminal prompt bar and command preview | terminal focus/cwd/profile, generation/cancel/execute; no unexpected run on focus change | M3 |
| D07 | Migration/recovery assistant | selectable imports/conflict preview/backup/progress/retry/restore; no source app overwrite | M1 |
| S13 | Deep-link import/install confirmation | decoded content/source/action/destination, validation error, duplicate/conflict; no auto execution | M4 |
| S14 | Approvals & Execution settings | run mode, effective allowlist, admin/file source, classifier health, read-only locked controls | M2 |
| S15 | Sandbox settings/status/blocked tool detail | filesystem/network/temp/cache/effective policy, platform unsupported, explicit out-of-sandbox request | M2 |
| S16 | Browser origins/session permissions | auth isolation, origin allow/block list, session reset, protected action confirmation | M4 |
| S17 | Diagnostics/support panel | engine/daemon/network/index/extension health, redacted preview/export, retry and safe reset | M7 |
| W14 | Shared transcripts gallery/viewer | owner/team filter, visibility/delete, public/team auth, Fork action, revoked/not-found | M9 |
| W15 | Team marketplace administration | source/access/install modes/publish skill/version rollout/revoke; publishing does not install | M9 |
| W16 | Shared canvases gallery/viewer | source revision/publish refresh/revoke, permissions/retention, interactive fallback | M9 |
| W17 | Detailed usage/audit/telemetry | time/member/model/repo filters, cursor pagination, CSV export, empty/partial/export failure | M11 |
| B05 | Bot mobile iOS/Android inbox/computer/chat | same account/computer state, keyboard/voice/network switch; native per OS | M11 |
| B06 | Bot computer recovery/secrets/update status | mobile repair guidance, secret secure entry, desktop-required update route, failed restore | M11 |

Bugbot rule detail and public profile/account detail are subviews of W09/W13. T01/T02 are CLI interfaces, not additional GUI screen families. All their field/state obligations remain required. D07 is a family encompassing import and recovery steps; no 1:1 screen count claim against Cursor.

### J4. Public tool contracts and engine adapter obligations

ชื่อ tool ต่อไปนี้เป็น **Caret contract names ที่เสนอ** ไม่ใช่ private Cursor tool names Request ทุกตัวต้องมี requestId, workspace/host/session/run IDs, expected revision เมื่อเปลี่ยนข้อมูล, cancellation และ deadline; response มี status, typed result/error, provenance และ artifact refs ขนาดใหญ่ ห้ามโยนทุก tool เป็น shell string แล้วอ้างว่ามี typed behavior ครบ

| Tool contract | Input → output | Permission / cancel / required failure fixture |
|---|---|---|
| file.list | roots, glob, depth, cursor → entries,nextCursor | path normalization/symlink policy; unreadable root per-result error |
| file.read | URI, ranges, expectedHash → text/binary/media ref, hash, truncation | ignores และ sandbox แยก; stale hash/binary/large file |
| file.edit | baseHash/modelVersion, edits/rename/create/delete → transaction, diff, checkpoint | editor-owned atomic apply; overlapping user changes conflict ไม่ overwrite |
| search.exact | regex,literal,roots,case,limit,cursor → located matches | invalid regex, ignored roots, cancellation and partial-result marker |
| search.semantic | query,roots,branch/index revision → scored locations/provenance | stale/incomplete index explicit; never fabricated relevance score from missing index |
| symbol.query | definitions/references/diagnostics/type info → source locations | language server unavailable; document version and multi-root identity |
| history.search | text,project/conversation filters,cursor → permitted transcript matches | retention/deletion/revoke respected; tool access and UI search same authorization |
| web.search | query,filters → ranked source metadata/snippets | provider entitlement, rate limit; citations source-bound |
| web.fetch | URL,format,size budget → final URL/body/ref | approval/redirect/private-network policy; unsupported MIME/oversized response |
| rules.resolve | scope,files,mode → effective rules with provenance | no automatic hook execution from discovery; conflicts surfaced |
| terminal.start | command,cwd,env refs,PTY,run profile → processId | mode+OS sandbox before spawn; env redaction; malformed command not shell-injected via wrapper |
| terminal.input | processId,input bytes → output cursor | belongs-to-host/session check; cancelled/dead session |
| terminal.read | processId,cursor,budget → stdout/stderr/status | output truncation/full artifact and backpressure |
| terminal.stop | processId,signal policy → termination state | process-tree cleanup; cancellation acknowledgment not mistaken for finished |
| browser.session | create/attach/reset, origin policy → sessionId | user login isolation; expired/revoked session |
| browser.act | sessionId,observed target,action → updated state | stale target and origin change; navigation/click/type/scroll independently testable |
| browser.inspect | sessionId,DOM/screenshot/console/network → structured observations | credentials/redaction and frame access; partial capture explicit |
| design.annotate | snapshotId,element IDs/normalized coordinates,instructions → annotated ref | immutable snapshot link; unsupported source mapping reported |
| image.generate | prompt,reference artifacts,capabilities → image artifact | correct provider entitlement/cost; cancellation/failure not fake image |
| voice.transcribe | audio artifact,locale → transcript+timing where available | mic/device permissions and privacy; network/model failures; engine chat access not speech access |
| canvas.create/update | source/revision,resource policy → renderable artifact | isolated renderer; source/render revisions align; publication separate |
| question.ask | questions,choices,blocking flag → interactionId | answer/skip/cancel; async agent question versus blocking ACP bridge |
| plan.propose/update | plan,todos,phases,expected revision → plan interaction | approval required to cross plan→build; no response not consent |
| task.spawn/control | parent,engine,workspace strategy,goal → child lifecycle | side/fork/subagent different entity kinds; cancel/resume parent-child semantics |
| review.checkpoint | operation,checkpointId,file revisions → preview/restore result | files only, no transcript deletion; later user changes reconciled |
| git.operation | repo,operation,expected HEAD,args → structured git result | provider/worktree identity, conflicts, no auto irreversible action from UI preview |
| mcp.call | server identity,tool schema version,args → MCP content/app/resources | tool permission and OAuth scopes; transport/reconnect/cancel conformance |
| automation.manage | trigger,timezone,policy,revision → automation/run IDs | creating schedule explicit action; replay dedup and disable in-flight policy |
| artifact.share | artifact/transcript revision,audience → share ref | preview/authorization; revoke/cache invalidation; untrusted public fork sanitizes metadata |

Tool results can contain untrusted text; never merge into system instructions. Checkpoints, goals and recurring schedules are separate entities. `completed turn`, `agent idle`, `goal achieved`, `process exited`, `job lease lost` have distinct events and UI labels.

Adapter envelope: `supported | emulated | unsupported` per capability, with engine version, constraints, evidence case IDs and semantic differences. Emulation must pass the same behavior tests. If an engine cannot expose a necessary pre-execution interception point, it cannot run that tool in the shared mutable workspace under a claimed Caret policy; use an isolated worker/controlled executor or mark capability blocked. A facade does not manufacture hooks or enforce restrictions after a side effect already happened.

### J5. Event and persistence contract sufficient to divide implementation

Caret-owned API v1 is a proposal, not a copied Cursor internal wire protocol. Freeze it before parallel component work:

- IDs: hostId/projectId/workspaceId/sessionId/runId/turnId/toolCallId/interactionId/patchSetId/checkpointId/artifactId/shareId; sourceEngineId stored separately; paths never substitute for identity.
- Commands: protocolVersion, requestId, idempotencyKey for side effects, target IDs, expectedRevision, arguments, clientId. Server persists accepted command before dispatch; replay returns original receipt/result; uncertain completion becomes reconciliation state rather than automatic rerun.
- Events: eventId, schemaVersion, streamId, sequence, timestamp, correlation/causation IDs, type, payload. Types cover session/run/turn transitions, message deltas/final, tool start/output/end, approvals/questions, patch/checkpoint, artifacts, child links, usage, transport and worker leases.
- Resume: client supplies last durable sequence; server sends retained events or a versioned snapshot + cursor. Apply snapshot atomically before later deltas; duplicate event doesn't append transcript twice. Compact history keeps artifact/tool references resolvable according to retention.
- Approvals: bind request to host/tool/normalized arguments/policy revision/base file or HEAD revision/expiry; changing any required binding invalidates prior approval. Persist answered/cancelled/expired so reconnect cannot resurface a usable approval twice.
- Persistence: engine owns native transcript/context; daemon owns lifecycle directory; Caret owns additional view metadata, side/fork/share relationships and patch review. Do not maintain two editable copies of engine context. Import/export explicitly lists which engine state is portable.
- Local storage choice: reuse upstream store for upstream entities; Caret metadata uses a versioned local database when implementation begins, selected and recorded in storage ADR before migration. No assertion that Paseo upstream uses that database. Cloud repository/identity data belongs in service storage, not the desktop settings file.
- Compatibility: handshake rejects incompatible major protocol before mutations; unknown optional fields preserved/ignored by documented rule; unknown event type retained as opaque diagnostic, never interpreted as success; downgrade tests define migration rollback boundary.

Mandatory adversarial timelines: two clients answer one approval; network dies after tool succeeds before receipt; daemon restarts mid-patch; user edits during generated patch; provider quota fails mid-stream; worker lease expires; share revoked while viewer open; webhook repeats after merge; model switch while queued prompt pending. Each has one deterministic expected owner/state and a test fixture before component acceptance.

### J6. Schema-level inventory and conflict resolution

The source coverage extension following this section includes every retrieved URL and section count. It is a work routing ledger, not endpoint schema validation. For every API/SDK/config document, implementation must create one conformance record per callable operation, field and event with: source section/hash; Caret name/namespace mapping; required/optional/default; input/output type; validation; auth scope; side effect; idempotency; paging/stream behavior; errors; deprecation; fixture and result. Parent API-xx/PX-xx cannot pass if any callable child is unclassified or untested.

Explicit public interface boundary:

| Surface | Compatibility target | Required cases |
|---|---|---|
| ACP | standard handshake/session protocol plus declared Caret equivalents of richer extensions | question/plan requests block; todo/task/image notifications don't wait; respond/skip/cancel; stdout framing; authenticate/load/cancel |
| CLI | Caret executable/brand, equivalent documented commands/flags and output semantics | interactive versus print/apply, text/JSON/stream framing, exit codes, stderr, resume/steer, shell mode, worker commands |
| REST | Caret endpoints and own credentials; semantic equivalents of current public resources | create/list/get/update lifecycle, usage/artifacts, pool claims/watch; auth/429/retry/cache/paging; legacy v0 separate optional compatibility |
| SDK TS/Python | own package namespace, matching documented capability classes | custom tools/hooks/subagents, local/cloud/store lifecycle, typed errors, cancellation/dispose; unsupported differences listed per language |
| Config | `.caret` native paths; `.cursor` import with per-file semantic mapper | rules/skills/plugins/hooks/MCP/permissions/sandbox/ignore/worktrees, missing/invalid/unknown/conflict/reload/export roundtrip |
| Extension API | explicit Caret API with optional documented compatibility shim | dynamic MCP registration/disposal and version discovery; no global replacement of private Cursor namespace without implementation |

Do not implement a single universal “project beats user” merge algorithm: permissions concatenate per-key arrays; sandbox has field-specific restrictive merge; rules activation, MCP configuration, plugin discovery and CLI permissions have their own rules. Compatibility fixtures must cover them independently. The earlier architecture precedence sentence is only a high-level authority ordering, not executable configuration semantics.

Known public-source conflicts requiring runtime gate: agent overview describes more than one queue/steer shortcut rollout, shortcut reference uses different Return/queue bindings; ACP question/plan blocks while desktop async questions can continue work; MCP examples omit a type that the field table describes as required. Record source/build/surface, test actual chosen runtime or pinned schema, then choose one behavior. Do not silently average or union contradictory specifications.

Hook inventory to map: preToolUse, postToolUse, postToolUseFailure, subagentStart/Stop, before/afterShellExecution, before/afterMCPExecution, afterFileEdit, beforeReadFile, beforeTabFileRead, afterTabFileEdit, beforeSubmitPrompt, afterAgentResponse, afterAgentThought, stop, sessionStart/End, preCompact, workspaceOpen. Map every documented event even if engine cannot supply it; unsupported is a gap. Never invent hidden thought content to satisfy afterAgentThought.

### J7. End-to-end handoff work packets

Each packet ships source + docs + tests + observed evidence when implementation is authorized. The file/folder names in architecture are proposed destinations only. No code or live integration has been executed now.

| Packet | Dependency / implementation boundary | Deliverable and acceptance |
|---|---|---|
| H01 Reference and requirements | none; docs/state fixture owner | freeze versions; source→parent→child case graph including PX; resolve keyboard/layout conflicts; no orphan sections marked complete |
| H02 Fork and release base | H01; desktop fork/build scripts | three OS family launch + editor/terminal/Git/debugger/extension fixtures; own branding/signing/update identity |
| H03 Contracts and engine feasibility | H01; contracts/daemon-adapter | protocol schema, provider capability matrix, engine event mapping; Paseo F02 outcome with direct-adapter fallback decision |
| H04 Policy and safe write | H02,H03; desktop-bridge/executor | run modes + per-schema config; tool interception; dirty buffer/undo/checkpoint; unmediated side effects prohibited |
| H05 Agent UX vertical slice | H04; workbench/Agents Window | composer/transcript/tools/queue/steer/plan/questions/review/restore; real engine run; stable visual fixtures |
| H06 Context and completion | H05; context/completion services | references/rules/history/exact+semantic search; FIM/next-edit/portal and quality report |
| H07 Parallel conversations | H05; session coordinator | worktrees/subagents/side/fork distinctions; inheritance/cutoff/archive/resume and inter-client races |
| H08 Customization | H04,H05; config/MCP/hooks/plugins | schema-level conformance, OAuth/apps/dynamic registration, team policy/provenance and failure isolation |
| H09 Browser/media/canvas | H05,H08; browser/artifact services | source-linked design tools, voice/image pipelines, isolated canvas, sessions and permissions |
| H10 Device and native mobile | H03,H05,H07; daemon/ios/web | pair/revoke/resync; N families on real devices; notifications/Live Activities/keyboard/diff annotation and desktop-linked context |
| H11 Personal release | H02…H10; release/data | M7 gates; actual install/update/rollback/export/recovery; scope explicitly excludes unfinished cloud ecosystem |
| H12 Cloud workers and identity | H03,H04,H08; cloud services | VM lifecycle/build/pools/metadata/OIDC/private access/leases; laptop-off task and cleanup evidence |
| H13 SCM/connector/automation | H07,H12; provider adapters/scheduler | each provider matrix, webhook/HEAD/identity, routing policies/learned reviews/security; no synthetic integration success |
| H14 Forge/sharing/APIs | H08,H12,H13; forge/share/API/SDK/CLI | refs+PR sync, shared transcript/canvas access/fork/revoke; public interface conformance suites |
| H15 Admin/account/bot | H12…H14; org/usage/bot services | detailed roles/audit/telemetry/privacy and persistent bot mobile iOS/Android; account lifecycle and budget enforcement |
| H16 Clone candidate certification | all; QA/release | 198 parents + all applicable children, 75 screen families/states, behavior/quality/ops evidence; no functional blocked gap counted as pass |

Order remains single-agent-friendly. Packets identify independent ownership boundaries but do not authorize delegation/background work. Stage visual capture and design review before each surface build; H01 lack of a reference blocks exactness claims for that surface, not unrelated infrastructure progress.

### J8. Simplification decisions after scrutiny

Keep the Code - OSS workbench and native extension host; avoid building a second Monaco IDE shell. Reuse agent engines and a daemon only behind a small contract boundary. Use one owner per session and one index per purpose; don't add a vector service before measured need. Keep Gitea/service and cloud machinery out of the personal vertical slice while retaining their required late packets. Use provider-specific adapters rather than a falsely universal integration. Avoid manufacturing the commercial billing/subscription business of Cursor for a personal app: implement access/usage/spend/account behavior against actual Caret providers and label identity/merchant-of-record differences explicitly.

Paseo is conditional until a control-path test proves required interception and event semantics. If it fails, remove that layer instead of building increasingly large proxy logic around it. This is the materially simpler fallback required by scrutinize, and it preserves the Code - OSS fork and UI investment.

### J9. Remaining limits of this handoff

Ready to hand off as an executable **planning and implementation route**, with detailed contracts, work packets and closure gates. Not a fully measured 1:1 design file, not a validated per-field mirror of every API, and not a reconstruction of Cursor's undisclosed engine. Runtime reference access, screen geometry, platform/provider conformance and model comparisons remain evidence work. A successor must not turn “planned” into “verified” merely because this document is long or includes every source URL.
