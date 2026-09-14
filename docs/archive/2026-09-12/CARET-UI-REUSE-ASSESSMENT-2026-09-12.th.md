# Caret — ประเมิน UI references เพิ่มเติม

> Archived 12 September 2026 evidence. Living UI spec: [interaction](../2026-09-14-pre-ssot/CARET-UI-INTERACTION-SPEC-2026-09-13.th.md).

วันที่ตรวจ 2026-09-12. สถานะ: source assessment และแผนเลือกใช้; ยังไม่ติดตั้ง dependencies/skills, ไม่คัดลอก components/assets เข้า production และยังไม่มี runtime/visual verification ของ libraries เหล่านี้ใน Caret

## ข้อสรุป

คง Codex เป็น reference หลักด้าน workflow และ Code-OSS เป็นฐาน IDE. เลือก Emil เป็นแนวทาง motion, Rune เป็นแหล่ง SVG ที่นำมาทดลองเทียบ, Fluid เป็น interaction reference, Astryx เป็น reference ด้าน semantic tokens/component contracts และเลือก Motion Panels เป็น candidate สำหรับ spike ภายใน Mac task webview. การเลือก reference ไม่เท่ากับเลือกติดตั้งทั้ง repository

Mac ปัจจุบันใช้ framework-free DOM/CSS ใน `packages/mac-extension/src/webview.ts` มี theme mapping จาก `--vscode-*`, reduced-motion และ IME guard อยู่แล้ว. Mobile ใช้ Expo 54.0.18 / React Native 0.81.5 / React 19.1.0 ตาม `packages/mobile/package.json`. React DOM components ของ Astryx/Fluid ไม่ใช่ React Native components และการนำเข้าบน Mac ต้องเพิ่ม renderer/build integration ซึ่งยังไม่มีเหตุผลพอในงานนี้

## แหล่งและขอบเขตที่อ่าน

อ่านทั้งห้า repositories โดยตรวจ README, tree, license, manifests และ source เฉพาะ integration paths ที่เกี่ยวข้องด้านล่าง ไม่ใช่ audit ทุกไฟล์หรือทุกไอคอน. ดาวน์โหลด source ลง temporary directory เพื่ออ่านเท่านั้น ไม่รัน installer, lifecycle scripts หรือ upstream tests. SHA ต่อไปนี้เป็น research pins ไม่ใช่ dependency lock ของ Caret

| Repository | Revision ที่ตรวจ | Root license | Source ที่ใช้ตัดสิน |
|---|---|---|---|
| [Emil skills](https://github.com/emilkowalski/skills) | `d23d7f88a2e21c9e4b1418c7abe420f5c1052ba7` | MIT | README; `skills/emil-design-eng/SKILL.md`, `skills/animate-expo/SKILL.md`, `skills/review-animations/SKILL.md` ส่วนหลักที่เกี่ยวกับ adoption |
| [Rune Icons](https://github.com/Nexvyn/runeicons) | `f649e467d1bc9f272aae3f8daa329d4c924e7340` | Apache-2.0 | README; icon tree/manifest; `packages/runeicons-react/src/index.ts`, `packages/runeicons-react-native/src/index.ts` และ package manifest |
| [Astryx](https://github.com/facebook/astryx) | `47ba5526fa93f2bbcb7c0c26ab0a49d86cf37825` | MIT | README; `packages/core/package.json`; `packages/core/src/Dialog/Dialog.tsx`; `docs/architecture/theme-tokens.md`; core postinstall script |
| [Motion Panels](https://github.com/letstri/motion-panels) | `a496f9537141bcf9287be0b88ae272e4b8f66b28` | MIT | README; `motion-panels/package.json`; `src/core/group.ts`, `transition.ts`; separator/keyboard/ARIA/reduced-motion source and test locations |
| [Fluid Functionalism](https://github.com/mickadesign/fluid-functionalism) | `c0b2b2f79928151d7558cb4e6bc3f83263d2d4f6` | MIT | README; `registry/default/input-message.tsx` imports, queue dispatch, draft editing and IME; `registry/default/ask-user-questions.tsx` props/imports |

ก่อนนำ source/assets เข้าต้องเก็บ license/NOTICE ที่เกี่ยวข้องกับ subset จริง พร้อม source SHA และรายการ local modifications. License ในตารางคือ license ที่พบใน repo ไม่ใช่ audit สิทธิของ third-party assets ทุกไฟล์

## การเลือกต่อ repository

### Emil — เลือกแนวทางและ shortlist skills

ประโยชน์สูงโดยไม่เพิ่ม app runtime dependency: ใช้ motion เพื่ออธิบาย state change, หลีกเลี่ยง animation ถี่ในงาน keyboard, รองรับ reduced motion, กำหนด interruptibility และตรวจบน device จริง. เสริม skills better-* ที่มีอยู่แล้ว ไม่ติดตั้งชุดซ้ำทั้งหมด

Shortlist สำหรับช่วงทำ UI: `emil-design-eng`, `review-animations`; `animate-expo` เมื่อทำ G4 motion จริง. อ่านคำสั่งและ references เต็มก่อนติดตั้ง/ใช้จริง และตรวจ package/version ที่ skill เสนอเทียบ Expo 54 ก่อน. ไม่รับข้อเสนอเพิ่ม Reanimated/Router/Skia ทั้งชุดจากชื่อ skill โดยอัตโนมัติ. `write-swift` ไม่ตรง renderer ปัจจุบัน; ยังไม่เลือก `pick-ui-library`, `ask-sonner` หรือ prototype skill เพิ่มเพราะยังไม่มีช่องว่างที่ต้องใช้

### Rune — เลือกทดลอง SVG subset; ไม่เลือก packages ปัจจุบัน

ใช้ outline สำหรับ task/project/artifact/device actions ที่ต้องการเอกลักษณ์ Caret โดยเทียบกับ icon เดิมก่อน. รักษา Code-OSS icons ใน editor/workbench; หลีกเลี่ยงหลาย stroke styles และ glass/pixel effects ใน toolbar หนาแน่น

ข้อจำกัดจาก source: React และ React Native entrypoints ยัง throw `Not implemented yet`; React Native manifest เป็น `private: true`. จึงไม่เลือกติดตั้ง wrappers แม้มี directory ชื่อ package แล้ว. ทางใช้ได้คือคัดเลือก SVG ที่ตรวจแล้วและ bundle locally; mobile ต้องเลือก renderer/asset pipeline ที่ใช้งานได้จริงก่อน. ห้ามถือว่า npm packages พร้อมจาก README หรือ directory name

### Astryx — เลือก token/contract reference; ยังไม่เลือก UI framework

มีแนวทาง semantic tokens ร่วมระหว่าง CSS/JS และแยก syntax/data tokens ซึ่งเหมาะกับ Caret editor, logs, preview และ tool states. ใช้เป็นแนวทางออกแบบ token vocabulary และ state/keyboard/focus test cases ของเรา. Source Dialog แสดง dependency ต่อ layer, focus, theme และ layout modules: การ copy หนึ่ง component ไม่ได้แปลว่า standalone

Core ที่ตรวจเป็น 0.6.0 และ repo ระบุ Beta; ต้องใช้ React/React DOM >=19 และ StyleX peer. Published consumer path มี prebuilt CSS จึงไม่จำเป็นต้องเพิ่ม StyleX build plugin ทุกกรณี แต่ Mac ปัจจุบันยังต้องเพิ่ม React integration. ไม่เลือกทั้งระบบหรือ CLI ตอนนี้; พิจารณาใหม่เมื่อมีการตัดสินใจ renderer จากหลักฐานด้าน UI โดยตรง. ชื่อ Meta และจำนวน components ไม่แทนผลทดสอบ accessibility ใน Caret

### Motion Panels — เลือก candidate สำหรับ G3 spike

Core เป็น DOM-based และ React adapter เป็น optional; manifest 0.5.1 ต้องใช้ Motion >=12, Node >=20. จึงเข้ากับ Mac webview ได้มากกว่าสอง React component systems. Source มี keyboard/ARIA/RTL paths และ reduced-motion เปลี่ยน transition เป็น duration 0; พบ upstream tests แต่ยังไม่ได้รัน

ทดลองเฉพาะ resize/collapse ระหว่าง task transcript กับ resources/artifact pane ใน webview. Code-OSS ยังเป็นเจ้าของ editor split/sash. ห้ามวาง layout engines สองชุดควบคุม panel เดียวกัน. ต้อง bundle เข้ากับ CSP ปัจจุบัน, ไม่โหลด runtime จาก CDN. ยังไม่ติดตั้งจนกว่าจะเริ่ม spike ที่ขอบเขตนี้; ไม่ใช้ DOM core กับ native iPhone

### Fluid — เลือก interaction patterns; ไม่เลือก registry install ทั้งชุด

เหมาะกับ composer attachments, question cards, queue presentation และ tool activity disclosure. ใช้รูปแบบเหล่านี้เขียนสเปค Caret ก่อน. Components เป็น React DOM และดึง Framer Motion, shared hooks/context, primitives และ styles หลายไฟล์เข้ามา; มี IME/reduced-motion handling บางจุดแต่ต้องตรวจแต่ละ component

ข้อขัดแย้งสำคัญ: `registry/default/input-message.tsx` ส่ง head ของ queue ผ่าน `onSend` เมื่อ status เปลี่ยน streaming → idle รวมกรณีกด Stop; editQueued ยังแทน draft เดิม. Caret ต้องให้ queue execution semantics มาจาก OMP/host และรักษา draft ของผู้ใช้. เลือกเฉพาะ presentation, ส่ง intents ผ่าน existing command IDs และรอ authoritative events; ไม่คัดลอก auto-dispatch effect. Question component ไม่ใช่ permission enforcement; approve/deny ต้องผูก request/incarnation เดิม. Activity steps แสดงเฉพาะข้อมูล runtime ที่เปิดเผยจริง ไม่สร้าง progress หรือ reasoning สมมติ

Font weight/optical-size hover ของชุดนี้อิง Inter; ต้องตรวจ Thai fallback และ layout shift จึงยังไม่เลือกเป็น typography system. ไม่ใช้คำสั่ง registry overwrite กับ component ของ Caret

## งานที่เพิ่มใน G3/G4

| ลำดับ | งานที่เลือก | ผลลัพธ์และเกณฑ์ผ่าน | Installation decision |
|---|---|---|---|
| UI-R1 / ก่อน G3 polish | Capture Codex reference และสร้าง Caret token/state/icon mapping โดยใช้ Astryx/Emil เป็น reference | map สี semantic กับ VS Code themes; ตรวจ light/dark/high contrast, Thai/zoom, focus และ disabled states; ไม่มี theme registry คู่ขนาน | ไม่ต้องติดตั้ง |
| UI-R2 / G3 specification | Prototype composer + attachments + questions + queue disclosure ตาม Fluid patterns | IME Enter ไม่ส่งกลาง composition; Stop/idle/reconnect ไม่ dispatch คิวซ้ำ; draft ไม่หาย; approvals มาจาก host | ใช้ DOM/CSS เดิมก่อน; ไม่เพิ่ม Fluid/React |
| UI-R3 / G3 icons | ทำ contact sheet ไอคอน Rune outline ที่จำเป็นเทียบของเดิมที่ 16/20/24px | อ่านชัดบน light/dark/high contrast, baseline/stroke สม่ำเสมอ; decorative icon ซ่อนจาก AT และปุ่มมี accessible name | เลือก SVG รายไฟล์หลังตรวจภาพ; wrappers ยังไม่เลือก |
| UI-R4 / G3 panel spike | ทดลอง Motion Panels core ใน resources pane | resize ผ่าน pointer/keyboard/RTL/zoom; collapse แล้ว focus ปลอดภัย; transcript scroll/selection ไม่กระโดด; CSP ผ่าน; unload cleanup; เปรียบเทียบ bundle/startup/frame timing ขณะ stream กับ baseline | ติดตั้ง pinned candidate เฉพาะ spike เมื่อเริ่มงาน; promote เมื่อผ่านและคุ้มกับ native CSS/DOM baseline |
| UI-R5 / G3–G4 motion | ใช้ Emil motion review กับ transitions ที่มีเหตุผล | keyboard flow ทันที, reduced-motion ครบ, streaming ไม่กระตุก; iPhone ทดสอบ release build/touch/keyboard/safe areas บนเครื่องจริง | shortlist skills ข้างต้น; mobile libraries เลือกเฉพาะที่จำเป็นและเข้ากับ SDK |

ลำดับนี้เป็นงานย่อยของ G3/G4 เดิม ไม่เลื่อนสถานะ OMP conformance, host/relay หรือ release acceptance. ผล source review ยังไม่พิสูจน์ความสวย ความเร็ว accessibility หรือ compatibility ใน runtime ของ Caret

## หลักฐานการเปลี่ยนรอบนี้

เพิ่ม assessment นี้และ link ใน implementation direction เท่านั้น. ไม่มี dependencies/lockfiles, installed skills, UI production code หรือ upstream lock ที่เปลี่ยนจากงานประเมินนี้. ตรวจด้วย repository validator และตรวจ whitespace/link targets ของเอกสาร; ไม่รัน upstream install/build เพื่อทำให้คำว่า reference กลายเป็น dependency โดยอัตโนมัติ
