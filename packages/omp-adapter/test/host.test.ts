import { afterEach, describe, expect, it } from "bun:test";
import {
	OmpHostDispatcher,
	OmpHostCapacityError,
	OmpHostDisposedError,
	OmpHostProtocolError,
	type OmpHostToolCallRequest,
	type OmpHostToolCancelRequest,
	type OmpHostUriRequest,
	type OmpHostUriCancelRequest,
} from "../src/host.ts";

const bridges: OmpHostDispatcher[] = [];

function makeBridge(options: Partial<ConstructorParameters<typeof OmpHostDispatcher>[0]> = {}): {
	bridge: OmpHostDispatcher;
	frames: Record<string, unknown>[];
	errors: Array<{ error: Error; phase: string; id?: string }>;
} {
	const frames: Record<string, unknown>[] = [];
	const errors: Array<{ error: Error; phase: string; id?: string }> = [];
	const bridge = new OmpHostDispatcher({
		send: frame => { frames.push({ ...frame }); },
		authorize: () => true,
		onError: (error, context) => errors.push({ error, phase: context.phase, id: context.id }),
		...options,
	});
	bridges.push(bridge);
	return { bridge, frames, errors };
}

function toolCall(id = "tool-1", toolName = "fixture_tool", args: Record<string, unknown> = { value: 2 }): OmpHostToolCallRequest {
	return { type: "host_tool_call", id, toolCallId: `call-${id}`, toolName, arguments: args };
}

function uriRequest(
	id: string,
	operation: "read" | "write" = "read",
	content?: string,
): OmpHostUriRequest {
	const frame: OmpHostUriRequest = { type: "host_uri_request", id, operation, url: "fixture://document" };
	if (operation === "write" && content !== undefined) frame.content = content;
	return frame;
}

async function waitFor(predicate: () => boolean, timeoutMs = 500): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (!predicate()) {
		if (Date.now() >= deadline) throw new Error("timed out waiting for host bridge event");
		await new Promise(resolve => setTimeout(resolve, 1));
	}
}

afterEach(() => {
	for (const bridge of bridges.splice(0)) bridge.dispose();
});

describe("OmpHostDispatcher", () => {
	it("requires explicit authorization and freezes the exact nested request before effects", async () => {
		const authRequests: Record<string, unknown>[] = [];
		const effects: Record<string, unknown>[] = [];
		const frames: Record<string, unknown>[] = [];
		const bridge = new OmpHostDispatcher({
			send: frame => { frames.push({ ...frame }); },
			authorize: request => {
				authRequests.push(request);
				expect(Object.isFrozen(request)).toBe(true);
				expect(Object.isFrozen((request as { arguments: unknown }).arguments)).toBe(true);
				return true;
			},
		});
		bridges.push(bridge);
		bridge.registerTool({
			definition: { name: "fixture_tool", description: "fixture", parameters: { type: "object" } },
			handler: async (request, context) => {
				effects.push(request);
				expect(request).toMatchObject({ arguments: { value: 2 } });
				expect(context.request).toBe(request);
				return { content: [{ type: "text", text: "ok" }] };
			},
		});
		const raw = toolCall();
		await bridge.handle(raw);
		expect(authRequests).toHaveLength(1);
		expect(effects).toHaveLength(1);
		expect(frames).toEqual([
			{ type: "host_tool_result", id: "tool-1", result: { content: [{ type: "text", text: "ok" }] } },
		]);
		expect(bridge.getToolDefinitions()).toEqual([
			{ name: "fixture_tool", label: "fixture_tool", description: "fixture", parameters: { type: "object" }, hidden: false, loadMode: "discoverable" },
		]);
		expect(Object.isFrozen(bridge.getToolDefinitions()[0]!)).toBe(true);
	});

	it("denies before invoking a handler and propagates authorization errors", async () => {
		const denied = makeBridge({ authorize: () => false });
		let effects = 0;
		denied.bridge.registerTool({
			definition: { name: "fixture_tool", description: "fixture", parameters: {} },
			handler: () => { effects++; return { content: [] }; },
		});
		await denied.bridge.handle(toolCall());
		expect(effects).toBe(0);
		expect(denied.frames[0]).toMatchObject({ type: "host_tool_result", id: "tool-1", isError: true });
		expect((denied.frames[0]!.result as { content: Array<{ text: string }> }).content[0]!.text).toMatch(/denied/);

		const rejected = makeBridge({ authorize: () => Promise.reject(new Error("policy unavailable")) });
		rejected.bridge.registerTool({
			definition: { name: "fixture_tool", description: "fixture", parameters: {} },
			handler: () => { throw new Error("must not run"); },
		});
		await rejected.bridge.handle(toolCall("tool-rejected"));
		expect(rejected.frames[0]).toMatchObject({ type: "host_tool_result", id: "tool-rejected", isError: true });
		expect(rejected.errors.some(entry => entry.phase === "authorization")).toBe(true);
	});

	it("delivers cancellation to a handler and suppresses stale completion and updates", async () => {
		const { bridge, frames, errors } = makeBridge();
		bridge.registerTool({
			definition: { name: "fixture_tool", description: "fixture", parameters: {} },
			handler: async (_request, context) => {
				await context.update({ content: [{ type: "text", text: "before wait" }] });
				await new Promise(resolve => setTimeout(resolve, 25));
				if (context.signal.aborted) {
					await context.update({ content: [{ type: "text", text: "late update" }] });
					return { content: [{ type: "text", text: "late result" }] };
				}
				return { content: [{ type: "text", text: "unexpected" }] };
			},
		});
		const pending = bridge.handle(toolCall("tool-cancelled"));
		await waitFor(() => bridge.pendingCount === 1);
		const cancel: OmpHostToolCancelRequest = { type: "host_tool_cancel", id: "cancel-1", targetId: "tool-cancelled" };
		await bridge.handle(cancel);
		await pending;
		await new Promise(resolve => setTimeout(resolve, 40));
		expect(frames).toEqual([]);
		expect(errors.some(entry => entry.phase === "cancel")).toBe(false);
	});

	it("rejects duplicate request IDs, including IDs that already completed", async () => {
		const { bridge, frames, errors } = makeBridge();
		let effects = 0;
		bridge.registerTool({
			definition: { name: "fixture_tool", description: "fixture", parameters: {} },
			handler: () => { effects++; return { content: [{ type: "text", text: "done" }] }; },
		});
		await bridge.handle(toolCall("same-id"));
		await bridge.handle(toolCall("same-id"));
		expect(effects).toBe(1);
		expect(frames).toHaveLength(1);
		expect(errors.some(entry => entry.error instanceof OmpHostProtocolError && entry.error.message.includes("Duplicate"))).toBe(true);
	});

	it("gates URI writes, serves reads, and rejects malformed writes", async () => {
		const { bridge, frames } = makeBridge();
		let writes = 0;
		bridge.registerUriScheme({
			definition: { scheme: "fixture", writable: false },
			read: request => ({ content: `read:${request.url}`, contentType: "text/plain", notes: ["fixture"] }),
			write: () => { writes++; },
		});
		await bridge.handle(uriRequest("uri-read"));
		expect(frames[0]).toEqual({
			type: "host_uri_result", id: "uri-read", content: "read:fixture://document", contentType: "text/plain", notes: ["fixture"],
		});
		await bridge.handle(uriRequest("uri-write-gated", "write", "content"));
		expect(frames[1]).toMatchObject({ type: "host_uri_result", id: "uri-write-gated", isError: true });
		expect(writes).toBe(0);
		await bridge.handle({ type: "host_uri_request", id: "uri-write-malformed", operation: "write", url: "fixture://document" });
		expect(frames[2]).toMatchObject({ type: "host_uri_result", id: "uri-write-malformed", isError: true });
	});

	it("sends updates and handler errors, while observing send failures without rejection", async () => {
		const errors: Array<{ error: Error; phase: string }> = [];
		let sendCalls = 0;
		const bridge = new OmpHostDispatcher({
			send: _frame => { sendCalls++; throw new Error("transport down"); },
			authorize: () => true,
			onError: (error, context) => errors.push({ error, phase: context.phase }),
		});
		bridges.push(bridge);
		bridge.registerTool({
			definition: { name: "fixture_tool", description: "fixture", parameters: {} },
			handler: async (_request, context) => {
				await context.update({ content: [{ type: "text", text: "progress" }] });
				throw new Error("fixture failed");
			},
		});
		await expect(bridge.handle(toolCall("send-error"))).resolves.toBe(true);
		expect(sendCalls).toBe(1);
		expect(errors.filter(entry => entry.phase === "send")).toHaveLength(1);

		const malformed = makeBridge();
		malformed.bridge.registerTool({
			definition: { name: "fixture_tool", description: "fixture", parameters: {} },
			handler: () => ({ invalid: true }),
		});
		await malformed.bridge.handle(toolCall("bad-result"));
		expect(malformed.frames[0]).toMatchObject({ type: "host_tool_result", id: "bad-result", isError: true });
	});

	it("bounds deduplication without evicting completed IDs", async () => {
		const { bridge, frames, errors } = makeBridge({ maxRequestIds: 1 });
		bridge.registerTool({
			definition: { name: "fixture_tool", description: "fixture", parameters: {} },
			handler: () => ({ content: [] }),
		});
		await bridge.handle(toolCall("first"));
		await bridge.handle(toolCall("second"));
		await bridge.handle(toolCall("first"));
		expect(frames).toHaveLength(2);
		expect(frames[1]).toMatchObject({ type: "host_tool_result", id: "second", isError: true });
		expect(errors.some(entry => entry.error instanceof OmpHostCapacityError)).toBe(true);
		expect(errors.some(entry => entry.error instanceof OmpHostProtocolError && entry.error.message.includes("Duplicate"))).toBe(true);
	});

	it("disposes pending handlers, prevents future effects, and handles URI cancellation", async () => {
		const { bridge, frames, errors } = makeBridge();
		let signal: AbortSignal | undefined;
		bridge.registerUriScheme({
			definition: { scheme: "fixture", writable: true },
			read: async (_request, context) => {
				signal = context.signal;
				await new Promise(resolve => setTimeout(resolve, 30));
				return { content: "late" };
			},
			write: async () => {},
		});
		const pending = bridge.handle(uriRequest("uri-cancel"));
		await waitFor(() => bridge.pendingCount === 1);
		const cancel: OmpHostUriCancelRequest = { type: "host_uri_cancel", id: "uri-cancel-frame", targetId: "uri-cancel" };
		await bridge.handle(cancel);
		await pending;
		expect(signal?.aborted).toBe(true);
		expect(frames).toEqual([]);

		bridge.dispose();
		await expect(bridge.handle(toolCall("after-dispose"))).resolves.toBe(false);
		expect(errors.some(entry => entry.error instanceof OmpHostDisposedError)).toBe(true);
	});

	it("times out an authorization or handler that ignores its signal", async () => {
		const { bridge, frames } = makeBridge({ requestTimeoutMs: 15 });
		bridge.registerTool({
			definition: { name: "fixture_tool", description: "fixture", parameters: {} },
			handler: async () => new Promise(() => {}),
		});
		await bridge.handle(toolCall("timeout"));
		expect(frames[0]).toMatchObject({ type: "host_tool_result", id: "timeout", isError: true });
	});
});
