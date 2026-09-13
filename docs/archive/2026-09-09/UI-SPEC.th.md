# Caret — สเปกหน้าตาและ interaction

เป้าหมาย: high-fidelity Cursor workflows บน desktop และ mobile โดยใช้ชื่อ/identity ของ Caret เอกสารนี้เป็น design specification ไม่ใช่ UI implementation หรือ prototype ที่ใช้งานได้

## หลักฐานภาพที่ดูแล้ว

| Ref | แหล่งภาพ | สิ่งที่สังเกตโดยตรง | ขอบเขตความแม่น |
|---|---|---|---|
| V01 | [Cursor home](https://cursor.com/home) hero demo | dark Agents layout: task list ซ้าย, conversation กลาง, preview ขวา; grouped statuses, muted surfaces, compact controls | เป็น marketing demo ไม่รับรอง geometry/font ของแอปจริง |
| V02 | [Agents Window](https://cursor.com/docs/agent/agents-window), ภาพ file search/viewing เปิด full-screen | light layout: conversation/composer ซ้าย, code viewer ขวา, header/breadcrumb/editor toolbar, resize divider | ภาพเอกสารที่ย่อแล้ว; สี/px ไม่ใช่ค่าที่วัดจาก runtime |
| V03 | [Cursor App Store](https://apps.apple.com/us/app/cursor/id6767085653), screenshot ชุด iPhone | workspace task list แบบข้อความ, pinned/date groups, top search/filter, composer ล่าง; voice sheet/keyboard; image annotation; artifact/merge actions | promotional device frames; ยืนยันโครง/layout roles ไม่ยืนยัน font/radius exact |
| V04 | [Mobile docs](https://cursor.com/docs/cloud-agent/mobile) | iPad split behavior, Live Activities, cache/remote-control และ boundaries | behavior source ไม่ใช่ screenshot measurement |
| V05 | [Design Mode](https://cursor.com/docs/agent/design-mode) | element/multi-select/draw/frozen frame/voice flow | documented interaction; animation timing ยังไม่วัด |

Desktop exact build number, full light/dark screenshot set, settings รุ่น 3.11 และ iPad reference frames ยังไม่พร้อม จึงติด `UNMEASURED` ใน token ledger ไม่สร้างตัวเลขให้ดูเหมือนตรวจแล้ว ต้องปิด visual capture gate ก่อน freeze pixel-level implementation

## หลักการแยก surface

1. **Editor** ใช้ Code - OSS workbench: file navigation, document tabs, splits, terminal และ status bar; AI เป็นส่วนร่วมของ editor
2. **Agents Window** ออกแบบเพื่อหลายงาน/หลาย repo: navigation/tasks → conversation → file/diff/browser/artifact; เปิดควบคู่ Editor ได้
3. **iPhone** เน้น inbox/chat/review; ไม่มี full terminal/file explorer ใน baseline ของ Cursor app
4. **iPad** แสดง sidebar/chat/review พร้อมกันตามพื้นที่; ไม่ใช้แค่ iPhone ขยายทั้งหน้าจอ
5. **Web/dashboard** เก็บ environment/secrets/source control/MCP/admin configuration และ browser-based agent workflow
6. **Persistent assistant** มี roster/computer/memory ของตนเอง แยกจาก coding task list; อยู่ late ecosystem scope

อย่านำ typography/gradient/illustration ของเว็บการตลาดมาเป็น theme ของ IDE และอย่านำ UI ของ Paseo/Happy มาเป็น reference Cursor เพียงเพราะใช้ backend ของโครงการนั้น

## โครงหน้าจอหลัก

```text
Editor
┌─ Native title / command center ─────────────────────────────┐
│ Activity │ Explorer │ Editor tabs / documents │ Agent pane │
│   bar    │ Search   │ Code / inline edit      │ Transcript │
│          │ Git      │ Terminal / Problems     │ Composer   │
└─ Branch / diagnostics / encoding / Tab status ──────────────┘

Agents Window
┌─ Native window controls / navigation / workspace ──────────┐
│ Tasks / projects │ Conversation         │ Resource tabs   │
│ Pin / status     │ Tool cards / results │ Diff / editor   │
│ New / search     │ Draft + composer     │ Browser / demo  │
└──────────────────┴──────────────────────┴─────────────────┘

iPhone                         iPad
┌─ Back / title / search ───┐   ┌─ Sidebar ┬─ Chat ┬─ Review ─┐
│ Task list OR transcript  │   │ Tasks    │ Stream│ Files     │
│ OR focused review       │   │ Filters  │ Tools │ Diff      │
│                         │   │          │       │           │
│ Composer / action tray  │   │          │ Input │ Actions   │
└─ Safe area / keyboard ───┘   └──────────┴───────┴───────────┘
```

ภาพเป็น structural diagram ไม่กำหนดตายตัวว่าทุก task ต้องเปิดสาม pane พร้อมกัน Panel visibility/width จำตาม workspace และ restore focus หลัง toggle

## Screen inventory

แต่ละ screen ต้องมี normal/loading/empty/error/permission-denied/offline/large-content states ที่เกี่ยวข้อง รวม hover/focus/selected/disabled/pressed สำหรับ interactive controls

### Desktop Editor

| ID | หน้าจอ | องค์ประกอบ/interaction ที่ต้องตรง | Requirements |
|---|---|---|---|
| D01 | Welcome/open/recent | open/clone/recent/import choices, keyboard-first, recover missing path | IDE |
| D02 | Workspace shell | activity/explorer/search/SCM, tabs, breadcrumbs, split editor, bottom panel | IDE/SEARCH |
| D03 | Tab prediction | ghost text/multiline diff, inline location cue, bottom portal, status menu | TAB |
| D04 | Inline edit | anchored input at selection, prompt/follow-up, streaming proposal, accept/reject | EDIT |
| D05 | Editor diff/recovery | original/proposed lines, hunk actions, file actions, conflicts/checkpoints | REV |

### Agents Window และ agent pane

| ID | หน้าจอ | องค์ประกอบ/interaction ที่ต้องตรง | Requirements |
|---|---|---|---|
| A01 | Task/project navigation | grouped list, active/attention/completed icons, pin/search/new/context menu | AG-01/02 |
| A02 | Empty/new task | prompt focus, repo/branch/worker selectors, scratch project choice | AG/CLOUD |
| A03 | Composer/pickers | multiline input, attachment chips, mode/model/effort, context ring, send/stop/voice | CTX/MOD |
| A04 | Active conversation | user block, response typography, tool rows, progress, expanded child outputs | AG |
| A05 | Prompt queue/steering | pending messages, edit/remove/reorder/send-now; clear current-vs-next intent | AG-04/05 |
| A06 | Plan/debug/question | editable plan + Build, todo list, clarifying options, hypothesis/evidence cards | MOD |
| A07 | Review workspace | file list + diff, totals, staged/unstaged/task changes, commit message/actions | REV |
| A08 | PR detail | title/status/branch/checks, timeline/files/commits, comments/reviewer/merge controls | REV/SCM |
| A09 | Worktree/handoff | destination picker, branch, setup progress, conflicts, return-to-workspace | WT |
| A10 | Browser/Design Mode | address/navigation, device viewport, selected outlines, annotation toolbar | VIS |
| A11 | Subagents/approvals | child cards/detail/back-to-parent; approval arguments/scope/allow-deny | CUS/SAFE |
| A12 | Artifacts/canvas | media preview/download/source, tabs, revisions/share state, failed render | VIS/AG |
| A13 | Voice session | listening/transcribing/responding, mic/stop/text transition; no focus theft | VIS |

### Native mobile

| ID | หน้าจอ | องค์ประกอบ/interaction ที่ต้องตรง | Requirements |
|---|---|---|---|
| N01 | Pair/sign-in/device | QR/link/manual host, identity confirmation, invalid/expired/revoked connection | LOC |
| N02 | Inbox/workspaces | task rows/pinned/date groups, search/filter, status/subtitle, bottom new composer | MOB-01 |
| N03 | Create task | repo/branch/worker/model selection; prompt/attachments; missing capability message | MOB-02 |
| N04 | Chat/subagent | transcript/tool cards, child navigation, follow-up/stop/approval, jump-to-latest | MOB-03 |
| N05 | Diff/PR review | changed files selection, compact diff, hunk/context, checks/comments/merge tray | MOB-04 |
| N06 | Media/annotation | black media stage, point labels/freehand, undo/redo/clear/done, text feedback | MOB-05 |
| N07 | Voice/keyboard | dictation sheet or active voice state, native keyboard, editable transcript | MOB-06 |
| N08 | Activity/notifications | task deep links, lock-screen representation, stale/completed/revoked states | MOB-07 |
| N09 | iPad workspace | sidebar/chat/review, collapse at constrained width, Pencil/hardware keyboard | MOB-08 |
| N10 | Offline/settings bridge | cached items marked fresh/stale, reconnect banner, open dashboard settings | MOB-09/10 |

### Settings

หมวดเป็น Caret information architecture ที่ผูก behavior; ตำแหน่งเมนูของ Cursor ต้อง freeze ตาม build อ้างอิง ไม่รวม path เก่าและใหม่พร้อมกันจนกลายเป็นเมนูซ้ำ

| ID | หมวด | สิ่งที่ต้องมี |
|---|---|---|
| S01 | General/appearance | theme, text/zoom, keyboard, profile, open Editor/Agents preference |
| S02 | Providers/models | connect/status/default/model list/effort/capabilities/quota |
| S03 | Tab/inline edit | enable/snooze/languages/model/shortcuts/privacy |
| S04 | Indexing/ignore/docs | roots/status/exclusions/rebuild/source refresh |
| S05 | Rules/skills/modes | provenance/effective activation/import/create/enable |
| S06 | Subagents | roles/model/tools/isolation/local-cloud settings |
| S07 | MCP | server list/status/auth/tools/resources/config/error logs |
| S08 | Hooks | scope/type/event/timeout/trust/history/schema validation |
| S09 | Plugins/marketplaces | discovery/details/permissions/install/update/remove/version |
| S10 | Agents/devices/runtime | run mode, remote control, keep-awake, paired devices/hosts |
| S11 | Git/PR/worktrees | review trigger/depth, setup, cleanup policy, default branch |
| S12 | Data/notifications/updates | retention/export/delete/redaction, push, release channel |

### Web/dashboard และ ecosystem

| ID | หน้าจอ | สิ่งที่ต้องมี |
|---|---|---|
| W01 | Web tasks | same session list/filter/conversation model as desktop |
| W02 | New cloud task | repo/scratch/branch/model/environment/worker |
| W03 | PR/codebase review | files/commits/checks/comments/reviews/actions |
| W04 | Environments/secrets | config/start/install/network/secret refs/test setup |
| W05 | Builds | list/status/source SHA/logs/current build/failure/debug/rebuild |
| W06 | Workers/pools | host health/capacity/claim/routing/hibernate/revoke |
| W07 | Automation editor | trigger/prompt/tools/repo/policy/schedule/timezone |
| W08 | Automation runs | immutable inputs/events/cost/error/retry/disable |
| W09 | Reviews/security | findings/severity/evidence/feedback/analytics/routing policies |
| W10 | Repo hosting | create/sync/browse/search/branches/settings/apps |
| W11 | Integrations | account connection/scopes/repo routing/webhook health |
| W12 | APIs/SDK/CLI setup | keys/versions/docs/examples/scopes/revoke |
| W13 | Organization/usage | members/groups/roles/SSO/SCIM/budgets/audit/attribution |
| B01 | Persistent bots roster | new/edit/name/pin/status/share/delete |
| B02 | Bot conversation/memory | persistent instructions/history/memory edit/provenance |
| B03 | Bot computer | live view/take control/browser account attention |
| B04 | Bot settings/team setup | notifications/plugins/network/identity/retention |

## Component behavior contracts

### Composer

Draft แยก per conversation เปลี่ยน task แล้วกลับมาต้องยังอยู่ Textarea โตถึง max-height จากนั้นเลื่อนภายใน; attachment chips ไม่ดัน send button ออกจาก viewport; Enter/Shift+Enter obey configured semantics และ IME composition ไม่ส่งข้อความก่อนจบคำ

Idle → sending → queued/running → completed/failed; Stop มี label/accessibility name ต่างจาก Send ปุ่มเปลี่ยนตาม state อย่าง deterministic กดซ้ำระหว่าง acknowledgment ต้องใช้ request เดิม Tooltip แสดง shortcut แต่ไม่ใช้ tooltip เป็นชื่อ accessible อย่างเดียว

`@` picker แสดงชนิด/path/context preview; `/` picker แยก one-shot skill กับ persistent mode; Escape ปิด popover ชั้นบนสุดก่อน ไม่ยกเลิก run โดยไม่ตั้งใจ Model picker แยก engine/provider/model และ unavailable reason โดยไม่เปลี่ยน task silently

### Transcript/tool rows

Message text เลือก/copy ได้ Markdown/code/table/file link render อย่างมี max-width; virtualized history รักษา scroll anchor เมื่อ prepend history หรือ tool row expand Auto-follow เฉพาะเมื่อผู้ใช้อยู่ท้ายรายการ; scroll ขึ้นแล้วต้องไม่ถูกดึงกลับ มี unread/jump-to-latest

Tool row มี name/status/summary/duration; expand แสดง input/output และ full-output link Child run มี parent/back navigation และของมันเอง ไม่ render ทุก subagent output ซ้ำใน parent

### Diffs/approval

Diff แยก inserted/deleted/context/selected/focused states ด้วยสีและสัญลักษณ์ ค่า line/diff totals มาจาก patch ไม่คำนวณจาก transcript Inline action ต้องไม่บัง code selection; review mode ไม่เปลี่ยน staged state โดยแค่เปิดดู

Approval แสดงเป้าหมาย host/repo/tool/arguments/consequence/scope มี allow once/deny และ scope choices เฉพาะที่ engine รองรับ เมื่อ arguments/HEAD เปลี่ยน invalidate approval เดิม แสดง “ข้อมูลเปลี่ยนแล้ว” ไม่กด approve ต่อง่าย ๆ บน state เก่า

### Panes/tabs/navigation

Panel resizing มี minimum widths, keyboard access และ remembered sizes เปลี่ยน display scale/window size แล้ว clamp ไม่ให้ panel หาย Drag tab มี insertion indicator; closed active tab focus ไปเพื่อนบ้านตาม deterministic rule Resource tab ผูก source task แม้เปลี่ยน conversation

Native menu/shortcut ของ OS และ upstream editor มี priority mapping ชัด โดยเฉพาะ Cmd/Ctrl+K และ Cmd/Ctrl+Shift+D ที่อาจชน upstream chords/Debug ต้อง bind context keys ตาม surface ไม่ overwrite global command ลอย ๆ

### Mobile gestures/keyboard

ใช้ platform navigation back/sheet dismiss; pending draft/annotation ไม่หายจาก swipe dismiss โดยไม่มี recovery Bottom composer อยู่เหนือ safe area/keyboard; rotate ขณะ input/voice/review รักษา state Tappable icon มี semantic hit area ไม่ต้องเพิ่มขนาด glyph จนต่างภาพอ้างอิง

Diff horizontal scrolling ต้องไม่ชน system back gestureหรือ vertical list; code wrap เป็น setting; long path มี accessible full value Attachment preview/annotation ใช้ image-space coordinates ไม่ใช่ screen pixels

### Notifications/background

Push มี task ID + minimal preview; user เลือกซ่อนเนื้อหาได้ Deep link ต้อง authenticate แล้วเปิด target; task deleted/revoked แสดง recovery ไม่ crash ActivityKit timeline มี expiry/completed state ไม่ค้างว่า running เมื่อไม่มี heartbeat

## Visual token ledger

สิ่งต่อไปนี้ต้องมีทั้ง dark/light และ semantic states; current status = UNMEASURED ยกเว้น structural observation V01–V03 ห้ามเรียกค่าที่เสนอว่า Cursor exact token

| Token family | ต้องวัด/เก็บ | ข้อกำหนด Caret ระหว่างรอ measurement |
|---|---|---|
| App/editor/panel surfaces | exact color per surface/state, contrast | inherit Code - OSS theme roles; muted neutral palette ตาม reference |
| Border/separator/focus | thickness/color/inset/active state | separate hairline divider from focus indicator |
| Text | family, weight, size, line-height, letter-spacing | OS UI fonts + editor font configuration; ห้ามแจก proprietary font ที่ไม่ได้สิทธิ์ |
| Spacing/layout | row/padding/gaps/header/composer heights | density สม่ำเสมอ; anchored controls ไม่ขยับตาม token stream |
| Radius/shadow/material | each control/sheet/card/window | native OS shell; restrained interior surfaces |
| Icons | glyph, stroke, optical size, baseline | use permitted Code - OSS icons; Caret brand independent |
| Diff/status colors | add/delete/warning/running/attention/success | meaning encoded with icon/text too |
| Motion | duration/easing/delay/focus/scroll | respect reduce motion; pending measurement ไม่แต่ง exact timing |

## Capture และ visual acceptance protocol

ก่อน pixel freeze ต้องทำ reference set ต่อ screen state: Cursor build, OS/build, theme, display scale, window/viewport logical size, font settings, locale, timestamp และ content fixture คงที่ Capture runtime เมื่อมีเข้าถึงได้; promotional screenshots เป็นแค่ supplementary evidence

ชุด viewport ที่เสนอเพื่อทดสอบ Caret (ไม่ใช่ค่า Cursor): desktop 1280×800, 1440×900, 1920×1080 ที่ scale 1×/2×; phone widths 390/430 points; iPad full/split widths 768/1024 points และ rotation ทุก theme สำคัญ

เกณฑ์ที่เสนอ: landmark/padding deviation ไม่เกิน 2 logical px เมื่อเทียบ same-platform reference; text baseline ไม่เกิน 1 px; text wrapping/item order/icon semantics ต้องตรง; color delta วัดจาก flat regions หลัง normalize profile ไม่ใช้ JPEG marketing เป็น color truth Review shadow/antialiasing แยกจาก geometry

ต้อง overlay/diff ด้วย identical content และ mask เฉพาะ timestamp/caret/blink/animation ที่บันทึกไว้ ห้าม mask layout/text mismatch เพื่อให้ผ่าน ไม่ใช้ screenshot similarity score เดียวแทน keyboard/focus/gesture tests

Accessibility gate: keyboard-only critical flows, screen-reader names/order/state announcements, contrast/zoom/reduced motion, touch target อย่างน้อย 44pt บน iOS ตาม Caret target โดยขยาย hit area ได้โดยไม่เปลี่ยน glyph ขนาดที่เห็น

## ข้อจำกัดภาพที่เปิดอยู่

- ไม่ได้เปิด Cursor desktop application จริงหรือ iOS application session; ตรวจเฉพาะ official web/demo/App Store screenshots
- Settings menus, modal/popover animations, full dark/light mobile และ iPad ไม่มี measured reference ครบ จัดเป็น G-VIS-01 ไม่ใช่ข้อให้เดาได้
- Plan stage ทำ screen/state inventory ได้ครบตาม scope แต่ยังไม่ควรใช้คำว่า pixel-perfect specification finalized จนมี reference measurements
- หาก runtime version ปัจจุบันต่างจาก screenshot ให้เลือกหนึ่ง build เป็น baseline และเก็บ delta log; อย่ารวมหน้าตาหลายรุ่นให้กลายเป็น UI ที่ Cursor ไม่เคยมี
