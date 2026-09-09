# Caret — Feature parity baseline

Baseline: public Cursor docs/help/changelog ที่ตรวจ 9 กันยายน 2026; iOS App Store แสดง 1.8.0 ในวันที่ตรวจ Desktop release number ของภาพอ้างอิงยังไม่ยืนยัน ห้ามผสมการเห็นภาพกับการพิสูจน์ behavior จริง

ทุกแถวมีสถานะ implementation = **planned** ไม่มีแถวใดผ่านทดสอบแล้ว Source links ของแต่ละหมวดบอกหลักฐานต้นแบบ; acceptance เป็นข้อกำหนดของ Caret ที่เสนอเพิ่มเติม ไม่ใช่คำอ้างว่า Cursor ผ่าน test เหล่านี้ทั้งหมด

UI IDs ดู [UI specification](UI-SPEC.th.md); phase M ดู [roadmap](ROADMAP-AND-ACCEPTANCE.th.md) ส่วน engine/provider/license limits ดู [gap register](GAPS-AND-DECISIONS.th.md)

## IDE — ฐาน editor

ฐาน: [Code - OSS](https://github.com/microsoft/vscode), [Cursor Quickstart](https://cursor.com/docs/get-started/quickstart) • UI D01–D05 • M1

| ID | ความสามารถ | เกณฑ์ตรวจรับ / ขอบเขต |
|---|---|---|
| IDE-01 | เปิด folder/repo/recent/workspace | path มี space/Unicode; restore workspace หลัง restart |
| IDE-02 | Editor tabs/splits/preview tabs | dirty state, pin, close, reopen และ drag split ไม่ทำ buffer หาย |
| IDE-03 | Explorer/file operations | create/rename/move/delete พร้อม conflict/undo ที่ upstream รองรับ |
| IDE-04 | Search/replace/navigation | regex, multi-file preview, symbols, definition/references ถูกต้อง |
| IDE-05 | Terminal/tasks | interactive PTY, shell profiles, background process, exit status บนสาม OS |
| IDE-06 | Git/source control | stage/unstage/hunk/commit/branch/merge conflict/status ใช้ repo จริง |
| IDE-07 | LSP/debugger/test tooling | language matrix, breakpoints, diagnostics และ test adapters ที่มีสิทธิ์ใช้ |
| IDE-08 | Settings/themes/keybindings/profiles | import แบบมี preview; แยก Caret profile; sync explicit |
| IDE-09 | Extensions lifecycle | discover/install/update/disable/uninstall/VSIX; license/registry/error state |
| IDE-10 | Remote SSH/WSL/dev environment | แยก editor remote และ agent remote; ทดสอบ permitted extension alternatives |
| IDE-11 | Accessibility/zoom/localization | keyboard/screen reader/IME ไทย/Unicode/bidi ไม่แตก; English UI baseline |
| IDE-12 | Installer/update/recovery | install/upgrade/rollback/signatures/protocol handlers บน OS matrix |

## TAB / EDIT — Predictive editing

ต้นแบบ: [Tab](https://cursor.com/help/ai-features/tab), [Inline edit](https://cursor.com/help/ai-features/inline-edit) • UI D03–D05 • M3

| ID | ความสามารถ | เกณฑ์ตรวจรับ / ขอบเขต |
|---|---|---|
| TAB-01 | Ghost text/FIM completion | recent edits + surrounding code; stale response ไม่แทรกทับ buffer รุ่นใหม่ |
| TAB-02 | Accept/reject/partial accept | Tab/Escape/word accept และการพิมพ์ต่อทำงานตาม keybinding ที่ตั้ง |
| TAB-03 | Multiline replacement/imports | diff/undo หนึ่ง logical edit; syntax/diagnostics ตรวจได้ |
| TAB-04 | Jump-in-file | แสดง destination และ Tab เพื่อไปตำแหน่งต่อไป; ไม่ jump เอง |
| TAB-05 | Cross-file next edit/portal | แสดงไฟล์ปลายทางและ preview ก่อนนำทาง; context hash สอดคล้อง |
| TAB-06 | Snooze/global/filetype controls | statusbar state สะท้อน effective settings; timeout snooze คืนค่าถูก |
| TAB-07 | Quality/latency | replay typing suite; cancellation, request rate, cost และ acceptance rate |
| EDIT-01 | Selection inline edit | selection/prompt → diff → accept/reject; preserve selection/undo |
| EDIT-02 | Generate at cursor / follow-up | no-selection insertion; refine proposal ก่อน apply ได้ |
| EDIT-03 | Inline-to-agent handoff | ส่ง context และ prompt ไป task โดยไม่ apply ซ้ำ |
| EDIT-04 | Terminal command generation | อธิบาย/เสนอคำสั่ง; execute เป็น action แยก; shell quoting ตาม OS |

## AG — Agent และ session

ต้นแบบ: [Agent](https://cursor.com/docs/agent/overview), [Agents Window](https://cursor.com/docs/agent/agents-window) • UI A01–A11 • M2/M4

| ID | ความสามารถ | เกณฑ์ตรวจรับ / ขอบเขต |
|---|---|---|
| AG-01 | Editor sidepane + Agents Window | เปิดทั้งสอง surface; session เดิม ไม่ duplicate run |
| AG-02 | Multi-project/task list | grouped/pinned/search/filter/rename/archive/delete; workspace identity ถูก |
| AG-03 | Streaming transcript/tool cards | text/code/tool/result/error render; paginate ย้อนประวัติได้ |
| AG-04 | Prompt queue | reorder/edit/remove queued prompt; ส่งตามลำดับที่แสดง |
| AG-05 | Steer/send now/cancel | steering เข้าที่ safe boundary; cancel ไม่แปลว่า rollback |
| AG-06 | Resume/fork/history | fork อ้าง base turn; resumable engine state ไม่สูญ metadata |
| AG-07 | File edit/shell/web/question tools | schema, approval, result และ failures ไม่ตกหล่น |
| AG-08 | Goals / long-running task | goal state แยก turn idle; pause/resume/budget/stop reason แสดงจริง |
| AG-09 | Task todo/progress | todos update ตาม events ไม่แต่ง completion status |
| AG-10 | Artifacts/demos | image/video/log/file links ผูก run/revision และเปิด viewer ถูกชนิด |
| AG-11 | Worktree/branch/PR handoff | lease + revision; failed move กลับต้นทางได้โดยไม่เสียงาน |

## CTX / MOD — Prompt, context และ modes

ต้นแบบ: [Prompting](https://cursor.com/docs/agent/prompting), [Plan](https://cursor.com/docs/agent/plan-mode), [Debug](https://cursor.com/docs/agent/debug-mode), [Models](https://cursor.com/docs/models-and-pricing) • UI A03–A06 • M2/M4

| ID | ความสามารถ | เกณฑ์ตรวจรับ / ขอบเขต |
|---|---|---|
| CTX-01 | @Files/Folders และ nested picker | resolve path/context budget; renamed/deleted file เป็น error ที่แก้ได้ |
| CTX-02 | @Terminal/Chat/Git/Browser | snapshot provenance และ revision; trim large content พร้อมบอกขอบเขต |
| CTX-03 | Image/clipboard/drop/attachments | MIME/size validation, upload failure/retry และ remove ก่อนส่ง |
| CTX-04 | Context ring/breakdown | categories ตาม engine ส่งจริง; unknown ไม่แสดงเป็นศูนย์ |
| CTX-05 | Compaction/summarization | retain decisions/pending approvals/workspace pointers; timeline แสดง boundary |
| CTX-06 | Model/reasoning/context picker | ค้นหา/filter/default/per-run; supported capability และ quota ชัดเจน |
| CTX-07 | Mid-session model switch | engine-supported switch หรือ explicit new-engine handoff; ไม่แอบ reset |
| MOD-01 | Ask/read-only | explore/answer โดยไม่แก้ workspace หรือใช้ write tools |
| MOD-02 | Plan mode | ask → research → editable plan → explicit Build; planning ไม่เปิด write execution |
| MOD-03 | Debug mode | hypothesis → runtime evidence → fix → verify → clean instrumentation |
| MOD-04 | Custom skill mode | persistent skill badge/context จนออก mode; precedence ชัดเจน |
| MOD-05 | Auto/model routing | policy โปร่งใส; ไม่ใช้ชื่อ Auto เพื่อซ่อน provider/cost เปลี่ยน |

## SEARCH — Codebase context

ต้นแบบ: [Search](https://cursor.com/docs/agent/tools/search), [Ignore files](https://cursor.com/docs/reference/ignore-file) • UI D02/S04 • M3/M4

| ID | ความสามารถ | เกณฑ์ตรวจรับ / ขอบเขต |
|---|---|---|
| SEARCH-01 | Exact/regex/word search | results มี path/line/snippet และ cancellation; ไม่อ้าง proprietary speed |
| SEARCH-02 | Symbol/semantic retrieval | sources/dedup/ranking; incremental update; benchmark แยก lexical |
| SEARCH-03 | Index progress/rebuild/pause | status/per-root failures/estimated scope; no endless spinner |
| SEARCH-04 | Ignore hierarchy/import | project/user/parent patterns; effective explanation และ negation tests |
| SEARCH-05 | Permission/ignore distinction | excluded context ไม่ถูกแนบอัตโนมัติ; sandbox ยังบังคับ tools แยก |
| SEARCH-06 | Branch/multi-root/large repo | cache invalidation, symlink/path identity; documented unsupported combinations |
| SEARCH-07 | Documentation sources | explicit URL/context fetch/cache/refresh; mark legacy @Docs behavior needing reference verification |

## REV / WT — ตรวจและจัดการการเปลี่ยนแปลง

ต้นแบบ: [Agent Review](https://cursor.com/docs/agent/agent-review), [Worktrees](https://cursor.com/docs/configuration/worktrees), [Origin PR](https://cursor.com/docs/origin/pull-requests) • UI A07–A09/D05/W03 • M2/M4/M7

| ID | ความสามารถ | เกณฑ์ตรวจรับ / ขอบเขต |
|---|---|---|
| REV-01 | File/hunk review inline/split | add/delete/rename/binary/large diff; line numbers และ changed counts ตรง Git |
| REV-02 | Accept/reject/keep-all | per-hunk/whole task; dirty buffer conflict ไม่ overwrite |
| REV-03 | Checkpoint/restore | เฉพาะ agent changes; user edits/untracked data ไม่หาย |
| REV-04 | Agent Review quick/deep | explicit base/current HEAD; dedup findings; linked file/line |
| REV-05 | Review trigger configuration | manual/after-task/commit options ผูก event ชัด; docs ต้นแบบมีคำอธิบาย trigger ไม่สอดคล้อง ต้องยืนยันก่อน copy default |
| REV-06 | Commit/PR lifecycle | draft/ready/comment/review/checks/update/close/merge; permissions/HEAD revalidate |
| WT-01 | Create/discover/select worktree | external worktree discovery; logical repo/root mapping |
| WT-02 | OS-specific setup hooks | unix/windows/fallback; setup failure logs และ retry |
| WT-03 | Move task and bring changes back | branch collision, existing modifications, detached HEAD handled |
| WT-04 | Best-of-N/parallel runs | worktrees isolated; compare results และเลือก patch ไม่รวมทับเอง |
| WT-05 | Cleanup/retention | pinned/running/dirty worktrees ต้องไม่สูญงาน; expiry preview และ recovery |

## CUS — Rules, skills, plugins, MCP, hooks

ต้นแบบ: [Rules](https://cursor.com/docs/rules), [Skills](https://cursor.com/docs/skills), [Subagents](https://cursor.com/docs/subagents), [Hooks](https://cursor.com/docs/hooks), [MCP](https://cursor.com/docs/mcp), [Plugins](https://cursor.com/docs/plugins), [Plugin reference](https://cursor.com/docs/reference/plugins) • UI S05–S09/A11 • M4

| ID | ความสามารถ | เกณฑ์ตรวจรับ / ขอบเขต |
|---|---|---|
| CUS-01 | Rules scopes/activation | always/glob/description/manual; project/user/team; effective provenance |
| CUS-02 | AGENTS.md and imported configs | nested discovery; `.cursor` import preview; primary Caret writes ไม่แก้ต้นฉบับ |
| CUS-03 | Skills discovery/frontmatter/assets | progressive context, explicit invocation, modes และ invalid manifest errors |
| CUS-04 | Skill creation/import/sync | local/Git source/version; sync and revoke ไม่ลบไฟล์ผู้ใช้ผิดตัว |
| CUS-05 | Built-in workflow skills | equivalents สำหรับ create-rule/skill/hook/subagent, review, loop, automate, canvas, split-to-PRs, blame, SDK/config |
| CUS-06 | Subagent foreground/background | independent context/model/tools; result/timeout/cancel/resume chain |
| CUS-07 | Cloud subagent / autopilot | isolated workspace/VM; parent/child provenance และ cost accounting |
| CUS-08 | Hooks lifecycle | per-event/schema/timeout/exit handling; ไม่อ้าง cloud support ทุก hook เท่ากัน |
| CUS-09 | Hooks command/prompt types | trust, input/output contracts; approval policy และ failure mode ทดสอบได้ |
| CUS-10 | MCP stdio/SSE/Streamable HTTP | discovery/reconnect/cancel/auth; root/scopes ต่อ host ถูก |
| CUS-11 | MCP tools/resources/prompts/elicitation | typed results, images, user questions และ consent state |
| CUS-12 | MCP Apps | isolated interactive view, tool calls checked; CSP/navigation boundary |
| CUS-13 | Plugin manifest lifecycle | install/enable/update/disable/remove/version mismatch; local/Git/marketplace |
| CUS-14 | Team marketplace/publishing | install modes, refresh, publish/unpublish and visibility; late track ไม่ลบทิ้ง |
| CUS-15 | Configuration editor / validation | explain conflict, unknown field, secret reference และ effective values |

## VIS — Browser, Design Mode, canvas, voice

ต้นแบบ: [Browser](https://cursor.com/docs/agent/tools/browser), [Design Mode](https://cursor.com/docs/agent/design-mode), [Canvases](https://cursor.com/docs/agent/tools/canvas), [Prompting](https://cursor.com/docs/agent/prompting) • UI A10–A13/N05–N07 • M4/M6

| ID | ความสามารถ | เกณฑ์ตรวจรับ / ขอบเขต |
|---|---|---|
| VIS-01 | Embedded browser/navigation | isolated sessions, history, URL, loading/error, local preview |
| VIS-02 | Browser tools | click/type/scroll/screenshot/console/network; action target ได้จาก state ปัจจุบัน |
| VIS-03 | Element and multiselect | node attributes/styles/component context; unsupported framework แสดง confidence |
| VIS-04 | Annotation/drawing/frozen frame | annotations ผูก screenshot coordinates/viewport ไม่ลอยเมื่อ scroll |
| VIS-05 | Visual prompt/source linkage | precise selection + image + instruction; source-map absence ไม่แต่ง filename |
| VIS-06 | Image generation/input/output | provider capability/usage; artifact saved/opened; unavailable มีทางเลือก |
| VIS-07 | Canvas create/list/source/iterate | sandbox rendering, persist/reopen/source revision, edit/revert |
| VIS-08 | Canvas share/refresh/revoke | explicit publish, access/expiry และ snapshot identity |
| VIS-09 | Dictation | start/stop/transcript/edit/send; denied mic/network/Thai-English handled |
| VIS-10 | Conversational voice | turn-taking/cancel/text fallback; selected engine tools และ permissions คงเดิม |

## LOC / MOB — ใช้งานข้ามอุปกรณ์

ต้นแบบ: [Mobile](https://cursor.com/docs/cloud-agent/mobile), [My Machines](https://cursor.com/docs/cloud-agent/self-hosted/my-machines), [App Store](https://apps.apple.com/us/app/cursor/id6767085653) • UI N01–N10/S10 • M5/M6

| ID | ความสามารถ | เกณฑ์ตรวจรับ / ขอบเขต |
|---|---|---|
| LOC-01 | Pair/local worker registration | device identity, repo mapping, QR expiry/revoke; correct owner only |
| LOC-02 | Remote control existing run | preserved task state; tools อยู่ host ที่เลือก; no duplicate execution |
| LOC-03 | Host lifecycle | offline/sleep/keep-awake settings; no silent cloud fallback |
| LOC-04 | LAN/private/relay connection | encrypted transport, network changes, session resync และ incompatible version |
| LOC-05 | Multiple hosts/repositories | local/SSH/devbox identity; same filename ต่าง repo ไม่สับสน |
| MOB-01 | Inbox/tasks/search/filter/pin | cache-first, status/diff count/freshness; tap opens correct session |
| MOB-02 | New task/repo/branch/worker/model | selections persisted per intent; unavailable host/model clear |
| MOB-03 | Chat/steering/subagent details | stream, tool expansion, follow-up/cancel/approve; compact layouts |
| MOB-04 | PR review and lifecycle | changed files/commits/checks/comments/reviewers/deployments/merge พร้อม stale revision guard |
| MOB-05 | Image/file/camera/annotation | picker permissions, previews, point/draw coordinates และ retry |
| MOB-06 | Voice | dictation/conversation state และ keyboard transitions; no accidental double send |
| MOB-07 | Notifications/Live Activities | completion/attention, deep link, dedup; lock-screen privacy and stale activity cleanup |
| MOB-08 | iPad layout/Pencil | sidebar/chat/review panes; rotation/multitasking/keyboard/Pencil |
| MOB-09 | Offline/reconnect/background | cached read/draft; action revalidation; phone offline ไม่หยุด host run |
| MOB-10 | Mobile/web boundary | mobile จัดการ agent/review; secrets, integration setup/admin ไป dashboard ตาม baseline |
| MOB-11 | Android PWA | installability, responsive agent/review flow; native Android ไม่อ้างว่ามีใน Cursor baseline |

## CLOUD — เครื่องรันงานและ environments

ต้นแบบ: [Cloud](https://cursor.com/docs/cloud-agent), [Builds](https://cursor.com/docs/cloud-agent/builds), [Capabilities](https://cursor.com/docs/cloud-agent/capabilities), [Self-hosted](https://cursor.com/docs/cloud-agent/self-hosted), [Choose runtime](https://cursor.com/docs/cloud-agent/self-hosted/choose-runtime), [Changelog](https://cursor.com/changelog) • UI W02/W04–W06 • M8

| ID | ความสามารถ | เกณฑ์ตรวจรับ / ขอบเขต |
|---|---|---|
| CLOUD-01 | Provision/stop/recover isolated worker | lease/heartbeat, TTL/cost, cancel during startup, cleanup |
| CLOUD-02 | Repo/branch/multi-repo/no-repo | checkout ownership; scratch → named repo; explicit unsupported combos |
| CLOUD-03 | Environment setup | install/start commands, dependencies, secrets/network, setup-agent proposal |
| CLOUD-04 | Builds/snapshots/history | last-good activation, freshness/source SHA/logs และ failed-build fallback |
| CLOUD-05 | Artifact/demo/desktop stream | screenshots/videos/logs, remote preview และ access control |
| CLOUD-06 | Computer use Mac/Linux | helper permissions/platform backend; take-control arbitration; Windows status explicit |
| CLOUD-07 | My Machines / Team Pools | worker registration, routing labels, queue/claim/release, drain/hibernate |
| CLOUD-08 | Local↔cloud handoff | environment compatibility, pending changes/history/attachments, rollback |
| CLOUD-09 | OIDC/metadata/private connectivity | audience/scoped identity, host boundary, token expiry และ audit |
| CLOUD-10 | Sharing/retention/deletion | viewer/controller scopes, revoke, delete artifacts/snapshots according policy |
| CLOUD-11 | Port forwarding/publish | authenticated preview; publish needs selected deployment provider; no accidental public exposure |

## AUTO / BOT — Automation, review services และ persistent assistants

ต้นแบบ: [Automations](https://cursor.com/docs/cloud-agent/automations), [Bugbot](https://cursor.com/docs/bugbot), [Security agents](https://cursor.com/docs/security-agents), [PR routing](https://cursor.com/docs/approval-agents), [Grok Bot](https://cursor.com/docs/grok-bot), [Bot work](https://cursor.com/docs/grok-bot/work) • UI W07–W09/B01–B04 • M9/M11

| ID | ความสามารถ | เกณฑ์ตรวจรับ / ขอบเขต |
|---|---|---|
| AUTO-01 | Schedule/loop/event subscriptions | timezone/DST/restart/missed runs/dedup/no-op notification policy |
| AUTO-02 | Webhook/SCM/chat/issue triggers | signature, identity, routing, retry และ duplicate payload handling |
| AUTO-03 | Run history/prompts/tools/config | immutable run inputs, logs, costs, enable/disable/manual test |
| AUTO-04 | PR autopilot / fix CI | new HEAD invalidation, bounded retry, bot loops prevented, stop conditions |
| AUTO-05 | Bugbot equivalent | incremental review/depth/rules/dedup/CI status/findings/feedback analytics |
| AUTO-06 | Security review equivalent | finding evidence/severity/repro/fix verification; no guarantee of complete vulnerability detection |
| AUTO-07 | Reviewer routing/risk approval | explicit policy precedence/identity; audit decision and allow human override |
| AUTO-08 | Memories and action tools | provenance/edit/delete memory; send/comment/publish effects scoped |
| BOT-01 | Persistent assistant roster | create/edit/name/pin/share/delete; persistent memory distinct from coding task |
| BOT-02 | Personal computer/browser identity | isolated user boundary; browser account lifecycle and retained sessions |
| BOT-03 | Long-lived work/attention | recurring work, notifications, clarify/review states, artifact delivery |
| BOT-04 | Team setup/network/security | provisioning policy, proxies, private access; claim parity only after late-track verification |

## SCM / INT / API — Ecosystem completeness

ต้นแบบ: [Origin](https://cursor.com/docs/origin), [Mirror](https://cursor.com/docs/origin/mirror-github), [Integrations](https://cursor.com/docs/origin/integrations), [CLI](https://cursor.com/docs/cli/overview), [ACP](https://cursor.com/docs/cli/acp), [API](https://cursor.com/docs/api), [SDK](https://cursor.com/docs/sdk/typescript) • UI W01/W03/W10–W12 • M7/M9/M10

| ID | ความสามารถ | เกณฑ์ตรวจรับ / ขอบเขต |
|---|---|---|
| SCM-01 | Own Git hosting | create/visibility/access/clone/push/pull/branches/tags/history |
| SCM-02 | GitHub mirror | source-of-truth, resync/disconnect, forge-local branches, source outage |
| SCM-03 | Two-way PR collaboration | comments/reviews/checks/reactions/state; dedup and permission reconcile |
| SCM-04 | Codebase browse/search/settings | branch/file/line link, protections/apps/access; no wrong-revision context |
| SCM-05 | Provider abstraction | GitHub/GitLab/Bitbucket/Azure: supported/unsupported actions explicit; self-hosted variants tracked |
| INT-01 | Slack and Teams | thread context, mentions/options/routing/status/follow-up; bot identity |
| INT-02 | Linear/Jira/Notion | assignment/mention triggers, repo mapping, comments/status และ access revocation |
| INT-03 | JetBrains integration | ACP client/server route, auth/session/tools; no VS Code embedding |
| INT-04 | Xcode integration | supported MCP bridge/tools/build/test/diagnostics; macOS prerequisite |
| INT-05 | CI/deploy/event adapters | GitHub Actions, Vercel, Depot/Buildkite, Sentry/PagerDuty ตาม documented scope; each has failure contract |
| INT-06 | Deeplinks | prompt/command/rule/task paths; URL length/auth/version/error handling |
| API-01 | CLI interactive/headless | streaming structured output/exit codes/images/config/permissions/resume |
| API-02 | CLI modes/worktrees/shell | shortcuts/history/review/cancel; platform-specific shell behavior |
| API-03 | ACP and extensions | standard handshake/modes/permissions + Caret additions; namespace ไม่ปลอม Cursor server |
| API-04 | Public agent/worker APIs | list/create/run/stream/cancel/artifacts/pools/tokens/pagination/rate limits |
| API-05 | SDK TypeScript/Python/bridge | same contracts, versioning, lifecycle/error semantics; integration examples ภายหลัง |
| API-06 | Admin/analytics/code tracking APIs | schemas/auth/scopes/export; enterprise track not mistaken for personal billing |

## ADM / SAFE — การตั้งค่า การปฏิบัติการ และ enterprise

ต้นแบบ: [Run modes](https://cursor.com/docs/agent/security/run-modes), [Privacy](https://cursor.com/docs/enterprise/privacy-and-data-governance), [Identity](https://cursor.com/docs/enterprise/identity-and-access-management), [Dashboard](https://cursor.com/docs/account/teams/dashboard), [Blame](https://cursor.com/docs/integrations/cursor-blame), [Monitoring](https://cursor.com/docs/enterprise/compliance-and-monitoring) • UI S01–S12/W13 • M2/M7/M11

| ID | ความสามารถ | เกณฑ์ตรวจรับ / ขอบเขต |
|---|---|---|
| SAFE-01 | Ask/auto-review/full autonomy controls | effective policy per engine/OS; classifier ไม่ใช่ sandbox security boundary |
| SAFE-02 | OS sandbox/network/permissions | deterministic denies, approval expiry, tool args identity; no unsupported guarantee |
| SAFE-03 | Workspace trust/prompt injection | untrusted repo/docs cannot grant permissions; review tool consequences |
| SAFE-04 | Secrets/data boundaries | OS secret store, redaction, egress inventory, revoke/delete/export |
| SAFE-05 | Updates/supply chain | pinned sources, notices, checksums/signatures, rollback และ compatibility |
| ADM-01 | Provider account/usage/costs | Codex/Go/OpenRouter actual limits; unknown ≠ zero; no billing auto-fallback |
| ADM-02 | Personal dashboard/settings | model/run defaults, devices, integrations, environments, data/notifications |
| ADM-03 | Organization/team/group roles | members/service accounts/SSO/SCIM/groups/policy; late-track functional equivalence |
| ADM-04 | Spend controls/pooled usage | quotas/budgets/alerts/allocation; provider billing semantics retained |
| ADM-05 | AI attribution/blame/analytics | attribution with provenance/model/run; edited lines uncertainty; export |
| ADM-06 | Audit/OTel/admin APIs | filtering/retention/redaction/scope; events correlated with run/tool |
| ADM-07 | Managed distribution/network | MDM/policy/proxy/endpoint compatibility on platform matrix |
| ADM-08 | Commercial-contract-only items | Cursor price tiers/certifications/BAA/provider private programs are tracked external gaps ไม่สร้าง badge หรือ claim แทน |

## Coverage rules

แถวรวม เช่น INT-05 ต้องแตก per adapter เมื่อถึง implementation ไม่ถือว่าทำหนึ่งบริการแล้วทั้งแถวครบ และทุกแถวใช้ global acceptance rules: loading/empty/error/cancel/reconnect/accessibility/version mismatch ที่เกี่ยวข้อง

รายการเอกสารทุกหน้าที่ดึงจาก index อยู่ใน [source coverage](SOURCE-COVERAGE.th.md) การ retrieve ครบไม่เท่ากับทดสอบทุก feature สิ่งที่อยู่นอก index เช่น Tab/Inline edit และภาพ App Store ถูกเพิ่มแยกแล้ว

ไม่ลบ scope เพราะเป็น late phase: หาก feature ต้องพึ่งบริการที่ไม่มี ต้องแสดง dependency/gap และวิธีส่งมอบ equivalent เมื่อทำได้ ไม่ทำ placeholder แล้วนับว่า parity สำเร็จ
