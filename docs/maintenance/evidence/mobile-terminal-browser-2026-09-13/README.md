# Mobile terminal browser fixture — 13 กันยายน 2026

Desktop Chromium เปิด `scripts/mobile-terminal-browser-smoke.ts` ที่ `http://127.0.0.1:63175/` แล้วกด Replay / Live / Send status queries รวม OSC `?;?` และ OSC 4

ผล:

- iframe แสดง `Initial screen` และ `Live output continues`
- renderer messages มีแค่ `ready` ของ `browser-fixture` ไม่มี `input` หลัง status queries
- ไม่ใช่ iPhone / cellular และไม่ใช่ checkpoint/full scrollback restoration

หลักฐาน: [`receipt.json`](./receipt.json), [`fixture.png`](./fixture.png)
