# Caret — ข้อกำหนดจาก refs และเกณฑ์จบงานหลายประเภท

สถานะ: acceptance specification จากความต้องการที่ผู้ใช้ยืนยันและแหล่งอ้างอิงที่อ่านเมื่อ 2026-09-12; ยังไม่ใช่ผลทดสอบ Caret

## ความต้องการที่ยืนยันหลัง Grill

Caret เป็นพื้นที่ทำงานกับ AI สำหรับหลายโปรเจกต์ ตั้งแต่เว็บ เกม limiter/audio plugin จนถึงโปรแกรมทั่วไป ต้องทำ workflow ให้จบในแอปตามความสามารถที่อ้าง Codex/Cursor/Claude, ใช้ OMP เป็น harness และเปิด tools/core features ของ OMP ครบ. Mac เป็น execution host ที่เปิดไว้และทำงานต่อหลังปิด UI; iPhone คุม session เดิมจากนอกบ้านได้โดยไม่ตั้ง terminal/link/VPN ใหม่ทุกครั้ง. ไม่มีค่าใช้จ่าย infrastructure เพิ่มโดยอัตโนมัติ ใช้เครื่องและสิทธิ์ provider ที่ผู้ใช้มีอยู่

อัปเดต 13 กันยายน: ตีความ P11/P13/P17/P18 ผ่าน [task workspace workflow](CARET-WORKSPACE-WORKFLOW-2026-09-13.th.md). หน่วยงานคือ task workspace บน Mac; หน่วยรีวิวคือแพ็กเกจคุย+diff+พรีวิว+หลักฐาน; มือถือเล่น build เดียวกัน. ไม่สร้าง Orb fleet และไม่ห่อหลาย harness

Aetheria ไม่ใช่ domain ที่ฝังใน Caret core; limiter เป็น acceptance อีกประเภท. Target OS ของผลงานที่สร้างแยกจาก platform ของ Caret app: ผู้ใช้ใช้ Mac/iPhone สั่งสร้างซอฟต์แวร์สำหรับหลายระบบได้ แต่ต้องมี build/test environment ของ target นั้นจริงก่อนอ้างว่า verified

## แหล่งอ้างอิงและวิธีใช้

- R1 [Codex/ChatGPT features](https://learn.chatgpt.com/docs/features): project/chat, long-running work, browser/computer use, files และ plugins. URL เดิม `developers.openai.com/codex/app/features/` redirect มาหน้านี้ ณ วันที่อ่าน ไม่ถือว่าเครื่องมือบริการเหล่านั้นย้ายสิทธิ์มา OMP โดยอัตโนมัติ
- R2 [Codex worktrees](https://learn.chatgpt.com/docs/environments/git-worktrees): แยกงานขนาน, Local/Worktree handoff และ mobile คุมงานบนคอมพิวเตอร์
- R3 [Cursor agent](https://cursor.com/docs/agent/overview), [Browser](https://cursor.com/docs/agent/tools/browser): editing/terminal และ browser actions/screenshots/logs/workspace isolation
- R4 [Claude Code overview](https://code.claude.com/docs/en/overview), [Remote Control](https://code.claude.com/docs/en/remote-control): multi-file implement/test/review, Git, MCP, skills/hooks และ local execution ที่ควบคุมจากอุปกรณ์อื่น
- R5 [Paseo connectivity](https://paseo.sh/docs/connectivity), [security](https://paseo.sh/docs/security): client-daemon separation, pairing, encrypted relay และ direct route
- R6 [Caret baseline เดิม](../archive/2026-09-09/PARITY-MATRIX.th.md), [handoff เดิม](../archive/2026-09-09/HANDOFF-2026-09-10.md): เก็บ identifiers และข้อผิดพลาดที่เคยพบ เป็น historical evidence ไม่ใช่ผลทดสอบรอบนี้
- R7 [Amp Orbs](https://ampcode.com/docs/orbs), [Conductor workspaces](https://www.conductor.build/docs/concepts/workspaces-and-branches): product-pattern ของ remote continuity/review package และ isolated Mac workspaces ตาม [workflow decision](CARET-WORKSPACE-WORKFLOW-2026-09-13.th.md). ไม่ใช่สิทธิ์คลาวด์หรือโค้ดที่นำมาใช้ได้

ตารางต่อไปเป็นข้อกำหนด Caret ที่สังเคราะห์จาก refs และผู้ใช้ ไม่ใช่การรับรองว่า refs แต่ละตัวมีทุกอย่างเหมือนกัน หรือว่า Caret ผ่านแล้ว. Backlog 198 parents/75 UI families เดิมยังเก็บไว้ ไม่รีเซ็ตสถานะ ไม่ใช้จำนวนแถวใหม่แทนเปอร์เซ็นต์ clone parity และไม่ลบ requirements ที่ไม่ได้กล่าวถึงในตารางนี้

## Product acceptance matrix

ทุกแถวเริ่มสถานะ `specified / not verified`. กำหนด gate เป็นลำดับลงมือ ไม่ได้ตัดแถวหลังออกจากผลิตภัณฑ์ เป้าหมาย full OMP core ใช้ coverage inventory ประกอบ ไม่ได้ลดเหลือเฉพาะตาราง UI นี้

| ID | Requirement / trace | หลักฐานที่ต้องผ่านใน Caret | Gate |
|---|---|---|---|
| P01 | Multi-project และ non-Git directories — R1/R4; AG-02, IDE-01 | เปิด 2 repos + 1 folder ที่ไม่มี Git; session/cwd/config/artifacts ไม่ปน; recent/pin/archive/search และ restart restore ถูก | Host |
| P02 | Agent-native context/session — R4; AG-03/06 | prompt→text/tool/error stream, paginated history, resume/fork/branch อ้าง OMP identity เดิม; user-visible context ไม่หายหลัง reconnect | OMP |
| P03 | OMP configuration/capabilities — ผู้ใช้; CTX-06/07 | catalog มี effective provider/model/tool config; unsupported/credential-required ระบุจริง; switch ไม่ล้าง session และไม่เปลี่ยนไป billed path เงียบ ๆ | OMP |
| P04 | Core tools/extensions ครบ — ผู้ใช้; AG-07, MOD-04 | per-tool schemas/input/output/media/approval/cancel รวม dynamic registration; feature ที่ยังไม่ expose เป็น open gap ไม่ซ่อนจาก matrix | OMP |
| P05 | Queue/steer/cancel/goals/plan — R1/R4; AG-04/05/08/09 | queue UI ตรง runtime, steering ถึง session เป้าหมาย, Stop ไม่ใช่ rollback, idle turn ไม่ถูกตีความว่า goal จบ, budget/status ตรง events | OMP |
| P06 | Approvals/interactions — R4/R5 | effect เกิดหลังอนุมัติ, deny/cancel/timeout ไม่มี effect; forms/select/input และ concurrency/reconnect/stale response ผูก request+incarnation ถูก | OMP |
| P07 | Files/editor — R3/R6; IDE-02/03/04 | tabs/splits, unsaved buffers, search/replace, symbols/navigation, rename และ undo; manual edits ซ้อน agent edits ต้อง conflict ไม่ overwrite | Editor |
| P08 | Language/debug/test tooling — R6; IDE-07/09 | language-server diagnostics/navigation, debugger breakpoints และ test workflow สำหรับ language ของ fixture; dependencies/licenses ประกาศ; external editor ไม่ใช่ fallback ที่นับว่าจบในแอป | Editor |
| P09 | Inline edit/completion — R6; TAB/EDIT | versioned proposal, accept/reject/partial accept และ undo ไม่ใช้ stale buffer; วัด latency/quality จาก fixture ไม่เดาจาก model label | Editor |
| P10 | Terminal/process lifecycle — R3/R4; IDE-05 | interactive PTY/input/resize, long-running build, stop/process exit, full log artifact; แยก user terminal กับ agent process; UI ปิดไม่ฆ่า host | Host |
| P11 | Git/review/worktrees — R2/R4/R7; IDE-06, AG-11; PE-10/PE-11 | tracked+untracked diff/hunks, stage/commit/branch/conflict, isolated worktree ต่อ task, setup/run/port ต่องาน, scoped reject และ guarded bring-back; ไม่ whole-repo reset | Workspace |
| P12 | Browser control — R3; MOD-03, CTX-02 | navigate/click/type/screenshot/console/network ตาม OMP bridge ที่มีจริง; browser session อ้าง project ถูก, reconnect ไม่เปิด server ซ้ำ | Tools |
| P13 | Playable preview — ผู้ใช้/R7; AG-10; PE-12 | immutable buildId+hash, assets ไม่ปน build, Mac/iPhone เล่น build เดียวกัน, ฟีดแบ็กผูก build ที่เปิดอยู่, failed build ไม่ทับ last good, เปลี่ยน build เมื่อผู้ใช้เลือก | Artifacts |
| P14 | Native app/tool control — R1 + limiter | เปิด test app/DAW ที่ host, observe UI/log/crash, capture evidence; system permissions ออกแบบให้ setup ได้; ไม่อ้าง remote desktop/audio streaming จนทดสอบ | Tools |
| P15 | Artifact/media/file workflows — R1; AG-10, CTX-03 | image/audio/video/document/log ตาม MIME จริง, upload/download/resume/hash และ provenance; original approved image คงเดิม; ตัวสร้างไฟล์ต้องใช้ backend ที่มีสิทธิ์จริง | Artifacts |
| P16 | Context/search/instructions — R4; CTX/SEARCH | attach files/selection/logs, skills/hooks/MCP/config precedence ตรง OMP, compaction/search ไม่สูญ pending state, ignored files กับ sandbox แยก semantics | OMP |
| P17 | Parallel work — R2/R4/R7; PE-10 | สอง OMP sessions ไม่แย่ง events/ไฟล์/พอร์ต/preview; งานอิสระอยู่คนละ workspace; internal OMP subagent ไม่ถูกสร้างเป็น unrelated root session; จำกัด resource และแสดง lineage | Host |
| P18 | Mobile continuation — R2/R4/R5/R7; PE-12/PE-13 | paired phone บน cellular เห็น session/workspace เดิม, รับ approvals, ส่งข้อความ/attachments/ฟีดแบ็กบนพรีวิว, เล่น build hash เดียวกับ Mac, แจ้งเมื่อถึงตาผู้ใช้, event replay gap-free และ commandId เดิมไม่ dispatch ซ้ำ | Remote |
| P19 | Recovery/offline — ผู้ใช้/R5 | host UI quit, network drop, process crash, revoke, foreground restore; unknown side-effect outcome ไม่ auto-rerun; cache ระบุ freshness และ host unreachable ตรงจริง | Remote |
| P20 | Installation/update/usability — R6; IDE-08/11/12 | self-contained install/helper, Keychain/pairing, protocol/schema compatibility, migrations/rollback, Thai IME/keyboard/touch/a11y และ OMP version compatibility | Release |

ข้อกำหนดไม่ใช้สิทธิ์ของ product reference มาเป็นสมมติฐาน เช่น closed-source imagegen/computer-use connector ต้องมี implementation/provider ที่ Caret ใช้ได้เอง หาก OMP ไม่มีความสามารถ product-level ที่จำเป็น ให้เพิ่ม integration ผ่าน OMP tool/extension contract พร้อม tests โดยคง OMP เป็น harness

## End-to-end fixtures ที่ต้องผ่าน

### E1 — เว็บทั่วไป

เปิด project → agent implement feature ข้ามไฟล์ → user แก้ buffer ซ้อน → resolve conflict → test/build → browser click/console evidence → review/commit ภายใน Caret. ต่อจาก iPhone ด้วย feedback ที่ผูก buildId แล้วให้ agent แก้ต่อ. เพิ่ม folder ไม่มี Git เพื่อยืนยันว่า domain ไม่ผูก Aetheria หรือ Git เสมอ

### E2 — Aetheria

ใช้ source snapshot ที่รวมงานค้างที่เลือกอย่างมี manifest → tests/build A → Mac/iPhone เล่น A → screenshot+feedback → session เดิม build B. มี exact-artwork candidate/import/review/approval แยกจาก generation entitlement; เกม save/duel continuity ไม่ถูกสับสนกับ agent-session continuity

### E3 — Limiter / native software

Caret เรียก project-defined build/test commands และ host tools ผ่าน OMP: implement DSP/UI → deterministic offline audio tests → compiler/validator output → install/load artifact ใน DAW ที่มีจริง → automation/bypass/state restore/latency และการฟังตรวจผล → report ที่ผูก source/binary hashes → แก้ต่อจากผลนั้น

Project acceptance ต้องแจกแจง `OS + CPU + plugin format + DAW/version + sample rate/block size + test case`. “ทุก DAW” เป็น compatibility objective ไม่ใช่ผลผ่านจาก Mac เครื่องเดียว; unsupported/unavailable target environment เป็นช่องว่างของหลักฐาน. ไม่ต้องถามชื่อ DAW เพื่อเริ่มสร้าง Caret core แต่ต้องมี environment จริงเมื่อถึงการตรวจรับ limiter. ไม่เลือก framework/license หรือเริ่มเขียน limiter ในงานวางแผน Caret นี้

Audio preview บน iPhone อาจเป็น rendered audio พร้อม metadata; ไม่เท่ากับการรัน desktop plugin หรือ realtime DAW audio streaming. ความสามารถส่งเสียง/control แบบ realtime ต้องมี latency/quality acceptance แยกก่อนอ้างว่ารองรับ

### E4 — ความต่อเนื่องและหลายโปรเจกต์

รัน E1/E3 เป็นคนละ OMP sessions/workspaces → เปลี่ยน model หนึ่งงาน → pending approval อีกงาน → ปิด Mac UI → เปิด iPhone บน cellular → ส่ง command แล้วตัดเน็ตก่อน/หลัง ACK → reconnect/replay → ต้องไม่มี duplicate dispatch, session mix-up หรือ approval ที่อ้าง process เก่า. Host crash ระหว่าง side effect ให้รายงาน outcome_unknown และ reconcile ไม่รันซ้ำอัตโนมัติ

## Definition of done และขอบเขตหลักฐาน

Full OMP core support ต้องมี registry inventory + per-feature behavior/UI mapping + tests บน pinned version; generic tool card หรือคำว่า supported ใน README ไม่พอ. Product acceptance ต้องผ่าน E1–E4 กับ platform ที่ประกาศรองรับจริง พร้อม artifact/log/revision receipts. การทดสอบ source/fixtures ในการประเมินนี้ไม่แทน native-device, provider-auth หรือ real-DAW checks

ข้อกำหนดเหล่านี้ทำให้การสรุปเดิมว่า basic editor เพียงพอใช้ต่อไม่ได้โดยไม่ตรวจ P07–P09. เลือก stack จากความสามารถที่ reuse ได้และช่องว่างที่ต้อง implement; ไม่เลือก Rust/GPUI/Tauri จากความชอบภาษาอย่างเดียว และไม่ rewrite modules ที่มีประโยชน์เพียงเพื่อให้ทั้ง repo ใช้ภาษาเดียว
