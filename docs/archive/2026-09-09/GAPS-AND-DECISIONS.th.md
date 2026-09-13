# Caret — ข้อสรุปและช่องว่างที่ไม่ควรซ่อน

9 กันยายน 2026 • Wayfinder planning map v2 • execution ยังไม่เริ่ม

## Decisions ที่ล็อกได้จากคำขอและหลักฐาน

| ID | คำตัดสิน | เหตุผล / หลักฐาน | ขึ้นกับ |
|---|---|---|---|
| D01 | ส่วนตัว ไม่มี deadline; รอบนี้เอกสารเท่านั้น | ผู้ใช้ยืนยัน ไม่ทำ build/install/spike/code | — |
| D02 | macOS/Windows/Linux desktop จาก Code - OSS | ข้อกำหนดผู้ใช้; ไม่เลือก web shell มาแทน | — |
| D03 | high-fidelity Editor + Agents Window + mobile | Cursor docs มีสอง desktop surfaces; phone companion ไม่ใช่ full IDE | D02 |
| D04 | Codex + OpenCode Go + OpenRouter | รายชื่อที่ผู้ใช้มี; official engine/provider interfaces | — |
| D05 | reuse Paseo backend/protocol ผ่าน boundary | ลด local/remote lifecycle งานซ้ำ; custom UI ยังอยู่ Caret | D04 |
| D06 | Code - OSS + VSCodium reference; Void/Continue ไม่เป็นฐานหลัก | maintenance/README evidence และ upstream cost | D02 |
| D07 | iOS/iPad native UI; Android PWA baseline | Cursor native iOS baseline; fidelity สำคัญ; Android native เป็น separate future delta | D03 |
| D08 | local machine ก่อน cloud compute | ผู้ใช้ยืนยัน; relay/push infra แยกจาก VM | D05 |
| D09 | Tab/index/media แยก capabilities | agent subscription ไม่เท่ากับ FIM/speech/image access | D04 |
| D10 | Origin-like hosting ใช้ Gitea service + custom SCM sync/UI | ไม่สร้าง Git forge ใหม่ทั้งหมด; mirror ไม่แทน PR sync | D08 |
| D11 | feature inventory ครอบคลุม late ecosystem ด้วย | ทุกอย่างไม่ถูกตัดเป็น MVP เงียบ ๆ; commercial contracts แยก external scope | D03 |

## Gap tickets

แต่ละ ticket ระบุคำถาม เหตุที่มีผลต่อแผน หลักฐานที่ต้องใช้ candidate/fallback และเงื่อนไขปิด ตาม Wayfinder ไม่มี gap ใดได้รับอนุญาตให้แทนด้วยข้อมูลเดา

| ID | คำถาม / ผลกระทบ | หลักฐาน / วิธีปิด | ทางหลักและ fallback | สถานะ |
|---|---|---|---|---|
| G-VIS-01 | exact build/theme/geometry ของทุก screen คืออะไร? pixel fidelity ยังยืนยันไม่ได้ | runtime screenshot states + OS/scale/fonts/build; measured token sheet และ overlays | official image set เป็น structure; full runtime capture ก่อน pixel freeze | reference-gated |
| G-VIS-02 | settings/shortcuts ใน docs หลายรุ่นอันไหน baseline? | เลือก build เดียว, record menu/shortcut contexts, discrepancy log | current verified build wins; ไม่ union เมนูเก่าใหม่ | reference-gated |
| G-OSS-01 | Paseo revision ไหนแยกใช้แล้วคุ้มจริง? | pin server/client/protocol/license; contract/coupling spike F02 | adapted daemon; direct engine adapters หากต้อง patch core กว้าง | implementation validation |
| G-AUTH-01 | สิทธิ์และ quota สามบัญชีพร้อมใช้จริงหรือไม่? | official login/status และ bounded live request ภายหลัง | engines manage auth; ไม่มี token scraping | not tested |
| G-MODEL-01 | model selection ให้คุณภาพเท่า Cursor ได้เพียงใด? | task benchmark per provider/engine, cost/latency and limitations | best accessible model; proprietary Composer/Tab weights ไม่สมมติว่ามี | research/quality gap |
| G-TAB-01 | FIM + cross-file edits จะใช้ serving ใด? | typing replay F05; provider workload/capability checks | Tabby/local FIM/dedicated API; Continue/Void reference only | conditional choice |
| G-EXT-01 | extension/debug/remote ที่จำเป็นตัวใดใช้ได้? | license/source/version compatibility matrix ตามภาษาและ OS | Open VSX/permitted build; replacement where restricted | external compatibility |
| G-BUF-01 | daemon engine กับ unsaved editor edits synchronize อย่างไร? | versioned bridge conflict/undo fixtures | intercept/reconcile patches; never watcher overwrite | implementation validation |
| G-PUSH-01 | signing/APNs/Live Activities/pairing deployment แบบใด? | developer account/device capability and backend entitlement validation | native APNs sender + self-host relay; local polling ไม่ถือว่า full parity | external setup |
| G-CLOUD-01 | compute provider/hardware/cost ceilings คืออะไร? | VM portability/lifecycle/cost study ตอน M8 | generic isolated VM worker; microVM only if justified | deferred operational choice |
| G-SCM-01 | Origin two-way sync/forge-local refs ครบอย่างไร? | mappings & round-trip/provider authorization tests | Gitea+custom sync; supported fallback explicit | implementation validation |
| G-BOT-01 | persistent assistant computer/voice/memory ใช้ source ใด? | BOT requirements, engine capabilities and isolation tests | reuse selected daemon/tools; separate persistent scope | late validation |
| G-COM-01 | สิ่งที่เป็นบริการ/สิทธิ์ของ Cursor เท่านั้นจะเทียบอย่างไร? | source/account agreements and obtainable alternatives | functional equivalents; no fake certifications/private-model access | external limitation |

## ข้อขัดแย้งของหลักฐานที่แก้ในแผนแล้ว

- Continue GitHub API ยัง `archived=false` แต่ README ระบุหยุดดูแล; ใช้ README เป็น maintenance signal ไม่สรุปจาก push date
- Paseo GitHub metadata license เป็น NOASSERTION แต่ LICENSE ที่อ่านระบุ Apache-2.0 สำหรับโครงการพร้อม third-party exceptions; ต้อง pin revision และตรวจไฟล์ที่ reuse ไม่อาศัยบทความเก่าที่บอก AGPL
- Cursor Agent Review docs ใช้คำว่า after-task และ after-commit ไม่สอดคล้องกัน: Caret มี explicit trigger setting; default exact ยังอยู่ G-VIS-02
- Cursor mobile remote-control ใช้ cloud loop แม้ tools อยู่ local; Caret local-first เป็น architectural substitution ที่เปิดเผย ไม่อ้างว่า topology เหมือนกัน
- `My Machines`, pool routing, multi-root และ multi-repo เป็นคนละความสามารถ ต้องทดสอบ combinations ไม่สรุปว่ารองรับทุกอย่างร่วมกัน

## ขอบเขตคำว่า “ครบ”

Plan coverage: ทุกหมวดที่พบถูกจัดเข้ารายการฟีเจอร์/หน้าจอ/dependency/acceptance หรือ external gap แล้ว ไม่ใช่รับรองว่า inventory เห็น hidden/account-specific behavior ทั้งหมด

Implementation completeness: ยังเป็นศูนย์ตามคำขอ ไม่มี build/spike/app code ใหม่ในรอบนี้

Visual exactness: ยังมี G-VIS reference gates จึงใช้คำว่าแผน high-fidelity พร้อมเกณฑ์วัด ไม่ใช้คำว่า pixel-perfect verified

ทางเลือกที่ไม่ต้องถามผู้ใช้อีก: ตั้งต้นแพ็กเกจ/โครง component ตามเอกสารนี้ เก็บ signing/model/cost/platform facts สำหรับขั้น setup เมื่อได้รับคำสั่งลงมือ ข้อที่เป็น implementation validation ไม่จำเป็นต้องบังคับผู้ใช้เลือกทางเทคนิคจากการเดาตอนนี้
