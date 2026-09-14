# Caret — UI / interaction specification

วันที่ 2026-09-13 · สถานะ: **planned; reference inspection บางส่วน**

> **Amendment 2026-09-14 (spec):** [CARET-SPEC-2026-09-14.th.md](CARET-SPEC-2026-09-14.th.md)
> เป็น spec ที่มีอำนาจเรื่องนิยามผลิตภัณฑ์ (Caret = Cursor clone ที่เราเป็นเจ้าของ, harness = OMP),
> สถาปัตยกรรม Agents window และกติกา SSOT. ส่วน §2 และ §7 ของเอกสารนี้ที่ผูกกับ webview shell
> ในหน้าต่าง IDE ถูกแทนแล้ว; §3–§6 ยังใช้เป็น surface/state/motion map ได้


> **Amendment 2026-09-14 (D20):** ผู้ใช้สั่งให้ Caret เหมือน **Cursor แบบ pixel parity**. Visual target จึงเป็น **Cursor 3.20.17 (macOS)** แทน Codex — ดู [Detailed design D20](CARET-UI-DETAILED-DESIGN-2026-09-13.th.md) ซึ่งมีผลเหนือ geometry/type/colour/motion ที่ขัดกันในเอกสารนี้. ตัวเลข layout/radius/type ใน §2 ด้านล่างถูกแทนด้วยค่า parity ใน D20 แล้ว. CX-01 (Codex capture) ยัง blocked แต่ไม่ block pixel freeze อีก

**Detailed specification update:** อ่าน [Detailed design D00–D20](CARET-UI-DETAILED-DESIGN-2026-09-13.th.md), [coverage mapping](CARET-UI-COVERAGE-2026-09-13.th.md) และ [validation/benchmark protocol](CARET-UI-VALIDATION-2026-09-13.th.md) คู่กัน. Detailed design ตัดสิน default/action/motion ที่ overview นี้เคยเป็นช่วงค่า/optional และมีผลเหนือข้อ UI ที่ขัดกัน เช่น mode switch default 0ms, offline draft-only และ primary Queue ขณะ running. Overview นี้ยังเป็น screen map ไม่ใช่ standalone implementation contract

ต่อจาก [implementation direction](CARET-IMPLEMENTATION-DIRECTION-2026-09-12.th.md), [product acceptance P01–P20](CARET-REFERENCE-ACCEPTANCE-2026-09-12.th.md), [task workspace workflow](CARET-WORKSPACE-WORKFLOW-2026-09-13.th.md) และ [UI reuse assessment](../../archive/2026-09-12/CARET-UI-REUSE-ASSESSMENT-2026-09-12.th.md). เอกสารนี้กำหนดหน้าจอ/behavior/motion สำหรับ PE-01–PE-13 ไม่เปลี่ยน OMP, Code-OSS, mobile/host ownership และไม่แทน 198 parents / 75 UI families เดิม

## 1. หลักฐานและขอบเขตความมั่นใจ

ตรวจด้วย Computer Use รุ่นปัจจุบันหลังผู้ใช้อนุญาต fallback จาก skill `codex-computer-use` ที่ prerequisite รุ่นเก่าหายไป. ไม่ส่ง prompt, ไม่เรียก provider, ไม่เปลี่ยน model/settings, ไม่ commit/push. เปิดและปิดเฉพาะ browser tab ว่างที่สร้างเพื่อสำรวจ. ข้อมูลบทสนทนาเดิมที่แอปแสดงไม่ถูกคัดลอกเป็น requirement หรือ source facts

| Evidence ID | สิ่งที่ตรวจจริง | ข้อจำกัด |
|---|---|---|
| CU-01 | Cursor macOS 3.20.17 จาก installed Info.plist; Agent window screenshot + accessibility tree วันที่ข้างต้น | ภาพใน tool log ขนาด 1229×768; ไม่ทราบ logical scale/zoom จึงไม่ใช่ measured pixel baseline |
| CU-02 | Agent sidebar: New Chat, Search, Automations, Customize, Projects, Repositories, task states, account/settings; top bar IDE/Chat actions/Show Apps | เห็น entry points ไม่ได้ทดสอบทุก workflow |
| CU-03 | Existing-task view: transcript, collapsible work summaries, message actions, resource links Changes/Browser/Terminal/Files, composer, branch, This Mac, context percentage | ไม่ตรวจ running/approval/recovery ด้วย live provider; ไม่ถือว่า action สำเร็จจาก label |
| CU-04 | Empty draft: repo/branch/environment selectors, composer, Plan New Idea, Multitask, Run in Cloud, recommendation rows; plus menu แสดง Plan/Debug/Multitask/Ask/Files/Model/MCP | ไม่เลือก mode/model หรือเปิด cloud; ไม่อ้าง entitlement ของ Caret ตาม reference |
| CU-05 | คลิก IDE → เปิด IDE window ที่มี Explorer/editor/Agent pane/status bar; คลิก Agents Window → กลับ Agent window | Draft ใน Agent กับ existing chat ใน IDE ต่างกันในรอบนี้ จึง **ไม่พิสูจน์ same-task continuity**; ไม่ได้พิมพ์ draft ทดสอบ |
| CU-06 | IDE shortcut เปิด Browser Tab; URL field, back/forward, hard reload, Select element, Show Console, menu, blank state | ไม่ navigate เว็บ/inspect DOM/console จริง; ไม่พิสูจน์ browser automation |
| CX-01 | ขอเปิด `com.openai.codex` ผ่าน Computer Use | **reference-blocked**: tool ปฏิเสธ app ด้วยเหตุผล safety. ไม่พยายาม capture ผ่านช่องทางอื่น; Codex ยังเป็น reference หลักแต่ยังไม่มี current-runtime visual proof รอบนี้ |
| SRC-01 | อ่าน Caret `apps/macos/src/webview.ts` และ `extension.ts` ใน dirty working tree; base HEAD `a87d9b29ac9e60f5847540d7e6bddbdbfa8ddb49` | source inspection ไม่ใช่ runtime acceptance; HEAD ไม่ครอบคลุมไฟล์ uncommitted จึงต้องเก็บ source hash ตอนลงมือ/ตรวจรับจริง |

หลักฐานภาพ/AX อยู่ใน conversation tool log ไม่ได้ export screenshot เข้า repository; ตารางนี้เป็นบันทึกสรุป ไม่ใช่ immutable capture receipt. ต้อง capture แบบ sanitized พร้อม version, build, scale, theme, viewport, source hash และ artifact hash ก่อน pixel freeze. Motion ด้านล่างเป็น **ค่าที่เสนอสำหรับ Caret ไม่ใช่ timing ที่วัดจาก Codex/Cursor**. ยังไม่ตรวจ light theme, dialogs ทั้งหมด, running/error states หรือ iPhone จริง

## 2. รูปแบบผลิตภัณฑ์และ navigation

Caret เปิดหน้า **Agents** เป็นค่าเริ่มต้น มีปุ่ม **IDE** ที่ค้นเจอง่าย และใน IDE มี **Agents** กลับทางเดิม. ใช้ Caret Insert icon ที่อนุมัติแล้ว ไม่ใช้ logo/ชื่อของ reference. Mac เป็น Electron/Code-OSS workbench ไม่เรียก Swift-native shell

```text
Caret window
├─ Agents: projects/tasks | task transcript + composer | work panel
├─ IDE: Explorer/Search/SCM | editor groups            | same task agent
└─ Settings: appearance, OMP capabilities, connections, devices
                       │
                 one Caret host
                       │
          task workspace ต่องาน (branch/worktree/ports)
                       │
                 one OMP owner/session
```

Mode เป็น view state ไม่ใช่ session lifecycle. การเปลี่ยน Agent↔IDE ต้องไม่ start/resume OMP ใหม่ ไม่เปลี่ยน cwd/branch และไม่ล้าง editor buffers. IDE เป็น editor จริงของ Code-OSS; ไม่สร้าง textarea editor ทดแทน LSP/debug/extensions

### Layout contract (Caret proposed values)

- Desktop ≥1200 logical px: sidebar **180px** ปรับ 160–360px; transcript อยู่กลาง max-width **437px** (D20 parity); work panel เปิดเมื่อเลือก resource กว้างเริ่มต้น 360px ปรับ 280–640px โดยต้องเหลือ main ≥360px. เมื่อไม่เปิด resource ใช้ compact resource launcher ไม่กินที่ preview เปล่า
- 900–1199px: sidebar collapsible; work panel เป็น exclusive right pane หรือ bottom pane ตาม user layout; เปิดแล้วไม่ทำ main ต่ำกว่า minimum
- <900px: เลือก transcript หรือ resource แบบเต็มพื้นที่พร้อม Back; sidebar เป็น drawer. ห้ามซ่อน feature โดยไม่มี alternate entry point
- iPhone: task list → task → resource detail; composer อยู่เหนือ keyboard/safe area. Approval เป็น sheet ที่เห็น request identity; กลับ task ได้โดยไม่ตอบโดยอัตโนมัติ. ไม่ยัด IDE ทั้งชุดลงจอมือถือ
- Header 46px และ spacing scale 4/6/8/10/12/16/20/24/28/32/40/44/48px เป็น parity tokens; controls desktop ≥32px hit area, touch ≥44pt; type UI 11/12/13/14px (xs/sm/base/lg), transcript body 14/22, sidebar label 12/16, mobile body เริ่ม 16pt และรองรับ Dynamic Type. Desktop hit-area ≥32px เป็น Caret a11y floor ที่ตั้งใจต่างจาก Cursor (D20 deviations)
- ต่อ semantic `--caret-*` กับ Code-OSS theme variables เดิม; light/dark/high-contrast. Radius controls **6px**/cards 8px/composer **12px** ตาม D20 (ตรงกับ `--cursor-radius-base`, `--cursor-radius-lg`, `--conversation-surface-border-radius`) ไม่ติดตั้ง design system ใหม่

### State ที่ต้องรักษา

| State | เจ้าของ / key | เมื่อสลับหน้า/รีสตาร์ต |
|---|---|---|
| transcript, queue, tool status, goal, model | OMP identity ผ่าน host | replay/reconcile จาก owner ไม่สร้าง client history ใหม่ |
| draft + attachments + selection | client view state keyed projectId/sessionId/device | restore draft ของ task นั้น; ไม่ sync ทับ draft อีกเครื่องอัตโนมัติ |
| transcript scroll | anchor eventId + offset ต่อ task | append stream ไม่ดึงลงล่างเมื่อกำลังอ่าน; มี Jump to latest |
| editor buffers/undo/cursor/splits | Code-OSS workspace | ไม่ dispose editor เพื่อเปลี่ยน mode; conflicts ใช้ versioned bridge |
| panel tabs/width/browser/terminal refs | view state + host resource IDs ต่อ task | restore IDs; resource ปิดไปแล้วแสดง expired ไม่สร้าง process แทนเงียบ ๆ |
| request/command acknowledgement | durable host journal | ambiguous outcome แสดง unknown; ห้าม auto-repeat side effect |

## 3. Screen และ function map

ทุกแถวเป็น requirement **planned**, ไม่ใช่ certification. ทุก surface ต้องมี loading/empty/error/permission/offline/keyboard states ตามที่ใช้ได้; N/A ต้องมีเหตุผลใน child test ไม่ข้ามด้วยคำว่า generic UI

| Surface | UI และ action contract | Trace |
|---|---|---|
| S01 Projects/tasks | New/Open repo/non-Git folder, search, recent, pin, archive/restore, rename; running/รออนุมัติ/พร้อมรีวิว/พัง/unknown เป็นข้อความร่วม icon; draft badge ไม่เหมือน completed | PE-01/10, P01/P02/P17 |
| S02 Task header | title, project/workspace/branch/worktree, host connection, Agent↔IDE, task menu; fork/resume แสดง lineage และผลต่อ workspace ก่อน action | PE-01/04/10, P02/P11/P17 |
| S03 Composer | multiline/Thai IME, files/selection/log/media chips, add menu, slash/context search, model/config, explicit send/queue/steer/stop; upload pending/error/remove/retry; ไม่ลบ draft ก่อน receipt ที่ตรวจได้ | PE-02, P03/P05/P15/P16 |
| S04 Transcript/activity | text/code/table/media/artifact cards, source/file links, collapsible tool args/output, elapsed/state, copy; paginated history, jump latest, bounded rendering | PE-02/04, P02/P04/P15 |
| S05 Questions/approvals | select/multi-select/text/editor forms ตาม OMP schema; request scope/target/cwd/tool, allow/deny/cancel, validation/timeout/stale/responded-elsewhere | PE-02, P04/P06 |
| S06 Plan/goals/parallel | plan steps, goal active/complete/blocked + budget if available, queue list, subagent lineage/status; actions ตาม registry ไม่ map idle=goal complete | PE-02, P05/P17 |
| S07 Work panel | tabs Changes/Terminal/Browser/Preview/Artifacts/Files, open/close/pop to IDE, per-task resource identity รวม cwd/พอร์ตของ workspace, resize/maximize, unread/error badge | PE-03/07/11, P10–P15 |
| S08 Changes/review | tracked+untracked/binary summaries, file/hunk diff, stage/unstage, scoped accept/reject, conflict UI, commit confirmation, branch/worktree bring-back preview | PE-03, P07/P11 |
| S09 IDE | tabs/splits/dirty files, find/replace, symbols/rename/navigation, LSP diagnostics, debugger/tests, extensions, inline proposal/completion/partial accept/undo | PE-01, P07–P09/P20 |
| S10 Terminal | interactive user PTY input/resize/exit, long-running process, stop, full log download; agent command output แยกจาก user shell และแสดง cwd | PE-03, P10 |
| S11 Browser | URL/back/forward/reload/loading/error, tabs, inspect/console/network/screenshot เมื่อ bridge รองรับ; host/project/tab ownership, agent-control indicator; unsupported capability ระบุเหตุผล | PE-03, P12 |
| S12 Preview/artifacts | MIME-specific image/audio/video/document/build viewer, original/download, buildId/hash/source/workspace receipt; annotate หรือส่งฟีดแบ็กกลับ task เดิม; failed build ไม่แทน last-good; unknown MIME safe download ไม่ execute | PE-03/05/12, P13/P15 |
| S13 OMP settings/catalog | effective models/providers/config precedence, tools/MCP/skills/hooks/extensions, auth required/unavailable/error; source and scope ของค่า; redacted secrets; no silent billed fallback | PE-02, P03/P04/P16 |
| S14 Devices/recovery | pairing/expiry/revoke, host reachability vs relay status, last sync, replay progress, pending commands/unknown outcomes, diagnostic export ที่ redact | PE-04/05, P18–P20 |
| S15 Mobile task | same session/workspace transcript/composer/attachments/approvals, task switch, preview/history ของ build เดียวกัน, เปิดจากแจ้งเมื่อถึงตาผู้ใช้; offline draft, background/foreground freshness, keyboard and touch | PE-05/06/12/13, P18/P19 |
| S16 Product settings | theme/text scale/motion/shortcuts/notifications, version/runtime/license/update/migration diagnostics; voice/media generation/native control เป็น capability-gated ไม่ใช่ fake enabled buttons | PE-06/09, P14/P15/P20 |

Automations, voice, cloud, simulator หรือ connector ที่เห็นใน reference **ไม่ถูกนับว่า Caret ทำได้**. รักษารายการเดิมใน parity backlog; surfaced capability ต้องมี contract/backend/auth/cost/acceptance ของ Caret เอง. PE-08 simulator เป็น follow-on หลัง mobile continuity ไม่เปลี่ยนเป็น cloud simulator service โดยอัตโนมัติ

## 4. Composer และ execution state machine

Connection, run status, delivery status และ pending UI request เป็นคนละแกน: งานอาจ running+offline หรือ waiting approval+reconnecting ได้. ห้าม enum เดียวลบสถานะอื่น

| State/event | สิ่งที่แสดง | Action/result |
|---|---|---|
| empty/ready | helper text, project/model/host; disabled Send พร้อมเหตุผลถ้ายังใช้ไม่ได้ | Enter ส่งเฉพาะพร้อม + ไม่อยู่ใน composition; Shift+Enter newline |
| submitting | pending bubble + commandId, draft recoverable | กัน duplicate click; error คืน draft/attachment references |
| running | streaming + visible Stop + separate Queue/Steer affordances | Queue เป็น follow-up ตาม OMP; Steer ส่งเข้า current run ตาม semantics; ไม่สร้างอีก agent loop |
| queued | ordered items, receipt/status; editable/removable เฉพาะ operation ที่ runtime รองรับ | client ไม่ dispatch เองเมื่อเห็น idle; reject unsupported reorder อย่างชัดเจน |
| stopping | “Stopping…” ไม่ใช่ “Stopped” | รอ terminal receipt; Stop ไม่ rollback edits และไม่ auto-send queue |
| waiting input/approval | inline card + persistent attention indicator | response ผูก requestId/session/incarnation; double response/stale/revoked ถูก reject ก่อน effect |
| completed/cancelled/failed | distinct terminal state + next action | retry เฉพาะ action ที่ทราบผล/ผู้ใช้เลือก; completed turn ไม่เท่ากับ goal complete |
| disconnected | persistent host status + last known run state/time | เขียน draft ได้; ส่ง command เมื่อ transport รองรับ durable semantics เท่านั้น; ไม่แกล้งแสดง sent |
| reconnecting | replay progress/freshness + retained local draft | reconcile receipt; ไม่ตอบ approval เก่าโดยอัตโนมัติ |
| outcome_unknown | อธิบาย “ยังยืนยันผลคำสั่งไม่ได้” + Inspect/Reconcile | ไม่ปุ่ม Retry ที่ auto-run destructive operation |

Shortcut เสนอ: เก็บ native Cmd+P/Cmd+Shift+P/Cmd+B/Cmd+J ใน IDE; New task/Search/Mode switch ต้องลงทะเบียนผ่าน Code-OSS keybinding context และแสดง shortcut ที่ resolve จริง ไม่ hardcode คีย์ชนกัน. Cmd+Enter follow-up ที่ source มีอยู่ต้องอธิบายให้ชัดและทดสอบในทุก run state. Escape ปิด topmost popover/คืน focus ไม่ Stop agent โดยปริยาย

Attachments ต้องมี local→uploading→ready/failed และ immutable content reference ก่อน dispatch. Attach file selection ใช้ path+buffer version; user แก้ buffer ระหว่างรอให้ conflict/refresh ไม่ส่ง snapshot ผิดโดยไม่มีแจ้ง. Privacy: workspace content ไม่ถือเป็น instruction ให้ UI เรียก external actions

## 5. Motion contract

ใช้ `better-ui` เพื่อให้ motion อธิบาย state/continuity ภายใต้ tokens เดิม. ใช้ CSS transitions ที่ interrupt/reverse ได้ก่อนเพิ่ม dependency. ค่าเหล่านี้ **proposed**; ต้องวัดจริงใน release candidate

| Interaction | Proposed animation | Safety / reduced motion |
|---|---|---|
| Hover/focus/selected row | instant หรือ color/opacity ≤100ms | focus ring ทันที; ไม่มี layout shift |
| Agent↔IDE/task/tab switch | state เปลี่ยนทันที; optional surface opacity ≤120ms | ไม่รอ animation ก่อน focus/input; reduced motion ตัด transition |
| Resource drawer open/close | 180ms enter / 120ms exit, transform+opacity, cubic-bezier(.2,0,0,1) | interruptible; focus ไป header/selected content แล้วกลับ trigger; reduced = immediate |
| Menu/approval sheet | 150ms enter / 100ms exit, opacity + translateY 4px | effect permission ไม่ผูก animationend; stale request disabled ทันที |
| Tool details expand | 150ms reveal; ไม่ animate ทุก token/ทุก log row | scroll anchor คงเดิม; long output virtualized; reduced = instant |
| Submit press | optional scale .96, 150ms ease-out เฉพาะ non-repeated control | keyboard focus ไม่ scale; destructive/Stop ใช้ static feedback |
| Contextual icon swap (ถ้าเลือกใช้) | skill values: scale .25→1, opacity 0→1, blur4→0, 300ms cubic-bezier(.2,0,0,1), no bounce | จำกัด icon เล็ก infrequent; no mount animation; reduced = static swap; label/action เปลี่ยนทันที |
| Streaming/recovery/theme | text/log append และ theme swap ไม่มี decorative motion | ไม่ shimmer ทั้ง transcript; ไม่ loop status pulse เมื่อ idle; status text คงอยู่ |

No `transition: all`, full-window blur, token-by-token entrances, staggered task rows หรือ animation ที่บัง terminal input. Panel drag follow pointer ทันที; อย่า animate editor sash หรือสร้าง layer ใหญ่โดยไม่มี measurement. Pause nonessential animation เมื่อ hidden/background. Preserve prefers-reduced-motion ที่ source มีแล้ว และ map mobile Reduce Motion ให้เทียบเท่า

## 6. Usability, performance และ security gates

- Keyboard: visible focus, logical order sidebar→header→transcript→composer→work panel; popover Escape/focus-return; resize splitter ใช้ keyboard ได้; modal trap เฉพาะ modal จริง
- Icon-only controls มี accessible name; SVG `currentColor`, consistent native grid 16/20/24px; ไม่ mirror Caret brand ใน RTL. รูป/สีอย่างเดียวไม่บอกสถานะ
- Thai IME, long Thai labels, mixed code/Thai, 200% zoom, long path, narrow window และ mobile keyboard ต้องไม่บัง Send/approval. Resource ที่ responsive ซ่อนต้องเปิดด้วย button ได้
- วัด contrast ก่อน theme freeze: normal text ≥4.5:1, large text และ meaningful UI boundaries ≥3:1. สีใน source ยังไม่ถือว่าผ่านทุก theme โดยการอ่าน tokens
- Screen reader live region ใช้ summary ของ state ไม่ announce ทุก token. Validation error ผูก field; timeout ไม่ทำ draft หาย
- Streaming batching/backpressure, bounded DOM/logs และ incremental updates; proposed responsiveness targets: cached mode switch p95 ≤150ms, local input feedback p95 ≤50ms; เก็บ CPU/RSS/long tasks/dropped frames และ idle/background/energy baseline บนเครื่องเดียวกันก่อนตั้ง regression threshold. ไม่สัญญาว่าประหยัดไฟกว่า Cursor จาก design
- Browser ใช้ isolated process/session/navigation policy; arbitrary page ไม่ได้ Node/file/host bridge. Tool output/markdown/attachments เป็น untrusted; CSP และ link scheme allowlist. Browser session ไม่แชร์ credentials ข้าม project โดยปริยาย
- UI capability status ต้องแยก available/needs-auth/unsupported/error; ถ้า feature required แต่ unavailable ให้ gap ใน coverage matrix ไม่ซ่อนเพื่ออ้าง full features

## 7. Implementation slices และ acceptance

| Slice | งานในแผนปัจจุบัน | Exit evidence ที่ต้องสร้าง |
|---|---|---|
| UI-S1 / PE-01 / G3 | Mode/navigation + per-task view state | A→IDE→A และ A→B→A คง draft/attachments/scroll/buffers; owner PID/sessionId ไม่เปลี่ยน; layout restore; screenshot+state assertions |
| UI-S2 / PE-02 / G1+G3 | Composer/activity/questions + runtime feature mapping | IME, upload fail, double send, queue/steer/stop, two concurrent approvals, stale incarnation, auth unavailable; per-OMP-feature tests ไม่ใช่ generic card count |
| UI-S3 / PE-03/10/11/12 / G2+G3 | Work panels + editor/review/terminal/browser/artifacts + หน่วย workspace | dirty-buffer conflict, untracked diff, PTY resize/exit, browser control isolation, สองงานไม่ชนพอร์ต/preview, failed build retains last-good, same build hash in viewer |
| UI-S4 / PE-04/05/12/13 / G2+G4 | Durable recovery + mobile surfaces + review package | disconnect before/after ACK, unknown outcome, UI quit host continues, revoked device, real iPhone cellular same session/workspace/build, แจ้งแล้วเปิด request เดิม |
| UI-S5 / PE-06/07/09 / G3–G5 | Tokens/icons/motion/a11y/perf | same viewport/theme screenshot receipts, keyboard/VoiceOver/Thai/zoom, reduced motion, interrupted transition, baseline CPU/RSS/frame/input; fix measured regressions |
| UI-S6 / PE-08 | Optional local simulator workflow | separate spike contract; no dependency/service install without selection; not substitute real device gate |

Source starting points: `apps/macos/src/webview.ts`, `extension.ts`, corresponding tests, `apps/ios/App.tsx`. Current source already has three-column shell, task/model controls, tool cards, basic reconnect display, IME guard, reduced motion, native resource actions and `retainContextWhenHidden`. These are reusable foundations, **not proof of complete Agent↔IDE retention, polished browser panel, full OMP UI or mobile parity**. `openAgentsWindow()` currently closes sidebar/auxiliary bar; UI-S1 must save/restore prior IDE layout instead of permanently overriding user layout

Before each slice, bind its Sxx/PE/Pxx identifiers to applicable children in `backlog/requirement-graph.json`; retain all 198 parents and 75 families. A source diff, static prototype or passing fixture alone never promotes visual/device/live-provider gate to verified

## 8. Open evidence and next work

1. **CX-01 blocked:** user-provided sanitized Codex screenshots/recording (Agent home, composer menus, running tools, approval, review/browser, settings) or a future permitted reference session. Do not bypass app safety restriction. **หลัง D20 (2026-09-14) pixel target คือ Cursor ไม่ใช่ Codex** จึงไม่ต้องรอ CX-01 เพื่อ freeze pixel; CX-01 ยังมีผลเฉพาะกับ surface ที่จะอ้างว่าเหมือน Codex เท่านั้น. ต้องมี side-by-side Cursor/Caret capture ที่ viewport/scale/theme เดียวกันก่อนนับ parity pass
2. Cursor capture incomplete: same-task switch with safe fixture, running/queued/approval/error, Settings/search/review interactions, light theme, timing and focus tracing. Current inspection is entry-point evidence only
3. Clickable prototype remains **planned**, not delivered by this document: local fixture only, no provider/host side effects; cover send→approval→review→preview→mobile/recovery and clearly label simulated state. Prototype needs keyboard/reduced-motion review before production UI work
4. Detailed effective OMP registry→S03–S06/S13 mapping remains G1 work; this document does not enumerate or certify every runtime operation. Add schemas/commands/events/error cases per pinned runtime feature
5. No packages/skills installed; no renderer/harness switch; no production UI changes in this specification slice
