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

### WriteTool refuse disk-create + untitled move reject — 13 กันยายน

ปิดสองช่อง G1 ที่เหลือด้านโค้ด (ยังไม่ใช่ Undo receipt):

- Snapshot ของ host ส่ง `editorWorkspace` เมื่อมี connection หรือเคย register workspace
- WriteTool ปฏิเสธการสร้างไฟล์บนดิสก์ถ้า editor workspace ลงทะเบียนแล้วแต่ native `create` ไม่มี — path หัว decap ที่ไม่มี editor ยังเขียนดิสก์ได้ตามเดิม
- Host ตัด untitled move ก่อนส่งคำขอไป editor; Mac ยัง fail closed ที่ `unsupported_document`; EditTool ไม่ fallback ดิสก์ให้ path `untitled:`
- ตรวจแล้ว: host+Mac editor 23 tests / 95 assertions; OMP routing+bridge 31 tests / 79 assertions
- Patch ที่ export ใหม่ SHA `545266a3f45bdbd2c27450e519d6c8ada88631dde745039985bbc3a94264f533`, source tree `14dd6fff87d27d8eaadba9727fdf5f85041fece2`. **standalone/portable runtime ยังเป็นชุดเก่า** จนกว่าจะ `prepare-omp-runtime --standalone` ใหม่. CLI editor bridge ยัง default OFF. Undo ของ Code-OSS ยังรอ Keychain/personal launch

### O11 command outcome fixture + typecheck — 13 กันยายน

- แก้ `rpc-inventory.test.ts` ให้เทียบ tuple ผ่าน spread `string[]` — `bun run typecheck` ผ่าน
- Host fixture ส่งคำสั่ง RPC ทั้ง 42 ชื่อเข้า session จริง (fake OMP): offline = `not_dispatched`; `prompt` = ACK แล้วรอ completed; `abort_and_prompt` = `acknowledged`; คำสั่งอื่น = `completed` จาก ACK ไม่ใช่ turn
- ยังไม่ใช่ผล semantics ต่อคำสั่งบน OMP จริง (mode/model/login/OAuth)
- Standalone เตรียมใหม่แล้ว: executable SHA `fe76b727c6281ef8355be202ba57ed580cb0985ddacbc6cfcb5918b0d9de0d4b`, source tree `14dd6fff87d27d8eaadba9727fdf5f85041fece2`, patch SHA `545266a3…`. Native addon SHA ยัง `08f5c471…` เพราะรอบนี้ไม่แตะ Rust. Portable host/app ยังไม่ได้ rebuild

### Portable rebuild + real O11 command smoke — 13 กันยายน

- `scripts/omp-o11-command-smoke.ts` ยิง standalone OMP ผ่าน Caret host: query 9 คำสั่ง completed, คำสั่งที่ไม่ใช่ turn ถึง OMP (branch / get_subagent_messages failed ตามข้อมูลที่ไม่มี), ข้าม prompt/steer/follow_up/abort_and_prompt/handoff/compact/login เพื่อไม่เรียกโมเดล/OAuth. Receipt `evidence/omp-o11-2026-09-13`, paidModelCalls=0, OMP SHA `fe76b727…`
- Host ตั้ง `XDG_STATE_HOME` ใต้ state dir ถ้ายังไม่มี เพื่อไม่ให้ daemon ของ OMP ไปเขียน `~/.omp/run/daemons` โดยไม่ตั้งใจ
- Portable smoke ใช้ HOME/XDG ใต้ fixture; rebuild `--portable` แล้ว relocation 5 checks ผ่าน. Host SHA `7143874816d204b9705c9829c6cf8df660f0824394f0bba30dacb6acdeef3e36`. ยังไม่ package แอป Mac / Undo / O11 รายคำสั่งบน turn จริง

### PE-11 workspace bootstrap + O11 inventory lock — 13 กันยายน

งาน G2 ที่ไม่รอ Xcode: worktree คัดลอกเฉพาะไฟล์ gitignored ที่อยู่ใน `.caret/workspace.json` allowlist, ไม่คัดลอก `.env` ตามค่าเริ่ม, จัดพอร์ตต่องานแบบเว้นช่วงและกันชนกับ sibling snapshot, เก็บ setup/run ไว้ใน manifest. Host สร้าง worktree อ่าน bootstrap จากโปรเจกต์. O11 ล็อก `RPC_COMMAND_TYPES` ให้เท่า pinned inventory 42 ชื่อ — ยังไม่ใช่ fixture ผลต่อคำสั่ง. G4/G5 ยังถูกบล็อกที่ iPhone/Xcode, Keychain, limiter/DAW, signing

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

### Packaged personal Caret.app — 13 กันยายน

สร้าง `VSCode-darwin-arm64/Caret.app` จาก Code-OSS pin + `vscode-darwin-arm64-min` แล้ว `package:mac` ทับ extension/runtime และ ad-hoc sign. `argv.json` เป็น `password-store=basic`. ตรวจด้วย `scripts/verify-packaged-caret.ts`: Mach-O `Contents/MacOS/Caret`, codesign verify, OMP SHA `fe76b727…`, host SHA `71438748…`. เปิดแบบแยก user-data + `caret.hostStateDir` ที่ `/tmp/caret-personal-launch-20260913` แล้ว host พร้อมบน loopback โดยไม่ใช้ default user host. ยังไม่ Undo/a11y/Codex visual. Code-OSS ยังแตะ `~/.caret-shared/sharedStorage`. iOS เลื่อนตามคำขอ. ไม่มี notarization.

### Pre-UI host/editor gates — 13 กันยายน

ผู้ใช้ให้ปิดฐานก่อนเริ่มแผน UI. ทำแล้ว:

- Host เริ่ม standalone พร้อม editor+permission bridges; test ผ่าน
- Native editor / AST / AST headless / permission smokes บน SHA `fe76b727…` ผ่านหลังแยก `HOME` ใน fixture (macOS OMP ไม่ใช้ XDG สำหรับ `~/.omp/run/daemons`)
- typecheck และ `CI-OK parents=198 ui=75 children=129 lock-shas=10`
- Virtual UI smoke 14 checks ผ่านนอก sandbox บน SHA เดียวกัน รวม PTY/abort/EOF
- ยังไม่มี Code-OSS Undo receipt (ต้องพิมพ์/Undo ในแอปจริง)
- ยังไม่เริ่ม UI-S1/PE-01

### UI-S1 / PE-01 Agent↔IDE view state — 13 กันยายน

อ่านสเปก 13 ก.ย. แล้วเริ่ม UI จาก slice แรก:

- Mode เป็น view state: `caret.showAgents` / `caret.showIde` และปุ่ม Agents/IDE ใน header
- เข้า Agents ถึงจะปิด sidebar/aux; กลับ IDE คืน chrome ที่ snapshot ไว้ ไม่ทับด้วย startup default
- Draft/scroll เก็บต่อ `projectId/sessionId`; A→B→A คืนฉบับร่างของ A; reset ไม่ล้าง mode
- ไม่ start OMP ใหม่ตอนสลับหน้า
- ตรวจแล้ว: `apps/macos` tests รวม workbench-mode + typecheck ผ่าน
- ยังไม่ใช่ COV-S02-01 บน Caret.app (screenshot/owner PID)

### UI-S2–S5 Mac surfaces + iOS projection tabs — 13 กันยายน

ทำแผน UI ตามสเปก 13 ก.ย. ในขอบเขตโค้ดที่ตรวจซ้ำได้ (ไม่ใช่ visual/device gate):

- UI-S2: `composer-runtime` แยก connection/run/delivery; running → Queue; offline draft-only; unknown → Check status; IME ไม่ส่ง
- UI-S3: work panel tabs Changes/Terminal/Browser/Preview/Artifacts/Files; hide ≠ kill; expired ไม่ respawn; browser ยัง unsupported จนกว่า bridge มี handle
- UI-S4 Mac: recovery banner (offline draft / unsaved / unknown) ไม่มี Retry ทำลาย; reconnect ไม่ auto-approve
- UI-S5: contrast/motion/hit-area/announce helpers; mode switch 0ms; reduced motion ตัด transition
- UI-S4 iOS: แท็บ Activity/Settings เป็น projection ไม่มี IDE/OMP บนเครื่อง
- UI-S6 simulator และ visual/VoiceOver/iPhone cellular ยังไม่ใช่ verified
- ตรวจแล้ว: `apps/macos/test` 75 tests; typecheck หลังแก้ composer axes

### UI process-all remaining contracts — 13 กันยายน

ปิดช่องที่ทำในเครื่องได้ต่อจาก S1–S5:

- Approval ผูก session/incarnation; ตอบซ้ำ/stale ถูก reject ก่อนส่ง host
- Dispatch guard กัน double-click envelope เดียวกันขณะ in-flight
- Attachment + artifact last-good เป็นโมดูลบริสุทธิ์ (ยังไม่ picker จริงใน webview)
- Catalog แสดง available/needs-auth/unsupported; voice/cloud/automations/browser ไม่เปิดเอง
- iOS Activity ลิสต์ request ของ session เดิม ไม่ตอบอัตโนมัติ
- Receipt: `docs/maintenance/evidence/ui-process-2026-09-13/receipt.json`
- ยังไม่ verified บน Caret.app / iPhone / VoiceOver / Codex

### UI shell packaged runtime — 13 กันยายน (ต่อจาก process-all)

UI shell ตามสเปกที่ทำใน working tree ตรวจ unit ผ่านแล้ว (root 470, macos 342, ios 141, typecheck clean):

- Rebuild `--portable --desktop` แล้ว `--package` + ad-hoc re-sign; extension ใน app มี `restartWorkResource`/`retentionReceipt`/`set_workbench_mode` ตรง UI ปัจจุบัน. OMP/host SHAs ไม่เปลี่ยน (`fe76b727…`/`71438748…`), argv ยัง `password-store=basic`
- Personal launch แบบแยก fixture (`/tmp/caret-ui-shell-20260913`, `caret.hostStateDir` ใน settings ของ fixture, ไม่แตะ default user host): app รัน, `caret.caret` activate ผ่าน `onStartupFinished`, exthost log ไม่มี error, ไม่มี Keychain hang. Host ยังไม่ start (on demand; Restricted shell ก่อน) — ถูกตามสเปก
- Computer preview ใช้ไม่ได้รอบนี้: `computer.windows()` timeout สองครั้ง (60s/120s) จึงไม่มี screenshot. COV-S02-01 (Agent→IDE→Agent บน app + owner PID) ยังค้าง
- ปิด fixture แล้วด้วย kill -9 เฉพาะ PIDs ของ fixture (SIGTERM ไม่พอ); default user host ไม่ถูกแตะ
- Receipt: `docs/maintenance/evidence/ui-shell-runtime-2026-09-13/receipt.json`

### Agents chrome first-run fix — 13 กันยายน (ผู้ใช้ทัก: เห็น OSS stock ไม่ใช่ shell)

- สาเหตุ: `state.workbenchMode` เริ่มเป็น `agents` ทำให้ `setWorkbenchMode("agents")` รอบแรกได้ `from==to` → commands ว่าง → chrome เดิม (Explorer/tabs/CHAT/statusbar) ค้าง. ตรวจจาก screenshot จริงบน packaged app
- แก้: `extension.ts` ใช้ `agentsChromeApplied ? "agents" : "ide"` เป็น `from` (chrome ที่เห็นจริงคือ stock จนกว่าจะ apply สำเร็จครั้งแรก); `runWorkbenchCommands` เป็น best-effort ไม่ abort ทั้งสวิตช์เมื่อคำสั่งเดียว reject
- เทส: `workbench-mode.test.ts` เพิ่ม settle test; macos 343 ผ่าน, typecheck clean
- Rebuild `--package` + fresh fixture + `win.screenshot()`: shell เต็มหน้าต่างแล้ว (task sidebar ของ Caret เอง, ไม่มี Explorer/tabs/CHAT/statusbar, composer กลาง, Thai empty state ปกติ). Instance เดียวรันค้างไว้ให้ดู manual
- Receipt: `docs/maintenance/evidence/ui-shell-runtime-2026-09-13/receipt.json` (เขียนใหม่รวม computer review). ค้าง: interactive Agent↔IDE switch บน app, `unknown error` ใน renderer.log 1 บรรทัดยังไม่รู้ที่มา

### Computer review + Copilot error attribution — 13 กันยายน (ทำต่อจนสุดทางที่ทำได้)

- Shell หลัง fix ตรวจด้วย `win.screenshot()` หลายรอบ: Agents เต็มหน้าต่างทุกรอบ (sidebar ของ Caret เอง, composer กลาง, Thai empty state). Before/after เทียบ 8496 กับ 8581/8662 ชัด
- `unknown error` ใน renderer.log พิสูจน์แล้วว่าเป็นของ Copilot ไม่ใช่ของเรา: fixture (caret+copilot) มี error 1 ครั้งหลัง start ~30s; blank `--disable-extensions` ไม่มี; blank ปิดแค่ Copilot (caret activate จริง) ก็ไม่มี. โค้ดเราไม่มี `showErrorMessage` เลย
- Interactive Agent↔IDE round-trip ยังไม่ผ่านบน app: click/type/press ครบแต่ไม่ถึงหน้าต่าง (off-Space/unfocused), palette ไม่เปิด, chain ยาวทำ eval worker hang. Unit + startup proof ครอบคลุม; รอบนเครื่องว่างค่อยทำ
- อุบัติเหตุ: `open` แบบไม่มี `-n` ตอน fixture instance ตายเงียบไปแล้ว ทำให้เกิด default-profile instance (PID 34318) เห็น Copilot Sessions UI; พิมพ์ probe 21 ตัวอักษรลง composer ของมันโดยไม่ส่ง (no Enter) แล้ว kill ทิ้ง. ข้อความค้างในกล่องให้ลบเองได้; ไม่ได้ส่งคำสั่ง host/แตะไฟล์. Default host ไม่ถูกแตะ
- Watch: fixture instance ตายเงียบ 2 ครั้งไม่มี exit log — ต้องมี crash/exit-code watch ก่อนอ้าง release
- Receipt เขียนใหม่รวมทั้งหมดข้างต้น. Root 471/typecheck/CI-OK ผ่านหลังสุด

### แก้ข้อสรุปเรื่อง unknown error — 13 กันยายน (Copilot theory ผิด)

- Copilot-free build (ถอด `extensions/copilot` ออกแล้ว) ยังมี `unknown error` 1 ครั้ง + `AccountPolicyGate` ก่อนหน้า → ไม่ใช่ของ Copilot
- Blank `--disable-extensions` รอ 3.5 นาที: สะอาด → ไม่ใช่ stock core ล้วนๆ
- Fixture (เหลือแค่ caret.caret) มี error ทุกครั้ง แต่โค้ดเราไม่มี `showErrorMessage` เลยและ catch ครบทุกทาง → กลไกยังไม่เจอ (proof เขียนช้ากว่า activate ~2 นาทีในรันนี้ ชี้ว่า startup ถูก defer — หน้าต่าง background โดน throttle)
- สรุปซื่อสัตย์: ไม่ทราบที่มา, ไม่กระทบ shell ที่ตรวจ (render/proof ปกติ). ขั้นถัดไปถ้าจะเอา: exthost unhandled-rejection listener หรือ bisect builtin ทีละตัว. ไม่ใช่ gate ของ UI

### ide-native: terminal citation + native Code Action surface — 14 กันยายน

- ผู้ใช้ถามว่าทำไมยังไม่เหมือน Cursor จึงหาเฉพาะช่องที่ "ประกาศแล้วแต่ไม่ทำงานจริง" แล้วปิดสองจุดที่ยังขาด
- เพิ่ม `caret.addTerminalSelectionToTask`: อ่าน selection จริงของ terminal แล้วต่อ block `terminal:<name>` เข้า composer draft. `Terminal.selection` engine implement จริง (`extHostTerminalService.ts:133`, รับผ่าน `$acceptTerminalSelection`) แต่ `vscode.d.ts` ของ checkout นี้ยังไม่มี declaration จึงอ่านผ่าน structural cast ที่มีคอมเมนต์กำกับ ไม่ประดิษฐ์แหล่งข้อมูลที่สอง. เมนู `terminal/context` + `terminal/title/context` gate ด้วย `terminalTextSelected` + `caret.taskAvailable` (ตรวจ key และ contribution point กับ pinned checkout แล้ว). selection ว่าง/มีแต่ช่องว่างถูกปฏิเสธ ไม่ส่ง scrollback ทั้งก้อน, CRLF ถูก normalize
- เพิ่ม `vscode.languages.registerCodeActionsProvider('*')` เสนอ Edit Selection / Add Selection to Task / Review File in Diff และ **ไม่เสนออะไรเลย** เมื่อยังไม่มี task surface จริง เพื่อไม่ให้หลอดไฟเสนอคำสั่งที่กดแล้วพัง; ให้บริการเฉพาะเอกสารไฟล์จริง ไม่รวมฝั่ง original ของ `caret-review`
- `hasTaskSurface()` เป็นกฎเดียวที่ทั้ง context key และ provider ใช้ร่วมกัน; ย้าย tail การ merge draft/persist/status ของ path editor ไปเป็น `appendContextBlock()` ให้ editor/file/terminal ใช้ร่วมกัน
- เทส: root **560 pass / 0 fail / 2994 expect** (ใหม่ 14: unit 6 terminal + 4 code action, behavior 3 บน harness ที่ host ไม่ reachable, อีก 1 บน live host), typecheck clean, `CI-OK parents=198 ui=75 children=129 lock-shas=10`
- Runtime: rebuild `--package` (`CARET_HOST_NODE` = pinned Node 24, ad-hoc re-sign) แล้ว launch ด้วย private profile + private `caret.hostStateDir` (ปิด workspace trust เฉพาะ profile นั้น). `caret.caret` activate ผ่าน `onStartupFinished` โดยไม่มี error ต่อท้าย; Caret channel เขียน `startup view=ide mode=ide revealDock=true`; mode-switch proof เขียนจริง (agents -> ide, sameWindow, draft/scroll/attachment คงอยู่, ownerUnchanged); OCR หน้าต่างที่รันจริงเห็น menu bar, Explorer เนทีฟกับ file tree, OUTLINE/TIMELINE, dock `CARET` พร้อม New Task / Show IDE และ status bar `Caret ready`
- ยังไม่ยืนยัน: เมนู terminal ตอนคลิกขวา และหลอดไฟ ยังไม่ได้กดจริง (ต้องใช้ GUI automation ที่ timeout ในรอบก่อน). ที่พิสูจน์คือ activation สะอาด + ตรวจ declaration/contribution point กับ engine จริง ไม่ใช่ screenshot ของเมนูที่เปิดอยู่
- Restricted Mode: รันครั้งแรกในโฟลเดอร์ที่ยังไม่ trust จะ activate แล้วเข้า static shell ตามสเปก และไม่เขียน globalStorage — surface จะปรากฏหลัง trust เท่านั้น (จึงต้องใช้ private profile แบบปิด trust เพื่อดู surface เต็ม)
- Receipt: `docs/maintenance/evidence/ide-native-shell-2026-09-14/receipt.json` (คีย์ `ideNativeSurface2026_09_14`) + `runtime-window-ocr-2026-09-14.txt`

### ide-native: Explain/Fix บน selection + ยืนยัน surface ด้วย GUI จริง — 14 กันยายน (ต่อ)

- ปิดช่องที่ยังขาดจากรอบก่อน: เพิ่ม action แบบ Cursor ที่ selection ยังไม่มี คือ `caret.explainSelection` และ `caret.fixSelection` — cite path/line range จริงแล้วส่งเป็นหนึ่ง turn ผ่าน guarded send path เดียวกับ inline edit; stage ลง composer ก่อน dispatch เพื่อไม่ให้คำสั่งหายเมื่อส่งไม่ผ่าน; `Fix` สั่งให้ agent บอกตรงๆ ถ้าไม่พบ defect แทนที่จะแก้โค้ดทิ้ง. ผูกเข้า editor context menu, line-number gutter และ Code Action provider
- เพิ่ม invariant ที่ยังไม่มีใครคุม 2 ข้อ: `menus-contract.test.ts` เอา key-position identifier ทุกตัวใน `when` ของ menus/keybindings ไปเทียบกับ pinned Code-OSS (พิสูจน์แล้วว่าจับได้จริงโดยปลูก typo `caret.taskAvaliable` แล้วเทสต์ fail) และเทสต์ behavior ที่บังคับว่า **ทุก command ที่ manifest ประกาศต้องถูก register จริง** และทุก menu entry ต้องชี้ไปที่ command ที่ register แล้ว (ป้องกัน bug class เดียวกับ `caretDock.focus` ที่ตายเงียบ)
- **ยืนยันด้วย GUI จริงใน packaged app** (ปิดช่อง "ยังไม่ได้กดจริง" ของรอบก่อน): CUA เข้า AX tree ของ workbench ได้ และเร็ว (ต่างจากรอบก่อนที่ timeout)
  - Command Palette แสดง `Caret: Explain Selection with Caret` ตรงกับ title ใน manifest; กดรันตอนไม่มี editor เปิด → ได้ notification ของ extension เอง `Info: Open a workspace file before using Caret on a selection., source: Caret Mac task extension`
  - เปิด `src/greet.ts` จาก Explorer เนทีฟ → เลือกโค้ด → รัน Explain → composer จริงมีค่า `Explain what this selected code does, and call out anything surprising or risky. (src/greet.ts#L1-L4)` แล้วขึ้น `Choose a model before sending. Caret does not pick a billed fallback.` (ปฏิเสธพร้อมเหตุผล ไม่เงียบ)
  - `Cmd+.` เปิด Code Action list แสดงครบ 5 รายการตามลำดับที่กำหนด: Explain / Fix / Edit Selection / Add Selection to Task / Review File in Diff (Quick Fix ทั้งหมด)
  - คลิกขวาใน editor แสดง `Add Selection to Caret Task ⌥⌘K`, `Edit Selection with Caret ⌘K`, `Explain Selection with Caret`, `Fix Selection with Caret` + editor-title button `Edit Selection with Caret (⌘K)` และ `Review Active File in Diff (⌥⌘R)` โดย keybinding label มาจาก engine resolve เอง
  - Status bar จริงอ่าน `Caret ready` tooltip "Caret is connected to the Mac host."; window title เป็น `greet.ts — workspace — Caret`
- เทสต์: root **571 pass / 0 fail / 3034 expect**, typecheck clean, `CI-OK parents=198 ui=75 children=129 lock-shas=10`
  - native diff review: ทำ git fixture จริง (commit baseline + แก้ค้างไว้) แล้วสั่ง `Caret: Review Active File in Diff` (⌥⌘R) จาก palette → เปิด diff editor ของ Code-OSS จริง หัวแท็บ `src/greet.ts (HEAD ↔ Working Tree)` และ description ยืนยันว่าฝั่ง original คือ `/HEAD/src/greet.ts` เทียบกับไฟล์จริงใน working tree — คือ content provider `caret-review:` ของเราเอง ไม่ใช่ view ที่ Caret วาด
  - terminal command: รัน `Caret: Add Terminal Selection to Caret Task` จาก palette ในแอปจริง → ได้ notification ของ extension เอง `Info: Select terminal output first. Caret cites the real selection; it will not send the whole scrollback.` (handler ทำงานจริง ไม่ใช่ id ตาย) — capture เดียวกันยังได้ shell สรุป: panel `CARET` พร้อม view-title action `New Task ⌥⌘N` / `Show IDE ⌥⌘I`, status bar `main* | Caret ready | 10 | 0 | TypeScript | LF | UTF-8 | Spaces: 2`
- ยังไม่ยืนยัน: **การโผล่ของเมนู** `terminal/context` / `terminal/title/context` — gate ด้วย `terminalTextSelected` และ terminal canvas ไม่ถูก expose เป็น AX element จึงเลือกข้อความใน terminal ผ่านฮาร์เนสนี้ไม่ได้ (Shift+F10 ไม่เปิด; node ชื่อ "Terminal" ใน tree คือเมนูบาร์ macOS; คลิกขวาแท็บไม่เปิด; ปุ่ม `Focus Terminal` และคลิก container ไม่ย้าย focus จริง — editor ยังถือ `(112 selected)` และกินข้อความที่พิมพ์ไป) ตัวคำสั่งพิสูจน์แล้วข้างบน ตัว contribution ผ่านการตรวจกับ engine แล้ว แต่ตัวการปรากฏของเมนูยังไม่มีหลักฐานภาพ
- Harness: private user-data-dir, ปิด trust เฉพาะ profile นั้น, private `caret.hostStateDir`, host รันให้ fixture นี้โดย bundled runtime ของแอปเอง; ไม่แตะ default user host/profile. หลักฐาน: `runtime-cua-code-actions-2026-09-14.txt`, `runtime-cua-editor-context-menu-2026-09-14.txt`, `runtime-cua-native-diff-2026-09-14.txt`, `runtime-cua-terminal-command-2026-09-14.txt`, `runtime-cua-ax-2026-09-14.txt`, `runtime-window-2026-09-14.jpeg` + `.ocr.txt`
- Receipt: คีย์ `ideNativeSelectionActions2026_09_14` ใน receipt เดียวกัน

### stock command contract: ปิดช่อง id ตายของคำสั่ง Code-OSS — 14 กันยายน

- ช่องที่เหลือ: test เดิมคุมเฉพาะ id ที่ Caret เป็นเจ้าของ (`ide-native-command-ids.test.ts`) ส่วน id ของ Code-OSS เอง (`workbench.*`, `vscode.*`, `git.*`) มีแค่ hand sweep ที่เขียนเป็นคำอธิบายไว้ใน receipt — พิมพ์ผิดแล้วไม่มีใครรู้ เพราะ rejection ไปตายใน catch แล้วฟีเจอร์เงียบไป (เส้นทางเดียวกับ `caretDock.focus` ที่เคยตายเงียบ)
- เพิ่ม `apps/macos/test/command-contract.test.ts`: สแกนทุกไฟล์ใน `apps/macos/src` หา `executeCommand("<id>")`, รูป `for (const command of [...])`, และ command list สองตัวใน workbench-mode.ts (`agentsChromeCommands`/`ideChromeCommands`) แล้วเอา id ที่ไม่ใช่ของ Caret ไปเทียบกับ pinned checkout — `git.*` เทียบกับ bundled git extension (`desktop/extensions/git/src`), ที่เหลือเทียบกับ `desktop/src/vs`. id ที่ engine **สร้าง** ตรวจเชิงโครงสร้างแทน: `<declared view id>.focus` เทียบกับ views ใน manifest และ `workbench.view.extension.<declared container id>` เทียบกับ viewsContainers (ตรงกับที่ `viewsExtensionPoint.ts` สร้างจริง)
- พิสูจน์ว่าเทสต์มีเขี้ยวจริง: ปลูก typo `workbench.view.explorer` → `workbench.view.exploreer` แล้วเทสต์ fail พร้อมชี้ id ที่ตายตรงตัว จากนั้น revert กลับสะอาด
- ตอนนี้เก็บได้ 21 id ทั้งหมด resolve: core 17 (`vscode.diff/open/openFolder/openWith`, `workbench.view.explorer`, `workbench.trust.manage`, `setContext`, และ `workbench.action.{newWindow,openSettings,openGlobalKeybindings,selectTheme,closeSidebar,closeAuxiliaryBar,closePanel,activityBarLocation.hide,focusAuxiliaryBar,focusPanel}`), git 1 (`git.openMergeEditor` ผ่าน `@command` decorator), generated 3 (`caretComposerDock.focus`, `caretComposer.focus`, `workbench.view.extension.caretDock`)
- เทสต์: root **574 pass / 0 fail / 3041 expect**, typecheck clean, `CI-OK parents=198 ui=75 children=129 lock-shas=10` (ไฟล์ใหม่รัน ~330ms; ใช้ `rg` เป็นหลัก และมี fallback เดินต้นไม้เองถ้าเครื่องไม่มี `rg`)
- Receipt: คีย์ `stockCommandContract2026_09_14`

### interactive Agent↔IDE switch บนแอปจริง — 14 กันยายน (ปิด COV-S02-01)

- ปิดรายการที่ receipt ของ session ก่อนบันทึกว่ายังค้าง (COV-S02-01: Agent→IDE→Agent บนแอป + owner) ซึ่งเดิมพิสูจน์ได้แค่เส้นทาง startup
- วิธี: packaged app จาก revision นี้ + private profile (ปิด trust เฉพาะ profile) + private `caret.hostStateDir` แล้วขับผ่าน Computer Use บน accessibility tree จริงของหน้าต่างที่รันอยู่ ใช้เฉพาะ AX element จริง ไม่ใช้พิกัด
- ผลที่เห็นจริง:
  - **IDE → Agents**: คลิก status bar item `Caret ready` → chrome ถูกซ่อนจริง (toggle ทั้ง primary sidebar / panel / secondary sidebar เป็น `Value: 0`) title เปลี่ยนเป็น `New task — Caret` และ webview ของ Caret เต็มหน้าต่างพร้อม Agents surface จริง: `New task` / `Open folder`, แถวงาน `New task · Draft 19m · This Mac · OMP · PR Unknown`, toggle `IDE`, และ composer
  - **Agents → IDE**: คลิก toggle `IDE` → chrome กลับมา (primary sidebar + panel เป็น `Value: 1`, Explorer กับ file tree กลับมา) คือ re-apply `ideLayout` snapshot ที่จำไว้ ไม่ใช่ workbench เปล่า
  - **Round trip + retention**: พิมพ์ draft จริงใน composer (`caret retention probe`) แล้วสลับ IDE → Agents → IDE → Agents ครบ — หลังสลับครั้งสุดท้าย composer ยังมี draft อยู่
  - **Proof file**: extension เขียน `mode-switch-proof.json` ใหม่จาก**การคลิกจริง** (capturedAt 03:55 เทียบ startup 03:53): `sameWindow: true`, `draftRetained: true`, `scrollRetained: true`, `attachmentsRetained: true`, `ownerUnchanged: true`, `from: "ide" → to: "agents"` — ตรงกับ COV-S02-01 ที่ต้องการ
  - exthost log ของ session นี้ไม่มี error / unhandled rejection / activation failure เลย
- หลักฐาน: `runtime-cua-agents-mode-2026-09-14.txt`, `runtime-window-agents-mode-2026-09-14.jpeg`, `runtime-cua-agents-roundtrip-2026-09-14.txt`, `runtime-window-agents-mode-2-2026-09-14.jpeg`; receipt คีย์ `interactiveModeSwitch2026_09_14`
- หมายเหตุความซื่อสัตย์: การพยายามเลือกข้อความใน terminal ผ่าน AX ยังทำไม่ได้ (focus ตกไปที่ editor แทน) — บันทึกไว้เป็นข้อจำกัดของฮาร์เนสใน `ideNativeSelectionActions2026_09_14.notVerified` ไม่ใช่ defect ของ Caret

### ide-native: mark edit ที่ agent apply + Keep/Take back — 14 กันยายน

- ปิดชิ้นที่ "รู้สึกเหมือน Cursor" ที่สุดซึ่งยังขาด: ให้ edit ที่ Caret apply ผ่าน editor bridge มีที่อยู่ใน editor เอง — mark บริเวณที่ถูกแก้ + ปุ่มเก็บ (save) และปุ่มดึงกลับ (restore ข้อความก่อนแก้)
- **seam**: `CaretEditorService` มี option `afterApply(summary)` ยิงหลัง guarded apply ผ่าน postcondition เท่านั้น; ส่ง path/uri/version ที่ได้/pre-edit text/edit ranges. **ไม่แตะตรรกะการตัดสินใจ apply** และถ้า report พังก็ไม่ทำให้ apply ที่สำเร็จกลายเป็น error response
- **geometry** (`apps/macos/src/agent-edit-marks.ts`, pure): คำนวณว่ารับ replacement ไปลงตรงไหนในบัฟเฟอร์ใหม่ (edit ไม่เลื่อน start ของตัวเอง + bridge ห้าม overlap), merge ช่วงที่ติด/ทับกัน, ขยาย deletion ที่ zero-width ให้เป็นทั้งบรรทัดเพื่อให้มองเห็น, นับบรรทัดจริงสำหรับ label
- **UI**: decoration type เดียววาด mark บนทุก visible editor ที่มี pending edit + hover บอกชื่อไฟล์และสอง action; คำสั่ง `caret.keepAgentEdit` (save — เพราะ "เก็บ" ของบัฟเฟอร์ที่ยังไม่ save คือ save) และ `caret.revertAgentEdit` (restore ข้อความก่อนแก้) อยู่บน editor title + editor context menu, gate ด้วย context key ใหม่ `caret.agentEditPending`; ไฟล์ที่ save หรือปิดจะทิ้ง pending record เพื่อให้ปุ่มไม่โกหก
- **กฎการดึงกลับ**: restore ได้เฉพาะเมื่อบัฟเฟอร์ยังเป็น version ที่ Caret สร้าง ถ้ามีอย่างอื่นแก้ต่อ Caret จะปฏิเสธพร้อมเหตุผลและชี้ไปที่ Undo (ไม่ลบงานผู้ใช้ทิ้ง) และการดึงกลับเขียนเฉพาะบัฟเฟอร์ ไม่ save
- เทสต์: root **595 pass / 0 fail / 3085 expect** (ใหม่ 21: unit 15, behavior บน extension ที่ activate จริง 4, บน editor bridge จริง 2), typecheck clean, `CI-OK parents=198 ui=75 children=129 lock-shas=10`
- **ยังไม่ยืนยัน**: ยังไม่เห็น mark บน editor ที่รันจริงจาก edit ของ agent จริง เพราะต้องมี OMP session ที่เลือก model แล้ว ซึ่ง fixture ส่วนตัวนี้ไม่มี (จุดที่ส่งจะปฏิเสธด้วย "Choose a model before sending" ตามจริง) — ที่พิสูจน์ตรงๆ คือ bridge รายงานการเปลี่ยนแปลงถูก, provider วาด mark, และสองคำสั่งทำงานกับมัน ไม่ใช่ screenshot ของ mark ที่ถูกวาด
- Receipt: คีย์ `agentEditMarks2026_09_14`

### ยืนยันคำสั่ง mark edit บนแอปจริง + วิเคราะห์ข้อจำกัดที่เหลือ — 14 กันยายน

- rebuild `--package` จาก revision ที่เพิ่ม marks (`CARET_HOST_NODE` = pinned Node 24 + re-sign) แล้วเปิดแอปจริง: manifest ในแอปมี `caret.keepAgentEdit` / `caret.revertAgentEdit` และ gate `when: caret.agentEditPending`; bundle มี command id ทั้งคู่; `caret.caret` activate สะอาด (`startup view=ide mode=ide revealDock=true`)
- รันจาก Command Palette จริงทั้งสองคำสั่ง:
  - `Caret: Keep the Caret Edit` → notification `Info: This file has no Caret edit waiting. Caret only marks edits it applied through the editor bridge.`
  - `Caret: Take Back the Caret Edit` → notification เดียวกัน
  - ทั้งคู่คือ refusal path ของ handler เอง → ยืนยันว่าคำสั่งถูก register, หาเจอใน palette ด้วย title จาก manifest, เรียกได้จริง และต่อกับ handler จริง ไม่ใช่ id ตาย
- **วิเคราะห์ข้อจำกัดที่เหลือ (ไม่ใช่เดา)**: การวาด mark ต้องมี applied edit และตัวเดียวที่สร้าง editor request คือ tool `caret_editor` ของ OMP ใน session ที่มี model แล้ว — host ไม่มีทางอื่น (CLI มีแค่ serve/ensure/status, router มีแค่ route ฝั่ง client register/poll/respond) และคงไม่ไปเรียก provider แบบเสียเงินเอง; บันทึกขั้นที่ยังไม่ยืนยันไว้ตรงๆ ใน receipt (`agentEditMarks2026_09_14.verified.notVerified`)
- หลักฐาน: `runtime-cua-agent-edit-commands-2026-09-14.txt`

### ปิดช่องสุดท้าย: เห็น agent-edit mark ทำงานบนแอปจริงจาก apply จริง — 14 กันยายน

- ปิดข้อที่ receipt รอบก่อนบันทึกว่า "ยังไม่ยืนยัน" (`agentEditMarks2026_09_14.verified.notVerified`): ยังไม่เห็น mark ที่เกิดจาก apply จริงของ agent บน editor จริง
- เพิ่ม `scripts/ide-native-agent-mark-smoke.ts` เป็น acceptance fixture แบบ zero-cost: สร้าง host เอง (ได้ `EditorConnections` ตัวเดียวกับที่แอปลงทะเบียน), model server scripted ในเครื่อง, แล้วเปิด **packaged app** ด้วย private profile + `caret.hostStateDir` ชี้ host ของ fixture. model ทำ script read → edit → read; ไม่มี paid inference
- **บั๊กที่เจอตอนรันจริง (แก้แล้ว)**: `read`/`edit` ล้มด้วย `Path is outside this workspace` เพราะ macOS `/tmp` เป็น symlink ไป `/private/tmp` และ OMP เทียบ canonical path กับ session cwd ที่ยัง literal — ต้อง realpath fixture root ตั้งแต่ต้น (ตรงกับ pattern ของ smoke เดิมในรีโป) ไม่ใช่ตัว bridge
- **ผลรันจริงบน packaged app (assert จาก buffer/disk ไม่ใช่ screenshot)** receipt `checks` ผ่านทั้ง 6: edit เข้า buffer ของแอปผ่าน editor bridge (`edit-visible-in-the-editor-buffer-not-on-disk`), มี guarded approval ครั้งเดียว (`approvals: 1`), disk ไม่ถูกแตะทั้ง turn, และ Take Back คืน buffer เป็นข้อความก่อนแก้เป๊ะและไม่ save
- **หลักฐาน AX ของ surface**: ระหว่างมี mark editor-title มี `Keep the Caret Edit` + `Take Back the Caret Edit` (gate `when: caret.agentEditPending` ซึ่ง set หลัง apply จริงเท่านั้น) และ Explorer ขึ้น `1 unsaved file`; หลังกดปุ่ม Take Back จริง ปุ่มทั้งคู่หายและ status bar ขึ้น `Caret: took back the edit to src/greet.ts` (ข้อความของ `forgetAgentEdit`)
- ข้อจำกัดที่บันทึกตรงๆ: decoration เองไม่ใช่ AX element จึงพิสูจน์ตัว pending record/สอง action/ผลของมัน ไม่ใช่บรรยายพิกเซล (มี screenshot ให้คนดู; vision model rate-limited รอบนี้); path Keep ไม่ได้กดในรอบนี้ (มี unit/behavioral test ครอบ)
- หลักฐาน: `docs/maintenance/evidence/ide-native-agent-mark-2026-09-14/receipt.json` + `runtime-cua-agent-mark-2026-09-14.txt` + `runtime-window-agent-mark-2026-09-14.png`

### ปิดวงรีวิวของ Caret edit: Review (native diff) — 14 กันยายน

- ต่อจาก mark + Keep/Take Back: เพิ่มคำสั่งที่สาม `caret.reviewAgentEdit` ให้ผู้ใช้ **รีวิวสิ่งที่ Caret แก้** เป็น native Code-OSS diff โดยฝั่งซ้ายเป็นข้อความก่อนแก้ที่บันทึกไว้ผ่าน virtual document scheme `caret-agent-edit` (read-only) และฝั่งขวาคือ buffer จริง — ใช้ `vscode.diff` ของ engine เอง ไม่ใช่ view ที่ Caret วาด
- กฎความซื่อสัตย์: `agentEditReviewDecision` อนุญาตให้เปิด diff เฉพาะเมื่อ buffer ยังเป็น version ที่ Caret สร้าง ถ้ามีอย่างอื่นแก้ต่อ diff จะโชว์งานของผู้ใช้เป็นของ Caret — Caret จึงปฏิเสธและชี้ไปที่ Undo; ถ้าไม่มี edit ค้างก็ปฏิเสธพร้อมเหตุผล
- UI: ปุ่ม `Review the Caret Edit` อยู่บน editor title + editor context menu เคียงกับ Keep/Take Back, gate ด้วย `caret.agentEditPending` (แถวเดียวกับที่พิสูจน์แล้ว)
- เทสต์: root **603 pass / 0 fail / 3104 expect** (ใหม่ 8: unit 3 native-diff id/title + 2 review decision, behavior 3 บน extension ที่ activate จริง — เปิด `vscode.diff` ด้วยฝั่งซ้ายเป็น pre-edit text จริง, ปฏิเสธเมื่อ buffer ขยับ, ปฏิเสธเมื่อไม่มี edit ค้าง), typecheck clean, `CI-OK parents=198 ui=75 children=129 lock-shas=10`
- **ยืนยันบนแอปจริง**: ในรันเดียวกับที่ปิดช่อง mark — กด `Review the Caret Edit` เปิด diff editor จริง หัวแท็บ `src/greet.ts (before Caret ↔ after Caret)` ฝั่งซ้ายเป็น `caret-agent-edit:` URIs ของเรา; จากนั้นกด `Take Back` จาก title ของ diff นั้นเอง → ปุ่ม Caret ทั้งชุดหาย, `Previous/Next Change` กลายเป็น disabled (สองฝั่งเท่ากันแล้ว = revert ทำงาน) และ status bar ขึ้น `Caret: took back the edit to src/greet.ts`; fixture assert buffer/disk ผ่านครบ 6 ข้อเดิมอีกครั้ง
- หมายเหตุ: `scripts/ide-native-agent-mark-smoke.ts` เขียน receipt ใหม่ทุก run จึงกันการทับด้วยการ preserve block ที่เขียนด้วยมือ (`runtimeObservation`, `reviewDiff`, `notVerified`)
- ความซื่อสัตย์เรื่อง revision ของแอป: รันนี้ไม่ได้ `--package` ใหม่ทั้งก้อน (จะ rebuild OMP runtime ซ้ำ) แต่สร้าง `dist/mac-extension` จาก source ปัจจุบันแล้วแทนที่ `Contents/Resources/app/extensions/caret` ใน packaged app เดิม + ad-hoc re-sign + verify — เป็น output ตัวเดียวกับที่ `build-caret.ts --package` คัดลอกลงแอป (Electron/OMP payload ยังเป็น package 04:07); manifest/bundle ในแอปมี `caret.reviewAgentEdit` จริง (ตรวจ 3/2 ครั้ง)
- หลักฐาน: `docs/maintenance/evidence/ide-native-agent-mark-2026-09-14/receipt.json` (keys `reviewDiff`) + `runtime-cua-agent-review-diff-2026-09-14.txt` + `runtime-window-agent-review-2026-09-14.png`

### ปิด decision สุดท้าย: Keep (save) บนแอปจริง — 14 กันยายน

- ต่อจาก mark + Review + Take Back: ปิดข้อที่ค้างว่า "ปุ่ม Keep ยังไม่ได้กดในแอปจริง" — fixture เดียวกันรัน decision ได้ทั้งสองทาง (`kept` / `reverted`) และ grade คนละชุด assertion
- **ผลรันจริง (decision = kept)**: ก่อนกด title actions มีครบ `Review the Caret Edit` / `Keep the Caret Edit` / `Take Back the Caret Edit` และ Explorer ขึ้น `- 1 unsaved file`; กด `Keep` แล้ว suffix `- 1 unsaved file` หายไป (buffer ถูก save จริง), ปุ่ม Caret ทั้งสามหาย (pending record ถูกทิ้ง) และ status bar ขึ้น `Caret: kept the edit to src/greet.ts`; บนดิสก์ `src/greet.ts` กลายเป็น `return \`Hello, ${name}! Welcome back.\`;` และ `git diff --stat` = 1 insertion / 1 deletion
- สรุปครบทั้งสาม decision บน packaged app แล้ว: **Review** = native diff before/after, **Keep** = save ลงดิสก์, **Take Back** = คืน buffer และไม่ save
- receipt เก็บได้ทั้งสอง outcome: machine fields (`decision`, `checks`) สะท้อนรันล่าสุด และบล็อก `decisions` เก็บ `kept` (5 checks) กับ `reverted` (6 checks) แยกกัน; ไม่มี paid inference ทุกรัน
- หมายเหตุความซื่อสัตย์: vision model ถูก rate limit ทั้ง session จึงยังไม่ได้อ่านภาพมาบรรยายพิกเซลของ decoration (screenshot มีให้คนตรวจ); ข้อจำกัดนี้ยังอยู่ใน `notVerified`
- หลักฐาน: `docs/maintenance/evidence/ide-native-agent-mark-2026-09-14/receipt.json` (keys `keepRuntimeObservation`, `decisions`) + `runtime-cua-agent-keep-2026-09-14.txt` + `runtime-window-agent-keep-2026-09-14.png`

### Cursor-class in-editor decisions (CodeLens) + mark ที่แคบลง — 14 กันยายน

- Cursor วาง Accept/Reject บนตัว change ไม่ใช่แค่ในเมนู — เพิ่ม CodeLens ของ Caret: `caret.keepAgentEdit` / `caret.revertAgentEdit` บนบรรทัดแรกที่ apply เปลี่ยน, ลงทะเบียนผ่าน `vscode.languages.registerCodeLensProvider({ scheme: "file" })` และคืน `[]` ทุกเอกสารที่ไม่มี edit ค้าง (ไม่โฆษณาปุ่มที่กดแล้วพัง)
- ยืนยันบนแอปจริงว่าทั้ง render และทำงาน — แม้ lens ไม่มี AX node ปกติ ก็พิสูจน์ได้สามทาง:
- `Caret.log` เขียน `agent edit lenses offered path=src/greet.ts decisions=2 line=1`; provider เข้าถึงได้ทาง `registerCodeLensProvider` เท่านั้น จึงเป็น engine เรียก provider จริง (เพิ่ม log ครั้งเดียวต่อไฟล์ผ่าน Caret channel เป็นหลักฐาน)
- AX tree เห็นสองปุ่มใน editor container: `button Keep the Caret Edit` | `button Take Back the Caret Edit`
- กด lens จริง (หา index ด้วยการ parse AX tree ไม่ใช้พิกัดตายตัว) → pending record ถูกทิ้ง + `Caret: took back the edit to src/greet.ts`; อีกรอบจบด้วย title button แล้ว lens ถูกถอดด้วย (removed element 134 = lens container)
- เจอบั๊ก UX จากหลักฐานจริงแล้วแก้: log รอบแรกได้ `line=0` ทั้งที่ model แก้บรรทัด 1 — เพราะ guarded native apply ของ OMP รายงาน whole-file edit แม้แก้ 2 ตัวอักษร จึงทำให้ mark/lens ครอบทั้งไฟล์; แก้โดยคำนวณ mark จากข้อความที่ apply ผลิตจริง (`changedLineSpan(applyEdits(textBefore, edits))` ใน `agent-edit-marks.ts`) fallback ไปใช้ geometry เมื่อข้อความไม่เปลี่ยน แล้ว rebuild + re-run ได้ `line=1` = บรรทัดที่เปลี่ยนจริง
- เทสต์: root **611 pass / 0 fail / 3124 expect** (ใหม่ 6: unit lens specs, applyEdits single/multi, whole-file→บรรทัดเดียว, inserted line, equal texts, fallback), typecheck clean, `CI-OK parents=198 ui=75 children=129 lock-shas=10`; behavior assert ว่า provider ลงทะเบียนสำหรับ scheme file, คืน 2 command จริงบนบรรทัดที่เปลี่ยน, log ครั้งเดียว, title ตรงกับ manifest, และคืน `[]` หลัง keep
- หมายเหตุ: `scripts/ide-native-agent-mark-smoke.ts` preserve block ที่เขียนด้วยมือ (`runtimeObservation`, `keepRuntimeObservation`, `reviewDiff`, `codeLens`, `markRegion`, `decisions`, `notVerified`) แล้ว เพื่อไม่ให้ rerun ลบหลักฐาน AX
- หลักฐาน: `docs/maintenance/evidence/ide-native-agent-mark-2026-09-14/receipt.json` (keys `codeLens`, `markRegion`) + `runtime-cua-agent-edit-lenses-2026-09-14.txt`

### ยืนยัน keybindings ด้วยการกดจริงบนแอป — 14 กันยายน

- ช่องที่ยังอ่อนที่สุดของ objective คือ keybindings: เมนูโชว์ key ที่ engine resolve แล้ว แต่ยังไม่เคยกดปุ่มจริงให้คำสั่งทำงาน
- กดจริงบน packaged app ใน fixture workspace:
- `cmd+alt+r` (`caret.reviewInDiff`) ที่ไฟล์ `src/greet.ts` เปิดอยู่ → เปิด diff editor ของ Code-OSS จริง หัวแท็บ `src/greet.ts (HEAD ↔ Working Tree)` พร้อมสอง editor pane, ปุ่ม Open File / Previous Change / Next Change / Toggle Collapse Unchanged Regions = คำสั่งรันจากคีย์บอร์ดจริง ไม่ใช่จาก palette
- `cmd+alt+k` (`caret.addSelectionToTask`) ตอนไม่มี selection → ได้ notification ของ extension เอง `Info: Select text in the editor first. Caret did not invent a selection., source: Caret Mac task extension` (binding ถึง handler จริง และปฏิเสธตามกติกา ไม่ cite ทั้งไฟล์)
- ปิด diff ที่เปิดจาก (1) ก่อน แล้วรันต่อจนจบ: receipt checks ผ่านครบ 6 ข้อใน session เดียวกัน
- หลักฐาน: `docs/maintenance/evidence/ide-native-agent-mark-2026-09-14/receipt.json` (key `keybindings`) + `runtime-cua-keybindings-2026-09-14.txt`

### เจอ+แก้ defect: in-editor decisions ค้างหลัง Keep — 14 กันยายน

- เจอระหว่างเก็บหลักฐานคู่ภาพของ mark บนแอปจริง: หลังกด `Keep the Caret Edit` ปุ่มบน editor title หายและไฟล์ถูก save จริง **แต่ CodeLens ใน editor ยังโชว์สอง decision อยู่** ทั้งที่ `provideCodeLenses` ตอนนั้นคืน `[]` แล้ว = engine แสดงผลที่ cache ไว้
- กลไก: `CodeLensProvider` ถูก query ใหม่เมื่อเอกสารเปลี่ยน หรือเมื่อยิง `onDidChangeCodeLenses`; lens ของ Caret ขึ้นกับ state (pending edit) ไม่ใช่เนื้อเอกสาร และ provider ไม่เคยยิง event นั้น → ค่าล่าสุดค้างบนจอ เป็นปุ่มที่ดูยัง live แต่กดแล้วจะปฏิเสธ (honesty class เดียวกับ `caretDock.focus` ที่เคยตายเงียบ)
- แก้: เพิ่ม `#agentEditLensesChanged` (vscode.EventEmitter) ยิงจาก `refreshAgentEditMarks()` ซึ่งรันอยู่แล้วทุกครั้งที่ pending state เปลี่ยน (record / keep / take back / save / close / visible editors) และ provider คืน `onDidChangeCodeLenses: event`; emitter ถูก dispose พร้อม provider
- ยืนยันบนแอปจริงหลัง rebuild: กด `Keep` → `kept reported: true`, title buttons หาย, และ **`LENS still present: false`** (ก่อนแก้เป็น true)
- เทสต์ behavior เพิ่ม: provider เปิด event, ยิงครั้งเดียวตอน record + อีกครั้งตอน keep, และคืน lens ว่างหลัง keep (root 611 pass / 0 fail / 3127 expect)
- ลองพิสูจน์พิกเซลของ decoration แบบ objective (ไม่มี vision model): decode PNG ด้วย zlib แล้ว diff คู่ mark-on/mark-off ที่ข้อความ buffer เท่ากัน → เจอ 99756 px ต่างกันใน 5 band แต่แถบใหญ่สุดในโซน editor เริ่มที่ gutter ซึ่งเป็นที่ที่ git marker หลัง save โผล่ → **แยกไม่ออก** ว่าเป็น decoration ของ Caret หรือ chrome ที่เกิดจาก save. บันทึกตรงๆ ว่า pixel appearance ยังต้องให้คนยืนยัน; ที่ยืนยันแล้วคือ range/การ apply/decision ที่ผูกกับ mark
- หลักฐาน: `runtime-cua-agent-edit-lens-staleness-2026-09-14.txt` + `runtime-cua-agent-mark-pixels-2026-09-14.txt` + receipt keys `codeLensStaleness`, `markPixels`

### ยืนยัน stale-version refusal ของ Take Back บนแอปจริง — 14 กันยายน

- ปิดช่องสุดท้ายที่ก่อนหน้านี้มีแค่ unit/behavioral test: กฎ "ดึง edit กลับได้เฉพาะเมื่อ buffer ยังเป็น version ที่ Caret สร้าง" ถูกทดสอบบน packaged app แล้ว
- ลำดับ: edit ของ agent ลง buffer (มี Review/Keep/Take Back ครบ) → โฟกัส editor แล้วพิมพ์ 1 ตัวอักษร (version ขยับ) → กด `Take Back the Caret Edit` ได้ผล `stale refusal shown: true`, `took back: false` คือปฏิเสธพร้อมเหตุผล "would also undo your own change" และไม่มีการเขียน buffer หรือข้อความ take-back
- disk ยังเป็นข้อความก่อนแก้ (`return \`Hello, ${name}!\`;`) → การกระทำที่ถูกปฏิเสธไม่เขียนอะไรเลย
- หลักฐาน: `runtime-cua-agent-edit-stale-refusal-2026-09-14.txt` + receipt key `staleTakeBackRefusal`
- สรุปสถานะ agent-edit affordance: mark/Keep (save)/Take Back (restore ไม่ save)/Review (native diff)/stale refusal/keybinding ผ่านการยืนยันบนแอปจริงครบ; ที่เหลือคือ **pixel ของ decoration** ซึ่งยังต้องให้คนยืนยัน (vision tool ถูก rate limit; ลอง pixel diff แบบ objective แล้วแยกไม่ได้) และเมนู terminal ที่เปิดด้วยคลิกจริงไม่ได้เพราะ terminal canvas ไม่ใช่ AX element

### ปิดการลองพิสูจน์ pixel ของ decoration (ผลเป็นลบ + ได้ข้อค้นพบ) — 14 กันยายน

- ลองพิสูจน์พิกเซลของ mark แบบ objective โดยไม่ใช้ vision model: decode PNG ด้วย zlib (8-bit RGBA non-interlaced) แล้ว diff ทีละพิกเซล
- รอบ 1 ใช้ `Keep` เป็นตัวล้าง mark: ข้อความเท่ากันจริง แต่ Keep save ด้วย → chrome ที่เกิดจาก save (Explorer badge `M`, tab, SCM 1→2, `Open Changes`, git gutter) ตกลงแถวเดียวกัน; แถบใหญ่สุดในโซน editor เริ่มที่ gutter ซึ่งคือที่ git marker โผล่ → แยกไม่ได้
- รอบ 2 ใช้ `Reload Window` แทน: buffer ที่ยังไม่ save อยู่รอด (`still unsaved: true`) แต่ extension state ใหม่ทำให้ mark หาย (`mark after reload: false`) → ข้อความเท่ากัน เหลือแค่สิ่งที่ Caret วาด
- **ข้อค้นพบเชิงบวกจากรอบ 2**: ในคอลัมน์ข้อความของ editor bright-pixel count ของแถว 380..423 เท่ากันทั้งสองภาพ (ไม่มีการเลื่อน) แต่แถวที่มีพิกเซลสว่างสุดท้ายคือ y=491 ตอนมี mark และ y=459 ตอนไม่มี = ข้อความเลื่อนลงประมาณหนึ่งแถว CodeLens → ยืนยันได้เองว่า lens ของเราวางตัวใน layout ของ editor จริง ไม่ได้มีแค่ใน accessibility tree
- **ข้อสรุปที่บันทึกตรงๆ**: pixel ของ decoration เองยังแยกไม่ได้ เพราะการล้าง record ลบทั้ง lens และ decoration พร้อมกัน และ lens ทำให้ layout เปลี่ยน; ต้องมี state ที่มี mark แต่ไม่มี lens (ผลิตภัณฑ์ไม่มี) หรือให้คนดูภาพ → ยังคงเป็น human-confirm item. ที่ยืนยันแล้วคือ decoration type/สี/range ที่ apply ถูกต้อง (behavioral test) + pending record + decision ที่ render บนบรรทัดที่เปลี่ยน + ผลต่อ buffer/disk
- หลักฐาน: `runtime-cua-agent-mark-pixels-2026-09-14.txt` + receipt key `markPixels`

### ปิด pixel ของ mark ได้จริง: ตรวจด้วยสีของ theme (ไม่ใช้ vision model) — 14 กันยายน

- หลังลอง diff สองแบบไม่สำเร็จ จึงเปลี่ยนวิธีเป็น "ตรวจสีที่ decoration วาดเอง": อ่านสี token จาก theme ที่แอปใช้จริง (`extensions/theme-defaults/themes/2026-dark.json`): `editor.background` = `#121314`, `editor.wordHighlightStrongBackground` = `#27678280` (alpha 50%) → composite ได้ประมาณ rgb(29, 61, 75)
- เขียน probe อ่าน PNG ด้วย stdlib ล้วน (`scripts/png-pixel-probe.py`: zlib + PNG scanline filters) แล้วนับพิกเซลในคอลัมน์ข้อความของ editor
- ผล: capture ตอนมี mark มี `rgb(38, 61, 74)` **18217 px** (18289 px ในระยะ ±2) ส่วน capture ตอนไม่มี mark มี **0 px**; สีที่วัดได้ green/blue ตรงกับ composite (61/74 เทียบ 61/75) โดย red เพี้ยนเพราะ macOS color management; จำนวนพิกเซลพื้นหลัง editor ลดลง 21326 px ซึ่งเท่ากับ highlight + glyph ที่ re-antialias
- ยืนยันว่าไม่ใช่สีอื่น: `editor.selectionBackground` (0xdd) composite ได้ rgb(36,92,115) และ `editor.findMatchBackground` (0x90) ได้ rgb(30,66,82) ซึ่ง green/blue ต่างจากที่วัด → สีที่เจอคือ highlight ของ Caret เอง
- เพิ่มข้อค้นพบประกอบ: ในคู่ภาพที่ล้าง mark ด้วย `Reload Window` (ข้อความเท่ากัน, buffer ยังไม่ save) แถว 380..423 เท่ากันทั้งสองภาพ แต่แถวสว่างสุดท้ายคือ y=491 ตอนมี mark และ y=459 ตอนไม่มี = ข้อความเลื่อนลงราวหนึ่งแถว CodeLens → lens ของเราอยู่ใน layout ของ editor จริง
- สรุป: **mark ถูกวาดจริงบนบรรทัดที่เปลี่ยน ด้วยสี highlight ของ theme** ปิดช่อง "pixel ยังไม่ยืนยัน" เป็น verified
- หลักฐาน: `runtime-cua-agent-mark-pixels-2026-09-14.txt` + `runtime-window-agent-mark-on/off-2026-09-14.png` + `scripts/png-pixel-probe.py` + receipt key `markPixels`
