# Caret — OMP core coverage และ gap matrix

Baseline: OMP 18.1.18 source `00085d4e7dfdcfbf302c122fa2682b410a0f43d1`; เริ่ม G0 แล้ว ดู [ผล implementation](CARET-G0-IMPLEMENTATION-2026-09-12.th.md); coverage ด้านล่างยังเป็น full-conformance gaps. คำว่า source-exposed หมายถึงพบ interface ไม่ใช่ Caret รองรับหรือทดสอบผ่านแล้ว. เป้าหมายคือทุก core feature ของ revision นี้ รวม dynamic capability mechanisms; ไม่รับประกัน future versions ที่ยังไม่ตรวจ

## ตัวหารที่ใช้ตรวจ

[Machine-readable source inventory](evidence/omp-rpc-2026-09-12/source-inventory.json) เก็บชื่อจริง: 28 built-in tools, 3 hidden tools, 42 RPC commands และชื่อ slash commands แยกตามหก registry modules. RPC command ID ไม่ใช่ slash command และ browser/computer ไม่จำเป็นต้องเป็น top-level model tool

[Detailed source inventory](CARET-OMP-SOURCE-INVENTORY-2026-09-12.md) มี gates/source lines, 79 static slash commands พร้อม aliases/subcommands, 15 internal URI handlers, providers, eval preludes, xdev, hub/async jobs, extensions/hooks และ session semantics. เป็น inventory ที่มีขอบเขตตาม pinned source; dynamic names ยังต้อง enumerate runtime

Registry tools: `read`, `bash`, `edit`, `ast_grep`, `ast_edit`, `ask`, `debug`, `eval`, `github`, `glob`, `grep`, `lsp`, `checkpoint`, `rewind`, `context_notes`, `new_context`, `security_scan`, `task`, `hub`, `todo`, `web_search`, `write`, `memory_edit`, `retain`, `recall`, `reflect`, `learn`, `manage_skill`. Hidden names: `yield`, `goal`, `think`. Source: `packages/coding-agent/src/tools/builtin-names.ts:1–34`, factories ใน `tools/index.ts:461–497`

Runtime fixture ที่ปิด extensions/skills/rules และไม่มี provider credentials เห็น 11 tools ใน rpc และ 12 ใน rpc-ui (เพิ่ม ask). นี่เป็น effective configuration เดียว; ไม่ใช้เป็นตัวหาร all core. `createIf`, tools settings, model capabilities, MCP, plugins/custom tools และ eval bridges ทำให้ registry เปลี่ยนได้

Coverage ต้องมีสองระดับ: (1) ทุก static feature/command ใน pinned registries มี mapping และ test ID, (2) dynamic registration/discovery/filtering/schema update/error/cancel ทำงานกับ fixtures แล้ว runtime แสดง effective inventory จริง. ไม่สามารถแจกแจงชื่อ MCP tools ของทุก server ที่ผู้ใช้จะติดตั้งในอนาคตได้ แต่ต้องรองรับ lifecycle/semantics ของกลไกนั้นครบ

## Core-to-product mapping

Source paths ด้านล่างอยู่ใต้ `packages/coding-agent/src` ของ OMP pin. เจ้าของ implementation ทุกแถวคือ Caret OMP adapter/host ตาม [ทิศทางล่าสุด](CARET-IMPLEMENTATION-DIRECTION-2026-09-12.th.md); OMP ยังเป็นเจ้าของ execution semantics. สถานะ Caret ทุกแถวเป็น **open** เว้นแต่คอลัมน์ผลทดสอบระบุ bounded probe

| ID | Core surface / source | Interface และช่องว่าง | Caret surface / acceptance ที่ต้องมี |
|---|---|---|---|
| O01 | Files/search/AST: registry read/write/edit/glob/grep/ast_* | OMP tools + schema/events; registry visibility ต้อง dynamic | Tool cards, files/diff/editor; แต่ละ tool success/error/cancel/path/dirty-conflict fixture |
| O02 | bash/eval และ process: `tools/index.ts`, `main.ts:1545` | rpc-ui ปิด PTY; direct bash RPC แยกจาก model tool; eval nested calls ไม่เท่ากับ wrapper hooks | User PTY + OMP PTY semantics bridge/patch gate; process/input/stop/result และ nested-effect policy |
| O03 | lsp/debug/github/security_scan | Conditional factories; dependencies/credentials/OS ของ host | Registry availability reason, diagnostics/debug/results; tool-specific fixtures ไม่ใช้ generic-card เป็น proof |
| O04 | checkpoint/rewind/context_notes/new_context | Tool factories และ session context semantics; conversation branch ไม่ใช่ file rewind | Context/file history actions ที่แยกกัน; scoped restore ไม่ทับ manual changes |
| O05 | task/hub/todo/yield/goal/think | OMP subagents/jobs/goals; RPC มี subscription/snapshots/messages/todos แต่ไม่ expose ทุก TUI control | Tree/lineage/progress/budget/queue; two sessions+children, cancellation และ restart reconciliation |
| O06 | memory_edit/retain/recall/reflect/learn/manage_skill | Conditional settings, memory/skills state และ effects | Effective config และ lifecycle; persistence/scope/disabled-state fixtures; ไม่อ่าน user secrets มาเป็น evidence |
| O07 | Browser/computer bridges | SDK guidance flags + eval bridge; controls/tab/handle/permission semantics ต้องเพิ่ม mapping | P12/P14 host browser/OS tools, screenshots/AX/logs, reconnect/handle validity และ permission fixtures |
| O08 | Image/speech custom tools: `sdk.ts:2088–2104` | `generate_image` และ tts ถูกเพิ่มตาม settings; ไม่อยู่ static built-in names | Media/artifact input/output/provenance, provider entitlement, cancellation/failed job; ไม่เรียก paid backend โดยสมมติสิทธิ์ |
| O09 | MCP/custom tools/plugins: `sdk.ts:2012`, `:2106+` | Runtime discovery; Paseo OMP flags supportsMcpServers=false สำหรับ host injection ไม่ได้แปลว่า OMP native MCP ไม่มี | OMP-owned MCP config/resources/prompts/tools/elicitation, extension load/reload/errors; schema updates และ permission-before-effect |
| O10 | Instructions/rules/skills/hooks/config: `sdk.ts`, extensibility | Config precedence/reload และ hook semantics บางส่วนไม่มี native RPC command | Settings/context/skills UI + trusted bridge; project/user precedence และ missing-dependency/error fixtures |
| O11 | All 42 RpcCommand variants: `modes/rpc/rpc-types.ts:28–93` | List ใน JSON; Paseo typed schema16, raw steer/follow-up/shared negotiation แยก; [per-command audit](../archive/2026-09-12/CARET-PASEO-OMP-AUDIT-2026-09-12.md) | Contract dispatch/results/errors ทุก variant; ACK vs terminal, modes, models/auth, stats, export, session/branch/handoff, history pagination |
| O12 | Stream/state side channels | Agent events + config_update/session_info_update/extension_error; Paseo safeParse/mapping ยัง lossy | Text/thinking/tools/media/events ตาม OMP identity; preserve unknown events as diagnostics, no silent loss; chunk/reassembly/ordering tests |
| O13 | RPC UI / host tools / host URIs | rpc-ui setter, typed extension UI methods, tool/URI request-update-result-cancel; Paseo host URI ยังไม่มี | Select/input/editor/confirm/notify/status/widget/title/open-url semantics; approval binding request/tool/effective args/incarnation; stale/timeout/revoke tests |
| O14 | Slash commands: `slash-commands/builtin-registry.ts:37–44` | modes/collaboration/session/lifecycle/marketplace/control; common `handle` กับ TUI-only `handleTui` ต่างกัน. Runtime fixture advertise43 ไม่ใช่ครบ static registry | Command palette/settings/workflows; ทุก command+aliases/subcommands ต้อง map integration หรือ open bridge gap; opening TUI alone ไม่นับ integrated support |
| O15 | TUI lifecycle/modes: plan/plan-review/vibe/goal/guided-goal/loop/queue, live/pause และ selectors | พบชื่อใน builtin-modes/control/session; native RPC subset ไม่ครอบคลุม UX semantics | Integrated mode/goal/plan/editor selector controls; fixture prove state changes+continuation ไม่ใช่ส่ง slash string แล้วถือผ่าน |
| O16 | Collaboration/share/join/leave, session tree/fork, marketplace/update/login/logout/setup | TUI/common split; OMP Collab ไม่ใช่ Caret remote transport | รักษา feature เป็น explicit backlog/bridge; native session owner ไม่ซ้ำ, mode-specific actions/errors ตรงจริง; iPhone remote เป็น acceptance เพิ่ม |
| O17 | Artifacts/internal URIs/export/context pagination | OMP artifact/history SSOT + missing host URI/export bridge ใน Paseo | Immutable receipts/viewers/chunked download; URI read/write/cancel/MIME, hash/page integrity และ project isolation |
| O18 | SDK/ACP/CLI initialization and version evolution | createAgentSession ต้อง initialize extensions/UI/lifecycle; CLI flags/session persistence; ACP เป็น alternative client seam | G1 escape hatch เฉพาะ feature ที่ RPC-UI ปิดช่องว่างไม่ได้; no second harness; inventory delta ทุก OMP upgrade |

ภายใน O05/O10/O15 ต้องรวม advisor/prewalk/vibe workers, async jobs, structured yield/recursion/isolation, rules/TTSR และ model roles/fallback ตาม detailed inventory; O17 รวม `omp`, `agent`, `artifact`, `memory`, `local`, `vault`, `skill`, `rule`, `security`, `mcp`, `issue`, `pr`, `history`, `ssh`, `xd` URI handlers. SSH file transport ไม่เท่ากับ remote agent execution. OMP Collab กับ Paseo relay เป็นคนละ protocol/feature ต้องไม่แทนกันแล้วนับครบ

O14–O16 ต้องทำ dispatch-matrix จาก registry specs ก่อนเริ่ม UI แต่ละส่วน: `handle`, `handleTui`, alias/subcommands, prerequisites, state/effects และ expected events. การมีชื่อใน JSON เป็น inventory ไม่ใช่การรับรอง behavior. ห้าม mark unsupported TUI-only features เป็น out-of-scope เพียงเพราะยังไม่มี wire endpoint

## ผลที่พิสูจน์แล้วในรอบนี้

Implementation ต่อจาก G0 เพิ่ม UI broker และ host tool/URI dispatcher ใน
[G1 bounded slice](CARET-G1-IMPLEMENTATION-2026-09-12.th.md). ดูผล tests และ
receipts ในเอกสารนั้น; O13/O17 มี implementation บางส่วน แต่ยังไม่ปิดทั้งแถว
หรือยกสถานะ full OMP core. Native dirty-buffer integration ยังเปิดอยู่

[Probe และ raw/summary receipts](evidence/omp-rpc-2026-09-12/README.md) ตรวจ version/hash และแยก rpc/rpc-ui. ทั้งสองผ่าน handshake/v2 negotiation, state/model/history queries, configuration readback, host tool/URI registration, naming/rejections, direct harmless bash, invalid-input recovery และ stdin EOF exit. ไม่ได้ invoke registered tools/URIs หรือเรียกโมเดล. 34 frames ต่อ run ไม่ใช่ 34 features ผ่าน

Source inventory และ [Paseo adapter audit](../archive/2026-09-12/CARET-PASEO-OMP-AUDIT-2026-09-12.md) อธิบายช่องว่างที่ต้อง implement. ทุก O01–O18 ยังต้องมี conformance evidence ใน Caret จริง; browser/MCP/approvals/compaction/streaming/subagents/session resume/PTY/device tests ยังไม่ครบ. Product completion ใช้ [P01–P20 และ E1–E4](CARET-REFERENCE-ACCEPTANCE-2026-09-12.th.md) เพิ่มจาก harness conformance

## Implementation rule

G0 สร้าง registry-driven test manifest ให้แต่ละ ID มี `source/version`, `effective availability`, `transport`, `UI mapping`, `permission/effects`, `testId`, `observed result`. G1 ปิด gaps ตาม interface ที่รักษา OMP semantics ได้. ต่อให้ทุก RPC command ผ่านก็ยังประกาศ all OMP core ไม่ได้จน dynamic tools, TUI-only semantics และ SDK/runtime feature domains ข้างต้นผ่านด้วย
