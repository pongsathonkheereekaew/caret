# Caret — Cursor Agents window spec (measured)

วันที่ 2026-09-14 · สถานะ: **measured reference inventory** (ยังไม่ใช่ acceptance receipt)

เอกสารนี้คือ **spec ที่ดึงจาก Cursor ของจริง** เพื่อใช้เป็น SSOT ว่า "Agents window ของ
Caret ต้องมีอะไร" โดยแยกชัดระหว่าง (ก) โครงสร้าง/องค์ประกอบ/พฤติกรรม ที่เราต้อง match
กับ Cursor และ (ข) ดีไซน์/สี/แบรนด์ ที่เป็นของ Caret เอง

**ตัวตนผลิตภัณฑ์ (ยืนยันโดยผู้ใช้ 2026-09-14):** Caret คือผลิตภัณฑ์ของเราเองในคลาสเดียวกับ
Cursor ใช้ spec/IA/พฤติกรรมของ Cursor เป็นเป้า แต่ **ดีไซน์เป็นของเรา** และ **harness คือ OMP เท่านั้น**
(ห้ามใช้ Copilot/Claude/Codex harness — [harness policy](CARET-AGENTS-WINDOW-ARCHITECTURE-2026-09-14.th.md))

## 1. วิธีเก็บข้อมูลและข้อจำกัด

- เก็บด้วย Computer Use (AX) จาก Cursor 3.20.17 (macOS) หน้าต่าง `Cursor Agents`
- เก็บ **ชื่อองค์ประกอบ/บทบาท/shortcut/สถานะ** เท่านั้น: ชื่อ task/โปรเจกต์ของผู้ใช้
  ไม่ถูกคัดลอกเข้าเอกสารนี้หรือ repo ใด ๆ
- เมนูยืนยันสองครั้งในวันเดียวกัน: `Cursor | File | Edit | View | Window | Help`
  (ไม่มี Selection/Go/Run/Terminal)
- **วัด geometry ต่อ element และ light theme แล้ว** ในรอบ 2026-09-14 รอบที่สอง → ตารางใน §5.1
  วิธีคือ `screencapture -x -o -l <CGWindowID>` (device scale 2) แล้ววัดพิกเซลด้วย
  `scripts/png-pixel-probe.py` วิธีนี้ validate ก่อนใช้: หน้าต่าง Caret เองที่รู้ค่าสีแน่
  อ่านได้ `rgb(243,243,243)` จาก `#F3F3F3` และ `rgb(252,252,252)` จาก `#FCFCFC` ตรงเป๊ะ
- **ยังไม่วัด**: running/approval/error states ของ Cursor, panel ภายใน session,
  dark theme ของ composer, และจังหวะ animation จริง → อยู่ใน §6
- **หมายเหตุวิธี**: Computer Use ใช้กับ Caret ไม่ได้ในรอบนี้ (service resolve bundle ไปที่
  `VSCode-darwin-arm64/Caret.app` แล้ว fail `kLSNoExecutableErr`) และ vision model ตอบ
  HTTP 429 ทุกภาพทั้ง session จึงไม่มีการดูด้วยตาเลย ทุกตัวเลขมาจากพิกเซล/OCR/AX

## 2. โครงสร้างหน้าต่าง

```text
Cursor Agents (window)
├─ Title bar: close / minimize / fullscreen; ไม่มี editor tab, ไม่มี editor title actions
├─ Sidebar (คอลัมน์เดียว)
│  ├─ Hide Sidebar · Go Back · Go Forward
│  ├─ New Chat ⌘N · Search ⌘K · Automations · Customize
│  ├─ Projects (+ New Project)
│  ├─ Repositories (+ Customize Sidebar, Open Workspace)
│  ├─ รายการ session: จัดกลุ่มตามโปรเจกต์, row = สถานะ + ชื่อ + เวลาสัมพัทธ์
│  ├─ การ์ดแนะนำ (Getting Started: Skip step, Connect Slack)
│  └─ Account menu · Settings
├─ Main
│  ├─ Header: IDE · Chat actions · Show Apps
│  ├─ Transcript ของ session (เมื่อมีงาน)
│  └─ Composer
│     ├─ project popup · branch combo · environment popup ("This Mac")
│     ├─ ช่องพิมพ์ (placeholder "Plan, Build, / for skills, @ for context")
│     └─ toolbar: Add agents/context/tools · reasoning popup · voice input
├─ แถวคำแนะนำในสถานะว่าง (มี Dismiss recommendation ทุกแถว):
│  Plan New Idea ⇧Tab · Multitask · Run in Cloud ·
│  Build from a design · Deploy my prototype · Start with a plan · Debug an issue
└─ Notifications (alt+T)
```

## 3. Component contract (ต้องมีและทำงานได้)

| ภูมิภาค | องค์ประกอบ | บทบาท/พฤติกรรมที่ต้อง match |
|---|---|---|
| Sidebar | `New Chat` + shortcut hint | สร้าง task ใหม่; แสดงคีย์จริงที่ resolve ได้ |
| Sidebar | `Search` + shortcut hint | เปิด search ไม่ใช่ช่องค้นหาถาวรในแถบ |
| Sidebar | `Automations`, `Customize` | ทางเข้า capability ของผลิตภัณฑ์ |
| Sidebar | `Projects` + `New Project` | สร้าง/เปิด project; แยกจาก Repositories |
| Sidebar | `Repositories` + `Customize Sidebar`, `Open Workspace` | จัดการ repo group และเปิด workspace |
| Sidebar | session rows | สถานะ (เช่น Completed) + ชื่อ + เวลาสัมพัทธ์; จัดกลุ่มตามโปรเจกต์ |
| Sidebar | การ์ดแนะนำ | มี action ปิด/ข้ามได้ ไม่ค้างถาวร |
| Sidebar | Account + Settings | ทางเข้าบัญชีและ settings ของผลิตภัณฑ์ |
| Header | `IDE` | สลับไปหน้าต่าง editor (คนละหน้าต่าง ไม่ใช่ซ่อน chrome) |
| Header | `Chat actions`, `Show Apps` | เมนูบริบทของ task และทางเข้า apps |
| Composer | project / branch / environment | ระบุ workspace จริงต่อ task ก่อนส่ง |
| Composer | ช่องพิมพ์ + IME | placeholder แบบเดียวกัน; Enter ส่ง, Shift+Enter ขึ้นบรรทัด |
| Composer | toolbar | เพิ่ม agents/context/tools, เลือก reasoning, ปุ่ม voice input |
| Composer | ปุ่มส่ง/หยุด | เปลี่ยนตามสถานะ run (idle/running/queued) |
| แถวแนะนำ | idea rows + Dismiss | สร้าง draft จากข้อความได้; ปิดทีละแถวได้ |
| Window | menu bar | ชุดเมนูของหน้าต่าง agents (ของ Caret ใช้ชุดของตัวเอง) |

## 4. Surface ที่ Cursor ไม่มี และ Caret ต้องออกแบบเอง

ส่วนนี้ **ไม่นับเป็น parity** แต่ต้องอยู่ในหน้าต่างเดียวกันด้วยดีไซน์ของ Caret และขับด้วย OMP:

- approvals/questions ตาม schema ของ OMP (select/multi-select/input/editor + scope/cwd/tool)
- plan/goals/queue/subagent lineage และงบ token
- models/providers/MCP/skills/hooks catalog ตามที่ OMP โฆษณาจริง
- worktree/branch bring-back receipt และ artifacts (MIME/hash/buildId)
- สถานะ honest-unavailable (เช่น `Run in Cloud`, `Automations` เมื่อยังไม่มี backend)

## 5. ความหมายของ "match" และเกณฑ์ผ่าน

| ชั้น | ต้อง match Cursor | ต้องเป็นของ Caret |
|---|---|---|
| IA/โครงสร้าง, ลำดับองค์ประกอบ, ตำแหน่ง control | ใช่ | — |
| พฤติกรรม/สถานะ/shortcut/ป้ายชื่อ action | ใช่ | — |
| สี, แบรนด์, ไอคอนของเรา, โทนภาษาไทย | — | ใช่ |
| geometry (ขนาด/ระยะ/radius/type scale) | ใช้เป็นค่าอ้างอิงได้ | ปรับได้ตามดีไซน์เรา แต่ต้องบันทึกส่วนที่ต่าง |

เกณฑ์ผ่านต่อรายการ: มี capture ที่ viewport/theme เดียวกัน + วัดค่าจาก DOM/compositor จริง
(ไม่ใช่การดูด้วยตา) และระบุว่า "ตรง / ต่างโดยตั้งใจ / ยังไม่ทำ" อย่างใดอย่างหนึ่งเท่านั้น

## 5.1 Geometry และสีที่วัดได้ (light, empty draft, หน้าต่าง 1710x1073)

หน้าต่างที่วัด: `Cursor Agents` 1710x1073 ที่ (0,39) · OS light mode ·
`window.zoomLevel` ไม่ได้ตั้ง (ค่า default) · `window.autoDetectColorScheme = true`

| องค์ประกอบ | ค่าที่วัดได้ | ที่มา |
|---|---|---|
| Sidebar กว้าง | 255px (ในรอบนี้) | เส้นแบ่ง sidebar/main วัดได้ที่ x≈255 · AX มี splitter ชื่อ "Resize sidebar" → **ผู้ใช้ปรับได้** จึงไม่ใช่ค่าคงที่ของดีไซน์ |
| Sidebar row inset | 8px ซ้าย-ขวา | fill ของแถวที่ถูกเลือกกิน x8..246 (239px) |
| Sidebar row box | **30px** | fill ของแถว "New Chat" กิน y48..77 = 30px แม้ token `--ui-sidebar-menu-button-min-height` = `--cursor-height-base` = 28px และ padding-block = 0 → **token กับ box ที่ render ไม่ตรงกัน** |
| Sidebar row pitch | **~30.7px** | ระยะ text-row top ของ ~20 แถว: 30/30/32/32/28/72/… (ตัวที่ 72+ คือช่องว่างระหว่างกลุ่ม) |
| Sidebar row fill (selected) | `rgb(223,224,225)` บน chrome `rgb(236,237,238)` | แถว "New Chat" |
| Composer card | **608 x 106px** รวม border 1px | x679..1286, y506..611 · อยู่กลาง main pane (margin ข้างละ 423px) |
| Composer card border | `rgb(234,234,234)` 1px | ขอบซ้าย/ขวา/บน/ล่างของ card |
| Composer card fill | `rgb(252,252,252)` = `#FCFCFC` = `editor.background` | หนึ่งขั้น **สว่างกว่า** พื้นหน้า ไม่ใช่ panel ที่ยกขึ้น |
| Composer card shadow | ไม่มี | token `--prompt-input-container-shadow: none` |
| Composer radius | 18px | `--prompt-input-border-radius-expanded` = `radius-4xl` และวัดมุมโค้งของ card |
| Composer editor min-height | 36px | `--prompt-input-editor-min-height` = `spacing-9` |
| Idea rows (สถานะว่าง) | 4 แถว กิน y624..793 (~42px/แถว) ใต้ card | separator กิน x691..1274 (inset 12px จากขอบ card 679..1286) |
| Type scale ที่ agent CSS ใช้จริง | token 11/12/13/14 + class 16/17/18/20px | `.ui-osj86m{font-size:18px}` และอื่น ๆ → **หัวข้อ 18px ไม่ได้หลุดสเกลของ Cursor** แม้ token scale หยุดที่ 14 |
| Motion | instant/fast/normal/slow = 50/100/150/200ms · `--cursor-easing-out-cubic` = `cubic-bezier(0.215, 0.61, 0.355, 1)` | อ่านจาก workbench bundle (ค่าที่ประกาศ ไม่ใช่จังหวะที่สังเกต) |
| Shortcut ที่ AX ยืนยัน | ⌘N (New Chat), ⌘K (Search), alt+T (Notifications), ⇧Tab (Plan New Idea) | AX tree ของหน้าต่าง agents |

**สีของพื้นผิว agent และข้อควรระวังตอนวัด** — พื้นผิว chrome และ chat ของ Cursor เป็น
**translucent (glass)** ไม่ใช่สีทึบ: capture เฉพาะหน้าต่างจะ composite กับ backdrop โปร่งใส
ทำให้อ่านค่าได้เข้มลง ~7 หน่วย (chrome อ่าน `rgb(236,237,238)`) ขณะที่ full-screen capture
ของจอเดียวกันอ่านได้ `rgb(250,250,251)` และใน full-screen capture เดียวกันนั้น sidebar ของ
Cursor กับของ Caret อ่านเท่ากันเป๊ะ และ chat surface กับ page ของ Caret ก็เท่ากันที่
`rgb(255,255,255)` → **นี่คือ artefact ของการ capture ผิวโปร่งแสง ไม่ใช่ความต่างของสีสินค้า**
กติกา: ห้ามใช้ `screencapture -l` เทียบสีของ reference โดยตรง ให้ capture แบบ full-screen
ที่มีทั้งสองแอป หรือใช้ค่าจาก theme file เป็นฐานแล้วตรวจกับ full-screen

## 6. ยังไม่รู้ (ห้ามอ้างว่าผ่าน)

1. state ของ Cursor ที่ไม่ใช่สถานะว่าง: running (ระหว่างมีงาน), approval, error, offline,
   long transcript, และ state ของ composer ตอนมี draft/มี attachment
2. panel ภายใน session (Changes/Files/Browser/Terminal) ในหน้าต่าง agents
3. dark theme ของ composer card (วัดแล้วเฉพาะ light) และค่าของ theme variant อื่น
4. จังหวะ/animation จริงของ Cursor (ค่าที่ได้เป็นค่าที่ประกาศใน bundle ไม่ใช่ที่สังเกต)
5. พฤติกรรม keyboard/focus เต็มรูปแบบ รวม IME และ VoiceOver
6. กล่องของ idea row ที่ยังไม่ได้ derive (รู้แค่ pitch ~42px และ separator inset 12px)
7. ค่าของ Cursor ที่เป็น state ของผู้ใช้ ไม่ใช่ค่าดีไซน์: ความกว้าง sidebar (ปรับได้),
   zoom level, การเลือก project/repo ในหน้าต่างนั้น

## 7. ผลต่อ D20 (ต้องตัดสิน)

D20 ผูก "pixel parity" กับ Cursor รวมถึง **คัดลอกค่าสีจาก theme file ของ Cursor** และมี gate
`check:cursor-parity` ที่เทียบค่านั้น ข้อ "ดีไซน์เป็นของเรา" ทำให้ต้องเลือก:

| ทางเลือก | ผล |
|---|---|
| **A (แนะนำ)** spec match + palette ของเราเอง | เปลี่ยน D20 จาก "คัดลอกสี Cursor" → "โครงสร้าง/ระยะอ้างอิง Cursor, สี/แบรนด์เป็นของ Caret"; `check:cursor-parity` เปลี่ยนหน้าที่เป็น reference diff ไม่ใช่ gate ที่บังคับค่าตรง; ปิดประเด็น licensing ของ theme บุคคลที่สามไปด้วย |
| B คงการคัดลอกสีตาม D20 | ยังต้องตัดสิน licensing ของ `cursor-themes` และขัดกับ "own design" |

จนกว่าจะตัดสิน เอกสารนี้ไม่ถือว่าทางใดถูกเลือก และห้ามอ้างว่า parity ผ่าน

**ข้อมูลเพิ่มสำหรับการตัดสิน (วัดแล้ว 2026-09-14):** premise ของทางเลือก B อ่อนกว่าที่คิดไว้
เพราะพื้นผิว agent ของ Cursor เป็น translucent glass ค่าที่ผู้ใช้เห็นจริงจึงไม่เท่ากับค่าที่
ประกาศใน theme file (ดู §5.1) การคัดลอกสีจาก theme file จึงไม่ reproduce พิกเซลของ
Cursor ได้อยู่ดี — สิ่งที่ reproduce ได้คือค่าที่วัดจาก full-screen capture เท่านั้น
