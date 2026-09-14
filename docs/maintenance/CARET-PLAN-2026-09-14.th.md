# Caret — SSOT plan (2026-09-14)

เอกสารนี้คือ **แผนและสเปกฉบับเดียวที่มีอำนาจ** ของโปรเจกต์ Caret เอกสารอื่นทั้งหมด
ถูกย้ายไป [archive/2026-09-14-pre-ssot](../archive/2026-09-14-pre-ssot/) และไม่มีอำนาจ
ตัดสินงานใหม่ ที่นี่เป็นที่เดียวที่ต้องอัปเดตเมื่อแผนเปลี่ยน

## 0. นิยามผลิตภัณฑ์

**Caret = Cursor clone ที่เราเป็นเจ้าของ ใช้ OMP เป็น harness**

- ลอก spec ของ Cursor (ผลิตภัณฑ์, surface, interaction, สถาปัตยกรรม, หน้าตา) เพราะเรา fork
  OSS ตัวเดียวกับที่ Cursor fork
- สิ่งที่แทนที่: **harness = OMP เท่านั้น** · แบรนด์/ไอคอน/ชื่อ = Caret · ไม่มี
  Cursor-proprietary (Tab engine, cloud agents, private models)
- reference: Cursor 3.20.17 (macOS) บนเครื่องผู้ใช้ · OMP v18.1.18 (pin ใน `docs/UPSTREAM-LOCK.md`)

## 1. ลำดับความสำคัญของ reference

| ชั้น | Reference |
|---|---|
| ผลิตภัณฑ์ + surface + interaction + หน้าต่าง + สี/geometry/motion | **Cursor 3.20.17 (macOS)** |
| พฤติกรรมที่ Cursor ไม่มี (plan/goal/subagent/MCP/approval schema/queue) | OMP contract |
| execution / transcript owner | **OMP** (ตัวเดียว ห้ามมีตัวที่สอง) |
| legacy screen reference | Codex (เฉพาะ surface ที่ Cursor และ OMP ไม่มี) |

## 2. สถาปัตยกรรม

```
Caret.app  (Code-OSS fork, แบรนด์ Caret, pin ea1912fd…)
├─ Agents window   ← หน้าต่าง Agents ของฐาน (sessions workbench flavor) [native]
│      sidebar (Sessions/Chats/Automations/…) · composer · panels (Changes/Files/…)
├─ IDE window      ← workbench ปกติ (Explorer/editor/LSP/debug/terminal)
└─ one Caret host  ← lifecycle · journal · artifacts · relay · devices
        │
   OMP — harness เดียว เจ้าของ execution + transcript
```

กติกา:

1. Agents surface เป็น **หน้าต่าง native ของฐาน** ไม่ใช่ webview ที่เราวาด — เปิดด้วย
   `--agents` / `workbench.action.openAgentsWindow`; เมนู/เลย์เอาต์/title bar มาจาก
   `desktop/src/vs/sessions/**`
2. session/composer/transcript ของ Agents window ป้อนโดย **provider ของ Caret** ผ่าน proposed
   API `chatSessionsProvider` (allowlist: `patches/desktop/0003`) โดยดึงจาก host + OMP
3. **harness = OMP เท่านั้น**: ห้าม register/ใช้ `copilot`/`claude`/`codex` harness, ห้ามผูก
   GitHub Copilot auth/sign-in/BYOK; `src/vs/platform/agentHost/**` ของฐานผูกกับ Copilot
   จึงใช้เป็นข้อมูลอ้างอิงเชิงรูปแบบเท่านั้น
4. IDE window: Code-OSS เป็นเจ้าของ buffer/undo/LSP/debug/extension
5. host เป็นเจ้าของ lifecycle/journal/artifacts/relay; iPhone เป็น projection ของ session เดียวกัน
6. OMP เป็นเจ้าของ execution/transcript; UI ห้ามสร้าง agent loop ตัวที่สอง

## 3. Cursor parity contract (วัดจาก AX ของ Cursor 3.20.17)

```text
Cursor Agents (window)
├─ Title bar: close / minimize / fullscreen; ไม่มี editor tab, ไม่มี editor title actions
├─ Sidebar (คอลัมน์เดียว)
│  ├─ Hide Sidebar · Go Back · Go Forward
│  ├─ New Chat ⌘N · Search ⌘K · Automations · Customize
│  ├─ Projects (+ New Project)
│  ├─ Repositories (+ Customize Sidebar, Open Workspace)
│  ├─ session rows: จัดกลุ่มตามโปรเจกต์, row = สถานะ + ชื่อ + เวลาสัมพัทธ์
│  ├─ การ์ดแนะนำ (Getting Started: Skip step, Connect Slack)
│  └─ Account menu · Settings
├─ Main
│  ├─ Header: IDE · Chat actions · Show Apps
│  ├─ Transcript ของ session (เมื่อมีงาน)
│  └─ Composer: project popup · branch combo · environment ("This Mac") ·
│              ช่องพิมพ์ (placeholder "Plan, Build, / for skills, @ for context") ·
│              toolbar: Add agents/context/tools · reasoning popup · voice input · Send
├─ แถวแนะนำ (มี Dismiss recommendation ทุกแถว): Plan New Idea ⇧Tab · Multitask ·
│  Run in Cloud · Build from a design · Deploy my prototype · Start with a plan · Debug an issue
└─ Notifications (alt+T)
```

| ภูมิภาค | องค์ประกอบ | พฤติกรรมที่ต้อง match |
|---|---|---|
| Window | menu bar | ชุดเมนูของหน้าต่าง agents: `Caret · File · Edit · View · Window · Help` (ไม่มี Selection/Go/Run/Terminal) |
| Sidebar | New Chat / Search | มี shortcut hint ที่ resolve จริง; Search เปิด search ไม่ใช่ช่องถาวร |
| Sidebar | Automations / Customize | ทางเข้า capability ของผลิตภัณฑ์ |
| Sidebar | Projects + New Project | แยกจาก Repositories |
| Sidebar | Repositories + Customize Sidebar / Open Workspace | จัดการ repo group และเปิด workspace |
| Sidebar | session rows | สถานะ + ชื่อ + เวลาสัมพัทธ์, จัดกลุ่มตามโปรเจกต์ |
| Sidebar | การ์ดแนะนำ | ปิด/ข้ามได้ ไม่ค้างถาวร |
| Sidebar | Account + Settings | ทางเข้าบัญชี/settings |
| Header | IDE | สลับไปหน้าต่าง editor (คนละหน้าต่าง) |
| Header | Chat actions / Show Apps | เมนูบริบทของ task และทางเข้า apps |
| Composer | project / branch / environment | ระบุ workspace จริงต่อ task ก่อนส่ง |
| Composer | input + IME | placeholder เดียวกัน; Enter ส่ง, Shift+Enter ขึ้นบรรทัด |
| Composer | toolbar | agents/context/tools, reasoning, voice input, ปุ่มส่ง/หยุดตามสถานะ |
| แถวแนะนำ | idea rows + Dismiss | สร้าง draft จากข้อความ; ปิดทีละแถว |
| Panels | Changes · Files · Browser · Terminal · preview/artifacts | ต่อ task, มี identity ของ workspace |

### 3.1 ค่าที่วัดได้ (light, empty draft, 1710×1073, zoom default)

| องค์ประกอบ | ค่าที่วัดได้ | หมายเหตุ |
|---|---|---|
| Sidebar กว้าง | 255px | มี splitter "Resize sidebar" → ปรับได้ ไม่ใช่ค่าคงที่ |
| Sidebar row inset | 8px ซ้าย-ขวา | fill ของแถวที่เลือกกิน x8..246 |
| Sidebar row box | 30px | token `--ui-sidebar-menu-button-min-height` = 28px → **token กับ box จริงไม่ตรงกัน** ต้องยึดค่าที่ render |
| Sidebar row pitch | ~30.7px | วัดจากระยะ text-row |
| Sidebar row fill (selected) | `rgb(223,224,225)` บน chrome `rgb(236,237,238)` | — |
| Composer card (empty draft) | **608 × 106px** รวม border 1px, อยู่กลาง main pane | x679..1286, y506..611 · margin ข้างละ 423px |
| Composer card border | 1px `rgb(234,234,234)` | ขอบบน/ล่าง/ซ้าย/ขวา |
| Composer card fill | `#FCFCFC` = `editor.background` = **สว่างกว่าพื้นหน้า** | token: `--prompt-input-container-bg` = `--cursor-bg-input-surface` = `color-mix(in srgb, var(--cursor-base) 6%, transparent)` |
| Composer shadow | ไม่มี | token `--prompt-input-container-shadow: none` (ห้ามใส่ elevation) |
| Composer radius / editor | radius 18 (`radius-4xl`) · editor min-height 36 (`spacing-9`) | ตรงกับ `--prompt-input-border-radius-expanded` / `--prompt-input-editor-min-height` |
| Idea rows (empty state) | 4 แถวใต้ card, กิน y624..793 (~42px/แถว) | separator inset 12px จากขอบ card; mode pills อยู่ใต้ card |
| Type scale ที่ agent CSS ใช้จริง | 11/12/13/14 (token) **+ class 16/17/18/20px** | `.ui-osj86m{font-size:18px}` → หัวข้อ 18px ไม่ได้หลุดสเกลของ Cursor |
| Motion | instant/fast/normal/slow = 50/100/150/200ms · `--cursor-easing-out-cubic` = `cubic-bezier(0.215, 0.61, 0.355, 1)` | ค่าที่ประกาศใน bundle (ยังไม่ได้สังเกตจังหวะจริง) |

ค่าที่เหลือยึดตาม D20 (อยู่ใน archive) และต้องผ่าน `bun run check:cursor-parity`
ซึ่งอ่าน theme file จริงของ Cursor (340 keys, 0 mismatch)

**กติกาตอนวัดสี (สำคัญ — ถ้าไม่รู้จะไล่ผี):** พื้นผิว chrome/chat ของ Cursor เป็น
**translucent (glass)** ไม่ใช่สีทึบ `screencapture -l <windowID>` จะ composite กับ backdrop
โปร่งใสทำให้อ่านค่าเข้มลง ~7 หน่วย (chrome อ่าน `rgb(236,237,238)`) ขณะที่ full-screen capture
ของจอเดียวกันอ่านได้ `rgb(250,250,251)`; ใน full-screen capture เดียวกัน sidebar ของ Cursor
กับของ Caret อ่านเท่ากันเป๊ะ ⇒ **ความต่าง ~7 หน่วยนั้นเป็น artefact ของการ capture ไม่ใช่ของสินค้า**
เวลาวัดเพื่อปิด §8 ข้อ 2 ให้ใช้ full-screen capture ที่มีทั้งสองแอปในจอเดียว หรือใช้ค่า theme file
เป็นฐานแล้วตรวจกับ full-screen — ห้ามใช้ `screencapture -l` เทียบสีตรง ๆ

## 4. Surface ที่ Cursor ไม่มี (ดีไซน์ของ Caret, ขับด้วย OMP)

ไม่นับเป็น parity แต่ต้องอยู่ในหน้าต่างเดียวกัน:

- approvals/questions ตาม schema ของ OMP (select/multi-select/input/editor + scope/cwd/tool)
- plan/goals/queue/subagent lineage + งบ token
- models/providers/MCP/skills/hooks catalog ตามที่ OMP โฆษณาจริง
- worktree/branch bring-back receipt + artifacts (MIME/hash/buildId)
- honest-unavailable state (เช่น `Run in Cloud`, `Automations` เมื่อยังไม่มี backend) → disabled + เหตุผล

## 5. Deviations ที่ตั้งใจ (ต้องบันทึก ไม่ใช่ parity ที่พลาด)

| รายการ | Cursor | Caret | เหตุผล |
|---|---|---|---|
| harness | Anysphere engine | **OMP** | ผลิตภัณฑ์ของเรา |
| Tab / cloud / private models | มี | ไม่มี | นอกขอบเขต |
| touch / control target | เล็กกว่า | ≥32px desktop / ≥44pt mobile | a11y floor |
| focus ring (high contrast) | โปร่งใส | `#F0F0F066` | ต้องเห็น focus |
| capability ที่ยังไม่มี | ใช้ได้ | disabled + เหตุผล | honesty marker |
| syntax token colours ใน IDE | Cursor theme | Code-OSS default | ติด licensing |

## 6. SSOT (หนึ่งความรับผิดชอบ = หนึ่งเส้นทาง live)

| ความรับผิดชอบ | SSOT | ห้าม |
|---|---|---|
| หน้าต่าง Agents + เมนู + layout | `desktop/src/vs/sessions/**` + patch ใน `patches/desktop/` | วาด shell เองใน webview |
| session/composer/transcript ของ Agents | provider ของ Caret + host + OMP | provider/harness ของเจ้าอื่น |
| IDE | workbench ปกติ | ห่อ IDE ใน shell ของเรา |
| execution/transcript | OMP | daemon/agent loop ตัวที่สอง |
| host/lifecycle/journal/relay | `apps/host/**` | host ที่สอง |
| ความรู้เรื่อง layout/token | `apps/macos/src/caret-theme.ts` + `check:cursor-parity` | hardcode นอก token |
| การแก้ใน `desktop/` | `patches/desktop/*.patch` + digest ใน `manifest.json` | แก้ในเช็คเอาต์แล้วไม่เก็บเป็น patch |
| เอกสาร | ไฟล์นี้ | เอกสารอื่นใน `maintenance/` |

### 6.1 Retirement ledger

| artifact | ลบเมื่อ | สถานะ |
|---|---|---|
| `apps/macos/src/webview.ts` + `TASK_WEBVIEW_CSS` + เทสต์ที่ผูก shell | S3 | ยัง live |
| `patches/desktop/0002` + context key `caret.agentsWindow` + การซ่อน chrome ตอนสลับโหมด | S1 | **เกษียณแล้ว** (แทนด้วย `0008`; ถอด context key ออกจาก extension) |
| drift ของ `agentWorkbenchActions.ts` ที่แก้ในเช็คเอาต์แต่ไม่เป็น patch | S1 | **สะอาดแล้ว** (เหลือแต่ build output: แบรนด์/ไอคอน/`argv.json`) |
| command `caret.openAgentsWindow` ของ fork ที่ยังเปิด webview `caretComposer` | S3 | ยัง live (เห็นได้จาก Command Palette) |
| หน้าต่าง Agents เปิด Caret shell editor (`caret.agentsShell`) ในตัวมันเอง | S3 | ยัง live (หลักฐาน: element ที่ label เป็น `…/globalStorage/caret.caret/window.caret-shell` ในหน้าต่าง Agents) |
| `CARET-AGENTS-WINDOW-ARCHITECTURE-2026-09-14.th.md` | ทันที | เป็น redirect stub |
| provider ของ Copilot ใน sessions workbench | 2026-09-14 | ถอดแล้วด้วย `patches/desktop/0005` |

ความคืบหน้า S1 (2026-09-14): **S1a เสร็จ + verified ที่ runtime แล้ว**

- `patches/desktop/0003` — product.json: allowlist `chatSessionsProvider`, ถอด
  `defaultChatAgent` (ต้นทางของ welcome/sign-in flow), ถอด Copilot ออกจาก
  `trustedExtensionAuthAccess` และ `builtInExtensionsEnabledWithAutoUpdates` —
  ตอนนี้ `product.json` ไม่มีคำว่า Copilot เหลือ (`grep -c copilot` = 0)
- `patches/desktop/0004` — เก็บ drift ของ `agentWorkbenchActions.ts` เป็น patch ที่ review ได้
- `patches/desktop/0005` — หยุดโหลด Copilot chat session provider (desktop + web entry)
- `patches/desktop/0006` — ถอดการ register harness ทั้งหมด (Copilot/Claude/Codex) ออก
  พร้อม BYOK proxy, Claude/Codex proxy, pending-edit provider และ Copilot API wiring;
  `providerConfigurations` เป็น `[]`; `npm run typecheck-client` = 0 errors
- **หลักฐาน runtime** (build + `--package` แล้วเปิด `--agents`): ไม่มี `Sign in to use Agents`,
  ไม่มี `Session Type: Copilot`, ไม่มี `Return to VS Code Editor`
- **แก้บันทึกเดิม**: ข้อความช่วงนี้เคยสรุปว่า "หน้าต่างว่างเปล่าตามคาดเพราะ provider ของ Caret
  ยังไม่ถูกเขียน" — **ผิด** หน้าต่างblank เพราะ **workbench ไม่ boot** ตั้งแต่ `patches/desktop/0003`
  ถอด `defaultChatAgent` ออกจาก product.json (ดู S1c) การที่ AX ไม่พบคำว่า `Copilot` จึงเป็น
  ผลของการที่หน้าต่างไม่ mount อะไรเลย ไม่ใช่หลักฐานว่า surface สะอาด

**S1b เสร็จ + verified แล้ว** (2026-09-14)

- ลบ `node/{copilot,claude,codex}` (920 ไฟล์), `platform/agentHost/test` ทั้งต้นไม้,
  `sessions/contrib/providers/copilotChatSessions`, และตระกูล picker ที่ผูก schema ของ
  Copilot/Claude/Codex (mode/permission/approval/agent + mobile) รวมทั้งเทสต์ของมัน
- เก็บการลบเป็น **`removals` ใน `patches/desktop/manifest.json`** (18 รายการ) แล้วให้
  `scripts/prepare-desktop.ts` ลบให้ — ไม่ทำเป็น deletion patch ขนาดหลาย MB เพื่อให้ยัง
  review ได้; path ทุกตัวถูกบังคับให้อยู่ภายใน checkout
- `sessionPluginBundler.ts` ประกาศ discovery shape ที่เคย import จากโมดูล Copilot เอง,
  และถอด `--enable-mock-agent` (import test helper ที่ถูกลบ) ออกจาก agent host server
- **พิสูจน์การสร้างซ้ำ**: คืนไฟล์ทั้งหมด (102 copilot files) → `bun scripts/prepare-desktop.ts`
  (7 patches + 18 removals) → ได้ต้นไม้ Copilot-free เดิม และ `npm run typecheck-client`
  = 0 errors

เหลือ **naming debt**: 15 ไฟล์ที่มีคำว่า copilot ในชื่อแต่ไม่ใช่ harness (config/home/
managed-settings/tool-ids/slash-command compat) — ไม่ register และไม่ gate อะไร

**S1c เสร็จ + verified แล้ว** (2026-09-14)

- routing: `apps/macos/src/extension.ts#openAgentsWindow` เรียก
  `workbench.action.openAgentsWindow` (หน้าต่างของฐาน เปิดด้วย `--agents`) ไม่สลับ mode
  ในหน้าต่างเดิมและไม่เปิด webview อีก
- `patches/desktop/0008` — ถอด `Selection`/`Go`/`Terminal` ออกจาก
  `src/vs/sessions/browser/parts/menubar.contribution.ts` ของหน้าต่าง Agents; หน้าต่าง IDE
  ยังมีเมนูชุดเดิม (ยืนยันใน bundle ที่ build จริง: `"mSelection"`/`"mGo"`/`"mTerminal"`
  เหลือ 0 ครั้งใน `out/vs/sessions/sessions.desktop.main.js` และยังมีใน workbench bundle)
- เกษียณ context key `caret.agentsWindow` ออกจาก `apps/macos/src/workbench-mode.ts` และ
  `extension.ts`; `patches/desktop/0002` และ `0004` ถูกลบ, manifest เก็บ 6 → 7 รายการใหม่
- **เจอ root cause ที่ทำให้ "ยังไม่เหมือน Cursor"**: หน้าต่าง Agents และหน้าต่าง IDE
  ไม่ boot เลยตั้งแต่ `patches/desktop/0003` เพราะ product.json ไม่มี `defaultChatAgent`
  แต่ฐานยังอ่านแบบไม่กัน undefined สองจุด — `toDefaultAccountConfig()`
  (`workbench/services/accounts/browser/defaultAccount.ts`) และ
  `assertDefined(product.defaultChatAgent, …)` ระดับ module ของ `welcomeOnboarding`
  (ตัวหลังทำให้ **หน้าต่าง IDE ทั้งหน้าต่าง** ตาย). หลักฐาน: exception ที่จับได้จาก CDP ของ
  renderer (`Cannot read properties of undefined (reading 'chatExtensionId')` และ
  `Onboarding requires a default chat agent product configuration.`)
- `patches/desktop/0009` — ทำให้ผู้อ่าน `defaultChatAgent` ทนการไม่มีค่า (accounts,
  extension gallery/deprecation, pack-uninstall, composer welcome copy, onboarding)
  โดยไม่แตะพฤติกรรมเมื่อ product.json มีค่า
- **หลัง build ใหม่**: หน้าต่าง Agents mount จริง title = `Agents`;
  sidebar = `Sessions` · `New ⌘N` · `Automations` · `Workspace` · `Customize` · `Filter/Find Session`;
  main = `Open in Editor` header + composer (`Add Context…` · `Models` · `Dictate` · `Voice Mode` · `Send`);
  innerText ของทั้งหน้าต่างไม่มีคำว่า `Copilot`
- **วัดซ้ำ** (เครื่องเดียวกัน build เดียวกัน, fresh profile, `--remote-debugging-port`):

| หน้าต่าง | time to first window | workbench mounted | steady RSS (ผลรวมต่อ process) |
|---|---|---|---|
| Agents (`--agents`) | 1.65s | 1.80s | 721MB / 7 process |
| IDE | 1.48s | 1.61s | 642MB / 8 process |

  หมายเหตุวิธีวัด: RSS เป็นผลรวม RSS ของทุก process ของโปรไฟล์นั้น (นับ shared page ซ้ำ)
  ใช้เทียบสองหน้าต่างของ Caret เอง ไม่ใช่ตัวเลขเทียบกับแอปอื่น

- **ช่องที่ยังไม่ตรง Cursor (ต้องแก้ใน S2/S3/S4 ไม่ใช่ปิดใน S1)**: composer ยังมี label
  `Models, sign in to use Copilot`; หน้าต่าง Agents ยังมี editor group
  (`Editor Group 1 (empty)`, `Add Tab`, `Close Editor Area`) ซึ่ง §3 ห้ามมี;
  มี VS Code pet (`Show Aquarium`); sidebar ใช้ `Workspace`/`Customize` ไม่ใช่
  `Projects`/`Repositories` ตาม §3; และยังไม่ได้อ่านเมนู native สด ๆ
  (process ที่รันสคริปต์นี้ไม่ได้รับ Accessibility trust) จึงยืนยันเมนูด้วย bundle ที่ build จริง
  + เงื่อนไข `shouldDrawMenu` ของ main process แทน

**S2 กำลังทำ — provider เขียนแล้วและรันจริง แต่ sidebar ยังไม่แสดง** (2026-09-14)

สิ่งที่ทำแล้วและ verified:

- `apps/macos/src/chat-sessions-map.ts` — projection บริสุทธิ์ (uri/session item/turn plans/command)
  พร้อมเทสต์ 14 เคสใน `apps/macos/test/chat-sessions-map.test.ts` (fixtures ล้วน ไม่เรียก provider)
- `apps/macos/src/chat-sessions.ts` — ลงทะเบียน participant + `createChatSessionItemController`
  + `registerChatSessionContentProvider`; ป้อน history จาก `applyEvent` ของ `state.ts`;
  ส่งงานด้วย command `prompt` ผ่าน `CaretHostClient` และสตรีมด้วยการอ่าน event ต่อจาก cursor
  (abort เมื่อ token ถูกยกเลิก) — OMP ยังเป็นเจ้าของ execution/transcript ตามปกติ
- `patches/desktop/0003` เพิ่ม `chatParticipantPrivate` ใน `extensionEnabledApiProposals` และ
  **`sessionsWindowAllowedExtensions: ["caret.caret"]`** — จำเป็นจริง: ถ้าไม่ allow-list
  extension ที่มี `main` + contributes `views` จะถูกปิดในหน้าต่าง Agents
  (`extensionEnablementService#_isDisabledBySessionsWindow`)
- หลักฐาน runtime (packaged app, `--agents`, CDP): extension เปิดใช้งานในหน้าต่าง Agents
  (`ExtensionService#_doActivateExtension caret.caret`) และ provider อ่าน host ได้จริง —
  log: `Caret chat sessions: 1 session(s) in 1 project(s) from the host.` ไม่มี error

**bridge ทำแล้ว — session ของ Caret ปรากฏในหน้าต่าง Agents แล้ว** (2026-09-14)

- `patches/desktop/0010` — `contrib/providers/extensionSessions/browser/
  extensionSessionsProvider.contribution.ts` เป็น bridge ทั่วไป: อ่าน
  `IChatSessionsService.getChatSessionItems()` แล้ว expose เป็น `ISessionsProvider`
  (โมเดลที่ sidebar ใช้จริง) พร้อมส่งงานด้วย `chatService.sendRequest` จึงไม่ต้องมี
  provider ของเจ้าอื่นเลย; ลงทะเบียนใน `sessions.desktop.main.ts`
- fail-safe: ถ้าอ่าน item ไม่ได้ provider จะคืน list ว่างและ log warn — หน้าต่างไม่พัง
- สิ่งที่ยังไม่โฆษณา (และไม่โชว์ปุ่ม): rename/archive/delete/fork/side-chat/multi-chat, model picker
  (`capabilities` = false และ `getModelPickerOptions` ปิดทั้งหมด) เพราะของเหล่านี้ต้องรอ
  การผูกกับ OMP ให้จบก่อน — ตรงกับ §5 "capability ที่ยังไม่มี → disabled + เหตุผล"
- **verified** (packaged app + `--agents` + CDP): sidebar แสดง
  `treeitem: caret-ui-acceptance, 1` (กลุ่มตาม workspace จริงของ session) และ
  `treeitem: New task, updated 2 days ago, State: Completed`; คลิกแล้วเปิด chat view
  ของ session นั้นได้ในหน้าต่าง Agents (composer + welcome ครบ) — ไม่มี error ใน exthost log
  และไม่มี banner read-only (element มีอยู่ใน DOM แต่ `display:none`)

ถัดไปใน S2: ส่งงานจาก composer ให้ถึง OMP (prompt → host → stream กลับ) และผูก model picker
กับรายการ model ที่ OMP โฆษณา แทนข้อความ sign-in เดิม

ถัดไปหลัง S2: ปิด S3 (ถอด webview shell + หยุดให้หน้าต่าง Agents เปิด `caret.agentsShell`)
แล้วจึง S4 (parity §3: layout ของหน้าต่าง Agents ที่ยังมีคอลัมน์ editor/detail 298px,
ปุ่ม pet, `Run Task` title action, label sidebar/composer)

## 7. แผนลงมือ

| ขั้น | งาน | เจ้าของ | exit evidence |
|---|---|---|---|
| **S1 ถอด Copilot + เปิดหน้าต่างจริง** (เสร็จ) | S1a ถอดการ register Copilot (provider/harness/auth) · S1b ลบโค้ด Copilot/Claude/Codex ที่ตายแล้ว · S1c สลับ routing ไปหน้าต่างของฐาน (patch `0008`), เกษียณ patch 0002 + context key, ทำให้ฐานทนการไม่มี `defaultChatAgent` (patch `0009`) | root | หน้าต่าง Agents mount จริง (title `Agents`, workbench + sidebar + composer), ไม่มี gate/sign-in ของ Copilot, ไม่มี `Session Type: Copilot`, หน้าต่าง IDE boot ปกติ, bundle ไม่ register Selection/Go/Terminal ในหน้าต่าง Agents |
| **S2 provider ของ Caret** (เหลือส่งงาน/model) | ลงทะเบียน `chatSessionsProvider` ชนิดของเรา; list session จาก host; ส่งงานผ่าน host ไป OMP; ไม่มี provider อื่น | root | **ได้แล้ว**: extension เปิดในหน้าต่าง Agents, provider อ่าน host, และ `patches/desktop/0010` bridge item เข้า `ISessionsProvidersService` → sidebar แสดง session ของ host จริงและเปิด chat ได้ · **ยังขาด**: ส่ง prompt จาก composer ถึง OMP + model picker จาก OMP |
| **S3 ลบของซ้ำ** | ลบ webview shell + CSS + เทสต์ที่ผูก; ย้าย capability ที่ยังต้องใช้ไปฝั่ง native | root | `rg "webview.ts|TASK_WEBVIEW_CSS"` ไม่เหลือผู้ใช้; suite ผ่าน |
| **S4 ปิด parity §3** | ทำ component ตามตาราง §3 ให้ครบ + วัด geometry/สีจริงเทียบ | root + reviewer | capture ที่ viewport/theme เดียวกัน + ตาราง §3 ผ่านครบ |
| **S5 mobile continuity** | iPhone เป็น projection ของ session เดียวกัน (relay/approval/replay) | root | receipt: iPhone จริง + cellular |

## 8. เกณฑ์ว่า "เหมือน Cursor"

1. **token**: `bun run check:cursor-parity` ผ่าน (320 keys, 0 mismatch) — ผ่านแล้ว
2. **surface**: ทุกรายการใน §3 มีจริง + วัด geometry/สีจาก DOM/compositor จริง
   เทียบ Cursor ที่ viewport/theme เดียวกัน (ไม่นับการดูด้วยตา, ไม่นับ screenshot เดี่ยว)
3. **SSOT**: หนึ่งความรับผิดชอบมีเส้นทาง live เดียว (§6) และ retirement ledger ว่าง
4. **honest states**: ทุกอย่างที่ยังทำไม่ได้ต้อง disabled + เหตุผล ไม่มีปุ่มหลอก

## 9. ความเสี่ยงที่กระทบ "ผลลัพธ์จะเหมือนไหม" (ตรงไปตรงมา)

| ความเสี่ยง | ผลถ้าไม่แก้ | ทางลด |
|---|---|---|
| หน้าต่าง Agents ของฐานผูกกับ Copilot (harness + auth gate + `node/copilot/**`) | เปิดหน้าต่างได้แต่ค้างที่ sign-in ไม่มี session ของเรา | S1 ต้องถอด Copilot provider ให้หมดก่อน; พิสูจน์ด้วย AX ว่าไม่มี gate |
| provider ของ Caret ยังไม่เขียน | หน้าต่างว่าง ใช้งานไม่ได้ | S2 ก่อน แล้วจึง S3/S4 |
| syntax token colours ยังเป็น Code-OSS (licensing) | IDE จะไม่เหมือน Cursor ตอนเปิดโค้ด | ตัดสิน licensing หรือเขียน token palette เอง |
| geometry บางจุด token ≠ ค่าที่ render (เช่น sidebar row 30 vs 28) | ตัวเลขดูตรงแต่ตาสังเกตว่าต่าง | ยึดค่าที่ render + บันทึกใน §3.1 |
| ทำงานสอง task บน repo เดียวกัน | งานซ้ำ/ถูกเขียนทับ/rebuild ชนกัน | เจ้าของไฟล์ชัด + ทีละ task (ดู §6) |

**คำตอบสั้น**: สเปกตอนนี้ตรง Cursor ในระดับ IA/โครงสร้าง/พฤติกรรม/โทนสี และตกลง SSOT แล้ว
แต่ "ผลลัพธ์จะเหมือน" ยัง **ไม่รับประกัน** จนกว่า S1 (ถอด Copilot) และ S2 (provider ของ OMP)
จะผ่าน — สองขั้นนี้คือตัวชี้ขาดว่าหน้าต่าง Agents จะเป็นของเราจริงหรือค้างเป็น Copilot-gated

## 10. เอกสารที่เก็บไว้ (archive) และสิ่งที่ยังใช้

| ไฟล์ | ใช้ทำอะไรต่อ |
|---|---|
| [evidence/](evidence/) | ใบเสร็จรันจริง (สคริปต์เขียนที่นี่) — ยังเป็นหลักฐาน ไม่ใช่สเปก |
| [`../archive/2026-09-14-pre-ssot/CARET-CURSOR-AGENTS-SPEC-2026-09-14.th.md`](../archive/2026-09-14-pre-ssot/CARET-CURSOR-AGENTS-SPEC-2026-09-14.th.md) | รายละเอียดการวัด Cursor ฉบับเต็ม (ตาราง component/geometry/สี) |
| [`../archive/2026-09-14-pre-ssot/CARET-UI-DETAILED-DESIGN-2026-09-13.th.md`](../archive/2026-09-14-pre-ssot/CARET-UI-DETAILED-DESIGN-2026-09-13.th.md) | D00–D20 รวมค่าที่ D20 ล็อกจาก Cursor |
| [`../archive/2026-09-14-pre-ssot/CARET-OMP-COVERAGE-2026-09-12.th.md`](../archive/2026-09-14-pre-ssot/CARET-OMP-COVERAGE-2026-09-12.th.md) + [`CARET-OMP-SOURCE-INVENTORY-2026-09-12.md`](../archive/2026-09-14-pre-ssot/CARET-OMP-SOURCE-INVENTORY-2026-09-12.md) | O01–O18 และ path ในซอร์ส OMP |
| [`../archive/2026-09-14-pre-ssot/CARET-REFERENCE-ACCEPTANCE-2026-09-12.th.md`](../archive/2026-09-14-pre-ssot/CARET-REFERENCE-ACCEPTANCE-2026-09-12.th.md) | P01–P20 / E1–E4 (ID เดิม) |
| [`../archive/2026-09-14-pre-ssot/CARET-UI-COVERAGE-2026-09-13.th.md`](../archive/2026-09-14-pre-ssot/CARET-UI-COVERAGE-2026-09-13.th.md) | mapping 198 parents / 75 families (authority จริงคือ `backlog/requirement-graph.json`) |
| [`../archive/2026-09-14-pre-ssot/CARET-WORKSPACE-WORKFLOW-2026-09-13.th.md`](../archive/2026-09-14-pre-ssot/CARET-WORKSPACE-WORKFLOW-2026-09-13.th.md) | หน่วย task workspace + วงจรรีวิว (PE-10–PE-13) |
| [UPSTREAM-LOCK.md](../UPSTREAM-LOCK.md) | pin ของ desktop/OMP (ci-validate อ่านไฟล์นี้) |
