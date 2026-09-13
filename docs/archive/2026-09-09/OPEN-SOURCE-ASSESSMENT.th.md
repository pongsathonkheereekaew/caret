# Caret — เลือก open source ให้คุ้มกับเป้าหมาย

ตรวจ 9 กันยายน 2026 • ข้อสรุปสำหรับการวางแผนเท่านั้น ยังไม่ได้ติดตั้ง fork หรือ benchmark

## คำตัดสิน

เลือก **Code - OSS fork + Paseo daemon/protocol ที่แยกขอบเขตชัด + Codex และ OpenCode engines + Caret UI** เป็นแผนหลัก ปรับจากแผนเดิมที่เขียน control daemon ใหม่ทั้งหมด เหตุผลคือผู้ใช้ต้องการทั้ง desktop/mobile ใช้สมาชิกเดิม และไม่มี deadline จึงควรลดงาน infrastructure ซ้ำ แต่ลงทุนกับ UI และความถูกต้องที่เป็นเป้าหมายจริง

Paseo เป็น orchestration host ไม่ใช่ model และไม่แทน Code - OSS; Codex/OpenCode เป็นเจ้าของ agent loop ของแต่ละ run ส่วน Go/OpenRouter เป็น provider access ไม่ใช่แอปที่ต้อง fork ทั้งตัว

ขอบเขตการ reuse ที่เลือก: `packages/server`, `packages/protocol`, `packages/client` และพิจารณา `packages/relay` ของ [Paseo](https://github.com/getpaseo/paseo/blob/main/docs/architecture.md) ผ่าน adapter ที่ Caret เป็นเจ้าของ ไม่ยก desktop shell หรือ mobile UI มาทั้งชุด เอกสาร [SDK](https://paseo.sh/docs/sdk/quickstart) รองรับสร้าง session, events, permissions และ reconnect; API จริงของ revision ที่เลือกต้องตรวจอีกครั้งก่อน implementation

## วิธีตัดสินความคุ้ม

ประเมินห้ามใช้ดาว GitHub เป็นตัวแทนคุณภาพ: (1) ตรง requirement (2) ลดงานจริงเท่าไร (3) การแยกใช้และทดสอบ (4) maintenance/upstream drift (5) license ของไฟล์ที่ใช้ (6) ภาระ run/deploy (7) ค่าเสียโอกาสต่อความเหมือนของ UI

คะแนนเป็น judgement 1–5 ไม่ใช่ benchmark; 5 = เหมาะมาก ใช้เพื่อเปรียบเทียบทางเลือกทั้งระบบ

| ทางเลือก | ตรง desktop | reuse งานข้ามอุปกรณ์ | ควบคุมหน้าตา | ดูแลระยะยาว | คำตัดสิน |
|---|---:|---:|---:|---:|---|
| Code - OSS + daemon ใหม่ทั้งหมด | 5 | 1 | 5 | 3 | ทำได้ แต่เสียเวลาสร้าง session/transport ซ้ำ |
| Code - OSS + Paseo components + UI ใหม่ | 5 | 5 | 5 | 4 | เลือก; แยก protocol และเพิ่ม conformance tests |
| Fork Void ทั้งตัว | 4 | 1 | 4 | 1 | ไม่เลือกฐานหลัก; upstream deprecated |
| Code - OSS + Cline extension ทั้งตัว | 4 | 2 | 2 | 4 | agent พร้อมมาก แต่ UI ไม่ตรงและซ้ำ engines ที่มี |
| Code - OSS + Happy ทั้งชุด | 4 | 4 | 2 | 3 | mobile พร้อม แต่ต้องเปลี่ยน UI/session model มาก |
| Theia/code-server แทน desktop | 2 | 3 | 3 | 4 | ไม่ตรงข้อกำหนด fork Code - OSS desktop แบบ Cursor |

## โครงการหลักและระดับการใช้

สถานะ maintenance ตรวจทั้ง GitHub API และ README: `archived=false` ไม่ยืนยันว่ามีผู้ดูแล งานยกไฟล์ต้องเก็บ source commit/license/NOTICE และรายการแก้ไข ตรวจ license ราย component อีกครั้งก่อนนำเข้าจริง

| โครงการ / source | สิ่งที่ได้และสถานะที่ตรวจ | ความคุ้ม / สิ่งที่ต้องทำเพิ่ม | ระดับที่เลือก |
|---|---|---|---|
| [Code - OSS](https://github.com/microsoft/vscode) | MIT; editor/workbench/extension host; repo ไม่ archived | ลดงาน IDE มากที่สุด; ต้องสร้าง branding, release/update และ Caret surfaces | **Fork ฐาน desktop** |
| [VSCodium](https://github.com/VSCodium/vscodium) | MIT; build/release scripts; README ระบุเป็นงาน build binaries ไม่ใช่ editor fork | ประหยัด packaging research; ไม่ได้ให้ AI/UI ของ Cursor และห้ามอาศัย update servers ของ VSCodium | **Adapt scripts เฉพาะส่วน** |
| [Paseo](https://github.com/getpaseo/paseo) | LICENSE ปัจจุบันระบุ Apache-2.0 พร้อม third-party exceptions; มี daemon/client/protocol/relay | ตรง multi-host/subscription/mobile มาก; pin revision และชดเชย missing capabilities; main ที่อ่านเป็น 0.8 beta ไม่ถือว่า stable | **Adapt backend/protocol** |
| [Codex](https://github.com/openai/codex) | Apache-2.0; [app-server](https://learn.chatgpt.com/docs/app-server) สำหรับ rich clients | ใช้สมาชิกผ่าน official auth; ไม่ได้ให้ Cursor Tab หรือ Composer weights | **Run official engine; thin adapter** |
| [OpenCode](https://github.com/anomalyco/opencode) | MIT; [server API](https://opencode.ai/docs/server/) และ provider ecosystem | ใช้ Go/OpenRouter ผ่าน engine ที่มีอยู่แทนสร้าง loop ใหม่; ติดตาม schema/model support | **Engine ตัวที่สอง** |
| [OpenCode Go](https://opencode.ai/docs/go/) | บริการสมาชิกพร้อม API สำหรับ coding clients | ใช้ access ที่ผู้ใช้มี; ต้องส่ง client/session identity ตาม docs ไม่ใช่ OSS model weights | **Provider** |
| [OpenRouter](https://openrouter.ai/docs/quickstart) | API service; model capabilities ต่างกัน | route model/task และรายงาน cost; ไม่ใช่สิทธิ์ inference แบบไม่จำกัด | **Provider** |
| [Void](https://github.com/voideditor/void) | Apache-2.0 สำหรับโครงการ; README deprecated, API archived=true | EditCodeService, buffer sync, build/CSP/IPC เป็น reference มีประโยชน์; code เก่าทำให้ upstream merge แพง | **Reference/เลือกยก module หลังประเมิน** |
| [Continue](https://github.com/continuedev/continue) | Apache-2.0; README ระบุ no longer actively maintained และ final 2.0 release แม้ API ยังไม่ archived | autocomplete/context slicing เป็น reference; ถ้ายกมาใช้ Caret รับผิดชอบ maintenance และ tests เอง | **Reference เท่านั้นใน baseline** |
| [Cline](https://github.com/cline/cline) | Apache-2.0; SDK/CLI/extension; README แยกส่วน JetBrains ที่ไม่ได้ open-source | เป็น fallback engine หาก Codex/OpenCode ขาด capability; ไม่เปิดสาม loops ซ้อนกัน | **สำรองพร้อมเงื่อนไข** |
| [Roo Code](https://github.com/RooCodeInc/Roo-Code) | Apache-2.0; archived; README ระบุ shut down May 15 | modes มีประโยชน์เชิง reference แต่ไม่เหมาะเป็น dependency ที่รอ fixes | **ไม่เลือกฐาน** |
| [Happy](https://github.com/slopus/happy) | MIT; Expo mobile/web, encrypted sync, Codex wrapper | ประหยัด native+web scaffold หากยอมเปลี่ยน UI; ไม่ช่วย Code - OSS/inline edit และ protocol ซ้ำ Paseo | **เปรียบเทียบ/สำรอง transport** |
| [HAPI](https://github.com/tiann/hapi) | AGPL-3.0; hub/PWA/หลาย agent; native SwiftUI/Kotlin ยัง in development ตาม README | ตัวอย่าง native contract เหมาะ; เพิ่มข้อผูกพันและ backend ซ้ำ ถ้าเลือกต้องทบทวน license ของ distribution ที่จะทำ | **Reference; ไม่ merge โดยปริยาย** |
| [Happy Agent](https://github.com/slopus/happy-agent) | MIT; unified harness ใช้ provider access เดิม | น่าสนใจ แต่เป็นอีก runtime; docs ของโครงการไม่แทนการตรวจ provider authorization | **รอดู ไม่เพิ่ม baseline** |
| [OpenHands](https://github.com/OpenHands/OpenHands) | MIT ที่ root; ต้องตรวจ enterprise/component exceptions | มี cloud agent foundation แต่ Python/runtime/control stack เพิ่ม; ใช้เป็น reference sandbox/cloud execution | **Reference ใน cloud phase** |
| [Goose](https://github.com/aaif-goose/goose) | Apache-2.0 จาก metadata; agent อีกชุด | ไม่ได้ปิด desktop/mobile gap เพิ่มเหนือ engines ที่เลือก | **ไม่เลือกฐาน** |
| [Theia](https://github.com/eclipse-theia/theia) | EPL-2.0; desktop/cloud IDE framework | ดีสำหรับ IDE framework แต่ผิดฐานที่ผู้ใช้ต้องการและเพิ่มงานเลียน workbench | **ไม่เลือก** |
| [code-server](https://github.com/coder/code-server) | MIT; VS Code ผ่าน browser | ใช้ remote full editor ได้ถ้าต้องการเพิ่ม; Cursor mobile baseline ไม่ใช่ full IDE | **ไม่บังคับใน mobile** |

## ส่วนประกอบเฉพาะทาง

| ส่วน | เลือก / alternative | ความคุ้มและขอบเขต |
|---|---|---|
| Extensions registry | [Open VSX](https://github.com/eclipse-openvsx/openvsx) + permitted VSIX | ใช้ public registry ก่อน ไม่ตั้ง registry service เอง; extension license/availability ยังแยกจาก engine compatibility |
| Editor/diff/terminal | ของ Code - OSS ที่มีอยู่ | ไม่สร้าง Monaco ซ้อนใน editor เดิม; web/native review ใช้ data contract เดียวกันแต่ renderer ต่างกัน |
| Exact search | ripgrep ที่ upstream ใช้; [Tree-sitter](https://github.com/tree-sitter/tree-sitter) เมื่อจำเป็นต้อง chunk AST | ไม่อ้างว่าเร็วเท่า Cursor Instant Grep; engine search เพียงพอให้ไม่ทำ index ซ้ำก่อนวัด |
| Semantic index | local persisted index; [Qdrant](https://github.com/qdrant/qdrant) เฉพาะเมื่อ scale ต้องใช้ | แยก index cache จาก source of truth; ยังไม่ต้องเพิ่ม vector DB server ให้โปรเจกต์ส่วนตัว |
| Completion | [Tabby](https://github.com/TabbyML/tabby) เป็น server candidate; Continue/Void เป็น implementation reference | Tabby Apache-2.0; ต้องวัด FIM/model/hardware; autocomplete ไม่เท่ากับ cross-file next-edit ของ Cursor |
| Local inference | [llama.cpp](https://github.com/ggml-org/llama.cpp) | runtime MIT; weights มี license แยก ไม่ดาวน์โหลด model ขนาดใหญ่ใน planning |
| Voice transcription | OS speech หรือ [whisper.cpp](https://github.com/ggml-org/whisper.cpp) บน worker | ไม่สมมติว่า Codex/Go subscription รวม speech; เทียบไทย/อังกฤษและ latency ภายหลัง |
| Browser tools | [Playwright](https://github.com/microsoft/playwright) | Apache-2.0; reusable navigation/screenshot/testing; element-to-source mapping และ annotation UX ยังต้องทำ |
| iOS/iPadOS UI | Native SwiftUI/UIKit + [ActivityKit](https://developer.apple.com/documentation/activitykit), [PencilKit](https://developer.apple.com/documentation/pencilkit) | เลือกเพราะ fidelity สำคัญกว่า share UI code; framework Apple ไม่ใช่ OSS artifact ที่นำไปแจกเอง |
| Mobile alternative | [React Native](https://github.com/react/react-native)/[Expo](https://github.com/expo/expo) | ประหยัดเมื่อทำ Android native พร้อมกัน; ไม่เลือกเพียงเพราะ Paseo/Happy ใช้อยู่; ไม่มีเหตุผลให้เปลี่ยน desktop เป็น Expo |
| Private access | Paseo relay protocol ที่ตรวจ license/deploy ได้; direct private connection | [Paseo connectivity](https://paseo.sh/docs/connectivity) รองรับ relay/SSH/Tailscale; relay ≠ cloud compute และ APNs push ต้องมี server path แยก |
| VPN ทางเลือก | [Tailscale client](https://github.com/tailscale/tailscale), [Headscale](https://github.com/juanfont/headscale) | clients/coordinator/service terms คนละเรื่อง; ใช้เมื่อช่วย networking ไม่เพิ่ม VPN stack ให้ผู้ใช้โดยไม่จำเป็น |
| Cloud isolation | VM ต่อ job; [Firecracker](https://github.com/firecracker-microvm/firecracker) เฉพาะ Linux/KVM ที่เหมาะ | อย่าสร้าง microVM platform ตั้งแต่ local phase; container บน shared host ไม่เท่ากับ VM isolation |
| Origin-like Git hosting | [Gitea](https://github.com/go-gitea/gitea) service ผ่าน API/Git | ลดงาน repo/PR/permissions; UI ของ Caret ทำเอง; GitHub two-way PR sync และ forge-local branches ต้อง custom adapter ไม่ได้มาฟรีจาก Git mirror |
| Enterprise identity | integration กับ IdP ภายนอกตามมาตรฐาน | ไม่สร้าง IdP ใหม่; local personal milestone ไม่ต้องรัน identity service แต่คง enterprise requirements ใน late track |

## งานที่ยังคุ้มจะทำเอง

- Caret Editor/Agents Window presentation และ interaction; logo/brand, model picker, context tray และ rich composer
- Mapping provider-native state → Caret state โดยรักษาข้อมูลที่ไม่รองรับไว้ ไม่ทำให้เหลือ chat text อย่างเดียว
- Versioned editor buffer bridge, hunk review/undo และ cross-device stale approval handling
- Browser Design Mode และ visual-to-source mapping; แสดง confidence เมื่อไม่มี source map ไม่อ้างว่า DOM node ทุกตัวชี้ไฟล์ได้แม่น
- Cross-file next-edit ranking/portal; completion pipeline ต้องมี benchmark แยกจาก agent quality
- iOS/iPad layouts และ accessibility; OSS app เดิมไม่ใช่ภาพอ้างอิงของ Cursor
- Cloud lifecycle, semantic handoff, PR automation, Origin-like synchronization และ capability gaps ที่ daemon ไม่ได้มี

## ต้นทุนและ fallback ที่ตัดสินไว้

Reuse ประหยัดมากใน editor, agent loops, cross-device transport; ประหยัดปานกลางใน autocomplete/indexing; ประหยัดน้อยใน exact UI และ proprietary-model quality ไม่ให้ตัวเลขเปอร์เซ็นต์หรือ ETA ที่ไม่มีการวัด

ก่อน implementation แต่ละส่วน ให้ประเมิน `ต้นทุนรวม = integration + gap work + verification + upgrade maintenance + operational cost` หากการปรับ Paseo ต้องแก้ core lifecycle กว้างหรือไม่สามารถรักษา event/permission contract ให้ใช้ adapter ตรงกับ Codex/OpenCode และเขียนเฉพาะ coordinator ที่ขาด **ไม่ rewrite agent loop ทั้งหมด**

Paseo current/main/0.8 beta อาจต่างกัน: เลือก release ที่มี capability ที่ต้องใช้และ pin commit; ถ้า beta จำเป็นให้ติดป้าย version support ในแผน release ห้ามผสม client/protocol/server คนละ revision หรือเอา README ของ main รับรอง release เก่า

ใบอนุญาต software ไม่ครอบคลุม brand, hosted account, API quota, model weights หรือ store signing การเลือกส่วนประกอบข้างต้นเป็น architectural decision ไม่ใช่ผลทดสอบว่ารวมกันแล้วครบ Cursor
