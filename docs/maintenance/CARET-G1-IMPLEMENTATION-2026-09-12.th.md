# Caret G1 — UI และ host side channels

ต่อจาก [G0 foundation](CARET-G0-IMPLEMENTATION-2026-09-12.th.md) บน branch
`caret/g0-omp-foundation`. รอบนี้เพิ่มส่วนของ O13/O17 ตาม
[coverage matrix](CARET-OMP-COVERAGE-2026-09-12.th.md); ยังไม่ปิด G1 ทั้ง gate

สถานะ: implementation และ verification ของ bounded slice รอบนี้เสร็จแล้ว;
ยังไม่ได้ commit/push

## ขอบเขต

- `packages/omp-adapter/src/ui.ts`: `ExtensionUiBroker` รับ select/confirm/input/editor,
  ส่งคำตอบตามชนิดจริง, ตรวจ select membership, จัดการ server cancel/timeout และ
  token ต่อ incarnation. Notify/status/widget/title/composer/open URL ส่งเป็น
  presentation events ให้ UI; ไม่เปิด URL หรืออนุมัติ mutation เอง
- `packages/omp-adapter/src/host.ts`: `OmpHostDispatcher` ที่ต้อง register
  handler และ authorize ก่อนเรียก. ส่ง update/result, deny/error, abort และ
  ไม่ replay request ID หรือส่งผลลัพธ์ที่มาช้าหลัง cancel
- OMP ยังเป็นเจ้าของ agent loop/transcript. Broker เป็น live projection สำหรับ
  host instance เดียว; ไม่ใช่ durable session service หรือ device authorization

## การเชื่อมต่อ

สร้าง brokers ต่อ OMP process incarnation; ส่ง UI frames เข้า `ui.ingest` และ
host_tool/host_uri frames เข้า `host.handle` จาก `onFrame`, ต่อ `send` ไปยัง
`client.send`. Register host handlers แล้วรอ ACK ของ
`set_host_tools`/`set_host_uri_schemes` ก่อนเปิดให้ส่ง prompt. Host ต้อง dispose
brokers เมื่อ process จบ, disconnect หรือเปลี่ยน incarnation; UI token เก่า
ไม่ใช้ตอบ request ใหม่

Authorization callback ต้องผูกนโยบายกับ request ที่ให้มาและ `AbortSignal`.
Production ยังต้องผูก device/session/policy version, ตรวจ argument schema ของ
tool และ editor version/hash ที่จุดก่อน effect. การยกเลิก handler เป็น cooperative:
handler ต้องตรวจ signal ก่อน effect และไม่อ้างว่าย้อนสิ่งที่เกิดไปแล้วได้

Response ที่ส่งให้ injected writer ไปแล้วถอนคืนไม่ได้; transport ต้องกำหนด
deadline/cancellation ของ write queue เอง. Broker ป้องกันคำตอบ stale ก่อน dispatch
และไม่ retry หลัง send failure แต่ไม่อ้าง delivery acknowledgement จาก OMP

UI เก็บ diagnostic ล่าสุดไม่เกิน 100 รายการและ seen request IDs ไม่เกิน 10,000
ต่อ incarnation; host ID ledger มี default 4,096. เมื่อเต็มต้องจัดการ capacity
อย่างชัดเจน ไม่ลืม ID เก่าเพื่อยอม replay และไม่ reset ledger ขณะใช้ process เดิม
เพื่อหลบขีดจำกัด. Durable history/rotation เป็นงาน G2

`extension_ui_request.confirm` เป็น generic UI request ไม่ใช่ structured tool
approval. ห้ามนำข้อความ title/message ไปถือว่าเป็นหลักฐาน tool/effective args
ที่ผู้ใช้อนุมัติแล้ว. Host authorization รอบนี้ครอบคลุม handlers ที่ลงทะเบียน
ผ่าน dispatcher เท่านั้น ไม่ครอบคลุม native bash/eval/LSP/browser หรือ OS sandbox

## Verification

จาก `/Users/pond/caret/source`:

```sh
bun test packages/omp-adapter
bun run typecheck
bun run smoke:omp:ui
bun run smoke:omp:g1
node scripts/ci-validate.mjs
```

- UI smoke ใช้ trusted local slash command กับ OMP 18.1.18 จริง ไม่มี model turn.
  ตรวจ deny/allow, select/input/editor, cancel/timeout, presentation และ clear.
  `open_url` ตรวจด้วย unit fixture; ไม่เปิด browser/login flow จริง
- Host smoke เปิด HTTP server เฉพาะ `127.0.0.1` และให้ scripted SSE completions.
  OMP ทำ agent/tool turns จริง แต่ไม่มี external model inference หรือ model fee.
  ตรวจ host tool deny/allow/update/result, URI read/write deny/allow ผ่าน native
  read/write tool, `tool_call` hook ที่บล็อกการเขียน temporary fixture path และ
  RPC abort ที่ส่ง host_tool_cancel ไปถึง handler ก่อน effect
- ทั้งสองแยก config/cwd/credentials ใน temporary directory และ cleanup เมื่อจบ.
  Receipt บันทึก binary version/hash กับ implementation source hashes

Independent Astra review ของ UI/host ไม่พบ material findings ค้างหลังแก้
expiry ที่ timer callback ยังไม่ทำงาน, malformed duplicate ID, cancellation/
disposal ระหว่างรอ output และ output queue ที่ต้องมี deadline รวม. Reviewer
รันชุดเฉพาะ G1 ได้ **27 tests / 115 assertions / 0 failures**. Snapshot ของ
authorization และ queued results ไม่เปลี่ยนตาม input object ของ caller

หลักฐาน runtime และผลชุดรวมอยู่ใน
[`evidence/g1-omp-2026-09-12`](evidence/g1-omp-2026-09-12/README.md)

ผลสุดท้าย: **45 tests / 163 assertions / 0 failures** บน Bun 1.4.2 และเมื่อใช้
Node 24.18.0 เป็น fixture subprocess ใน transport tests. ชุด unit test เองรัน
ด้วย Bun; real UI/host smoke รัน adapter ด้วยทั้ง Bun และ Node 24 จริง.
Typecheck และ repository validator ผ่าน (`parents=198 ui=75 children=129 lock-shas=10`).
UI smoke มี 11 checks ต่อ runtime; host smoke มี 10 checks ต่อ runtime จาก
7 scripted runs / 13 loopback completion requests. Original G0 smoke ผ่าน 8 checks
และ receipts ทั้งห้าไฟล์มี source hashes ตรงกับโค้ดสุดท้าย

## ข้อจำกัดที่ต้องทำต่อ

1. Dirty-buffer fixture เป็น path ที่ hook บล็อกไว้ ไม่ใช่ Code-OSS buffer registry.
   OMP RPC URI response ไม่มี expected version/hash; ต้องเพิ่ม host contract และ
   ตรวจ conflict ที่จุดเขียนจริงก่อนเชื่อม editor
2. Tool policy ของ native tools, eval nested effects และ direct bash มีเส้นทางต่างกัน;
   ต้องตรวจครอบคลุมแยก ไม่ถือว่า host dispatcher ปิดเรื่องนี้แล้ว
3. Custom TUI components/footer/header, synchronous editor queries และ PTY ยังมี
   RPC gaps ตาม pinned source; ต้อง bridge/patch/SDK ตาม capability จริง
4. Dynamic registry replacement/MCP/config/lifecycle, all 42 command conformance,
   durable host, Mac UI และ iPhone/relay ยังไม่ผ่าน gates ของตนเอง
5. การส่ง response ผ่าน pipe สำเร็จไม่ใช่ OMP completion receipt; ไม่มี auto retry
   และ dedup memory ของ broker ไม่แทน durable command journal ของ G2

## Source references

อ้าง source pin `00085d4e7dfdcfbf302c122fa2682b410a0f43d1` ใน
[`upstream-lock.json`](../../upstream-lock.json):

- `packages/coding-agent/src/modes/rpc/rpc-types.ts`: UI/host request-response shapes
- `modes/rpc/rpc-mode.ts`: requestRpcDialog, UI unsupported methods, set_host_* dispatch
- `modes/rpc/host-tools.ts`, `host-uris.ts`: update/result/cancel semantics
- `session/session-tools.ts`: refreshRpcHostTools และ extension wrapper
- `extensibility/extensions/types.ts`, `runner.ts`: same-tool invokeTool และ pre-effect tool_call hook

Source paths หลังรายการแรกอยู่ใต้ `packages/coding-agent/src/` ของ OMP.
ไม่เปลี่ยน desktop pin, Aetheria/Cedia หรือสถานะ historical requirement graph
