import { describe, expect, it } from "bun:test";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CaretHostClient, readHostDescriptor, validateHostDescriptor } from "../src/api.ts";

function response(status: number, body: unknown): Response {
	return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("Caret host HTTP client", () => {
	it("refuses external or credential-bearing descriptors before attaching owner auth", () => {
		for (const url of ["https://example.com", "http://127.0.0.1@evil.example", "http://user@127.0.0.1:1", "http://127.0.0.1:1/proxy", "http://127.0.0.1:1/?token=other"]) {
			expect(() => validateHostDescriptor({ protocolVersion: 1, url, token: "secret", pid: 123 })).toThrow("local 127.0.0.1");
		}
	});
	it("attaches bearer auth and uses the versioned API paths", async () => {
		const calls: Array<{ url: string; init?: RequestInit }> = [];
		const client = new CaretHostClient({
			descriptor: { protocolVersion: 1, url: "http://127.0.0.1:9876", token: "secret", pid: 123 },
			fetch: async (url, init) => { calls.push({ url: String(url), init }); return response(200, []); },
		});
		await client.listProjects();
		expect(calls[0]?.url).toBe("http://127.0.0.1:9876/v1/projects");
		expect(new Headers(calls[0]?.init?.headers).get("authorization")).toBe("Bearer secret");
		expect(calls[0]?.init?.method).toBe("GET");
	});

	it("encodes session IDs, sends JSON commands, and surfaces structured errors", async () => {
		const calls: Array<{ url: string; init?: RequestInit }> = [];
		const client = new CaretHostClient({
			descriptor: { protocolVersion: 1, url: "http://127.0.0.1:9876/", token: "secret", pid: 123 },
			fetch: async (url, init) => {
				calls.push({ url: String(url), init });
				if (String(url).includes("commands")) return response(409, { error: { code: "command_conflict", message: "already claimed" } });
				return response(200, { id: "s", projectId: "p", title: "Task", incarnation: "i" });
			},
		});
		await expect(client.getSession("session/one")).resolves.toMatchObject({ id: "s" });
		await expect(client.sendCommand("session/one", { commandId: "c", incarnation: "i", command: "prompt", payload: { message: "go" } })).rejects.toMatchObject({ status: 409, code: "command_conflict" });
		expect(calls[0]?.url).toBe("http://127.0.0.1:9876/v1/sessions/session%2Fone");
		const body = JSON.parse(String(calls[1]?.init?.body));
		expect(body).toMatchObject({ commandId: "c", incarnation: "i", command: "prompt" });
		expect(calls[1]?.url).toBe("http://127.0.0.1:9876/v1/sessions/session%2Fone/commands");
	});

	it("reads a private descriptor and refuses an invalid one", async () => {
		const dir = join(tmpdir(), `caret-host-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		await mkdir(dir, { recursive: true });
		const file = join(dir, "host.json");
		await writeFile(file, JSON.stringify({ protocolVersion: 1, url: "http://127.0.0.1:1", token: "t", pid: 42 }), { mode: 0o600 });
		await chmod(file, 0o600);
		expect(await readHostDescriptor(dir, { requirePrivateMode: true })).toMatchObject({ protocolVersion: 1, token: "t" });
		await writeFile(file, JSON.stringify({ protocolVersion: 2, url: "http://127.0.0.1:1", token: "t", pid: 42 }));
		await expect(readHostDescriptor(dir)).rejects.toThrow(/unsupported host protocol/);
	});
});
