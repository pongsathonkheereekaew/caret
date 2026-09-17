import { test, expect } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
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

test("DELETE removes a task, its transcript directory, and 404s the id afterwards", async () => {
  const stateDir = mkdtempSync(join(tmpdir(), "caret-http-delete-"));
  const projectPath = join(stateDir, "project");
  mkdirSync(projectPath, { recursive: true });
  const server = await startHostServer({ stateDir });
  const headers = { Authorization: `Bearer ${server.descriptor.token}`, "Content-Type": "application/json" };
  try {
    const project = await (await fetch(`${server.descriptor.url}/v1/projects`, { method: "POST", headers, body: JSON.stringify({ path: projectPath }) })).json() as { id: string };
    const session = await (await fetch(`${server.descriptor.url}/v1/sessions`, { method: "POST", headers, body: JSON.stringify({ projectId: project.id, title: "Delete me" }) })).json() as { id: string };
    const transcript = join(stateDir, "sessions", session.id);
    expect(existsSync(transcript)).toBe(true);
    const deleted = await fetch(`${server.descriptor.url}/v1/sessions/${session.id}`, { method: "DELETE", headers });
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toMatchObject({ deleted: true });
    expect(existsSync(transcript)).toBe(false);
    expect((await fetch(`${server.descriptor.url}/v1/sessions/${session.id}`, { headers })).status).toBe(404);
    expect((await fetch(`${server.descriptor.url}/v1/sessions/${session.id}`, { method: "DELETE", headers })).status).toBe(404);
  } finally { await server.close(); rmSync(stateDir, { recursive: true, force: true }); }
});
