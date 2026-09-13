# Caret — Task workspace และวงจรรีวิว

วันที่ 2026-09-13 · สถานะ: **product decision ที่ผู้ใช้ยืนยันให้ใส่แผน**; ยังไม่ใช่ implementation หรือผลทดสอบ

อ่านคู่กับ [implementation direction](CARET-IMPLEMENTATION-DIRECTION-2026-09-12.th.md) และ [product acceptance](CARET-REFERENCE-ACCEPTANCE-2026-09-12.th.md). เอกสารนี้เป็นต้นทางของหน่วยงาน/วงจรรีวิว. ไม่แทน P01–P20, PE-01–PE-09, OMP inventory หรือ UI spec และไม่เลื่อน gate จากเอกสารนี้เพียงอย่างเดียว

## สูตรที่ล็อกแล้ว

**โต๊ะงานบน Mac แบบ Conductor + ความต่อเนื่องและหลักฐานแบบ Amp + OMP เป็น harness/execution owner คนเดียว**

| ชั้น | เจ้าของ | ความหมายใน Caret |
|---|---|---|
| Project | Caret host | หนึ่ง codebase หรือโฟลเดอร์; เก็บสคริปต์ตั้งต้นและรายการ workspace |
| Task workspace | Caret host | หนึ่งงาน: branch, worktree, แชท, diff, เทอร์มินัล, พรีวิว, artifact, archive |
| Session | OMP | loop, transcript, tools, model; หนึ่ง live owner ต่อ session |
| Review package | Caret artifacts + OMP transcript | คุย + diff + เซอร์วิส/พรีวิวที่รัน + หลักฐานเทส/สกรีนช็อต ผูก `buildId`/hash |
| Remote client | iPhone / Mac UI | projection ของ workspace เดิม; ไม่ spawn OMP และไม่เป็นความจริงของไฟล์หรือบิลด์ |

Mac ที่เปิดทิ้งไว้เป็นเครื่องรัน. iPhone เปิดงานเดิมจากนอกบ้าน. ความจริงของดิสก์อยู่ที่ worktree บน Mac ไม่ใช่สำเนาที่ sync กลับจากคลาวด์

## แหล่งที่อ่านวันที่ 13 กันยายน 2026

ใช้เป็น product-pattern reference ไม่ใช่สิทธิ์ API, โค้ด, หรือ entitlement:

- Amp: [ampcode.com](https://ampcode.com/), [Orbs docs](https://ampcode.com/docs/orbs), [Orbs, Explained](https://ampcode.com/notes/orbs-explained)
- Conductor: [conductor.build](https://www.conductor.build/), [isolated workspaces](https://www.conductor.build/docs/concepts/workspaces-and-branches), [git worktrees](https://www.conductor.build/docs/concepts/git-worktrees), [parallel agents](https://www.conductor.build/docs/concepts/parallel-agents)

Codex ยังเป็น reference หลักของหน้าจอและลำดับคลิก. เอกสารนี้เติมหน่วยงานและวงจรรีวิวที่ Codex reference ไม่ล็อกไว้. ห้ามใช้โลโก้/ชื่อ Orb/Conductor ในผลิตภัณฑ์ Caret

## กฎแยกงาน

งานที่ส่งแยกกันได้ ใช้ workspace ใหม่ แต่ละก้อนมี branch, ไฟล์, พอร์ต, พรีวิว และเส้นทางรีวิวของตัวเอง

งานที่ต้องใช้ไฟล์และ branch ชุดเดียวกัน อยู่ workspace เดิม เช่น implement แล้วซ่อมเทส, หรือรีวิวแล้วแก้ต่อ

internal OMP subagent อยู่ใน lineage ของ session เดิม ไม่กลายเป็น root workspace ที่ไม่เกี่ยวข้อง

isolation นี้เป็นการแยกการพัฒนา ไม่ใช่แซนด์บ็อกซ์ความปลอดภัย คำสั่งยังรันบน Mac ตาม policy ที่ Caret/OMP enforce จริง

## งานที่ยืนยัน — PE-10 ถึง PE-13

รายการนี้ขยาย G2–G4 และตีความ P11/P13/P17/P18 ให้เป็นวงจรเดียว. ไม่เปิด harness ใหม่ และไม่ประกาศว่า gate ใดผ่าน

| ID / Gate | งานและขอบเขต | เกณฑ์ตรวจรับ | ผูกกับแผนเดิม |
|---|---|---|---|
| PE-10 / G2+G3 | หน่วย workspace ต่อ task: หนึ่งงาน = หนึ่ง branch = หนึ่ง worktree = แชท + diff + เทอร์มินัล + พรีวิว + archive. แถบงานมองสถานะ running / รออนุมัติ / พร้อมรีวิว / พัง / archive ได้ทันที | สองงานอิสระไม่แย่งไฟล์ พอร์ต หรือ preview; สลับงานแล้ว process/resource ไม่ย้ายผิดที่; งานร่วมกันใน workspace เดียวเห็นไฟล์ชุดเดียวกัน; archive ไม่ลบ checkout หลักและไม่ทิ้ง lock ค้าง | P11/P17, PE-01/PE-03, S01/S02 |
| PE-11 / G2+G3 | ตั้งต้น workspace: snapshot ที่เลือก (tracked + dirty/untracked ที่ผู้ใช้รับ), คัดลอกไฟล์ gitignored ที่อนุญาต, setup script, run script, ช่วงพอร์ตต่อ workspace. คนกับเอเจนต์ใช้ working tree เดียวกัน | งานใหม่ไม่เริ่มจาก `HEAD` อย่างเดียวทั้งที่ผู้ใช้เลือก snapshot; `.env`/ไฟล์ที่อนุญาตมีใน workspace ใหม่; เซิร์ฟเวอร์สองงานไม่ชนพอร์ต; เทอร์มินัลผู้ใช้กับคำสั่งเอเจนต์เห็น cwd เดียวกัน; secrets ไม่ถูกคัดลอกโดยค่าเริ่มถ้าไม่อยู่ใน allowlist | P10/P11/P13, PE-03, S07/S10 |
| PE-12 / G3+G4 | หน่วยรีวิวเป็นแพ็กเกจ: คุย + diff + พรีวิวที่รัน/บิลด์ + หลักฐาน. เล่น build เดียวกันบน Mac และ iPhone. วงบนพรีวิวหรือส่งสกรีนช็อต/ฟีดแบ็กกลับเข้า session เดิม | receipt มี `buildId` + hash + source/workspace/task; failed build ไม่ทับ last-good; มือถือเล่นชุดเดียวกับที่ Mac เลือก; ฟีดแบ็กผูก build ที่เปิดอยู่ ไม่ใช่ `localhost`; เปลี่ยน build เมื่อผู้ใช้เลือก | P13/P15/P18, PE-03/PE-05, S08/S12/S15 |
| PE-13 / G4 | แจ้งเมื่อถึงตาผู้ใช้: รอ approval, คำถาม, หรือพร้อมรีวิว. เส้นทาง cellular ใช้การแจ้งของอุปกรณ์คู่แล้วเปิด task เดิม | แจ้งแล้วเปิด session/workspace/request เดิม; หมดอายุ/revoked/ตอบที่เครื่องอื่นแล้วใช้ไม่ได้; host เข้าไม่ถึงแสดงตรงๆ ไม่แกล้งว่าส่งแล้ว. ตื่นตาม CI/issue/ตารางเวลาเป็นงานหลัง PE-05 ไม่ขวาง continuity | P06/P18/P19, PE-05, S05/S14/S15 |

ลำดับลงมือ: ทำ PE-10/PE-11 คู่ G2 และ work panel ของ PE-03 → PE-12 คู่พรีวิว G3 แล้วต่อ G4 → PE-13 กับ mobile continuation. อย่ารอ Orb-like infra ก่อนปิดวงจร Aetheria บน Mac host

## นอกขอบเขตที่ล็อกแล้ว

ทำสิ่งต่อไปนี้แทนของที่ตัด:

- แยกงานด้วย worktree + artifact hash บน Mac เครื่องเดียว
- ส่ง build ที่ตรวจแล้วไปเล่นบน iPhone ไม่สตรีมหน้าจอ Mac เป็นค่าเริ่ม
- มือถือเป็นพื้นผิวหลักของงานเดิมตั้งแต่ G4
- OMP เป็น harness คนเดียว

งานที่อ่านจาก Amp/Conductor แล้วไม่ใส่แผนนี้:

- กอง VM/Orb, ขนาดเครื่อง, จ่ายรายนาที, หรือ “ลืม worktree”
- ห่อ Claude Code / Codex / Cursor / OpenCode เป็นเอเจนต์หลายค่าย
- Conductor Cloud หรือ sandbox Linux เป็นค่าเริ่ม
- multiplayer orb, URL สาธารณะของ thread, เอเจนต์แตกเครื่องเป็นจำนวนมาก
- `amp sync` หรือ one-way cloud→Mac เป็นความจริงหลักของไฟล์
- พื้นผิว GitHub/Linear/Graphite/stacks/routines/dispatcher เต็มชุดก่อนวงจร E1/E2 จบ
- ชื่อหรือแบรนด์ของ Amp/Conductor

## วงจรที่ยอมรับ

ใช้กับ E1–E4 โดยไม่ฝังโดเมน Aetheria ใน core:

1. สร้าง workspace จาก snapshot ที่เลือก
2. รัน setup/run ในโฟลเดอร์นั้น พอร์ตและโปรเซสเป็นของ workspace
3. OMP ทำงานบน Mac host คนเดียว
4. เทส/บิลด์ได้ receipt + `buildId`
5. Mac และ iPhone เล่นหรือตรวจ build นั้น
6. ฟีดแบ็ก/สกรีนช็อตกลับเข้า session เดิม
7. เน็ตหลุดแล้วต่อได้โดยไม่ยิงคำสั่งซ้ำ
8. งานจบแล้ว archive หรือ bring-back แบบมีขอบเขต

## หลักฐานจบ

แนบ PE-10–PE-13 → acceptance case → revision/runtime จริง → ผลที่สังเกต. แยก implemented / verified / externally blocked. การเพิ่มเอกสารนี้ไม่ติดตั้ง dependency, ไม่สร้าง Orb, ไม่เปลี่ยน harness และไม่ถือว่า G2–G5 ผ่าน
