<a id="scrutinize-v4"></a>

## K. ผล scrutinize หลังเขียน handoff ฉบับละเอียด

ตรวจ 9 กันยายน 2026 โดยผู้เขียนแผนทบทวนอีก pass ตาม scrutinize → code-review ไม่ใช่ independent subagent review Comparison base คือแผนฉบับ 3 ในบทสนทนานี้ เทียบกับความต้องการผู้ใช้และ primary docs/help ที่อ่าน; repository เป็นเอกสาร ไม่มี runtime path หรือ code diff ให้ทดสอบจริง

### Spec findings ที่พบและแก้ในเอกสาร

| Severity / location ในแผนรวม | หลักฐานและผลกระทบ | การแก้ / สถานะ |
|---|---|---|
| P1 — J1, J2 PX-01…09 | 148 docs ไม่รวม help; side-chat/fork/share/search UX ขาดรายละเอียด ส่งต่อแล้วมีโอกาสทำเป็นแชตทั่วไป | เพิ่ม 95 help + linked docs 18, PX และ UI families; แก้ executive count; resolved-document |
| P1 — J2 PX-11/12, J6 | authority ordering ทั่วไปไม่แทน permissions/sandbox/CLI field merge; implementation อาจให้สิทธิ์ผิด | ระบุ per-schema mapping, empty-vs-missing, locked UI และ independent fixtures; resolved-document |
| P1 — J2 PX-23/24, J6 | asynchronous desktop question กับ blocking ACP request ถ้าใช้ handler เดียวอาจ deadlock/เดินงานโดยไม่มี approval | แยก blocking request/notification/async interaction และ cancel waiter; resolved-document |
| P1 — J2 PX-30 | generic reviewer routing ไม่พอสำหรับ PR ที่แก้นโยบายอนุมัติตัวเอง | exact policy discovery, specificity, base-branch policy, pending-review gate; resolved-document |
| P1 — J2 PX-39, J3 B05/B06, J9 | Android PWA ของ coding app ไม่ครอบ native bot Android ที่ docs help ระบุ | เพิ่ม late native bot target และ Kotlin/Compose route; แยกผลิตภัณฑ์อ้างอิง; resolved-document |
| P2 — J6 | shortcut docs มี rollout/surface conflict; ทำ keyboard union แล้วชน Cmd/Ctrl+K/Return | บังคับ version/surface command map และ runtime conflict gate; resolved-document ไม่ใช่ resolved-reference |

### Standards findings ที่พบและแก้ในเอกสาร

| Severity / location | ความเสี่ยง | การแก้ / สถานะ |
|---|---|---|
| P1 — J4/J5 | backend facade อาจเห็น tool หลังเกิดผลข้างเคียง จึง enforce approval/dirty-buffer contract ไม่ได้ | required pre-execution control test, isolated executor fallback, no false capability support; resolved-document |
| P2 — J7/J8 | เพิ่ม engines/daemon/index/shared stores ซ้ำโดยไม่มีเจ้าของ อาจสร้าง maintenance cost มากกว่าที่ประหยัด | one owner per session/store, typed small boundary, direct-adapter fallback, no speculative vector service; resolved-document |
| P2 — executive section / A–K | เพิ่มข้อกำหนดแต่ยังใช้ 158/57 เป็น release denominator ทำให้ปิด milestone ก่อนครบ | executive/acceptance ใช้ 198/75; ส่วน A/B ระบุ baseline เดิม และ J เพิ่มจำนวน; resolved-document |

### Readiness findings ที่ยังเปิด — ห้ามรับรอง 1:1 แล้ว

1. **P1 — UI reference evidence ยังไม่ครบ**: visual token ledger ในส่วน B ยัง UNMEASURED ถ้าเริ่ม pixel-level implementation ทันที ผู้ลงมือต้องเดา font/spacing/state behavior วิธีปิดคือ H01 capture/catalog/measurement ของแต่ละ surface ก่อน freeze UI ผล: พร้อมเริ่ม reference work และ foundation; ยังไม่พร้อมรับรอง final pixel design
2. **P1 — schema/operation coverage ยังไม่ verified ราย field**: J6/J10 เป็น handoff contract และ source routing; inventory 261 URL ไม่ได้พิสูจน์ว่า API/config ทุก field ถูก port แล้ว ผู้รับ H03/H08/H14/H15 ต้องสร้าง per-operation/field fixtures จาก source ที่ pin และปิด child cases ก่อน parent acceptance ห้ามใช้จำนวน requirements เป็นหลักฐานว่า public API clone เสร็จ
3. **P1 — engine internals และ comparative quality ไม่มีหลักฐาน 1:1**: เอกสารไม่ได้เปิดเผย private prompts/tool schemas/router/weights ครบ การใช้ Codex/OpenCode/Paseo เป็น replacement architecture ต้องผ่าน behavior/control-path/quality tests และคง internal-identity limitation ตาม J1 ไม่เปลี่ยนคำว่า equivalent เป็น identical โดยไม่มีหลักฐาน

### ข้อสรุปการตรวจ

แผนแก้ material omissions ที่พบในรอบตรวจแล้ว และแบ่งงานให้ดำเนินต่อได้ละเอียดขึ้น แต่ยัง **ไม่ผ่านสถานะ fully specified/verified 1:1 ทุก UI state, API field และ engine internals** ข้อเปิดข้างบนมีงาน เจ้าของ dependency และวิธีตรวจรับชัด การรับรองว่า “docs ครบทั้งหมดแบบไม่มีช่องว่าง” ตอนนี้ยังไม่รองรับด้วยหลักฐาน

การตรวจเอกสาร: original parent IDs 158 + supplementary PX 40 = 198 ไม่ซ้ำ; screen family IDs 57 + 18 = 75 ไม่ซ้ำ; tool contracts 29; work packets 16; retrieved source URLs 261; internal anchors/local links ผ่านการตรวจ โค้ดแอป build/inference/application tests ยังไม่มีตามคำขอ planning-only

<a id="scrutinize-v5"></a>

## K2. ผล scrutinize รอบ L8 + single-harness (9 กันยายน 2026)

Comparison base คือแผนก่อนเพิ่ม L8 เทียบกับคำขอผู้ใช้สามข้อ (harness ตอนนี้หรือทีหลัง, พัฒนาตัวไหนให้เก่ง+ครบ, owned harness ตัวเดียวหรือไม่) และ evidence gates เดิมใน K ตรวจแบบ read-only จาก source ที่ pin revision `59db80a` ไม่มีการ run/build/inference

### Spec findings ที่พบและแก้ในเอกสาร

| Severity / location | หลักฐานและผลกระทบ | การแก้ / สถานะ |
|---|---|---|
| P1 — L8 (SYNARA + PLAN) | L8 ร่างแรกเรียกทุก engine ว่า harness ขัดกับ decision harness ตัวเดียวที่ผู้ใช้ยืนยัน ปล่อยไว้จะแตก permission/approval/event-journal เป็นหลายเจ้าของ | เปลี่ยนภาษาเป็น engine drivers ใต้ harness ตัวเดียว เพิ่ม L8.6 เป็น decision ถาวร อัปเดต pointer ในแผนรวม; resolved-document |
| P2 — L8.3 | ร่างแรกเรียงคิว build 5 ตัว (Codex ก่อน) ไม่ตรงกรอบ owned harness ที่เอาความกว้างก่อน | สลับเป็น OpenCode driver ก่อน (coverage) แล้ว Codex driver (loop reference) ส่วน Pi/OMP เป็น deferred ไม่ใช่คิวงาน บันทึกเหตุผลที่เปลี่ยนไว้ใน L8.3; resolved-document |

### Standards findings ที่พบและแก้ในเอกสาร

| Severity / location | ความเสี่ยง | การแก้ / สถานะ |
|---|---|---|
| P3 — L8.2 แถว OMP | verdict แอบสรุปว่า OMP เป็น generic OpenAI-compatible ทั้งที่ผู้ใช้ยังไม่ยืนยัน | เปลี่ยนเป็น placeholder (deferred) คงคำถามไว้ใน L8.4; resolved-document |
| P3 — L8.2/L8.3 แถว DeepSeek | อ้างว่าคลุม DeepSeek ผ่าน config เดียวโดยไม่มี source ชี้ entry ตรง | แยกหลักฐานที่ verified (OpenCode ต่อได้หลาย provider ผ่าน config ตาม opencode.mdx; OpenRouter/Go ตาม PROVIDER-CONNECTIVITY) ออกจากส่วนที่ต้อง spike (DeepSeek entry + eval); resolved-document |

### หลักฐานที่ verify ผ่านในรอบนี้

CodexAdapter 2,507 / OpenCodeAdapter 4,585 บรรทัดตรงกับที่ L3 อ้าง (`wc -l` บน snapshot), event kinds `session|notification|request|error` และ ops `startSession/sendTurn/interruptTurn/compactThread/forkThread/respondToRequest/respondToUserInput/startReview` มีจริงใน `packages/contracts/src/provider.ts`, buffer cap 2,048 มีจริงใน `ProviderAdapter.ts`, gateway set 9 providers รวม `codex/opencode/pi` มีจริงใน `harnessPolicy.ts`, `options.reasoningEffort` (Codex) vs `options.effort` (Claude) มีจริงใน policy เดียวกัน, ตาราง steer (Codex Yes / OpenCode No / Pi Yes) ตรงกับ providers index, OMP ไม่ใช่สมาชิก `ProviderKind` (มี 9 ตัว) ตรวจจาก `orchestration.ts`

### ข้อสรุปการตรวจรอบนี้

คำถาม L8.4 ปิดแล้วด้วยการตรวจ 10 ก.ย. 2026 (OMP = `can1357/oh-my-pi` Pi-fork IDE-wired; DeepSeek Creator = โมเดลผ่าน OpenCode provider `deepseek`/OpenRouter ไม่ใช่ harness แยก; Pi รองรับทั้ง `/login` และ API key/env; Go ตรงใช้ `x-opencode-session` + user-agent) ผ่าน GitHub API + README ต้นน้ำ ข้อเปิดที่เหลือคือ spikes ใน L8.5 ซึ่งมีเจ้าของและวิธีปิดชัด ยังคงสถานะ planning-only: ไม่เริ่มโค้ด ไม่มี build/inference และไม่รับรอง 1:1 ใดๆ เพิ่มจาก K
