# Caret — ทางเชื่อม Codex, OpenCode Go และ OpenRouter

ตรวจ 9 กันยายน 2026 · planning only · ยังไม่ทดสอบ inference, quota หรือสิทธิ์บัญชีจริง

## เส้นทางที่เลือก

| บัญชีของผู้ใช้ | เส้นทางหลักใน Caret | ขอบเขตและสิ่งที่ต้องพิสูจน์ |
|---|---|---|
| Codex | Caret → adapted Paseo → Codex app-server → official ChatGPT login | ใช้ rich-client protocol สำหรับ threads/events/approvals; ต้องตรวจ schema ของ revision และ entitlement จริง |
| OpenCode Go | Caret → adapted Paseo → OpenCode server → Go provider | ใช้ coding-agent workload ตามบริการ; ตรวจ auth, model protocol และ client/session identity |
| OpenRouter | Caret → adapted Paseo → OpenCode server → OpenRouter | ใช้ API key และ capabilities ของแต่ละโมเดล; เครดิตและราคาแยกจากสมาชิก Codex/Go |

[Codex app-server](https://learn.chatgpt.com/docs/app-server) ออกแบบสำหรับ client integration และ [authentication](https://learn.chatgpt.com/docs/auth) รองรับ ChatGPT login; [OpenCode server](https://opencode.ai/docs/server/) ให้ API สำหรับ client; [Go docs](https://opencode.ai/docs/go/) อธิบายการใช้กับ coding agents; [OpenRouter quickstart](https://openrouter.ai/docs/quickstart) ระบุ API-key access

Paseo ดูแล orchestration/transport โดย engine ของแต่ละ run เป็นเจ้าของ tool loop แผนใหม่นี้แทนข้อเสนอเดิมที่ทดลอง route Go ผ่าน Codex adapter ก่อน: การใช้ OpenCode engine ที่รองรับ providers อยู่แล้วลดความเสี่ยง protocol mismatch แต่ยังต้องผ่าน spike F02/F03 ไม่อ้างว่าได้รับประกัน parity จาก upstream

## Auth และ client identity

- ให้ official engine จัดการ login/credential storage; Caret แสดงสถานะ login/logout/expired/permission/limit โดยไม่ดึง subscription token ไปใช้กับ endpoint ที่เดาเอง
- Go อนุญาต external coding clients โดยมีข้อกำหนด user-agent และ stable `x-opencode-session` หาก Caret ต่อ API โดยตรงให้ใช้ identity ของ Caret และรักษา session ตาม docs; กรณีผ่าน OpenCode ให้ตรวจว่า engine ส่งข้อมูลตามบริการกำหนด ไม่ปลอมชื่อ client
- Provider credentials อยู่บน execution host; mobile ใช้ device identity ที่จับคู่ไว้ Cloud host ต้อง setup access ที่รองรับแยก ไม่ copy secrets ขึ้น cloud โดยอัตโนมัติ
- เมื่อ quota หมดไม่เปลี่ยนไปเส้นทางเสียเงินเอง; แสดง provider/model/usage/error และให้เลือก policy ล่วงหน้าอย่างชัดเจน

## Capability matrix ของ integration

| Capability | แผน |
|---|---|
| Streaming/tool calls/approval | map เป็น Caret events พร้อม engine-native ID และ sequence; conformance tests ราย engine |
| Cancel/steer/resume/compaction | capability discovery; ไม่จำลองปุ่มที่ engine ไม่รองรับว่าใช้งานได้ |
| Model/reasoning/context/image input | แสดงตาม provider/engine version และ model จริง; ไม่ hardcode ว่าทุกตัวรองรับเท่ากัน |
| FIM/Tab/next edit | แยก completion adapter และ quality gate; coding-agent subscription ไม่ยืนยัน FIM latency หรือสิทธิ์ workload |
| Embeddings/semantic index | local หรือ endpoint ที่รองรับและมีสิทธิ์; มี exact-search fallback ที่ระบุชัด |
| Image generation/speech | แยกบริการ/OS/local runtime และสิทธิ์; ไม่อ้างว่ารวมอยู่ในสามบัญชี |
| Handoff ระหว่าง engines | semantic handoff พร้อม summary/worktree/artifacts; ไม่อ้างว่าเปลี่ยน native session formats ได้ losslessly |

Direct provider adapters เป็น fallback เฉพาะเมื่อ engines ขาด capability ที่พิสูจน์แล้ว ไม่เพิ่ม Caret tool loop อีกชุดโดยไม่มีเหตุผล Provider unavailable ต้องเป็นสถานะจริงไม่ใช้ mock answer ปิด acceptance

## หลักฐาน local และสิ่งที่ยังไม่ทำ

การตรวจ PATH ก่อนหน้านี้พบ Codex CLI และ help มี app-server/exec; ไม่พบ OpenCode ใน PATH ที่ตรวจ การตรวจนี้ไม่ยืนยันว่าบัญชี login หรือมี quota และไม่ยืนยันว่าไม่มีโปรแกรมอยู่นอก PATH ไม่ได้อ่าน credential files เริ่ม login หรือลองส่ง prompt

เมื่อผู้ใช้เริ่ม implementation ภายหลัง F03 ต้องทดสอบ schema initialization, fixture tool call, streaming/cancel/resume, approvals, rate limit/error, secret redaction และ session identity ทีละเส้นทาง บันทึก model/engine revision/cost พร้อมผล ไม่ต้องส่ง key ในบทสนทนา

รายละเอียด topology อยู่ใน [architecture](ARCHITECTURE.th.md); ความเสี่ยง G-AUTH-01/G-MODEL-01/G-TAB-01 อยู่ใน [decision map](GAPS-AND-DECISIONS.th.md)
