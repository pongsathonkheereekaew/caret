# Caret

**[แผนเดียวฉบับละเอียดสำหรับส่งต่อ](docs/IMPLEMENTATION-PLAN.th.md)** — ฉบับ 5, 9 กันยายน 2026

Code - OSS fork + conditional Paseo backend + Codex/OpenCode engines พร้อม Caret UI ตาม Cursor public reference

- 198 parent requirements (158 baseline + 40 supplementary)
- 75 UI screen families (57 baseline + 18 supplementary)
- 29 tool contracts และ 16 implementation work packets
- 261 retrieved docs/help URLs พร้อม source routing ledger
- [ผล scrutinize](docs/SCRUTINIZE-REVIEW.th.md): แก้ omissions ที่พบแล้ว; ยังมี reference/schema/engine evidence gates

Planning only ยังไม่เริ่มโค้ด ติดตั้ง build หรือใช้ inference quota แผนรวมเป็น authoritative specification; supporting files เป็น snapshots ต้องอ่านส่วน J/K ซึ่งเป็นข้อแก้ไขล่าสุดก่อนลงมือ

พร้อมส่งต่อเพื่อเริ่ม reference/feasibility และเดิน implementation ตามแผน ไม่ใช่คำรับรอง pixel-perfect/private-engine 1:1 หรือทุก API field ว่า verified แล้ว

ผู้ใช้เลือก **Synara UI เป็นฐานเริ่มต้น** ดู [reuse assessment](docs/SYNARA-ASSESSMENT.th.md) และส่วน L ของแผนรวม ซึ่งเป็นข้อเลือก UI/backend ล่าสุด
