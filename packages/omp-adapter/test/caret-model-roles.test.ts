import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OmpRpcClient } from "../src/client.ts";
import { CARET_UI_COMMAND_TYPES } from "../src/types.ts";

/**
 * The role surface only exists in Caret's pinned OMP patch, so this runs against
 * the prepared runtime rather than whatever `omp` is on PATH (a stock binary
 * correctly refuses these commands). Skipped when the runtime is not built.
 */
const prepared = process.env.CARET_OMP_BINARY ?? join(import.meta.dir, "../../../dist/omp/omp");
const available = existsSync(prepared);

/**
 * A throwaway agent directory per client. This test writes a role, and writing
 * into the user's real config is not acceptable in a test - nor is it
 * meaningful, because an isolated directory is the only way to tell "the write
 * landed on disk" from "this process still remembers it".
 */
function isolatedEnv(): { env: NodeJS.ProcessEnv; dispose: () => void } {
	const dir = mkdtempSync(join(tmpdir(), "caret-role-test-"));
	// A local provider keeps the runtime provider-free while still allowing an
	// assignment to be written and read back.
	writeFileSync(join(dir, "models.yml"), `providers:\n  caret-role-fixture:\n    baseUrl: http://127.0.0.1:9/v1\n    auth: none\n    api: openai-completions\n    models:\n      - id: caret-role-fixture-model\n        name: Caret role fixture\n        api: openai-completions\n        reasoning: false\n        input: [text]\n        cost: {input: 0, output: 0, cacheRead: 0, cacheWrite: 0}\n        contextWindow: 128000\n        maxTokens: 4096\n`, { mode: 0o600 });
	return {
		env: { ...process.env, HOME: dir, PI_CODING_AGENT_DIR: dir, PI_NO_PTY: "1", PI_NOTIFICATIONS: "off" },
		dispose: () => rmSync(dir, { recursive: true, force: true }),
	};
}

const start = (env: NodeJS.ProcessEnv) => OmpRpcClient.start({
	executable: prepared,
	cwd: join(import.meta.dir, "../../.."),
	args: ["--no-title"],
	env,
	readyTimeoutMs: 60_000,
	requestTimeoutMs: 60_000,
});

describe.skipIf(!available)("Caret model-role bridge on the prepared runtime", () => {
	it("advertises the role surface in its ready frame", async () => {
		const isolated = isolatedEnv();
		const client = await start(isolated.env);
		try {
			expect(client.readyFrame?.caretModelRolesVersion).toBe(1);
		} finally {
			await client.close();
			isolated.dispose();
		}
	});

	it("lists configured roles with the layer each one came from", async () => {
		const isolated = isolatedEnv();
		const client = await start(isolated.env);
		try {
			const data = (await client.requestCaret("caret_get_model_roles", {})).data as { roles: unknown[]; storage?: string };
			expect(Array.isArray(data.roles)).toBe(true);
			// The projection never invents a role, so any row must name its source.
			for (const role of data.roles as Array<{ source?: string }>) expect(typeof role.source).toBe("string");
		} finally {
			await client.close();
			isolated.dispose();
		}
	});

	it("persists an assignment before it answers, so a client may exit on the ack", async () => {
		const isolated = isolatedEnv();
		// Start from a known state: assign a role, then exit on the ack. If the
		// write is only queued when the answer goes out, closing here discards it.
		const first = await start(isolated.env);
		const assigned = await first.requestCaret("caret_set_model_role", { role: "task", modelId: "caret-role-fixture/caret-role-fixture-model" });
		expect((assigned.data as { roles: Array<{ role: string }> }).roles.some(entry => entry.role === "task")).toBe(true);
		await first.close();

		// A fresh process reads from disk only; in-memory state from the writer is
		// gone, so this is the assertion that a lost debounced save fails.
		const second = await start(isolated.env);
		try {
			const after = (await second.requestCaret("caret_get_model_roles", {})).data as { roles: Array<{ role: string; modelId: string }> };
			expect(after.roles.find(entry => entry.role === "task")?.modelId).toBe("caret-role-fixture/caret-role-fixture-model");

			// Clearing must be durable for the same reason.
			await second.requestCaret("caret_set_model_role", { role: "task", modelId: null });
		} finally {
			await second.close();
		}
		const third = await start(isolated.env);
		try {
			const cleared = (await third.requestCaret("caret_get_model_roles", {})).data as { roles: Array<{ role: string }> };
			expect(cleared.roles.some(entry => entry.role === "task")).toBe(false);
		} finally {
			await third.close();
			isolated.dispose();
		}
	});

	it("keeps the role commands inside the Caret patch surface, never the stock command list", () => {
		// The stock inventory is captured from an unpatched OMP; these two must stay
		// on the Caret side of that boundary or a host would send them to a stock
		// runtime that cannot answer.
		expect(CARET_UI_COMMAND_TYPES).toContain("caret_get_model_roles");
		expect(CARET_UI_COMMAND_TYPES).toContain("caret_set_model_role");
	});
});
