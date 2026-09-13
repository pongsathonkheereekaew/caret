# Caret — Detailed UI/UX, motion และ interaction contracts

2026-09-13 · **Specification / planned implementation**, ไม่ใช่ผลทดสอบ production

เอกสารนี้ขยายและตัดสินข้อที่เป็นช่วงค่า/optional ใน [overview](CARET-UI-INTERACTION-SPEC-2026-09-13.th.md). เมื่อขัดกันในรายละเอียด UI ให้ใช้เอกสารนี้; architecture/OMP ownership และ product scope ใช้ [implementation direction](CARET-IMPLEMENTATION-DIRECTION-2026-09-12.th.md). [Coverage](CARET-UI-COVERAGE-2026-09-13.th.md) ผูก backlog/runtime กับหน้าจอ และ [validation](CARET-UI-VALIDATION-2026-09-13.th.md) กำหนดหลักฐานตรวจรับ

คำว่า **กำหนด** หมายถึง Caret design decision สำหรับ implementation ไม่ใช่สิ่งที่วัดหรือยืนยันว่า reference ทำเช่นนั้น. `Observed` มีเฉพาะรายการใน reference ledger. ทุก metric เป็น proposed acceptance budget จนกว่าจะมี receipt; feature ที่ contract ยังขาดเป็น implementation gap ไม่ใช่ให้ผู้พัฒนาเดา wire method

## D00 — Reference ledger เพิ่มเติม

ตรวจ Cursor 3.20.17 บน Mac ผ่าน Computer Use วันที่ 2026-09-13 ต่อจาก CU-01–CU-06. ไม่ส่ง agent prompt, ไม่เลือก model/permission mode, ไม่เปลี่ยน settings, ไม่ install หรือเปิดบริการเสียเงิน. ปิด settings tab ที่เปิดตรวจแล้ว; search query เป็นข้อความทดสอบใน search field เท่านั้น ไม่กดสร้าง agent

| ID | Observed interaction | สิ่งที่นำมาใช้ / สิ่งที่ไม่อ้าง |
|---|---|---|
| CU-07 | IDE → Open Cursor Settings; General มี Window Layout, Conversation Density, Review Control Location, Auto-Hide Editor When Empty, Open Chat as Editor Tabs, Window Restoration, system notifications และ completion sound | Caret ต้องระบุ default/restore/detail density; ไม่คัดลอกค่าทุก setting หรือทดสอบ save |
| CU-08 | Search เปิด command palette; tabs All/Agents/Files/Actions/Settings; input ได้ focus; Escape คืน focus ให้ Search | Caret ใช้ explicit search scopes และ return-focus contract |
| CU-09 | พิมพ์ `caret-ui-no-match-137`; result กลายเป็น New agent ตาม query; Escape ปิดโดยไม่สร้าง | Caret ไม่ auto-create/send จาก Enter ใน no-results; ให้ปุ่ม Create draft แยก ลด accidental action |
| CU-10 | Draft Chat actions มี Split Down/Right, Pin, Rename, Mark as Unread, Discard | Caret แยก discard draft/archive task/stop run ไม่ใช้ action เดียวความหมายหลายแบบ |
| CU-11 | Customize มี Plugins/MCPs/Skills/Subagents/Rules/Commands/Hooks, search, scope, New, View options; scope menu แยก User/Workspaces | Caret แสดง effective/source scope ของ OMP ไม่สร้าง config owner ซ้ำ; ยังไม่ทดสอบ install/edit |
| CU-12 | Settings ใน IDE split แคบแสดงหมวดเป็น icon rail และ settings text wrap หลายบรรทัด | Caret ใช้ label-preserving category selector เมื่อแคบ ไม่ต้องจำ icon เพื่อหา setting |
| CU-13 | กด model parameter menu เห็น Fast, Effort High และ Model; ปิดโดยไม่เลือก | แยก model identity กับ effort/service parameters; ไม่อ้างว่า OMP รองรับค่าเดียวกัน |
| CU-14 | กด environment menu เห็น Cloud, This Mac, This Mac (Remote Control), Remote Machine, New Worktree | แยก execution destination, access route และ workspace isolation เป็นคนละ decision |
| CU-15 | กด branch picker เห็น search และ selected branch; กด sidebar filters เห็น Grouping/Ordering/Show/Status/PR/Environment/Source/Archived/Collapse All/Mark All as Read | เพิ่ม filter persistence/empty/reset และ guard branch switch; ไม่ได้ checkout หรือเปลี่ยน filter |
| CU-16 | เปิด Automations → All Runs → Filter runs; เห็น empty runs, status counts 24h/7d, ownership tabs และ Automation/Status/Trigger/Tools filters | ต้องมี run history แยก schedule; unknown loading countไม่ใช่0จนข้อมูลมา; ไม่สร้าง schedule |

ภาพและ AX อยู่ใน tool log ของ task นี้ ไม่มี exported immutable reference bundle. CX-01 Codex current UI ยังถูก app safety policy บล็อก; ไม่ capture ทางอื่น. ไม่ได้ตรวจ reference live running/approval/network loss/mobile หรือ timing; ค่า geometry/motion ด้านล่างเป็น Caret proposal. Screenshot อย่างเดียวไม่พิสูจน์ animation/smoothness

## D01 — Window, routes และ deterministic layout

### Route identity

Logical routes: `projects`, `task(projectId, sessionId)`, `task/resource(resourceId)`, `ide(workspaceId, sessionId?)`, `settings(section)`, `devices`. URI เป็น design notation ไม่ใช่ endpoint ที่มีอยู่แล้ว. ทุก route มี `viewId` ของแต่ละ pane; sessionId ไม่เปลี่ยนตาม view. Window title = `<task title> — <project> — Caret`; IDE ใช้ `<active file> — <project> — Caret`. Empty draft ใช้ New task ไม่ปลอม sessionId

- Task จาก sidebar เปิดใน pane ที่ active ไม่สร้าง view ซ้ำ; Open in split เป็นคำสั่งต่างหาก. สอง views ของ task เดียวกัน subscribe owner เดียวแต่มี scroll/focus ของตนเอง
- Back/Forward คืน route+scroll ไม่ย้อน/redo agent effect. Deep link validate project/session/resource ก่อนเปิด; missing/deleted/revoked route เป็น error page มี Back/Projects ไม่เลือกงานใกล้เคียงแทน
- Agents↔IDE ใช้ **หน้าต่าง Caret เดิม** เป็น default. IDE retains native editor/workbench state; no second OMP execution. Open in new window เป็น explicit secondary command และต้อง attach same host mapping
- เมื่อเปลี่ยน project: save view state เก่าก่อน restore project ใหม่; ห้ามใช้ selected file/model/terminal ของ project เก่าเป็น fallback. no-Git project แสดง Folder แทน Branch และ Git actions อธิบายว่า unavailable
- Quit UI ไม่เท่ากับ Stop host. Close tab/view ไม่ Stop task. Stop host เป็น explicit settings operation พร้อมรายการ runs ที่กระทบและ confirmation

### Geometry resolver

ใช้ **available client content width W** หลัง native window chrome และ zoom; ไม่อิง physical screenshot pixels. Border-box รวม borders. Layout คำนวณบน text zoom ที่ใช้งานจริง; dimensions เป็น logical px (desktop) / pt (native iOS)

| W | Default Agents layout | เมื่อเปิด resource |
|---|---|---|
| ≥1200 | sidebar 240; main ที่เหลือ; work launcher อยู่ header | sidebar คงเดิม; panel preferred 360; min main 360; sash borders รวม 2px |
| 900–1199 | sidebar 210; main ที่เหลือ | collapse sidebar เป็น drawer ก่อน; right panel preferred 360; min main 360 |
| 620–899 | sidebar hidden มี Projects button; task full width | resource เป็น route เต็มพื้นที่; Back to task คืน composer/scroll; ไม่ bottom pane อัตโนมัติ |
| 320–619 | single column; condensed header; action overflow | resource full route; tabs เป็น scrollable strip + All resources menu; ไม่มี feature หาย |

Sidebar resize 200–360px; panel resize 280–640px. ใน split mode `panelMax = min(640, W − visibleSidebarWidth − 360 − 2)`. Clamp preferred widths ก่อน paint. ถ้า panelMax <280 ให้ collapse sidebar; ถ้ายังไม่ได้เปลี่ยนเป็น resource route. จำ **preferred** widths แยกจาก clamped widths เพื่อ restore เมื่อหน้าต่างกว้างขึ้น. Resize ระหว่าง focused resource ต้องไม่ unmount focused control หากเปลี่ยน route ให้ย้าย focus ที่ resource heading และเก็บ draft

Bottom resource panel เป็น user-selected layout ผ่าน Work panel → Position → Bottom; ไม่ใช่ heuristic default. Height เริ่ม 40% ของ content height, min160px, max60%; เหลือ transcript/composer รวมอย่างน้อย240px ไม่รวม header. ถ้า content height <480px ใช้ full resource route. Native IDE panel/sash ใช้ Code-OSS behavior ไม่ override ด้วย webview library

Main gutters 24px เมื่อ W≥900, 16px เมื่อ620–899, 12px เมื่อ<620. Transcript content max900px; text paragraphs max72ch, code/table/media ใช้ความกว้าง content ได้เต็ม. Empty composer max720px จัดกลาง main ในแนวตั้งที่35% เมื่อ height≥600; เมื่อมีข้อความแรก composer dock bottom **โดยไม่เคลื่อน input ระหว่าง IME** (apply หลัง compositionend). ไม่รอ slide animationก่อนส่ง

Header min46px; label wrap ได้และสูงขึ้นเมื่อ zoom. Breadcrumb metadata overflow เข้า Details menu ก่อนตัด title. Task title ellipsisหนึ่งบรรทัดพร้อม accessible full name และ Rename/Details ดูเต็มได้. Connection critical badge ไม่อยู่ใน overflow. Sidebar task rows min40px มี icon16, gap8, title+secondary12px; task titleหนึ่งบรรทัด ส่วน selected row ไม่กระพริบเมื่อ timestamp update

### Split and close

Agents เริ่มจากหนึ่ง pane; Split right/down เพิ่ม pane ตามพื้นที่จริง ไม่กำหนดเพดานสอง pane ที่ลด historical requirements. Horizontal split ต้องเหลือแต่ละ pane≥360px; vertical split ต้องเหลือแต่ละ pane≥240px รวม composerแต่ไม่รวม window chrome. หากพื้นที่ไม่พอให้ Need more space พร้อม Maximize area/Open another window ไม่บีบเนื้อหา. Layout tree serialize orientation/ratios/view IDs; menu Move left/right/up/down, Close pane, Maximize, Restore. Close active pane focus neighboring pane header; pane สุดท้ายกลับ New task view. Pin tab ไม่ใช่ pin task; labels แยกกัน. Runtime sessions ไม่จำกัดด้วยจำนวน visible panes; IDE ใช้ Code-OSS split เต็ม

## D02 — Tokens, type และ component primitives

ไม่เปลี่ยน renderer หรือเพิ่ม fonts/dependencies. Desktop ใช้ `--vscode-font-family` ต่อด้วย system-ui/-apple-system/BlinkMacSystemFont/Segoe UI/sans-serif; code ใช้ `--vscode-editor-font-family` ต่อ ui-monospace. Thai ให้ OS fallback ไม่ download typeface เงียบ ๆ. iOS ใช้ native system text styles พร้อม Dynamic Type; token sizes เป็น baseline ไม่ cap accessibility sizes

| Role | Desktop size/line-height/weight | Mobile baseline | Overflow |
|---|---|---|---|
| task/page heading | 18/26/600 | 22/30/600 | wrap; task toolbar title recoverable ellipsis |
| section heading | 14/22/600 | 17/25/600 | wrap ไม่ uppercase ไทย |
| transcript body | 15/24/400 | 17/26/400 | wrap ตาม locale, long URL break-anywhere |
| input/menu/control | 14/22/400; primary label500 | 17/24/400 | grow vertically; ไม่ scale-down เพื่อให้พอดี |
| sidebar label | 13/20/400 | 17/24/400 | ellipsisพร้อม full label access |
| metadata/caption | 12/18/400 | 13/19/400 | wrap; ไม่ใช้เป็น instruction สำคัญ |
| code | 13/20/400 | 14/21/400 | code block horizontal scroll; wrap toggle |
| counters/timers | metadata scale, tabular-nums | native monospaced digits | no width shift; ไม่ announce ทุกวินาที |

Spacing tokens 4,8,12,16,24,32. Gap ภายในกลุ่ม8 ระหว่างกลุ่ม16–24. Control radius5, card8, composer10, menu8, sheet12. Composer content inset12; nested attachment chip radius5 ห่างขอบ≥8. Borders1px; focus ring2px offset2. Elevation0 สำหรับ page/panels, elevation1 menu (`0 4px 16px rgb(0 0 0 / .16)` proposed fallback), elevation2 modal (`0 12px 36px rgb(0 0 0 / .24)`); high contrast ใช้ borderชัดไม่พึ่ง shadow. ไม่มี blurred/translucent full-window material ใน default theme

| Semantic token | Existing host mapping / fallback role | ใช้ที่ |
|---|---|---|
| `--caret-bg` | editor.background | main/transcript |
| `--caret-panel` | sideBar.background | sidebar/work panel |
| `--caret-panel-raised` | editorWidget.background | menus/dialogs |
| `--caret-input` | input.background | editable fields |
| `--caret-text` | foreground | primary text/icons |
| `--caret-muted` | descriptionForeground | secondary labels, ไม่ใช่ border |
| `--caret-border` | panel.border | separation |
| `--caret-control-border` (เพิ่ม role) | input.border; fallback contrastBorder ก่อน neutral fallback | input/control outline |
| `--caret-focus` | focusBorder | visible focus perimeter |
| `--caret-accent` / `--caret-accent-text` | button.background / button.foreground | primary action |
| `--caret-link` (เพิ่ม role) | textLink.foreground | links มี underline |
| `--caret-selected-bg/fg` (เพิ่ม roles) | list.activeSelectionBackground/Foreground | selected rows |
| `--caret-hover-bg` (เพิ่ม role) | list.hoverBackground | pointer hover |
| `--caret-danger/warning/success` | errorForeground / editorWarning.foreground / testing.iconPassed | redundant icon+label state |

นี่คือ token binding specification ไม่ใช่ผล contrast measurement. ใช้ existing theme fallbacks ใน source จน render audit; ไม่เพิ่ม hex palette โดยเดาค่าจาก screenshot. ทุก foreground/background/state pair ต้องผ่าน validation ของ light/dark/high-contrast ที่ resolved จริง; color-mix และ opacityต้องวัดหลัง composite. Third-party theme ที่ไม่ผ่านให้แสดง supported built-in theme fallback option ไม่แก้ user theme global เงียบ ๆ

### Component inventory

ทุก component มี `default/hover/focus-visible/pressed/disabled/busy/error` เฉพาะสถานะที่ applicable. Disabled capability ต้องมีคำอธิบายที่อ่านได้โดย keyboard/AT; form validation ไม่ disable submitจนผู้ใช้ไม่รู้ว่าผิดอะไร. Busy ใช้ labelเดิม+indicator และ aria-busy ไม่ spinnerแทนชื่อทั้งหมด

| ID | Component | Contract |
|---|---|---|
| C01 | Button/icon button | desktop min32×32, padding8×12; mobile44×44; primaryหนึ่ง actionต่อกลุ่ม; destructive icon+verb ไม่สีอย่างเดียว; no overlapping hit areas |
| C02 | Task/project row | main open buttonและ sibling menu button ไม่ nested buttons; status icon+text; hover actionsยังเข้าถึงได้ด้วยfocus/touch; pin/archive receiptก่อน stateสุดท้าย |
| C03 | Tabs/segmented mode | tablist roving focus, Home/End/arrows; expensive resource activation Enter/Space; selected stateไม่เท่ากับfocus; close tabเป็น accessible named control |
| C04 | Combobox/catalog | label+query+scoped results+source/status; inputไม่ resetขณะ asyncค้นหา; stale responses ignored by queryId; Escapeคืน draft cursor |
| C05 | Context/attachment chip | icon/MIME, name, upload state; remove separate buttonชื่อ Remove <name>; open previewไม่ remove; retryยังใช้ content identityเดิม |
| C06 | Message/tool card | stable eventId key; header status+summary, disclosure button; structured args/output; terminal error visibleแม้ collapsed; raw view redactedและsafe |
| C07 | Approval/form | title+scope+fields+actions+expiry; request IDในdetails; validation inline; one submitting response; denied/cancelled/staleเป็นreceiptไม่ dismissเงียบ |
| C08 | Menu/popover | width min240 max min(360,W−24); viewport clamp; maxheight min(480,H−32); scroll; anchored origin; native button/menu keyboard rules |
| C09 | Dialog/sheet | desktop width min(560,W−32); mobile full width; long content scroll, sticky footer; title/describedby; destructive defaultfocus Cancel |
| C10 | Banner/toast | persistent inline bannerสำหรับauth/offline/error; low-stakes toast5s pause hover/focus, max3 stacked; action-bearing toast persistและมีhistory |
| C11 | Splitter | visual1px; hit region8pxไม่ทับcontrols; keyboard step16px, Shift step48px, Home/End min/max; announce sizeหลังcommitไม่ทุกpointermove |
| C12 | Empty/loading state | titleหนึ่งบรรทัด+cause+next action; delayed static placeholderหลัง150ms; no fake percent; errorไม่แทนloaded contentที่ยังใช้ได้ |
| C13 | Artifact card/viewer | kind/name/size/build+source status; thumbnail reserved aspect; load independently; failureไม่ลบtranscript |
| C14 | Settings row | visible label, description, scope/effective/source, control, pending/error; resetเฉพาะoverride ไม่เปลี่ยนglobal scopeโดยอ้อม |
| C15 | Search palette | filters All/Tasks/Files/Actions/Settings; result label/path/scope; previewก่อน destructive command; no-matchไม่ execute query |
| C16 | Status badge | semantic label+icon; ready/running/waiting/stopping/completed/cancelled/failed/unknown; icon16และfixedcounter space; disconnectedคนละbadgeกับrun |

Caret Insert brandใช้ assetที่อนุมัติ; ไม่ animate brandเป็น loading spinner. ใช้ glyph setเดียวต่อtoolbar; existing Code-OSS iconsในIDEคงเดิม. Rune SVGเป็น optional shortlisted asset ไม่ install wrappers. Decorative SVG aria-hidden, meaningful controlsมีtext/accessible label; RTL mirrorเฉพาะnavigation arrow ไม่mirrorbrand/code/media timeline

## D03 — Global interaction, focus, draft และ precedence

### Event priority (จากสูงไปต่ำ)

1. Revoked authorization / stale incarnation / outcome unknown block affected side effects immediately; animationหรือcached enabled stateไม่มีสิทธิ์override
2. IME composition, focused menu/dialog/formรับkeyก่อนglobal shortcuts. กด Enterจบ composition ไม่ส่งข้อความในeventเดียวกัน
3. Pending approval/formตอบด้วยits own Submit/Allow/Deny; composer shortcutไม่ตอบแทน
4. Current task runtime+capability+delivery stateเลือก actionจากD05. No optimistic runtime completion
5. View transitions/focus/renderเป็นpresentationหลังstatecommit

Tab เดินตามDOM: sidebar navigation → task header → transcript actions → composer → work panel. Skip to task และ Focus composerมีcommand. Tool/media embedded controlsรับkeyboardตามnative; global shortcutsไม่ขโมย terminal input หรือ browser page shortcutsเมื่อfocusอยู่ข้างใน. Native IDE shortcutsยังใช้contextของCode-OSS

Dialog openจากexplicit clickย้ายfocusทันทีไปheadingหรือfirstfield; background inert. Passive incoming approval **ไม่แย่งfocusจากสิ่งที่กำลังพิมพ์**; แสดงbadge/bannerและpolite announcement; Review requestพาไปcard. Closeกลับtriggerถ้ายังอยู่ ไม่อยู่ให้กลับtaskheading. Escapeปิดtopmostmenuก่อนdialog; dismissapprovalไม่deny. Dropdownที่เปิดอยู่เมื่อtaskเปลี่ยนปิดและไม่ใช้selectionของtaskเก่า

### Draft lifecycle

Draft key = `deviceId/projectId/sessionId-or-localDraftId/viewDraftId`; paneสองอันของsessionเดียวมีdraftแยกโดยชัดว่า Draft in another pane, ไม่ mirror textแย่งกัน. Save snapshotหลังidle300ms และเมื่อ blur/route/window close; compositionยังอยู่ให้save textอย่างเดียวไม่dispatch. Crash-durabilityเริ่มหลังlocal persistent receipt; storage write failขึ้น Draft not saved และblock discard-on-closeจนผู้ใช้เลือก. Secret-bearingdraftไม่ใส่telemetry

Send freeze `draftRevision + attachmentRefs + targetSession + intent` เป็นcommand envelope. New typingหลังส่งเป็นrevisionใหม่. เมื่อACKมา clearเฉพาะrevisionที่ส่ง; ถ้ามีnewtypingอย่าล้าง. Errorเดิมกลับมาเมื่อnewdraftมีเนื้อหา ให้ Restore sent draftเป็นseparate action/compare ไม่ overwrite. Attachment removeหลังส่งมีผลต่อdraftใหม่ไม่ยกเลิกpayloadที่รับแล้ว

Task switchและIDE switchเก็บdraft, selection, composingจบอย่างปลอดภัย, scrollanchor, panelpreferredsizes, active resource. Device draftไม่syncทับกัน; Continue draft from Macเป็นexplicit copyเมื่อมีcompatiblecontent refs และไม่ overwritephone draftโดยไม่มีprompt

## D04 — S01/S02 Projects, task lifecycle, search และ header

Projects page: heading Projects, primary Open folder, secondary New task disabledพร้อม Choose a projectถ้าไม่มีproject. Recent projects rowsชื่อ/path/host/last used. Open folderผ่านnativepicker; cancel=no-op; inaccessible pathแสดง Retry/Choose folder; no-Git accepted. Git cloneเป็นseparate form URL/destination/auth scopeพร้อม progress/cancelและpartialfolder handlingตามhost receipt ไม่ลบfolderกว้างเอง

Sidebar order: New task/Search, pinned tasks, projects+tasks, archived entry; account/host/settings footer. Task sort default last user-visible activity descending; streaming token/timerไม่ reorderrowทุกevent. Running/waiting filter explicit. Rename optimisticallyแสดงpendingและrollbackได้เมื่อknownfailure; archiveไม่Stoprun ต้องconfirmationเมื่อrunningระบุ Work continues; hidden running taskยังนับattentionbadge. Deleteถ้าbackendไม่มีไม่แสดงเป็นenabled; Discard draftไม่เท่ากับDelete session. Unreadstatusเปลี่ยนเมื่อviewvisibleและlatesteventrenderedไม่ใช่เพราะsubscribeอยู่

New taskสร้างlocaldraftก่อนdispatch. Project/worktree selectorอยู่เหนือcomposerพร้อมhost. Switchingprojectในnewdraftที่มีcontextถาม Remove incompatible attachments / Cancel; textคงอยู่. Existingtaskห้ามเปลี่ยนprojectด้วยdropdownตรง ๆ;ใช้Fork to workspace flow. Sessionforkแสดงsourceevent/checkpointและworkspaceeffect; create/resume receiptแล้วnavigate, failureอยู่หน้าต้นทาง

Searchค้นdebounce150msหลังcompositionend; cache resultsแสดงกำกับUpdating; noresults = “ไม่พบผลลัพธ์” + Clear filters + Create draft from query เป็นexplicitbutton. Enterบนnoresultsไม่มีผล. Resultscopeแสดงprojectทุกแถวที่อาจคลุมเครือ. ClickfileเปิดIDEselection; taskเปิดtask; actionที่เปลี่ยนstateเปิดconfirm/formตามความเสี่ยง; Escคืนsearchtriggerและselectedtaskไม่เปลี่ยน. Searchindexofflineแสดง Last indexedและจำกัดclaimsตามcache

Headerleft: sidebarbutton/title/project; right: connection badge, work panel, IDE/Agents, More. MoreมีRename/Pin/Mark unread/Fork/Archive/Details. Branch/worktree metadataในDetailsเมื่อพื้นที่ไม่พอ; full path copyได้. RunningtaskมีStopในcomposerคงที่ไม่อยู่แค่More. Disconnectแสดงlast knownstatus/time, ไม่แสดงReadyโดยfallback

## D05 — S03 Composer exact action matrix

Desktop default **Enter sends** และ Shift+Enter newline ตามCaretเดิม; preference Submit with Cmd+Enterทำให้Enter=newlineและCmd+Enter=primary action. เมื่อตั้งpreferenceนี้ explicitQueueยังใช้button/menu ไม่ reuseCmd+Enterเป็นfollow-upอีก. Default mode Cmd+Enter=Queue follow-up **เฉพาะrunning**; idle=Send (แสดงhintตามstate). iOS software Return=newlineเสมอ; Sendเป็นbutton. Shortcutbindingเป็นUI intent ไม่ใช่wire method

`usablePayload` = nonwhitespace text ORอย่างน้อยหนึ่งready attachmentที่selectedmodelรับได้; slash commandที่runtimeประกาศใช้schemaของcommand. Pending uploads block whole dispatch; no partial silent send. Form actionเปิดอยู่รับEnterก่อนcomposer

| Effective state | Primary label / Enter default | Queue button | Steer button | Stop button | Model/config |
|---|---|---|---|---|---|
| no project/session target | Choose project (opens selector) | unavailable | unavailable | unavailable | browse catalogได้ |
| ready, payload empty | Send disabled: Add a message or attachment | unavailable | unavailable | unavailable | selectแล้วรอACK |
| ready + usablePayload | Send → `send_prompt` intent | hidden | hidden | hidden | applied onACK |
| uploading/failed attachment | Send disabledพร้อมattachmenterror/remaining | disabled | disabled | enabledถ้าrunกำลังทำงาน | changingmodelrevalidateattachments |
| send awaiting ACK | Sending… disabledสำหรับenvelopeเดิม; newdraftแก้ได้ | disabledจนtargetrunreceipt | disabled | enabledเฉพาะknownactive run | blockedจนdispatchresolved |
| running + usablePayload | Queue → `follow_up` intent | primaryเดียวกัน ไม่duplicatecontrol | enabledถ้าeffectivecapability | Stop enabled | show pending change semantics; default UI ไม่apply mid-run |
| running + empty | Queue disabledพร้อมhint | disabled | disabled | Stop enabled | same asabove |
| waiting question/approval | Queue ifpayloadready; ไม่เป็นresponseของquestion | allowedผ่านOMPqueueเท่านั้น | disabledจนrequestresolvedเพื่อไม่invalidateform | Stop enabledถ้าruntimeรองรับ | disabled pendingrequest |
| stopping | Stopping… disabled; textยังแก้ได้ | disabledจนterminalreceipt | disabled | disabledเพื่อกันduplicateabort; actiondetailsมีstatus | disabled |
| completed/cancelled/failed known outcome | Send (new user turn, ไม่retryeffectเดิม) | hidden | hidden | hidden | selectได้ |
| offline/replaying/host unavailable | Send/Queue disabled: Waiting for host; save draftได้ | disabled | disabled | disabled: reconnect to stop;ไม่อ้างว่าหยุดแล้ว | catalogcacheอ่านได้, mutationdisabled |
| command outcome unknown | Check status primaryไปreceipt/reconcile; draftยังอยู่ | disabledสำหรับaffected session | disabled | explicit verified liveprocess controlเท่านั้นในdiagnostics | mutationdisabled |

State overlayลำดับ:authrevoked→unknown→offline/replaying→stopping→awaitingACK→upload/modelincompatible→waitingrequest→running→ready. Stopavailabilityแยกจากpayload: attachmenterrorไม่blockStop. Payload/validationไม่ถูกแก้โดยtrimภายในcode/text; whitespacecheckใช้ตรวจemptyเท่านั้น. CommandACKเป็นdurable accepted ไม่อ้างcompleted; UI status “Queued” ต้องมีruntimequeue reconciliationไม่ใช่เพียงhostรับbytes

Queue listเหนือcomposerยุบได้: orderedid, textpreview2lines, attachmentcount, target, status. Edit/Remove enabledเฉพาะservercapabilityและqueueentryยังpending; optimisticoperationมีrevisionและrollback. Queueitemกลายเป็นrunningระหว่างedit → reject stale, keepeditorcopy,เสนอCopy to draft. Reorderไม่แสดงdrag affordanceเมื่อunsupported. Stopไม่สั่งflushqueue;หลังStopแสดงruntimequeueจริงพร้อมคำอธิบาย ไม่รันclientqueueเอง

Modelpicker rows provider/model/context/media/toolcapabilities/authstatusและeffectiveconfigscope. Unsupportedไม่เลือกได้แต่Detailsอ่านได้. Selectedmodelเปลี่ยนหลังACKเท่านั้น; failureคงoldmodel+draft. Currentrunเปลี่ยนmodelต้องผ่านOMP-supportedsafe boundary; defaultแสดง “ใช้กับรอบถัดไป” เฉพาะbackendพิสูจน์scheduleได้ ไม่ได้ให้เลือกเมื่อidleแทน. ไม่มีsilentpaidfallback. Authเปิดprovider-ownedflow;ไม่คัดsubscriptiontokensเอง

Context menuมีFiles, Selection, Logs, Artifacts, Skills/Commands, Models, Tools/MCPและfeatureที่runtimeadvertise. Search `@`/`/` ไม่dispatchเมื่อเลือก: fileแนบchip, skill/commandเติมvalidatedintent/draft; dangerouscommandมีpreview. No directinterpretationของuntrustedfileเป็นUIaction

### Attachment constraints

Picker/drag/pasteใช้samevalidation. Clientpreflightแสดง MIME/bytes และhost-advertisedlimit; hostตรวจซ้ำ. ถ้าlimitไม่available **ไม่ invent unlimited**: unavailable uploadพร้อมreasonและRefresh capabilities. Folderattachmentใช้filemanifestตามcapabilityไม่zip/sendทั้งfolderเงียบ. LargepasteเสนอKeep text/Attach as fileเมื่อเกิน16KiB (proposedUIthreshold ไม่providerlimit); cancelคงclipboardและdraft. Duplicatecontentแจ้งAlready attachedเลือกเพิ่มซ้ำได้เมื่อintentต้องการ แต่ไม่duplicateupload

Uploadprogressแสดงbytesจริงหรือindeterminate; cancelremovesdraftreferenceและcancelsuploadถ้าไม่มีconsumerอื่น. FaileditemมีRetry/Remove; selection/filechanged warningต้องre-readversionหรือkeepcapturedsnapshotอย่างexplicit. Imagepreviewthumbnailไม่แก้original; audio/videoไม่autoplay; modelไม่รับmediaให้choosecompatiblemodel/remove ไม่dropattachmentเอง

## D06 — S04/S06 Transcript, tools, plans และ subagents

Messageorderตามhosteventsequenceไม่wallclock. optimisticuserbubblekey=commandIdแล้วreconcilecanonicalevent ไม่appendซ้ำ. Markdownparse/sanitize; linksallowlist; codecopyมีlanguage/nameและCopiedstatus; filelinksresolveworkspace+snapshot ไม่เปิดarbitrarycommandURIจากtooloutput

Auto-followเปิดเมื่อuserอยู่ห่างbottom≤48pxก่อนappendและไม่ได้selecttext/dragscroll. User scrollขึ้น>48pxปิด; Jump to latest buttonแสดงunreadcountและกลับbottomทันที. Imagesreserveaspectจากmetadata; unknownsizeแสดงplaceholderขนาดคงที่จนloadแล้วpreserveanchor. Load older pagesprependแล้วคงvisibleeventId+offset;หากanchorถูกpruneให้nearestavailableeventพร้อมHistory changedไม่jumpเงียบ. ไม่ย้ายselectionเพราะstream

Toolcardheader: toolname+shorttarget+status+elapsed; body defaultcollapsedสำหรับsuccessหลังจบ, expandedสำหรับpendingapproval/error. Conversation density **Comfortable default**: argumentssummaryและlastoutputsummary; Detailedเพิ่มstructuredargsและoutputpreview ไม่ exposehiddenmodelreasoning. Densityswitchไม่เปลี่ยนtranscriptหรือexecution. User manuallyexpandedcardคงexpandedข้ามupdate. Per-tool childcardsสำหรับparallelcallsไม่รวมerrorให้หายไปในWorkedsummary

Outputpreviewสูงสุด240pxพร้อมOpen full log; rendererwindowedตามvalidationfixture, originaloutputเก็บartifact; screenreaderมีaccessiblepagedtextmodeที่ไม่virtualizefocusedcontentทิ้ง. Tokenstreamappendbatchตามrenderbudgetไม่animateletters. Toolfailureแสดงcause/permission/resultพร้อมCopy diagnosticsredacted, ไม่retrytoolโดยอัตโนมัติ

PlanpanelแสดงstepsตามOMPstate: pending/in_progress/completedพร้อมlabels; userแก้planได้เฉพาะadvertisedcommand. Goalsแยกturnstatus: active/completed/blockedพร้อมreason/budgetused/remainingเมื่อavailable;ไม่มีbudget=ไม่show0. Subagentsเป็นtreeparent/child lineage+workspace+status;เปิดdetailไม่spawnnewroot; message/interruptเฉพาะcapabilityและtargetidentity; childfinishedคงreceipt/historyไม่deleteเงียบ

## D07 — S05 Questions และ approvals

Inline requestcardเรียงตามhostsequence; attentioncountนับunansweredrequestsไม่ใช่toolsrunning. Requestcardsของtaskอื่นอยู่inboxและbadgeไม่force-switchtask. Selectingcardแสดงtool/action/target/cwd/scope/consequence, expiryถ้ามี, sourcehostและsession. Truncatedcommand/pathต้องExpandก่อนอ่านเต็มได้;ไม่ซ่อนsecurity-relevanttargetใต้tooltipอย่างเดียว

Fieldtypes: text/password/textarea/single-select/multi-select/editor/schemaform. Preservefree-textchoiceตามschema; required/min/max/enumvalidationจากtrustedcontract. InvalidSubmitenabledแล้วfocusfirstinvalid/inlineerror; disabledเฉพาะpending/stale/noauthority. ไม่normalizecommandtextเอง. UnknownschematypeแสดงUnsupported interaction+rawsafe fields+Update/Cancel whereallowed ไม่renderarbitraryextensionHTMLในprivilegedcontext

| Action | Precondition | Result UI |
|---|---|---|
| Allow once | current request+incarnation, authorizeddevice, explicitclick | submitting; disableduplicate; approvedเฉพาะreceipt |
| Allow scoped | มีboundedscopesในruntime schema | exactscope/durationแสดงก่อนเลือก;ไม่สร้างAlways allowเอง |
| Deny | pendingrequest | rejectedreceipt; no tool effectหลังdenyตามcontracttest |
| Cancel form | schemaadvertisescancellation | cancellation response;ไม่pretenddenyถ้าsemanticsต่าง |
| Close/dismiss sheet | always presentation-only | requestยังpending; badgeอยู่; draftformเก็บlocal |
| Timeout/respondedelsewhere | hosteventauthoritative | fieldsreadonly; status+actorifavailable; no resubmit |
| Reconnect | replaycomplete+requestยังcurrent | restorelocalformdraftถ้าschemarevisionตรง; otherwisepreservecopy+revalidate |

DangerousoperationdefaultfocusCancel/Review, neverAllow. ApprovalbuttonnativeEnter/Spaceตามfocusedbutton;globalEnterไม่approve. Tool effectsก่อนapprovalเป็นtestfailureแม้UIดูถูก. Offlineห้ามqueueapprovalโดยdefaultเพราะexpiry/incarnation;ปุ่มdisabledพร้อมWaiting for host

## D08 — S07/S08 Work panel, review และ Git

Resource tabs: Changes, Terminal, Browser, Preview, Artifacts, Files; idleemptytabมีmeaningfulnextactionไม่mockcontent. Selectedtab/pinnedresourceperview; openingartifactจากtranscriptเลือกexactresource/buildไม่latestmutablepath. Panelcloseซ่อนview ไม่killPTY/browser/build. Resource Stop/Close sessionเป็นexplicitactionต่างจากHide panel. Unsavededitในresourceต้องconfirm/saveตามnativeeditor

Changesheader: workspace/base/head-or-dirtysnapshot, filescount,+/−, Refresh, Open in IDE. listแยกmodified/added/deleted/renamed/binary/conflict; selectingfileเปิดdiff; narrowmodeunifieddiffdefault, wide≥900side-by-sideoption. Collapsedcontext3linesพร้อมexpand;codehunksmonospaceและaccessiblelineorigin. Stale diffbanner “ไฟล์เปลี่ยนแล้ว — โหลด diff ใหม่” blockapplyจนversionmatch

Stage/Unstageเป็นGitindexaction ไม่Keep/Rejectagentproposal. Labelsแยก: **Apply proposal**, **Discard proposed hunk**, **Stage hunk**, **Unstage hunk**. Alreadyappliedagenteditsไม่แสดงKeepเสมือนยังไม่apply; revertต้องreversepatchบนexpectedversion+confirmationหากกระทบmanualedit. Whole-repo resetไม่ใช่shortcutของDiscard. Binarypreviewไม่fabricatetextdiff;openviewer+size/hash

Commitdialog: branch+stagedfiles+message+emptyvalidation; defaultเฉพาะstagedscope; unstagedchangesระบุว่าไม่รวม. Commit and Pushเป็นseparateexplicitactionพร้อมremotedestination; noautopushจากreview. Conflict flowreview3-way/local/agent/baseพร้อมเลือกทีละhunkและSave result; noautomaticmine/theirswholefile. Worktreebring-backแสดงsource/destination/dirtyoverlap/untrackedmanifestและpreview; failedapplyไม่deleteworktree,ให้inspect

## D09 — S09 IDE และ inline intelligence

Code-OSSเป็นเจ้าของExplorer/search/replace/symbols/rename/LSP/debug/test/extensions/settings/editorundo. Caretไม่fork UI logicแต่ละfeatureโดยไม่มีneed;ใช้nativecommandsพร้อมworkspaceidentity. Agentsmodehidechromeแบบviewprofile: snapshotเดิมของsidebar/auxbar/panel/openeditors/focusก่อนเปลี่ยน; restoreเมื่อกลับ. Userแก้layoutขณะIDEactiveอัปเดตprofileไม่overwriteด้วยstartupdefault

Inlineproposalแสดงrange/version/modelsource/diff; Accept/Reject/Accept next chunkตามcapability; staleversionไม่apply. Tabcompletionghosttextไม่สับกับindent/snippet/IME: editorcontext priorityก่อน; acceptเกิดในeditorundo transaction;Escdismissไม่Stopagent. Multi-fileeditต้องpreviewaffectedfilesและmanualdirtyconflict; autosaveไม่ใช่เหตุข้ามversioncheck

Debug/testviewต้องมีconfigurationselector/start/stop/breakpoint/teststatus/logsตามnativeextensionsที่ติดตั้งจริง. Missinglanguageextensionให้Discover compatible extensionพร้อมlicense/source ไม่อ้างMicrosoftMarketplaceสิทธิ์อัตโนมัติ. Nativeextensionpermissions/authแยกจากOMP; terminal/debugadapterไม่ownedโดยagentloop

## D10 — S10 Terminal และ process UI

Terminaltabsแสดงname,cwd,host,user-vs-agent,live/exited status. Newterminalสร้างuserPTYผ่านhostreceipt; existingagentcommandlogเป็นreadonlyจนruntimeadvertisesinteractiveinput. Cmd+Jยังnativepanelเมื่อIDEcontext; AgentworkpanelมีFocus terminalcommandต่างกัน. Pasteหลายบรรทัดไปshellแสดงnativepastewarningตามpolicyไม่executeด้วยUIhelper

Resizeส่งrows/colsdebouncedตามhostcontractและlatestsize;UIrenderตามpointerทันทีไม่รอACK. Exitedpaneเก็บexitcode/full logพร้อมRestart explicit (newprocessid). Closeviewไม่terminate. Terminatecommandต้องระบุprocess/session; runningbuildอาจมีchildrenให้hostpolicyจัดการและreceipt ไม่killbynameglob. Networklossแสดงreadonlylastoutput+timestamp;ไม่มีtypedinputbufferที่replayเข้าshellเองเมื่อreconnect

## D11 — S11 Browser, native control และ preview

Browsertoolbar: Back/Forward/Reload(orStoploading), URL, controlindicator, Inspect, Console, More(Network/Screenshot/Permissions). AddressSubmitเป็นnavigatebrowserไม่sendagent; rejectunsafeprotocolเช่นjavascript/fileโดยpolicyและexplain; allowedlocalhostfromprojectserverต้องbindresource/project, noautomaticlisten0.0.0.0. Navigationerrorเก็บURL/lastgoodpageและRetryexplicit; insecure/untrustedoriginwarningไม่auto-bypasscert

Browserfocusถือwebkeyboardเมื่ออยู่page;Escapeออกinspectmodeก่อนglobal. Select elementแสดงoverlayของbrowserbridgeและcontextchipอ้างtab/navigationrevision/node;pagechangedต้องreselect. Console/networktabsboundedlog+filters/clearview/export;Clearviewไม่deletehostreceipts. Agent control badgeประกอบactor/task/action; Take controlต้องserializebrowsercontrolleaseกับagentผ่านOMPtoolbridge ไม่แข่งclickจากสองowners

Authentication/login/useraccountactionsต้องuserintent+permissionsของoriginเอง;ไม่reuseCodex/Cursorcredentials. Downloadใช้explicitsaveและsafeMIME;popup/newwindowpromptเมื่อpolicyต้องถาม. Pagecloseไม่Stopwebserver; serverstopเป็นresourcecommandแยก. Browser automation, desktop computer use, media generationต้องOMPtoolcontract/auth/permissionจริง ไม่เป็นปุ่มที่เพียงเปิดexternalappแล้วนับpass

Nativeappcontrolreceiptแสดงapp/bundle/version, capturedtime, requestedactionและOSpermissionstate. “Open app” ไม่เท่ากับ“Control app”; permissiondeniedให้systemsetupinstructionsไม่toggleOSsettingsเอง. Remotephoneดูcaptureและrequestactionผ่านMacowner;ไม่อ้างfullremotedesktop/audio streamingจนมีtests

## D12 — S12 Artifacts และ media

ArtifactlistfilterType/Build/Source/date; eachitemชื่อ,MIME,size,source/buildhash,createdtime,processing/ready/failed. Generatedimageและapprovedoriginalแยกlineage;Replace originalต้องexplicitapprovalไม่ทำเพราะthumbnailใหม่ดูดีกว่า. Imageviewerfitdefault/actualsize/zoom/pan/reset/download, transparentcheckerboardoption; allactionsมีkeyboardbuttons ไม่gestureonly

Audio/videoมีPlay/Pause/seek/mute/volume/time/duration; noautoplay. Captions/transcriptแสดงเมื่อartifactมีจริง ไม่invent. Audio renderedfileบนphoneไม่เท่ากับliveDAW. PDF/documentviewerpagecontrols/searchเมื่อbackendรองรับ;unsupportedเสนอDownloadไม่executeembeddedcontent. MIME mismatch/quarantineerrorมีsafeexplanation

BuildpreviewheaderalwaysBuild A/hash/source status; livecurrentworkspacebadgeแยกimmutablepreview. NewbuildBreadyแสดงSwitch to B ไม่replaceAที่userกำลังเล่น. FailedBเก็บAพร้อมfailurelog. Openonphoneต้องverifyhash/assetsmanifestและexpiredauthorization; feedbackattachesbuildId+screenshot+timestamp+optionalcoordinatesไม่ผูกlatestชื่อเดียว. Feedbacksubmissionใช้composerintentและreceiptปกติ

## D13 — S13/S16 Settings, capabilities และ optional product functions

Settingscategories: Appearance; Agents/OMP; Models/providers; Tools/MCP; Skills/rules/hooks/commands; Workspace/editor; Browser/artifacts; Devices/connections; Notifications; Privacy/security; About/updates/licenses. Desktopcategorysidebar180pxเมื่อcontent≥720;แคบใช้labeledcategorycomboboxไม่icononlyrail. Searchmatcheslabel/descriptionและscope;goresultfocussettinglabel

ScopebarGlobal/Project/Sessionตามruntimeadvertise; effectivevalue+sourcepath/scopeแสดงreadonlyก่อนedit. Editdraftlocal; Applyหนึ่งtransactionต่อsectionกับexpectedconfigrevision; failureคงdraft+oldactivevalue. Reset removesselectedoverrideเท่านั้นและpreviewinheritedvalue. Readonly/unavailablefieldsมีreason. Credentialsใช้secureinput+providerownedflowและredacteddisplay;neverexportsecrets

| Setting | Caret default | Change semantics |
|---|---|---|
| Startup view | Agents; restorelastselectedtask | noautostartnewrun |
| Window restore | previousworkspace/layout | missingprojectเป็นexplicitunavailable |
| Conversation density | Comfortable | presentation-only; errors/approvalsvisiblealways |
| Work panel position | Right (D01 responsive resolver) | preservepreferredsizesperworkspace |
| Theme | Follow Code-OSS / system-compatible built-in | immediate swap, no color-transitionstorm |
| Motion | Follow OS; Reduce selectable | OSreduce wins; changingmidtransitionfinalizestaticstate |
| Submit shortcut | DesktopEnter; iOSReturnnewline | D05; showresolvedhint; noIMEsubmit |
| Completion notifications | In-app on; OSpermissionrequestedwhenuserenables | dedupebyreceipt; openactualtask; nosecretpreviewdefault |
| Sound | Off | explicitenable; respectOSmodes |
| Auto-hide empty IDE | Off | do notsurprisemode-switchwhenclosingfile |
| Auto-approve/billedfallback | No new UI-granted blanketpermission | onlytrustedOMPscope withclearconsequence; explicitauthorization |

Extensions/skills/MCPentriesมีinstalledversion/source/license/scope/enablement/effectivecapabilities/error+lastchecked; Install/Update/Removeเป็นexplicitworkflowพร้อมpermissionsและdiff/rollbackwhereavailable. “Browse” ไม่install. Dynamictoolregistryupdateรักษาpendingrequestschemaและannotatechangedversion; capabilitydisappearanceทำdisabledreasonไม่deletetranscript. Commandautocompleteมาจากcurrentregistryไม่staticlistที่อ้างfullOMP

Automations/voice/cloud/SSH/remote/enterprise functionsในhistoricalcoverageต้องมีentry+contract specตามmapping แต่ไม่เปิดenabledจนcapabilityมีจริง. Automationform: name,task/project,schedule+timezone,nextoccurrences,permission/costscope,notificationpolicy,create/pause/edit/deleteconfirmation; submittingใช้hostreceiptและdedup;ลบscheduleไม่killactiveexecutionโดยปริยาย. Voiceflow: explicitmicpermission→recordingvisibleindicator+Stop/Cancel→transcriptiondraftreview→Send; noautosend/noalways-listening. Cloud/paidconnection: destination/account/estimatedcostifknown/unknownlabel+explicitconfirm; notfallbackforMacoffline

AboutแสดงCaretbuild/sourcehash/OMPversion+patches/Code-OSSbase/protocolversion. Updatecheckreadonly;installrequirescompatibleversion/migrationbackup/restartchoice;activejobsไม่ถูกkillเงียบ. Diagnosticsเลือกscopeและpreviewredactionก่อนexport. License/notice inventoryต้องรวมselectedassetsไม่อ้างopen-sourceเท่ากับใช้ฟรีทุกservice

## D14 — S14/S15 iPhone, pairing และ continuity

Phonebottomnavigation **Tasks / Activity / Settings**. Taskdetailไม่เพิ่มbottomtabsซ้ำใต้composer;backคืนlistposition. Activityรวมunansweredrequests/errors/finishedreceiptsพร้อมtaskfilter;requestเปิดexacttaskไม่newsession. iPhoneไม่มีIDEbuttonที่สัญญาfullcompiler;ใช้Files/Review/Preview/Terminalผ่านMachasowner

Pairflow: unpairedempty→Scan QR/Enter code→verifyMacname+fingerprint+requestedpermissions→Macapprove→phoneconnectedreceipt. Expiredcodeให้RefreshonMac;wronghostไม่acceptเพราะnameเหมือน. QR/tokenไม่ใส่logs. Revokeflowระบุdeviceและqueuedpendingcommands, confirmation, receipt;revokeระหว่างapprovalทำstaleไม่reconnectapprovedเอง. RelaydownกับMachasleep/unreachableเป็นคนละmessage;routechangesไม่newsession

Safeareaใช้platforminsets, composerไม่double-addkeyboardheight. Portraittoolbarmin44pt;Returnnewline;inputgrows2–6linesแล้วinternalscroll;เมื่อDynamicTypeใหญ่ใช้max40%availableheightแทนhardlinecap. Keyboardopenpreservescrollanchorและautofollowpolicy;userอ่านข้อความเก่าไม่jumpbottom. Landscape/shortheightให้collapsedcomposerพร้อมExpandinputfullsheet, headeroverflow,previewfullroute;ไม่lockorientation

Approvalsheetdefaultcontent-fit, maxavailableheight−topSafeArea;fields/longcommandscrollและstickyAllow/Denyfooters;keyboardfocusfieldscrollintoview;swipedismissเป็นpresentation-onlyรักษาคำตอบdraft. Systembackgestureในformมีunsavedlocaldraftrestore ไม่submit/canceltool. Gesture-onlyactionsทุกตัวมีbuttons/Moremenu;VoiceOverorderตรงvisual;DynamicTypeไม่truncatepermissionreason

Background: stopUIpoll/animation, hostcontinues;foregroundต้องhandshake/replayก่อนmutatingcontrols enabled;lastknownbadgeแสดงUpdatingพร้อมtimestamp. Noresendterminalkeystrokes/approvalเมื่อappคืนมา. Notificationtapvalidateauthและroute;revokeddeviceเห็นPairagainไม่cachedsecretcontent. Offlinecacheมีfreshnessและclearcachecommand;screenlocking/securestoragepolicyต้องprivacytest

Phonefileeditorใช้versionedpatch+explicitSave;showMachasdirtybufferconflictถ้าversionoverlap;nooverwrite. Reviewdiffunifieddefault;hunkcontrols44pt;binarydownloadconfirmation. Terminalread-onlyเมื่อbridgeไม่รับmobilePTY;capabilitygapต้องเปิดในP10/P18mappingไม่ถือว่าครบ. Uploadthroughcellularมีbytes/progress/cancel/retry/contenthash;networkchangeรักษาcommandId. Realdevicecellulartestจำเป็น, simulatorไม่passแทน

## D15 — Motion choreography: exact transitions

Motion durationsไม่เท่ากับprocessinglatency. State/permissioncommitและinputfeedbackต้องเริ่มทันที; noawaitanimationendเพื่อdispatch/enable/ack. ใช้CSStransitionsเดิม, no dependencyinstall. ตั้งtokens `instant=0`, `feedback=100`, `surfaceIn=150`, `surfaceOut=100`, `drawerIn=180`, `drawerOut=120`; curve E=`cubic-bezier(.2,0,0,1)`; opacitylinear. Noexpressivestagger/defaultbrandanimation

| Motion ID | Trigger / from→to | Timing | Focus, interruption, content growth |
|---|---|---|---|
| M01 row/buttonhover | backgrounddefault→hover; no transform | 100ms E; keyboardfocus0ms | no animationontouch;reversefromcurrentcomputedstate |
| M02 Agent↔IDE/task switch | activeviewstatechange, no positionaltransition | **0ms default** | restoretargetfocus+selectionbeforepaint; cachedviewrenderbudgetแยก; no crossfadeoldtasksecrets |
| M03 dockedpanelopen | allocatefinalcolumnwidthatcommit; panelcontentopacity0→1 | 150mslinear | outerlayoutchangesonce; no slideeditorcanvas; focusheaderทันที;rapidclosecancelmount |
| M04 drawer/sidebaroverlay | translateX(24px towardlogicaledge)→0,opacity0→1; scrim0→.32 | in180/out120ms E | clampstartinsideviewport; inertbackground; focusinsideatcommit;reversecurrentvalues |
| M05 menu/popover | translateY(4px)→0,opacity0→1, originanchor | in150/out100ms E | hit/keyboardenabledatcommit; oncloseinertimmediately;focusreturnไม่รอfade |
| M06 mobile sheet | translateY(24pt)→0,opacity0→1; scrim0→.32 | in180/out120ms E | nativekeyboardtransitionใช้OStimingไม่stacksecondanimation;swipedragfollowpointer |
| M07 tool expand | measuredheight0→H; inneropacity0→1 | 150ms E | expandablebodybounded240px;streamระหว่างtransitionbufferpaint→retargetHfromcurrentheight; afterfinishheightauto;anchorstable |
| M08 tool collapse | currentmeasuredheight→0; opacity1→0 | 100ms E | focuschildย้ายdisclosureก่อนcollapse; preserveexpandedpref;reopenreversecurrentheight |
| M09 approval arrival | card insertedatstableeventposition, badgeupdates | 0ms | nofocussteal/autoscrollunlessalreadyfollowing;useropenssheetใช้M06 |
| M10 queue item add/remove | stablelistlayoutcommit; newitemopacity0→1 | add100ms/remove0ms | noanimationduringreorder;removefocuseditemfocusnext/queueheading |
| M11 submit button press | pointerdownscale1→.96;up→1 | 150ms E | onlySendidlebutton;Stop/Allow/Deny/statickeyboardfeedback0ms;hitboxunscaled |
| M12 contextualicons | **off by default**; ifapprovedinfrequent: scale.25→1,blur4→0,opacity0→1 | 300ms E,no bounce | icon16/20only;initialmountstatic;Stop/securityiconsalwaysinstant;labelschangeatcommit |
| M13 toast | translateY4px→0,opacity0→1 | in150/out100ms E | stackallocationnotpushcomposer;errors/actionsnotautoexpire |
| M14 browser/image/logload | reservedplaceholder→contentopacity0→1 | 100mslinear | preserveaspect/scroll;noanimationforliveframes/streamingtokens |
| M15 resize/scroll/typing/theme | directstate-to-paint | 0ms | native scrolling; no smoothscrollonappend, no width tweenwhiledragging, no theme transitionstorm |

ReducedMotion=OSreduce OR userReduce: allM01–M15 0ms/no transforms/no blur/no smoothscroll;functionalprogressยังมีtextและnonmovingindicator. หากtoggleกลางanimation cancelและcommitfinalstateทันทีพร้อมcleanupfocus/inert. User cannotforceanimationsagainstOSreduce. Hidden/minimized/backgroundviewsไม่มีloopanimation/timersสำหรับdecorativeupdates;elapseddisplayrecomputeจากtimestampเมื่อvisible

Toolheightmeasurementต้องread/writebatchไม่forcedreflowper-token;เมื่อbatchgrowเกิดระหว่างuserdrag/selectionให้instantheightupdateพร้อมanchorpreservation แทนรอanimation. Resourceclosereleasesviewlistenersไม่stopownerresources. Animationcleanupมีfallbackไม่พึ่งtransitionendที่อาจไม่fireเมื่อunmount/reducemotion

## D16 — Copy, error taxonomy และ accessibility completion

Use consistent nouns: Task=งาน, Project=โปรเจกต์, Queue=เข้าคิว, Steer=แทรกคำสั่งในรอบนี้, Stop=หยุดรอบนี้, Archive=เก็บงาน, Discard draft=ทิ้งฉบับร่าง. UI localizationใช้messagekeysไม่hardcodeหลายภาษาในcontrolเดียว;English/Thaiเป็นtestlocales. Primaryerrorไม่แสดงstacktrace/UUID;detailscopyredactedได้

| Condition | Primary Thai copy / action | What remains safe |
|---|---|---|
| Hostoffline | “ติดต่อ Mac ไม่ได้ — เก็บฉบับร่างไว้แล้ว” / เชื่อมต่ออีกครั้ง | ใช้ข้อความนี้เฉพาะdraftpersistreceiptมี;ไม่มีให้“ยังบันทึกฉบับร่างไม่ได้” |
| AwaitingACK | “ส่งคำสั่งแล้ว กำลังรอการยืนยัน” / ดูสถานะ | ไม่อ้างเริ่มrunแล้ว |
| Outcomeunknown | “ยังยืนยันผลคำสั่งไม่ได้ อย่าส่งซ้ำจนกว่าจะตรวจสอบ” / ตรวจสอบผล | draft/historyคงอยู่ |
| Uploadfailed | “แนบไฟล์ไม่สำเร็จ ข้อความยังอยู่” / ลองแนบอีกครั้ง, นำออก | no partialdispatch |
| Authrequired | “ต้องเชื่อมต่อผู้ให้บริการนี้ก่อน” / เชื่อมต่อ | noautomaticotherprovider |
| Stalerequest | “คำขอนี้ใช้ตอบไม่ได้แล้ว” / ดูสถานะล่าสุด | noeffectจากoldAllow |
| Respondedelsewhere | “ตอบคำขอนี้จากอีกอุปกรณ์แล้ว” / ดูผล | attributionเมื่อverifiedonly |
| Dirtyconflict | “ไฟล์มีการแก้ไขใหม่ ยังไม่ได้นำข้อเสนอไปใช้” / เปรียบเทียบ | manualbufferretained |
| Stopped | “หยุดรอบนี้แล้ว การแก้ไขก่อนหน้ายังอยู่” / ตรวจการเปลี่ยนแปลง | ไม่ใช้Stoppedก่อนreceipt |
| Unsupported | “เวอร์ชันที่เชื่อมต่อยังไม่รองรับส่วนนี้” / รายละเอียดความสามารถ | visibleopencoveragegap |

Announcements: onepoliteeventsummaryต่อstatechange, batchtoolprogress≤1/second; errorsblockingactionเป็นalertไม่repeatonrerender. Criticalstatusvisiblepersistentไม่อยู่toastอย่างเดียว. Linksunderline;buttonsnative;labelsreal;search/compositekeyboardAPG;focusedvirtualrowไม่recycled. Usertextselection/copyไม่disableทั่วapp. Reflow320logicalpxและ200%textzoom;2Dcode/diffมีlocalscrollไม่pageoverflow. Accessibleloading/errorstatesอยู่testmatrixไม่อ้างผ่านเพราะมีARIAattribute

## D17 — Definition of design-ready และ handoff

แต่ละS01–S16ต้องส่ง implementationcardที่อ้าง Dxx/Cxx/Mxx + historicalIDsจากcoverage + exactpinnedruntimecommands/events + testsจากvalidation. Runtimeoperationที่ยังไม่มีwireใช้status **contract-required**, schema/interface/testownerระบุในG1;ห้ามinventcommandnameแล้วclaimimplemented. SharedhostprotocolและOMPต้องเป็นauthorityเดิม

ก่อนproductionvisualfreezeต้องมีannotatedcapturesของempty/normal/busy/error/permission/offline/narrow/focusแต่ละfamilyที่applicableพร้อมsource/build/theme/scaleและknown-delta. CurrentCodexcaptureblockedจึงยังไม่freezepixelparity;Caretbehavior/defaultsในเอกสารนี้implementและprototypeได้โดยไม่รอ. ไม่ย้ายreferencegoalเป็นCursor-onlyเงียบ ๆ

Clickableprototypeacceptance: fixtureproject2repos+1nonGit, sessionsA/B, stream/queue/stopping/approval/uploaderror/reconnect/unknown toggle, D01layoutresize, S08review/S11browserstub/S12buildA→B/S15mobileview;ทุกmockติดป้ายSimulated/noexecution. Clicksendแสดงreceiptfixtureไม่เรียกprovider, Allowไม่ทำfilesystemeffect, Settingsไม่เปลี่ยนrealhost. Prototypeเป็นnextimplementationartifactตามแผน ไม่ถูกสร้างหรืออ้างว่าverifiedจากเอกสารนี้

Spec completion≠featurecompletion: รอบนี้เพิ่มรายละเอียด/coverage/testcontractsเท่านั้น. Production UI, animatedprototype, physicaldevice/performance/visualreferenceacceptanceต้องมีrevisionreceiptsของงานจริงแยกกัน. ไม่ติดตั้งlibrariesหรือเปลี่ยนCode-OSS/OMPเพราะการเขียนสเปก

## D18 — Button-audit additions: destinations, filters และ history

ผู้ใช้ขอให้ลองกดหลายปุ่มเพิ่ม จึงขยายข้อกำหนดจาก CU-13–CU-16 ดังนี้ ไม่เลือกค่าของ reference เพื่อให้เกิด effect

### Model parameters

Model selector และ parameter selector แยกกัน: parameter rows มาจาก effective runtime schema พร้อม label, current value, allowed values, default และ cost/latency note ถ้ามีหลักฐาน. Effort ไม่แปลงเป็น model ID; Fast ไม่ถือว่าฟรีหรือรองรับทุก provider. Unsupported parameter read-only พร้อมเหตุผล; ไม่ส่งค่าคงค้างจาก model เก่าไป model ใหม่. เปลี่ยน model แล้ว parameter ที่ไม่ compatible แสดง reset preview ก่อน Apply; response error คืน active config เดิมและไม่ล้าง draft. พารามิเตอร์เป็น per-session/turn ตาม OMP contract ไม่เป็น client-only preference ที่ UI แสดงแต่ runtime ไม่รับ

### Execution destination versus worktree

Environment picker มี 3 กลุ่มที่ไม่ปนกัน: **Run on** (Mac host ที่มีสิทธิ์), **Connect via** (local/direct/relay เป็นข้อมูลเส้นทาง), **Workspace** (current folder/existing worktree/new worktree). Phone เป็น controller ไม่ใช่ compute destination. Remote Control ไม่ใช่สร้าง agent ใหม่. Cloud/remote ที่ยังไม่มี backend/auth เป็น capability gap ไม่ให้เมนู fallback เปลี่ยน Mac → paid host เอง

New worktree form มี repository, base ref, branch name, destination, dirty-source policy และ preview files ที่จะรวม/ไม่รวม. Validate branch collision, unavailable ref, path ownership และ disk capacity ก่อน Create. Cancel ก่อน submit ไม่สร้าง directory; cancel ระหว่าง host ทำงานใช้ receipt/reconcile ไม่ลบโฟลเดอร์ที่อาจมีงานผู้ใช้. Non-Git project ไม่เปิด New worktree แต่ใช้ Current folder ได้. Existing running task ย้าย execution host ไม่ใช่ dropdown change: ต้อง explicit handoff/checkpoint contract หรือ disabledพร้อมเหตุผลและไม่มี silent restart

Branch picker ของ new draftเลือก target ref ไม่ checkout จนผู้ใช้ยืนยัน workflow ที่ระบุผลต่อ workspace. Branch picker ของ active IDE ให้ native dirty-buffer guard. Search results มี local/remote/current และ no-results พร้อม refresh; Enter ขณะ results loading ไม่เลือก stale row. ห้ามไป main เพียงเพราะ selected ref หาย

### Sidebar filter contract

Default Group by Project; order Last activity; show Active+Draft; archived off. เพิ่ม Status/Environment/Source และ PR filter เฉพาะมีแหล่งข้อมูลจริง. Filter chips แสดงค่าที่ active และ Clear all; zero results = “ไม่มีงานที่ตรงตัวกรอง” + Clear filters ไม่ใช่ “ยังไม่มีงาน”. Filters เก็บต่อ device/window profile ไม่ปรับ task status. Missing PR metadata แสดง Unknown ไม่ตีความ No PR. Collapse all เปลี่ยน view เท่านั้น; Mark all as read แสดงจำนวนและ scope ของผลลัพธ์ที่เลือก ไม่ clear unread ทุก project โดยไม่แจ้ง. Task ที่กำลังพิมพ์ไม่ถูก navigate ออกเมื่อ filter ซ่อน row ของมัน

### Automation history contract

Schedule list แยกจาก Runs. Runs rows: schedule/task, triggered at+timezone, trigger kind, destination, tools, pending/running/succeeded/failed/cancelled/unknown, duration และ receipt link. Filters ownership/schedule/status/trigger/tools; ownership ที่ Caret ไม่มีให้ User-only ไม่ fake Team. Counters loadingใช้ dash, errorใช้ Unavailable, 0 ใช้เฉพาะ successful empty response. Retry run เป็น new authorized execution พร้อม provenance ไป failed run ไม่ replay old command ID เพื่อทำ effectซ้ำ. Pause schedule ไม่ terminate active run; Stop run ไม่ delete schedule. Template selection เติม draft form ไม่ publish scheduleหรืออนุมัติ tool permissions

## D19 — Current Caret packaged-app gap ledger

ตรวจ app path `/Users/pond/caret/source/VSCode-darwin-arm64/Caret.app`, Info.plist version **1.138.0**, วันที่ 2026-09-13 ผ่าน Computer Use. มีอีก build ที่ bundle ID เดียวกันจึงเลือก path นี้ชัดเจน; การสังเกตต่อไปนี้ไม่ใช้แทนอีก build หรือ source working tree. ยังไม่มี binary/source hash receipt จึงไม่ใช่ release certification

| ID / observed action | Gap/impact | Required acceptance / owner slice |
|---|---|---|
| CA-01 เปิด app: task idle, Ready, Model disabled; Send/Steer/Follow up/Stop ยังเป็น enabled controls ใน AX | ไม่มี model readiness/availability reason และ action gating ที่สอดคล้อง state; ไม่ได้กดส่งหรือ Stop จึงไม่สรุป backend ผิด | D05: idle+missing model ปิด dispatchพร้อมreason; Stopเฉพาะknown active run; UI-S2 |
| CA-02 กด Open Caret settings: เปิด native settings modal มี Host Node Path, Request Timeout, Script Path, State Dir, Open Tasks On Startup | copy “Connect your iPhone” ไม่พาไป pairing ในหน้าที่ตรวจได้ | D13/D14: Add deviceต้องเข้าถึง pairing flow หรืออธิบาย unavailable; advanced host paths ไม่แทน onboarding; UI-S4 |
| CA-03 กด Files & editor ครั้งแรก: window เปิด workspace `caret-ui-acceptance` แต่ startupกลับ Caret task view; กดครั้งที่สองจึงเปิด Explorer | pending destination ไม่ถูกทำให้สำเร็จในการเปิด workspaceครั้งแรกในรอบที่ตรวจ; ไม่ได้ทดสอบ draft retention | D01/D09: carry pending native destinationข้าม workspace load; open Filesครั้งเดียวถึงExplorerโดยไม่สร้างOMP ownerใหม่; UI-S1 |
| CA-04 กด Review changes ใน non-Git fixture: ไป Source Control welcome พร้อม Initialize Repository/Publish to GitHub | เป็น native non-Git fallback ไม่ใช่ task-scoped review; creation/publication controls ต้องไม่เกิดอัตโนมัติ | D08: อธิบาย no Git และยังดู versioned agent proposalsที่มีได้; Git setupเป็นexplicitchoice; UI-S3 |
| CA-05 กด Task actions แล้ว refresh AX สองครั้งไม่เห็น menu ก่อนเปิดsettings | ผลยังไม่ยืนยัน: อาจ no-op/async/focus issue; ไม่อ้าง root cause จาก snapshot | UI-S1: deterministic menu open/focus/empty-state test ใน exact build; หาก action unavailableต้องมีfeedback ไม่เงียบ |
| CA-06 screenshot idle composerที่ความกว้างปัจจุบัน: Follow up และ shortcut hint wrapหลายบรรทัด | control grouping/density ยังไม่ตรง D02/D05; มี controlsซ้ำความสำคัญและใช้พื้นที่อ่าน | ใช้ Queue primaryเฉพาะrunning, contextual Steer/Stop, shortcuthelpไม่เบียดbutton; UI-S2/5 |

รอบนี้กดเฉพาะ navigation/menus/settings/read-only views; ไม่ initialize Git/publish/send prompt/approve/modify provider. Files actionเปลี่ยน workspace window ตามการนำทางที่ขอตรวจ. Native sidebarสุดท้ายอยู่ Source Control; no source/file editsจาก UI audit. ข้อผิดพลาดในตารางเป็นงานในแผน ไม่ได้แก้ production UI ในรอบเขียนสเปกนี้
