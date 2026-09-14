# Caret — UI coverage matrix: 75 UI families / 198 parents

วันที่จัดทำ 2026-09-13 · สถานะ: **planned coverage mapping; ไม่ใช่ runtime certification**

> **Amendment 2026-09-14 (spec):** [CARET-SPEC-2026-09-14.th.md](CARET-SPEC-2026-09-14.th.md)
> เป็น spec ที่มีอำนาจเรื่องเจ้าของ surface (S01–S16 ยังใช้เป็นรายการ surface ได้ แต่เจ้าของ
> Agents surface เปลี่ยนจาก webview shell → หน้าต่าง Agents ของฐาน + provider ของ Caret)

อ่านคู่กับ [Detailed design](CARET-UI-DETAILED-DESIGN-2026-09-13.th.md) และ [Validation protocol](CARET-UI-VALIDATION-2026-09-13.th.md). Mapping นี้ครอบคลุม identifiers ไม่แทน field-level runtime schemas; ค่า default/action/motion ใช้ Detailed design เมื่อ overview เดิมต่างกัน. สถานะใน graph ด้านล่างเป็น historical snapshot ไม่ใช่การรับรอง UI รอบนี้

เอกสารนี้เป็น coverage ledger สำหรับ UI / interaction specification โดยอ่านข้อมูลจาก backlog/requirement-graph.json ที่สร้างวันที่ 2026-09-10 และผูกทุก ui_families 75 รายการกับ surface S01–S16 พร้อมแจกแจง parent 198 รายการแบบมี ID และสถานะเดิมครบถ้วน. เป้าหมายคือทำให้คน implement/test ตรวจช่องว่างได้ ไม่ใช่ประกาศว่า Caret รองรับหรือทดสอบครบแล้ว

## 1. ขอบเขต, ตัวหาร และสถานะ

| ตัวหาร | จำนวนใน graph | จำนวนที่ ledger นี้ครอบคลุม | หลักฐาน |
|---|---:|---:|---|
| UI families | 75 | 75/75 | backlog/requirement-graph.json → ui_families[] |
| Parents | 198 | 198/198 | backlog/requirement-graph.json → parents[] |
| Parent family codes | 23 | 23/23 | parents[].family |
| UI-family status | planned:75 | planned:75 | คัดลอกตรงจาก graph |
| Parent statuses | planned:136 · implemented:35 · verified:17 · blocked-external:10 | รวม 198 | คัดลอกตรงจาก graph |

กติกา:

- ตารางด้านล่างรักษา ID/title/contract/status ตาม graph; ไม่มีการเลื่อนสถานะจาก implemented/verified ให้กลายเป็น acceptance ของ Caret. blocked-external เป็นสถานะใน historical graph และยังต้องมี UI ที่แสดง capability/เหตุผล ไม่ลบทิ้งจาก scope.
- Surface mapping เป็น ข้อเสนอการวางหน้าจอและ test seam ใน interaction spec. หนึ่ง requirement ผูกได้หลาย surfaces; การ map ไม่ได้แปลว่าทุก surface implement แล้ว.
- OMP เป็น execution/transcript owner เดียว. Caret host เป็น lifecycle/transport/journal/artifact owner; Code-OSS เป็น editor owner; iPhone เป็น projection. ห้ามอ่าน mapping นี้เพื่อสร้าง harness/agent loop/daemon ชุดที่สอง.
- “verified” ใน graph, static source inspection, no-provider probe และ UI screenshot เป็นหลักฐานคนละระดับ. ต้องมี actual revision/runtime, sanitized capture, contract receipt และ test result ก่อน promote gate.

## 2. หลักฐาน source และสิ่งที่ superseded

Source ชุดที่ใช้มีบทบาทต่างกัน:

| Source | ใช้ทำอะไรใน ledger | สถานะ/ข้อจำกัด |
|---|---|---|
| [requirement graph](../../../backlog/requirement-graph.json) | authoritative IDs, family/title/contract และ parent status | generated 2026-09-10; historical requirement inventory; ไม่ใช่ runtime result |
| [UI interaction spec](CARET-UI-INTERACTION-SPEC-2026-09-13.th.md) | canonical surfaces S01–S16, layout/state/motion/trace | planned; Cursor capture บางส่วน, Codex current capture blocked; proposed timings ไม่ใช่ measured reference parity |
| [OMP coverage](CARET-OMP-COVERAGE-2026-09-12.th.md) | O01–O18 source-derived core inventory, gap and acceptance IDs | pinned OMP v18.1.18; source-exposed ไม่เท่ากับ Caret-supported |
| [OMP source inventory](CARET-OMP-SOURCE-INVENTORY-2026-09-12.md) | exact tools/commands/URI/providers/SDK paths | source checkout /tmp/omp-source.nmo5hX, SHA 00085d4e7dfdcfbf302c122fa2682b410a0f43d1; dynamic registries ต้อง enumerate runtime |
| [Paseo × OMP audit](../../archive/2026-09-12/CARET-PASEO-OMP-AUDIT-2026-09-12.md) | adapter schema/command/PTY/MCP/relay gaps และ focused test pointers | source audit; Paseo tests/provider turns/iPhone not run |
| [product acceptance](CARET-REFERENCE-ACCEPTANCE-2026-09-12.th.md) | P01–P20/E1–E4 gate trace | acceptance evidence must be actual runtime, not labels |
| [task workspace workflow](CARET-WORKSPACE-WORKFLOW-2026-09-13.th.md) | PE-10–PE-13 หน่วย workspace และวงจรรีวิว | planned product decision; ไม่ใช่ runtime result |
| docs/archive/2026-09-09/UI-SPEC.th.md, PARITY-MATRIX.th.md, agent.md, HANDOFF-2026-09-10.md | retained historical behavior/backlog context | architecture/stack assumptions superseded by direction dated 2026-09-12 |

ทิศทางวันที่ 2026-09-12 แทนข้อเสนอเดิมที่ขัดกันด้าน OpenCode/Synara/Zed/renderer/relay และยืนยัน OMP + Code-OSS Mac + host เดียว + mobile/transport candidate. แต่ไม่ได้ลบ requirement graph หรือประกาศ old acceptance gates ผ่าน. ตารางนี้จึงเก็บ requirements เดิมทั้งหมดและเพียงจัดที่วาง UI ให้ implement ได้ใน architecture ปัจจุบัน.

## 3. Surface contract registry (S01–S16)

O01–O18 ในคอลัมน์ OMP อ้างอิง canonical rows ใน CARET-OMP-COVERAGE-2026-09-12.th.md; source paths และ dynamic/static inventory อยู่ใน CARET-OMP-SOURCE-INVENTORY-2026-09-12.md. COV-Sxx-yy เป็น test IDs ที่เสนอในเอกสารนี้ (ยังไม่ใช่ไฟล์ทดสอบที่มีอยู่). P/E/G/UI-S IDs เป็น trace เดิม ไม่ใช่ผล run ใหม่.

| Surface | UI role/states | Actions and contract | OMP inventory / exact source set | Required checks / trace | Evidence status |
|---|---|---|---|---|---|
| S01 Projects/tasks | Navigator ของ project/task บน Mac และ list projection บนมือถือ; states: empty, recent, loading, syncing, active, waiting, completed, failed, outcome_unknown, offline. | เปิด/clone/recent, new task, search/filter, pin, archive/restore, rename, task switch, lineage/fork และ Jump to latest; ห้ามเปลี่ยน session owner ตอนสลับ task. | O04 checkpoint/rewind/context; O05 task/hub/todo/goal; O11 switch_session/branch/get_messages/handoff; O16 session tree/fork/collab; O18 CLI/SDK persistence. Canonical evidence: CARET-OMP-COVERAGE-2026-09-12.th.md และ CARET-OMP-SOURCE-INVENTORY-2026-09-12.md. | ProjectId + sessionId + hostId เป็น key เดียว; durable directory/replay; project isolation; COV-S01-01 open/restore, COV-S01-02 cross-project, COV-S01-03 unknown/reconnect. Trace: P01/P02/P17, PE-10, E4, G2, UI-S1. | ยังเป็น planned: graph/OMP source มีหลักฐาน inventory เท่านั้น; live provider และ two-project recovery ยังไม่ verify. |
| S02 Task header | แถบ identity ของ task: title, project/workspace, branch/worktree, host/connection, current mode และ Agent↔IDE switch; states: resolving, ready, dirty, remote, disconnected, unknown. | เปลี่ยนชื่อ, switch branch/worktree, fork/resume/handoff, เปิด IDE หรือกลับ Agents, แสดง origin/parent/child lineage และ confirmation ก่อน mutation. | O04 checkpoint/rewind; O05 task/goal; O11 get_state/set_session_name/switch_session/branch/handoff; O16 fork/collab; O18 session manager. Source: OMP coverage O04/O05/O11/O16/O18 และ ../archive/2026-09-12/CARET-PASEO-OMP-AUDIT-2026-09-12.md. | Mode switch เป็น view state ไม่ start OMP ใหม่; dirty buffers/scroll/draft คงอยู่; COV-S02-01 A→IDE→A, COV-S02-02 lineage, COV-S02-03 branch conflict. Trace: P02/P11/P17, PE-10, G2/G3, UI-S1. | Caret webview เปิด Agents ได้ แต่ continuity/restore ของ editor layout ยังไม่ใช่ acceptance evidence. |
| S03 Composer | Composer multiline รองรับ Thai IME; states: empty, composing, attaching, ready, submitting, running, queued, stopping, disconnected, error. | พิมพ์/แก้ draft, attach file/image/selection/log, context/slash picker, model/reasoning/config, explicit Send/Queue/Steer/Stop, retry/remove attachment; Enter ต้องไม่ส่งระหว่าง IME composition. | O08 image/speech; O09 MCP/custom tools; O10 rules/skills/hooks/config; O11 prompt/steer/follow_up/abort/set_model/set_thinking_level; O12 stream; O13 ask/editor/status; O14 slash registry; O15 modes; O18 SDK. Source: OMP coverage O08–O15. | Attachment ต้อง immutable content ref ก่อน dispatch; commandId/payload hash; queue owner อยู่ OMP/host; stop ไม่ rollback/auto-send; COV-S03-01 IME, COV-S03-02 upload fail, COV-S03-03 duplicate/queue, COV-S03-04 stale approval. Trace: P03/P05/P06/P15/P16, G1/G3, UI-S2. | มี IME guard/basic controls ใน source; full OMP queue/attachment/provider behavior ยังไม่ verify. |
| S04 Transcript/activity | Timeline ของ user/assistant/thinking/tool/question/artifact/subagent; states: streaming, paused, compacting, reconnecting, paginated, bounded, failed. | expand/collapse tool args/output, copy/link, source/file navigation, elapsed/status, pagination, local find, Jump to latest, preserve scroll anchor และ render unknown events เป็น diagnostics. | O05 jobs/todo/goal/subagents; O11 get_messages/get_messages_page/get_last_assistant_text; O12 stream/state side channels; O16 tree/share; O17 artifacts/history/export. Source: OMP coverage O05/O11/O12/O16/O17. | Ordered event sequence + cursor/snapshot; no transcript duplicate; hidden client bounded; live region summarizes state; COV-S04-01 ordering, COV-S04-02 paging/scroll, COV-S04-03 unknown event, COV-S04-04 restart replay. Trace: P02/P04/P15/P18/P19, E4, G1/G2, UI-S2/UI-S4. | Current card/stream shell is partial; OMP page/side-channel and recovery evidence ยังเปิด. |
| S05 Questions/approvals | Typed select/multi-select/input/editor/confirm/approval cards; states: pending, validating, answered, denied, timeout, stale, revoked, responded_elsewhere. | แสดง requestId, tool, effective args, cwd, target, policy/incarnation; answer/deny/cancel/retry only when contract permits; focus trap เฉพาะ modal และ reject stale before effect. | O02 bash/eval approval; O03 conditional exec; O07 browser/computer; O09 MCP; O13 RPC UI select/confirm/input/editor/cancel; O15 mode policy. Source: OMP coverage O02/O03/O07/O09/O13/O15 และ ../archive/2026-09-12/CARET-PASEO-OMP-AUDIT-2026-09-12.md. | Approval binding = request/tool/effective args/session/incarnation/policy version; no generic text confirm; COV-S05-01 schema fields, COV-S05-02 stale/revoke, COV-S05-03 double response, COV-S05-04 timeout. Trace: P04/P06/P16, G1, UI-S2. | Current adapter maps basic approval/select; option metadata, timeout, cancel/status/widget and stale-device behavior are not verified. |
| S06 Plan/goals/parallel | Plan/plan-review/debug/vibe/goal queue; steps/todos/child cards with active/complete/blocked/paused and token budget; states independent from run status. | edit/confirm plan, Build/continue, pause/resume/drop goal, inspect subagent, reorder/steer queue, cancel child, show budget/lineage; no idle=goal complete inference. | O05 task/hub/todo/yield/goal/think; O06 memory/skills; O10 rules/hooks; O14 slash modes/goal/queue; O15 TUI modes; O16 collaboration. Source: OMP coverage O05/O06/O10/O14/O15/O16. | Internal subagents remain OMP-owned; child IDs/parent lineage durable; plan restrictions are explicit; COV-S06-01 goal budget, COV-S06-02 two children, COV-S06-03 pause/resume, COV-S06-04 compaction/handoff. Trace: P05/P17, G1/G2, UI-S2. | Current goal/todo cards are not proof of native plan/goal/queue command conformance. |
| S07 Work panel | Per-task resource pane with Changes, Terminal, Browser, Preview, Artifacts, Files; states: unopened, loading, ready, live, stale, expired, error, permission. | open/close/tab/pop-out to IDE, resize/collapse/maximize, unread/error badge, resource reload/download, per-task selection; panel drag follows pointer and keyboard resize works. | O01 files/search/AST; O02 bash/eval/process; O03 lsp/debug/GitHub/security; O07 browser/computer; O08 media; O09 MCP; O13 host UI; O17 artifacts/URI. Source: OMP coverage O01/O02/O03/O07–O09/O13/O17. | Resource IDs belong to task/workspace; host owns process/transport; expired resource never silently respawns; COV-S07-01 task isolation, COV-S07-02 resize/focus, COV-S07-03 resource expiry, COV-S07-04 hidden-client bound. Trace: P10–P15, PE-10/PE-11, G2/G3, UI-S3. | Current shell has right resource column/native actions, not full tabs, isolation or lifecycle evidence. |
| S08 Changes/review | Tracked/untracked/binary file list, inline/split diff, hunk states, conflict/checkpoint, review/PR; states: clean, changed, staged, rejected, conflicted, unknown. | select file/hunk, stage/unstage, accept/reject/keep-all, checkpoint/restore, comment, commit/PR/review trigger, compare base; show manual dirty-buffer conflict before applying agent edits. | O01 read/write/edit/AST; O03 GitHub/security; O04 checkpoint/rewind; O11 branch/handoff/export; O16 share/branch; O17 artifacts/receipts. Source: OMP coverage O01/O03/O04/O11/O16/O17 and docs/archive/2026-09-09/PARITY-MATRIX.th.md. | Diff source hash + buffer version + worktree ID; scoped restore never overwrites manual edits; COV-S08-01 untracked/binary, COV-S08-02 three-way conflict, COV-S08-03 review/commit, COV-S08-04 checkpoint. Trace: P07/P11/P20, G3, UI-S3/UI-S5. | Review cards/SCM integration exist partly; dirty-buffer and full OMP rewind semantics remain open. |
| S09 IDE | Code-OSS editor owner: Explorer/search/SCM, tabs/splits, LSP/debug/test, extensions, settings; states: clean/dirty, diagnostic, debugger stopped/running, extension loading/error. | open folder, edit/undo, tab/split/pin, search/replace/symbols, diagnostics/rename/debug/test, extension install/enable/reload, Agent pane; preserve editor selection and layout across mode switch. | O01 files/search/AST; O03 lsp/debug/GitHub/security; O04 checkpoint/rewind; O10 rules/skills/hooks; O18 SDK/extension lifecycle. Source: OMP coverage O01/O03/O04/O10/O18 and implementation direction. | Code-OSS owns buffers/undo/LSP; host bridges versioned edits; COV-S09-01 A↔IDE retention, COV-S09-02 dirty conflict, COV-S09-03 LSP/debug/test, COV-S09-04 extension failure. Trace: P07–P09/P20, G3, UI-S1/UI-S3. | Retained Code-OSS is architectural choice; Caret Agent shell alone is not full IDE acceptance. |
| S10 Terminal | Interactive user PTY separated from OMP tool output; states: launching, ready, running, input, resizing, stopped, exited, disconnected. | new terminal, input/keys, cwd/profile, resize, send signal/stop, scroll/download log, terminal command preview/execute; show OMP rpc-ui no-PTY limitation. | O02 bash/eval/process; O11 bash/abort_bash; O13 host tools/URI; O18 SDK/CLI. Source: OMP source inventory O02/O11/O13/O18 and ../archive/2026-09-12/CARET-PASEO-OMP-AUDIT-2026-09-12.md (PI_NO_PTY=1 in rpc-ui). | User PTY host process ≠ OMP in-process PTY; command identity/cwd/exit code recorded; COV-S10-01 PTY resize, COV-S10-02 long process/abort, COV-S10-03 output separation, COV-S10-04 reconnect. Trace: P10, G1/G3, UI-S3. | Native terminal action exists; OMP PTY parity is explicitly open and cannot be implied by a separate shell. |
| S11 Browser | Isolated browser tabs/navigation and optional design mode; states: blank, loading, loaded, dialog, blocked origin, crashed, disconnected, expired handle. | URL/back/forward/reload, tabs, screenshot, select element/multiselect/annotation, console/network when bridge supports; reset session and display agent-control indicator. | O07 browser/computer bridge; O09 MCP/custom; O13 host UI/open-url; O17 artifact/screenshot. Source: OMP coverage O07/O09/O13/O17 and packages/coding-agent/src/tools/browser.ts, computer.ts. | Origin/session allowlist and credentials isolated per project; arbitrary page no Node/file bridge; handles require incarnation; COV-S11-01 navigation isolation, COV-S11-02 permission/handle expiry, COV-S11-03 screenshot/AX, COV-S11-04 console error. Trace: P12/P14, G1/G3, UI-S3. | Cursor browser entry was observed; Caret browser automation/AX reconnect is not verified. |
| S12 Preview/artifacts | MIME-aware image/audio/video/document/build preview plus source/revision panel; states: pending, rendering, ready, failed, superseded, unknown MIME. | open/download/original, source link, revision switch, share/revoke where allowed, failed-build inspect and last-good compare; unknown MIME downloads safely without execute. | O07 browser screenshots; O08 generate_image/tts; O13 UI widget; O17 artifact/internal URI/export. Source: OMP coverage O07/O08/O13/O17 and docs/blob-artifact-architecture.md. | Artifact receipt includes MIME, size, hash, buildId, source SHA, task and device; immutable viewer; COV-S12-01 hash/receipt, COV-S12-02 failed/last-good, COV-S12-03 MIME safety, COV-S12-04 mobile preview. Trace: P13/P15, PE-12, G3/G4, UI-S3/UI-S4. | Existing artifact/demo card is partial; provider media and immutable cross-device viewer are unverified. |
| S13 OMP settings/catalog | Effective registry UI for models/providers/config/tools/MCP/skills/hooks/extensions; states: available, needs-auth, disabled, unsupported, loading, error. | list/set/cycle model and thinking, inspect tool load mode/schema, provider login/quota, MCP server lifecycle, skills/rules provenance, extension reload, config validation/redacted secrets. | O06 memory/skills; O08 media; O09 MCP/custom; O10 config/rules/hooks; O11 all 42 RPC; O13 UI/host; O14 slash registry; O18 SDK/ACP/CLI. Source: OMP coverage O06/O08–O11/O13/O14/O18 and evidence/omp-rpc-2026-09-12/source-inventory.json. | Effective availability comes from runtime registry, never static labels; unknown fields preserved; permission/auth/cost explicit; COV-S13-01 registry drift, COV-S13-02 model/auth, COV-S13-03 MCP lifecycle, COV-S13-04 settings precedence. Trace: P03/P04/P16, G1, UI-S2/UI-S5. | Probe saw only bounded no-provider registries (11/12 tools); that is not full OMP coverage. |
| S14 Devices/recovery | Pairing, host/relay status, session replay and diagnostics; states: unpaired, pairing, ready, offline, reconnecting, replaying, revoked, outcome_unknown. | pair/revoke/rename device, host health, last sync, replay cursor/snapshot, inspect/reconcile pending command, export redacted diagnostics; no automatic destructive retry. | O04 history/recovery; O05 jobs/subagents; O11 session/replay commands; O12 stream ordering; O16 collab/share; O17 artifact receipts; O18 initialization/version. Source: OMP coverage O04/O05/O11/O12/O16–O18 and ../archive/2026-09-12/CARET-RELAY-ASSESSMENT-2026-09-12.th.md. | Durable envelope has deviceId/commandId/sessionId/incarnation/payload hash; same ID joins, changed payload rejects; unknown effect reconciles; COV-S14-01 disconnect-before/after ACK, COV-S14-02 revoke, COV-S14-03 replay, COV-S14-04 crash ambiguity. Trace: P18–P20, E4, G2/G4, UI-S4. | Transport/relay is a candidate reuse path; real cellular iPhone and crash reconciliation are open. |
| S15 Mobile task | iPhone/iPad projection of same task: inbox, transcript, composer, approvals, preview/review; states: fresh, stale, background, offline draft, reconnecting, revoked. | switch task, send/queue/steer/stop where OMP contract allows, attach photo/file, answer approval, review diff/artifact, keyboard/safe-area, background/foreground refresh; never spawn OMP on iOS. | O05 task/subagent; O07 browser screenshots; O08 media; O11 prompt/state; O12 stream; O13 UI requests; O16 session/share; O17 artifacts; O18 client lifecycle. Source: OMP coverage O05/O07/O08/O11–O13/O16–O18 plus Paseo connectivity audit. | Mobile is a projection keyed to host session; attachment/upload and approval responses are durable; COV-S15-01 cellular same session, COV-S15-02 background/reconnect, COV-S15-03 attachment/approval, COV-S15-04 hash/receipt. Trace: P18/P19, PE-12/PE-13, E4, G4, UI-S4/UI-S5. | Expo/mobile shell exists; physical device, relay and full parity are not verified. |
| S16 Product settings | Cross-cutting appearance/text scale/motion/shortcuts/notifications, data/privacy, update/license and capability diagnostics; states: default, changed, invalid, admin-locked, migration-required. | theme/light-dark/high-contrast, reduced motion, keyboard mapping, retention/export/delete/redaction, notifications, release channel/update/migration, runtime/license diagnostics; no fake-enabled feature. | O06 memory/skills; O09 MCP/plugins; O10 rules/hooks/config; O11 stats/export/login; O14 slash/settings; O15 modes; O16 sharing; O18 SDK/CLI. Source: OMP coverage O06/O09/O10/O11/O14–O16/O18 and implementation direction. | Settings writes are scoped/audited; secrets redacted; admin policy wins; theme/motion tokens shared with mobile; COV-S16-01 theme/zoom/a11y, COV-S16-02 reduced motion, COV-S16-03 retention/export, COV-S16-04 update rollback. Trace: P14/P15/P20, G5, UI-S5. | Current source has semantic tokens/reduced-motion CSS; full theme/a11y/update acceptance remains planned. |

### Surface-level implementation rules

1. State axes แยกกัน: connection (online/offline), run (idle/running/stopping), delivery (queued/acked/unknown) และ UI request (approval/question) ห้ามบีบเป็น enum เดียว. S03/S04/S05/S14 ต้อง render combination ที่ขัดกันได้ เช่น running+offline หรือ waiting approval+reconnecting.
2. One owner: S03–S06 ส่งคำสั่งผ่าน host→OMP RPC-UI; S07/S10/S11/S12 ใช้ host resource IDs; S09 ให้ Code-OSS คุม buffer; S14/S15 replay จาก journal/cursor. UI card ที่มีชื่อเครื่องมือแต่ไม่มี effective registry/schema ไม่ถือว่า coverage.
3. Capability honesty: แยก available, needs-auth, unsupported, error, blocked-external; ปุ่มที่ unavailable ต้องอธิบาย owner/requirement/test ไม่ทำเป็น disabled เงียบหรือ fake success. Graph blocked-external ยังต้องมี row และ surface.
4. Continuity: mode switch และ mobile reconnect คง projectId/sessionId/incarnation, draft/attachment refs, transcript anchor, editor version และ panel resource IDs. OMP transcript ไม่ถูก copy เป็น client transcript ชุดใหม่.
5. Safety before motion: approval/deny/execute/retry effect ต้อง commit ไปยัง durable boundary ก่อน animation; animation ถูก interrupt/reverse ได้และ reduced-motion ตัด transition. ใช้ motion values ใน interaction spec เป็น proposed contract.
6. Evidence: ทุก COV-* ต้องบันทึก source/runtime revision, OMP version/hash, host/device, theme/scale/viewport, input, result status และ artifact/log hash; แยก implemented/verified/externally blocked.

## 4. UI-family coverage — ครบ 75/75

ทุก row คัดลอก id, title, cluster, contract, status จาก ui_families[]; Surface(s) คือตำแหน่ง UI ที่ต้องปิด requirement นี้. family status ใน graph เป็น planned ทั้งหมด ณ วันที่สร้าง graph.

| UI family ID | Title | Cluster | Graph status | Surface(s) | Contract (จาก graph) |
|---|---|---|---|---|---|
| D01 | Welcome/open/recent | Desktop Editor | planned | S01,S09 | open/clone/recent/import choices, keyboard-first, recover missing path \| IDE |
| D02 | Workspace shell | Desktop Editor | planned | S09 | activity/explorer/search/SCM, tabs, breadcrumbs, split editor, bottom panel \| IDE/SEARCH |
| D03 | Tab prediction | Desktop Editor | planned | S09 | ghost text/multiline diff, inline location cue, bottom portal, status menu \| TAB |
| D04 | Inline edit | Desktop Editor | planned | S03,S09 | anchored input at selection, prompt/follow-up, streaming proposal, accept/reject \| EDIT |
| D05 | Editor diff/recovery | Desktop Editor | planned | S08,S09 | original/proposed lines, hunk actions, file actions, conflicts/checkpoints \| REV |
| A01 | Task/project navigation | Agents Window และ agent pane | planned | S01 | grouped list, active/attention/completed icons, pin/search/new/context menu \| AG-01/02 |
| A02 | Empty/new task | Agents Window และ agent pane | planned | S01,S02,S03 | prompt focus, repo/branch/worker selectors, scratch project choice \| AG/CLOUD |
| A03 | Composer/pickers | Agents Window และ agent pane | planned | S03 | multiline input, attachment chips, mode/model/effort, context ring, send/stop/voice \| CTX/MOD |
| A04 | Active conversation | Agents Window และ agent pane | planned | S04 | user block, response typography, tool rows, progress, expanded child outputs \| AG |
| A05 | Prompt queue/steering | Agents Window และ agent pane | planned | S03,S04 | pending messages, edit/remove/reorder/send-now; clear current-vs-next intent \| AG-04/05 |
| A06 | Plan/debug/question | Agents Window และ agent pane | planned | S05,S06 | editable plan + Build, todo list, clarifying options, hypothesis/evidence cards \| MOD |
| A07 | Review workspace | Agents Window และ agent pane | planned | S08 | file list + diff, totals, staged/unstaged/task changes, commit message/actions \| REV |
| A08 | PR detail | Agents Window และ agent pane | planned | S08 | title/status/branch/checks, timeline/files/commits, comments/reviewer/merge controls \| REV/SCM |
| A09 | Worktree/handoff | Agents Window และ agent pane | planned | S02,S14 | destination picker, branch, setup progress, conflicts, return-to-workspace \| WT |
| A10 | Browser/Design Mode | Agents Window และ agent pane | planned | S07,S11 | address/navigation, device viewport, selected outlines, annotation toolbar \| VIS |
| A11 | Subagents/approvals | Agents Window และ agent pane | planned | S05,S06 | child cards/detail/back-to-parent; approval arguments/scope/allow-deny \| CUS/SAFE |
| A12 | Artifacts/canvas | Agents Window และ agent pane | planned | S07,S12 | media preview/download/source, tabs, revisions/share state, failed render \| VIS/AG |
| A13 | Voice session | Agents Window และ agent pane | planned | S03,S04 | listening/transcribing/responding, mic/stop/text transition; no focus theft \| VIS |
| N01 | Pair/sign-in/device | Native mobile | planned | S14,S15 | QR/link/manual host, identity confirmation, invalid/expired/revoked connection \| LOC |
| N02 | Inbox/workspaces | Native mobile | planned | S01,S15 | task rows/pinned/date groups, search/filter, status/subtitle, bottom new composer \| MOB-01 |
| N03 | Create task | Native mobile | planned | S02,S03,S15 | repo/branch/worker/model selection; prompt/attachments; missing capability message \| MOB-02 |
| N04 | Chat/subagent | Native mobile | planned | S04,S05,S15 | transcript/tool cards, child navigation, follow-up/stop/approval, jump-to-latest \| MOB-03 |
| N05 | Diff/PR review | Native mobile | planned | S08,S15 | changed files selection, compact diff, hunk/context, checks/comments/merge tray \| MOB-04 |
| N06 | Media/annotation | Native mobile | planned | S12,S15 | black media stage, point labels/freehand, undo/redo/clear/done, text feedback \| MOB-05 |
| N07 | Voice/keyboard | Native mobile | planned | S03,S15 | dictation sheet or active voice state, native keyboard, editable transcript \| MOB-06 |
| N08 | Activity/notifications | Native mobile | planned | S14,S15 | task deep links, lock-screen representation, stale/completed/revoked states \| MOB-07 |
| N09 | iPad workspace | Native mobile | planned | S08,S15 | sidebar/chat/review, collapse at constrained width, Pencil/hardware keyboard \| MOB-08 |
| N10 | Offline/settings bridge | Native mobile | planned | S14,S15,S16 | cached items marked fresh/stale, reconnect banner, open dashboard settings \| MOB-09/10 |
| S01 | General/appearance | Settings | planned | S16 | theme, text/zoom, keyboard, profile, open Editor/Agents preference |
| S02 | Providers/models | Settings | planned | S13 | connect/status/default/model list/effort/capabilities/quota |
| S03 | Tab/inline edit | Settings | planned | S16 | enable/snooze/languages/model/shortcuts/privacy |
| S04 | Indexing/ignore/docs | Settings | planned | S09,S13 | roots/status/exclusions/rebuild/source refresh |
| S05 | Rules/skills/modes | Settings | planned | S06,S13 | provenance/effective activation/import/create/enable |
| S06 | Subagents | Settings | planned | S06,S13 | roles/model/tools/isolation/local-cloud settings |
| S07 | MCP | Settings | planned | S07,S13 | server list/status/auth/tools/resources/config/error logs |
| S08 | Hooks | Settings | planned | S04,S13 | scope/type/event/timeout/trust/history/schema validation |
| S09 | Plugins/marketplaces | Settings | planned | S13,S16 | discovery/details/permissions/install/update/remove/version |
| S10 | Agents/devices/runtime | Settings | planned | S13,S14 | run mode, remote control, keep-awake, paired devices/hosts |
| S11 | Git/PR/worktrees | Settings | planned | S08,S13 | review trigger/depth, setup, cleanup policy, default branch |
| S12 | Data/notifications/updates | Settings | planned | S16 | retention/export/delete/redaction, push, release channel |
| W01 | Web tasks | Web/dashboard และ ecosystem | planned | S01,S04 | same session list/filter/conversation model as desktop |
| W02 | New cloud task | Web/dashboard และ ecosystem | planned | S01,S02,S03 | repo/scratch/branch/model/environment/worker |
| W03 | PR/codebase review | Web/dashboard และ ecosystem | planned | S08 | files/commits/checks/comments/reviews/actions |
| W04 | Environments/secrets | Web/dashboard และ ecosystem | planned | S13,S14 | config/start/install/network/secret refs/test setup |
| W05 | Builds | Web/dashboard และ ecosystem | planned | S07,S12 | list/status/source SHA/logs/current build/failure/debug/rebuild |
| W06 | Workers/pools | Web/dashboard และ ecosystem | planned | S01,S14 | host health/capacity/claim/routing/hibernate/revoke |
| W07 | Automation editor | Web/dashboard และ ecosystem | planned | S06,S16 | trigger/prompt/tools/repo/policy/schedule/timezone |
| W08 | Automation runs | Web/dashboard และ ecosystem | planned | S04,S14 | immutable inputs/events/cost/error/retry/disable |
| W09 | Reviews/security | Web/dashboard และ ecosystem | planned | S05,S08,S16 | findings/severity/evidence/feedback/analytics/routing policies |
| W10 | Repo hosting | Web/dashboard และ ecosystem | planned | S01,S09 | create/sync/browse/search/branches/settings/apps |
| W11 | Integrations | Web/dashboard และ ecosystem | planned | S13,S16 | account connection/scopes/repo routing/webhook health |
| W12 | APIs/SDK/CLI setup | Web/dashboard และ ecosystem | planned | S13,S16 | keys/versions/docs/examples/scopes/revoke |
| W13 | Organization/usage | Web/dashboard และ ecosystem | planned | S14,S16 | members/groups/roles/SSO/SCIM/budgets/audit/attribution |
| B01 | Persistent bots roster | Web/dashboard และ ecosystem | planned | S01,S16 | new/edit/name/pin/status/share/delete |
| B02 | Bot conversation/memory | Web/dashboard และ ecosystem | planned | S04,S06 | persistent instructions/history/memory edit/provenance |
| B03 | Bot computer | Web/dashboard และ ecosystem | planned | S11,S14 | live view/take control/browser account attention |
| B04 | Bot settings/team setup | Web/dashboard และ ecosystem | planned | S14,S16 | notifications/plugins/network/identity/retention |
| A14 | Side chat panel, parent breadcrumb, prompt, @mention-return, archive | J3. UI inventory เพิ่ม — 18 screen families รวมเป็น 75 | planned | S02,S03,S04 | parent context ไม่ปรากฏเป็น transcript; parent continues; nonnested/local-only baseline \| M4 |
| A15 | Fork menu/message action, source cutoff preview, destination/new chat | J3. UI inventory เพิ่ม — 18 screen families รวมเป็น 75 | planned | S01,S04 | distinguish whole/message/side; descendants after cutoff absent \| M4 |
| A16 | Global chat search + in-transcript find bar | J3. UI inventory เพิ่ม — 18 screen families รวมเป็น 75 | planned | S01,S04 | query/results/snippet/highlight/count/next/previous, search index building/no matches/error, focus returns to source \| M3 |
| A17 | Share preview, redaction notice, Team/Public visibility, copy/open/revoke | J3. UI inventory เพิ่ม — 18 screen families รวมเป็น 75 | planned | S04,S16 | publishing/published/failure/disabled-by-policy; explicit publish action; unsent preview never share \| M9 |
| A18 | MCP App panel, tool provenance, embedded controls, text fallback | J3. UI inventory เพิ่ม — 18 screen families รวมเป็น 75 | planned | S07,S13 | loading/crashed/reconnect/auth; isolated origin and resize messages; keyboard escape returns host \| M4 |
| D06 | Terminal prompt bar and command preview | J3. UI inventory เพิ่ม — 18 screen families รวมเป็น 75 | planned | S03,S10 | terminal focus/cwd/profile, generation/cancel/execute; no unexpected run on focus change \| M3 |
| D07 | Migration/recovery assistant | J3. UI inventory เพิ่ม — 18 screen families รวมเป็น 75 | planned | S09,S14 | selectable imports/conflict preview/backup/progress/retry/restore; no source app overwrite \| M1 |
| S13 | Deep-link import/install confirmation | J3. UI inventory เพิ่ม — 18 screen families รวมเป็น 75 | planned | S03,S13 | decoded content/source/action/destination, validation error, duplicate/conflict; no auto execution \| M4 |
| S14 | Approvals & Execution settings | J3. UI inventory เพิ่ม — 18 screen families รวมเป็น 75 | planned | S05,S13,S16 | run mode, effective allowlist, admin/file source, classifier health, read-only locked controls \| M2 |
| S15 | Sandbox settings/status/blocked tool detail | J3. UI inventory เพิ่ม — 18 screen families รวมเป็น 75 | planned | S10,S13,S14 | filesystem/network/temp/cache/effective policy, platform unsupported, explicit out-of-sandbox request \| M2 |
| S16 | Browser origins/session permissions | J3. UI inventory เพิ่ม — 18 screen families รวมเป็น 75 | planned | S11,S13,S14 | auth isolation, origin allow/block list, session reset, protected action confirmation \| M4 |
| S17 | Diagnostics/support panel | J3. UI inventory เพิ่ม — 18 screen families รวมเป็น 75 | planned | S14,S16 | engine/daemon/network/index/extension health, redacted preview/export, retry and safe reset \| M7 |
| W14 | Shared transcripts gallery/viewer | J3. UI inventory เพิ่ม — 18 screen families รวมเป็น 75 | planned | S04,S16 | owner/team filter, visibility/delete, public/team auth, Fork action, revoked/not-found \| M9 |
| W15 | Team marketplace administration | J3. UI inventory เพิ่ม — 18 screen families รวมเป็น 75 | planned | S13,S16 | source/access/install modes/publish skill/version rollout/revoke; publishing does not install \| M9 |
| W16 | Shared canvases gallery/viewer | J3. UI inventory เพิ่ม — 18 screen families รวมเป็น 75 | planned | S12,S16 | source revision/publish refresh/revoke, permissions/retention, interactive fallback \| M9 |
| W17 | Detailed usage/audit/telemetry | J3. UI inventory เพิ่ม — 18 screen families รวมเป็น 75 | planned | S14,S16 | time/member/model/repo filters, cursor pagination, CSV export, empty/partial/export failure \| M11 |
| B05 | Bot mobile iOS/Android inbox/computer/chat | J3. UI inventory เพิ่ม — 18 screen families รวมเป็น 75 | planned | S14,S15 | same account/computer state, keyboard/voice/network switch; native per OS \| M11 |
| B06 | Bot computer recovery/secrets/update status | J3. UI inventory เพิ่ม — 18 screen families รวมเป็น 75 | planned | S14,S16 | mobile repair guidance, secret secure entry, desktop-required update route, failed restore \| M11 |

## 5. Parent coverage — ครบ 198/198

ส่วนนี้เป็น parent ledger แบบ exact ID: ทุกแถวมี id, status, title เดิม และ surface mapping. การจัดกลุ่มใช้ parents[].family เท่านั้น; ไม่เปลี่ยนสถานะและไม่อนุมานว่า implemented/verified ใน graph แปลว่าผ่าน current Caret runtime.

### IDE (12 parents; planned:12; surfaces S01,S09,S07,S10,S08,S16,S13,S14,S15)

| Parent ID | Graph status | Requirement title | Surface(s) |
|---|---|---|---|
| IDE-01 | planned | เปิด folder/repo/recent/workspace | S01,S09 |
| IDE-02 | planned | Editor tabs/splits/preview tabs | S09 |
| IDE-03 | planned | Explorer/file operations | S07,S09 |
| IDE-04 | planned | Search/replace/navigation | S09 |
| IDE-05 | planned | Terminal/tasks | S09,S10 |
| IDE-06 | planned | Git/source control | S08,S09 |
| IDE-07 | planned | LSP/debugger/test tooling | S09 |
| IDE-08 | planned | Settings/themes/keybindings/profiles | S09,S16 |
| IDE-09 | planned | Extensions lifecycle | S09,S13 |
| IDE-10 | planned | Remote SSH/WSL/dev environment | S09,S14 |
| IDE-11 | planned | Accessibility/zoom/localization | S09,S15,S16 |
| IDE-12 | planned | Installer/update/recovery | S14,S16 |

### TAB (7 parents; implemented:3, planned:3, verified:1; surfaces S09,S03,S16)

| Parent ID | Graph status | Requirement title | Surface(s) |
|---|---|---|---|
| TAB-01 | implemented | Ghost text/FIM completion | S09 |
| TAB-02 | implemented | Accept/reject/partial accept | S09 |
| TAB-03 | planned | Multiline replacement/imports | S09 |
| TAB-04 | planned | Jump-in-file | S09 |
| TAB-05 | planned | Cross-file next edit/portal | S03,S09 |
| TAB-06 | implemented | Snooze/global/filetype controls | S09,S16 |
| TAB-07 | verified | Quality/latency | S09,S16 |

### EDIT (4 parents; implemented:4; surfaces S03,S09,S02,S10)

| Parent ID | Graph status | Requirement title | Surface(s) |
|---|---|---|---|
| EDIT-01 | implemented | Selection inline edit | S03,S09 |
| EDIT-02 | implemented | Generate at cursor / follow-up | S03,S09 |
| EDIT-03 | implemented | Inline-to-agent handoff | S02,S03,S09 |
| EDIT-04 | implemented | Terminal command generation | S03,S10 |

### AG (11 parents; implemented:9, verified:2; surfaces S01,S09,S04,S03,S05,S02,S07,S10,S11,S06,S12,S08)

| Parent ID | Graph status | Requirement title | Surface(s) |
|---|---|---|---|
| AG-01 | implemented | Editor sidepane + Agents Window | S01,S09 |
| AG-02 | implemented | Multi-project/task list | S01 |
| AG-03 | implemented | Streaming transcript/tool cards | S04 |
| AG-04 | implemented | Prompt queue | S03,S04 |
| AG-05 | verified | Steer/send now/cancel | S03,S04,S05 |
| AG-06 | implemented | Resume/fork/history | S01,S02,S04 |
| AG-07 | implemented | File edit/shell/web/question tools | S03,S05,S07,S10,S11 |
| AG-08 | implemented | Goals / long-running task | S06 |
| AG-09 | implemented | Task todo/progress | S04,S06 |
| AG-10 | implemented | Artifacts/demos | S07,S12 |
| AG-11 | verified | Worktree/branch/PR handoff | S02,S08 |

### CTX (7 parents; planned:7; surfaces S03,S09,S07,S10,S11,S12,S15,S04,S06,S13,S02)

| Parent ID | Graph status | Requirement title | Surface(s) |
|---|---|---|---|
| CTX-01 | planned | @Files/Folders และ nested picker | S03,S09 |
| CTX-02 | planned | @Terminal/Chat/Git/Browser | S03,S07,S10,S11 |
| CTX-03 | planned | Image/clipboard/drop/attachments | S03,S12,S15 |
| CTX-04 | planned | Context ring/breakdown | S03,S04 |
| CTX-05 | planned | Compaction/summarization | S04,S06,S13 |
| CTX-06 | planned | Model/reasoning/context picker | S03,S13 |
| CTX-07 | planned | Mid-session model switch | S02,S03,S13 |

### MOD (5 parents; planned:5; surfaces S03,S05,S06,S09,S13)

| Parent ID | Graph status | Requirement title | Surface(s) |
|---|---|---|---|
| MOD-01 | planned | Ask/read-only | S03,S05 |
| MOD-02 | planned | Plan mode | S06 |
| MOD-03 | planned | Debug mode | S06,S09 |
| MOD-04 | planned | Custom skill mode | S06,S13 |
| MOD-05 | planned | Auto/model routing | S03,S13 |

### SEARCH (7 parents; verified:1, implemented:6; surfaces S09,S03,S14,S13,S01,S04)

| Parent ID | Graph status | Requirement title | Surface(s) |
|---|---|---|---|
| SEARCH-01 | verified | Exact/regex/word search | S09 |
| SEARCH-02 | implemented | Symbol/semantic retrieval | S03,S09 |
| SEARCH-03 | implemented | Index progress/rebuild/pause | S09,S14 |
| SEARCH-04 | implemented | Ignore hierarchy/import | S09,S13 |
| SEARCH-05 | implemented | Permission/ignore distinction | S09,S13 |
| SEARCH-06 | implemented | Branch/multi-root/large repo | S01,S09 |
| SEARCH-07 | implemented | Documentation sources | S04,S09 |

### REV (6 parents; planned:2, verified:2, implemented:2; surfaces S08,S09,S14,S04,S16,S02)

| Parent ID | Graph status | Requirement title | Surface(s) |
|---|---|---|---|
| REV-01 | planned | File/hunk review inline/split | S08,S09 |
| REV-02 | verified | Accept/reject/keep-all | S08 |
| REV-03 | verified | Checkpoint/restore | S08,S14 |
| REV-04 | implemented | Agent Review quick/deep | S04,S08 |
| REV-05 | planned | Review trigger configuration | S08,S16 |
| REV-06 | implemented | Commit/PR lifecycle | S02,S08 |

### WT (5 parents; verified:5; surfaces S01,S02,S14,S08,S04,S06)

| Parent ID | Graph status | Requirement title | Surface(s) |
|---|---|---|---|
| WT-01 | verified | Create/discover/select worktree | S01,S02 |
| WT-02 | verified | OS-specific setup hooks | S01,S14 |
| WT-03 | verified | Move task and bring changes back | S02,S08 |
| WT-04 | verified | Best-of-N/parallel runs | S04,S06 |
| WT-05 | verified | Cleanup/retention | S01,S14 |

### CUS (15 parents; planned:12, implemented:1, verified:2; surfaces S13,S16,S09,S06,S04,S14,S05,S07)

| Parent ID | Graph status | Requirement title | Surface(s) |
|---|---|---|---|
| CUS-01 | planned | Rules scopes/activation | S13,S16 |
| CUS-02 | planned | AGENTS.md and imported configs | S09,S13,S16 |
| CUS-03 | planned | Skills discovery/frontmatter/assets | S06,S13 |
| CUS-04 | planned | Skill creation/import/sync | S13,S16 |
| CUS-05 | planned | Built-in workflow skills | S06,S13 |
| CUS-06 | planned | Subagent foreground/background | S04,S06 |
| CUS-07 | planned | Cloud subagent / autopilot | S06,S14 |
| CUS-08 | implemented | Hooks lifecycle | S13,S16 |
| CUS-09 | planned | Hooks command/prompt types | S13,S16 |
| CUS-10 | verified | MCP stdio/SSE/Streamable HTTP | S13 |
| CUS-11 | verified | MCP tools/resources/prompts/elicitation | S05,S07,S13 |
| CUS-12 | planned | MCP Apps | S07,S13 |
| CUS-13 | planned | Plugin manifest lifecycle | S13,S16 |
| CUS-14 | planned | Team marketplace/publishing | S13,S16 |
| CUS-15 | planned | Configuration editor / validation | S13,S16 |

### VIS (10 parents; planned:10; surfaces S07,S11,S12,S03,S16,S15)

| Parent ID | Graph status | Requirement title | Surface(s) |
|---|---|---|---|
| VIS-01 | planned | Embedded browser/navigation | S07,S11 |
| VIS-02 | planned | Browser tools | S07,S11 |
| VIS-03 | planned | Element and multiselect | S07,S11 |
| VIS-04 | planned | Annotation/drawing/frozen frame | S07,S11,S12 |
| VIS-05 | planned | Visual prompt/source linkage | S03,S11 |
| VIS-06 | planned | Image generation/input/output | S03,S12 |
| VIS-07 | planned | Canvas create/list/source/iterate | S12 |
| VIS-08 | planned | Canvas share/refresh/revoke | S12,S16 |
| VIS-09 | planned | Dictation | S03,S15 |
| VIS-10 | planned | Conversational voice | S03,S15 |

### LOC (5 parents; verified:2, planned:2, implemented:1; surfaces S14,S15,S04,S01)

| Parent ID | Graph status | Requirement title | Surface(s) |
|---|---|---|---|
| LOC-01 | verified | Pair/local worker registration | S14,S15 |
| LOC-02 | verified | Remote control existing run | S04,S14,S15 |
| LOC-03 | planned | Host lifecycle | S14 |
| LOC-04 | implemented | LAN/private/relay connection | S14,S15 |
| LOC-05 | planned | Multiple hosts/repositories | S01,S14 |

### MOB (11 parents; planned:10, implemented:1; surfaces S01,S15,S02,S03,S04,S05,S08,S12,S14,S16)

| Parent ID | Graph status | Requirement title | Surface(s) |
|---|---|---|---|
| MOB-01 | planned | Inbox/tasks/search/filter/pin | S01,S15 |
| MOB-02 | planned | New task/repo/branch/worker/model | S02,S03,S15 |
| MOB-03 | planned | Chat/steering/subagent details | S04,S05,S15 |
| MOB-04 | planned | PR review and lifecycle | S08,S15 |
| MOB-05 | planned | Image/file/camera/annotation | S12,S15 |
| MOB-06 | planned | Voice | S03,S15 |
| MOB-07 | planned | Notifications/Live Activities | S14,S15 |
| MOB-08 | planned | iPad layout/Pencil | S08,S15 |
| MOB-09 | implemented | Offline/reconnect/background | S14,S15 |
| MOB-10 | planned | Mobile/web boundary | S14,S15,S16 |
| MOB-11 | planned | Android PWA | S14,S15 |

### CLOUD (11 parents; blocked-external:10, implemented:1; surfaces S06,S14,S01,S02,S13,S07,S12,S11,S16)

| Parent ID | Graph status | Requirement title | Surface(s) |
|---|---|---|---|
| CLOUD-01 | blocked-external | Provision/stop/recover isolated worker | S06,S14 |
| CLOUD-02 | blocked-external | Repo/branch/multi-repo/no-repo | S01,S02,S14 |
| CLOUD-03 | blocked-external | Environment setup | S13,S14 |
| CLOUD-04 | blocked-external | Builds/snapshots/history | S07,S12,S14 |
| CLOUD-05 | blocked-external | Artifact/demo/desktop stream | S07,S12 |
| CLOUD-06 | blocked-external | Computer use Mac/Linux | S11,S14 |
| CLOUD-07 | blocked-external | My Machines / Team Pools | S01,S14 |
| CLOUD-08 | implemented | Local↔cloud handoff | S02,S14 |
| CLOUD-09 | blocked-external | OIDC/metadata/private connectivity | S13,S14 |
| CLOUD-10 | blocked-external | Sharing/retention/deletion | S14,S16 |
| CLOUD-11 | blocked-external | Port forwarding/publish | S11,S14 |

### AUTO (8 parents; planned:8; surfaces S06,S16,S08,S04,S13,S05)

| Parent ID | Graph status | Requirement title | Surface(s) |
|---|---|---|---|
| AUTO-01 | planned | Schedule/loop/event subscriptions | S06,S16 |
| AUTO-02 | planned | Webhook/SCM/chat/issue triggers | S06,S08,S16 |
| AUTO-03 | planned | Run history/prompts/tools/config | S04,S06,S13 |
| AUTO-04 | planned | PR autopilot / fix CI | S06,S08 |
| AUTO-05 | planned | Bugbot equivalent | S06,S08 |
| AUTO-06 | planned | Security review equivalent | S05,S08 |
| AUTO-07 | planned | Reviewer routing/risk approval | S05,S08,S16 |
| AUTO-08 | planned | Memories and action tools | S06,S13,S16 |

### BOT (4 parents; planned:4; surfaces S01,S16,S11,S14,S04,S06)

| Parent ID | Graph status | Requirement title | Surface(s) |
|---|---|---|---|
| BOT-01 | planned | Persistent assistant roster | S01,S16 |
| BOT-02 | planned | Personal computer/browser identity | S11,S14,S16 |
| BOT-03 | planned | Long-lived work/attention | S04,S06,S14 |
| BOT-04 | planned | Team setup/network/security | S14,S16 |

### SCM (5 parents; planned:5; surfaces S08,S09,S01,S04,S13,S16)

| Parent ID | Graph status | Requirement title | Surface(s) |
|---|---|---|---|
| SCM-01 | planned | Own Git hosting | S08,S09 |
| SCM-02 | planned | GitHub mirror | S01,S08 |
| SCM-03 | planned | Two-way PR collaboration | S04,S08 |
| SCM-04 | planned | Codebase browse/search/settings | S01,S09 |
| SCM-05 | planned | Provider abstraction | S08,S13,S16 |

### INT (6 parents; planned:6; surfaces S01,S04,S16,S09,S07,S08,S14,S02)

| Parent ID | Graph status | Requirement title | Surface(s) |
|---|---|---|---|
| INT-01 | planned | Slack and Teams | S01,S04,S16 |
| INT-02 | planned | Linear/Jira/Notion | S01,S04,S16 |
| INT-03 | planned | JetBrains integration | S09,S16 |
| INT-04 | planned | Xcode integration | S09,S16 |
| INT-05 | planned | CI/deploy/event adapters | S07,S08,S14,S16 |
| INT-06 | planned | Deeplinks | S01,S02,S16 |

### API (6 parents; planned:6; surfaces S10,S13,S16,S02,S09,S14)

| Parent ID | Graph status | Requirement title | Surface(s) |
|---|---|---|---|
| API-01 | planned | CLI interactive/headless | S10,S13,S16 |
| API-02 | planned | CLI modes/worktrees/shell | S02,S10,S13,S16 |
| API-03 | planned | ACP and extensions | S09,S13,S16 |
| API-04 | planned | Public agent/worker APIs | S13,S14,S16 |
| API-05 | planned | SDK TypeScript/Python/bridge | S13,S14,S16 |
| API-06 | planned | Admin/analytics/code tracking APIs | S14,S16 |

### SAFE (5 parents; planned:5; surfaces S05,S13,S16,S10,S14)

| Parent ID | Graph status | Requirement title | Surface(s) |
|---|---|---|---|
| SAFE-01 | planned | Ask/auto-review/full autonomy controls | S05,S13,S16 |
| SAFE-02 | planned | OS sandbox/network/permissions | S10,S13,S14 |
| SAFE-03 | planned | Workspace trust/prompt injection | S05,S13,S14 |
| SAFE-04 | planned | Secrets/data boundaries | S13,S14,S16 |
| SAFE-05 | planned | Updates/supply chain | S14,S16 |

### ADM (8 parents; planned:8; surfaces S13,S16,S04,S14)

| Parent ID | Graph status | Requirement title | Surface(s) |
|---|---|---|---|
| ADM-01 | planned | Provider account/usage/costs | S13,S16 |
| ADM-02 | planned | Personal dashboard/settings | S16 |
| ADM-03 | planned | Organization/team/group roles | S16 |
| ADM-04 | planned | Spend controls/pooled usage | S16 |
| ADM-05 | planned | AI attribution/blame/analytics | S04,S16 |
| ADM-06 | planned | Audit/OTel/admin APIs | S14,S16 |
| ADM-07 | planned | Managed distribution/network | S13,S16 |
| ADM-08 | planned | Commercial-contract-only items | S16 |

### PX (40 parents; planned:31, implemented:7, verified:2; surfaces S02,S04,S03,S01,S16,S09,S10,S13,S05,S14,S06,S07,S12,S11,S08,S15)

| Parent ID | Graph status | Requirement title | Surface(s) |
|---|---|---|---|
| PX-01 | planned | Local parent มี history → /side หรือเลือก transcript/diff → เปิด durable child ที่ได้ parent reference context แต่ไม่แสดง parent transcript ซ้ำ | S02,S04 |
| PX-02 | planned | Side child มี follow-up → @mention จาก parent → ใช้ child context; ปิด child เป็น archive และคง parent association | S02,S03,S04 |
| PX-03 | planned | Fork whole chat หรือ message boundary → copy transcript/subagents เฉพาะช่วงที่เลือกเป็น independent conversation | S01,S02,S04 |
| PX-04 | planned | Agents Window ค้นข้ามแชต และ transcript ค้นภายใน → match counter, next/previous, jump และ local index | S01,S04 |
| PX-05 | planned | Share dialog → preview/redaction/Team/Public → read-only share; recipient fork ผ่าน import/deep link | S04,S16 |
| PX-06 | planned | Share owner/admin เปลี่ยน visibility/delete → viewer ถูก reauthorize/revoke; dashboard list ค้นได้ | S04,S16 |
| PX-07 | implemented | Inline edit question mode กับ selection → answer/follow-up; ส่งต่อ Agent พร้อม selection context | S03,S09 |
| PX-08 | implemented | Terminal inline prompt → เสนอ shell command → user execute ตาม state ที่ reference ระบุ | S03,S10 |
| PX-09 | planned | Prompt/command/rule/MCP install deep link → decode/preview/confirm → appropriate draft/import/install flow | S03,S13 |
| PX-10 | planned | Run Mode picker มี Auto-review/Allowlist/Run Everything ตาม reference; shell/MCP/fetch routing ผ่าน policy | S05,S13,S16 |
| PX-11 | planned | permissions.json JSONC user+project → concatenate arrays per key, file overrides corresponding UI field, admin overrides; file watch reload | S13,S16 |
| PX-12 | planned | sandbox.json → merge paths/network/flags ตาม schema; network deny wins, admin restrictions enforce; protected paths | S13,S14 |
| PX-13 | planned | Local run modes กับ cloud isolated execution ใช้ policy profiles แยก; cloud ไม่ใช้ desktop approval loop เป็น default reference | S06,S14 |
| PX-14 | verified | MCP stdio/SSE/Streamable HTTP initialize/discover/reconnect → tools/prompts/resources/roots/elicitation ใช้งานได้ | S05,S07,S13 |
| PX-15 | planned | MCP Apps render isolated view พร้อม text fallback; remote OAuth static/dynamic client, state/callback matching | S07,S13 |
| PX-16 | planned | MCP config interpolation/envFile และ extension register/unregister; distribution/install/allowlist เป็นคนละ state | S13,S16 |
| PX-17 | planned | Hook adapter มี event coverage ครบ inventory พร้อม input/output, matcher, cwd, timeout, sync/async และ exit semantics | S04,S13 |
| PX-18 | planned | Third-party hook compatibility import และ workspaceOpen lifecycle พร้อม provenance | S04,S13 |
| PX-19 | planned | Plugin format discovery/manifest/variables/team marketplace installation mode/skill publishing และ canvas components | S12,S13,S16 |
| PX-20 | planned | Rules/skills source and activation map มี nested AGENTS, CLAUDE compatibility, globs, manual/auto/mode และ cloud sync | S06,S13 |
| PX-21 | planned | Browser session permissions/origin allowlist/account isolation, console/network, design selection→source linkage | S11,S13 |
| PX-22 | planned | Canvas workspace list, source/render, rerun/revision และ publish/refresh/team gallery | S12,S16 |
| PX-23 | planned | Agent ask-question asynchronous กับ ACP blocking interactions แยก semantics; answers route ต่อ exact interaction | S04,S05 |
| PX-24 | implemented | ACP JSON-RPC stdio initialize/auth/session new/load/prompt/update/permission/cancel พร้อม richer extensions | S13,S14 |
| PX-25 | verified | CLI interactive/headless/output formats, resume/steer/goals, config/auth/permission precedence และ exit status | S13,S14,S16 |
| PX-26 | implemented | TS/Python SDK local/cloud agents/runs/messages/usage/artifacts/custom tools/hooks/subagents/store/stream/error lifecycle | S13,S14,S16 |
| PX-27 | planned | REST v1 agents/runs/usage/artifacts/archive/unarchive/delete/models/repos/worker tokens/pools/claims | S13,S16 |
| PX-28 | planned | Legacy v0 API/CLI changelog features ถูกแยก supported-current/compatibility/deprecated inventory | S13,S16 |
| PX-29 | planned | Team/org/analytics/AI tracking APIs มี endpoint/field/scope/paging/date/cache/rate-limit/error conformance ต่อ resource | S14,S16 |
| PX-30 | planned | Review routing ใช้ exact approval-policy basename, ancestor specificity และ routing file; changed policy อิง base branch | S05,S08,S16 |
| PX-31 | planned | Bug review incremental/full/effort/rules-used/learned rules/autofix/CI statuses และ admin trigger APIs | S06,S08,S16 |
| PX-32 | implemented | Self-hosted workers/pools/My Machines เลือก execution environment, claim/lease, capacity/health, private SCM/computer use | S01,S14 |
| PX-33 | planned | Cloud identity/metadata/env/OIDC/private connectivity/build freshness/attachments/no-repo routing | S13,S14 |
| PX-34 | planned | SCM adapter แยก GitHub/GHE/GitLab hosted+self-hosted/Bitbucket cloud+DC/Azure identity และ review triggers | S08,S13 |
| PX-35 | planned | Slack/Teams/Jira/Linear/Notion ใช้ routing/option precedence/account linking/thread follow-up/visibility ของแต่ละบริการ | S01,S16 |
| PX-36 | implemented | Origin rules/protections/apps/SSH/auth/ref naming/forge-local branch/PR lifecycle/thread commands และ mirror conflict handling | S08,S09,S13 |
| PX-37 | planned | Enterprise usage/pools/groups/service accounts/model controls/network/privacy/audit/OTel exporter | S14,S16 |
| PX-38 | planned | Public profile/handle/visibility/usage-sharing/account sessions/export/delete และ spend controls | S14,S16 |
| PX-39 | planned | Persistent bot native mobile iOS/Android account/computer continuity, recovery/secret entry และ desktop-only computer update | S14,S15 |
| PX-40 | implemented | Diagnostics/network/proxy/cert/extension isolation/performance/support export และ migration recovery | S14,S16 |

## 6. OMP-to-UI action/test index

ตารางนี้เป็นดัชนี reverse lookup จาก surface ไปยัง OMP inventory เพื่อกันช่องว่างที่เกิดจากการนับ card หรือ handshake แทน feature coverage. รายละเอียด command/schema/source line อยู่ใน OMP coverage/source inventory; แถว COV-* ใน §3 เป็น test seam ที่ต้องสร้าง/รัน.

| OMP inventory | UI surfaces ที่ consume | Minimum action/contract ที่ต้องเห็นใน UI | Failure/gap ที่ห้ามซ่อน |
|---|---|---|---|
| O01 files/search/AST | S07,S08,S09 | read/write/edit/glob/grep/ast; path/hashline/buffer-version and dirty conflict | stale hash, path boundary, untracked/binary, unsupported URI |
| O02 bash/eval/process | S05,S07,S10,S13 | approval + process/PTY/timeout/abort/background semantics | rpc-ui PI_NO_PTY=1, duplicate effect, shell scope |
| O03 lsp/debug/github/security | S07,S08,S09,S13,S16 | availability reason, diagnostics/debug/PR/security result and mutation policy | credentials/OS adapter missing, generic tool card |
| O04 checkpoint/rewind/context | S01,S02,S06,S08,S09,S14 | distinguish conversation branch vs file restore, versioned conflicts | restore overwrites manual edit, unknown post-crash effect |
| O05 task/hub/todo/goal/subagents | S01,S02,S04,S06,S14,S15 | lineage, progress, budget, queue, jobs, child snapshots/cancel | idle misread as complete, duplicate root session |
| O06 memory/retain/recall/skills | S06,S13,S16 | scope/provenance, lifecycle, disabled/error and secret redaction | persistence leak, hidden mutation |
| O07 browser/computer | S05,S07,S11,S12,S15 | handles, tabs, screenshot/AX/input, origin/session permission | arbitrary host bridge, expired handle, provider assumption |
| O08 image/speech | S03,S07,S12,S15 | capability/auth/cost, immutable media receipt, cancel/error | paid fallback, MIME spoof, no-provider fake success |
| O09 MCP/custom/plugins | S05,S07,S13,S16 | initialize/discover/reconnect, schema, resources/prompts/elicitation, isolated view | supportsMcpServers=false, unknown schema dropped |
| O10 rules/skills/hooks/config | S03,S06,S09,S13,S16 | precedence/provenance/reload, hook event/timeout, skill mode | file source overrides hiddenly, untrusted instruction |
| O11 all 42 RPC commands | S01–S16 as applicable | registry-driven command manifest, ack vs terminal, cursor/error/cancel | 16-command adapter treated as full, generic fallback |
| O12 stream/state side channels | S03,S04,S06,S14,S15 | ordered events, unknown-event diagnostic, backpressure/replay | dropped unknown, unbounded hidden queue |
| O13 RPC-UI/host tools/URI | S03,S05,S07,S10,S11,S13,S15 | typed select/confirm/input/editor/cancel/status/widget/title/open-url and host URI | fire-and-forget notification loss, stale approval |
| O14 slash registry (79 static + dynamic) | S03,S06,S13,S16 | command palette with alias/subcommand/prerequisite/source | TUI-only name counted as integrated action |
| O15 TUI modes/goal/plan/queue | S03,S05,S06,S13,S16 | mode transition/state restrictions and continuation | sending slash text ≠ mode support |
| O16 session tree/fork/share/collab | S01,S02,S04,S06,S08,S14,S15,S16 | lineage, read-only share/revoke, guest restrictions, fork cutoff | second execution owner, public leak |
| O17 artifacts/internal URI/export | S04,S07,S08,S11,S12,S14,S15,S16 | paged immutable MIME/hash receipts and safe viewer/download | monolithic history, unsafe scheme, lost export |
| O18 SDK/ACP/CLI initialization/evolution | S01,S02,S03,S09,S10,S13,S14,S15,S16 | lifecycle init/dispose, version negotiation, escape hatch without second harness | incomplete setToolUIContext, version drift |

## 7. Acceptance and delivery checklist

Before promoting any family, parent or surface from planned to verified:

- coverage-accounting: parse graph and assert 75 family IDs + 198 parent IDs are present exactly once in this ledger; duplicate IDs fail.
- source-binding: record OMP v18.1.18 SHA, source path/line, effective runtime registry, transport, permission/effect boundary and test ID.
- state-matrix: exercise all applicable states (empty/loading/running/queued/waiting approval/completed/error/cancelled/offline/reconnecting/outcome_unknown); record unavailable/needs-auth explicitly.
- continuity: A→IDE→A and A→B→A preserve session/draft/scroll/buffer/panel IDs; mobile uses the same host session and no iOS OMP process.
- safety: same command ID + same payload joins old result; same ID + different payload rejects; stale approval/revoked device rejects before effect; no automatic retry after unknown side effect.
- motion/a11y: test interaction-spec timings on measured runtime, interruption/reversal, reduced motion, keyboard/focus, Thai IME, 200% zoom, VoiceOver and touch target.
- performance: measure idle/streaming+diff/build+preview/hidden panels on fixed machine+revision+viewport; capture CPU, RSS, input p95, long tasks, dropped frames, energy and queue growth. Do not set regression budgets from intuition.
- provider/device: live provider turns, browser/computer permissions, OMP PTY bridge, MCP injected servers, relay and physical iPhone remain separate gates. A no-provider fixture or screenshot cannot close them.

## 8. Current gaps and ownership

| Gap | Owner | Depends on | Cannot be marked solved by |
|---|---|---|---|
| Full OMP command/event/UI/URI registry | OMP adapter + host | G1, pinned source and dynamic registry | handshake, generic card, 11/12-tool fixture |
| Durable journal/idempotency/outcome_unknown | Caret host | G2 | process-local request IDs or reconnect banner |
| Agent↔IDE state retention | host + Code-OSS extension | UI-S1/G3 | opening a second window |
| OMP PTY semantics | adapter/bridge or SDK gate | O02/O11/O13/G1 | separate user terminal |
| MCP/custom/plugin dynamic UI | OMP adapter + trusted bridge | O09/O10/O13 | OMP child reading its own config |
| Browser/computer handle/permission lifecycle | host + OMP bridge | O07/O13 | static browser tab |
| Artifact/export/hash receipts | host + O17 | G2/G3/G4 | preview card |
| Mobile/relay physical acceptance | mobile + host | P18/P19/G4 | simulator/Wi-Fi-only fixture |
| Visual parity reference (Cursor, D20) | product/design owner | side-by-side capture ที่ viewport/scale/theme เดียวกัน + measured geometry/palette | screenshot เดี่ยว, การดูด้วยตา, หรือ inferred parity |
| Cloud/enterprise/external blocked parents | product/infra owner | authorization, provider/service contracts | relabeling to unsupported or deleting row |

## 9. Non-goals and no-scope changes in this slice

- ไม่ติดตั้ง packages/skills/references และไม่เปลี่ยน renderer/harness; OMP ยังคง locked.
- ไม่แก้ backlog/requirement-graph.json; เอกสารนี้เป็น derived mapping ที่ตรวจย้อนกลับได้.
- **Amendment 2026-09-14 (D20):** pixel target เปลี่ยนเป็น Cursor 3.20.17 ตามคำสั่งผู้ใช้. ยัง **ไม่ประกาศว่า parity ผ่าน** จนกว่าจะมี side-by-side capture + measured geometry/palette; CX-01 Codex capture ยัง blocked แต่ไม่ block Cursor pixel freeze อีก
- ไม่ประกาศ mobile/relay/provider/Cloud/PTY/MCP/full OMP gates ผ่าน.
- ไม่สร้าง production UI จากเอกสารนี้โดยอัตโนมัติ; ให้ UI-S1–UI-S6 ใช้ ledger เป็น acceptance map.

## 10. Reproducibility commands

```sh
cd /Users/pond/caret
jq '.counts, (.ui_families|length), (.parents|length)' backlog/requirement-graph.json
```

Expected counts on graph revision used here: ui_families=75, parents=198, planned families=75, parent statuses planned=136, implemented=35, verified=17, blocked-external=10. Any graph update requires regenerating this ledger and reviewing every mapping diff.
