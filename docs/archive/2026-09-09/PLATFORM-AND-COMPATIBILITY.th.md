# Caret — แพลตฟอร์มและ compatibility gates

สถานะทั้งหมดเป็น planned targets ไม่ใช่รายการ binary ที่ build ผ่านแล้ว ผูกกับ IDE/MOB/LOC requirements และ Q04/Q06/Q10 ของ [roadmap](ROADMAP-AND-ACCEPTANCE.th.md)

## เป้าหมายแพลตฟอร์ม

| Platform | Architecture / รูปแบบที่ต้องประเมิน | Release evidence |
|---|---|---|
| macOS desktop | Apple Silicon arm64 และ Intel x64; app bundle/installer ตาม upstream ที่ pin | launch, terminal/PTY, shell env, keychain, file permissions, signing/notarization, update/rollback |
| Windows desktop | x64 และ arm64 ตาม upstream/toolchain ที่รองรับ; user/system installer และ portable target | installer scope, paths/case/CRLF, PowerShell/PTY, credential store, signature/update, WSL interoperability |
| Linux desktop | x64 และ arm64 ตาม native dependencies; deb/rpm/archive distribution targets | baseline glibc, keyring, sandbox, terminal/PTY, X11/Wayland, package upgrade/uninstall |
| iPhone/iPad | native SwiftUI/UIKit; iOS/iPadOS 26+ เป็น reference baseline ของ Cursor ณ วันที่ตรวจ | real-device keyboard/safe areas, split layouts, voice/annotation/Pencil, APNs/Live Activities, background/reconnect |
| Android | responsive web/PWA baseline; native track ยังไม่มี reference baseline ที่ตรวจได้ | installable surface, keyboard/back navigation, file/image input, reconnect, notifications ตาม browser support |
| Web desktop/mobile | agent/review/setup/admin surfaces ตาม UI-SPEC | browser compatibility matrix, auth/deep link, accessibility, file upload, cache eviction, offline draft |

Cursor iOS baseline และ Android availability อ้างอิง [mobile docs](https://cursor.com/docs/cloud-agent/mobile) ส่วน architecture/package rows ของ Caret เป็นเป้าหมายที่เสนอ ต้องเทียบ [Code - OSS source/build](https://github.com/microsoft/vscode) revision ที่ pin ก่อนประกาศ support

Minimum desktop OS versions, browser versions และ Linux distributions ต้องล็อกใน M0/M1 จาก upstream/native dependencies และเครื่องทดสอบจริง ไม่เดาเลขเวอร์ชันหรือประกาศว่ารองรับ OS เก่าทั้งหมด หาก architecture ใดทำไม่ได้ต้องเปิด compatibility gap พร้อมทางออก ไม่ตัดทิ้งจากคำว่า desktop ทุกระบบโดยเงียบ ๆ

## Extension และ developer workflows

Code - OSS extension host compatibility ไม่ได้ยืนยันสิทธิ์ใช้ทุก extension/service ใน Microsoft distribution ใช้ Open VSX หรือ permitted VSIX ตาม [Open VSX project](https://github.com/eclipse-openvsx/openvsx) และตรวจ license ของ artifact จริง ห้ามนำ marketplace/update endpoint ของผลิตภัณฑ์อื่นมาเป็นค่าของ Caret โดยไม่ได้ตรวจสิทธิ์

| Workflow ที่ต้องครอบคลุม | สิ่งที่ต้องบันทึกก่อน release |
|---|---|
| TypeScript/JavaScript/HTML/CSS/JSON | language service, syntax, navigation/refactor, formatter, diagnostics, debugger และ source maps |
| Python | interpreter/env selection, language server, notebooks, test discovery/debug และ permitted extension choice |
| Go / Rust | toolchain discovery, language server, formatter, debugger, test tasks |
| Java / C# / C/C++ | language server/runtime/debug adapter และ license/architecture ของแต่ละชิ้น; ไม่มี package เดียวรับรองทุกภาษา |
| Notebook/data | kernel discovery, output rendering/trust, large outputs, interrupt/restart และ environment |
| Git | staging/partial staging, merge conflicts, worktrees, submodules, signing และ credential helper |
| Remote | SSH/containers/WSL ตาม source/extension ที่ใช้ได้; agent remote control เป็นคนละ capability กับ remote extension host |
| Extension ecosystem | install/update/disable/uninstall, profiles, extension settings, webviews, native modules, extension host crash/restart |

รายการข้างบนเป็น verification scope ไม่ใช่การระบุว่าทุกภาษาต้องมี bundled extension Caret ควรมี setup ที่แนะนำ artifact ที่ตรวจแล้ว โดยการเลือกแต่ละรายการบันทึก extension ID, source URL, version/hash, license, distribution permission, OS/CPU, runtime dependency, test fixture และ fallback หากยังไม่ตรวจให้เป็น pending ห้ามให้สถานะ compatible จากการติดตั้งผ่านอย่างเดียว

## Matrix dimensions ที่ห้ามลดเหลือ smoke test เดียว

- ทุก desktop OS family: light/dark, default/custom scaling, keyboard/IME ไทยและอังกฤษ, accessibility, multi-window และ restore
- Native modules: build/run per CPU; cross-compilation output ไม่เท่ากับทดสอบ runtime บน target
- Host/client combinations: มือถือหรือ web ควบคุม macOS/Windows/Linux ที่เปิดอยู่; path/terminal semantics แสดงตาม host
- UI size classes: viewports และ states ตาม UI-SPEC รวม keyboard open, long filenames, long Thai text, empty/error/loading/offline
- Release migration: clean install, upgrade จากรุ่นก่อน, interrupted update, rollback และ persisted history schema
- Recovery: engine/daemon/editor crash, expired credentials, disk full, network switch, revoked device และ stale operation

## Distribution และข้อมูลของผู้ใช้

Caret เป็นเจ้าของ product identifiers, protocol/deep-link scheme, data directories, signing identity และ update channels ตั้งแต่ M1 การ import settings/keybindings/extensions จาก editor เดิมต้องเป็น read-and-copy ที่ผู้ใช้เลือก มี preview/dry run และไม่ทับข้อมูลของแอปต้นทาง

กำหนด stable/preview channels, installer provenance/checksum, dependency/NOTICE manifest, update signature verification, migration/backup policy และ crash log redaction ก่อน M7 การมี build local ไม่ทำให้ release-ready; iOS push/signing และ cloud credentials เป็น setup gates แยกต่างหาก

ไม่มี platform build, signing, device tests หรือ extension installation เกิดขึ้นในรอบ planning นี้
