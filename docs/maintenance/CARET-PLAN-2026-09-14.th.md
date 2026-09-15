# Caret — SSOT plan (2026-09-14)

เอกสารนี้คือ **แผนและสเปกฉบับเดียวที่มีอำนาจ** ของโปรเจกต์ Caret เอกสารอื่นทั้งหมด
ถูกย้ายไป [archive/2026-09-14-pre-ssot](../archive/2026-09-14-pre-ssot/) และไม่มีอำนาจ
ตัดสินงานใหม่ ที่นี่เป็นที่เดียวที่ต้องอัปเดตเมื่อแผนเปลี่ยน

- **ไม่มี menu bar ในหน้าต่าง**: `Cursor | File | Edit | View | Window | Help` เป็นเมนูบาร์ของ
  macOS (sibling ของ window ใน AX) ไม่ได้วาดในหน้าต่าง และ **ไม่มี title bar band** —
  ปุ่ม traffic light ลอยอยู่บน sidebar เอง
- **ฝั่งขวาเป็น panel เดียว ไม่ใช่รายการ panel**: `Panel editor-panel-group` มีหัวเป็น
  `Tabs` + ปุ่ม `Open new tab menu` + `Enter Full Screen` + `Hide Apps` และแถบ
  `Changes · Browser · Terminal · File` (เรียงเป็นแท็บ) — คำสั่ง `Show Apps`/`Hide Apps`
  คือการเปิด/ปิด panel นี้ (storage key `cursor/glass.rightPane`), และ panel กว้าง
  ~608px เท่ากับ composer
- **composer ไม่มีปุ่ม Send ในสถานะว่าง**: toolbar มีแค่ `Add agents, context, tools` ▾,
  `High` ▾ (reasoning) และ `Start voice input`; แถวบนคือ project popup + branch combo
  (`main`) + `This Mac`
- **แถวคำแนะนำมี subtitle และ Dismiss ไม่ครบทุกแถว**: `Plan New Idea ⇧Tab` · `Multitask` ·
  `Run in Cloud` (ไม่มี subtitle) · `Build from a design — Turn a frame into working UI in this
  repo` + Dismiss · `Deploy my prototype — Put it on a live link anyone can open` + Dismiss ·
  `Start with a plan — Align on implementation before writing code` · `Debug an issue — Find root
  causes and fix tricky bugs`; `Run in Cloud` สื่อความหมายเป็น runtime option ของ cloud (มีใน
  แหล่งโค้ดของ Cursor เป็น label ในเมนู Autopilot PR) ไม่ใช่ cloud agent เต็มรูปแบบ
- **sidebar ตามลำดับจริง**: Hide Sidebar · Go Back(disabled) · Go Forward(disabled) ·
  New Chat ⌘N · Search ⌘K · Automations · Customize · Projects (+ New Project) ·
  Repositories (+ Customize Sidebar ▾, Open Workspace ▾) · กลุ่มโปรเจกต์แบบลากได้ (sortable) ·
  การ์ด Getting Started (Skip step n of m, Connect Slack) · Account menu · Settings · splitter
  `Resize sidebar`; **ไม่มี** label `Sessions` และไม่มี pet
  — **แก้จากภาพจริง (2026-09-15)**: ใน screenshot หน้าต่าง Agents จริง (3420×2224)
  sidebar จบที่ `Repositories` + repo rows **ไม่มีการ์ด Getting Started และไม่มี
  แถว Account/Settings** ส่วน `Go Back/Go Forward` อยู่ใน titlebar ไม่ใช่ sidebar
  และหัวข้อ `Repositories` มี 2 ไอคอน (filter, add) ไม่ใช่ `Customize Sidebar ▾`
  ⇒ รายการในบรรทัดนี้เป็นค่าที่วัดจาก AX ของอีกรอบ/อีกสถานะ ไม่ใช่สถานะ empty home นี้
- **สีที่อ่านจากจอจริง (dark)**: chrome/sidebar `rgb(35,35,37)` · main pane `rgb(27,27,27)` ·
  การ์ด composer `rgb(34,34,34)` (สว่างกว่าพื้น) · panel `rgb(26,26,26)`; composer กว้าง 608
  สูง ~107 อยู่กลาง main pane ที่ rig 1710×1073 (ตรงกับ §3.1 ที่วัดตอน light)
- **ยังไม่ยืนยัน**: สถานะ running/approval/error, dark ของ light-theme pair, และจังหวะ
  animation (เดิมรายการนี้รวม "panel ที่มี tab จริง" — ปิดแล้วใน D1–D5 ด้านล่าง)

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
| หน้าต่าง Agents เปิด Caret shell editor (`caret.agentsShell`) ในตัวมันเอง | S3 | **ไม่ mount แล้ว** (2026-09-14): `ensureAgentsPanel()` ไม่ทำงานในหน้าต่าง Agents และเลิกเขียน `window.caret-shell` — verified ด้วย CDP (ข้อความในหน้าต่างไม่มี `caret-shell` เลย) เหลือแค่การลบโมดูล `webview.ts` + contribution + เทสต์ที่ผูก shell |
| `CARET-AGENTS-WINDOW-ARCHITECTURE-2026-09-14.th.md` | ทันที | เป็น redirect stub |
| provider ของ Copilot ใน sessions workbench | 2026-09-14 | ถอดแล้วด้วย `patches/desktop/0005` |

### 6.2 Audit ของค้างและ dead code (2026-09-15)

สแกนทั้ง tree (ยกเว้น `desktop/` ซึ่งเป็น build output ของ base) แล้วได้สถานะนี้:

| กลุ่ม | สถานะ | หลักฐาน/สิ่งที่ต้องทำ |
|---|---|---|
| **webview shell ของ Caret** — `apps/macos/src/webview.ts` (2,836 บรรทัด), `TASK_WEBVIEW_CSS`, view `caretComposer`/`caretComposerDock`, custom editor `caret.agentsShell`, restricted-mode stub, `scripts/shell-render-fixture.ts` และเทสต์ที่ผูก shell ~8 ไฟล์ | **ยัง live และเป็น dead code เท่านั้น** (หน้าต่าง Agents ไม่ mount แล้วตั้งแต่ 2026-09-14) | ลบทั้งชุดพร้อมกันเท่านั้น เพราะ `scripts/cursor-parity-check.ts` (320 keys) และ `apps/macos/src/caret-theme.ts` อ่าน token จาก CSS ของ shell ⇒ ต้องย้ายแหล่ง token ไป `caret-theme.ts` ก่อน แล้ว `rg "webview.ts\|TASK_WEBVIEW_CSS"` จึงจะเหลือ 0 — **นี่คือ slice ถัดไป** |
| เอกสาร kickoff pack 4 ไฟล์ (parity spec 2.0, backlog CSV, golden-state template, kickoff prompt) | **ย้ายเข้า archive แล้ว** (2026-09-15) | `docs/archive/2026-09-14-pre-ssot/kickoff-pack/` + แถวใน `docs/archive/README.md`; `docs/caret-ui-reference-baseline.json` ยังอยู่เพราะแผนอ้างค่าจากไฟล์นั้น |
| งานแบรนด์/ไอคอนที่ค้างใน working tree (`assets/brand/**`, ไอคอน iOS, `scripts/lib/app-icon.ts`, `scripts/build-caret.ts`) | **ยังไม่ commit** (มาจากอีก session) | `scripts/build-caret.ts` ใน working tree import `scripts/lib/app-icon.ts` ที่ยัง untracked — ถ้าจะเก็บงานนี้ต้อง commit ทั้งชุดพร้อมกัน ไม่งั้น HEAD กับ tree ไม่ตรงกัน |
| `.DS_Store` (tracked 2 ไฟล์ + untracked) | **ล้างแล้ว** (2026-09-15) | ลบไฟล์และเพิ่ม `.DS_Store`, `.vscode/`, `.commandcode/` ใน `.gitignore` |
| `patches/desktop/0002` + `0004` | เกษียณแล้ว | ไม่มีไฟล์ patch เหลือใน `patches/desktop/` และ manifest ไม่มี entry (บันทึกใน `patches/desktop/README.md`) |
| provider ของ Copilot/Claude/Codex ใน desktop | ถอดแล้ว | `patches/desktop/0005`–`0007` + `removals` 18 รายการใน manifest |

### 6.3 ลำดับถัดไป (เป้าหมาย: OMP ต่อครบวง)

เรียงตามสิ่งที่ยัง **block "OMP ต่อครบวง"** มากที่สุดก่อน:

1. **S2 ก้อนสุดท้าย — composer ส่งงานถึง OMP** (สูงสุด): ส่ง prompt จาก composer →
   host → stream กลับเข้า transcript ของหน้าต่าง Agents (อ้าง §7 S2 "ยังขาด") และผูก
   model picker ให้อ่าน catalog จาก OMP จริง · ปิดช่องนี้แล้วหน้าต่าง Agents จะเป็น
   surface ที่ใช้งานได้จริง ไม่ใช่แค่แสดง session
2. **S3 — ถอด webview shell** ตาม inventory ใน §6.2 (ย้าย token 320 keys ไป
   `caret-theme.ts` ก่อน แล้วลบ shell/CSS/contribution/เทสต์) · exit gate คือ
   `rg "webview.ts|TASK_WEBVIEW_CSS"` = 0 และ suite ผ่าน
3. **S4 — parity ที่เหลือของ Apps panel + sidebar**: `Review`/`File` ยังเปิดเป็นแท็บ
   editor ของ group (ยังไม่ host ใน pane) และ sidebar ยังขาด Projects/Repositories/Search
   ตาม §3 · ใบเสร็จล่าสุดของ Apps panel: `evidence/agent-home-apps-panel-2026-09-15/`
4. **S5 — mobile continuity**: iPhone เป็น projection ของ session เดียวกัน
   (relay/approval/replay) — ยังไม่เริ่ม

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
  `Models, sign in to use Copilot` (ปิดแล้วใน S4 slice 2, patch `0016` — ดูด้านล่าง);
  หน้าต่าง Agents ยังมี editor group
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

**S4 เริ่มแล้ว — ปิดได้ 4 แถว, ยืนยันด้วยรันจริง** (2026-09-14)

- `patches/desktop/0015` (7 ไฟล์ ใต้ `src/vs/sessions/**` เท่านั้น → หน้าต่าง IDE ไม่ถูกแตะ):
  placeholder ของ composer เหลือข้อความเดียวตาม Cursor, header entry point เป็น `IDE`
  (ทั้ง action ที่หน้าต่างนี้ register จริงและ widget hover), ปุ่ม sidebar `New` → `New Chat`,
  และ `sessions.developerJoy.enabled` default `true` → `false` (ปุ่ม pet หายจากหน้าต่าง)
- **verified (dev build + `--agents` + CDP DOM)**: ข้อความหน้าต่างขึ้นต้นด้วย `IDE`,
  ไม่มี `Open in VS Code`/`Open in Editor`, composer มี `Plan, Build, / for skills, @ for context`
  และ `Pitch your idea` หายไป, sidebar เป็น `New Chat ⌘N`, element ของ pet ยังอยู่ใน DOM
  แต่ `hidden` + ขนาด 0 (มองไม่เห็น) — ใบเสร็จ [s4-agents-cursor-copy-2026-09-14](evidence/s4-agents-cursor-copy-2026-09-14/receipt.json)
- **S3 ยังไม่ทำ และรอบนี้ยืนยันหลักฐานว่าจำเป็น**: หน้าต่าง Agents ยัง mount shell ของเรา
  (ท้าย innerText คือ `window.caret-shell`, CDP target list มี webview ของ `caret.caret`)
  ⇒ §8.3 ยังไม่ผ่าน
- แถว §3 ที่ยังเปิด: sidebar vocabulary (`Sessions`/`Workspace`/`Customize` → New Chat/Search/
  Projects/Repositories + Getting Started + Dismiss), คอลัมน์ editor group, แถว project/branch/
  environment + reasoning + voice ใน composer, แถวแนะนำ + Dismiss, panels Changes/Files/
  Browser/Terminal, sidebar 280px เทียบ 255px, และการวัดที่ rig 1710×1073
- **อ้างอิงภายนอก**: `cursor.com/docs` ยืนยันว่าผลิตภัณฑ์มีสองหน้าต่างจริง — Agents Window
  (เปิดจาก editor ด้วย `Cmd+Shift+P → Open Agents Window`) และ IDE (`→ Open IDE`)
  และ "you can switch back to the editor anytime, or have both open simultaneously"
  ([/docs/agent/agents-window](https://cursor.com/docs/agent/agents-window)) ⇒ สถาปัตยกรรม 2 หน้าต่าง
  ของเราตรงกับผลิตภัณฑ์ต้นทาง

**S4 slice 2 — chrome ของหน้าต่าง Agents** (2026-09-14)

- `patches/desktop/0016` (3 ไฟล์ ใต้ `src/vs/sessions/**` เท่านั้น): ถอด label `Sessions`
  ออกจาก sidebar (Cursor ไม่มีชื่อ pane นี้ — element ยังอยู่เพราะเป็น flex spacer ที่
  header actions กับ find widget ใช้), ถอดปุ่ม `Run` + placeholder
  `Run Task is not available for this session type` ออกจาก `Menus.TitleBarCenterRight`
  (command ยังอยู่ที่ palette + F5), และให้ model picker ของหน้าต่างนี้ประกาศ
  `isSessionsWindow: true` — ก่อนหน้านี้ไม่มีค่านี้ ทำให้ core picker ตีความ catalog ว่างเป็น
  ประตู sign-in ของ Copilot และ chip อ่านว่า `Models, sign in to use Copilot`
- **verified (dev build + `--agents` + CDP DOM, fresh profile)**: sidebar ขึ้นต้นด้วย `New Chat ⌘N`
  ไม่มี `Sessions`; title bar ไม่มี `Run Task…` (IDE ขยับมาที่ x948); ทั้งหน้าต่างเหลือ aria-label
  ที่มีคำว่า `Copilot` = 0 และ chip เป็น `Models, Auto` โดยยัง `disabled` (ไม่มี model จริงใน
  profile นี้ ⇒ เป็น fallback ของ base ไม่ใช่การอ้างว่าพร้อมใช้); หน้าต่าง IDE (launch โดยไม่มี
  `--agents`) ยัง boot ปกติ — ใบเสร็จ
  [s4-agents-cursor-chrome-2026-09-14](evidence/s4-agents-cursor-chrome-2026-09-14/receipt.json)
- **S4 ที่ยังเปิด (ใหญ่สุดก่อน)**: คอลัมน์ที่สามยังเป็น editor group ว่าง (`.part.editor` 858..1436
  + ปุ่ม `Add Tab`/`Close Editor Area` + watermark) ไม่ใช่ panel
  Changes/Browser/Terminal/File ~608px ตาม §3.2 — ต้องตัดสินใจ layout ไม่ใช่แก้ copy; ถัดมา:
  sidebar ที่ยังขาด Search/Customize/Projects/Repositories/Getting Started (ต้องมี command จริง
  รองรับทุกแถวตาม §5), แถว project/branch/environment + reasoning + voice ใน composer,
  แถวแนะนำ + Dismiss, และ geometry sidebar 280 vs 255 บน rig 1710×1073

- **S4 slice 3 — panel ขวา + composer mic** (2026-09-14): `patches/desktop/0017`
  ตั้งชื่อ control ของ panel ตาม §3.2 (`Enter Full Screen` / `Exit Full Screen` /
  `Hide Apps` ทั้งฝั่ง editor title และฝั่ง empty-group toolbar) และซ่อน
  editor watermark เฉพาะหน้าต่างนี้ผ่าน `browser/media/workbench.css` (อ้างอิงไม่มี
  watermark; ซ่อนที่ element ของ watermark ไม่ใช่ wrapper เพราะ wrapper ถือ toolbar
  ของ panel ที่ §3.2 ต้องเก็บไว้) · `patches/desktop/0018` เปลี่ยนชื่อไมค์ใน composer
  เป็น `Start voice input` ตาม §3.2 — **verified (fresh profile + CDP)**: watermark
  `display:none` (เดิม flex 272×859), toolbar อ่าน `Hide Apps` (เดิม `Close Editor Area`),
  mic aria เป็น `Start voice input`; ทั้งสอง patch อยู่ใน `src/vs/sessions/**` เท่านั้น
  และมี test pin ข้อความ+digest — ใบเสร็จ
  [s4-agents-app-panel-2026-09-14](evidence/s4-agents-app-panel-2026-09-14/receipt.json)
- **S4 ที่ยังปิดไม่ได้ด้วย copy (ต้องตัดสินใจ/สร้าง surface)** — *บางส่วนถูกแทนที่แล้วโดย
  D1–D5 ด้านล่าง (panel ขวาเป็น Apps panel ของ Caret ที่มีแถบเดียว, tab ต่อ instance,
  browser + terminal host ใน pane): สรุปที่เหลือจริง ๆ คือ `Review`/`File` ยังเปิดเป็นแท็บ
  editor ของ group และ `Add Tab` ยังเป็นข้อความของ core* — panel ขวายังเป็น editor group
  ไม่ใช่ Apps panel แบบ tab คงที่ (Changes/Browser/Terminal/File + `Open new tab menu`) —
  tab strip ของเราจะโชว์เฉพาะ tab ที่เปิดจริง และหน้าต่างนี้ไม่มี Terminal editor เลย;
  `Add Tab` เป็นข้อความของ core ที่ใช้ร่วมกับหน้าต่าง IDE จึงเปลี่ยนไม่ได้โดยไม่มี seam;
  composer ยังขาด reasoning popup (`High`) และแถว project/branch/`This Mac`
  (branch combo ยังไม่ต่อสาย — `branchPicker.ts` ใช้แค่ใน automation dialog);
  sidebar ยังขาด Search/Projects/Repositories/Getting Started (Projects/Repositories/Search
  ยังไม่มี surface จริงในหน้าต่างนี้ และ §5 ห้ามปุ่มหลอก — ส่วน `Customize` มี command จริง
  `sessions.customization.overview` ยกขึ้น sidebar ได้); idea rows + Dismiss ยังไม่มี;
  pet ยังอยู่ใน DOM (ซ่อน) และยังไม่ได้วัด geometry บน rig 1710×1073

- **S4 slice 4 — Customize ย้ายเข้า sidebar** (2026-09-14): `patches/desktop/0019`
  เปลี่ยน default ของ `chat.agentSessions.customizationEntryPoints`
  (`product.quality !== 'stable'` → `false`) เพราะ setting นี้ *คือ* ตัวเลือกที่ฐานมีอยู่แล้ว
  ระหว่าง "composer/header" กับ "sidebar ของหน้าต่าง Agents" และ §3 ระบุ `Customize`
  ไว้ใน sidebar — **verified (fresh profile + CDP)**: `.sessions-customize-trigger`
  ใน composer เหลือ 0×0 ใน slot ที่ `display:none` ขณะที่
  `.agent-sessions-customizations-section` ใน sidebar แสดง 129px พร้อมหัวข้อ
  `Customizations` (ก่อนหน้านี้ section ถูกถอดออกจาก sidebar) — เป็น patch เดียวที่แตะ
  `src/vs/workbench/**` จึงเป็นเพียง default ของ setting หนึ่งบรรทัด และ consumer
  ทุกตัวอยู่ใต้ `src/vs/sessions/**` (หน้าต่าง IDE ไม่ถูกแตะ) — ใบเสร็จ
  [s4-customize-sidebar-2026-09-14](evidence/s4-customize-sidebar-2026-09-14/receipt.json)

- **Agent Home visual sprint — slice 3 (composer starters)** (2026-09-15):

  `patches/desktop/0023` ให้ empty home มี **starter rows ใต้การ์ด composer** ตาม
  reference — Caret มี surface นี้อยู่แล้ว (`INewSessionComposer` render prompt options
  และ insert prompt ลง input พร้อมเลือก placeholder ให้) แต่ base โชว์เฉพาะเมื่อ
  onboarding tour `sessions.onboarding.newSessionViewV3` ทำงาน ซึ่งติด experiment flag
  ของ Copilot + trigger "ไม่มี session ล่าสุด" → หน้าต่าง Agents จึงไม่เคยแสดง
  patch นี้ต่อ controller ตรง ๆ และ **ไม่เขียน copy ใหม่**: สาม starters เป็น string
  เดิมของ base (implement a feature / fix a bug / fix CI) ที่ export ออกจากไฟล์เดิม
  แทนการคัดลอก + CSS พาการ์ดไปที่ความสูง 104px ตาม reference (103.5) และวาง starters
  ใต้การ์ดเป็นบรรทัดเดียวต่อแถว — **verified (dev build + CDP)**: การ์ด 608×104,
  starters 3 แถว แถวละ 28px ใต้การ์ด 12px, digest
  `02849c3be4daa67618080567195720bb73b4413d4a2e4147d60f705b32f0b8ab` pin ในเทสต์
  — ใบเสร็จ [agent-home-visual-2026-09-14](evidence/agent-home-visual-2026-09-14/receipt-composer-starters.json)
  · ตอนนั้นยังไม่ทำ chip ของแถว context — slice 4 (`0024`, ด้านล่าง) ทำต่อแล้ว
  · **ยังขาด**: chip effort `High` (ต้องมี provider config action = ช่อง S2 เดียวกับ
  model picker) และ chip `Plan New Idea`/`Multitask` (ไม่มีแนวคิดนี้ในโค้ดเลย ต้องออกแบบ
  composer mode ใหม่) · เทียบจำนวนแถว: reference 4 แถว, Caret 3 แถว (ชุดที่ base มีจริง)

- **Agent Home visual sprint — slice 4 (context row)** (2026-09-15):

  `patches/desktop/0024` เติม chip ในแถว context ของ composer ตาม reference:
  **chip branch** อ่าน `session.workspace.folders[0].gitRepository.branchName`
  (ค่าเดียวกับที่ action ของ base อ่าน) แล้วคลิกเพื่อเรียก command จริง
  `sessionsViewPane.agentHost.copySessionBranchName` (copy ชื่อ branch — tooltip เขียนว่า
  Copy branch ไม่ได้อ้างว่าสลับ branch ได้) และ **ไม่ render ถ้าไม่มี branch**;
  **chip runtime** แสดง `This Mac` เฉพาะเมื่อไม่มี remote agent host เชื่อมต่ออยู่
  (`IAgentHostConnectionsService.connections`) เป็น label ไม่ใช่ปุ่ม เพราะยังไม่มี
  target picker ให้เปิด — **verified (dev build + CDP)**: chip `This Mac` 83×24 อยู่ในแถว
  picker (608×24 ที่ y=292), การ์ด composer 608×104, starters 3 แถว, digest
  `64ae402719c59eaa6aa77a3de545b0b16895db0462f2d931f90119ff74ccf7e1` pin ในเทสต์
  — ใบเสร็จ [agent-home-visual-2026-09-14](evidence/agent-home-visual-2026-09-14/receipt-context-row.json)
  · **ยังไม่ยืนยันสด**: chip branch (โปรไฟล์ทดสอบไม่มี workspace เปิดในหน้าต่าง Agents;
  เส้นทาง IDE→Agents handoff launch ไม่ทัน boot ในเวลาที่มี — บันทึกว่า "ไม่ได้ทำ"
  ไม่ใช่ "ผ่าน") · **ยังขาด**: chip `High` (provider config action = ช่อง S2) และ chip
  `Plan New Idea`/`Multitask` (ไม่มีแนวคิดในโค้ด) · reference มี chevron บน chip ส่วน
  ของ Caret ใช้ icon และไม่มี chevron

- **Agent Home visual sprint — slice 5 (title bar regions)** (2026-09-15):
  `patches/desktop/0025` ย้ายปุ่มตามที่ผู้ใช้สั่ง และทำให้ตรง reference:
  **ซ้าย** = [Toggle Side Bar][Go Back][Go Forward] (เดิม back/forward มาก่อน sidebar)
  **ขวา** = [IDE][Show Panel][Toggle Side Panel] (เดิม IDE อยู่ขวาสุด) — แก้ที่
  `browser/parts/titlebarPart.ts` (mount nav ไป `.titlebar-left`, open-in-VS-Code ไป
  `.titlebar-right`) + `browser/parts/media/titlebarpart.css` (order 1/2 ฝั่งซ้าย และ
  1/2/3 ฝั่งขวา) — **verified (dev build + CDP)**: ซ้าย `Toggle Side Bar @84,
  Go Back @112, Go Forward @135`; ขวา `IDE @1337, Show Panel @1365, Toggle Side Panel
  @1388`, digest `9c305dbf41f73fcd102764f19370cbd2220bcd989acd7a64ce305c8ee67f0ff2`
  — ใบเสร็จ [agent-home-visual-2026-09-14](evidence/agent-home-visual-2026-09-14/receipt-titlebar-regions.json)
  · **สำคัญ**: ครึ่งแรกของงาน (mount toolbar เข้า left/right) ค้างอยู่ใน desktop checkout
  แบบ **ไม่มี patch ครอบ** — สแกนไฟล์ dirty ใน `src/vs/sessions` ทั้ง 51 ไฟล์ เจอไฟล์ที่
  ไม่มี patch ครอบแค่ 2 ไฟล์นี้ ⇒ patch นี้ปิดช่อง reproducibility ด้วย (ก่อนหน้านี้
  `prepare-desktop` บน checkout สะอาดจะให้ title bar ที่ไม่มี placement นี้)
  · **ยังเหลือ**: reference ไม่มีปุ่ม Show Panel/Toggle Side Panel เลย แต่ของเรามี
  เพราะใช้ layout action ร่วมกับ IDE (จะถอดต้องตัดสินใจว่าหน้าต่าง Agents ซ่อนได้แค่ไหน)

- **ผลสืบสวนงาน composer ที่เหลือ (2026-09-15)** — ยังไม่ปิด แต่รู้แน่แล้วว่าติดอะไร:
  1. **branch chip** ยังพิสูจน์สดไม่ได้เพราะใส่ workspace เข้าหน้าต่าง Agents ไม่ได้ในรอบนี้:
     `--folder-uri` เปิดเป็นหน้าต่าง IDE (จาก `app.ts` ที่ `args['agents']` ชนะ),
     เส้นทาง IDE→Agents handoff (launch ด้วยโฟลเดอร์) ไม่ยอม expose debug port ภายใน 60 วิ,
     และ workspace picker ในตัว composer เปิดได้จริง (พบว่ามันเป็น action-list widget
     `.context-view .action-widget` ที่มีช่อง Search) แต่ในโปรไฟล์ใหม่มีแค่ตัวเลือก
     `Remote` ไม่มี recent folder ให้เลือก ⇒ ต้องมี recent workspace หรือ handoff ที่ boot สำเร็จ
     · เครื่องมือที่เพิ่มรอบนี้และใช้ต่อได้: `launchctl submit -l caret-agents-dev -- …`
     ทำให้แอปรันแบบ detached (แก้ปัญหาแอปตายเมื่อ session ของ tool จบ) และโหมด
     `mouse` ใน `/tmp/cdp2.mjs` (CDP `Input.dispatchMouseEvent`) ที่ picker ตอบสนอง
     ขณะที่ synthetic DOM events ไม่พอ
  2. **chip `High` (effort) / model picker** — action ที่ใช้อยู่มีอยู่แล้ว:
     `modelPicker.ts` register `sessions.modelPicker` เข้า `Menus.NewSessionConfig`
     และ `newSessionConfigToolbars.ts` สร้าง toolbar นั้นใน composer จริง แต่คอมเมนต์ใน
     `newChatInput.ts` ระบุว่า visibility ขึ้นกับ context key ของ provider
     (`isActiveSessionBackgroundProvider`, `isNewChatSession`) และตัว picker ซ่อนตัวเอง
     เมื่อไม่มี model ⇒ **ติดที่ provider ของ OMP ต้องส่ง model/effort มา** ไม่ใช่ UI patch
  3. **quick-action chips (`Plan New Idea`/`Multitask`)** — grep ทั้ง tree ไม่มี
     `PlanMode`/`composerMode`/`Multitask` เลย ⇒ ต้องออกแบบ composer mode ใหม่
     (state + behaviour) แล้ว chips จึงจะไม่ใช่ปุ่มหลอก; ยังไม่มีอะไรให้ต่อสาย


- **S4 slice 5 — pet ไม่ mount เมื่อปิด easter egg** (2026-09-14): `patches/desktop/0020`
  แก้ 3 จุดใต้ `src/vs/sessions/**` (ไม่มี core) เพราะ "register host" คือสิ่งที่สร้าง pet
  จริง ๆ (DOM/listener/timer/a11y node) และ unregister ทำได้แค่ park ตัวที่สร้างแล้ว —
  `chatView.ts` AND setting เข้ากับ host-preference observable, `newChatInput.ts`
  register จาก autorun ที่ตาม setting, `newChatWidget.ts` mount ปุ่ม aquarium toggle
  เฉพาะเมื่อเปิด — **verified (fresh profile + CDP)**: `[class*=chat-pet]` = 0 node,
  `[class*=aquarium]` = 0 node และ string `chat-pet`/`aquarium` ไม่ปรากฏใน `body.innerHTML`
  เลย (เดิมมี overlay + ปุ่ม toggle 0×0 ค้างอยู่) — ยังไม่มี automated DOM test ในรีโป
  (ต้องใช้ component-fixture infra ของ desktop) บันทึกเป็นช่องว่างไว้ ·
  **geometry 1710×1073 ยังวัดไม่ได้ในรอบนี้**: renderer ไม่มี API ย่อ/ขยายหน้าต่าง และ
  `Browser.getWindowForTarget` ผ่าน CDP ของ Electron ไม่ตอบ ต้องรันมือ (ดู receipt)

- **Agent Home visual sprint — slice 1** (2026-09-14): `patches/desktop/0021` แทน
  editor group ว่างฝั่งขวาด้วย **Caret utility pane** ที่มี 4 การ์ด launge
  (Changes/Browser/Terminal/File) ซึ่งแต่ละใบเรียก command จริงที่ Caret มีอยู่แล้ว
  (`newChangesTab`, `newBrowserTab`, `toggleTerminal`, `quickOpen`) และกำหนดสัดส่วน
  สามคอลัมน์ตาม reference (sidebar 255px, utility 22.5%) + จำกัดความกว้าง composer
  เป็น 608px กลางคอลัมน์ตาม reference — **verified (dev build + CDP บนหน้าต่างจริง)**:
  sidebar 255×861, center 853 (59.4%), utility 324 (22.6% เทียบ reference 22.5%),
  composer 608×86 อยู่กลาง, การ์ด 2×2 ที่ 1153/1290 × 350/487 ขนาด 129×129,
  ไม่มี tab strip ของ editor และไม่มี blank canvas — screenshot
  [agent-home-visual-2026-09-14](evidence/agent-home-visual-2026-09-14/) ·
  **หมายเหตุ**: ไฟล์ screenshot อ้างอิงสองไฟล์ที่สั่งให้ใช้ไม่ได้แนบมาเป็นไฟล์
  (มีแต่ข้อความ) จึงยึดค่าที่บันทึกใน `docs/caret-ui-reference-baseline.json` เป็น
  baseline และ **vision check ทำไม่ได้ในรอบนี้** (เครื่องมืออ่านภาพตอบ HTTP 429)
  ส่วนที่ยังไม่ทำในสไลซ์นี้: sidebar nav rows/Projects/Repositories/Getting Started/
  profile, แถว project·branch·runtime + chips + suggestion rows ใน composer,
  และการถอด widget `Show Sessions` ออกจาก titlebar

- **Agent Home visual sprint — slice 2** (2026-09-14): `patches/desktop/0022` ทำ
  titlebar + sidebar + สัดส่วนคอลัมน์ (1) ไม่ mount `SessionsTitleBarContribution`
  อีกต่อไป → widget `Show Sessions` ที่กว้าง 448px กลาง titlebar หายไป (ไฟล์นี้ถูกโหลด
  เฉพาะ Sessions workbench, IDE ไม่เคยมี widget นี้) (2) sidebar ได้ navigation ตาม
  reference: แถวเต็มความกว้าง New Chat/Search/Automations/Customize, ส่วน Projects
  (มีแถว `New Project` จริง + ปุ่ม `+` ที่ header), ส่วน Repositories (สร้างจาก
  workspace folder จริง, มี filter ที่กดแล้วเปิด input กรองแถวจริง + ปุ่ม add)
  — sidebar จบที่สองส่วนนี้ตาม reference — ทุกแถวเรียก command ที่มีอยู่จริง
  และถอด `.agent-sessions-header-row` (ปุ่ม New Chat เล็ก + filter/find) กับ
  `.agent-sessions-customizations-section` ออกจาก DOM (3) เปลี่ยนสัดส่วน sidebar/utility
  เป็น share ตาม reference (15.625% / 22.51%) (4) utility pane ไม่วาด header/toolbar/
  divider ใน empty home แล้ว (title strip `display:none` rect 0×0) — **verified
  (dev build `VSCODE_DEV=1` + CDP)**: command-center width = 0, nav 4 แถวเรียงถูก,
  ไม่มี detached Customizations, ไม่มีปุ่ม New Chat เดิม, การ์ด 75×60 CSS (150×120
  captured เทียบ reference 148×120), filter toggle เปิด/โฟกัส/รีเซ็ตจริง, divider ratio
  15.669%/22.563% เทียบ reference 15.625%/22.510% ⇒ แปลงเป็น 321/1586 captured
  เทียบ 320/1587 — ใบเสร็จ + geometry
  [agent-home-visual-2026-09-14](evidence/agent-home-visual-2026-09-14/receipt-slice-b1.json)
  · **ยังเหลือ**: ที่ขนาดหน้าต่างของ reference เอง (CSS กว้าง 1024) divider ได้ 340/1440
  ไม่ใช่ 320/1587 เพราะ minimum ของ part ใน `src/vs/workbench/**` (sidebar 170, editor
  300) clamp share ไว้ — สัดส่วนตรงเป๊ะเมื่อหน้าต่างกว้างเกิน ~1330 CSS px; titlebar สูง
  35 CSS vs reference ~23.5; repository rows ว่างเพราะโปรไฟล์ที่ทดสอบไม่มี workspace เปิด
  (สั่งเปิด folder ให้หน้าต่าง Agents จาก CLI ไม่ได้ — `openAgentsWindow` ส่ง folder ต่อ
  เฉพาะ path ของ protocol link และ `--folder-uri` เปิดเป็นหน้าต่าง IDE แทน); Search
  ยังใช้ `sessionsViewPane.find` ไม่ใช่ full-text; และ **vision check ยังทำไม่ได้**
  (เครื่องมืออ่านภาพตอบ HTTP 429 สองครั้งในรอบนี้ + ไฟล์ screenshot อ้างอิงไม่ได้แนบมา
  ซึ่งตรวจซ้ำแล้วทั้ง attachment dir, ทั้ง tree และ ~/Desktop) · patch 0022 ถูกสร้างใหม่
  จาก baseline สะอาดในรอบนี้ เพราะไฟล์ที่ค้างอยู่ถูก shell loop เขียน header เป็น
  `+++ b/$f` ทำให้ `prepare-desktop` fail — digest ใหม่
  `47e89b156cd24c2d6c79980af5bb6be46da1ba5ef27a0e026ab0c2c2e71719d3` ถูก pin ในเทสต์

- **slice B1 — แก้การ์ด launcher หลังได้ screenshot จริง** (2026-09-15): ผู้ใช้ส่ง
  screenshot ของหน้าต่าง Agents + IDE ของ Cursor มาเป็นไฟล์จริง (3420×2224 = CSS
  1710×1112 ที่ DPR 2) จึงวัดด้วย `scripts/image-ocr.swift` + `scripts/png-pixel-probe.py`
  (vision model ยัง 429) แล้วพบว่า **ขนาดการ์ดที่ทำไว้ผิด**: reference มีการ์ด 121×96 CSS
  ช่องไฟ 13 (grid 255×205) ไม่ใช่ 75×60/7 — เพราะตัวเลขในสเปก (148×120 captured ที่
  2048×1331) คือ *ภาพเดียวกันที่ย่อจาก 3420 เหลือ 2048* ไม่ใช่ device pixel ของจอ 2x
  (148 × 3420/2048 = 247 device px = 123.5 CSS) · แก้ `agentHomeNav.css` แล้ววัดซ้ำที่
  ขนาดหน้าต่างเดียวกัน: **การ์ด 121×96 ช่องไฟ 13 grid 255×205, sidebar 267 CSS
  (reference 267 เป๊ะ), utility เริ่ม 1321 (reference 1325 — ห่าง 4 CSS จาก gutter
  ขวาของ workbench ที่กิน 1706 จาก 1710)** ⇒ ทั้ง share และขนาดการ์ดตรง reference แล้ว ·
  ข้อขัดแย้งที่พบและปิดแล้ว: reference **ไม่มี** Getting Started card และ **ไม่มี**
  แถว profile/settings แต่ §5.4/§5.5 ของสเปกสั่งให้มี — **ผู้ใช้เลือกตาม Cursor**
  จึงถอดทั้งสองบล็อกออก (ความสามารถเปิดโฟลเดอร์ยังอยู่ที่แถว `New Project`,
  ปุ่ม `+` ของ Projects และปุ่ม add ของ Repositories) และเทสต์ pin การไม่มีไว้
  — เหลือ composer row ที่ reference มี `caret v Select branch v This Mac v` + chips
  `Plan/Build` + `High` + 4 suggestion rows เป็นงานสไลซ์ถัดไป (มีพิกัดจริงเทียบแล้ว)

- **สืบสวน: ทำไม Terminal/Browser/File ถึงไม่เปิดเป็น tab ฝั่งขวา** (2026-09-15):
  ผู้ใช้ขอให้การ์ดสามใบเปิดเป็น tab ใน pane ขวา (ตอนนี้ลง panel ล่าง) — ผลที่วัดได้:
  · การ์ด Terminal เรียก `workbench.action.terminal.toggleTerminal` → วัดสดได้
  terminal ลง `.part.panel` ที่ `[225,600,1211,296]` (ล่าง) จริง
  · **ต้นเหตุเชิงโครงสร้าง**: หน้าต่าง Agents **pin** setting
  `terminal.integrated.defaultLocation` ไว้ที่ `'view'` แบบ `readOnly` ใน
  `src/vs/workbench/contrib/terminal/common/terminalConfiguration.ts`
  (`agentsWindow: { default: 'view', readOnly: true }`) — setting นี้คือสวิตช์
  "terminal เกิดเป็น editor tab" แต่ไฟล์เป็น core (นอกขอบเขต `src/vs/sessions/**`)
  · ลองเปลี่ยนการ์ดไปใช้ `workbench.action.terminal.createTerminalEditor`
  (คำสั่งจริงที่สร้าง terminal ใน editor area) แล้ว **ไม่เกิด terminal เลย** —
  วัดได้ editor group มี 1 กลุ่ม, tab 0, ไม่มี element ของ terminal ⇒ surface
  เทอร์มินัลของ sessions workbench ยังไม่รองรับ location แบบ editor
  · จึง **ย้อนการ์ดกลับเป็น `toggleTerminal`** เพื่อไม่ให้การ์ดตาย (ยืนยันแล้วว่า
  เปิด panel ได้เหมือนเดิม) และ recompute patch 0021 + manifest + เทสต์แล้ว
  · **ทางเลือกที่จะทำต่อได้**: (A) เปลี่ยน pin ใน core จาก `'view'` → `'editor'`
  (หนึ่งบรรทัด, แนวเดียวกับที่ patch 0019 เคยแตะ core เป็นข้อยกเว้นที่บันทึกไว้)
  แล้วตรวจว่า `toggleTerminal` ตาม defaultLocation จริง; หรือ (B) ไล่ใน
  `sessionsTerminalContribution` ว่าทำไม `createTerminalEditor` ไม่ทำงานในหน้าต่างนี้
  (น่าจะจำกัดให้ terminal อยู่ได้แค่ panel view) — ยังไม่ได้เลือกทาง
  · **ทดลองทาง (A) แล้ว ไม่พอ** (ผู้ใช้เลือก A): เปลี่ยน
  `agentsWindow: { default: 'view' }` → `'editor'` ใน core แล้ววัดสด 3 คำสั่ง —
  `toggleTerminal` ยังลง panel (`terminalInPanel: true`, panel `[225,600,1211,296]`),
  ส่วน `terminal.new` และ `createTerminalEditor` **ไม่สร้าง terminal เลย**
  (panel `[0,0,0,0]`, editor group 1 กลุ่ม tabs 0, `.terminal-outer-container` 0)
  ⇒ ตัวจำกัดไม่ได้อยู่ที่ setting แต่อยู่ที่ integration ของ terminal ใน sessions
  workbench ซึ่งอนุญาตให้สร้างได้เฉพาะ view (panel) จึง **ย้อนทั้งสองอย่างกลับ**
  (core คืน `'view'`, การ์ดคืน `toggleTerminal`) ให้สถานะกลับไปเท่ากับที่ verify ผ่าน
  ล่าสุด — ทางที่จะได้ผลจริงคือ (B) หรือออกแบบ surface ใหม่ใน pane ขวา
  · Browser (`NEW_BROWSER_TAB_COMMAND_ID`) และ File (`workbench.action.quickOpen`)
  ยัง **ไม่ได้ตรวจสด** ในรอบนี้ (คลิก Browser แล้ว harness ค้าง) — File น่าจะลง
  editor group ขวาอยู่แล้วเพราะ quickOpen เปิดใน active editor group

- **B: ไล่จนเจอต้นเหตุทั้งหมด แล้ว (2026-09-15)** — ใช้ command palette ที่ขับด้วย
  CDP trusted keyboard (`/tmp/cdp2.mjs keys`) ยิงคำสั่งจริงในหน้าต่างที่รันอยู่:
  · `Terminal: Create New Terminal` **ทำงาน** → panel โผล่ `[225,600,1211,296]`
    และมี terminal อยู่ข้างใน ⇒ การสร้าง terminal + profile/cwd ปกติดี
  · `Terminal: Create New Terminal in Editor Area` → **ไม่มีอะไรเกิดขึ้นเลย**
    (panel `[0,0,0,0]`, ไม่มี tab, ไม่มี `.terminal-outer-container`, ไม่มี error/log)
  · `Terminal: Create New Terminal in Editor Area to the Side` → **ขนาดกลุ่ม editor
    เปลี่ยน** (กว้าง 322 → 444) แต่ **ไม่มี terminal render** ⇒ การสร้างเริ่มทำงาน
    แต่ pane ของ terminal editor ไม่ถูกแสดง
  · ตรวจแล้วว่า pane ถูก register ใน entry นี้จริง: `terminal.all.js`
    → `terminal.contribution.js` register `EditorPaneDescriptor(TerminalEditor)` +
    serializer + `ITerminalEditorService`
  · **ต้นเหตุเชิงโครงสร้าง**: หน้าต่าง Agents ล็อก panel ไว้ที่ล่าง **ในโค้ด** ไม่ใช่ setting —
    `src/vs/sessions/browser/workbench.ts`: `getPanelPosition() { return Position.BOTTOM }`,
    `setPanelPosition()` เป็น no-op, `getPanelAlignment()` = 'justify' และ **grid ถูก
    serialize แบบ hard-code** โดยวาง `panelNode` เป็นลูกที่สองของคอลัมน์ขวา
    (`data: [topRightSection, panelNode]`) ⇒ แม้สั่ง `View: Move Panel Right`
    ก็ไม่ขยับ (ยืนยันสด) และ `workbench.panel.defaultLocation` ถูก pin เป็น
    `agentsWindow: { default: 'bottom', readOnly: true }` ด้วย
  ⇒ **สรุป**: "ย้าย panel ไปขวา" ไม่ใช่เรื่อง setting (ต้องรื้อ grid ของ sessions
    ซึ่งเสี่ยงกับสัดส่วนคอลัมน์ที่เพิ่ง calibrate ไป) แต่ทางที่ตรงกับ Cursor จริงคือ
    **host terminal ไว้ใน pane ขวาของเราเอง** เพราะ `ITerminalInstance.attachToElement(container)`
    มีอยู่ (`terminal.ts:1286`, `terminalInstance.ts:1066`) — เท่ากับที่ Cursor ทำ
    (แท็บ `zsh` ใน pane ขวา) และอยู่ในขอบเขต `src/vs/sessions/**` ทั้งหมด
  · การทดลองทั้งหมดถูก **ย้อนกลับแล้ว** (ทั้ง pin และ `getPanelPosition`) — tree กลับสู่
    สถานะที่ verify ผ่าน (23 patches, 55 pass, ci-validate OK)

- **D: Apps panel strip — หนึ่งแถบ หนึ่งแท็บต่อ instance (2026-09-15)** — ทำตาม route D
  และปิดข้อที่ผู้ใช้ทักว่ายังไม่ตรง:
  · **terminal อยู่ใน pane ขวาจริง**: `AgentHomeUtilityEditor` สร้าง instance เองด้วย
    `ITerminalService.createTerminal({})` แล้ว `ITerminalInstance.attachToElement(container)`
    ⇒ การ์ด Terminal (และการ์ด `+`) เปิด **แท็บต่อ instance** ในแถบของ panel ไม่ใช่
    แผงด้านล่าง (วัดสด: 2 แท็บ `zsh`, 2 xterm, 1 container ที่ active ขนาด 322×788,
    `.part.panel` กว้าง 0 ตลอด; buffer ของ instance ที่ active อ่านได้
    `echo apps-tab-ok` → `apps-tab-ok`)
  · **"แท็บไม่ตรงกัน" แก้ที่ต้นเหตุ**: ก่อนหน้านี้พอมีแท็บ Browser เกิดขึ้น
    editor group จะวาด title strip ของตัวเอง (แถวบน) ขณะที่ panel วาดแถบของตัวเอง
    (แถวล่าง) ⇒ Browser อยู่สูงกว่า terminal หนึ่งแถว · ตอนนี้ panel วาด **แถบเดียว**
    ของ pane (`:has(> .editor-container .caret-apps-panel) > .title { display:none }`)
    ⇒ ทุกคอนโทรลอยู่แถวเดียวกันที่ top 42 สูง 24 เท่ากันหมด (Review, Browser, Terminal,
    File, `zsh` ×2, `+`, toggle) และเมื่อแท็บ editor จริง active (เช่น Browser)
    panel ไม่อยู่ใน DOM จึงเหลือแถบของ group แถวเดียว (`Apps | Browser`, top 36)
  · **`workbench.editor.showTabs` ของหน้าต่าง Agents = `multiple`** (เดิม `none` → ถูกบังคับ
    เป็น single เหลือ label เดียว) เพราะ reference panel เป็น tab group · แก้ที่
    `apps/macos/src/workbench-mode.ts` + `extension.ts` และกันการอ่านค่าที่ Caret
    เขียนเองกลับมาเป็น layout ของ IDE (`AGENTS_EDITOR_SHOW_TABS`)
  · **entry เปลี่ยนเป็น `Review`** ตามที่ผู้ใช้ระบุ (ตัวเดียวกับ Changes surface เดิม
    `NEW_CHANGES_TAB_COMMAND_ID`) พร้อม `Browser`/`Terminal`/`File` เหมือนเดิม ·
    Entry ในแถบเป็นไอคอน+tooltip เพราะคอลัมน์กว้าง 322px (reference กว้างพอสำหรับ label)
    ส่วนรูป label ของ entry เดียวกันคือการ์ดใน body ตอนว่าง
  · **Toggle Pinned Summary** (แบบ Codex): ปุ่ม pin ปลายแถบ เปิด/ปิดแถบ summary
    เหนือ body ซึ่งอ่าน **session จริง** จาก `ISessionsService.activeSession`
    (title/status/branch) และบอกตรง ๆ ว่า `No active session` เมื่อหน้านี้ยังไม่มี session
  · **Show Apps** command (`caret.agentHome.showApps`): base มีแต่ครึ่ง hide (`Hide Apps`)
    ⇒ เดิมพอเปิด Browser/File ทับ panel แล้วไม่มีทางกลับ · ตอนนี้สั่งจาก palette ได้
    และการเลือกแท็บ `Apps` ในแถบของ group ก็กลับได้ (ยืนยันสดว่า terminal ยังอยู่และยังรับ input)
  · **สัดส่วนคอลัมน์คงเดิม**: คอลัมน์ขวา 324px (22.6%) — เพิ่มการคำนวณ share ใหม่เมื่อ
    *ขนาด container* เปลี่ยนเท่านั้น เพราะตอนเปิดหน้าต่างครั้งแรก layout ยังไม่นิ่ง
    ทำให้ share ถูกคำนวณจากความกว้างเก่าและออกมาเป็น 30% (430px); ลาก sash เองไม่ถูกทับ
  · ใบเสร็จ [agent-home-apps-panel-2026-09-15](evidence/agent-home-apps-panel-2026-09-15/receipt.json)
    (+ screenshot) · 570 pass, ci-validate OK

- **D2: ทุกอย่างอยู่ในแถบเดียว + `+` เลือกได้ + browser พอดี pane (2026-09-15)** — ต่อจาก D:
  · **`+` = `Open new tab menu` ของ reference**: เปิด quick pick ให้เลือก
    Review / Browser / Terminal / File (เดิม `+` สร้าง terminal อย่างเดียว)
  · **browser เป็นแท็บใน pane เอง**: `IBrowserViewWorkbenchService` →
    `IBrowserViewModel` แล้ว pane เป็นเจ้าของ bounds ของ overlay
    (`model.layout({ windowId, x, y, width, height, zoomFactor, cornerRadius })`
    จาก rect ของ container ต่อแท็บ ทุกครั้งที่ layout และ `setVisible` ตามแท็บที่ active
    + `setEditorVisible`) ⇒ หน้าเว็บ **พอดีกับ pane** (วัดสด container
    `[1113, 72, 322, 791]` เทียบ pane `x=1112 width=324`; เดิมเส้นทางแท็บ editor
    ทำให้หน้าเว็บล้นออกนอก pane)
  · **ไม่มี URL bar ใน hosted view (ยัง)**: ตอนเปิดแท็บ browser จะถาม address หนึ่งครั้ง
    แล้ว `model.loadURL()` — ลิงก์/redirect ในหน้าใช้ได้ต่อ · ถ้าต้องการ chrome เต็ม
    ขั้นถัดไปคือ mount `BrowserUrlBarWidget` เข้า pane (บันทึกใน receipt แล้ว)
  · **ยืนยันสด**: `+` → Browser → `example.com` ได้แท็บชื่อ `Example Domain`
    ในแถบของ panel (group ยังเป็นแท็บ `Apps` เดียว ไม่เพิ่มแท็บ Browser แยก)
    และ `.part.panel` กว้าง 0
  · 570 pass, ci-validate OK

- **D3: entry กับ `+` ใช้เส้นทางเดียวกัน (2026-09-15)** — ผู้ใช้ทักว่า "browser ยังอยู่
  ใน app ไม่ได้อยู่แท็บเดียวกับ terminal, file" · ต้นเหตุ: **ไอคอน Browser ในแถบ**
  ยังรันคำสั่ง sessions ที่เปิดแท็บ editor จริงใน group (มีแต่เส้นทางผ่าน `+`
  ที่ host ใน pane) ⇒ แก้ให้ entry และ `+` เรียก `runLauncher` ตัวเดียวกัน:
  entry ที่ pane host เองได้ (Browser, Terminal) เปิดใน pane เป็นแท็บต่อ instance
  · วัดสด: แถวเดียวทั้งหมด top 42 สูง 24 — `Review · Browser · Terminal · File ·
  zsh · Browser · + · pin`, group ยังเป็นแท็บ `Apps` เดียว, `.part.panel` กว้าง 0,
  container ของ browser `[1113, 72, 322, 791]`
  · **หมายเหตุ**: `Review` และ `File` ยังเปิดเป็นแท็บ editor จริงของ group
    (จะ host diff/text editor ใน pane ต้องฝัง editor เข้า pane ซึ่งเป็นงานคนละก้อน)

- **D4: browser "ไม่ทำงาน" = แท็บไม่มี URL + เมนู `+` กลางจอ (2026-09-15)** — ผู้ใช้แจ้ง
  "browser is not working (still show only tab)" และ "ปุ่ม + ขึ้นอยู่ตรงกลางจอ"
  · **ต้นเหตุที่ 1**: รายการตัวเลือกใช้ `IQuickInputService.pick` ซึ่งเป็น overlay
    กลางหน้าต่าง ⇒ เปลี่ยนเป็น `IContextMenuService.showContextMenu` ที่ผูก anchor
    กับปุ่ม (วัดสด: ปุ่ม `[1379, 42, 24, 24]`, เมนู `[1241, 90, 162, 106]`,
    items `Review / Browser / Terminal / File`) และใช้ action ชุดเดียวกับ entry
  · **ต้นเหตุที่ 2 (ตัวจริงของ "เห็นแค่แท็บ")**: ถ้าผู้ใช้ยกเลิก prompt address
    โค้ดเดิมยังสร้างแท็บที่ไม่มี URL ⇒ pane ว่าง ดูเหมือน "browser ไม่ทำงาน"
    ตอนนี้ยกเลิก/ว่าง = dispose view และ **ไม่สร้างแท็บเลย**
  · **ยืนยันว่า view เรนเดอร์จริง** ด้วย window capture ที่ composite overlay
    (`screencapture -l`) + pixel probe: โซนบนของ pane มีตัวอักษรของหน้าเว็บ
    10,806 px ของ `rgb(48,48,48)` บนพื้น `rgb(238,238,238)` ขณะที่โซนล่างของ pane
    เรียบสม่ำเสมอ · renderer อ่านกลับได้ `model.visible=true` และ bounds
    `{windowId:1, x:1113, y:72, width:322, height:791}`
  · 570 pass, ci-validate OK · ใบเสร็จ + screenshot
    `apps-panel-browser-rendering-pixels.png`

- **D5: instance ย้ายออกจาก pane + browser มี address bar ของตัวเอง (2026-09-15)** —
  ผู้ใช้แจ้ง "ปุ่ม + ยังเปิด browser ไม่ได้"
  · **`IAppsPanelModel`** (`contrib/home/browser/appsPanelModel.ts`) เป็น singleton ระดับ
    หน้าต่าง: pane attach DOM ของ instance ตอนแสดง และ detach ตอนจากไป ไม่ได้เป็นเจ้าของ
    instance ⇒ สลับ/ปิดเปิด pane แล้ว terminal + browser ยังอยู่ (เดิม pane เป็นเจ้าของ
    แล้ว dispose ไปพร้อมกัน) · สถานะใหม่ที่สร้างจะกลายเป็นแท็บ active (ไม่งั้น terminal
    ที่ไม่เคยถูกแสดงจะไม่เปิด xterm)
  · **เลิกถาม URL แบบ dialog** — แท็บ browser มี **address bar ของตัวเอง**
    (back / forward / reload / address + Enter) ⇒ กด Browser แล้วใช้งานได้ทันที
    ขนาด overlay ตาม address bar: view `[1113, 105, 322, 758]`
  · **ยืนยันสด**: `+` → Browser ได้แท็บพร้อม address bar → พิมพ์ `example.com` +
    Enter → title เปลี่ยนเป็น `Example Domain`, bounds `{windowId:1,x:1113,y:105,
    width:322,height:758}`, `visible=true`; zsh + Example Domain อยู่แถวเดียวกัน;
    group ยังเป็นแท็บ `Apps` เดียว; ย่อ/ขยาย side pane แล้วแท็บ+หน้าเว็บยังอยู่
  · **แก้บันทึกเดิมให้ตรง**: การที่แท็บหายระหว่างทางคือ agent relaunch dev build
    ด้วย `--user-data-dir` ใหม่ ไม่ใช่ layout ปิด pane เอง (บันทึกในใบเสร็จ)
  · 570 pass, ci-validate OK · screenshot `apps-panel-browser-address-bar.png`



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

### 3.2 แก้ §3 ด้วย AX ของ Cursor 3.20.17 (2026-09-14, รอบที่สอง)

§3 ข้างบนมาจากตารางที่สรุปไว้ก่อนหน้า รอบนี้ดึง **accessibility tree ของหน้าต่าง
`Cursor Agents` ที่รันอยู่จริง** (Computer Use → `@oai/sky`, เก็บดิบที่
[evidence/cursor-agents-ax-2026-09-14/cursor-agents-ax-tree.txt](evidence/cursor-agents-ax-2026-09-14/cursor-agents-ax-tree.txt))
แล้วพบจุดที่ตารางเดิมคลาดเคลื่อน ต้องยึดตามนี้:


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
