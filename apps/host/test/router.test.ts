import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RPC_COMMAND_TYPES } from "../../../packages/omp-adapter/src/types.ts";
import { DeviceAuth } from "../src/auth.ts";
import { createRouter, type HostResponse } from "../src/router.ts";
import { CediaHost } from "../src/service.ts";
import { DurableStore } from "../src/store.ts";
import { fileURLToPath } from "node:url";

const fixtureExecutable = fileURLToPath(new URL("./fixtures/fake-host-launcher", import.meta.url));
const fixtureNode = process.env.CEDIA_FIXTURE_NODE ?? process.execPath;

interface RouterFixture {
  directory: string;
  projectPath: string;
  store: DurableStore;
  host: CediaHost;
  auth: DeviceAuth;
  router: ReturnType<typeof createRouter>;
}

const fixtures: RouterFixture[] = [];
const directories: string[] = [];

function makeFixture(withOmp = false): RouterFixture {
  const directory = mkdtempSync(join(tmpdir(), "cedia-router-"));
  directories.push(directory);
  const projectPath = join(directory, "project");
  mkdirSync(projectPath, { recursive: true });
  const store = DurableStore.open({ stateDir: directory, recover: false });
  const auth = new DeviceAuth(join(directory, "devices"));
  const host = new CediaHost({ store, stateDir: directory, ...(withOmp ? { ompExecutable: fixtureExecutable, ompEnv: { CEDIA_NODE: fixtureNode } } : {}) });
  const fixture = { directory, projectPath, store, host, auth, router: createRouter(host, auth) };
  fixtures.push(fixture);
  return fixture;
}

async function request(fixture: RouterFixture, method: string, path: string, body?: unknown, token = fixture.auth.ownerToken): Promise<HostResponse> {
  return fixture.router({ method, path, token, ...(body === undefined ? {} : { body }) });
}

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    await fixture.host.close().catch(() => {});
    fixture.store.close();
  }
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("authenticated Cedia host router", () => {
	it("routes voice transcription through the OMP-owned endpoint", async () => {
		const fixture = makeFixture();
		const router = createRouter(fixture.host, fixture.auth, {
			voice: {
				transcribe: async input => ({ text: `transcribed:${input.audioBase64.slice(0, 4)}` }),
			},
		});
		const response = await router({
			method: "POST",
			path: "/v1/voice/transcribe",
			token: fixture.auth.ownerToken,
			body: {
				provider: "omp",
				cwd: fixture.projectPath,
				mimeType: "audio/wav",
				sampleRateHz: 16_000,
				durationMs: 400,
				audioBase64: "AQIDBA==",
			},
		});
		expect(response).toEqual({ status: 200, body: { text: "transcribed:AQID" } });
	});

	it("creates sidechats through the fork route and exposes the source marker in session reads", async () => {
    const fixture = makeFixture(true);
    const project = fixture.store.createProject({ path: fixture.projectPath, name: "Project" });
    const source = fixture.host.createSession(project.id, "Source");
    await fixture.host.startSession(source.id);
    const forked = await request(fixture, "POST", `/v1/sessions/${source.id}/fork`, { id: "router-sidechat", title: "Sidechat" });
    expect(forked).toMatchObject({ status: 200, body: { id: "router-sidechat", sidechatSourceThreadId: source.id } });
    const one = await request(fixture, "GET", "/v1/sessions/router-sidechat");
    expect(one).toMatchObject({ status: 200, body: { id: "router-sidechat", sidechatSourceThreadId: source.id } });
    const all = await request(fixture, "GET", "/v1/sessions");
    expect(all).toMatchObject({ status: 200, body: expect.arrayContaining([expect.objectContaining({ id: "router-sidechat", sidechatSourceThreadId: source.id })]) });
    const models = await request(fixture, "GET", "/v1/models");
    expect(models).toMatchObject({ status: 200, body: { source: "omp", models: expect.any(Array), cached: false } });
  });

  it("requires a device token and exposes only the negotiated health contract", async () => {
    const fixture = makeFixture();
    expect((await fixture.router({ method: "GET", path: "/v1/health" })).status).toBe(401);
    const health = await request(fixture, "GET", "/v1/health");
    expect(health).toEqual({ status: 200, body: { protocolVersion: 1, status: "ready", ompVersion: "18.1.18" } });
    expect((await request(fixture, "GET", "/v2/health")).status).toBe(404);

    const issued = fixture.auth.issue("Phone");
    fixture.auth.revoke(issued.device.id);
    expect((await request(fixture, "GET", "/v1/health", undefined, issued.token)).status).toBe(401);
  });

  it("keeps device management owner-only and protects owner credentials from revocation", async () => {
    const fixture = makeFixture();
    const controller = fixture.auth.issue("Phone");
    const forbidden = await request(fixture, "GET", "/v1/devices", undefined, controller.token);
    expect(forbidden).toMatchObject({ status: 403, body: { error: { code: "forbidden" } } });

    const created = await request(fixture, "POST", "/v1/devices", { name: "Tablet" });
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ device: { role: "controller", name: "Tablet" }, token: expect.any(String) });
    expect((created.body as { device: Record<string, unknown> }).device).not.toHaveProperty("tokenHash");

    const ownerId = fixture.auth.list().find(device => device.role === "owner")!.id;
    const revokeOwner = await request(fixture, "POST", `/v1/devices/${ownerId}/revoke`);
    expect(revokeOwner.status).toBe(400);
    expect((revokeOwner.body as { error: { code: string } }).error.code).toBe("request_failed");
    expect(fixture.auth.authenticate(fixture.auth.ownerToken)?.role).toBe("owner");
    expect((await request(fixture, "POST", `/v1/devices/${controller.device.id}/revoke`)).body).toEqual({ revoked: true });
  });

  it("validates project/session routes and serves bounded workspace files without traversal", async () => {
    const fixture = makeFixture();
    writeFileSync(join(fixture.projectPath, "hello.txt"), "hello from fixture\n");
    writeFileSync(join(fixture.projectPath, "binary.dat"), Buffer.from([0, 1, 2]));
    writeFileSync(join(fixture.directory, "outside.txt"), "outside\n");

    const createdProject = await request(fixture, "POST", "/v1/projects", { path: fixture.projectPath, name: "Project" });
    expect(createdProject.status).toBe(200);
    const project = createdProject.body as { id: string; path: string };
    expect(project.path).toBe(realpathSync(fixture.projectPath));
    expect((await request(fixture, "POST", "/v1/projects", [])).status).toBe(400);
    expect((await request(fixture, "PATCH", `/v1/projects/${project.id}`, { pinned: "yes" })).status).toBe(400);

    const listed = await request(fixture, "GET", "/v1/projects");
    expect(listed.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: project.id, name: "Project" })]));
    const createdSession = await request(fixture, "POST", "/v1/sessions", { projectId: project.id, title: "Task" });
    expect(createdSession.status).toBe(200);
    const session = createdSession.body as { id: string; incarnation: string };
    expect((await request(fixture, "GET", `/v1/sessions/${session.id}`)).body).toMatchObject({ id: session.id, projectId: project.id });

    const text = await request(fixture, "GET", `/v1/sessions/${session.id}/files?path=hello.txt`);
    expect(text).toEqual({ status: 200, body: { text: "hello from fixture\n", size: 19 } });
    const binary = await request(fixture, "GET", `/v1/sessions/${session.id}/files?path=binary.dat`);
    expect(binary).toEqual({ status: 200, body: { binary: true, size: 3 } });
    const directory = await request(fixture, "GET", `/v1/sessions/${session.id}/files?path=.`);
    expect(directory.status).toBe(200);
    expect(directory.body).toMatchObject({ entries: expect.arrayContaining([
      expect.objectContaining({ name: "hello.txt", directory: false, symlink: false }),
    ]) });
    const traversal = await request(fixture, "GET", `/v1/sessions/${session.id}/files?path=${encodeURIComponent("../outside.txt")}`);
    expect(traversal.status).toBe(400);
    expect((traversal.body as { error: { code: string } }).error.code).toBe("request_failed");
    expect((await request(fixture, "GET", `/v1/sessions/${session.id}/review`)).body).toMatchObject({ available: false });
    expect((await request(fixture, "GET", `/v1/sessions/${session.id}/ui`)).body).toEqual([]);
    expect((await request(fixture, "GET", `/v1/sessions/${session.id}/events`)).body).toMatchObject({ events: [], cursor: 0, hasMore: false });
    const invalid = await request(fixture, "POST", `/v1/sessions/${session.id}/commands`, { commandId: "bad", incarnation: session.incarnation, command: "not-omp" });
    expect(invalid).toMatchObject({ status: 400, body: { error: { code: "invalid_command" } } });
    expect(RPC_COMMAND_TYPES).toHaveLength(42);
    expect(new Set(RPC_COMMAND_TYPES).size).toBe(42);
    for (const command of RPC_COMMAND_TYPES) {
      const response = await request(fixture, "POST", `/v1/sessions/${session.id}/commands`, {
        commandId: `cmd-${command}`,
        incarnation: session.incarnation,
        command,
        payload: command === "switch_session" ? { sessionPath: "/tmp/not-owned.jsonl" } : {},
      });
      const code = (response.body as { error?: { code?: string } }).error?.code;
      expect(code).not.toBe("invalid_command");
      if (response.status === 200) {
        expect(response.body).toMatchObject({ commandId: `cmd-${command}`, status: "not_dispatched" });
      }
    }
    const notDispatched = await request(fixture, "POST", `/v1/sessions/${session.id}/commands`, { commandId: "queued", incarnation: session.incarnation, command: "prompt", payload: { message: "offline" } });
    expect(notDispatched).toMatchObject({ status: 200, body: { commandId: "queued", status: "not_dispatched" } });
    expect(existsSync(join(fixture.projectPath, "hello.txt"))).toBe(true);
  });

  it("serves the headless terminal checkpoint a reattaching client renders", async () => {
    const fixture = makeFixture();
    const project = fixture.store.createProject({ path: fixture.projectPath });
    const session = fixture.store.createSession({ projectId: project.id });
    // No OMP is running here, so the host's own answer is the empty list - an honest
    // one. The checkpoint shape itself is what this route contract pins.
    expect((await request(fixture, "GET", `/v1/sessions/${session.id}/terminals`)).body).toEqual({ terminals: [] });
    expect((await request(fixture, "GET", `/v1/sessions/not-a-session/terminals`)).status).toBe(404);

    const checkpoint = {
      terminalId: "pty-1",
      cols: 100,
      rows: 30,
      cursorRow: 2,
      cursorCol: 7,
      lines: ["$ npm test", "cedia-virtual-pty-output"],
      lastSequence: 12,
      closed: false,
      historyIncomplete: false,
    };
    Object.assign(fixture.host, { terminalSnapshots: () => [checkpoint] });
    const served = await request(fixture, "GET", `/v1/sessions/${session.id}/terminals`);
    expect(served.status).toBe(200);
    expect(served.body).toEqual({ terminals: [checkpoint] });
  });
});
