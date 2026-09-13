# Caret — การดำเนินงาน G1–G5

คำสั่งล่าสุด: ทำให้เสร็จตามแผนทั้งหมด ไม่หยุดหลังจบ slice ย่อย เอกสารนี้เป็น working ledger ไม่ใช่ใบรับรอง release

## โค้ดที่กำลังประกอบ

- `packages/omp-adapter`: pinned 42 RPC commands, framing, UI broker, host dispatch; เพิ่ม wire request correlation และ authoritative pending UI snapshots
- `packages/protocol`: app/session/command/event contracts แยกจาก OMP wire
- `apps/host`: SQLite durable journal + process ownership, OMP runtime/session ownership extension, loopback HTTP router, detached CLI, device revoke, worktree snapshots และ immutable artifacts
- `apps/macos`: tracked extension source ที่ bundle ลง Code-OSS checkout; task surface และ native editor bridge ใช้ host เดียว
- `packages/relay`: Paseo v2 transport/E2EE, Caret app protocol v1, endpoint key pinning; revoke ตรวจซ้ำก่อนคืน cached reply
- `apps/ios`: Expo 54 iPhone client, secure credentials, cached timeline/reconnect
- `scripts/build-caret.ts --desktop`: build host/extension และ overlay ลง ignored Code-OSS checkout; ยังไม่ใช่ signed installer

## หลักฐานระหว่าง implementation

- adapter + initial store suite: 54 tests / 212 assertions ผ่าน
- host expanded tests ก่อน integration corrections: 21 tests / 136 assertions ผ่าน
- real OMP 18.1.18 + Node 24: host start/create/start/close session ผ่าน ไม่เรียก model
- Mac Code-OSS dev window เปิดจริง; พบและแก้ webview รับ message ผิด target (`document` แทน `window`); UI แสดง Ready จาก host จริงหลัง reload
- Independent review พบ transcript shape ไม่ตรง nested OMP events, interaction draft ถูก polling ล้าง, native actions ผิด workspace, stale host descriptor และ lifecycle races; กำลังแก้และต้องตรวจซ้ำ
- relay synthetic suite initial: 6 tests / 22 assertions; ยังไม่ใช่ hosted/cellular acceptance
- mobile package typecheck และ Expo web export initial ผ่าน; ยังไม่ใช่ iOS native build

## Gate ที่ยังเปิด

1. Full OMP conformance: effective tools/config/skills/MCP/subagents, trusted native approval/editor guard, PTY/custom TUI bridge และ per-feature runtime receipts
2. Host integration: start/stop/crash overlap, unknown outcomes, migration, real OMP lock startup ordering, artifact ranges/integrity และ remote revoke
3. Mac: nested real OMP transcript/recovery/interactive inputs, native project binding, dirty-buffer integration, UI walkthrough E1/E3
4. Remote/iPhone: hosted synthetic interop, actual pairing/QR, cellular/background/Wi-Fi/restart/revoke, native build/signing
5. Release: E1–E4 target receipts, Aetheria/limiter/DAW acceptance, installer/update/migration/a11y

เครื่องมี CommandLineTools แต่ไม่มี Xcode/iOS SDK/device tools จึงยัง build/ตรวจบน iPhone จริงไม่ได้ ได้ถามผู้ใช้เรื่องเตรียม Xcode/iPhone และ path limiter/DAW แล้ว ระหว่างรอยังคงทำงานที่ไม่ขึ้นกับข้อมูลนั้น

Computer Use ปฏิเสธการเข้าถึงแอป Codex (`com.openai.codex`) จึงใช้ official public UI references และตรวจ Caret ที่ build เอง ไม่หลบข้อจำกัดผ่านเครื่องมืออื่น และไม่อ้าง pixel parity

ไม่ซื้อ infra/model services, ไม่ deploy, ไม่ commit/push และไม่แก้โปรเจกต์ Aetheria/Cedia/limiter โดยพลการ

## Integration update — 13 กันยายน 2026

- Mobile initial full client: 21 tests / 56 assertions, typecheck และ web export 260 modules ผ่าน; กำลังเพิ่ม bundled ANSI terminal viewer สำหรับ OMP custom UI
- Mac: 18 tests / 70 assertions และ typecheck ผ่าน เปิด dev app จริงหลัง reload พบ Ready, สร้าง local task ใน `/tmp/caret-ui-acceptance` สำเร็จ และโหลด model picker ได้โดยไม่ส่ง model turn
- ปิด sidebar ซ้ำ/secondary pane ว่างใน task window; แก้ product copy และซ่อน protocol housekeeping จาก timeline (raw frames ยังเก็บ)
- Host response chunks: ทดสอบ Unicode + hash, device isolation, invalid ranges/expiry; editor cancellation/deadline หลัง delivery ผ่าน
- Relay review แก้ close/reconnect attempt, จำกัด connection + handshake deadline + global handler budget ที่คงอยู่จน underlying handler settle แม้ disconnect; เพิ่ม tests เฉพาะ regression
- Editor registrations เก่าที่ไม่มี pending work ถูก reclaim จึงไม่ติดเพดานหลัง reload 100 ครั้ง
- Hosted synthetic smoke ล่าสุด 2026-09-12T17:07:26Z ผ่าน encryptedRoundtrip, sameIdEffects=1, revokedCachedReplyStatus=401; ไม่ใช่ iPhone/cellular acceptance
- OMP virtual TUI source patch อยู่ระหว่างแก้ startup extension negotiation ordering; ยังไม่เปิดใช้ใน default daemon และยังไม่รับรอง all-core conformance

ผลก่อนหน้านี้เป็น receipts ระหว่างทาง ไม่แทน final integrated verification หรือ native release acceptance

## Integration update — รอบถัดมา 13 กันยายน

- ชุดรวม adapter/host/relay/Mac ผ่าน 126 tests / 550 assertions; mobile ผ่าน 37 tests / 106 assertions; root/Mac/mobile typechecks และ control-repo validator ผ่าน
- Mobile ปรับ Expo เป็น 54.0.37 และ SecureStore ให้ตรง SDK; dependency check ผ่าน, web export 397 modules ผ่าน, สร้าง `packages/mobile/ios/Caret.xcodeproj` ด้วย prebuild สำเร็จ ยังไม่มี native build/device receipt
- Mobile/Mac artifact viewer ตรวจ task/hash/range/size ก่อนแสดงหรือส่งออก; เพิ่ม regression สำหรับ receipt เปลี่ยนขนาดระหว่าง transfer
- Mac ตรวจจริงพบสถานะ Offline เมื่อยังไม่เลือก task ทั้งที่ host พร้อม; แก้แล้วและตรวจ actual UI หลัง reload แสดง Ready
- Mac เพิ่ม Show interaction terminal สำหรับเปิดหน้าจอ OMP กลับมา; bounded history มีข้อความบอกเมื่อหมดอายุ และคงผลที่จบแล้วไว้อ่านได้ ป้องกัน callback จากหน้าต่างเก่ากระทบหน้าต่างใหม่
- Native permission ผ่าน real OMP + CaretHost + local scripted model: allow/reject ก่อน bash effect, journal exact args, stale answers ปฏิเสธ รวม 6 checks; source attestation กำลังเพิ่มและต้อง rerun หลัง export patch ล่าสุด
- Source patch กำลังรวม TUI-only slash commands ผ่าน InteractiveMode/Composer เดียวกัน โดย RPC ยังคงเป็นเจ้าของ extension lifecycle; ยังไม่รับรอง O14–O16 จน runtime tests ผ่าน
- เพิ่ม source-tree attestation เทียบ Git tree จริงกับ pinned HEAD + patch โดยใช้ temporary index ไม่แตะ index ของผู้ใช้;ตรวจเพิ่มนอก patch แล้วปฏิเสธได้
- เตรียม Rust nightly-2026-08-08 แยกใน `/Users/pond/.caret-tools/{cargo,rustup}` โดยไม่แก้ shell PATH เพื่อทำ native edit overlay ของ OMP; ไม่ใช่เปลี่ยน UI ไป Rust/GPUI
- Mobile audit เหลือ 8 high dependency-chain reports จาก image-size ผ่าน Metro; PostCSS/UUID แก้ด้วย compatible pinned overrides แล้ว หลักฐานอยู่ `evidence/mobile-build-2026-09-13/receipt.json`; image parser issue ยังเป็น release gate

ยังเปิด: native dirty-buffer parity, complete per-feature OMP conformance, actual iPhone/cellular/background/revoke, E1–E4/limiter DAW receipts และ signed installer/update acceptance. ไม่สรุปว่า G1–G5 เสร็จจากจำนวน tests เพียงอย่างเดียว

## Native editor / packaging integration — รอบต่อเนื่อง

- เพิ่ม native Rust edit overlay ใน OMP เดิม: ใช้ unsaved text ก่อน disk, คง BOM/EOL/notebook normalization, ส่ง editor handle/version/hash ให้ writer และปฏิเสธ delete/move ที่แตะ overlay ก่อนเริ่มเขียนทั้ง batch
- Rust `pi-edit` unit/integration ทุกกลุ่มผ่าน และ `pi-natives` build ผ่าน; addon ภายใน checkout มี `setFileOverlay`/`clearFileOverlays` จริง ยังไม่เปลี่ยน global OMP binary/native cache
- Source RPC/TUI suite 35 tests / 123 assertions ผ่าน: terminal input/resize ไม่ติดคิวหลัง selector ที่รอ input, shutdown ทน extension disposer error, inline loop ส่ง error กลับด้วย request ID เดิม
- Host/editor/runtime integrity ชุดใหม่ 9 tests / 30 assertions ผ่าน: native buffer/hash/version, symlink alias/retarget, owner disconnect, read cancellation, invalid snapshot, Cargo artifact จาก redirected build directory; Mac editor open-error regression ผ่าน (Mac editor suite 5/20)
- ชุดรวมก่อน review fixes รอบล่าสุดผ่าน 132 tests / 572 assertions; ต้องรันใหม่หลังรวมทั้งหมด
- Astra review พบและ root แก้ host lexical/canonical identity, native artifact selection และ Mac open errors ที่ถูกตีความเป็น missing file. อีก worker กำลังแก้ whole-file write stale read (P1), read suffix-recovery, generated-file guard และ missing-file symlink canonicalization; ยังไม่เปิด editor bridge เป็นค่าเริ่มต้นจนตรวจครบ
- `scripts/omp-native-editor-smoke.ts` เตรียม real OMP read/edit + local scripted model + simulated editor transport แล้ว แต่ยังไม่มี passing receipt; ไม่ใช่ native Code-OSS undo acceptance
- `prepare-omp-runtime.ts` ตรวจ source tree เต็มกับ pin+patch ก่อน/หลัง build, rebuild patched addon, รองรับ `--standalone` (ยังรอ build verification). Compiled Caret native cache แยกจาก stock OMP; source cache-isolation test 1/3 ผ่าน
- `build-caret.ts --portable` เตรียม bundle Node 24/host/standalone OMP/licenses ไว้ใน extension และ resolve runtime จาก extension path; ยังไม่ผ่าน relocated bundle acceptance
- Code-OSS `vscode-darwin-arm64-min` packaging กำลัง build ที่ `/tmp/caret-mac-package.log`; ไม่ใช่ signed/notarized release
- Delegation เพิ่ม/เรียก agent กลับมาสำหรับ packaging และ ast_edit ติด agent-thread limit; root รับตรวจต่อและแจ้งผู้ใช้แล้ว
- `ast_edit` ยังใช้ native filesystem preview แล้ว `resolve` rerun/apply โดยตรง จึงยังไม่ครบ dirty-buffer parity; ต้องเชื่อม native AST source overrides/guarded apply เพิ่ม ไม่ให้นับ O01 เสร็จ

External gates เดิมยังเปิด: Xcode/iPhone/cellular, signing, limiter path/DAW และ E1–E4. รักษาคำสั่งทำต่อทั้งแผน ไม่จบหลัง slice นี้

## Standalone / first launch — รอบต่อเนื่อง 13 กันยายน

- Standalone OMP build และ relocation ผ่าน: `dist/omp-standalone/omp` (~145 MiB), ไม่อ้าง source checkout ขณะรัน; bundle Node 24 + host + OMP + notices ใน Mac extension. Portable smoke ย้าย runtime ไป path ที่มีช่องว่างและใช้ PATH เฉพาะระบบ ผ่าน 5 checks โดยไม่เรียก model
- OMP profile ใหม่ที่ยังไม่มี model เปิด RPC virtual UI และ `/login` provider selector ได้; ยกเว้นเฉพาะ Caret RPC-UI ที่ negotiate virtual UI ไม่เปลี่ยน stock CLI/RPC. Virtual UI smoke ล่าสุดผ่าน 14 checks รวม cancel selector และยืนยันไม่มี agent turn
- Real OMP/native editor smoke ผ่าน 6 checks: อ่าน unsaved text, native overlay edit, single guarded apply, permission-before-effect และ disk unchanged. ตัว editor transport ยังจำลอง จึงไม่ใช่ Code-OSS Undo receipt
- Real native permission smoke ผ่าน 6 checks, ใช้ loopback scripted model เท่านั้น; global OMP binary และ native cache เดิมไม่ถูกแทนที่
- Patch OMP ล่าสุด SHA `cd5b60abde5f59d2d270ff06cad71b721ed778dac0b82e4372d45ff84a701dcd`, source tree `4922eb19332d79edff624b89787b19a174817085`, standalone SHA `2e7ff2589934422aaea1bc13825826432aa55042718f5833cd2f1c02765382d5`; receipts ใน evidence/omp-{native-editor,native-permission,virtual-ui}-2026-09-13 และ evidence/portable-runtime-2026-09-13
- Full Mac app package สร้างได้และ ad-hoc signature verify ผ่าน; actual UI พบ Restricted Mode ปิด Caret และแสดง upstream onboarding. แก้ capability limited พร้อม static restricted shell ที่ไม่สร้าง host/editor/terminal; trust-only command tests ผ่าน 1/7. เพิ่ม tracked Code-OSS startup-default patch (patches/desktop) เพื่อกำหนดก่อน extension activation; กำลัง rebuild/ตรวจ first launch
- แก้แพ็ก tree-sitter WASM ที่อยู่ใน ASAR unpacked แต่ runtime อ่าน real node_modules path; ใช้ไฟล์ที่ packager คัดมาแล้ว. เพิ่ม host package.json type module เพื่อไม่ reparsing runtime
- ชุดรวมล่าสุด 137 tests / 590 assertions ผ่าน; real OMP two-process startup test เดิมชน default timeout 5 วินาที รันแยกผ่าน ~7 วินาที จึงกำหนด 30 วินาทีเฉพาะ integration นี้. Root/Mac typecheck และ CI-OK ผ่าน
- Computer Use อ่าน Caret แพ็กแรกและหน้า Ready หลัง trust ได้; หลัง restart/re-sign หน้าใหม่ tool timeout แม้ลอง reset/reconnect จึงยังไม่มี visual acceptance สำหรับแก้ first-launch รอบล่าสุด และยังไม่มี actual native Undo receipt
- Mobile image-size backport มี bounded ICNS/JXL checks + valid image regression ผ่าน, mobile 39/110/typecheck/web export ผ่าน; npm audit ยังรายงาน 8 high ตาม version chain ไม่อ้างเป็น upstream fixed release หรือ clean audit

Gate ยังเปิด: ast_edit และ native create/delete/move/untitled parity, full OMP per-feature conformance, actual Mac editor/Undo/UI/a11y/performance, actual iPhone/cellular/background/revoke, signed installer/update/migration และ target/limiter DAW acceptance. รอ Xcode/iPhone/path limiter จากผู้ใช้ แต่ยังเดินงานที่ไม่ขึ้นกับเครื่องมือเหล่านั้นต่อ

### สาเหตุ native UI ค้างที่ยืนยันเพิ่มเติม

`sample` ของ process ทดสอบ Mac (`/tmp/caret-unresponsive-main.sample.txt`) พบ main thread รอ `SecItemCopyMatching` / Keychain decrypt; แอปที่เปิดซ้ำแจ้งว่า instance เดิมไม่ตอบสนอง. จึงไม่ใช่เพียง CUA timeout. Computer Use ปฏิเสธ `com.apple.SecurityAgent` ด้วยเหตุผลด้านความปลอดภัย ได้ขอให้ผู้ใช้จัดการ prompt macOS ด้วยตนเองแล้ว ไม่กดแทน ไม่ใช้ plaintext/mock keychain และไม่หลบผ่านเครื่องมืออื่น. UI/Undo acceptance รอ gate นี้; AST/native tests ยังดำเนินต่อได้

## AST / guarded headless writes — รอบตรวจรวมล่าสุด

- Native Rust AST เพิ่ม dry-run source capture/overrides: ค้นพบ match ที่มีเฉพาะ unsaved buffer และเก็บผล preview ที่จะใช้จริง; จำกัด candidate/bytes และ bounded file reads. ยังคง stock behavior เมื่อไม่เปิด Caret bridge
- AST apply ตรวจชุดไฟล์และฐาน editor/disk ก่อน effect, ป้องกัน resolve ซ้ำ/พร้อมกัน และส่ง headless write ให้ host ตรวจ expected bytes/canonical target ผ่าน descriptor เดียว. ข้อจำกัด: เป็น optimistic guard ไม่ใช่ OS atomic CAS ต่อ process อื่น
- Astra review พบและแก้ nested editor workspace bypass โดยกัน workspace ซ้อนทั้งสองทิศทาง แม้ registration หมดอายุ/ถูก prune; แก้ macOS /var vs /private/var โดยใช้ canonical editor requests แต่เก็บ lexical disk alias ให้ host ตรวจซ้ำตรงจุดเขียน. Regression retarget ระหว่าง final asynchronous preflight ผ่าน; final bounded review ไม่มี material findings
- Root รวมล่าสุด 147 tests / 627 assertions ผ่าน; OMP AST/editor ชุดเฉพาะ 42 tests / 147 assertions ผ่าน; host disk 9/35 ผ่าน; root และ OMP typechecks, control-repo validator ผ่าน
- Real standalone OMP + scripted local model ผ่าน native AST 6 checks, native edit 6 checks, native permissions 6 checks; editor transport ยังจำลอง ไม่ใช่ actual Code-OSS Undo. Portable runtime relocation ผ่าน 5 checks ไม่ใช้ model
- Runtime ล่าสุด: patch SHA `0fcaad4b156498a40d8800429ecc84f27fd576e4dfc8f6560150ffcf60a62c8d`, source tree `8b5cd5168d73b430cd82f38903fb891d3b115ead`, standalone SHA `b10b9f1477f531649d0d91185e1344cda6caf6a177c3335e9cd6b0f7fda8ebef`; native addon SHA `202ca523958050c214aa9de8c25391b313f1699aacc075f26b9dde8a965041bb`. Portable host SHA `412a44a8a067ba5d9d12a8f47500ba31a1f229e54908bb7d84d628cd8da63f1f`
- Virtual UI smoke รอบรวม timeout รอ raw process exit; rerun แยกบน build เดียวกันผ่าน 14 checks รวม EOF/queued prompt shutdown. บันทึก timeout ไว้เป็นข้อจำกัดการรันชุดหนักพร้อมกัน ไม่เพิ่ม timeout เพื่อกลบ failure. Mac app ที่ค้าง Keychain ยังไม่ถูก re-sign/แทนที่; portable/dist อัปเดตแล้ว
- งานถัดไปตรวจ terminal checkpoint เพื่อแก้ ANSI replay หลัง trim; external UI/iPhone/signing/target acceptance gates และ full OMP conformance ยังเปิดตามเดิม

### เพิ่ม headless AST permission integration

เพิ่ม real OMP fixture แบบไม่มี editor registration พบว่า dispatcher เดิม gate เฉพาะ `apply` ทำให้ `apply_disk` ใหม่ไม่ผ่าน approval. แก้ `service.ts` ให้ครอบคลุมทั้งสอง operation แล้ว: allow fixture ผ่าน 6 checks (ตรวจ disk ก่อนตอบ approval และผลหลังเขียน), reject fixture ผ่าน 5 checks (disk unchanged, discard pending preview ผ่าน `write xd://reject`, read-after-rejection). ทั้งสองใช้ scripted loopback model เท่านั้น. Root suite หลังแก้ยัง 147/627 ผ่าน และ typecheck ผ่าน; portable host ต้องใช้ receipt รอบถัดจากการแก้นี้

Portable host หลังเพิ่ม `apply_disk` approval ผ่าน relocation smoke 5 checks ใหม่เมื่อ `2026-09-12T20:25:15Z`, host SHA `cf0fbbb622fe84d94929a0edea1af728523d7695253cd300c77b0737e3b17565` (OMP SHA เดิม). ใช้ receipt ล่าสุดใน `evidence/portable-runtime-2026-09-13/receipt.json` แทน host SHA ก่อนแก้ approval

Native create/delete/move/untitled ผ่าน editor WorkspaceEdit แล้ว แล้วตาม review: overlay บน delete/move, apply staged text ก่อน rename, live-request ก่อน create/delete/move, untitled close-without-save, identity exact path, และกู้ `untitled:` หลัง Rust join cwd. Tests: host+Mac editor 21, routing 20. Runtime ที่ attest แล้วหลัง rebuild ค้างทับ: patch SHA `706fced20cdfdcd6b6cced6301f967a79d4ff5d58e80b261c9610b076d04b1a3`, source tree `4d2c56d478ba1c636b84877febd943dd5e0ad0e8`, standalone SHA `8309b0facd880fcf6b04413c2f5acdf2ea47faa9eb77c07d0cb2f9a231fcf5fd`, native addon SHA `08f5c471347c4ee1c2fabaee2c0369e77ea0b9fe1fccbc3cc2320ca4638a02dc`. CLI editor bridge ยัง default OFF. ยังไม่มี Code-OSS Undo receipt. G1 จาก slice นี้ยังไม่ complete (WriteTool null-snapshot disk-create เมื่อไม่มี create, untitled move reject, Undo receipt)

### Mobile OMP login + host 42-command name gate — 13 กันยายน

ต่อ G2 login บน iPhone client โดยไม่เรียก OAuth จริง: `get_login_providers` / `login` ผ่าน host เดิม, แสดง provider ใน sheet, เก็บ `open_url` เป็น presentation, เปิดแค่ http(s) เมื่อผู้ใช้กด. `javascript:` ถูก Drop URL. Host router ตรวจชื่อ RPC ทั้ง 42 ว่าไม่ถูกปฏิเสธเป็น `invalid_command` เมื่อ session ยังไม่ start (ได้ `not_dispatched` หรือ error อื่น). Mobile 45 tests / 152 assertions และ typecheck ผ่าน. ยังไม่ใช่ login สำเร็จบนอุปกรณ์จริง และยังไม่ปิด O11 รายคำสั่ง (ACK/ผล/mode)

## Terminal query / browser fixture — session 13 กันยายน ต่อจาก handoff 03:38

ทำ next actions ข้อ 1–2 ของ handoff โดยไม่ reset/clean งาน dirty:

- `isParserQuery` แหล่งเดียวใน `packages/protocol/src/terminal-queries.js` (embed ด้วย `Function#toString`); ครอบ OSC 10/11/12 แบบ `?;?` และ OSC 4 palette `n;?`
- Mac ไม่กรอง CSI-R แล้ว จึงส่ง modified F3 (`CSI 1;2R`); ตัด query ออกจาก bytes ที่เขียนเข้า VS Code PTY
- ชุด terminal 17 tests ผ่าน; mobile 43/147, typecheck, web export 396 modules ผ่าน; image-size backport ยัง verify ได้ ไม่ใช่ clean npm audit
- Browser fixture จริงบน desktop Chromium: replay/live เห็นข้อความ, status queries ไม่สร้าง `input`; หลักฐาน `evidence/mobile-terminal-browser-2026-09-13` — ไม่ใช่ iPhone และไม่ใช่ checkpoint restoration
- `apply_disk` ยังอยู่ใน approval gate ของ host; native create/delete/move/untitled กำลังทำต่อแยกไฟล์ editor

## ส่งต่อ session ใหม่ — 13 กันยายน 03:38

ผู้ใช้ขอ handoff. อ่าน `CARET-HANDOFF-2026-09-13.th.md` สำหรับ exact next actions. Mobile terminal recovery slice รวมแล้ว: root ตรวจ 43 tests / 139 assertions และ typecheck ผ่าน; receipt อยู่ `evidence/mobile-terminal-recovery-2026-09-13`. ยังต้อง Astra review, แก้ OSC combined/palette query gaps, actual browser verification และ web export ใหม่. Browser fixture script สร้างแล้วแต่ยังไม่เปิดตรวจ; server ปิดแล้ว. Subagents จบและ interrupt แล้ว. ไม่อ้าง G1–G5 เสร็จ

## Plan update — workspace workflow 13 กันยายน

ผู้ใช้ให้เพิ่มทิศทาง Amp/Conductor เข้าแผน. ต้นทางอยู่ `CARET-WORKSPACE-WORKFLOW-2026-09-13.th.md` และผูก PE-10–PE-13 ใน implementation direction, acceptance, UI spec, handoff และ AGENTS.md. สูตรที่ล็อก: โต๊ะงานบน Mac แบบ Conductor + ความต่อเนื่อง/หลักฐานแบบ Amp + OMP คนเดียว. รอบนี้เปลี่ยนเฉพาะเอกสาร ไม่มีโค้ด/dependency/Orb/harness ใหม่ และไม่เลื่อน G1–G5
