# Caret

IDE ที่รันเอเจนต์บนเครื่องตัวเอง (local-first): Code-OSS fork (Caret UI) + Synara daemon (Codex/OpenCode engines). Private repo, Mac-only, ไม่มี cloud. สถานะล่าสุดดู `HANDOFF.md`

เป้าคือ clone-verified gate ใน [แผนรวม v5](docs/IMPLEMENTATION-PLAN.th.md) (authoritative): 198 parent requirements, 75 UI families — [ผล scrutinize](docs/SCRUTINIZE-REVIEW.th.md) กับ [reuse assessment](docs/SYNARA-ASSESSMENT.th.md) ยังเป็นประตูก่อนลงมือ

## สถานะ (2026-09-10 กลางคืน)

- Requirement graph: **verified 17/198** parents, child cases 115 (`planned | implemented | verified | blocked-external` — `blocked-external` ไม่นับว่าผ่าน)
- Daemon suite **114/114** (`caret-adapter`): MCP tools/resources/prompts/elicitation, FIM Tab single-line, worktrees + bring-back, run picker/retention, TCP gateway + live proofs, ACP streaming, CLI `--json` + `send --ask`, local git commit/sync
- Fork (`caret` + `caret-native`): composer Steer/Export/Runs, `cmd+k` inline edit, native Agents shell อยู่ขั้น contracts (rendering รอ reference atlas)
- เปิดค้าง: H05 click-through, reference atlas (Cursor 3.19), signing, devices/APNs, OAuth/cloud providers, independent benchmarks, hosted origin — ทั้งหมดรอคน ของจริง หรือ decision ภายนอก (`HANDOFF.md` มีรายละเอียด)

## การตัดสินใจที่ล็อกแล้ว (ห้ามรื้อโดยไม่มี evidence ใหม่)

- Local-only: โค้ดไม่ออกจากเครื่อง (M8 CLOUD blocked-external เหลือ CLOUD-08)
- Mac-only: ไม่ทำ Windows/Linux; CI บน self-hosted Mac runner
- Approval-gated writes; bring-back ชนแล้วปฏิเสธ ไม่ force
- Daemon เป็น SSOT ของ status/event/transition; fork แค่ render
- Engine budget: OpenCode Go subscription; no relay (loopback + LAN-direct); repo private

## โครง (อ่าน `docs/TEAM-ONBOARDING.md` ก่อนแตะโค้ด)

| Checkout | Branch | ของข้างใน |
|---|---|---|
| `~/caret-work/caret-desktop` | `caret` (+ `caret-native`) | composer UI + native workbench contrib |
| `~/caret-work/upstream-synara/apps/caret-daemon` | `caret-adapter` | daemon ทั้งก้อน |
| control repo (ตรงนี้) | `main` | docs, `backlog/` evidence, requirement graph, CI |

Toolchain: `~/.caret-tools/node-v24.18.0-darwin-arm64`, `~/.bun`, `~/.opencode`, `~/.local/bin/codex`

## คำสั่งหลัก

- `node scripts/ci-validate.mjs` — gate ของ control repo
- `bun x vitest run apps/caret-daemon/src/` (จาก `upstream-synara`) — daemon suite
- `node_modules/.bin/tsc -p src/tsconfig.json --noEmit` (จาก `caret-desktop`) — fork typecheck
