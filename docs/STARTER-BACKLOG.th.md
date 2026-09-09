# Caret — จุดเริ่มงานเมื่อเข้าสู่ implementation

**ยังไม่เริ่มโค้ดตามคำขอผู้ใช้** Backlog นี้เป็นลิงก์เข้าสู่แผนอนาคต ไม่ใช่คำสั่งให้รันงานต่อ

1. M0: ปิด reference/build/visual measurement gates และเลือกรุ่น OSS ที่จะ pin
2. F01/F02/F03: พิสูจน์ Code - OSS build, Paseo boundary และสาม provider paths โดยใช้ fixture จำกัดขอบเขต
3. F04: พิสูจน์ความปลอดภัยของ unsaved editor buffers ก่อนให้ agent แก้ workspace จริง
4. F05/F06/F07: วัด completion/next edit และ native protocol/visual fidelity
5. เดิน M1–M11 ตาม dependency และ exit gates; F08/F09 อยู่ก่อน cloud handoff/SCM sync ขนาดใหญ่

รายละเอียด hypothesis/evidence/fallback ของ F01–F09 และ tests Q01–Q11 อยู่ใน [roadmap](ROADMAP-AND-ACCEPTANCE.th.md) Requirements ที่ตรวจรับอยู่ใน [parity matrix](PARITY-MATRIX.th.md) ทุกข้อยัง planned ไม่ใช่ implemented หรือ verified
