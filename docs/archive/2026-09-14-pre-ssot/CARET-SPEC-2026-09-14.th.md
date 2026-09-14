# Caret — product spec (authoritative, 2026-09-14)

วันที่ 2026-09-14 · สถานะ: **spec ที่มีอำนาจ** แทนข้อที่ขัดกันในเอกสารอื่นทั้งหมด

## 0. นิยามผลิตภัณฑ์ (อ่านก่อนทุกอย่าง)

**Caret = Cursor clone ที่เราเป็นเจ้าของเอง โดยใช้ OMP เป็น harness**

- เราลอก **spec ของ Cursor** (ผลิตภัณฑ์, surface, interaction, สถาปัตยกรรม, หน้าตา) เพราะเราก็ fork
  OSS ตัวเดียวกันกับที่ Cursor fork มา
- สิ่งที่แทนที่ในของเรา: **harness = OMP** (ของเรา, ตัวเดียว) · แบรนด์/ไอคอน/ชื่อ = Caret ·
  ไม่มี Cursor-proprietary ใด ๆ (Tab model, cloud agents, private engines)
- สิ่งที่อ้างอิงจาก Cursor: ลำดับชั้นหน้าจอ, หน้าต่าง, component, geometry, สี, motion, เมนู,
  keyboard affordance — วัดจาก Cursor 3.20.17 (macOS) ที่ติดตั้งบนเครื่องนี้

## 1. ลำดับความสำคัญของ reference

| ชั้น | Reference | ใช้กับ |
|---|---|---|
| ผลิตภัณฑ์ + surface + interaction + หน้าต่าง + สี/geometry/motion | **Cursor 3.20.17 (macOS)** | ทั้งแอป Mac (Agents + IDE) |
| พฤติกรรมที่ Cursor ไม่มี (plan/goal/subagent/MCP/approval schema/queue) | OMP contract | ใช้ token + หน้าต่างของ Cursor, พฤติกรรมของ OMP |
| execution / transcript owner | **OMP** | ตัวเดียว ห้ามมีตัวที่สอง |
| หลักอ้างอิงหน้าจอของ legacy | Codex | ใช้เฉพาะ surface ที่ทั้ง Cursor และ OMP ไม่มี |

## 2. สถาปัตยกรรม (window model)

```
Caret.app  (Code-OSS fork, แบรนด์ Caret)
├─ Agents window   ← หน้าต่าง Agents ของฐาน (sessions workbench flavor)  [native]
│      sidebar (Sessions/Chats/Automations/…) · composer · panels (Changes/Files/…)
├─ IDE window      ← workbench ปกติ (Explorer/editor/terminal/LSP/debug)
└─ one Caret host  ← lifecycle · journal · artifacts · relay · devices
        │
   OMP (harness เดียว) — เจ้าของ execution + transcript
```

กติกา:

1. **Agents surface เป็นหน้าต่าง native ของฐาน ไม่ใช่ webview ที่เราวาด** — เปิดด้วย
   `--agents` / `workbench.action.openAgentsWindow`; เมนู/เลย์เอาต์/title bar มาจาก
   `desktop/src/vs/sessions/**` ไม่ใช่จาก extension
2. **session/composer/transcript ของ Agents window ป้อนโดย provider ของ Caret** ผ่าน
   proposed API `chatSessionsProvider` (ชนิดของเราเอง) โดยดึงจาก host + OMP
3. **harness = OMP เท่านั้น**: ห้าม register/เรียกใช้ `copilot`/`claude`/`codex` harness ของฐาน
   ห้ามผูก GitHub Copilot auth/sign-in/BYOK; `src/vs/platform/agentHost/**` ของฐานใช้เป็น
   ข้อมูลอ้างอิงเชิงรูปแบบเท่านั้น เพราะมันผูกกับ Copilot
4. IDE window ไม่เปลี่ยน: Code-OSS เป็นเจ้าของ buffer/undo/LSP/debug/extension
5. host ยังเป็นเจ้าของ lifecycle/journal/artifacts/relay; iPhone เป็น projection ของ session เดียวกัน

## 3. Surface contract

**รายการ component ต่อรายการ (วัดจาก Cursor ด้วย AX) ไม่ถูกคัดลอกมาที่นี่** — แหล่งเดียวคือ
[CARET-CURSOR-AGENTS-SPEC-2026-09-14.th.md](CARET-CURSOR-AGENTS-SPEC-2026-09-14.th.md)
(measured reference inventory) เอกสารนี้คุมเฉพาะกติกาที่ตัดขวาง:

1. **เมนู Agents window** ต้องเป็น `Caret · File · Edit · View · Window · Help` — ไม่มี
   Selection/Go/Run/Terminal (Cursor วัดได้ชุดนี้; patch `0002` เป็นวิธีเดิมที่ถูกเกษียณใน S1
   เพราะหน้าต่างของฐานมีชุดเมนูของตัวเอง)
2. **โทเคนสี/geometry/type/motion** ตาม D20 และต้องผ่าน `bun run check:cursor-parity`
3. **แถว/ปุ่มที่ทำไม่ได้ต้อง disabled พร้อมเหตุผล** ไม่ใช่ซ่อน และไม่ใช่ปุ่มหลอก
4. **เกณฑ์ผ่าน S4** = ทุกรายการใน inventory มีอยู่จริงใน Caret และยืนยันด้วย AX/geometry
   ที่ viewport/scale/theme เดียวกัน

## 4. SSOT (กติกาเดียวที่ต้องบังคับ)

หนึ่งความรับผิดชอบ = หนึ่งเส้นทางที่ live เท่านั้น

| ความรับผิดชอบ | SSOT | ห้าม |
|---|---|---|
| หน้าต่าง Agents + เมนู + layout | `desktop/src/vs/sessions/**` + patch ที่ review ได้ใน `patches/desktop/` | วาด shell เองใน webview |
| session/composer/transcript ของ Agents | provider ของ Caret (`chatSessionsProvider`) + host + OMP | provider ของ Copilot/harness อื่น |
| IDE | workbench ปกติ | ห่อ IDE ใน shell ของเรา |
| execution/transcript | OMP | daemon/loop/agent ตัวที่สอง |
| host/lifecycle/journal/relay | `apps/host/**` | เปิด host ที่สอง |
| การแก้ใน `desktop/` | `patches/desktop/*.patch` + digest ใน `manifest.json` | แก้ในเช็คเอาต์แล้วไม่เก็บเป็น patch |
| visual token | `apps/macos/src/caret-theme.ts` + D20 | hardcode สี/ระยะนอก token |

**Retirement ledger** (สิ่งที่ต้องหายไป และขั้นที่ลบ)

| artifact | ลบเมื่อ |
|---|---|
| `apps/macos/src/webview.ts` + `TASK_WEBVIEW_CSS` + เทสต์ที่ผูกกับ shell | S3 (หลัง provider รับงานครบ) |
| `patches/desktop/0002` + context key `caret.agentsWindow` + การซ่อน chrome ตอนสลับโหมด | S1 |
| การแก้ `agentWorkbenchActions.ts` ที่ไม่เป็น patch | S1 (เก็บเป็น patch หรือ revert) |

## 5. Deviations ที่ตั้งใจ (ต้องบันทึก ไม่ใช่ parity ที่พลาด)

| รายการ | Cursor | Caret | เหตุผล |
|---|---|---|---|
| harness | Anysphere engine | **OMP** | ผลิตภัณฑ์ของเรา |
| Tab/cloud/private engines | มี | ไม่มี | นอกขอบเขตผลิตภัณฑ์ |
| touch/control target | เล็กกว่า | ≥32px desktop / ≥44pt mobile | a11y floor |
| focus ring (HC) | โปร่งใส | `#F0F0F066` | ต้องเห็น focus |
| capability ที่ยังไม่มี (`Run in Cloud`, `Automations`) | ใช้ได้ | disabled + บอกเหตุผล | honesty marker |
| syntax token colours ใน IDE | Cursor theme | Code-OSS default | ติด licensing (D20) |

## 6. การวัดว่า "ตรง Cursor" (gate)

1. palette/token: `bun run check:cursor-parity` (320 keys, 0 mismatch) — ผ่านแล้ว
2. surface: วัด AX + geometry เทียบทีละ component ใน §3 พร้อม screenshot ที่ viewport/scale/theme
   เดียวกัน (ห้ามนับจาก "ดูด้วยตา" หรือ screenshot เดี่ยว)
3. หนึ่งความรับผิดชอบต้องมีเส้นทาง live เดียว (§4) — นับเป็นเกณฑ์ผ่านของ S1–S3

## 7. ขั้นงาน

| ขั้น | งาน | exit evidence |
|---|---|---|
| S1 | เปิดหน้าต่าง Agents ของฐานเป็น Caret Agents window; ถอด Copilot provider/gate ออก; เกษียณ 0002 + context key; ทำให้ `agentWorkbenchActions.ts` เป็น patch | หน้าต่าง Agents เปิดได้โดยไม่มี sign-in gate และไม่มี `Session Type: Copilot` (AX) |
| S2 | provider ของ Caret (`omp`) ป้อน session/composer/transcript จาก host+OMP | session ของ OMP ปรากฏ + ส่งงานได้จริง; transcript ยังเป็นของ OMP |
| S3 | ลบ webview shell + CSS + เทสต์ที่ผูกกัน; ย้าย capability ที่ยังต้องใช้ไปฝั่ง native | ไม่เหลือ UI สองทาง (`rg webview` ไม่มีผู้ใช้) |
| S4 | ปิด §3 ทีละ component ด้วยการวัดจริง | ตาราง §3 ผ่านครบพร้อม capture |

## 8. เอกสารที่ต้องอ้างฉบับนี้ (และส่วนที่ถูกแทน)

| ไฟล์ | ส่วนที่ถูกแทน |
|---|---|
| `CARET-UI-INTERACTION-SPEC-2026-09-13.th.md` | §2 (รูปแบบผลิตภัณฑ์/navigation), §7 (slices ที่ผูกกับ shell) |
| `CARET-UI-DETAILED-DESIGN-2026-09-13.th.md` | สมมติฐานหน้าต่างเดียว/สลับโหมด; ค่า visual ยังใช้ตาม D20 |
| `CARET-UI-COVERAGE-2026-09-13.th.md` | เจ้าของ surface (S01–S16 ยังใช้เป็นรายการ surface ได้) |
| `CARET-UI-VALIDATION-2026-09-13.th.md` | receipt ที่ถ่ายจาก webview shell |
| `CARET-HANDOFF-2026-09-13.th.md` | สถานะ/ขั้นถัดไป (ให้ใช้เอกสารนี้ + ledger เป็นหลัก) |
| `CARET-AGENTS-WINDOW-ARCHITECTURE-2026-09-14.th.md` | รวมเข้าเอกสารนี้แล้ว (ไฟล์เดิมถูกยกเลิก) |
