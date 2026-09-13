import { test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startHostServer } from "../src/server.ts";

test("loopback HTTP authenticates all reads, rejects browser origins and revokes controller access", async () => {
  const stateDir = mkdtempSync(join(tmpdir(), "caret-http-"));
  const server = await startHostServer({ stateDir });
  try {
    const url = `${server.descriptor.url}/v1/health`;
    const headers = { Authorization: `Bearer ${server.descriptor.token}` };
    expect((await fetch(url)).status).toBe(401);
    expect((await fetch(url, { headers })).status).toBe(200);
    expect((await fetch(url, { headers: { ...headers, Origin: "https://malicious.example" } })).status).toBe(403);
    const issued = server.auth.issue("Fixture phone");
    const phone = { Authorization: `Bearer ${issued.token}` };
    expect((await fetch(url, { headers: phone })).status).toBe(200);
    server.auth.revoke(issued.device.id);
    expect((await fetch(url, { headers: phone })).status).toBe(401);
    expect((await fetch(`${server.descriptor.url}/v1/projects`, { method: "POST", headers, body: "{" })).status).toBe(400);
  } finally { await server.close(); rmSync(stateDir, { recursive: true, force: true }); }
});
