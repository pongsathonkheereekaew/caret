# Caret documentation

แผนและสเปกที่มีอำนาจมี **ไฟล์เดียว**: [maintenance/CARET-PLAN-2026-09-14.th.md](maintenance/CARET-PLAN-2026-09-14.th.md)

Checkout คือ `/Users/pond/caret` บน branch `main`
เขียนเมื่อ 2026-09-14 หลังรวมเอกสารทั้งหมดเป็นฉบับเดียวและย้ายของเก่าเข้า archive

## ต้นทางปัจจุบัน

| เรื่อง | ไฟล์ |
|---|---|
| กฎเอเจนต์ทุกเทิร์น | [AGENTS.md](../AGENTS.md) |
| **นิยามผลิตภัณฑ์ + สถาปัตยกรรม + Cursor parity contract + SSOT + แผน S1–S5** | [maintenance/CARET-PLAN-2026-09-14.th.md](maintenance/CARET-PLAN-2026-09-14.th.md) |
| ใบเสร็จรันจริง (สคริปต์เขียนที่นี่) | [maintenance/evidence/](maintenance/evidence/) |
| pin ของ desktop / OMP (ต้องอยู่ที่เดิม — `ci-validate` อ่านไฟล์นี้) | [UPSTREAM-LOCK.md](UPSTREAM-LOCK.md) |
| identifier 198 parents / 75 UI families | [../backlog/requirement-graph.json](../backlog/requirement-graph.json) |
| เอกสารเก่าทั้งหมด | [archive/README.md](archive/README.md) |

## ลำดับเมื่อเริ่มงานใหม่

1. [AGENTS.md](../AGENTS.md) — กฎและ invariant ของโปรเจกต์
2. [CARET-PLAN-2026-09-14.th.md](maintenance/CARET-PLAN-2026-09-14.th.md) — เริ่มที่ §0 นิยาม แล้วตาม §6 SSOT และ §7 แผน
3. เปิด archive เฉพาะเมื่อต้องการ identifier เก่า, การวัด Cursor ฉบับเต็ม, หรือหลักฐานย้อนหลัง

## กติกาเอกสาร

- เอกสารนี้และ `CARET-PLAN` เท่านั้นที่ตัดสินงานใหม่ ถ้าแผนเปลี่ยน ให้แก้ที่ `CARET-PLAN` แล้วอัปเดตตารางนี้ถ้าจำเป็น
- ห้ามสร้างเอกสารแผน/สเปกใหม่ใน `docs/` โดยไม่ย้ายของเดิมเข้า archive ก่อน — เพื่อไม่ให้มีสองเจ้าของความจริง
- ใบเสร็จ (evidence) อยู่ที่ `maintenance/evidence/` เสมอ เพราะสคริปต์และเทสต์อ้างพาธนี้
- เอกสารที่ย้ายเข้า archive แล้ว **ไม่มีอำนาจ** แม้เนื้อหาจะดูทันสมัย
