# Caret — ส่งต่องาน implementation ไป session ใหม่

อัปเดต 13 กันยายน 2026 เวลา 03:38 Asia/Bangkok. ผู้ใช้สั่งทำ **ทั้งแผน G1–G5 ให้เสร็จ** แล้วขอ handoff ไป session ใหม่. รอบนี้หยุดตามคำขอ handoff ไม่ใช่เพราะแผนเสร็จ

> **Amendment 2026-09-14 (spec):** สถานะ/ขั้นถัดไปในไฟล์นี้ถูกแทนด้วย
> [CARET-SPEC-2026-09-14.th.md](CARET-SPEC-2026-09-14.th.md) (§7 ขั้นงาน S1–S4 และ §4 retirement ledger)

> **อัปเดต 14 กันยายน 2026:** ผู้ใช้สั่ง **"ทำให้ Caret เหมือน Cursor แบบ pixel parity และแก้แผนให้ตรง"**. ผลคือ [D20](CARET-UI-DETAILED-DESIGN-2026-09-13.th.md) ล็อก **Cursor 3.20.17 (macOS) เป็น pixel/geometry/colour/motion reference** แทน Codex (Codex/OMP ยังเป็น reference ของ behavior และ surface ที่ Cursor ไม่มี). receipt อยู่ที่ [evidence/ui-cursor-parity-lock-2026-09-14](../../maintenance/evidence/ui-cursor-parity-lock-2026-09-14/receipt.json). รอบนั้นเพิ่ม palette ครบทั้ง 5 theme ของ reference (dark, light, high-contrast dark, dark-midnight, light-colorblind; HC-light ไม่มีใน reference จึง map ไป light และบันทึกเป็น deviation), ให้ chrome เดินตาม OS light/dark เหมือน reference (`window.autoDetectColorScheme` เฉพาะเมื่อผู้ใช้ยังไม่เลือก), ให้ colour customisations fall back ไป global เมื่อไม่มี folder เพื่อให้จอแรกมีสีถูก, เพิ่ม `isCaretWorkbenchPalette()` กัน footprint ของตัวเองถูกอ่านเป็นค่าผู้ใช้, แก้ token ที่ขัดกันเองใน `webview.ts`, ปิด drift ระหว่างเอกสารกับโค้ด, และแก้ `scripts/png-pixel-probe.py` ให้อ่าน RGB PNG ได้. **ยืนยันที่ runtime แล้ว:** app ที่ติดตั้ง (rebuild `--package` + ad-hoc sign ผ่าน) render light `#F3F3F3`/`#FCFCFC`, dark `#141414`/`#181818`, high-contrast `#0A0A0A`, midnight `#191c22`/`#1e2127` — ตรงกับไฟล์ theme ของ Cursor ทุกชุด; title bar strip ตาม theme ทุก kind; sidebar 180px; จอแรกแบบไม่มีโฟลเดอร์ได้สีถูก; ทุก state (running/approval/panel) ไม่หลุด palette. เพิ่ม **parity gate** `bun run check:cursor-parity` ที่อ่านไฟล์ theme จริงของ Cursor แล้วเทียบทุกคีย์ที่ Caret ประกาศ (OK/FAIL/SKIP; SKIP ไม่นับ pass) — รอบแรกจับบั๊กจริงได้ 1 จุด: dark `titleBar.inactiveForeground` เป็น 36% ขณะที่ reference ใช้ 60% (แก้แล้ว + pin test). สถานะปัจจุบัน 320 คีย์ 0 mismatch. เพิ่มการเทียบ **agent design tokens** ของ reference ด้วย: Cursor ship design system ของ agent window เป็น `--cursor-*` 405 ตัวใน bundle — font-size/line-height/height/radius/spacing/duration/easing ของ Caret ตรงทั้งหมด (28 token), แก้ 2 จุดที่เจอ: `--caret-composer-radius` 10→12 (reference ใช้ `radius-xl`) และ motion token ที่รอบก่อนเผลอเปลี่ยนไปใช้ค่าที่ไม่ใช่ของ reference (ตอนนี้ instant 50 / fast 100 / normal 150 / slow 200 / `cubic-bezier(0.215,0.61,0.355,1)`). **ยังไม่ปิด:** syntax token colours — **ติด licensing**: theme pack (`cursor-themes` 0.0.2) เขียนโดย Ryo Lu (Anysphere/Cursor เอง) ไม่ประกาศ license และมี 225 token rules ต้องมีการตัดสินก่อนคัดลอกทั้งชุด; variant palette เลือกด้วยชื่อ theme (heuristic ที่ต้องทบทวนถ้า reference เปลี่ยนชื่อ); side-by-side capture ที่ theme ตรงกันยังไม่มี (หน้าต่าง Cursor มีชื่อ task ส่วนตัว). **หมายเหตุ:** หน้าต่าง Caret ที่ผู้ใช้เปิดอยู่ยังใช้ bundle เก่าจนกว่าจะ restart (ไม่ได้ปิดหรือแตะ session นั้น). **งาน G1–G5 ที่เหลือยังคงเดิม**

## เริ่มจากตรงนี้

- Repo ที่แก้จริง: `/Users/pond/caret` (โฟลเดอร์นี้คือ checkout; ไม่มี `source/` ซ้อนแล้ว)
- โครงโฟลเดอร์: `apps/{host,macos,ios}` และ `packages/{protocol,omp-adapter,relay}` ใน repo เดียว ไม่แยก remote
- Branch `caret/g0-omp-foundation`; HEAD `a87d9b29ac9e60f5847540d7e6bddbdbfa8ddb49`
- งาน implementation ส่วนใหญ่ยัง **untracked/modified ไม่มี commit/push**. อย่า reset/clean/reclone หรือเปลี่ยนไป worktree ว่างแล้วทำของหาย. ตรวจ `git status` ก่อน
- อ่าน `AGENTS.md`, skill `/Users/pond/.agents/skills/astra-orchestrator/SKILL.md`, แล้วเอกสารในหัวข้อถัดไป. ใช้ Astra root/reviewer และ Luna bounded workers; interrupt child เมื่อจบ. Agent limit เคยติดบ่อย ห้ามอ้าง delegation ถ้า spawn ไม่สำเร็จ
- ทำงานต่อโดยไม่ถามยืนยัน scope ซ้ำ. พูดไทยกับผู้ใช้. ไม่สร้าง goal/automation หรือ commit/push/deploy/purchase โดยอนุมาน
- ไม่มี worker ที่ต้องรอจาก session นี้แล้ว; worker ล่าสุดจบและถูก interrupt

## เอกสารที่เป็นข้อกำหนด

แผนที่เอกสารอยู่ที่ [docs/README.md](../../README.md) อ่านใน `docs/maintenance/`:

1. `CARET-IMPLEMENTATION-DIRECTION-2026-09-12.th.md` — ทิศทางที่อนุมัติแล้ว, G1–G5, product experience รวม PE-10–PE-13
2. `CARET-WORKSPACE-WORKFLOW-2026-09-13.th.md` — หน่วย task workspace และวงจรรีวิวจาก Amp/Conductor
3. `CARET-FULL-IMPLEMENTATION-2026-09-12.th.md` — ledger งาน/หลักฐาน/ช่องว่างล่าสุด (มีประวัติยาว; ดูท้ายไฟล์ก่อน)
4. `CARET-OMP-COVERAGE-2026-09-12.th.md` และ `CARET-OMP-SOURCE-INVENTORY-2026-09-12.md` — O01–O18, full core denominator
5. `CARET-REFERENCE-ACCEPTANCE-2026-09-12.th.md` — P01–P20/E1–E4; ชื่อ feature หรือ generic tool card ไม่ใช่ acceptance
6. [handoff 12 กันยายน](../../archive/2026-09-12/CARET-HANDOFF-2026-09-12.th.md) — บริบทเดิม; ไม่ใช้แทนสถานะล่าสุดในไฟล์นี้

ข้อสรุปที่ไม่ต้องออกแบบใหม่: **Mac = Code-OSS IDE, Codex เป็นหลักอ้างอิงหน้าจอ, หน่วยงานเป็น task workspace บน Mac แบบ Conductor, วงจรรีวิว/มือถือเป็นแพ็กเกจหลักฐานแบบ Amp, OMP เป็น harness/เจ้าของ execution และ transcript เพียงตัวเดียว, Caret host เป็น durable owner/transport, iPhone คุม session เดียวกันผ่าน relay**. ไม่สร้าง Orb fleet และไม่ห่อหลายเอเจนต์. ไม่ rewrite UI เป็น Rust/GPUI; Rust ที่เพิ่มเป็น native seam ของ OMP เท่านั้น. รองรับงานทั่วไปตั้งแต่เว็บถึง native/audio plugin. Limiter เป็น acceptance target ไม่ใช่ข้อจำกัดผลิตภัณฑ์. ต้องคง requirement graph/ประวัติเก่าและไม่ทับ Aetheria/Cedia/limiter

## สิ่งที่รวมและตรวจแล้ว

### OMP / native editor / AST

- Pinned OMP v18.1.18 ใน ignored `upstream/omp`, revision `00085d4e7dfdcfbf302c122fa2682b410a0f43d1`
- Native Rust edit overlay ใช้ unsaved text + handle/version/hash, รักษา normalization, guarded native apply ไม่ auto-save; delete/move ที่แตะ overlay ยัง fail closed
- Whole-file write ใช้ model-observed snapshot; stale/unobserved/disconnected buffer ไม่ fallback เขียน disk. Read recovery และ generated-file guards แก้แล้ว
- Native AST เพิ่ม dry-run source capture/overrides, dirty-only matches, exact preview/guarded apply, bounded candidates/bytes, one-attempt latch. เก็บ lexical alias ตรวจ retarget แต่ใช้ canonical editor request รองรับ macOS `/var`/`/private/var`
- Headless AST ใช้ `NativeEditorBridge.handle({kind:'apply_disk',path,expectedCanonicalPath,expectedText,content})`; host ตรวจ bytes/identity และเขียนผ่าน FD เดียวอย่าง synchronous. จำกัด 8 MiB/file. **ไม่ใช่ OS atomic CAS ต่อ external writers**; error หลัง effect เป็น mayHaveApplied ไม่ replay/rollback อัตโนมัติ
- Editor workspace tombstones กัน headless apply สำหรับ roots ที่ซ้อนกันทั้งสองทิศทาง แม้ registration หมดอายุ/prune. Astra reviewer ตรวจแล้วไม่มี material findings ใน bounded disk/path fix
- เพิ่ม `apply_disk` เข้า approval gate ที่ `apps/host/src/service.ts` หลัง real headless fixture พบ omission. Allow/reject real OMP fixtures ผ่าน. การเปลี่ยน service บรรทัดนี้เกิดหลัง bounded reviewer รอบสุดท้าย จึงให้ reviewer session ใหม่ตรวจร่วมกับ mobile
- CLI editor bridge **ยัง default OFF** (`CARET_RPC_EDITOR_BRIDGE=1` เพื่อ opt in); อย่าอ้าง native parity เสร็จจน create/delete/move/untitled และ actual editor tests ผ่าน

ไฟล์หลัก: `apps/host/src/{native-disk,native-editor,editors,service}.ts`, `apps/host/test/native-disk.test.ts`, `upstream/omp/packages/coding-agent/src/tools/{ast-editor-plan,ast-edit,acp-bridge}.ts`, `src/modes/rpc/caret-client-bridge.ts`, Rust `crates/pi-natives/src/ast.rs` และ pi-edit overlay

### Build / host / Mac

- Durable SQLite host, private authenticated loopback, detached lifecycle, command journal/unknown outcome, OMP owner lock, relay revoke, artifacts/chunks/worktrees และ native UI/permission bridges อยู่ในโค้ดแล้ว; coverage ทั้งแผนยังไม่ครบ
- Portable bundle มี Node24 + host + standalone OMP + notices; relocation/path-spaces/system-PATH-only/host-survives-launcher/model-less-OMP/graceful-stop ผ่าน
- Code-OSS pin `ea1912fd6a05b80a56b2ad9b955075211deea521` ใน ignored `desktop/`
- Full app package สร้างและ ad-hoc signature verify ผ่านก่อน AST ล่าสุด: `VSCode-darwin-arm64/Caret.app`, executable `Contents/MacOS/Caret` (ไม่ใช่ Electron)
- Restricted Mode แสดง static Caret shell โดยไม่สร้าง host/editor/tools ก่อน trust. Tracked startup patch ใน `patches/desktop/` ปิด upstream onboarding/AI default ก่อน extension activation. แก้ tree-sitter WASM packaging และ host ESM package metadata
- **dist/portable ใหม่กว่า app ที่ package ไว้**. App เก่ายังมี OMP SHA `2e7ff258…`; อย่าใช้ app นั้นรับรอง runtime ล่าสุดโดยไม่ rebuild/package/ตรวจ hash

### Mobile — งานล่าสุด ต้อง review ต่อก่อนรับรอง

Luna แก้ไฟล์เหล่านี้แล้ว:

- `apps/ios/src/core/virtual-terminal.ts`: `VirtualTerminalRendererCoordinator`, replay ครั้งเดียวต่อ ready generation, stream output ใหม่, ไม่ reset renderer ที่ยังอยู่เมื่อ trim, redraw เมื่อเจอ gap/remount, stale identity guard, ไม่ redraw terminal ที่ปิดแล้ว
- `apps/ios/src/components/VirtualTerminal.tsx`: แยก mount generation/ready generation, recovery status, negotiate callback, copy “Interactive session”
- `apps/ios/src/components/terminal/document.ts`: public xterm parser handlers กันคำตอบ DSR/DA/window/DECRQM/DECRQSS และ OSC10/11/12 แบบ `?`; ไม่ใช้ outbound regex จึงรักษา modified F3
- `apps/ios/App.tsx`: negotiate command + session/incarnation/terminal identity checks
- `apps/ios/src/__tests__/virtual-terminal.test.ts`: coordinator/parser/closed/identity/command tests

Root ตรวจหลัง worker จบ: **mobile 43 tests / 139 assertions ผ่าน**, typecheck ผ่าน. **ยังไม่มี Astra review, web export ใหม่ หรือ actual browser/iPhone receipt สำหรับ slice นี้**

ช่องว่างที่ทราบ: OSC combined color queries (`?;?`) และ OSC4 palette query ยังอาจให้ xterm ส่งคำตอบซ้ำ; `isParserQuery` TS กับ embedded JS ซ้ำกัน; ให้ตรวจ/แก้จาก installed xterm source และทดสอบ actual document ไม่ใช่เทียบ helper ที่ mirror กัน. Mac `apps/macos/src/terminal.ts` ยังมี outbound reply regex ซึ่งอาจชน modified F3; ยังไม่ได้แก้. Fresh redraw ไม่ใช่ serialized checkpoint/full scrollback restoration

Mobile Expo54.0.37/RN0.81.5/React19.1. Native project `apps/ios/ios/Caret.xcodeproj` prebuild แล้ว แต่ยังไม่ native compile. Image-size1.2.1 มี local hash-checked bounds backport ใน `apps/ios/scripts/patch-image-size.mjs`; tests ผ่าน แต่ audit ยัง 8 high ตาม version chain. ยังต้อง independent review/upgrade; ห้ามอ้าง clean audit หรือใช้ audit fix --force

## หลักฐานและ runtime ที่ต้องใช้ต่อ

Current OMP:

- patch `patches/omp/0001-caret-rpc-bridges.patch` SHA `0fcaad4b156498a40d8800429ecc84f27fd576e4dfc8f6560150ffcf60a62c8d`
- source tree `8b5cd5168d73b430cd82f38903fb891d3b115ead`
- `dist/omp-standalone/omp` SHA `b10b9f1477f531649d0d91185e1344cda6caf6a177c3335e9cd6b0f7fda8ebef`
- local patched native addon SHA `202ca523958050c214aa9de8c25391b313f1699aacc075f26b9dde8a965041bb`
- portable host SHA หลัง approval fix `cf0fbbb622fe84d94929a0edea1af728523d7695253cd300c77b0737e3b17565`
- `dist/omp/omp` source launcher descriptor ยังเก่า; ใช้ **standalone absolute path** สำหรับ smoke ตอนนี้

Passing receipts ใน `docs/maintenance/evidence/`:

- `omp-native-ast-2026-09-13`: 6 checks, real OMP + simulated editor, ไม่ใช่ Code-OSS Undo
- `omp-native-ast-headless-2026-09-13`: 6 checks, real OMP + real guarded host disk + allow-before-effect
- `omp-native-ast-headless-reject-2026-09-13`: 5 checks, reject แล้ว disk unchanged; discard ผ่าน `write xd://reject`
- `omp-native-editor-2026-09-13`: 6 checks; `omp-native-permission-2026-09-13`: 6 checks
- `omp-virtual-ui-2026-09-13`: 14 checks บน SHA ล่าสุด. เคย timeout raw-process exit ตอนรันหลาย smoke พร้อมกัน; rerun แยกผ่าน. รัน raw UI smoke แยก อย่ากลบ failure ด้วย timeout โดยไม่วินิจฉัย
- `portable-runtime-2026-09-13`: 5 checks, ล่าสุด UTC20:25:15, host SHA ข้างต้น
- Hosted relay synthetic roundtrip/same-id-once/revoked-cached401 ผ่านก่อนหน้า; ไม่ใช่ cellular/iPhone proof

ทั้งหมดข้างต้นใช้ isolated fixtures/scripted local model; **ไม่มี paid model calls**

Tests ล่าสุดอื่น: root adapter/host/relay/Mac **147 pass / 627 assertions**; OMP AST/editor **42 pass / 147 assertions**; host disk **9/35**; root/OMP typechecks ผ่าน; repo validator `CI-OK parents=198 ui=75 children=129 lock-shas=10`. Rust AST13 tests/check/format และ pi-edit suites ผ่านก่อนหน้า. `/tmp/caret-*-tests.log` เป็น log ชั่วคราว; durable receipts สำคัญกว่า

## ขั้นถัดไปที่ควรทำตามลำดับ

1. Review mobile terminal slice + service `apply_disk` approval + image parser backport. แก้ OSC query/Mac key ambiguity ที่กล่าวไว้ แล้วทดสอบ behavior/recovery จริง. ห้ามนับ “fresh redraw” ว่า checkpoint สมบูรณ์
2. ใช้ `scripts/mobile-terminal-browser-smoke.ts` เปิด local sandbox iframe ของ real bundled xterm: ปุ่ม replay/live/status-queries และ log renderer messages. **สร้าง script แล้ว แต่ยังไม่ได้เปิด browser/ไม่มี UI receipt**. Server sessionนี้ปิดแล้ว (เดิม PID24278/port60482; อย่า reuse port/PID). ใช้ CUA browser tools ที่มีจริง; ไม่เริ่ม side-channel driver. ตรวจ replay/live/query zero synthetic input/modified F3 แล้วบันทึกหลักฐานอย่างจำกัดว่า desktop browser ไม่ใช่ iPhone
3. Mobile tests/typecheck และ web export ใหม่หลัง fixes. จากนั้นดำเนิน G1 native create/delete/move/untitled parity + O01–O18 per-feature conformance, G2 durability/migration/login-host, G3 full Mac UI/UX/Undo/a11y/performance ตามแผน. การมี 42 RPC names หรือเปิด TUI ได้ไม่ปิด conformance rows
4. Personal/own-use: ข้าม Keychain ด้วย `--password-store=basic` / packaged `argv.json` แล้วตรวจ packaged Caret UI; rebuild package ให้ตรง runtime ล่าสุดก่อน acceptance. ใช้ private fixture/profile และตั้ง `caret.hostStateDir` ใน VS Code user settings จริง — env `CARET_STATE_DIR` อย่างเดียวไม่เปลี่ยน extension descriptor path. ห้ามไปใช้ default user host เป็น fixture
5. ทำ G4 physical iPhone/cellular/background/restart/revoke และ G5 E1–E4/installer/update/migration เมื่อ prerequisite พร้อม. **Limiter folder / E3 DAW ไม่จำเป็น**. ยังมีงานโค้ดที่ไม่ขึ้นกับ prerequisite ให้ทำต่อ ไม่หยุดถาม “continue?” หลังแต่ละ slice

คำสั่งสำคัญ (cwd `/Users/pond/caret`):

```sh
/Users/pond/.bun/bin/bun run test
/Users/pond/.bun/bin/bun run typecheck
/Users/pond/.caret-tools/node-v24.18.0-darwin-arm64/bin/node scripts/ci-validate.mjs
CARET_OMP_BINARY=/Users/pond/caret/dist/omp-standalone/omp /Users/pond/.bun/bin/bun scripts/omp-native-ast-smoke.ts
# เพิ่ม --headless หรือ --headless --reject สำหรับอีกสอง fixture
CARET_HOST_NODE=/Users/pond/.caret-tools/node-v24.18.0-darwin-arm64/bin/node /Users/pond/.bun/bin/bun scripts/build-caret.ts --portable --desktop
/Users/pond/.bun/bin/bun scripts/portable-runtime-smoke.ts
```

Mobile: cwd `apps/ios`, `bun run test`, `bun run typecheck`, `bun run export:web`. OMP: cwd `upstream/omp/packages/coding-agent`, `bun run check:types` และ `bun test test/caret-ast-editor.test.ts test/tools/ast-edit.test.ts test/caret-editor-routing.test.ts test/caret-editor-bridge.test.ts`

ถ้าแก้ OMP source ต้อง export **ทั้ง tracked diff และ allowed untracked TS files** กลับ patch, update manifest SHA แล้ว `bun scripts/prepare-omp-runtime.ts --standalone`; script ตรวจ full source tree ด้วย temporary git index ก่อน/หลัง build. ห้ามแก้ source แล้วใช้ receipt/hash เก่ารับรอง. Runtime/toolchain แยกใน `/Users/pond/.caret-tools`; Rust `CARGO_HOME=.../cargo`, `RUSTUP_HOME=.../rustup`, nightly2026-08-08; ไม่เปลี่ยน global OMP/cache/PATH

## External gates / ข้อควรระวังที่ยังมีผล

- macOS Keychain: UI เคยค้างจริงใน `SecItemCopyMatching`. Personal/own-use **ข้าม Keychain** ด้วย Code-OSS `password-store=basic` (ไม่ mock Keychain, ไม่กด SecurityAgent แทน). ตรวจ UI หลัง launch-caret-personal / argv.json ก่อนนับ packaged gate
- CUA เคยปฏิเสธ Codex `com.openai.codex`; อย่า bypass ไปอ่านแอปเพื่อ reference. ใช้ official public refs/ตรวจแอป Caret ของเรา
- มี CommandLineTools แต่ไม่มี Xcode/iOS SDK/device tooling. ผู้ใช้ไม่ต้องการ limiter path/DAW. ไม่อ้าง web export เป็น native acceptance
- Aetheria path ที่ทราบ `/Users/pond/LLM Projects/aetheria`, Cedia `/Users/pond/LLM Projects/cedia`; ไม่แก้สองโปรเจกต์นั้นโดยพลการ. Limiter path/DAW ยังต้องได้ข้อมูล
- Default user host PID69530 ยังทำงาน ณ handoff; ไม่ได้หยุด/ใช้เป็น fixture. Recheck PID/identity ทุกครั้งก่อน action อย่า kill ตามเลขเก่า
- Global `/Users/pond/.local/bin/omp` และ `~/.omp/natives/18.1.18/` ไม่ถูกแทนที่; preserve เช่นเดียวกับงาน dirty/untracked ทั้งหมด
- Apple signing เป็นขั้นสุดท้ายตามข้อกำหนดเดิม. ไม่มี commit/push/deploy/purchase/notarization ในรอบนี้

**สถานะรวม: ยังไม่เสร็จ G1–G5. ส่งต่อเพื่อทำต่อทั้งแผน ไม่ใช่ประกาศ release ready.**
