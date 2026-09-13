<a id="synara-v5"></a>

## L. Synara adoption — UI ตั้งต้นและส่วนระบบที่นำมาใช้ได้

**การตัดสินใจฉบับ 5 · 9 กันยายน 2026:** ผู้ใช้เลือก UI ของ [Synara](https://github.com/Emanuele-web04/synara) เป็นฐานเริ่มต้น เปลี่ยน initial visual target จากการสร้าง Cursor UI ใหม่ทั้งหมดเป็น Synara-derived UI ภายใต้แบรนด์ Caret เป้าหมายฟีเจอร์ Cursor เดิมยังอยู่; การทำ Cursor visual 1:1 เป็น refinement track ภายหลัง ไม่เรียก Synara appearance ว่า Cursor pixel parity

ส่วน L ชนะข้อเลือก UI/backend เดิมใน A–K ที่ขัดกัน Source snapshot ที่อ่าน: `59db80a170a0abe7c8710ae247f15097ec46cd68` บน main; package manifests ระบุ 0.8.3 ไม่ได้ยืนยันว่าเป็น published stable release GitHub repo ไม่ archived และ README ระบุ early-stage ตรวจแบบ read-only จาก docs, manifests, tree และ source บางเส้นทาง ไม่ clone/install/build ไม่อ่าน credentials ไม่ใช้ inference

### L1. สิ่งที่เลือกและผลต่อ Code - OSS

- **เลือกใช้:** UI components/theme/layout ของ Synara สำหรับ Caret Agents Window, chat/approval/model pickers, review และ workspace resource panels
- **ยังคง:** Code - OSS fork เป็น editor/workbench/extension host/debugger/LSP และเป็น desktop host เดียวของ Caret ไม่เอา Electron app ของ Synara มาแทน Code - OSS
- **แนะนำให้ประเมินเป็น backend หลักก่อน:** Synara orchestration/contracts + Codex/OpenCode adapters เพราะมีเส้นทางเดียวกับ UI ที่เลือกอยู่แล้ว
- **ลด Paseo เป็น fallback:** ไม่รัน Synara server และ Paseo เป็นเจ้าของ session/worktree/history พร้อมกัน เลือกหนึ่งชุดหลัง conformance spike; ค่อยหยิบ transport concept หรือ module เฉพาะช่องว่างโดยไม่สร้าง owner ซ้ำ

นี่เป็น engineering recommendation จาก code/document inspection ไม่ใช่ผลพิสูจน์ว่าพอร์ตง่ายหรือประหยัดกี่เปอร์เซ็นต์ UI ของ Synara ผูกกับ shared contracts, query/stores, Effect RPC และ native bridges จึงต้อง adapt เป็นชุด component-boundary ไม่ใช่ copy JSX/CSS ไม่กี่ไฟล์แล้วเสร็จ

### L2. Reuse matrix — นอกจาก UI

ทุกแถว “candidate” หมายถึงพบ implementation/docs และเหมาะตรวจต่อ ยังไม่ได้ run tests พิสูจน์ว่าใช้กับ Caret ผ่านแล้ว Source links pin revision เดียวกัน

| ส่วนที่ใช้ได้ | Source ที่ตรวจ/ตำแหน่ง | ประโยชน์ต่อ Caret | คำตัดสิน / งานที่ยังต้องทำ |
|---|---|---|---|
| Chat/composer/approval UI | `apps/web/src/components/ChatView*`, `ComposerPromptEditor`, `chat/ComposerPendingApprovalPanel`, picker/queue components | ลดงาน text/context chips, pending questions/approvals และ streaming task surface | **เลือก adapt**; ผูก effective Caret permissions/context keys ไม่รับ upstream defaults ทั้งหมด |
| Themes/layout/density | `apps/web/src/index.css`, `theme/*`, Sidebar, split views | มี semantic CSS tokens, theme/density/font controls และ workspace navigation | **เลือก adapt**; scope CSS ไม่รั่วสู่ Code - OSS workbench; rebrand ไม่ยก logo |
| Provider adapters | `provider/Services/ProviderAdapter.ts`, `Layers/CodexAdapter.ts`, `Layers/OpenCodeAdapter.ts` | start/resume/interrupt/steer/approval/user input/capabilities และ normalized runtime events | **candidate สูง**; ให้ engines ดูแล auth; Go/OpenRouter ตรวจผ่าน OpenCode config ของผู้ใช้; compatibility ต้องทดสอบจริง |
| Durable orchestration | `orchestration/Layers/OrchestrationEngine`, reactors และ runtime ingestion | intents/events/read models ช่วย session lifecycle และ recovery | **candidate สูง**; เลือกเป็น owner เดียว ถ้าผ่าน control-path/replay tests; map Caret IDs ไม่สร้าง orchestration ซ้อน |
| Persistence และ reconnect | `persistence/*`, `wsTransport.ts`, thread-detail cursors | SQLite projections, snapshots/replay, sequence fences, drafts/layout แยก client state | **candidate สูง**; retain compatible contract revisions; native Swift/Kotlin ต้องมี facade ที่ใช้ได้ ไม่ลาก TypeScript runtime ไปฝังมือถือ |
| Git/worktrees/handoff | `managedWorktrees.ts`, `git/*`, orchestration services | ช่วย isolated tasks/branch/handoff/review workflow | **candidate สูง**; verify dirty worktree/branch collisions/submodules/cleanup และ multi-root semantics |
| Checkpoint/diff | `checkpointing/Layers/CheckpointStore.ts`, diff panels | มี hidden Git-ref capture/restore และ diff queries | **adapt หลังตรวจ**; implementation นี้แตะ Git/filesystem ไม่เท่ากับ Cursor checkpoint storage ภายใน; ต้อง reconcile Code - OSS unsaved buffers และ preserve unrelated changes |
| Terminal lifecycle | `terminal/*`, desktop supervision, xterm UI | PTY/stream/resize/process cleanup และ task terminals | **candidate เฉพาะ agent task terminals**; ไม่แทน Code - OSS integrated terminal ทั้งระบบและไม่สร้าง process owner ซ้ำ |
| Browser/design tools | `apps/desktop/src/browserAutomation/*`, `browserAnnotations/*` | navigation/actionability/screenshot/console/network/semantic snapshot/annotations มี modules และ tests | **candidate สูง**; Electron host bridges ต้องพอร์ตเข้า Code - OSS main-process boundary; no broad renderer privileges |
| Automations | `automation/Layers/*`, repository/migrations | scheduler/run lifecycle/outcomes ที่เชื่อม task | **candidate ใน M9**; ตรวจ timezone/dedup/retry/goal-completion และ restart; local scheduler ไม่เท่ากับ cloud scheduler |
| External MCP | `docs/external-mcp.md`, `externalMcp/*` | paired external clients, scoped project/task access และ revocation | **candidate**; external MCP server ต่างจาก MCP client ที่ Caret ใช้เรียก tools; pairing นี้ไม่ยืนยัน native mobile pairing ครบ |
| Remote web/server mode | `REMOTE.md`, typed HTTP/WebSocket services | ใช้ server เดียวให้ browser บนอีกอุปกรณ์เข้าถึงได้ | **ใช้เริ่ม web-client feasibility**; LAN/Tailnet access ไม่ใช่ native iOS/Android/APNs/relay/cloud compute |
| Test fixtures | adapter/orchestration/transport/browser/worktree tests ใน tree | ลดงานออกแบบ regression cases และแสดง intended invariants | **นำมาประเมินและ adapt คู่ module**; tests มีอยู่ไม่แปลว่าเรา run ผ่านแล้ว |
| Desktop updater/OS glue | `apps/desktop/src/*`, release scripts | reference process supervision, crash recovery และ installer behavior | **reference/selective only**; Caret ใช้ Code - OSS release host ไม่รวมสอง auto-updaters |

[Provider contract](https://github.com/Emanuele-web04/synara/blob/59db80a170a0abe7c8710ae247f15097ec46cd68/apps/server/src/provider/Services/ProviderAdapter.ts), [Codex adapter](https://github.com/Emanuele-web04/synara/blob/59db80a170a0abe7c8710ae247f15097ec46cd68/apps/server/src/provider/Layers/CodexAdapter.ts), [OpenCode adapter](https://github.com/Emanuele-web04/synara/blob/59db80a170a0abe7c8710ae247f15097ec46cd68/apps/server/src/provider/Layers/OpenCodeAdapter.ts), [architecture](https://github.com/Emanuele-web04/synara/blob/59db80a170a0abe7c8710ae247f15097ec46cd68/.docs/architecture.md), [transport](https://github.com/Emanuele-web04/synara/blob/59db80a170a0abe7c8710ae247f15097ec46cd68/.docs/transport.md), [checkpoint implementation](https://github.com/Emanuele-web04/synara/blob/59db80a170a0abe7c8710ae247f15097ec46cd68/apps/server/src/checkpointing/Layers/CheckpointStore.ts), [external MCP](https://github.com/Emanuele-web04/synara/blob/59db80a170a0abe7c8710ae247f15097ec46cd68/docs/external-mcp.md), [remote setup](https://github.com/Emanuele-web04/synara/blob/59db80a170a0abe7c8710ae247f15097ec46cd68/REMOTE.md).

### L3. ข้อที่ไม่ควรยกมาทั้งชุด

1. **Synara file editor ไม่ใช่ VS Code extension host:** source `CodeEditorPane.tsx` ใช้ `@pierre/diffs/edit` / React File renderer จึงไม่แทน Code - OSS debugger/LSP/extensions/dirty models ใช้กับ lightweight web preview ได้ แต่ desktop edits ต้องผ่าน editor bridge ของ Caret [source](https://github.com/Emanuele-web04/synara/blob/59db80a170a0abe7c8710ae247f15097ec46cd68/apps/web/src/components/codeEditor/CodeEditorPane.tsx)
2. **ไม่รับ permission defaults มาเงียบ ๆ:** runtime docs ระบุ Full access เป็น default และ Auto เฉพาะ providers บางตัว Caret ต้องแปลง mode capabilities ไปข้อกำหนด PX-10…13 ไม่ใช้ชื่อ mode เหมือนกันเพื่ออ้าง security semantics เท่ากัน [runtime modes](https://github.com/Emanuele-web04/synara/blob/59db80a170a0abe7c8710ae247f15097ec46cd68/.docs/runtime-modes.md)
3. **ไม่รับ toolchain ทั้ง monorepo โดยไม่วัด:** root ใช้ Effect snapshot packages, patched native TypeScript checker และ Bun/Node versions ที่ระบุ ชิ้นส่วนที่ดูมี dependency coupling จริง Codex/OpenCode adapters มีประมาณ 2,507/4,585 บรรทัด ณ snapshot และ import gateway/runtime helpers หลายตัว จึงไม่ใช่ drop-in adapter สั้น ๆ [manifest](https://github.com/Emanuele-web04/synara/blob/59db80a170a0abe7c8710ae247f15097ec46cd68/package.json)
4. **Native simulator preview ไม่เท่ากับ mobile app:** device/browser helpers มีประโยชน์ต่อ VIS แต่ไม่ปิด MOB/APNs/Live Activities/native bot Android requirements
5. **ยังต้องสร้างหรือประเมินแยก:** Cursor-like Tab/next edit/index quality, full native mobile, cloud jobs/pools/identity, enterprise APIs/policies, Gitea/Origin sync และ Cursor visual refinement ห้ามเปลี่ยนสถานะ requirement เป็น passed เพราะ Synara README มีชื่อฟีเจอร์ใกล้กัน
6. **เก็บ notices ตาม source:** root [LICENSE](https://github.com/Emanuele-web04/synara/blob/59db80a170a0abe7c8710ae247f15097ec46cd68/LICENSE) เป็น MIT มี copyright ของ T3 Tools Inc. และ Emanuele Di Pietro ต้องรักษา notice ที่เกี่ยวข้อง ตรวจ third-party dependencies/assets/fonts เป็นรายส่วนตอนนำเข้า และใช้ชื่อ/icon/update endpoints ของ Caret

### L4. Architecture และ UI adoption path ใหม่

```text
Caret Code - OSS desktop host
  ├─ Native workbench/editor/extensions/terminal ownership
  └─ Synara-derived Agents UI (React, scoped styles, Caret bridge)
          ↓ typed client facade
     Chosen single orchestration backend
       preferred candidate: adapted Synara services/contracts
       fallback: Paseo OR direct engine coordinator
          ↓
       Codex app-server + OpenCode server → Go / OpenRouter
          ↑
     Web client; later native iOS/Android and cloud workers
```

เริ่ม component inventory จาก actual `apps/web` ไม่ใช้ marketing mock components เป็น production app ส่วน Code - OSS desktop ใช้ integrated workbench surface ที่โหลด React bundle และ narrow bridge; feasibility ต้องทดสอบ CSP/module loading/keyboard/focus/browser-host API ก่อนเลือก embedding details สุดท้าย ไม่โหลด Synara Electron main เข้า Electron อีกชั้น และไม่รับ renderer `nodeIntegration` กว้างเพื่อให้ง่ายต่อการพอร์ต

Initial UI acceptance = Synara reference ของ revision ที่ล็อก + Caret identity + requirements ที่ตกลง ภายหลัง Cursor refinement ใช้ separate reference/capture set ตาม G-VIS; initial Synara UI ผ่านไม่ได้แปลว่า Cursor visual gate ผ่าน Counts 198/75 ยังคงเป็น feature/surface coverage targets ไม่ใช่สิ่งที่ Synara ทำครบ

Native mobile เริ่มจาก information architecture/tokens ที่ดัดแปลงได้ของ Synara โดยยังต้องทำ native screen/state behavior ตามข้อกำหนดเดิม การเลือก UI ตั้งต้นครั้งนี้ไม่ยกเลิก mobile หรือ Code - OSS fork และไม่บังคับให้เลียนเว็บ UI ทุก pixel บนมือถือ

### L5. Work packets ที่เปลี่ยนและหลักฐานก่อนเลือก backend จริง

| Packet | งานอนาคต / ผลส่งมอบ | Pass / fallback |
|---|---|---|
| SYN-01 → H01 | pin source/license/dependency closure, UI source map, upstream capture light/dark/density และ required Caret deltas | buildable revision และ source provenance; ไม่มี install/build ในรอบนี้ |
| SYN-02 → H02/H05 | render selected shell/composer/review ใน Code - OSS host ผ่าน bridge; scope styles, keybindings, focus และ lifecycle | ผ่าน editor coexistence; ถ้าคัด full component coupling สูง ให้ยก lower-level components/tokens แล้วประกอบใหม่ |
| SYN-03 → H03 | trace Synara command→engine→event→projection; verify Codex/OpenCode auth/resume/steer/cancel/approval and exact capability matrix | ถ้า phase-critical contracts ผ่านและ patch footprint คุมได้ ใช้ Synara owner เดียว; ถ้าไม่ผ่านเลือก Paseo/direct backend โดยคง UI facade |
| SYN-04 → H04 | safe writes/unsaved Code - OSS models/checkpoints/worktree/approval before side effects | data integrity fixtures ผ่านทั้งหมด; ไม่ใช้ filesystem watcher แทน dirty-buffer reconciliation |
| SYN-05 → H08/H09/H10 | browser bridge, external MCP scope, authenticated reconnect and native-client protocol facade | selected modules ผ่าน tests กับ Caret; raw LAN example ไม่ผ่าน mobile/cloud gate โดยอัตโนมัติ |
| SYN-06 → H11…H16 | re-run relevant upstream module tests + Caret conformance; delete unused providers/duplicate services only after dependency audit | build/release/upgrade evidence; ไม่มีการลด denominator เพราะเลือก UI ใหม่ |

**คำแนะนำสุดท้าย:** ใช้ Synara ให้มากกว่า UI ในส่วนที่เชื่อมต่อกันอยู่แล้วได้คุ้ม โดยเริ่มประเมิน UI + contracts + orchestration + Codex/OpenCode + Git/review เป็นหนึ่ง candidate stack เปรียบเทียบกับค่าใช้จ่ายการต่อ Synara UI เข้ากับ Paseo ก่อนล็อก backend ส่วน Code - OSS editor, native mobile และ cloud parity ยังเป็นงาน Caret ที่ชัดเจน

### L6. Review ของการเปลี่ยนแผน

- User intent: UI ตั้งต้น Synara ถูกเลือกแล้ว; ไม่เริ่มโค้ดในงาน planning นี้
- Simpler architecture: backend owner เดียว แทนการต่อ Synara → Paseo → engines โดยไม่มีเหตุผล
- Supported limitations: source inspection พบ Electron/React/Effect coupling และ permission-default differences; ไม่อ้างว่า fork Synara แล้วได้ VS Code fork หรือ Cursor engine
- Verification: docs/source บางไฟล์ถูกอ่าน ไม่ได้เปิด Synara app/runtime หรือ run tests จึงเป็น reuse assessment ไม่ใช่ compatibility certification

### L7. MCP / Skill / Plugin / SSOT / Remote control - ผลตรวจละเอียดจาก source
**วิธีตรวจรอบนี้:** อ่าน docs และ source ณ revision `59db80a170a0abe7c8710ae247f15097ec46cd68` แบบ read-only ไม่ clone/install/build/run ไม่แตะ credentials ไฟล์ที่อ่านจริงอยู่ใน `/tmp/caret-synara-review` ได้แก่ `docs/external-mcp.md`, `REMOTE.md`, `.docs/transport.md`, `agentGateway/mcpInjection.ts`, `agentGateway/protocol.ts`, `agentGateway/harnessPolicy.ts`, `externalMcp/*`, `provider/skillsCatalog.ts`, `provider/skillPromptInjection.ts`, `provider/Layers/ProviderDiscoveryService.ts`, `components/PluginLibrary.tsx`, `components/settings/SkillsSettingsPanel.tsx`, `components/settings/skillsSettingsModel.ts`, `auth/Layers/*`, `contracts/auth.ts`, `contracts/externalMcp.ts`, `orchestration/Layers/OrchestrationEngine.ts`, `orchestration/Layers/ProjectionPipeline.ts`, `wsSnapshotLiveStream.ts`, `web/wsTransport.ts`, `web/storeProjection.ts`, `web/pairingBootstrap.ts`, `checkpointing/Layers/CheckpointStore.ts` ยังไม่ใช่ compatibility certification

#### L7.1 MCP - มีสองฝั่ง คนละทิศ อย่าสลับกัน

Synara แยก MCP เป็นสองระบบชัดเจน ฝั่งแรกคือ Internal Agent Gateway ให้ provider session ที่รันอยู่ใน task เรียกกลับมาควบคุม Synara ส่วนฝั่งที่สองคือ External MCP ให้ app ภายนอกเครื่องเดียวกันเรียกเข้ามาสร้างและอ่าน task ของ Synara

**ฝั่งที่ 1: Internal Agent Gateway**

- ตำแหน่ง: `apps/server/src/agentGateway/mcpInjection.ts`, `protocol.ts`, `harnessPolicy.ts`
- โปรโตคอลเป็น subset ของ MCP streamable-HTTP แบบ stateless รองรับ `initialize`, `ping`, `tools/list`, `tools/call` ทุก POST ตอบ JSON ครั้งเดียว ไม่เก็บ session ฝั่ง server มี `parseMcpMessage` แยก request/notification/response/invalid รองรับ protocol version `2025-06-18`, `2025-03-26`, `2024-11-05`
- วิธีฉีดเข้า provider ทำที่โมดูลเดียวเพื่อไม่ให้ drift ได้แก่ Codex เป็น TOML `[mcp_servers.synara]` แบบ `url + bearer_token_env_var` ไม่เขียน token ลงไฟล์ บวก `[shell_environment_policy] exclude` กัน token รั่วเข้า subprocess, Claude เป็น HTTP `mcpServers` พร้อม `Authorization`, OpenCode เป็น `type: remote` พร้อมข้อบังคับว่าต้องติดตั้งผ่าน provider process เฉพาะ thread หรือ lock exclusive ตลอด turn, ACP เลือก HTTP ถ้า agent ประกาศ `mcpCapabilities.http` ไม่เช่นนั้นใช้ stdio proxy forward ไป HTTP, Antigravity เป็น plugin config แบบ secret-free ใช้ bootstrap token ครั้งเดียวแล้ว proxy เก็บ bearer ใน memory ไม่ให้ `run_command` สืบทอด
- Authority เป็น thread-scoped บวก caller-turn authority แจก bearer ต่อ thread ส่ง host policy ครั้งเดียวต่อ session ด้วย `takeSynaraHarnessPolicyForProviderSession` ถ้าไม่มี scoped connection จะบอกว่า control ไม่พร้อม ห้ามอ้างว่าสร้างหรือเปลี่ยน resource แล้ว รายชื่อ provider ที่มี gateway control ถูก hardcode เป็น `codex`, `claudeAgent`, `antigravity`, `cursor`, `grok`, `droid`, `devin`, `opencode`, `pi`
- ผลต่อ Caret: pattern นี้คือสิ่งที่ Caret ต้องการสำหรับให้ engine ควบคุม task/project/automation/browser/device ผ่าน tools กลาง ควรนำ connection-per-thread, secret-free config, transport negotiation, one-shot policy, token exclusion ไปใช้ แต่ต้องผูกกับ permission model ของ Caret เอง ไม่รับ default ของ Synara

**ฝั่งที่ 2: External MCP**

- ตำแหน่ง: `docs/external-mcp.md`, `apps/server/src/externalMcp/*`, `packages/contracts/src/externalMcp.ts`
- ใช้เมื่อ งานเริ่มนอก Synara แต่อยากให้รันผ่าน durable task และ worktree pipeline ของ Synara เช่น Codex หรือ Claude Code สร้าง integration ใน Settings เลือก `all` หรือ `selected projects` ได้รับ `integrationId` แบบ `mcp_int_*` แล้วรัน launcher ที่ Synara สร้างให้ เช่น `synara-server mcp serve --integration ... --home-dir ...` ไม่ต้องกรอก project/model/credential เอง
- Pairing แบบสองชั้นคือ สร้าง pending record ในเครื่องก่อน แล้วแลก short-lived pairing code กับ loopback server ผ่าน HMAC challenge ถ้า reload หรือหมดอายุใช้ Resume หรือ Continue ได้โดยไม่หมุน credential ที่ pair แล้ว credential สุดท้ายเขียนที่ `<home>/mcp/credentials/<id>.json` ตั้ง permission `0700/0600` บน POSIX ส่วน Windows ไม่มี guarantee เท่ากัน
- Catalog ถูกกรองตาม scope ที่ให้คือ `synara_overview`, `synara_capabilities`, `synara_list_allowed_projects`, `synara_create_task`, `synara_wait_for_task`, `synara_read_task` การสร้างบังคับ `projectId`, `provider`, `model`, `prompt`, `requestId` คงที่ ค่าเริ่มต้นคือ managed worktree บวก approval-required ส่วน local checkout และ full-access เป็น scope แยกที่ต้องขอชัด
- ความปลอดภัยคือ endpoint `/mcp/external` เปิดเฉพาะตอน server เป็น loopback-only ถ้าตั้ง remote หรือ published จะปิด endpoint นี้แทนการ expose ออกไป credential มี audience ตายตัว `synara.external-mcp` เก็บเป็น SHA-256 hash ตรวจ expiry และ revocation ทั้งตอนเข้าและระหว่าง long-running call มีลิมิต per-integration ทั้ง project/capability/rate/concurrency slot ถูกจองแบบ transactional และคืนเมื่อ fail หรือ terminal ส่วน retry ด้วย `requestId` เดิมไม่กิน slot ซ้ำ ใช้ plan ต่างกับ `requestId` เดิมถูก reject มี audit แต่ไม่ copy full prompt มี prune และ aggregation
- ผลต่อ Caret: นี่คือ MCP server สำหรับให้ client ภายนอกเรียก Caret ไม่ใช่ MCP client ที่ Caret ใช้เรียก tools ภายนอก ควรนำ pairing UX, scope model, revocation ทันที, audit, idempotent `requestId`, loopback-only guard ไปใช้กับ Caret integrations แต่ Caret ยังต้องสร้าง MCP client แยกสำหรับต่อเครื่องมือภายนอก และ pairing นี้ไม่พิสูจน์ native mobile pairing

#### L7.2 Skill - unified catalog บวก per-provider injection ใช้งานได้จริง

- ตำแหน่งหลัก: `apps/server/src/provider/skillsCatalog.ts`, `skillPromptInjection.ts`, `Layers/ProviderDiscoveryService.ts`, `web/components/settings/SkillsSettingsPanel.tsx`, `web/components/settings/skillsSettingsModel.ts`
- Discovery เป็น catalog กลางรวม `~/.synara/skills` กับ skills folder ของทุก provider ทั้ง home roots และ project ancestors ไล่ขึ้นไปทุกชั้น ลำดับ origin มาตรฐานคือ `synara, codex, claude, cursor, grok, factory, opencode, pi, devin, agents, project` แต่ละ provider มี preference ของตัวเอง เช่น Codex ชอบ `codex, agents` ส่วน Cursor ชอบ `cursor, agents, claude, codex` native copy ชนะ catalog copy เมื่อชื่อซ้ำ ข้าม path ที่ซ้ำกันระหว่าง home และ project เพื่อไม่สแกนซ้ำ รองรับ namespace หนึ่งชั้นและ symlink ตามเงื่อนไข มี cache TTL 15 วินาทีบวก single-flight จำกัด 64 entries เพราะ composer picker ยิงถี่
- รูปแบบ skill คือ `SKILL.md` บวก frontmatter subset ที่ parse เองไม่ใช้ YAML lib อ่านเฉพาะ `name`, `description`, `display-name`, `title`, `short-description`, `summary`, `disable-model-invocation` ชื่อซ้ำ dedupe แบบ case-insensitive เก็บ `path`, `scope`, `namespace`, `enabled`, `interface`
- การส่งให้ provider มีสองทางคือ ถ้า provider มี native skill loading ใช้ค่านั้น ถ้าไม่มีหรือไม่รู้จัก root นั้นใช้ inline fallback ด้วย `buildInlineSkillInstructions` ครอบด้วย header บวก `<skill name dir>` จำกัดต่อ skill 24,000 ตัวอักษร และมี `maxChars` รวมทั้ง turn ถ้าเกินเอาที่พอดีแทนการล้น กฎต่อ provider อยู่ใน `shouldInlineSkillForProvider` เช่น Codex inline เฉพาะของ `.claude`, `.cursor`, `.agents` ส่วน Cursor inline เฉพาะของ `.synara` ส่วน Claude inline ทุกอย่างที่ไม่ใช่ `.claude` ส่วน OpenCode, Antigravity, Grok, Droid inline ทั้งหมด
- Settings แสดงทุก origin แบบ group ตามชื่อ ไม่ให้ origin แรกซ่อน origin อื่น แยก section Shared skills กับ From provider พร้อม path, provider icons, คำอธิบาย เปิดปิดผ่าน `serverSettings.skills.disabled` เก็บเป็นชื่อ normalized มี optimistic update แล้ว invalidate discovery queries ผลมีผลกับ composer picker ทุก provider เพราะ `listSkills` กรองด้วย `filterDisabledSkills` เสมอ ส่วน `listSkills` เองทน failure คือ native fail ใช้ catalog อย่างเดียว catalog fail ใช้ native อย่างเดียว ไม่ล้มทั้ง call
- ผลต่อ Caret: นำมาใช้ได้คุ้มมากเพราะตรงกับสมาชิกที่มีคือ Codex, OpenCode, OpenRouter ผ่าน OpenCode ควรเพิ่ม Caret root ของตัวเองเช่น `~/.caret/skills` บวก `.caret/skills` ของ project กำหนด precedence ให้ชัด เก็บ disabled list เป็น server-owned เก็บ budget caps ไว้ ห้าม copy กฎ inline ทั้งดุ้นโดยไม่ทบทวนเมื่อเพิ่ม provider ใหม่ และอย่าสับสน skill กับ slash commands หรือ plugins เพราะคนละ discovery path

#### L7.3 Plugin - ที่เห็นคือ discovery browser แบบ read-only ไม่ใช่ plugin runtime

- ตำแหน่ง: `apps/web/src/components/PluginLibrary.tsx` บวก `providerDiscoveryService` และ adapter `listPlugins` กับ `readPlugin`
- หน้าจอมีสอง tab คือ `plugins` และ `skills` เลือก provider ได้ตาม `DEFAULT_PROVIDER_ORDER` ตรวจ capability ก่อนว่า provider นั้นรองรับ `supportsPluginDiscovery` หรือ `supportsSkillDiscovery` หรือไม่ ถ้า tab ปัจจุบันไม่รองรับจะ fallback ไป provider แรกที่รองรับโดยไม่เขียนทับ selection ของผู้ใช้ ค้นหาแบบ normalize บวก rank แสดงเฉพาะ installed plugins แยก section ตาม marketplace มี brand color, logo, icon, installed check, skeleton, empty และ warning states รองรับ `remoteSyncError` และ `marketplaceLoadErrors` แบบต่อ marketplace
- สิ่งสำคัญคือ code ที่อ่านไม่พบ install, enable, uninstall mutation ของ plugin มีแค่ `isInstalledProviderPlugin` กับ `readPlugin` นั่นคือเป็น browser หรือ discovery เหนือ provider-native plugin system ไม่ใช่ host ที่รัน plugin เอง capability ถูกปิดทั้งชุดถ้า provider ถูก disable ใน settings
- ผลต่อ Caret: นำ pattern นี้ไปทำ Caret Plugin และ Skill browser ได้ แต่ห้ามเข้าใจว่าได้ plugin engine มาด้วย Caret desktop ยังต้องพึ่ง Code-OSS extension host เป็น plugin runtime หลัก ส่วน marketplace, install, policy, sandbox ต้องออกแบบเพิ่ม

#### L7.4 SSOT - แยกให้ชัดว่าอะไรคือต้นฉบับ อะไรคือภาพฉาย

- Task และ thread lifecycle: SSOT คือ event journal บวก command receipts ใน `OrchestrationEngine` และ `persistence/OrchestrationEventStore` มี admission queue, fingerprint กันชน, timeout 45 วินาที, retry แบบมี delay, repair cooldown ส่วน SQLite projections หลาย projector ได้แก่ `hot`, `projects`, `threads`, `thread-shell-summaries`, `messages`, `proposed-plans`, `activities`, `sessions`, `turns` สร้างใหม่ได้ มี snapshot query และ resnapshot escalation กัน loop
- สิ่งที่ client เห็น: ไม่มี client คนใดเป็น SSOT ส่วน `web/storeProjection.ts` เป็น normalized cache แบบ `ids` บวก `byId` reuse reference เพื่อไม่ invalidate selector มี merge hot-path, cap activities, dedupe, remember และ forget project state
- Resume และ reconnect: SSOT คือ server journal head บวก high-water sequence บวก thread existence check ส่วน cursor `afterSequence` ของ client บวก snapshot fallback ใน stream เดียวบวก prewarm เฉพาะ thread ที่มี cursor เป็น derived path อยู่ใน `wsSnapshotLiveStream.ts`, `.docs/transport.md`, `threadDetailResumeCursors.ts`
- Settings และ discovery: SSOT คือ `serverSettings` โดยเฉพาะ `providers[].enabled` และ `skills.disabled` ส่วนผล `listModels`, `listSkills`, `listPlugins` ที่ผ่าน cache และ fallback เป็น derived
- Auth และ session: SSOT คือ `ServerSecretStore` ไฟล์ `0600` ใน `secretsDir 0700` บวก `SessionCredentialService` DB บวก `BootstrapCredentialService` สำหรับ one-time และ pairing links ส่วน cookie และ bearer ที่แจกออกไป, WS ticket อายุสั้น, access snapshot ที่ list ออกมา เป็น derived
- Checkpoint: SSOT ของ filesystem คือ Git hidden refs ที่ `CheckpointStore` เป็นเจ้าของ มี capture lock, in-flight dedupe, aggregate timeout 180 วินาที ส่วน checkpoint metadata ที่ชั้นอื่น persist และ provider rollback semantics ต้องประสานแยก
- Worktree และ Git: SSOT คือ Worktree และ Git services บวก filesystem จริง ส่วน shell snapshot และ read model ที่ project ออกมาเป็น derived

กฎสำหรับ Caret คือ เลือก backend owner เดียว ห้ามให้ Synara server และ Paseo เขียน session, worktree, history ชุดเดียวกัน ถือ event journal เป็น SSOT projections พังสร้างใหม่ได้ client เป็น cache ลบได้ pairing และ session เพิกถอนได้จริง native mobile เรียกผ่าน facade ไม่ลาก TypeScript runtime ไปฝังแอป และเก็บ contract revision ให้ compatible ตอน upgrade

#### L7.5 Remote control - ที่ได้มาคือ browser remote บวก pairing ไม่ใช่ native mobile

- LAN และ Tailnet web mode: `REMOTE.md` ให้ build web แล้วรัน `server start --host --port --auth-token --no-browser` เปิด `http://<ip>:3773` บนมือถือ, tablet, แล็ปท็อปเครื่องอื่นได้ มี env map คือ `SYNARA_MODE`, `PORT`, `HOST`, `HOME`, `VITE_DEV_SERVER_URL`, `NO_BROWSER`, `AUTH_TOKEN` แนะนำให้ตั้ง token ก่อน expose ผูก Tailnet IP แทน `0.0.0.0` ถ้าทำได้ และเปิด firewall เป็นรายพอร์ต นี่คือ feasibility baseline ของ Caret web client ไม่ใช่ native app
- Pairing และ bootstrap: `web/pairingBootstrap.ts` จับ path `/pair` อ่าน `token` จาก URL hash แล้ว POST `/api/auth/bootstrap` แบบ `same-origin` สำเร็จ redirect ไป `/` ล้มเหลว render หน้าเต็ม ไม่เก็บ token ใน history เพราะเรียก `replaceState` ลบทิ้งก่อน ส่วน `contracts/auth.ts` บวก `AuthControlPlane` มี pairing link แบบมี `id`, `credential`, `role`, `subject`, `label`, `expiresAt` สร้าง, list, revoke ได้ มี client metadata ระบุ `desktop`, `mobile`, `tablet`, `bot`, `unknown` พร้อม IP, user-agent, OS, browser และ session list แบบเรียง owner, connected, issued
- Auth policy: `auth/Layers/ServerAuthPolicy.ts` เลือก policy จาก mode และ host ได้แก่ `desktop-managed-local`, `loopback-browser`, `remote-reachable`, `unsafe-no-auth` bootstrap เป็น `desktop-bootstrap` และหรือ `one-time-token` session มีทั้ง cookie และ bearer cookie name ผูกกับ mode และ port ฝั่ง `SessionCredentialService` มี session TTL 30 วัน WS token 5 นาที จำกัด 8 connections ต่อ session และ 16 outstanding WS tickets มี capacity retry
- Transport: `.docs/transport.md` บวก `wsTransport.ts` ใช้ handshake เดียวคือ `GET /ws/negotiate` เอา epoch, revision, instanceId, capabilities แล้วค่อย upgrade `/ws` พร้อมค่าเดิม mismatch ได้ HTTP 426 แล้ว reload หรือ update ตาม reason instanceId ใหม่ทุก boot กันคุยข้าม generation เปิด `permessage-deflate` แบบ context takeover เฉพาะ feature path ตรวจ `maxPayload` หลัง decompress เสิร์ฟ static แบบ `br` และ `gz` พร้อม ETag แยก encoding และ cache `immutable` เฉพาะ hashed assets ส่วน `index.html` เป็น `no-cache` มี cursor resume และ prewarm ตาม L7.4
- ข้อจำกัดที่ต้องเสริมก่อนเรียก remote control ครบคือ ไม่มี APNs, Live Activities, native bot Android, relay, cloud compute, identity หลายผู้ใช้, enterprise policy และ API, offline queue ที่พิสูจน์แล้ว และ external MCP ถูกออกแบบให้ปิดเมื่อ remote จึงห้าม expose `/mcp/external` ออกนอก loopback เด็ดขาด Caret ต้องเพิ่ม native session facade, relay ที่คุมได้, push, device revoke และ list, threat model สำหรับ host ที่ไม่ใช่ localhost และ acceptance แยกจาก LAN demo

#### L7.6 คำตัดสิน reuse สำหรับ Caret

- นำมาใช้: Agent Gateway pattern บวก per-thread bearer บวก secret-free injection, external MCP scope, pairing, revocation, audit, idempotent request เป็นต้นแบบ integration, unified skills catalog บวก inline budget บวก disabled settings, PluginLibrary เฉพาะ UI และ discovery pattern, event journal เป็น SSOT บวก projection, snapshot, resume discipline, auth policy, pairing, session, secret-store discipline, transport negotiate, compress, static, cursor pattern, checkpoint, worktree, terminal, browser, automation เฉพาะ module ที่ผ่าน conformance
- ดัดแปลงก่อนใช้: เพิ่ม Caret skill root และ precedence, แปลง permission และ mode ไปข้อกำหนด Caret, ทำ editor bridge ระหว่าง Synara-derived UI กับ Code-OSS dirty buffers, debugger, LSP, scope CSS และ brand, ผูก provider auth ของ Codex และ OpenCode กับ engines ไม่ให้ UI ถือ credential, ทำ native-client facade แทนการลาก web runtime ลงมือถือ
- ไม่ยกมา: Synara Electron app ทั้งก้อนแทน Code-OSS, file editor เบาแทน extension host, toolchain และ monorepo ทั้งชุดโดยไม่วัด, permission defaults, สอง backend owners พร้อมกัน, การอ้างว่า LAN web บวก simulator เท่ากับ native mobile และ cloud
- ต้องสร้างเพิ่ม: MCP client สำหรับเรียก tools ภายนอก, Caret plugin และ extension policy บน Code-OSS host, native iOS และ Android บวก push, relay, cloud workers, Cursor Tab และ index quality, enterprise และ API, Gitea และ Origin sync, Cursor visual refinement track

#### L7.7 งานตรวจถัดไปก่อนล็อก backend

1. Trace `command`, engine, event, projection, WS, `storeProjection` บน revision ที่ล็อก
2. ตรวจ Codex และ OpenCode auth, resume, steer, cancel, approval และ capability matrix จริง
3. ตรวจ dirty-buffer, checkpoint, worktree collision และ approval ก่อน side effects
4. ตรวจ browser bridge boundary, external MCP scope, authenticated reconnect, native facade
5. Re-run เฉพาะ upstream module tests ที่เกี่ยวกับ module ที่จะยกมา แล้วเขียน Caret conformance เพิ่ม ทุกข้อเป็นงานอนาคต ยังไม่เริ่มโค้ดในรอบ planning นี้

### L8. Harness contract + capability matrix (thin spec, planning only)

**L8.0 ขอบเขตและวิธีตรวจ.** Thin spec ระดับ contract ยังไม่ลง implementation อ่านแบบ read-only ณ revision `59db80a170a0abe7c8710ae247f15097ec46cd68` ไม่ clone/install/build/run ไม่แตะ credentials ไฟล์ที่อ่านจริงอยู่ใน `/tmp/caret-synara-review` ได้แก่ `packages/contracts/src/orchestration.ts` (นิยาม `ProviderKind`), `packages/contracts/src/provider.ts` (ops), `apps/server/src/provider/Services/ProviderAdapter.ts` (capability shape), `apps/server/src/provider/Layers/CodexAdapter.ts` กับ `Layers/OpenCodeAdapter.ts` (ส่วนหัว), `apps/server/src/agentGateway/harnessPolicy.ts` กับ `mcpInjection.ts` (gateway + policy) และ `apps/marketing/content/docs/providers/*.mdx` (`index`, `codex`, `opencode`, `pi`) ผลเป็นสเปกตั้งต้น ไม่ใช่ compatibility certification

**L8.1 Common harness contract (contract กลาง ใช้กับทุก engine driver).** harness ของ Caret มีตัวเดียว ทุก engine driver ต้องพูด contract กลางชุดเดียวกันตามชื่อ ops ใน `provider.ts`: `startSession`, `sendTurn`/`steerTurn`, `interruptTurn`, `stopSession`, `compactThread`, `forkThread`, `respondToRequest` (approval), `respondToUserInput`, `startReview`, `steerSubagent` (optional), `backgroundTask`/`stopTask` กฎประกอบคือ discovery ผ่าน `ProviderAdapterCapabilities` + composer capabilities + `synara_capabilities` ห้ามเดา model slug (เช่น Codex ใช้ `options.reasoningEffort` ส่วน Claude ใช้ `options.effort` ห้ามสลับ), map events เป็น kinds `session|notification|request|error` พร้อม engine-native ID และ sequence (buffer cap 2,048), map approval ไปข้อกำหนด Caret PX-10...13 โดยไม่รับ Full-access default ของ upstream, ฉีด Agent Gateway แบบ secret-free ต่อ provider (Codex เป็น TOML `mcp_servers` + `shell_environment_policy` exclude, Claude เป็น HTTP `mcpServers` + `Authorization`, OpenCode เป็น `remote` + exclusive lock ตลอด turn, ACP เลือก HTTP หรือ stdio-proxy, Antigravity ใช้ bootstrap token ครั้งเดียวแล้ว proxy เก็บ bearer ใน memory), แจก host policy ครั้งเดียวต่อ session ด้วย `takeSynaraHarnessPolicyForProviderSession` พร้อม bearer แบบ thread-scoped และใช้ `requestId` คงที่ (idempotent) ตอนสร้างงาน

**L8.2 Capability matrix (ที่อ่านจาก source + docs).** สถานะ `src` คือพบใน source/docs ณ revision ที่ล็อก `spike` คืองานพิสูจน์ก่อนล็อก backend

| Engine driver | Gateway control (src) | Native steer (src) | Resume/compact (src) | Approval + user-input (src) | Model/thinking (src) | Auth owner (src) | คำตัดสิน |
|---|---|---|---|---|---|---|---|
| Codex | มี (`PROVIDERS_WITH_THREAD_SCOPED_SYNARA_MCP`) | Yes (ตาราง providers index) | มี native session + resume cursor | มี approvals + user-input questions | `reasoningEffort`, model picker จาก runtime | engine ดูแลเอง (ChatGPT login / API key / model provider) | **reference driver ตัวแรก** loop แข็งสุด adapter สุกสุด; spike: schema revision, approval ก่อน side effects, cancel/resume, secret redaction |
| OpenCode | มี | No (ส่ง follow-up ได้เมื่อ turn จบ ไม่ใช่ steer กลาง turn) | มีผ่าน OpenCode runtime | มี permission rules + question roundtrip | catalog + variants จาก config ของผู้ใช้ (OpenCode ต่อได้หลาย provider ผ่าน config ตาม opencode.mdx; OpenRouter/Go ตาม PROVIDER-CONNECTIVITY; DeepSeek entry ยืนยันแล้วว่าเป็น provider `deepseek` แบบ openai-compatible เหลือ spike แค่ eval คุณภาพ/ความปลอดภัย + model-slug) | credential store ของ OpenCode | **driver ตัวที่สอง** ตัวเดียวให้ความครบ (OpenRouter/Go ตาม PROVIDER-CONNECTIVITY ส่วน provider อื่นรวม DeepSeek ผ่าน config เดียวกัน ยืนยัน entry แล้ว); spike: permission mapping, model-slug parse, session identity `x-opencode-session` + user-agent |
| Pi (`pi` ProviderKind, `@earendil-works/pi-coding-agent`; upstream ปัจจุบันคือ `earendil-works/pi` เนื้อหาเดียวกับ `badlogic/pi-mono` เป็น minimal terminal harness ขยายผ่าน TS Extensions/Skills ไม่มี subagents/plan mode ในตัว) | มี | Yes | มี history/continuation | มี user-input requests ใน conversation | registry + thinking levels ของโมเดลที่เลือก, ซ่อม catalog บางรายการฝั่ง Synara | Pi ดูแลเอง (`/login` + env keys + state `~/.pi/agent` ตาม docs; รองรับทั้งสองเส้น) ไม่มี permission system ในตัว ต้อง sandbox เอง | **driver ลำดับถัดไป (deferred)** งานเบาและ local; ecosystem เล็กกว่า; ยังไม่ขึ้นจนกว่า driver แรกผ่าน conformance; spike: catalog refresh, ทบทวน extensions ก่อนเปิดใน repo สำคัญ |
| DeepSeek Creator (ชื่อเรียกโมเดล/งาน bulk ไม่ใช่ harness แยก; ค้น GitHub 9 ก.ย. 2026 ไม่พบ official harness มีแต่ community workbench หลักร้อย stars) | ไม่ใช่ ProviderKind แยก เรียกผ่าน OpenCode provider `deepseek` (openai-compatible, DeepSeek API key) หรือ OpenRouter | ตาม OpenCode (No) | ตาม OpenCode | ตาม OpenCode | โมเดล DeepSeek ตามสิทธิ์บัญชี | เจ้าของ endpoint ที่เลือก (DeepSeek console / OpenRouter) | **engine เสริมงาน bulk ราคาถูก** entry ผ่าน config ยืนยันแล้วจากหน้า providers ของ OpenCode; ห้ามเป็นแกนหลักจนกว่า eval คุณภาพ/ความปลอดภัยผ่าน; ไม่สร้าง driver แยก ใช้ผ่าน OpenCode driver |
| OMP (`can1357/oh-my-pi`, fork ของ `badlogic/pi-mono` โดย @mariozechner) | ไม่ใช่ ProviderKind (สมาชิกที่มีคือ `codex/claudeAgent/cursor/antigravity/grok/droid/opencode/pi/devin`) | IDE-wired agent (LSP 14 ops / DAP 28 ops ตาม README) | มีใน upstream ของตัวเอง (resume picker) แต่ยังไม่ map เข้า contract กลาง | มีใน upstream ของตัวเอง แต่ยังไม่ map เข้า PX-10...13 | 60+ providers / 31 tools / Rust core ~80k lines ตาม README | MIT (`LICENSE`: Mario Zechner + Can Boluk + Stencil Labs); stars ~30,353 ณ 9 ก.ย. 2026 | **pattern reference เท่านั้น (deferred)** ยืนยันตัวตนแล้วว่าเป็น Pi-fork สาย IDE-wired ไม่ใช่ generic endpoint; ไม่สร้าง driver แยก ลอกเฉพาะ LSP/DAP/IDE-wiring pattern ถ้า driver หลักพิสูจน์ว่ามีช่องว่าง; ห้าม bespoke จนกว่าจะพ้น eval |

**L8.3 ลำดับ build ที่แนะนำ (เก่ง + ครบ ด้วยสมาชิก Codex / OpenCode Go / OpenRouter ที่มีอยู่).** 1) OpenCode driver ขึ้นก่อนเพราะตัวเดียวคลุม frontier ได้กว้างสุดผ่าน config ไม่ต้องสร้าง driver ใหม่ทุกโมเดล 2) Codex driver เป็นตัวที่สองเพื่อยกระดับ loop quality (approval/steer/resume) เป็นพฤติกรรมอ้างอิงของ harness 3) ประเมิน DeepSeek Creator ผ่าน OpenCode driver ไม่ต่อตรง Pi กับ OMP อยู่ในสถานะ deferred ไม่ใช่คิวงาน จะหยิบมาพิจารณาใหม่ก็ต่อเมื่อ driver สองตัวแรกพิสูจน์แล้วว่ามีช่องว่างที่ปิดด้วย config ไม่ได้ ลำดับนี้ต่างจากร่างก่อนที่ให้ Codex ขึ้นก่อน เพราะกรอบเปลี่ยนเป็น owned harness ตัวเดียว: เอาความกว้าง (coverage) ก่อน แล้วค่อยยืมความเก่ง (loop semantics) จาก Codex มาเป็น reference ลำดับนี้ลดงานซ้ำและกัน divergence ของ tool names, permission mapping, approval, steer/cancel/resume และวิธีเลือกโมเดล

**L8.4 คำถามค้างก่อนล็อก (ปิดด้วยการตรวจ 10 ก.ย. 2026 ผ่าน GitHub API + README ต้นน้ำ ไม่ใช้ web-search).** OMP ยืนยันแล้วว่าคือ `can1357/oh-my-pi` (fork Pi สาย IDE-wired, MIT, ~30,353 stars); DeepSeek Creator ยืนยันแล้วว่าไม่ใช่ harness แยก แต่คือโมเดล DeepSeek ผ่าน OpenCode provider `deepseek` หรือ OpenRouter; Pi รองรับทั้ง `/login` และ API key/env + state `~/.pi/agent` (เลือกตอน implement driver); Go กรณีเรียกตรงใช้ identity ตาม docs เดิมคือ `x-opencode-session` + user-agent (คงเหลือแค่ conformance spike ใน L8.5 ไม่ใช่คำถามตัวตนแล้ว)

**L8.5 Spike ถัดไป (งานอนาคต ยังไม่เริ่มโค้ด).** conformance ราย engine driver ได้แก่ init schema, fixture tool call, streaming/cancel/steer/resume, approval gating ก่อน side effects, error/rate-limit mapping, secret redaction, usage accounting บันทึก engine/model revision และ cost ประกอบผลทุกครั้ง

**L8.6 กฎ ownership: harness ตัวเดียว (decision ถาวร).** Caret มี harness เดียวเป็นของตัวเอง ได้แก่ permission model ชุดเดียว (PX-10...13), approval UX แบบเดียว, event journal เป็น SSOT ชุดเดียว, session/worktree/checkpoint เจ้าของเดียว Codex/OpenCode/Pi ไม่ใช่หลาย harness แต่เป็น engine drivers บางๆ ใต้ harness ตัวเดียว หน้าที่มีแค่แปลภาษา engine นั้นเข้ากับ contract กลาง แต่ละ driver ประกาศ capability flags ตามจริง เพิ่มโมเดลใหม่ทำที่ config ของ engine เดิม ไม่สร้าง harness/driver เพิ่ม เพิ่ม engine ใหม่ค่อยเพิ่ม driver บางๆ หนึ่งตัว เปลี่ยนพฤติกรรม agent แก้ที่ harness ตัวเดียวเท่านั้น ห้ามแตก harness ที่สองไม่ว่ากรณีใด
