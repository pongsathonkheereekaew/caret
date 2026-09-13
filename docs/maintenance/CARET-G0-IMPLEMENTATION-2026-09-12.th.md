# Caret G0 — implementation status

Branch: `caret/g0-omp-foundation` จาก control main `a87d9b29ac9e60f5847540d7e6bddbdbfa8ddb49`.
สถานะ: G0 foundation slice implemented และ verified ตามขอบเขตด้านล่าง;
ยังไม่ใช่ full OMP conformance, UI integration หรือ release certification

งานต่อจาก snapshot นี้อยู่ที่ [G1 UI/host side channels](CARET-G1-IMPLEMENTATION-2026-09-12.th.md).
Receipts ด้านล่างอ้าง source hashes ของรอบ G0; ผลของ source ปัจจุบันดู evidence รอบ G1

## Scope รอบนี้

สร้าง OMP RPC-UI adapter ที่ใช้จาก Node host ได้, exact command-name inventory,
protocol v2/framing/correlation, explicit side-channel replies และ bounded process
lifecycle. OMP เป็นเจ้าของ agent loop/transcript; adapter ไม่เป็น durable host,
ไม่ retry side effects และไม่ตัดสิน approval ให้อัตโนมัติ

Mac build spike ใช้ retained Caret Code-OSS pin ใน detached checkout `desktop/`.
Root package/dependencies ของ adapter แยกจาก desktop toolchain. การแก้ UI ตาม
Codex, full OMP conformance, durable remote host และ iPhone ยังอยู่ gates ถัดไป

## Source/provenance

- [`upstream-lock.json`](../../upstream-lock.json) ระบุ OMP 18.1.18 และ Caret-native SHA
- [`docs/upstream-notices`](../upstream-notices) เก็บต้นฉบับ license notices
- [ทิศทางล่าสุด](CARET-IMPLEMENTATION-DIRECTION-2026-09-12.th.md) มีผลเหนือ driver/backend/UI choices เก่า
- Requirement graph เดิม 198 parents/75 families เก็บสถานะเดิม; fixtures ใหม่ไม่ยกสถานะ parents อัตโนมัติ

## Verification contract

1. Fake subprocess tests: startup/negotiation, chunk reassembly/limits, correlated ACK,
   late events/errors, timeout/exit, side-channel UI replies และ bounded shutdown
2. Real OMP smoke: binary version/hash, isolated config/cwd, effective tools/history,
   queue readback, trusted local extension UI confirm deny/allow และ zero model turns
3. Typecheck และ existing repository validator
4. Mac build: exact toolchain/install/compile results พร้อมแยก extension compile,
   editor compile, Electron bootstrap, runtime launch และ packaging ที่ยังไม่ได้ทดสอบ
5. Independent Astra code review และแก้ findings ก่อนสรุปผล

Real smoke ส่ง `/caret-g0-ui` ผ่าน RPC prompt หลังตรวจว่าเป็น registered local
fixture command แล้วเท่านั้น และรอ `prompt_result` ที่ผูก ID; ACK ไม่ใช่ completion.
Fixture confirm เขียน marker เฉพาะ temporary directory เมื่อ allow; เป็นการพิสูจน์
UI roundtrip ไม่ใช่การรับรอง OMP tool-policy interception หรือ dirty-buffer safety

## Reproduce

จาก implementation checkout:

```sh
bun install --frozen-lockfile
bun run typecheck
bun test packages/omp-adapter
bun run smoke:omp
node scripts/ci-validate.mjs
```

ใช้ `CARET_OMP_BINARY` ระบุ binary ถ้าไม่อยู่ใน PATH และ `CARET_SMOKE_RECEIPT`
ระบุไฟล์ JSON receipt. Smoke ไม่รับ model credentials จาก environment ของผู้ใช้
และล้าง temporary config/marker เมื่อจบ. Source pin กับ binary version/hash เป็น
หลักฐานแยกกัน ไม่ใช่ reproducible-build attestation

## Results

Mac baseline `compile-client`, explicit Caret extension compile และ Electron arm64
bootstrap ผ่าน; ดู [build evidence](evidence/mac-build-2026-09-12/README.md).
Development process boot ตรวจจาก logs ด้วย isolated profile; ยังไม่ตรวจ UI ด้วยภาพ,
ไม่ได้เชื่อม OMP adapter เข้า editor และยังไม่ทำ signing/distribution package

Adapter real-runtime smoke ผ่านทั้ง Bun และ Node; ผลสุดท้ายพร้อม code hashes อยู่ใน
[Node receipt](evidence/g0-omp-2026-09-12/node-smoke.json),
[Bun receipt](evidence/g0-omp-2026-09-12/bun-smoke.json) และ
[test results](evidence/g0-omp-2026-09-12/test-results.txt).
ผลสุดท้าย: **18 tests / 48 assertions / 0 failures** ทั้ง fixture ที่รันด้วย Bun
และ Node 24.18.0. Typecheck และ control-repo validator ผ่าน
(`parents=198 ui=75 children=129 lock-shas=10`). Smoke บน host Bun 1.4.2 และ
Node 24.18.0 ผ่านกับ OMP 18.1.18 โดยไม่เรียกโมเดล

Independent Astra review พบและแก้ครบ 4 ประเด็น: expired queued writes,
startup ที่กลับเป็น ready หลัง protocol failure, shutdown ที่ต้องยืนยันการ reap,
และ final stdout ACK/events ที่ต้อง drain หลัง process exit. เพิ่ม regressions
สำหรับแต่ละกรณี; final review ไม่พบ material findings ค้างในขอบเขตที่ตรวจ

Source ใน `desktop/` ยังตรง pinned commit และสะอาด. โค้ดใหม่/เอกสารอยู่บน
implementation branch โดยยังไม่ได้ commit/push. ไม่เปลี่ยน Aetheria/Cedia และ
ไม่ยกสถานะ 198 parents/75 families จากผล fixture ชุดนี้

## ขอบเขต API และงานต่อ

- API เริ่มด้วย `OmpRpcClient.start`, ส่ง canonical RPC commands ผ่าน `request`,
  รับทุก logical frame ผ่าน `onFrame` และตอบ UI/host side channels ผ่าน `send`.
  `request` คืน ACK; ต้องรอ terminal event ตาม command semantics เอง
- Timeout ที่ยังไม่ส่งจะมี `outcome: not-dispatched` และถูกตัดออกจาก write queue;
  ถ้าเริ่มเขียนเข้า pipe แล้วเป็น `unknown` และไม่ retry อัตโนมัติ
- `close` ปิด stdin, รอ exit แล้ว TERM/KILL ตาม deadline; ยืนยัน process exit และ
  drain stdout แบบ bounded. รายงาน failure หาก reaping/output-drain ไม่สำเร็จ
- เมื่อส่ง `env` ให้ client จะใช้ชุดนั้นแทน ambient environment. ถ้าไม่ส่ง env
  จะ inherit ตาม Node spawn conventions; production host ต้องกำหนด policy เอง
- Startup ตรวจ ready/framing/protocol v2. Smoke ตรวจ binary 18.1.18/hash เพิ่ม;
  ยังไม่ใช่ host installer ที่จัดการและรับรอง runtime ทุก version
- Incoming physical frames จำกัด 1 MiB, v2 logical reassembly 64 MiB.
  Outgoing frames เกิน 1 MiB ถูก reject; outbound chunking/artifact transfer เป็น
  gap ของ G1/G2 ไม่ได้อ้างว่ารองรับ image payload ใหญ่ครบแล้ว
- การปิด process ใน G0 รับรองเฉพาะ child ที่ adapter ถืออยู่; descendant jobs,
  durable ownership/recovery และ exactly-once application intent ต้องทำใน G2

งานต่อคือ G1 tool-policy/dirty-buffer enforcement fixtures, full extension UI/host
URI/tool invocation, PTY solution และ capability conformance ตาม coverage matrix.
UI ตาม Codex, editor hookup, durable host และ real iPhone ต้องผ่าน gates ของตนเอง;
ไม่เลื่อนสถานะเป็น full OMP หรือ clone-verified จาก transport tests
