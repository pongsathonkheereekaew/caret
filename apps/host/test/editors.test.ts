import { afterEach, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EditorConnections } from "../src/editors.ts";
import type { EditorResponse } from "../../../packages/protocol/src/editor.ts";

const directories: string[] = [];
const bridges: EditorConnections[] = [];

function fixtureRoots(): { root: string; other: string } {
	const root = mkdtempSync(join(tmpdir(), "cedia-editor-"));
	const other = mkdtempSync(join(tmpdir(), "cedia-editor-other-"));
	directories.push(root, other);
	mkdirSync(join(root, "nested"), { recursive: true });
	writeFileSync(join(root, "nested", "document.txt"), "fixture\n");
	return { root, other };
}

afterEach(() => {
	for (const bridge of bridges.splice(0)) bridge.close();
	for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

it("routes each native editor request to the matching window exactly once", async () => {
	const { root, other } = fixtureRoots();
	const bridge = new EditorConnections();
	bridges.push(bridge);
	bridge.register("window-a", [root]);
	bridge.register("window-b", [other]);

	const pending = bridge.request(root, { kind: "read", path: "nested/document.txt" }, new AbortController().signal);
	const deliveredToB = bridge.poll("window-b");
	expect(deliveredToB).toEqual([]);
	const deliveredToA = bridge.poll("window-a");
	expect(deliveredToA).toHaveLength(1);
	expect(deliveredToA[0]).toMatchObject({ kind: "read", protocolVersion: 1, path: join(realpathSync(root), "nested", "document.txt") });
	// Polling again must not replay a request already handed to the editor.
	expect(bridge.poll("window-a")).toEqual([]);

	const response = { kind: "read", requestId: deliveredToA[0]!.requestId, document: {} } as unknown as EditorResponse;
	expect(() => bridge.respond("window-b", response)).toThrow(/stale/i);
	// A response from the correct window still resolves after the isolation check.
	bridge.respond("window-a", response);
	await expect(pending).resolves.toBe(response);
});

it("cancels an undelivered native request without leaving a replayable entry", async () => {
	const { root } = fixtureRoots();
	const bridge = new EditorConnections();
	bridges.push(bridge);
	bridge.register("window-a", [root]);
	const controller = new AbortController();
	const pending = bridge.request(root, { kind: "inventory" }, controller.signal);
	controller.abort();
	await expect(pending).rejects.toThrow(/cancelled/i);
	// The aborted request is removed before any editor poll can deliver it.
	expect(bridge.poll("window-a")).toEqual([]);
});

it("cancels a delivered native request and invalidates its response token", async () => {
	const { root } = fixtureRoots();
	const bridge = new EditorConnections();
	bridges.push(bridge);
	bridge.register("window-a", [root]);
	const controller = new AbortController();
	const pending = bridge.request(root, { kind: "inventory" }, controller.signal);
	const delivered = bridge.poll("window-a");
	expect(delivered).toHaveLength(1);
	const requestId = delivered[0]!.requestId;
	expect(bridge.valid("window-a", requestId)).toBe(true);

	controller.abort();
	await expect(pending).rejects.toThrow(/cancelled/i);
	expect(bridge.valid("window-a", requestId)).toBe(false);
	expect(() => bridge.respond("window-a", { requestId } as unknown as EditorResponse)).toThrow(/stale/i);
	expect(bridge.poll("window-a")).toEqual([]);
});

it("marks a delivered response invalid once its monotonic deadline passes", async () => {
	const { root } = fixtureRoots();
	const bridge = new EditorConnections();
	bridges.push(bridge);
	bridge.register("window-a", [root]);
	const controller = new AbortController();
	const originalNow = performance.now;
	let now = 100;
	performance.now = () => now;
	try {
		const pending = bridge.request(root, { kind: "inventory" }, controller.signal);
		const delivered = bridge.poll("window-a");
		expect(delivered).toHaveLength(1);
		const requestId = delivered[0]!.requestId;
		expect(bridge.valid("window-a", requestId)).toBe(true);

		now += 30_001;
		expect(bridge.valid("window-a", requestId)).toBe(false);
		expect(() => bridge.respond("window-a", { requestId } as unknown as EditorResponse)).toThrow(/stale/i);
		controller.abort();
		await expect(pending).rejects.toThrow(/cancelled/i);
	} finally {
		performance.now = originalNow;
	}
});

it("times out a delivered native request and does not replay it", async () => {
	const { root } = fixtureRoots();
	const bridge = new EditorConnections();
	bridges.push(bridge);
	bridge.register("window-a", [root]);

	// The production deadline is intentionally 30 seconds. Clamp only this
	// test's timer so timeout cleanup is exercised without slowing the suite.
	const originalSetTimeout = globalThis.setTimeout;
	(globalThis as unknown as { setTimeout: typeof setTimeout }).setTimeout = ((handler: TimerHandler, timeout?: number, ...arguments_: unknown[]) =>
		originalSetTimeout(handler, Math.min(timeout ?? 0, 5), ...arguments_)) as typeof setTimeout;
	try {
		const pending = bridge.request(root, { kind: "read", path: "nested/document.txt" }, new AbortController().signal);
		const delivered = bridge.poll("window-a");
		expect(delivered).toHaveLength(1);
		await expect(pending).rejects.toThrow(/timed out/i);
		expect(bridge.poll("window-a")).toEqual([]);
	} finally {
		(globalThis as unknown as { setTimeout: typeof setTimeout }).setTimeout = originalSetTimeout;
	}
});


it("reclaims expired window registrations while preserving active windows", () => {
  const { root } = fixtureRoots();
  const bridge = new EditorConnections(); bridges.push(bridge);
  const originalNow = Date.now; let now = originalNow(); Date.now = () => now;
  try {
    bridge.register("active", [root]);
    for (let index = 0; index < 150; index++) {
      bridge.register(`old-${index}`, [root]);
      now += 6000; bridge.poll("active");
    }
    expect(() => bridge.register("new", [root])).not.toThrow();
    expect(bridge.poll("active")).toEqual([]);
  } finally { Date.now = originalNow; }
});
