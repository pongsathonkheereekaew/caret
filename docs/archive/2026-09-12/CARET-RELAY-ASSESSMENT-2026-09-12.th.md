# Caret — Paseo relay assessment

> Archived 12 September 2026 evidence. Living map: [docs/README.md](../../README.md).

ตรวจ 2026-09-12. Paseo source pin [`d1b705a0cd91617a5707fae25d80cb0be3057950`](https://github.com/getpaseo/paseo/tree/d1b705a0cd91617a5707fae25d80cb0be3057950); relay pin [`3fc41c96c8c63f3a7109e832899cc57d473c4531`](https://github.com/getpaseo/paseo-relay/tree/3fc41c96c8c63f3a7109e832899cc57d473c4531). Source review ไม่ใช่ผลต่อ Caret/iPhone ผ่าน hosted relay

## ข้อสรุปสำหรับงบและการ reuse

Paseo รันงานบนเครื่องผู้ใช้และให้ optional hosted relay ส่ง encrypted traffic จึงไม่ต้องเช่าเครื่องรัน agent เพิ่มเพื่อเชื่อมจากมือถือ. [เว็บไซต์](https://paseo.sh/) ระบุว่า Paseo free/open source; [connectivity](https://paseo.sh/docs/connectivity) อธิบายเส้นทางโดยไม่ใช้ VPN/port forwarding. ค่า model/provider เป็นคนละบริการ

[Terms วันที่ 2026-08-29](https://paseo.sh/terms) แยก Apache-2.0 software จาก hosted services: relay มี fair-use/availability limits และเปลี่ยนข้อจำกัดได้. ไม่พบข้อรับรอง custom clients แบบ explicit หรือราคา/โควตา relay ที่รับประกันตลอดไป. ดังนั้น hosted relay เป็น candidate แรกสำหรับ Caret ที่ไม่มี infrastructure เพิ่ม แต่ต้องพิสูจน์ interop และใช้ภายใต้ Terms; source license ไม่ใช่ entitlement ของ endpoint

หาก candidate ใช้ไม่ได้ให้คง remote acceptance เป็น open gate. LAN ใช้ debug/fallback ที่บ้านได้ แต่ไม่ผ่าน requirement นอกบ้าน; Tailscale ต้องมี VPN เพิ่มและ self-host relay ต้องมี infrastructure จึงไม่ใช่คำตอบแทนตาม constraint ปัจจุบัน. ไม่ provision หรือซื้อบริการในรอบนี้

## Protocol ที่ใช้ศึกษา

Source pointers ด้านล่างอ้าง Paseo pin ข้างต้น:

| Contract | Source | สิ่งที่นำไปทำ |
|---|---|---|
| Pairing offer v2: serverId, daemonPublicKeyB64, endpoint/TLS | `packages/protocol/src/connection-offer.ts:1–58`, `packages/server/src/server/pairing-offer.ts:1–60` | แยก connection coordinates กับ device authorization; ไม่แชร์ offer เป็น public link |
| WebSocket route v2 | `packages/protocol/src/daemon-endpoints.ts:176–205` | Custom client ใช้ public protocol ได้ในเชิง source; ยังต้อง live interop test |
| NaCl E2EE handshake/channel | `packages/relay/src/crypto.ts`, `encrypted-channel.ts:119–170` | Reuse audited-library primitives; ไม่ออกแบบ crypto เอง; verify server identity/key changes |
| Application hello/reconnect | `packages/client/src/daemon-client.ts:5794–5815` | Client/server protocol compatibility และ reconnect; ไม่ถือ reconnect เท่ากับ durable execution dedup |
| SDK client configuration | `packages/client/src/daemon-client.ts:318–347` | Relay pairing/E2EE path ไม่พบ account-login requirement; optional password/authHeader สำหรับ transport ที่รองรับไม่ใช่ relay account |

E2EE ไม่ใช่ per-device authorization โดยตัวมันเอง. [SECURITY.md](https://github.com/getpaseo/paseo/blob/d1b705a0cd91617a5707fae25d80cb0be3057950/SECURITY.md) ระบุ ephemeral phone keys และไม่มี replay protection ภายใน live session. Caret ต้องเพิ่ม approved-device identity, host confirmation, revoke และ durable command IDs/sequence. Fresh connection key ไม่ใช่หลักฐานว่า device เคยได้รับอนุญาต. Device revoked ต้องไม่ได้ events/artifacts ด้วย

## Artifact/backpressure

Relay source [README](https://github.com/getpaseo/paseo-relay/blob/3fc41c96c8c63f3a7109e832899cc57d473c4531/README.md) ระบุ physical WebSocket frame ceiling 32 MiB และ control input 64 KiB; encryption/framing ลดพื้นที่ข้อมูลจริง. Paseo daemon architecture มี outbound high-water 8 MiB และ terminal soft threshold 4 MiB; channel มี handshake queue limit 200 sends. ขนาดเหล่านี้เป็น upstream limits ไม่ใช่ safe chunk size ของ Caret

Caret ต้องกำหนด chunks ที่เล็กกว่าข้อจำกัดต่ำสุดอย่างชัดเจน, bounded queue/backpressure, manifest/hash และ resume acknowledgements; ห้ามส่ง preview/audio bundle ใหญ่ใน frame เดียว. ทดสอบ binary/text encoding, connection drop, checksum mismatch และ download atomicity ก่อนใช้ assets จริง

## Gate ก่อนนับว่ารองรับ

1. Local fixture: pair, authenticated device allowlist, encrypted hello, duplicate/reordered/replayed commands, key change/revoke และ reconnect
2. Artifact fixture: bounds/backpressure, partial upload/download, verified hashes และ resume ไม่ปน build
3. Hosted interop: Caret host/client ตาม pinned protocol, ตรวจ endpoint/Terms ณ วันใช้งาน, no account/fee assumptions ที่ไม่ได้ทดสอบ
4. Real iPhone: cellular, Wi-Fi transition, app background/foreground, host restart และ revoked-device denial; no duplicate mutation หลัง dropped ACK

การตอบ health/ready ของ relay เป็นเพียง liveness ไม่ยืนยันสิทธิ์, capacity, SLA, security หรือ acceptance ของ Caret
