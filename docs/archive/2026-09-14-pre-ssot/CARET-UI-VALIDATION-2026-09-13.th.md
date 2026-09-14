# Caret — UI/UX, motion, smoothness และ validation specification

วันที่ 2026-09-13 · สถานะ: **executable acceptance plan; proposed budgets, ยังไม่ใช่ผลวัด**

> **Amendment 2026-09-14 (spec):** [CARET-SPEC-2026-09-14.th.md](CARET-SPEC-2026-09-14.th.md)
> เป็น spec ที่มีอำนาจ; receipt ที่เคยถ่ายจาก webview shell ต้องเปลี่ยนเป็น capture ของ
> หน้าต่าง Agents (AX + geometry) ที่ viewport/scale/theme เดียวกับ Cursor

เอกสารนี้เป็น companion ของ
[CARET-UI-INTERACTION-SPEC-2026-09-13.th.md](CARET-UI-INTERACTION-SPEC-2026-09-13.th.md),
[CARET-UI-DETAILED-DESIGN-2026-09-13.th.md](CARET-UI-DETAILED-DESIGN-2026-09-13.th.md)
และ [CARET-REFERENCE-ACCEPTANCE-2026-09-12.th.md](CARET-REFERENCE-ACCEPTANCE-2026-09-12.th.md)
ใช้ตรวจรับ UI/UX ของ Caret ตั้งแต่ S01–S16 รวม motion, responsiveness,
accessibility, Thai IME, mobile continuation, recovery, rendering stress และ privacy
โดยกำหนดวิธีวัดที่ทำซ้ำได้และหลักฐานที่ต้องเก็บ

ค่าตัวเลขที่มีคำว่า **proposed** เป็นงบประมาณสำหรับ design/release candidate
ไม่ใช่ค่าที่วัดแล้ว และห้ามใช้เป็นข้อความว่า Caret เร็วกว่า Cursor/Codex
จนกว่าจะมี receipt จากเครื่องและ build ที่ระบุครบ เอกสารนี้ไม่เพิ่ม harness
ไม่เปลี่ยน OMP และไม่อนุญาต provider, cloud, paid connector หรือ external side effect
การทดสอบ execution ใช้ OMP เป็น owner เดียวกับ deterministic local fixture เท่านั้น

## 1. ขอบเขต คำศัพท์ และสถานะหลักฐาน

### 1.1 สิ่งที่ต้องตรวจ

- S01–S16 ต้องมี test ID, fixture, precondition, ขั้นตอน, expected result และ artifact
  ของตัวเอง ครอบคลุม loading, empty, ready, active/streaming, error, permission,
  offline/reconnecting, stale/expired และ unknown outcome เท่าที่ surface นั้นมี
- Agent↔IDE เป็นการเปลี่ยน view ภายใน task เดิม ไม่สร้าง OMP session/agent loop ใหม่
  และต้องคืน draft, attachments, scroll anchor, editor buffer, panel tabs และ focus
- D15 default mode/task switch ต้อง commit state ทันที (เป้าหมาย commit latency 0 ms:
  ไม่รอ animation หรือ network); paint/restore latency วัดแยกตาม §5
- ขณะ running ปุ่มหลักของ composer คือ Queue; ขณะ offline/disconnected ปิด Send,
  Queue และ Steer ทั้งหมด เหลือการแก้และเก็บ draft ในเครื่องเท่านั้น
- ทุก action ที่มีผลข้างเคียงต้องอ้าง commandId, sessionId และ incarnation จาก OMP/host;
  UI ห้ามตีความ idle ว่า goal สำเร็จ ห้ามยิงคำสั่งซ้ำเมื่อผลเป็น unknown
- สเปก motion ระบุ trigger, from/to, duration, easing, interrupt, focus timing และ
  reduced-motion behavior; ค่า timing ยังเป็น proposed
- เกณฑ์ performance ต้องวัด monotonic timestamp, sample/warm-up, workload และ
  environment เดียวกัน ไม่ตัด outlier เพื่อให้ตัวเลขดูดี

### 1.2 คำที่ใช้ในเอกสาร

| คำ | ความหมายที่ใช้ตรวจ |
|---|---|
| must | เงื่อนไข release gate; ไม่ผ่านถือเป็น not-pass |
| should | เป้าหมาย UX; deviation ต้องมี owner และ expiry |
| proposed | ค่าเริ่มต้นที่ยังไม่วัด; ห้ามอ้างเป็นผลจริง |
| receipt | ไฟล์หลักฐานที่ผูก test/run/build/source/fixture hash และ timestamp |
| local fixture | model/host/browser/relay จำลองในเครื่อง ไม่เรียก provider หรือ cloud |
| reference capture | ภาพ/AX จาก Codex หรือ Cursor ที่ provenance ชัด; ใช้เป็น reference ไม่ใช่ Caret pass |
| critical interaction | พิมพ์, Enter/ส่ง, Queue, Stop, approval, drag splitter, scroll และ focus |
| frame miss | ช่วงเวลาระหว่าง frame ที่เกินเกณฑ์ display refresh ตาม §6.4 |
| unknown outcome | ส่ง command แล้วไม่ทราบผล side effect; ต้อง reconcile หรือให้ผู้ใช้เลือก |

ผลของแต่ละ test ใช้หนึ่งใน PASS, FAIL-CORRECTNESS, FAIL-PERF, FAIL-A11Y,
FAIL-PRIVACY, BLOCKED-EXTERNAL, NOT-VERIFIED, INCONCLUSIVE หรือ N/A-JUSTIFIED
ตาม §15 เท่านั้น ไม่มีการเปลี่ยน blocked/not-verified เป็น pass ด้วย screenshot หรือ
label ใน UI

### 1.3 ชั้นของหลักฐาน

1. **Deterministic fixture (required ก่อนทุก release):** OMP loopback, synthetic
   workspace, local HTTP browser, fake relay และ scripted clock/event stream
   ทำซ้ำได้โดยไม่มี network/provider
2. **Desktop/device acceptance (required ตาม platform ที่ประกาศ):** Caret ที่ build
   จริงบน Mac และ iPhone จริงสำหรับ mobile; ใช้ keyboard, VoiceOver, display และ
   network profile จริง
3. **Reference/pixel review (supporting):** capture ที่ sanitized เพื่อเปรียบเทียบ
   hierarchy, copy และ interaction intent; ไม่ใช้ปิด feature gap. **หลัง D20
   (2026-09-14) pixel target ของ Caret Mac shell คือ Cursor 3.20.17** จึงต้องมี
   side-by-side capture ที่ viewport/scale/theme เดียวกันตาม §3.3 ก่อนนับ parity pass

## 2. Test runner และ lifecycle ที่ทำซ้ำได้

### 2.1 รูปแบบ test ID

| Prefix | ขอบเขต |
|---|---|
| UI-S01 … UI-S16 | surface/function acceptance |
| UI-MOT-M01 … UI-MOT-M15 | motion choreography/reduced motion; M01–M15 ตรงกับ detailed design |
| UI-PERF | latency, long task, CPU/RSS, frame และ stress |
| UI-A11Y | keyboard, VoiceOver, contrast, zoom, touch target |
| UI-IME | Thai IME/composition/paste/keyboard |
| UI-MOB | iPhone continuity, background, cellular และ touch |
| UI-REC | disconnect/reconnect/host restart/unknown outcome |
| UI-SEC | privacy, CSP, redaction, origin/auth isolation |
| UI-ART | screenshot/AX/timeline/provenance artifact validation |

เลขท้ายเป็นสามหลักแบบ zero-padded และห้าม reuse ID เมื่อเปลี่ยน expected result;
ให้สร้าง ID ใหม่แล้วเก็บ superseded ID ใน manifest

### 2.2 Lifecycle ของหนึ่ง run

1. สร้าง runId แบบสุ่มที่ไม่บรรจุข้อมูลผู้ใช้ และบันทึก metadata ตาม §4
2. ตรวจ build/source/OMP/fixture hash และความสะอาดของ workspace; ยกเลิก run
   หาก revision หรือ display mode เปลี่ยนระหว่างชุดวัด
3. สร้าง temp workspace จาก fixture manifest, ล้าง state directory เฉพาะ fixture
   และยืนยันว่าไม่มี provider credential/real repository ใน path
4. เปิด Caret ด้วย feature flags และ theme/scale ที่กำหนด; รอ app-ready และ
   resource settle ตาม instrumentation ไม่ใช้การกะด้วยภาพอย่างเดียว
5. ทำ warm-up ตาม §5.2; reset task/scroll/focus ระหว่าง sample ตาม precondition
6. ทำ measured iterations, capture timestamps และ screenshot/AX ที่จุดที่ระบุ
7. ปิด task ตามเส้นทางปกติ, ตรวจ no orphan process และเก็บ post-run RSS/CPU
8. เขียน receipt แบบ atomic, คำนวณ SHA-256, redact แล้วตรวจ schema ก่อนรายงานผล

ห้ามใช้ provider จริง, login จริง, cloud run, connector ที่คิดเงิน, การ push commit,
การแก้ไฟล์นอก temp workspace หรือการส่งข้อความไปยังผู้ใช้คนอื่นใน test นี้

### 2.3 การควบคุมความแปรปรวน

- ใช้ monotonic clock ของ host และ timestamp ใน renderer ที่มี origin เดียวกัน;
  บันทึก clock source/resolution
- ปิด automatic update, backup/indexer ของ fixture และ notification ที่ไม่เกี่ยวข้อง;
  ไม่ปิด security control หรือ permission ที่ product ต้องรองรับ
- เสียบไฟสำหรับ desktop; บันทึก battery/thermal state; รอให้ CPU frequency/thermal
  settle ก่อน warm-up
- ไม่ใช้ screenshot compression หรือ video capture ใน latency run หากเพิ่ม overhead;
  ทำ capture run แยกต่างหาก
- ถ้า process crash, OS sleep, display mode เปลี่ยน, fixture hash mismatch หรือ
  มี background task ที่พิสูจน์ได้ ให้ระบุ INCONCLUSIVE และรันใหม่ทั้งชุด
  ห้ามลบเฉพาะ sample ที่ช้า

## 3. Deterministic fixtures และ workloads

Fixtures อยู่ใน test harness/temporary directory ที่ทีม implement ภายหลังจะจัดวาง
ตาม repository pattern; ตารางนี้เป็น contract ไม่ใช่คำสั่งติดตั้ง package ใหม่

| Fixture | เนื้อหาและขนาดคงที่ | ใช้กับ |
|---|---|---|
| F00-empty-shell | project หนึ่งรายการ, ไม่มี transcript, ไม่มี network | S01/S02/S16, idle baseline |
| F01-project-set | Git repo A (12 files), Git repo B (8 files), non-Git folder (5 files), ชื่อไทย/space/long path; 4 task states | S01/S02/S13 |
| F02-omp-scripted | scripted OMP owner: prompt, 40 deltas, tool call, question, approval, queue, steer, stop, error, terminal event; commandId/incarnation deterministic | S03–S06, S13, REC |
| F03-history-large | 500 messages, 50,000 rendered text tokens, 200 tool cards, 20 collapsed outputs, 10 media refs; event sequence 1…5000 | S04, PERF |
| F04-editor-conflict | TypeScript/JSON/Markdown files, LSP diagnostics 10 รายการ, dirty buffer version 7, disk version 8, two hunks conflict, binary file | S08/S09 |
| F05-terminal-stream | PTY 80×24→140×40, 100,000 lines/10 MB output, one long process, one exit 17, one user shell | S07/S10/PERF |
| F06-browser-local | local HTTP origins A/B, slow endpoint 1 s, error 500, CSP probe, file/Node bridge probe, 3 tabs | S07/S11/SEC |
| F07-artifacts | PNG, JPEG, SVG with unsafe text, WAV, MP3, MP4, PDF, Markdown, JSON, 0-byte/unknown MIME; build A/B hashes and failed build | S07/S12 |
| F08-mobile-relay | fake encrypted host/phone pair, event cursor 0…40, cellular profiles good/poor/offline, ACK before/after disconnect, revoked device | S14/S15/MOB/REC |
| F09-thai-ime | input source Thai Kedmanee (record OS), strings in §11, mixed Thai/English/code, multiline and candidate replacement script | S03/S15/IME |
| F10-render-stress | 3 concurrent tasks, 3,000 queued rows, stream 100 deltas/s for 30 s, terminal flood + panel resize + scroll | S04/S06/S07/PERF |
| F11-security | sentinel strings CARET_TEST_SECRET_01, fake token, absolute path, HTML/script payload, tracking URL, clipboard marker | S04/S11/S12/S13/SEC |
| F12-a11y | every S surface populated with labels, empty/error/disabled/loading variants; long Thai labels and 200% text scale | S01–S16/A11Y |

### 3.1 Fixture manifest contract

ทุก fixture ต้องมี fixtureId, schemaVersion, generatorRevision, manifestSha256,
workspaceSha256, ompRevision, eventSeed, clockMode, networkProfile,
expectedSideEffects และ cleanupPaths. expectedSideEffects ต้องว่าง หรือระบุเฉพาะ
ไฟล์ใน temp workspace ที่ test ตั้งใจเขียน

Scripted OMP event ต้องระบุอย่างน้อย sequence, sessionId, incarnation,
commandId, eventType, timestampOffsetMs, payloadSha256 และ terminal/isSideEffect
flag; ห้ามสุ่ม ID ระหว่าง sample เดียวกัน

### 3.2 Workload IDs

| Workload | การกระทำคงที่ | จำนวน sample |
|---|---|---|
| W01-idle | เปิดหน้า Agent แล้วไม่แตะ UI | 3 runs × 60 s |
| W02-input | พิมพ์ 40 ตัวอักษร, ลบ 10, move caret 5 ครั้ง | 30/รัน |
| W03-switch | Agent→IDE→Agent, เปิด task B แล้วกลับ task A | 30/รัน |
| W04-stream | replay 100 deltas/s 30 s พร้อม scroll อ่านอยู่ | 10/รัน |
| W05-history-scroll | เปิด history ใหญ่, scroll 0→100%→0% | 10/รัน |
| W06-terminal | พิมพ์ command, resize 2 ครั้ง, รับ 100k lines, stop | 10/รัน |
| W07-panel | เปิด/ปิด/resize resource panel สี่ชนิด | 30/รัน |
| W08-approval | เปิด question, validation fail, approve/deny สลับ | 20/รัน |
| W09-attachment | attach 3 files, pending→ready, fail→retry→remove | 20/รัน |
| W10-recovery | disconnect ก่อน/หลัง ACK, reconnect, replay, stale answer | 10/รัน |
| W11-mobile | phone foreground/background/cellular command + attachment | 10/รัน |
| W12-stress | W10 พร้อม 3 task/stream/terminal/resize | 3 runs × 10 min |

### 3.3 Pixel-parity comparison protocol (D20)

ใช้เมื่อต้องอ้างว่า Caret Mac shell เหมือน Cursor. เป็นหลักฐาน **supporting** ที่
เสริม deterministic fixture ไม่แทนกัน; การไม่มี capture ไม่ block การทำงานอื่น
แต่ block คำว่า "parity ผ่าน"

ขั้นตอนที่ทำซ้ำได้:

1. **แช่ environment:** theme เดียวกัน (Cursor Dark), light/dark แยกใบ,
   device-scale factor 1, ไม่มี colour-management/display scaling ที่ไม่ระบุ,
   viewport เดียวกัน (อย่างน้อย 1224×768 และ 1440×900), หน้าต่าง frontmost
2. **Capture Cursor:** เปิด Cursor Agents window + IDE window แล้ว capture ทั้งคู่
   พร้อมบันทึก version จาก Info.plist และชื่อ theme file
3. **Capture Caret:** รัน `scripts/shell-render-fixture.ts` สำหรับ agent shell และ
   packaged Caret.app สำหรับ IDE chrome; capture ด้วย viewport/scale/theme เดียวกัน
4. **วัด geometry จาก DOM/compositor จริง** ไม่ใช่จากภาพ: computed values ของ
   `--caret-*` tokens, `getBoundingClientRect()` ของ `.sidebar`, list row,
   `.topbar`, composer column แล้วเทียบกับค่า parity ใน D20
5. **วัด palette:** sample region เดียวกัน (chrome, editor, selected row, border)
   จากทั้งสองภาพด้วย `scripts/png-pixel-probe.py` แล้วเทียบ hex
6. **จำแนก delta** เป็นหนึ่งใน: `parity` (ภายใน tolerance), `deviation-by-design`
   (ต้องมีเหตุผล a11y/HIG), `gap` (ยังไม่ทำ) — ห้ามรวม gap เข้ากับ parity

Tolerance ที่เสนอบนภาพ JPEG/PNG ที่ผ่าน macOS colour management: ±3 ต่อ channel
สำหรับสี; ±1px สำหรับ geometry. ถ้าเกินให้รายงานเป็น delta ไม่ใช่ pass. ค่า
non-measured (เช่น syntax token colours) ต้องระบุชัดว่าไม่ได้วัด

**ห้ามนับ pass จาก:** screenshot เดี่ยวไม่มีคู่, การดูด้วยตา, การเทียบ scale ที่
ไม่ตรง, หรือการอนุมานจากชื่อ reference

### 3.4 Cursor palette parity gate (D20, 2026-09-14)

`bun scripts/check:cursor-parity` (หรือ `bun scripts/cursor-parity-check.ts`) อ่านไฟล์
theme จริงของ reference ที่ติดตั้งอยู่ แล้วเทียบค่าทุกคีย์ที่ Caret ประกาศไว้กับค่านั้น
โดยตรง. จุดประสงค์คือ hex ที่พิมพ์ผิดจะกลายเป็น check ที่ fail ไม่ใช่ความต่างแบบ
"ใกล้แต่ไม่เหมือน" ที่มองไม่เห็นใน screenshot

- ผลลัพธ์มี 3 แบบ: `OK` (ตรงทุกคีย์ที่ใช้ร่วมกัน), `FAIL` (มีคีย์ไม่ตรง → exit 1),
  `SKIP` (เครื่องนั้นไม่ได้ติดตั้ง reference) — **SKIP ไม่ใช่ pass** และต้องรายงานตามจริง
- คีย์ที่ Caret เขียนเอง (reference ไม่มี) รายงานเป็น `derived`; คีย์ที่จงใจ override
  reference (เช่น focus ring เพื่อ accessibility) ต้องประกาศในตาราง `ALLOWED_OVERRIDES`
  ของสคริปต์พร้อมเหตุผล มิฉะนั้นจะนับเป็น FAIL
- ใช้ `--verbose` เพื่อดูรายการ derived/override ทั้งหมด
- รันคู่กับ §3.3: สคริปต์นี้พิสูจน์ "สีตรงตามไฟล์ theme" ส่วน §3.3 พิสูจน์ "เรนเดอร์ออกมาตรง"

สคริปต์เดียวกันยังเทียบ **agent design tokens** ของ shell กับ token ที่ reference
ship มาใน `workbench.desktop.main.js` เป็น CSS custom property ชื่อ `--cursor-*`
(405 ตัว): font-size, line-height, height, radius (รวม `--cursor-radius-base` และ
`--conversation-surface-border-radius`), spacing, `--cursor-duration-*` และ
`--cursor-easing-out-cubic`. ยังเทียบ **component token** ที่ reference ตั้งชื่อเอง
(`--ui-sidebar-menu-button-min-height`, `--ui-sidebar-action-icon-size`,
`--conversation-surface-border-radius`) และตรวจว่า **ทุกค่า `--caret-space-*`
อยู่ใน spacing scale ของ reference**. สถานะปัจจุบัน 44 ค่าตรงทั้งหมด. ตารางค่าอยู่ใน D20

รัน `--verbose` เพื่อดูตารางเทียบทีละค่า. ตัว gate ถูกทดสอบแล้วว่า **จับ regression
ได้จริง** (ตั้ง `--caret-row: 27px` ชั่วคราว → FAIL แล้ว revert)

## 4. Hardware, display, build และ environment metadata

### 4.1 Platform matrix

ก่อนอ้าง release ให้ประกาศ row ที่รองรับจริงอย่างน้อยหนึ่ง row ต่อ platform:

| Row | อุปกรณ์/เงื่อนไข |
|---|---|
| mac-60 | Mac ที่อยู่ใน supported OS/CPU ของ release, จอจริง 60 Hz, native scale |
| mac-120 | Mac + จอจริง 120 Hz หรือ ProMotion; ถ้าไม่มีให้ผล NOT-VERIFIED ไม่ใช่จำลองว่า pass |
| iphone-cellular | iPhone จริงใน supported iOS, portrait และ landscape, cellular route ไป Mac host |
| iphone-sim-preflight | Simulator ใช้ preflight เท่านั้น; ไม่ปิด gate ของอุปกรณ์จริง |

ห้ามรวมผลต่าง CPU/GPU/OS/display เป็นค่าเดียวโดยไม่มีการแบ่ง row; performance
budget ต้องผ่านทุก row ที่ระบุเป็น required

### 4.2 Required metadata

บันทึกใน run-manifest.json อย่างน้อย:

- runId, UTC start/end, operator/automation version และ timezone
- app version, package revision, Git commit, dirty flag, build profile,
  Code-OSS revision, extension revision, renderer/Node/Bun version
- OMP pinned revision, adapter/schema revision, fixture ID/manifest hash,
  feature flags และ capability catalog hash
- OS version/build, device model, CPU core count, RAM, GPU, thermal/power mode,
  battery percentage, process architecture
- display model, refresh rate (60/120), resolution, logical viewport,
  scale/DPR, color profile, theme, text scale, reduced-motion setting
- network interface/profile, RTT/loss/bandwidth, relay endpoint class (ไม่เก็บ secret)
- process IDs (Caret host/renderer/OMP/terminal/browser), sampling tool/version
- locale, keyboard layout/Thai input source, VoiceOver state และ accessibility zoom

ค่า path, username, serial, token, URL query และ transcript ที่อาจมีข้อมูลผู้ใช้
ต้อง hash/redact ก่อนเขียน receipt; เก็บ raw เฉพาะ temp ที่เข้ารหัสและลบตาม retention

### 4.3 Environment preparation

1. ใช้ user account/test profile แยกจาก personal chat/repository
2. เสียบไฟ desktop, ตั้งจอและ scale คงที่, ปิด screen sleep ระหว่าง run
3. ปิดแอปหนักที่ไม่ได้อยู่ใน fixture; บันทึกรายชื่อ process ที่ยกเว้น
4. ใช้ network profile ของ fixture; ห้าม fallback ไป provider จริงเมื่อ local server down
5. warm-up จน app/OMP/browser/terminal พร้อม และยืนยัน process owner หนึ่งชุด
6. เมื่อเปลี่ยน refresh rate, theme, text scale, OS หรือ build ให้เริ่ม run ใหม่

## 5. Metric contract และ sampling

### 5.1 Timestamp start/end

Instrument event ชื่อในตารางนี้โดยใช้ clock เดียวกัน; ถ้า event ใดไม่มี ให้ test
เป็น NOT-VERIFIED พร้อมบันทึก missing instrumentation ห้ามเดาเวลาจาก screenshot

| Metric | t0 (start) | t1 (end) | รายงาน |
|---|---|---|---|
| input_feedback_ms | keydown สำหรับ key ปกติ หรือ compositionend สำหรับ IME | first presented frame ที่มีตัวอักษรใหม่และ caret ถูกตำแหน่ง | p50/p95/max; แยก normal/IME |
| submit_receipt_ms | trusted click/Enter ที่ผ่าน validation | OMP owner receipt แสดง submitted/queued พร้อม commandId | p50/p95; ไม่รวม model inference |
| mode_switch_commit_ms | key/click/command ที่เลือก Agent↔IDE | view/task state store commit ก่อน await/animation | target 0 ms ตาม D15; รายงาน actual |
| mode_switch_ms | key/click/command ที่เลือก Agent↔IDE | destination landmark visible, task identity ตรง, focus อยู่ target และ 2 frame ต่อเนื่องไม่มี layout shift | p50/p95/max |
| task_restore_ms | เลือก task เดิม | draft hash, attachment refs, scroll anchor, panel tabs และ editor buffer ตรง manifest | p50/p95 |
| panel_open_ms | pointer/keyboard activation | panel header + first content paint + focus target พร้อม | p50/p95 |
| panel_close_ms | activation close/Escape | panel hidden และ focus กลับ trigger | p50/p95 |
| approval_response_ms | answer click/submit | OMP response receipt ผูก requestId/incarnation และ card terminal state | p50/p95 |
| first_stream_paint_ms | owner agent_delta/tool event receive | first frame ที่แสดง delta นั้น | p50/p95 |
| batch_paint_ms | batch scheduler commit | frame present ที่มี batch สุดท้าย | p95; ไม่รวม network wait |
| scroll_frame_interval_ms | frame callback ระหว่าง drag/wheel | frame callback ถัดไป | p95/p99 + missed-frame rate |
| editor_apply_ms | apply proposal action | document version/hash และ undo entry แสดง | p50/p95 |
| terminal_resize_ms | resize observer committed cols/rows | PTY ack + rendered cursor/output ในขนาดใหม่ | p50/p95 |
| browser_nav_ms | navigation accepted | load/error terminal state ของ local fixture | p50/p95 |
| artifact_open_ms | select artifact | MIME viewer first usable paint หรือ safe-download state | p50/p95 |
| reconnect_replay_ms | transport connected event | last expected sequence reconciled and UI freshness state current | p50/p95 |
| mobile_command_rtt_ms | phone send tap | same commandId receipt/event visible on phone | p50/p95 |
| focus_restore_ms | close modal/panel/switch | expected element focused and announced | p50/p95 |

first paint ต้องเป็น presented frame/paint marker ไม่ใช่ DOM mutation; usable หมายถึง
control ที่ expected ใน fixture กดได้จริงและ accessible name/state ถูกต้อง

### 5.2 Warm-up และ sample

- latency interaction: warm-up 5 ครั้ง, วัด 30 ครั้งต่อ run, ทำ 3 runs ต่อ row
- stream/panel/approval: warm-up 3, วัด 20 ครั้ง, 3 runs
- long transcript/terminal/browser: warm-up 2, วัด 10 ครั้ง, 3 runs
- CPU/RSS idle: warm-up 60 s, วัด foreground 60 s และ background 60 s;
  stress memory ทำ 10 min และ leak soak 30 min
- frame: window 10 s ต่อ critical interaction, ทำซ้ำ 3 ครั้งต่อ refresh row
- mobile/recovery: ทำ 10 scenario repetitions ต่อ network profile; side effect
  ต้อง reset จาก journal ไม่ใช่ยิง command เดิมแบบไม่เปลี่ยน commandId

ใช้ N samples ที่ valid ตาม protocol และ nearest-rank p95:
rank = ceil(0.95 × N) หลังเรียงค่าจากน้อยไปมาก; p99 ใช้ ceil(0.99 × N).
ไม่ winsorize, trim หรือ drop sample ที่ช้า หากมี contamination ให้ invalidate
ทั้ง run พร้อมเหตุผลและเริ่ม run ใหม่

### 5.3 ข้อจำกัดการวัด

- แยก instrumented กับ capture run เมื่อ DevTools/AX/video เปลี่ยน timing
- ไม่รวม fixture server boot, model generation และ file download ใน UI-only metric
  แต่รายงานเป็น fixture_wait_ms แยกต่างหาก
- รายงาน p50, p95, p99/max, sample count, invalid count และ raw timeline hash
- ทุก budget ใน §6 เป็น proposed; test report ต้องใส่ budgetStatus: proposed จนกว่า
  product owner จะ freeze ตัวเลข

## 6. Proposed budgets: responsiveness, CPU/RSS และ frames

ตารางนี้เป็น design target สำหรับ release candidate ไม่ใช่ benchmark ของ Caret,
Cursor หรือ Codex

### 6.1 Interaction latency

| Metric | Proposed budget ต่อ required row |
|---|---:|
| local input feedback ปกติ | p95 ≤ 50 ms, max ≤ 100 ms |
| Thai IME input feedback | p95 ≤ 80 ms, max ≤ 150 ms |
| mode/task commit (D15) | 0 ms intentional wait; state update synchronous ก่อน paint |
| cached Agent↔IDE paint/restore | p95 ≤ 150 ms, max ≤ 250 ms |
| task restore (state อยู่ในเครื่อง) | p95 ≤ 200 ms |
| panel enter/close | p95 ≤ 180/120 ms ตาม motion token |
| menu/approval sheet visible | p95 ≤ 150 ms |
| submit/Queue local receipt | p95 ≤ 100 ms |
| first stream paint หลัง owner event | p95 ≤ 100 ms |
| stream batch commit | p95 ≤ 16.7 ms ที่ 60 Hz; ≤ 8.3 ms ที่ 120 Hz |
| editor apply/undo local | p95 ≤ 100 ms |
| PTY resize acknowledgement | p95 ≤ 100 ms |
| browser local navigation terminal | p95 ≤ 1,200 ms (รวม fixture slow 1 s แยก) |
| artifact first usable paint ≤1 MB | p95 ≤ 300 ms |
| mobile command RTT บน good cellular | p95 ≤ 2,000 ms |
| reconnect replay หลัง transport พร้อม | p95 ≤ 5,000 ms และ no missing sequence |

### 6.2 Long task และ input starvation

- critical interaction ต้องมี long task >50 ms ไม่เกิน 1 ครั้งใน window 10 s และ
  ต้องไม่มี long task >100 ms ที่ทับ keydown, approval submit, Stop หรือ terminal input
- ใน W04/W05/W06 ต้องไม่ค้าง main-thread ต่อเนื่องเกิน 2 frame nominal
- input event ที่เกิดระหว่าง stream ต้องวัดเป็นราย event และเข้า input latency budget
  ของตัวเอง; ห้ามใช้ event interval เป็น proxy เมื่อผู้ใช้พิมพ์ถี่
- ถ้า browser/renderer instrumentation unavailable ให้เป็น NOT-VERIFIED ไม่ใช่ pass

### 6.3 CPU/RSS idle และ baseline policy

วัด process tree ของ Caret host + renderer + extension + OMP owner แยก process
และรวมทั้ง tree ทุก 1 s; รายงาน median/p95/peak CPU เป็นเปอร์เซ็นต์ของหนึ่ง core
และ RSS เป็น MiB

ทำ baseline สามแบบบน **เครื่อง/build เดียวกัน**:

1. B0-process: เปิด app แล้วอยู่หน้า empty shell โดยไม่มี OMP stream/panel
2. B1-ide: เปิด IDE workspace เดียวกันโดยไม่เปิด Agent resource
3. B2-feature: เปิด feature ที่วัด (task/stream/panel) หลัง warm-up

Policy ที่เสนอ (ยังไม่วัด):

- foreground idle W01 60 s: median ≤ 1.5% one-core, p95 ≤ 3%; B2−B0
  ต้องไม่เกิน +1.0 percentage point โดยไม่มีเหตุผลจาก active stream
- background/minimized idle 60 s: median ≤ 0.5%, p95 ≤ 1%; nonessential
  animation/timer ต้องหยุดหรือ back off และ B2−B0 ≤ +0.5 point
- RSS หลัง warm-up 60 s: B2 ไม่เกิน B0 + 250 MiB สำหรับ shell และ B1 + 200 MiB
  สำหรับ IDE; เป็น guardrail ไม่ใช่ comparison กับ Cursor
- หลัง W12 10 min แล้วหยุด stream/ปิด panel และรอ 60 s: RSS ต้องลดกลับภายใน
  10% ของ pre-stress delta หรือไม่เกิน +150 MiB; ถ้าไม่ลดให้เปิด leak investigation
- soak 30 min: RSS slope ต้องไม่เกิน +2 MiB/min หลัง 5-min warm-up

หากเครื่องมี memory pressure, thermal throttling, external display compositor หรือ
background process ที่เปลี่ยนกลาง run ให้รายงานทั้ง raw และ INCONCLUSIVE; ห้าม
ลด budget เฉพาะ row ที่ไม่ผ่าน

### 6.4 60/120 Hz frame policy

วัดจาก display-present/frame-timeline ของ renderer/compositor บนจอจริง ไม่ใช้
CSS requestAnimationFrame เพียงอย่างเดียว และต้องบันทึก refresh ที่ OS รายงาน

- nominal period P = 16.67 ms (60 Hz) หรือ 8.33 ms (120 Hz)
- frame interval I > 1.5P นับเป็น missed frame; I > 2P นับเป็น severe miss
- critical window 10 s ต้องมี missed-frame rate ≤1% ที่ 60 Hz และ ≤2% ที่ 120 Hz
  (120 Hz เป็น proposed เนื่องจาก compositor variance)
- ต้องไม่มี severe miss ระหว่าง typing, approval, Stop, drag splitter หรือ terminal input
- p95 I ต้อง ≤P + 1 ms timing tolerance และ p99 ต้อง ≤1.5P; รายงาน total frames, missed, severe,
  longest interval และ refresh stability
- panel drag ต้อง follow pointer ไม่ snap; stream append ต้องไม่สร้าง burst
  ที่ทำให้ scroll position กระโดด

หากไม่มีจอ 120 Hz จริง ผล mac-120 เป็น NOT-VERIFIED; simulator หรือแค่ตั้ง
CSS 120 Hz ไม่ใช้แทน hardware gate

### 6.5 Motion-specific timing

| Motion | Proposed from→to | Metric/acceptance |
|---|---|---|
| hover/focus/selected | color/opacity ≤100 ms, focus ring immediate | no layout shift; focus visible ทุก frame |
| Agent↔IDE/task/tab | default state commit 0 ms และไม่ animate; ถ้าเปิด optional opacity ≤120 ms | focus/content ready ≤150 ms; interrupt ได้ |
| resource drawer | enter 180 ms, exit 120 ms, translate+opacity, cubic-bezier(.2,0,0,1) | reverse mid-flight ได้, no content jump |
| desktop menu | enter 150 ms, exit 100 ms, translateY 4 px+opacity | effect permission ไม่ผูก animation end |
| mobile approval sheet | enter 180 ms, exit 120 ms, safe-area aware | response/permission ไม่ผูก animation end; reduced motion = immediate |
| tool details expand | reveal 150 ms | scroll anchor stable; no token-by-token animation |
| submit press | scale .96 ≤150 ms เฉพาะ non-repeat | Stop/destructive ไม่ scale; keyboard focus stable |
| contextual icon swap | scale .25→1, opacity 0→1, blur 4→0, 300 ms same easing | no bounce; action/label changes immediately |
| theme/recovery/stream | no decorative transition | reduced motion และ hidden window ไม่ loop |

transition: all, full-window blur, staggered rows, animated editor sash และ animation
ที่บัง terminal input เป็น violation ของ spec แม้เฟรมเรตจะผ่าน

## 7. Component map และ surface acceptance: S01–S16

รายละเอียด layout/state/visual tokens หลักอยู่ในเอกสาร detailed design; ตารางนี้
ผูก component ID ให้ตรวจ implementation และ evidence แยกจาก generic card count

| Component ID | ชื่อ component contract | Surface |
|---|---|---|
| VC01 | project/task navigator | S01 |
| VC02 | task header + Agent/IDE mode switch | S02 |
| VC03 | composer + attachment tray | S03 |
| VC04 | transcript/activity timeline | S04 |
| VC05 | question/approval form | S05 |
| VC06 | plan/goal/parallel queue | S06 |
| VC07 | task resource panel/sash | S07 |
| VC08 | changes/review/diff | S08 |
| VC09 | Code-OSS IDE bridge | S09 |
| VC10 | terminal/PTY panel | S10 |
| VC11 | browser tab/bridge | S11 |
| VC12 | preview/artifact viewer | S12 |
| VC13 | OMP catalog/configuration | S13 |
| VC14 | devices/recovery/relay | S14 |
| VC15 | mobile task shell | S15 |
| VC16 | product settings/diagnostics | S16 |

กติกาทุก surface: ทำทั้ง light/dark (ถ้า platform รองรับ), normal/reduced motion,
100%/200% text scale, keyboard path และ pointer/touch path ที่เกี่ยวข้อง; เก็บ
before/after screenshot, AX tree และ timeline ตาม §14. ขั้นตอนใช้ fixture ที่ระบุ
และทุก expected เป็นเงื่อนไข observable

### S01 — Projects/tasks

| Test ID | Setup และขั้นตอน deterministic | Expected / artifact |
|---|---|---|
| UI-S01-001 | F01 เปิด Caret → เลือก Projects → เปิด repo A, repo B, non-Git ตามลำดับ | แสดงชื่อ/cwd/status แยกกัน, task/session/artifact ไม่ปน; state, AX และ screenshot |
| UI-S01-002 | ค้นหา task ด้วย prefix ไทย/อังกฤษ → pin → archive → search archived → restore → rename | ผลค้นหาตรง case/locale, archive ไม่ลบ transcript/draft, rename สะท้อนทุก header; event journal ไม่มี duplicate |
| UI-S01-003 | เปิด task A ที่ running และ task B ที่ waiting approval → สลับ A/B 10 รอบ | badge/status และ attention indicator ผูก task ถูก; ไม่ตอบ approval ของ B ใน A; focus/scroll ต่อ task |
| UI-S01-004 | พิมพ์ draft + attach ใน A → quit/reopen UI โดย host/OMP ยังอยู่ → เปิด A | draft/attachment refs/scroll anchor คืนครบ, ไม่มี auto-send, OMP owner/sessionId/incarnation เดิม |
| UI-S01-005 | ลบ/ย้าย temp fixture path ให้ inaccessible แล้วเปิด recent entry | แสดง unavailable/error พร้อม recovery; ไม่สร้าง folder/process ใหม่เงียบ ๆ; no data loss |
| UI-S01-006 | ใช้ sidebar filter All/Active/Needs attention/Archived กับ F01 4 task states | จำนวน/ordering ตรง manifest, filter ไม่เปลี่ยน server state, empty filter มี clear/alternate action และ focus คืน |

### S02 — Task header และ Agent↔IDE

| Test ID | Setup และขั้นตอน deterministic | Expected / artifact |
|---|---|---|
| UI-S02-001 | F02 task A, พิมพ์ draft → Agent→IDE → กลับ Agent | draft hash, transcript, selection, scroll, panels, focus ถูกคืน; OMP owner count/session identity ไม่เปลี่ยน |
| UI-S02-002 | เปิด menu → fork/resume/branch โดยใช้ fixture confirmation → inspect lineage | preview ระบุผลต่อ cwd/branch/worktree ก่อนยืนยัน; parent/child IDs ไม่สับสน; cancel ไม่มี side effect |
| UI-S02-003 | เปิด task A→B→A ระหว่าง stream และ resize window | task identity, branch, model, layout widths ต่อ task ถูก; no renderer reload ที่ล้าง buffer |
| UI-S02-004 | ปิด host connection ระหว่าง header status update → reconnect | แยก host unreachable/relay unavailable/OMP error, last-known time ชัด; ไม่แสดง connected ปลอม |
| UI-S02-005 | เปิด environment selector → เลือก repo/branch → preview New Worktree → cancel แล้วทำซ้ำยืนยันใน temp | base path/branch/worktree และ side effect scope แสดงก่อน commit; cancel ไม่สร้าง worktree; owner/session ไม่ fork โดยไม่ตั้งใจ |

### S03 — Composer

| Test ID | Setup และขั้นตอน deterministic | Expected / artifact |
|---|---|---|
| UI-S03-001 | F09 พิมพ์ข้อความ → Enter, Shift+Enter, Cmd+Enter ตาม binding | Enter ส่งเมื่อ composition จบและพร้อมเท่านั้น; Shift+Enter newline; shortcut ที่ resolve จริงแสดงใน tooltip; draft ไม่หายก่อน receipt |
| UI-S03-002 | attach 3 files + selection + terminal log → เปลี่ยน model ระหว่าง upload | chips แสดง pending/ready/error, model change ไม่ส่ง snapshot ผิด, failed upload retry/remove ได้; payload hash ตรง ready refs เท่านั้น |
| UI-S03-003 | F02 running → ยืนยันว่า Queue เป็น primary → กด Queue, Steer, Stop ตามลำดับ | Queue เพิ่ม follow-up ตาม owner, Steer ถึง current run, Stop stopping→terminal; ไม่ auto-send queue/ไม่ rollback edits |
| UI-S03-004 | double-click Send/Queue 3 ครั้ง และจำลอง timeout ก่อน receipt | มี command เดียวหรือ dedupe receipt, ปุ่ม disabled ด้วยเหตุผล, draft คงอยู่; unknown state ไม่มี Retry อัตโนมัติ |
| UI-S03-005 | ตั้ง provider/model unavailable และ effective config ต่าง scope | แสดง available/needs-auth/unsupported/error แยกกัน; ไม่ fallback billed/provider เงียบ; config precedence มี source |
| UI-S03-006 | ตัด transport ให้ offline แล้วกด Send/Queue/Steer; แก้ draft และ reconnect | controls dispatch disabled, ป้าย offline/last-sync ชัด, draft save ได้; reconnect ไม่ auto-send และต้อง submit ใหม่ explicit |

### S04 — Transcript/activity

| Test ID | Setup และขั้นตอน deterministic | Expected / artifact |
|---|---|---|
| UI-S04-001 | Replay F02 text/code/table/media/tool/error stream | card type, elapsed, tool status, source links, copy และ error semantics ตรง event; output untrusted ไม่ execute |
| UI-S04-002 | F03 เปิด transcript → scroll กลาง → append 100 deltas → collapse tool card | scroll anchor/eventId คงที่ขณะอ่าน, มี Jump to latest, collapse ไม่กระโดด; focus/AX relation ถูก |
| UI-S04-003 | เปิด history page แรก → paginate จน 500 messages → กลับต้น/ท้าย | ไม่มี duplicate/missing sequence, DOM/log bounded ตาม implementation contract, loading/error/retry ไม่ล้าง current page |
| UI-S04-004 | เปิด F11 markdown/script/link/sentinel → copy source/file link | แสดงเป็น text/safe link, CSP/allowlist ทำงาน, secret ไม่โผล่ transcript/screenshot/clipboard |
| UI-S04-005 | stream 100 deltas/s ขณะเปิด/ปิดรายละเอียด 20 tool cards และสลับ task | batch/backpressure bounded, user scroll/input ไม่ starve, card state ไม่ข้าม task, timeline เก็บ sequence ครบ |

### S05 — Questions/approvals

| Test ID | Setup และขั้นตอน deterministic | Expected / artifact |
|---|---|---|
| UI-S05-001 | F02 question text → invalid answer → valid answer → inspect OMP receipt | validation ผูก field, answer ส่งครั้งเดียวพร้อม requestId/incarnation, effect เกิดหลัง allow เท่านั้น |
| UI-S05-002 | เปิด multi-select/select/editor form → keyboard navigate → submit/Cancel | schema labels/options/required ถูก, keyboard path ครบ, cancel ไม่มี effect, stale form disabled |
| UI-S05-003 | สร้าง approval A/B พร้อมกัน →ตอบ B ก่อน → เปลี่ยน task →ตอบ A | response ผูก task/session/request ถูก; attention count ลดเฉพาะใบที่ตอบ; no cross-task response |
| UI-S05-004 | disconnect, revoke device หรือ expire request ก่อนตอบ | แสดง stale/revoked/timeout, ไม่ส่ง answer เก่าเมื่อ reconnect; ผู้ใช้ต้อง Inspect/Reconcile เอง |

### S06 — Plan/goals/parallel/automation

| Test ID | Setup และขั้นตอน deterministic | Expected / artifact |
|---|---|---|
| UI-S06-001 | F02 ส่ง events goal active→blocked→complete และ plan step fail | state label/เหตุผล/budget ตรง event; idle turn ไม่เปลี่ยน goal เป็น complete; retry ต้อง explicit |
| UI-S06-002 | enqueue follow-ups 1,2,3 → remove/reorder เฉพาะ operation ที่ registry อนุญาต | order/receipt ตรง OMP owner; unsupported reorder แจ้งเหตุผล ไม่แก้ client-only |
| UI-S06-003 | เปิด 2 internal subagent lineage + 2 root tasks | tree แยก parent/session/workspace, resource cap/status/error visible; internal subagent ไม่กลายเป็น unrelated root |
| UI-S06-004 | stop parent ระหว่าง child running แล้ว reconnect | parent/child terminal semantics ตรง runtime; Stop ไม่ลบ history/edits; unknown child outcome แยกชัด |
| UI-S06-005 | F02 สร้าง automation run 6 รายการ (success/failed/running/paused) → เปิด Run history → filter status/project/time | filter เป็น view-only, row แสดง run ID/status/time/target และ failure reason, selecting row ไม่ rerun และไม่มี provider call |

### S07 — Work panel

| Test ID | Setup และขั้นตอน deterministic | Expected / artifact |
|---|---|---|
| UI-S07-001 | เปิด Changes→Terminal→Browser→Preview→Artifacts ต่อ task A | tab/resource ID ต่อ task ถูก, first content/focus พร้อม, unread/error badge accessible |
| UI-S07-002 | resize panel min→max, collapse, reopen, pop to IDE และกลับ | clamps main ≥360 logical px ตาม spec, keyboard splitter ทำงาน, layout restore; no panel process duplicate |
| UI-S07-003 | host ปิด terminal/browser resource ระหว่าง panel เปิด | expired/error แสดง identity/time/action; ไม่สร้าง process/server แทนเงียบ |
| UI-S07-004 | เปิด resource ของ A แล้วสลับ B/reconnect | no cross-task content/credential, panel tabs and unread count restored per task |

### S08 — Changes/review

| Test ID | Setup และขั้นตอน deterministic | Expected / artifact |
|---|---|---|
| UI-S08-001 | F04 เปิด tracked/untracked/binary diff แล้วเลือก file/hunk | summary/hunk/binary handling ถูก, source hash/path visible, no whole-repo reset |
| UI-S08-002 | stage/unstage hunk 1 → scoped accept/reject hunk 2 → inspect index/worktree | ผลเฉพาะ scope, confirmation สำหรับ destructive action, undo/review receipt ตรง |
| UI-S08-003 | dirty buffer v7 + disk v8 → agent apply proposal → resolve conflict | ไม่ overwrite unsaved buffer, แสดง three-way/conflict และ version/hash, user choice ก่อน write |
| UI-S08-004 | branch/worktree bring-back preview → commit confirmation → cancel | target branch/cwd/changed files ชัด, cancel no effect, commit receipt/sha only after actual fixture action |
| UI-S08-005 | เปิด review ระหว่าง F02 stream และสลับ task | review snapshot ผูก task/commit hash, stream ไม่เขียนทับ diff view, stale review แจ้ง refresh |

### S09 — IDE/editor

| Test ID | Setup และขั้นตอน deterministic | Expected / artifact |
|---|---|---|
| UI-S09-001 | เปิด files 4 tabs, 2 splits, dirty cursor/undo → Agent→IDE→Agent→IDE | editor buffers, cursor, undo, splits/tab order unchanged; no textarea substitute/LSP loss |
| UI-S09-002 | trigger F04 diagnostics, symbol nav/rename, debugger breakpoint, test command | language/debug/test UI reports real fixture results, loading/error/unsupported explicit; no fake green |
| UI-S09-003 | show inline proposal → partial accept/reject → undo → stale buffer edit | proposal versioned, partial scope correct, undo restores exact text, stale proposal rejected/refresh requested |
| UI-S09-004 | user edit while agent apply pending → accept/reject both paths | conflict/merge choice visible, no silent overwrite, event and file hash match expected |
| UI-S09-005 | switch Agent↔IDE while editor extension/loading/diagnostic error is visible | IDE state and error remain recoverable, agent panel does not dispose editor, extension host count stable |

### S10 — Terminal/process

| Test ID | Setup และขั้นตอน deterministic | Expected / artifact |
|---|---|---|
| UI-S10-001 | F05 PTY 80×24 → type command → resize 140×40 → type Thai label | input echo/cursor/resize ack ถูก, scrollback bounded/downloadable, Thai ไม่แปลง command ผิด |
| UI-S10-002 | start long process → close panel → reopen → Stop → exit 17 | process survives UI panel close, Stop is explicit, exit code/log/artifact visible; no orphan after teardown |
| UI-S10-003 | run user shell and agent command concurrently | cwd/env/PTY/output/permissions แยก; user input ไม่เข้า agent process และ vice versa |
| UI-S10-004 | quit Caret UI while host/OMP process runs → reopen | host continues by contract, status/replay correct, no second owner/process spawned |
| UI-S10-005 | emit 100k lines with ANSI/color/error and copy/download selection | render bounded, copy has requested range only, download hash matches log, no UI freeze or secret leak |

### S11 — Browser

| Test ID | Setup และขั้นตอน deterministic | Expected / artifact |
|---|---|---|
| UI-S11-001 | F06 navigate A→slow→500 error→back/forward/reload | URL/tab/origin/loading/error states correct, slow state cancellable, no credential leakage |
| UI-S11-002 | open 3 tabs → select element/console/network/screenshot only when bridge advertises | controls capability-gated; unsupported states explain missing bridge; tab/session ownership stays task A |
| UI-S11-003 | run F11 Node/file/unsafe-origin probes from page | page cannot access Node, filesystem or host bridge; CSP/allowed schemes block and record safe diagnostic |
| UI-S11-004 | disconnect/reconnect browser resource with existing local server | no server duplicate, tab ID preserved or expired explicitly, no hidden navigation/side effect |
| UI-S11-005 | switch A/B with same URL and clear cache only through explicit user action | cookies/storage/profile scope per task, no cross-project credential reuse, clear action confirmation visible |

### S12 — Preview/artifacts

| Test ID | Setup และขั้นตอน deterministic | Expected / artifact |
|---|---|---|
| UI-S12-001 | เปิด every F07 MIME รวม 0-byte/unknown/unsafe SVG | viewer ตาม MIME, safe text/download for unknown, original bytes hash unchanged, no execute |
| UI-S12-002 | select build A → failed build → build B → switch A/B | buildId/hash/source receipt visible, failed build ไม่ทับ last-good, selection explicit |
| UI-S12-003 | download original 5 MB with cancel/retry/hash check | progress/cancel/retry deterministic, final hash matches manifest, partial file not presented as complete |
| UI-S12-004 | open same build on Mac and iPhone fixture | buildId/hash/MIME metadata same; unsupported mobile viewer offers safe fallback reason |
| UI-S12-005 | corrupt artifact hash/MIME metadata then open | viewer refuses/marks corrupt, offers safe re-fetch, never executes guessed type; last-good remains selectable |

### S13 — OMP settings/catalog

| Test ID | Setup และขั้นตอน deterministic | Expected / artifact |
|---|---|---|
| UI-S13-001 | F02 catalog has global/project/task config conflicts → inspect effective value | source/scope/precedence shown; switch model does not clear session/draft; registry hash recorded |
| UI-S13-002 | mark provider needs-auth, unavailable, malformed config, disabled tool | four states distinct with recovery; no fake enabled button or silent provider switch |
| UI-S13-003 | register built-in tool, MCP, skill, hook and dynamic tool fixture | schema/input/output/media/approval/cancel/extension state accessible; missing operation is open gap |
| UI-S13-004 | F11 sentinel in config/log/error; inspect export | secrets redacted at UI, log, clipboard and diagnostic export; no billed/cloud fallback or credential echo |
| UI-S13-005 | set effort/fast parameters at global/project/task scope → switch task/model → inspect effective request | parameters and source precedence visible, sent OMP payload hash exact, no silent reset or provider fallback |

### S14 — Devices/recovery

| Test ID | Setup และขั้นตอน deterministic | Expected / artifact |
|---|---|---|
| UI-S14-001 | pair fake phone → expire → re-pair → revoke old device | pairing identity/expiry/revoke status clear; revoked device cannot command; QR payload ไม่อยู่ใน log/export |
| UI-S14-002 | F08 disconnect at sequence 10 → reconnect → replay to 40 | progress/freshness/cursor visible, gap-free sequence and same session/incarnation, duplicate events deduped |
| UI-S14-003 | send side-effect command → cut transport before ACK → reconnect | แสดง pending แล้ว reconcile เป็น known outcome เมื่อ journal ยืนยัน; ถ้ายังคลุมเครือจึงเป็น outcome_unknown และมี Inspect/Reconcile เท่านั้น; never auto-repeat |
| UI-S14-004 | export diagnostics after error/revoke | manifest includes versions/counters but redacts paths/tokens/content; user can cancel export |
| UI-S14-005 | pair device A/B to tasks A/B, disconnect B and switch tasks | device/task access matrix enforced, no event/credential cross-over, revoke and recovery receipt complete |

### S15 — Mobile task

| Test ID | Setup และขั้นตอน deterministic | Expected / artifact |
|---|---|---|
| UI-S15-001 | iPhone foreground opens same F08 task → switch task A/B → receive stream | session/transcript/status/approval identity same as Mac, no second OMP owner, touch targets ≥44 pt |
| UI-S15-002 | attach photo/file fixture, submit, answer approval on phone | upload lifecycle and answer receipt visible, request scope/target/cwd clear, stale response rejected |
| UI-S15-003 | disable network → edit draft → background 2 min → restore cellular | draft local and unsent, freshness/last-sync visible, replay no duplicate, no auto-send |
| UI-S15-004 | rotate portrait/landscape, open keyboard, Dynamic Type largest, VoiceOver | safe area/composer/approval not obscured, scroll/focus/labels usable; unsupported IDE view offers Agent/resource route |
| UI-S15-005 | phone receives build A preview while Mac selects failed build then B | phone does not silently replace selected build, buildId/hash shown and same as Mac when selected |

### S16 — Product settings

| Test ID | Setup และขั้นตอน deterministic | Expected / artifact |
|---|---|---|
| UI-S16-001 | toggle light/dark/high-contrast, text scale 100→200%, Reduce Motion | tokens/contrast/focus consistent, layout no clip/overflow, motion switches immediate without losing state |
| UI-S16-002 | inspect/modify shortcuts with collision (Cmd+Enter, Escape, IDE keys) | conflict detected and resolvable, effective shortcut shown from keybinding service, no hardcoded mismatch |
| UI-S16-003 | inspect notifications/voice/media/native capability states | available/needs-auth/unsupported/error explicit; no fake enabled control or hidden provider |
| UI-S16-004 | open version/runtime/license/update/migration diagnostics on old fixture state | version/schema/rollback/backup status visible, migration idempotent, cancel/failed update keeps usable old state |
| UI-S16-005 | change sidebar/task/history filter defaults → restart → inspect automation run history filters | preferences persist only intended scope, history remains view-only, reset restores defaults and does not rerun |

### 7.1 Cross-surface state checklist

ทุก Sxx ต้องเพิ่ม state rows ใน report แม้ UI จะใช้ component ร่วม:

| State | Observable requirement |
|---|---|
| loading | progress/aria-busy และ cancel/retry ถ้ามี; ไม่แสดง stale data เป็น current |
| empty | อธิบายว่าต้องทำอะไรต่อและมี alternate entry point |
| ready | primary action, focus order, shortcut และ capability status ถูก |
| active/streaming | status/Stop/Queue/Steer ตาม OMP event; no unbounded repaint |
| error | error code/ข้อความปลอดภัย, retry semantics และข้อมูลเดิมไม่หาย |
| permission/needs-auth | scope/target/identity ก่อนอนุมัติ, secret ไม่แสดง |
| offline/reconnecting | last-known time/freshness, draft retained, dispatch controls disabled |
| stale/expired | request/resource ID และ recovery; disabled side effect |
| unknown outcome | Inspect/Reconcile; no automatic repeat |

## 8. Motion และ animation acceptance

### 8.1 Test IDs M01–M15

| Test ID | ขั้นตอนและ expected |
|---|---|
| UI-MOT-M01 | hover/focus/selected row ด้วย mouse/keyboard → focus ring immediate, color/opacity ≤100 ms, ไม่มี layout shift |
| UI-MOT-M02 | Agent↔IDE switch ขณะ idle → default state commit 0 ms; optional opacity ไม่บัง input; destination focus/content พร้อมตาม mode_switch_ms |
| UI-MOT-M03 | task A→B→A ขณะ stream → state commit ไม่รอ animation, scroll/draft restore ถูก และ interrupt แล้วไม่สร้าง session |
| UI-MOT-M04 | เปิด resource drawer → enter 180 ms, transform+opacity easing cubic-bezier(.2,0,0,1); focus ไป header/content |
| UI-MOT-M05 | ปิด drawer/Escape → exit 120 ms, focus กลับ trigger, reverse ที่ 50% แล้วไม่เกิด stuck layer |
| UI-MOT-M06 | เปิด desktop menu → enter 150/exit 100 ms, Escape/click-outside ปิดทันที; effect ไม่ผูก animation end |
| UI-MOT-M07 | เปิด mobile approval sheet → enter 180/exit 120 ms, safe-area ถูก, answer receipt ไม่รอ animation |
| UI-MOT-M08 | expand/collapse tool details ขณะ 100 deltas/s → reveal 150 ms, anchor คงเดิม, no token-by-token/stagger |
| UI-MOT-M09 | press Send/Queue → optional scale .96 ≤150 ms เฉพาะ non-repeat; Stop/destructive และ keyboard focus ไม่ scale |
| UI-MOT-M10 | contextual icon state swap → scale .25→1, opacity 0→1, blur 4→0, 300 ms easing; no bounce และ label เปลี่ยนก่อน |
| UI-MOT-M11 | drag splitter แล้ว reverse/switch task/close mid-flight → pointer follow, final width/focus ถูก, no process/timer leak |
| UI-MOT-M12 | เปิด Reduce Motion OS/app แล้วทำ M01–M11 → transition instant/opacity-only, no pulse/shimmer, essential state ยังประกาศ |
| UI-MOT-M13 | minimize/background 60 s → nonessential animation/timer pause/backoff; restore ไม่ replay burst หรือ scroll jump |
| UI-MOT-M14 | stream/recovery/theme switch → ไม่มี decorative transition, no full-window blur, transcript/log append ไม่ shimmer |
| UI-MOT-M15 | capture normal/reduced motion before/after พร้อม timeline → duration/easing/interrupt/focus fields ตรง design; screenshot กลางทางใช้เฉพาะ motion review |

Timeline ของทุก Mxx ต้องมี animationName, from/to, startMonoNs, endMonoNs,
interrupted, reducedMotion และ focusBefore/After. ตรวจไม่ใช้ transition: all,
staggered task rows หรือ animation ที่บัง terminal input; timing จาก screenshot
อย่างเดียวเป็น NOT-VERIFIED

## 9. Smoothness และ rendering stress acceptance

| Test ID | Workload/ขั้นตอน | Expected metrics |
|---|---|---|
| UI-PERF-001 | W02 พิมพ์/ลบขณะ F02 stream active | input p95 ≤50 ms, no dropped critical key paint, long-task policy ผ่าน |
| UI-PERF-002 | W05 F03 scroll up/down ระหว่าง append | frame policy §6.4, scroll anchor stable, DOM/memory bounded |
| UI-PERF-003 | W06 F05 terminal 100k lines + resize + input | terminal inputไม่ starve, resize p95 ≤100 ms, missed/severe frame budget ผ่าน |
| UI-PERF-004 | W07 open/close/drag panel + switch tabs | panel p95 ≤180/120 ms, pointer follows, main min width, no layout thrash |
| UI-PERF-005 | W12 3 tasks + queue 3,000 + stream 100/s | per-task isolation, batch p95 ≤P+1 ms, no unbounded RSS/CPU, no duplicate event |
| UI-PERF-006 | F06 browser slow/error + F07 preview while transcript streams | browser/preview isolation, stream input latency budget still passes |
| UI-PERF-007 | start/stop W12, close resources, wait 60 s | RSS guardrail returns, orphan process count zero, no stale timer/frame loop |
| UI-PERF-008 | W01 B0/B1/B2 foreground idle then minimize | CPU/RSS baseline §6.3 report median/p95/peak and delta |
| UI-PERF-009 | run W02/W04/W06 at 60 Hz physical display | p95 interval ≤17.67 ms, missed ≤1%, severe=0 in critical actions |
| UI-PERF-010 | same at 120 Hz physical display | p95 interval ≤9.33 ms, missed ≤2%, severe=0; absent hardware = not verified |
| UI-PERF-011 | W12 soak 30 min then memory sample | RSS slope ≤2 MiB/min after warm-up; report GC/renderer restarts |
| UI-PERF-012 | repeat W02 after cold start, warm start, reconnect | distributions separate; no pooling to hide regression |

## 10. Accessibility acceptance

| Test ID | ขั้นตอน | Expected |
|---|---|---|
| UI-A11Y-001 | keyboard-only traverse S01–S16, open/close menu/drawer/modal/splitter | visible focus, sidebar→header→transcript→composer→panel order, no trap except real modal |
| UI-A11Y-002 | VoiceOver/NVDA equivalent read task/status/tool/approval/error/offline | names/roles/states/value/relationship correct; live region summary ไม่ announceทุก token |
| UI-A11Y-003 | activate modal/panel then Escape/close/switch task | focus returns trigger/documented target, focus_restore_ms budget, no hidden target |
| UI-A11Y-004 | contrast audit light/dark/high-contrast with measured tool | normal text ≥4.5:1, large text/UI boundary ≥3:1; color/icon aloneไม่เป็นสถานะ |
| UI-A11Y-005 | browser zoom/text scale 200%, long Thai labels/path/code | no clipped primary action; code overflow scoped; alternate resource route remains |
| UI-A11Y-006 | inspect icon-only controls/SVG states | accessible name/tooltip, currentColor/16-20-24 grid, selected/disabled/error not color-only |
| UI-A11Y-007 | touch audit mobile/desktop | mobile target ≥44 pt; desktop ≥32 logical px; adjacent controlsไม่ activate together |
| UI-A11Y-008 | validation/error/timeout/connection loss | field association, announce once, draft retained, retry/inspect labeled |
| UI-A11Y-009 | reduced motion + keyboard/VoiceOver | no essential information only in motion; focus/announcement deterministic |

## 11. Thai IME และข้อความหลายภาษา

ใช้ OS Thai input source ที่ metadata ระบุ (เริ่ม Kedmanee หากมี) และบันทึก
keyboard layout; ห้ามใช้การ set DOM value อย่างเดียวเป็นหลักฐาน IME

| Test ID | ขั้นตอน deterministic | Expected |
|---|---|---|
| UI-IME-001 | F09 composer → พยัญชนะ/สระ/วรรณยุกต์ → commit สร้างปุ่มส่งงานใหม่ | ระหว่าง composition ห้าม submit/clear; หลัง compositionend text/caret ถูก, p95 ≤80 ms |
| UI-IME-002 | พิมพ์ candidate → เปลี่ยน candidate → Escape ยกเลิก composition → commit | candidate ไม่ทำ focus หลุด, Escape ไม่ปิด task/ไม่ Stop |
| UI-IME-003 | พิมพ์ แก้ไฟล์ app.tsx แล้วรัน npm test → Shift+Enter → const ค่า = 'ทดสอบ'; | mixed Thai/code คง encoding/whitespace, newline ถูก, Enter ไม่ส่งก่อน composition complete |
| UI-IME-004 | paste ข้อความไทยยาว/long path ที่ 100%/200% zoom → submit | no clip/overflow, chip/button/approval เห็น, UTF-8 payload hash ตรง |
| UI-IME-005 | iPhone Thai keyboard → type/hold delete/submit/approval | keyboard ไม่บัง composer/Send/approval, safe-area ถูก, draft ไม่หาย background |
| UI-IME-006 | สลับ Thai↔English ระหว่าง stream/task switch/reconnect | composition/session ไม่ข้าม task, reconnect ไม่ duplicate text, AX value ถูก |

บันทึก compositionstart/update/end, keydown, input, beforeinput, text hash
ก่อน/หลัง และ screenshot sanitized ของ candidate UI; ห้ามเก็บข้อความส่วนตัว

## 12. Mobile, network และ continuity

### 12.1 Network profiles

| Profile | เงื่อนไข proposed |
|---|---|
| local-good | RTT 20–50 ms, loss 0%, bandwidth ≥10 Mbps |
| cellular-good | RTT 80–150 ms, loss ≤1%, bandwidth 5–20 Mbps |
| cellular-poor | RTT 300 ms, loss 3%, jitter 100 ms |
| offline | ตัด route ทั้งหมด, DNS/relay unavailable |

### 12.2 Tests

| Test ID | ขั้นตอน | Expected |
|---|---|---|
| UI-MOB-001 | Mac F08 session → iPhone cellular pair → same task → benign fixture prompt | session/incarnation/commandId เดียวกัน, receipt/event ทั้งคู่, no second OMP owner |
| UI-MOB-002 | phone background/lock 2 min while stream → foreground | replay cursor/freshness ถูก, missing events กู้ครั้งเดียว, read position sensible |
| UI-MOB-003 | cellular-poor send → cut before/after ACK → restore | pending/unknown ชัด, no auto-repeat side effect, journal reconcile exact |
| UI-MOB-004 | attach image/file fixture และ answer approval บน phone | refs/hash/capability same Mac, scope/target/cwd เห็น |
| UI-MOB-005 | rotate, Dynamic Type largest, VoiceOver, Reduce Motion, Thai keyboard | safe-area/touch/focus/labels/motion/IME ผ่าน |
| UI-MOB-006 | host UI quit/restart ขณะ phone connected | phone แสดง unreachable/replay จริง, no session fork |
| UI-MOB-007 | revoke phone → attempt command → pair new phone | old denied, new explicit pairing, wrong identity ไม่เห็น draft/session |

Real iPhone + cellular เป็น gate เมื่อประกาศ mobile continuity; Simulator/localhost
เป็น preflight เท่านั้น. relay/provider/OS permission ใช้ไม่ได้ให้ BLOCKED-EXTERNAL
พร้อม owner/วิธีปลด ไม่อ้าง mobile ผ่าน

## 13. Recovery, state integrity และ side-effect safety

| Test ID | Fault injection | Expected |
|---|---|---|
| UI-REC-001 | cut transport before submit ACK | composer remains draft/pending, no sent, retry requires known-safe semantics |
| UI-REC-002 | ACK received then drop event stream | command not reissued, reconnect queries/reconciles owner journal, same commandId |
| UI-REC-003 | host process restart during streaming | last-known + replay progress, sequence gap detected, no duplicate card |
| UI-REC-004 | renderer/UI quit while host/terminal runs | execution continues by host contract, reopen hydrates state, no second owner |
| UI-REC-005 | approval expires/revokes while sheet open | sheet stale/disabled, answer rejected pre-effect, reason/recovery visible |
| UI-REC-006 | terminal/process exits, browser/server closes, build fails | terminal/expired/error state preserves logs/last-good artifact |
| UI-REC-007 | switch A/B during reconnect and pending queue | events/commands keyed to original session/task; no cross-task dispatch |
| UI-REC-008 | crash after fixture side effect but before ACK | known journal result wins; otherwise outcome_unknown + reconcile/readback, never auto-run |
| UI-REC-009 | restore old persisted schema twice and cancel migration once | migration idempotent/rollback or safe old state; no draft/credential loss |

ทุก recovery report ต้องมี beforeJournalHash, afterJournalHash, sequence range,
command IDs, process lifecycle และ whether any side effect was observed. “UI ดู
เหมือนเดิม” โดยไม่มี journal/reconcile receipt ไม่พอ

## 14. Privacy, security และ screenshot provenance

### 14.1 Security/privacy tests

| Test ID | ขั้นตอน | Expected |
|---|---|---|
| UI-SEC-001 | F11 sentinels ใน tool output/config/path/error/clipboard → export log | secret/token/path redacted ใน UI/AX/log/export/clipboard; allowed fixture hash ตรวจได้ |
| UI-SEC-002 | เปิด markdown/SVG/HTML/script/link payload ใน transcript/artifact | render เป็น untrusted, CSP/link allowlist ทำงาน, ไม่มี script/Node/file/host execution |
| UI-SEC-003 | F06 probes origin A/B, cookie/localStorage, Node bridge, file URL | browser session isolated ต่อ project/tab, no credential cross-origin, bridge denied |
| UI-SEC-004 | screenshot/AX/video receipt ขณะมี sentinel/personal-looking labels | sanitizer masks payload/URL/path, manifest hash ตรง sanitized artifact, no raw retained |
| UI-SEC-005 | needs-auth/unauthorized/expired device/unsupported paths | scope/target/provider state ชัด, no silent fallback, no token in accessible name/error |
| UI-SEC-006 | inspect temp cleanup/crash leftovers | only declared temp paths remain, no orphan credential/browser profile, cleanup receipt hashed |
| UI-SEC-007 | clipboard copy/download/open unknown MIME/external URL | user gesture/capability policy enforced, unknown file not executed, external navigation labeled |

### 14.2 Screenshot/AX capture policy

Capture เฉพาะ Caret/fixture surface ที่จำเป็นต่อ test และ reference screenshot ที่
ผู้มีสิทธิ์ให้ไว้; ห้ามจับ private chats, provider keys, personal browser tabs หรือ
หน้าจอนอก scope. ก่อน hash ให้ sanitizer แทน username, home path, repository remote,
token/key/cookie/query, real device ID, dynamic clock/run/process IDs และ transcript
ที่ไม่ใช่ fixture โดยรักษา geometry ด้วย mask สีคงที่

จับที่ before, after-ready, after-action, error/offline และ reduced-motion จุดที่ test
ระบุ; รอ presented frame + 2 stable frames ก่อน screenshot เพื่อไม่จับ animation
กลางทาง เว้นแต่ UI-MOT ที่จงใจเก็บ timeline

### 14.3 Artifact schema

ไฟล์ขั้นต่ำต่อ test:

    artifacts/<runId>/<testId>/
      run-manifest.json
      result.json
      timeline.jsonl
      screenshots/<checkpoint>.png
      accessibility/<checkpoint>.json
      metrics.json
      hashes.json

run-manifest.json ต้องมี field:

    {
      "schemaVersion": "caret-ui-validation.v1",
      "runId": "sanitized-run-id",
      "testId": "UI-S03-001",
      "status": "PASS|FAIL|...",
      "startedAtUtc": "...",
      "app": {"version": "...", "gitSha": "...", "dirty": false},
      "omp": {"revision": "...", "adapterRevision": "...", "ownerCount": 1},
      "fixture": {"id": "F09-thai-ime", "manifestSha256": "..."},
      "platform": {"os": "...", "device": "...", "cpu": "...", "ramMiB": 0},
      "display": {"refreshHz": 60, "logicalViewport": [0, 0, 0, 0], "scale": 2, "theme": "dark"},
      "accessibility": {"textScale": 1, "reduceMotion": false, "voiceOver": false},
      "network": {"profile": "local-good", "rttMs": 30, "lossPct": 0},
      "clock": {"source": "monotonic", "resolutionNs": 1},
      "sanitizer": {"version": "...", "rulesHash": "..."},
      "artifacts": [{"path": "...", "sha256": "...", "bytes": 0}]
    }

timeline.jsonl แต่ละบรรทัดมี monoNs, wallUtc, surface, event, sessionIdHash,
incarnationHash, commandIdHash, sequence, payloadHash, frameId และ redactionVersion;
ห้ามมี raw prompt/token/path

result.json ต้องมี testId, status, preconditions, steps[], expected[], observed[],
metrics[] (metric/start/end/unit/samples/p50/p95/p99/max/budget/budgetStatus),
failures[], environmentChanges[], sideEffectsObserved[], owner, reviewer และ nextAction

hashes.json ใช้ SHA-256 ของ canonical JSON (UTF-8, sorted keys, newline เดียว)
และ PNG/AX/timeline/metrics หลัง sanitizer; hash ก่อน sanitizer เก็บไม่ได้ใน
repository ถ้ามี secret

## 15. Release gates และ not-pass classification

### 15.1 Gates

| Gate | เงื่อนไข |
|---|---|
| G-UI-0 provenance | metadata/build/OMP/fixture/source hash ครบ, sanitizer/schema ผ่าน |
| G-UI-1 S01–S16 | test IDs required ของทุก surface ผ่านทุก state ที่ applicable; no hidden open gap |
| G-UI-2 performance | §6 latency/long-task/CPU/RSS/frame budgets ผ่านทุก required hardware row |
| G-UI-3 motion/a11y/IME | UI-MOT-M01…M15, A11Y และ IME required ผ่าน normal/reduced/200%/Thai paths |
| G-UI-4 mobile/recovery | UI-MOB/UI-REC ผ่าน physical device/network rows ที่ประกาศ |
| G-UI-5 privacy/security | UI-SEC ทุก required path ผ่าน และ no P0/P1 leak/duplicate side effect |
| G-UI-6 review | artifact links, reviewer sign-off, open deviations/expiry/owner ครบ |

Release result เป็น **PASS** ต่อ platform/feature set ได้เมื่อ gates ที่ประกาศ
ทั้งหมดผ่าน และไม่มี FAIL, INCONCLUSIVE, NOT-VERIFIED หรือ unresolved
BLOCKED-EXTERNAL ใน required IDs. คำว่า “full OMP core/UI support” ใช้ได้
เฉพาะเมื่อ OMP coverage matrix ของ pinned revision ผ่านแยกต่างหาก; validation
document นี้ไม่ certify future OMP features

### 15.2 Classification

| Status | ใช้เมื่อ | ผลต่อ release |
|---|---|---|
| PASS | expected/metric/artifact ครบและอยู่ใน budget | นับผ่านเฉพาะ row/test ที่ระบุ |
| FAIL-CORRECTNESS | state/identity/side effect/data loss ผิด | block release; owner ต้องแก้ |
| FAIL-PERF | budget/frame/CPU/RSS/long task เกินซ้ำตาม protocol | block performance claim; triage regression |
| FAIL-A11Y | focus/name/contrast/IME/touch/VoiceOver ผิด | block affected platform/surface |
| FAIL-PRIVACY | secret leak, unsafe bridge, duplicate destructive effect | P0/P1 block ทุก release ที่เกี่ยวข้อง |
| BLOCKED-EXTERNAL | physical device, OS permission, unavailable provider/relay หรือ reference access ขาด | ไม่ใช่ pass; release ต้องไม่ claim capability หรือมี explicit waiver |
| NOT-VERIFIED | instrumentation/hardware/artifact ไม่ครบ หรือยังเป็น proposed | ไม่ใช่ pass; feature/pixel/perf claim ห้ามใช้ |
| INCONCLUSIVE | contamination/crash/metadata mismatch หรือ timing invalid | rerun; ถ้ายังซ้ำ escalate |
| N/A-JUSTIFIED | feature ไม่มีใน declared capability และมีเหตุผล/alternate path/owner | ต้องอนุมัติ scope; ไม่เพิ่มเป็น supported |

Severity เพิ่มเติม:

- **P0:** credential/data disclosure, arbitrary code/bridge, duplicate destructive
  side effect หรือ corruption ที่กู้ไม่ได้ — ห้าม release
- **P1:** session mix-up, lost draft/buffer, wrong approval, crash loop, a11y
  blocker, required mobile/recovery failure — ห้าม claim affected gate
- **P2:** regression ของ budget, focus/visual state, noncritical resource error —
  release ได้เฉพาะมี owner/target build และไม่ขัด gate
- **P3:** copy/icon/polish deviation ที่ไม่กระทบ semantics — บันทึก backlog

### 15.3 Waiver ที่ยอมรับได้

Waiver ต้องระบุ test IDs, reason/evidence, affected platform, user impact,
mitigation/alternate entry, owner, expiry build/date และผู้อนุมัติ. Waiver ห้าม
เปลี่ยน BLOCKED-EXTERNAL หรือ NOT-VERIFIED เป็น PASS; เปลี่ยนได้เพียง release
decision เป็น conditional และต้องพูดตรง ๆ ว่ายังไม่ verified

## 16. Report template และ completion checklist

สรุปต่อ run ต้องมี:

1. build/source/OMP/fixture/platform/display/network metadata และ hashes
2. test count: pass/fail/blocked/not-verified/inconclusive/N-A
3. ตาราง p50/p95/p99/max เทียบ proposed budget พร้อม raw sample count
4. CPU/RSS baseline B0/B1/B2, foreground/background, stress slope และ frame
   total/missed/severe ต่อ 60/120 Hz
5. screenshot/AX/timeline/artifact links ต่อ checkpoint; reference provenance แยก
6. side effects, cleanup, unknown outcomes และ recovery reconciliation
7. open gaps mapped ไป Sxx/PE/Pxx/OMP feature พร้อม owner/next build

ก่อนปิดงาน validation reviewer ต้องติ๊ก:

- [ ] ไม่มี provider/cloud/paid action และ OMP owner/session identity เดียว
- [ ] S01–S16 มี deterministic IDs และ state rows ครบ
- [ ] normal/reduced motion, keyboard, VoiceOver, Thai IME, 200% zoom ผ่านหรือถูกจัดประเภท
- [ ] Mac 60 Hz ผ่าน; 120 Hz และ physical iPhone ถูกตรวจหรือระบุ not-verified
- [ ] W12 stress, idle foreground/background CPU/RSS, leak soak และ recovery มี raw receipt
- [ ] screenshot/AX/timeline ถูก sanitize และ hash ตาม schema
- [ ] ไม่มี P0/P1 หรือ hidden unsupported capability
- [ ] report แยก implemented / verified / blocked / proposed อย่างชัดเจน

เอกสารนี้ทำให้ทีมสามารถเริ่มทำ fixture runner และ UI prototype ตามสเปกได้โดยไม่
ตีความ motion/performance/feature coverage ต่างกัน แต่ไม่อ้างว่าการมี checklist
หรือ static prototype เท่ากับ Caret ผ่านการตรวจรับจริง
