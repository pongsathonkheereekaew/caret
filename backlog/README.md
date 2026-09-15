# Caret backlog

โฟลเดอร์นี้ **ไม่ใช่สเปกที่มีอำนาจ** — ใช้เป็น identifier, หลักฐานย้อนหลัง และการวัด Cursor เท่านั้น
ตาม [AGENTS.md](../AGENTS.md) และ [docs/README.md](../docs/README.md) สเปกที่มีอำนาจคือ
[maintenance/CARET-PLAN-2026-09-14.th.md](../docs/maintenance/CARET-PLAN-2026-09-14.th.md)

`requirement-graph.json` ในโฟลเดอร์นี้ถูก `scripts/ci-validate.mjs` อ่านทุกครั้งที่รัน gate
(198 parents / 75 UI families) — ห้ามย้าย ห้ามเปลี่ยนชื่อ และห้ามแก้รูปทรงของมัน

## แผน/สเปกที่เลิกใช้แล้ว

ไฟล์กลุ่มนี้เป็นแผนหรือ brief จากยุคก่อนรวม SSOT (2026-09-10) บางใบเป็น paste-ready prompt
ที่ชวนเปิด session ใหม่บนเส้นทางที่เลิกใช้แล้ว — เก็บไว้เป็นประวัติ **ห้ามรัน ห้ามหยิบมาเป็นข้อกำหนดใหม่**

| ไฟล์ | อะไร | ทำไมเลิกใช้ |
|---|---|---|
| `PARITY-ROADMAP.md` | staged execution ถึง Cursor 3.19 | แทนที่ด้วย §7 ของ CARET-PLAN; reference ปัจจุบันคือ Cursor 3.20.17 |
| `PARITY-BLUEPRINT-MAP.md` | parity map เทียบ blueprint Cursor 3.19 | ข้อตัดสิน ADOPT/STAGED/DIVERGE ถูก merge เข้า CARET-PLAN แล้ว |
| `D-deep-ide-plan.md` | deep IDE plan บน opencode harness | OMP เป็น harness เจ้าของ execution + transcript เพียงตัวเดียว (§0) |
| `NATIVE-CONTRACTS-BRIEF.md` | paste-ready prompt ของ native workbench track | ชี้ checkout `~/caret-work/` ที่ไม่มีแล้ว และวางบทบาท daemon/backend ที่ถูกแทน |
| `UI-parallel-brief.md` | paste-ready prompt ของ UI track ที่แยกจาก daemon | การแยก track ต่อ daemon ไม่ตรงกับ SSOT ปัจจุบัน |
| `F02-backend-adr.md` | ADR เลือก backend (Synara / Paseo) สถานะ interim | ขัดกับ "OMP เป็น harness เดียว"; เก็บไว้เป็นหลักฐานการตัดสินใจเดิม |
| `F04-editor-bridge-contract.md` | contract ของ editor bridge ที่ยืนยันกับ Code-OSS `3e078a3` | pin ปัจจุบันคือ `ea1912fd6a05b80a56b2ad9b955075211deea521` (ดู `patches/desktop/manifest.json`) |
| `REVIEW-PLAN-evidence.md` | หลักฐาน Review/Plan models จาก daemon track | daemon track เลิกใช้; ตัวเลข 84/84 เป็นของ suite ที่ไม่มีแล้ว |

## ยังใช้ได้

ไฟล์ `*-evidence.md` ที่เหลือและค่าที่วัดไว้ (เช่น UI endpoints, session list, artifacts) ยังใช้เป็น
หลักฐาน/identifier ย้อนหลังได้ตามปกติ แต่ไม่ขยายขอบเขตของงานที่กำลังทำ
