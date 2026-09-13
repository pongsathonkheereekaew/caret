# Caret specification

เอกสารที่ยังมีอำนาจอยู่มีชุดเดียว ไฟล์เก่าอยู่ใน [archive](archive/README.md) ไม่ใช้ตัดสินงานใหม่

Checkout คือ `/Users/pond/caret` บน branch `caret/g0-omp-foundation`

## อ่านตามงาน

| งาน | ต้นทาง | ไฟล์ |
|---|---|---|
| กฎเอเจนต์ทุกเทิร์น | agent instructions | [AGENTS.md](../AGENTS.md) |
| สถานะล่าสุด / ทำต่อจากไหน | handoff | [maintenance/CARET-HANDOFF-2026-09-13.th.md](maintenance/CARET-HANDOFF-2026-09-13.th.md) |
| สถาปัตยกรรมและสไลซ์ G1–G5 | direction | [maintenance/CARET-IMPLEMENTATION-DIRECTION-2026-09-12.th.md](maintenance/CARET-IMPLEMENTATION-DIRECTION-2026-09-12.th.md) |
| หน่วยงานบน Mac + วงจรรีวิว | workflow | [maintenance/CARET-WORKSPACE-WORKFLOW-2026-09-13.th.md](maintenance/CARET-WORKSPACE-WORKFLOW-2026-09-13.th.md) |
| เกณฑ์รับงาน P01–P20 / E1–E4 | acceptance | [maintenance/CARET-REFERENCE-ACCEPTANCE-2026-09-12.th.md](maintenance/CARET-REFERENCE-ACCEPTANCE-2026-09-12.th.md) |
| สเปกหน้าจอและ interaction S01–S16 | UI spec | [maintenance/CARET-UI-INTERACTION-SPEC-2026-09-13.th.md](maintenance/CARET-UI-INTERACTION-SPEC-2026-09-13.th.md) |
| ค่า default / component / motion D00–D19 | UI design | [maintenance/CARET-UI-DETAILED-DESIGN-2026-09-13.th.md](maintenance/CARET-UI-DETAILED-DESIGN-2026-09-13.th.md) |
| แผนที่ 198 parents / 75 families | coverage | [maintenance/CARET-UI-COVERAGE-2026-09-13.th.md](maintenance/CARET-UI-COVERAGE-2026-09-13.th.md) |
| วิธีตรวจ UI / fixture / receipt | validation | [maintenance/CARET-UI-VALIDATION-2026-09-13.th.md](maintenance/CARET-UI-VALIDATION-2026-09-13.th.md) |
| รายการงานและหลักฐานที่ทำแล้ว | ledger | [maintenance/CARET-FULL-IMPLEMENTATION-2026-09-12.th.md](maintenance/CARET-FULL-IMPLEMENTATION-2026-09-12.th.md) |
| ขอบเขต OMP O01–O18 | OMP | [maintenance/CARET-OMP-COVERAGE-2026-09-12.th.md](maintenance/CARET-OMP-COVERAGE-2026-09-12.th.md) |
| ที่มาในซอร์ส OMP | inventory | [maintenance/CARET-OMP-SOURCE-INVENTORY-2026-09-12.md](maintenance/CARET-OMP-SOURCE-INVENTORY-2026-09-12.md) |
| สถานะสไลซ์ G0 / G1 | slice notes | [G0](maintenance/CARET-G0-IMPLEMENTATION-2026-09-12.th.md) · [G1](maintenance/CARET-G1-IMPLEMENTATION-2026-09-12.th.md) |
| ใบเสร็จรันจริง | evidence | [maintenance/evidence/](maintenance/evidence/) |
| pin ของ desktop / OMP | lock | [UPSTREAM-LOCK.md](UPSTREAM-LOCK.md) |
| identifier ข้อกำหนดเก่า | historical | [archive/2026-09-09/agent.md](archive/2026-09-09/agent.md) และ `backlog/` |

## สเปกละเอียดที่ใช้ออกแบบ UI

อ่านสามไฟล์นี้คู่กัน ไม่รวมเป็นไฟล์เดียว:

1. [Interaction spec](maintenance/CARET-UI-INTERACTION-SPEC-2026-09-13.th.md) — แผนที่จอ S01–S16, สถานะ, การกระทำ, motion ที่เสนอ
2. [Detailed design](maintenance/CARET-UI-DETAILED-DESIGN-2026-09-13.th.md) — default/action/motion ที่ชนกับ overview ให้ใช้ไฟล์นี้
3. [Validation](maintenance/CARET-UI-VALIDATION-2026-09-13.th.md) — ต้องมี fixture/receipt แบบไหนก่อนปิด gate

ทิศทางผลิตภัณฑ์ที่ล็อกแล้ว: OMP เป็น harness และเจ้าของ execution/transcript คนเดียว · โต๊ะงานบน Mac แบบ Conductor · ความต่อเนื่องและหลักฐานบน iPhone แบบ Amp · Code-OSS เป็นฐาน IDE · Codex เป็นหลักอ้างอิงหน้าจอ

## ลำดับเมื่อเริ่มงานใหม่

1. [AGENTS.md](../AGENTS.md)
2. [handoff 13 กันยายน](maintenance/CARET-HANDOFF-2026-09-13.th.md)
3. ไฟล์ในตารางตามชนิดงาน ไม่เปิด archive ยกเว้นต้องการ identifier หรือหลักฐานวันที่ระบุ

ข้อกำหนด 198 parents / 75 UI families ยังเป็นกราฟใน `backlog/requirement-graph.json` การมี identifier เก่าไม่ขยายงานที่มีขอบเขตให้กลายเป็นทั้งแบ็กล็อก
