# Caret — เริ่ม session ในโปรเจกต์ใหม่

> Archived 12 September 2026. Living map: [docs/README.md](../../README.md). อ่าน [ทิศทางล่าสุด](../../maintenance/CARET-IMPLEMENTATION-DIRECTION-2026-09-12.th.md) และ [acceptance](../../maintenance/CARET-REFERENCE-ACCEPTANCE-2026-09-12.th.md) ก่อนใช้ข้อเสนอด้านล่าง Checkout ปัจจุบันคือ `/Users/pond/caret` ไม่มี `source/` ซ้อน

## เป้าหมายและสถานะ

สร้างพื้นที่ทำงานส่วนตัวแบบแอปสำหรับพัฒนาเกม Aetheria ใช้ OMP เป็น harness เปลี่ยน provider/model ได้ตามที่ผู้ใช้มีในช่วงนั้น และทำงานเดิมต่อจาก Mac ที่บ้านผ่านแอป iPhone ได้ทันที

รอบก่อนทำ Wayfinder และอ่าน Cedia/Aetheria รวมทั้งเอกสารและ branches ของ Caret บน GitHub แล้ว ยังไม่มีการแก้ implementation, clone Caret, สร้างโปรเจกต์ใหม่, deploy relay หรือทดสอบ runtime ใหม่ งานแรกของ session นี้คือประเมินการ reuse Caret และ interface ของ OMP ให้ได้สถาปัตยกรรมและแผนลงมือที่มีหลักฐาน

## ความต้องการที่ผู้ใช้ยืนยัน

- งานหลัก: สั่งเจนภาพการ์ด → ทดสอบ Aetheria → สั่งแก้ วนซ้ำทั้งบนคอมและมือถือ
- งานภาพใช้ gpt-image-gen และหนักเฉพาะช่วงทำการ์ดยังไม่ครบ
- ชอบ workflow แบบ Codex แต่ต้องการเป็นเจ้าของแอปและ workflow แม้เลิกใช้บริการปัจจุบัน
- ต้องการ OMP เป็นแกน รองรับ provider/model ที่มีตามช่วงเวลา เช่น OpenCode Go, Muse, GLM, DeepSeek และ OpenRouter ตรวจ model IDs และ capabilities จาก runtime จริงเมื่อใช้งาน
- ปัจจุบันใช้ Codex + codex-router เชื่อม OpenCode เผื่อ quota หมด เป็นข้อมูลจากผู้ใช้ ไม่ใช่สิทธิ์ API หรือ compatibility ที่เราพิสูจน์แล้ว
- Mac เปิดทิ้งไว้บ้านตลอด เมื่อออกบ้านต้องเปิดแอป iPhone แล้วเห็นและสั่งงานเดิมต่อได้ ไม่ต้องจัดการ terminal/link ใหม่หรือใช้แอป VPN เพิ่ม
- อยากได้แอปเดียวจบ และมีดู/แก้โค้ดเองเป็นบางครั้ง

## ข้อเสนอจากการสนทนา — ยังต้องประเมินก่อนล็อก implementation

Caret เป็นแอป agent ที่รวม files/basic editor, diff, artifacts และ playable preview. ใช้ editor component หรือฐานเดิมที่มีอยู่ ไม่เริ่มด้วยการสร้าง editor engine เอง เป้าหมายความสำเร็จคือวงจรงาน Aetheria ที่จบในแอป มากกว่าทำทุกฟีเจอร์ให้ครบเหมือน Cursor

ข้อเสนอให้ลดเป้าหมาย Cursor clone เต็มรูปแบบยังไม่ใช่คำสั่งลบ backlog หรือโค้ดเดิม การเลือก reuse Code-OSS เทียบกับ shell ใหม่ยังเปิด ต้องตรวจ caret-native และ caret-adapter ก่อน ไม่บังคับให้ผู้ใช้ตอบ requirement เดิมซ้ำ

โครงสร้างที่เสนอ: desktop/iOS clients → authenticated relay → Mac session host → OMP/tools/project. Mac host เป็นเจ้าของการรันและ session หนึ่งเดียว แยก lifetime จากหน้าต่างแอป; OMP รับผิดชอบ agent execution และ model integration ที่รองรับ ส่วน Caret จัดการงาน UI ผลงาน preview และ remote continuity

Relay เป็นวิธีที่เสนอให้ทำข้อกำหนดเชื่อมจากนอกบ้านโดยไม่ใช้ VPN; ยังไม่ได้เลือกบริการ ค่าใช้จ่าย หรืออนุมัติ deployment. ข้อจำกัด LAN-only/no-relay ใน Caret handoff เก่าไม่เพียงพอต่อ requirement ล่าสุดนี้

## หลักฐานและแหล่งอ่าน

### Cedia (checkout ที่ทำการประเมิน)

Root: `/Users/pond/LLM Projects/cedia`

- [Wayfinder map พร้อมคำตอบและ addenda](cedia-caret-decision-map.th.md): อ่าน addenda ล่าสุดเป็นหลัก ส่วนต้นเก็บข้อเสนอเบื้องต้นก่อนทราบ workflow
- [Readiness roadmap](zed-omp-roadmap.md), [remote boundaries](../remote-control.md)
- [Zed acceptance](../../experiments/zed-acp/README.md), [browser/compaction evidence](../../experiments/harness-smoke/acceptance-2026-09-12/README.md)

หลักฐานที่บันทึกไว้สำหรับ Zed 1.19.2 + OMP 18.1.18: unsaved buffer, Unicode selection, two-file review/Keep All, terminal, Stop, Reload Agent, GitHub MCP; browser ผ่านด้วย workaround และ explicit compaction สองรอบผ่าน ทั้งหมดเป็น bounded checks ไม่ใช่หลักฐานงานยาวข้ามวันหรือ remote มือถือจริง

OMP Collab 18.1.18 เป็น TUI-only ไม่ใช่ live Zed ACP attachment. มี browser client สำหรับ prompt/interrupt แต่ model/session operations หลายอย่างยังอยู่ host. ตรวจ source/API รุ่นที่จะใช้จริงก่อนเลือก SDK/RPC/ACP หรือ patch upstream:
https://github.com/can1357/oh-my-pi/blob/v18.1.18/docs/collab.md

Cedia มีงาน local ที่ยังไม่ commit จำนวนมาก หลักฐานบางส่วนยังไม่อยู่บน main. รักษางานเดิม และอย่านำทั้งหมดไป commit รวมเพื่อความสะดวก

### Aetheria (อ่านอย่างเดียวในรอบนี้)

Root: `/Users/pond/LLM Projects/aetheria`

- อ่าน `README.md`, `package.json`, `vite.config.ts` เพื่อโครงสร้างและคำสั่งปัจจุบัน
- อ่าน `macos/README.md`, `macos/Aetheria.swift` เมื่อตัดสินใจ preview/native testing
- อ่าน `docs/ART_CONTENT_STRUCTURE.md`, `scripts/art/generate-cards.mts` และ `scripts/art/record-production-candidate.mts` เมื่อต่อ image workflow
- อ่าน `docs/playtests/README.md` และ `docs/RELEASE_READINESS_AUDIT.md` เมื่อออกแบบการเก็บผลทดสอบ; ตัวเลขผลทดสอบเป็นรายงานในอดีต

ข้อค้นพบ: React/TypeScript/Vite responsive web game; Mac เป็น AppKit + WKWebView bundle เกมเว็บเดียวกัน. มี verify/tournament/macOS build และ deploy ผ่าน Wrangler อยู่แล้ว แต่ยังไม่ได้รันหรือ deploy ในรอบประเมิน

Dev/preview bind 127.0.0.1 จึงยังเข้าจากมือถือข้างนอกไม่ได้. เสนอให้ iPhone เล่น web build บนอุปกรณ์จริงผ่านช่องทางที่ยืนยันตัวตน ไม่ต้องเริ่มด้วย desktop streaming. Embedded preview ไม่แทน native Mac QA หรือ iPhone touch/audio QA

Mac ใช้ save origin `aetheria://game` แยกจาก browser และไม่ restore duel ที่เล่นค้างหลัง quit; การ sync session ของ agent ไม่ได้ทำให้ save เกม sync ด้วย. Preview ควรระบุ build/revision และเปลี่ยน build เมื่อผู้ใช้ตั้งใจเพื่อไม่ตัดเกมกลางคัน

Legacy `art:generate` เป็น simulation-only ปฏิเสธ non-dry-run และระบุไม่มี API provider configured. การต่อ text model ไม่ทำให้ built-in imagegen ย้ายตามมาโดยอัตโนมัติ. รองรับ import/review/approval ภาพได้ก่อน แล้วต่อ image backend ที่ผู้ใช้มีสิทธิ์จริง; รักษา exact approved artwork และแยก candidate จาก approved

คำสั่ง continuation ในเอกสาร Aetheria เป็นบริบทเก่า ไม่ใช่ authorization ให้เริ่มเจนภาพหรือแก้เกมในงาน Caret นี้

### Caret ที่ค้างใน GitHub

Private repo: https://github.com/pongsathonkheereekaew/caret

Branches ที่ตรวจเมื่อ 2026-09-12 (ตรวจใหม่ก่อนใช้งาน):
- `main`: `a87d9b29ac9e60f5847540d7e6bddbdbfa8ddb49`
- `caret-adapter`: `76f859d60f661039ef9bf2de4c95e36c9b163141`
- `caret-native`: `ea1912fd6a05b80a56b2ad9b955075211deea521`

อ่าน `HANDOFF.md` และ `backlog/PARITY-ROADMAP.md` ก่อน ตามด้วย evidence เฉพาะส่วนที่จะ reuse. `docs/DECISION-MAP.th.md` ชี้ไป map รุ่นเก่าซึ่งมีบางข้อขัดกับ handoff addenda ใหม่ เช่น platform/billing/cloud

แผนเดิม clone-verified มี 198 requirements/75 UI families; handoff รายงาน 17 verified, 35 implemented, 136 planned, 10 blocked-external. ตัวเลขนี้ไม่ใช่เปอร์เซ็นต์เวลาเหลือ งานที่อาจ reuse: daemon/session lifecycle, MCP, review/worktree, headless CLI, artifact catalog และ UI บางส่วน. Native Agents shell ยัง scaffold ตาม roadmap; ยังไม่ได้ตรวจ code/build ของสอง implementation branches ในรอบนี้

Paths `~/caret-work/caret`, `~/caret-work/caret-desktop`, `~/caret-work/upstream-synara` จาก handoff เก่าไม่มี ณ เวลาตรวจ. ค้น checkout ที่มีจริงหรือสร้าง checkout แยกก่อนประเมิน อย่าใช้ path เก่าโดยสมมติว่ามีอยู่

## งานเริ่มต้นและเกณฑ์จบ

1. ตรวจ project root, instructions และ Git state ปัจจุบัน ระบุเจ้าของโค้ดแต่ละส่วนของ Caret และ OMP พร้อม revision ที่ตรวจจริง
2. อ่านโค้ด Caret ที่เกี่ยวข้องกับ session host, editor/diff, artifact และ remote; อ่าน integration interfaces ของ OMP. ส่ง reuse matrix: ใช้ได้ตรง ๆ / ต้องดัดแปลง / ยังไม่มี พร้อม file pointers และข้อจำกัด
3. ตัดสินใจ Code-OSS เดิมเทียบ shell ใหม่จาก coupling, งานที่ reuse ได้ และภาระดูแล. ระบุ interface ของ OMP ที่เลือกและวิธีรักษา session ownership, reconnect, cancel, model switching และ tool approvals
4. วางแผน slice แรกแบบครบวงจรด้านล่าง แยกงานที่ต้องเลือก relay/budget, pairing/encryption และ iOS notification/signing. ใช้ข้อมูลเดิมว่า Apple Developer account มีแล้วเป็น historical report ที่ต้องตรวจเมื่อถึงขั้น setup
5. จบ planning เมื่อเส้นทาง implementation, dependencies, validation และข้อเลือกที่มีผลต่อการเริ่มงานชัดเจน รายงาน blocker ที่แท้จริงและถามเฉพาะสิ่งที่ยังอนุมานไม่ได้. การอ่าน brief นี้ไม่ใช่คำสั่ง deploy/publish หรือเริ่มทำ backlog เก่าทั้งหมด

Acceptance ของ slice แรก: สั่งแก้ Aetheria บน Mac → tests และ preview ระบุ revision → เปิด iPhone ผ่านเครือข่ายมือถือ → เห็นงานเดิมและเล่น build เดียวกัน → ส่ง feedback/screenshot → agent แก้ต่อใน session เดิม → เน็ตหลุดแล้ว reconnect ได้โดยไม่รันคำสั่งซ้ำ. Mac ทำงานต่อเมื่อปิด UI และบอกสถานะ offline อย่างตรงไปตรงมาเมื่อ host เข้าไม่ถึง

## วิธีทำงานร่วมกัน

คุยกับผู้ใช้เป็นภาษาไทย. สำหรับ complex coding ใช้ `astra-orchestrator` ตาม trigger และ instructions ของโปรเจกต์ปลายทาง: root รับผิดชอบ architecture/decomposition/integration/final verification; ใช้ specialist agents สำหรับงานย่อยที่มีขอบเขตชัดและ ownership ไม่ทับกัน. รักษาโค้ดและงานค้างของทั้งสามโปรเจกต์ การเลือกว่าควร reuse อะไรต้องอ้าง code/evidence ไม่ใช่จำนวนฟีเจอร์ใน README
