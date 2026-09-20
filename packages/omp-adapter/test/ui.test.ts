import { afterEach, describe, expect, it } from "bun:test";
import {
	ExtensionUiBroker,
	ExtensionUiBrokerError,
	type ExtensionUiBrokerOptions,
	type ExtensionUiEvent,
	type ExtensionUiPresentationEvent,
	type ExtensionUiInteractiveEvent,
} from "../src/ui.ts";

const brokers: ExtensionUiBroker[] = [];

function makeBroker(
	send: ExtensionUiBrokerOptions["send"] = () => {},
	onEvent?: (event: ExtensionUiEvent) => void | Promise<void>,
	extra: Pick<ExtensionUiBrokerOptions, "defaultTimeoutMs" | "maxDiagnostics" | "maxSeenRequestIds"> = {},
): ExtensionUiBroker {
	const broker = new ExtensionUiBroker({ send, onEvent, ...extra });
	brokers.push(broker);
	return broker;
}

function wait(milliseconds: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, milliseconds));
}

afterEach(() => {
	for (const broker of brokers.splice(0)) broker.dispose();
});

describe("ExtensionUiBroker", () => {
	it("routes typed interactive requests and sends an explicit denial", async () => {
		const responses: unknown[] = [];
		const events: ExtensionUiEvent[] = [];
		const broker = makeBroker(frame => {
			responses.push(frame);
		}, event => {
			events.push(event);
		});

		const result = broker.ingest({
			type: "extension_ui_request",
			id: "confirm-1",
			method: "confirm",
			title: "Continue?",
			message: "Run the next step?",
		});
		expect(result.accepted).toBe(true);
		expect(result.kind).toBe("interactive");
		if (!result.accepted || result.kind !== "interactive") throw new Error("expected interactive request");
		const event = events[0] as ExtensionUiInteractiveEvent;
		expect(event.kind).toBe("interactive");
		expect(event.request).toMatchObject({ method: "confirm", id: "confirm-1", title: "Continue?" });
		expect(Object.isFrozen(event.request)).toBe(true);
		expect(result.token).not.toBe("confirm-1");

		await broker.respond(result.token, false);
		expect(responses).toEqual([{ type: "extension_ui_response", id: "confirm-1", confirmed: false }]);
		expect(broker.pendingCount).toBe(0);
		await expect(broker.respond(result.token, true)).rejects.toMatchObject({ code: "stale-response" });
	});

	it("cancels explicitly and handles a server cancel target", async () => {
		const responses: unknown[] = [];
		const events: ExtensionUiEvent[] = [];
		const broker = makeBroker(frame => {
			responses.push(frame);
		}, event => {
			events.push(event);
		});

		const first = broker.ingest({
			type: "extension_ui_request",
			id: "select-1",
			method: "select",
			title: "Pick",
			options: ["one", "two"],
		});
		if (!first.accepted || first.kind !== "interactive") throw new Error("expected select request");
		await broker.cancel(first.token);
		expect(responses).toEqual([{ type: "extension_ui_response", id: "select-1", cancelled: true }]);
		await expect(broker.cancel(first.token)).rejects.toMatchObject({ code: "stale-response" });

		const second = broker.ingest({
			type: "extension_ui_request",
			id: "input-1",
			method: "input",
			title: "Name",
		});
		if (!second.accepted || second.kind !== "interactive") throw new Error("expected input request");
		const cancelled = broker.ingest({
			type: "extension_ui_request",
			id: "cancel-event",
			method: "cancel",
			targetId: "input-1",
		});
		expect(cancelled).toMatchObject({ accepted: true, kind: "server-cancel", token: second.token });
		expect(broker.pendingCount).toBe(0);
		expect(events.some(event => event.kind === "server-cancel")).toBe(true);
		await expect(broker.respond(second.token, "late answer")).rejects.toMatchObject({ code: "stale-response" });
	});

	it("turns a local timeout into one timed-out cancellation", async () => {
		const responses: unknown[] = [];
		const events: ExtensionUiEvent[] = [];
		const broker = makeBroker(frame => {
			responses.push(frame);
		}, event => {
			events.push(event);
		}, { defaultTimeoutMs: 5 });

		const result = broker.ingest({
			type: "extension_ui_request",
			id: "timeout-1",
			method: "confirm",
			title: "Wait",
			message: "This expires",
		});
		if (!result.accepted || result.kind !== "interactive") throw new Error("expected interactive request");
		await wait(25);
		expect(responses).toEqual([{ type: "extension_ui_response", id: "timeout-1", cancelled: true, timedOut: true }]);
		expect(events.some(event => event.kind === "timeout")).toBe(true);
		expect(broker.pendingCount).toBe(0);
		await expect(broker.respond(result.token, true)).rejects.toMatchObject({ code: "stale-response" });
	});

	it("invalidates old tokens on dispose and across a new broker incarnation", async () => {
		const old = makeBroker();
		const oldResult = old.ingest({ type: "extension_ui_request", id: "same-id", method: "input", title: "Old" });
		if (!oldResult.accepted || oldResult.kind !== "interactive") throw new Error("expected old request");
		old.dispose();
		await expect(old.respond(oldResult.token, "stale")).rejects.toMatchObject({ code: "stale-response" });

		const fresh = makeBroker();
		const freshResult = fresh.ingest({ type: "extension_ui_request", id: "same-id", method: "input", title: "Fresh" });
		if (!freshResult.accepted || freshResult.kind !== "interactive") throw new Error("expected fresh request");
		expect(freshResult.token).not.toBe(oldResult.token);
		await expect(fresh.respond(oldResult.token, "wrong broker")).rejects.toMatchObject({ code: "stale-response" });
		await fresh.respond(freshResult.token, "accepted");
	});

	it("rejects invalid answers, records unknown/invalid frames, and keeps the request pending", async () => {
		const events: ExtensionUiEvent[] = [];
		const broker = makeBroker(() => {}, event => {
			events.push(event);
		});
		const result = broker.ingest({
			type: "extension_ui_request",
			id: "select-2",
			method: "select",
			title: "Pick",
			options: ["A", "B"],
		});
		if (!result.accepted || result.kind !== "interactive") throw new Error("expected select request");
		await expect(broker.respond(result.token, "C")).rejects.toMatchObject({ code: "invalid-response" });
		expect(broker.pendingCount).toBe(1);
		await broker.respond(result.token, "A");

		const unknown = broker.ingest({ type: "extension_ui_request", id: "future-1", method: "future_dialog", value: 42 });
		expect(unknown).toMatchObject({ accepted: false, kind: "diagnostic" });
		const invalid = broker.ingest({ type: "extension_ui_request", id: "bad-1", method: "confirm", title: "Bad", message: 3 });
		expect(invalid).toMatchObject({ accepted: false, kind: "diagnostic" });
		const diagnostics = broker.getDiagnostics();
		expect(diagnostics.map(diagnostic => diagnostic.code)).toEqual(["invalid-response", "unknown-method", "invalid-frame"]);
		expect(diagnostics.some(diagnostic => diagnostic.code === "unknown-method" && diagnostic.frame?.method === "future_dialog")).toBe(true);
		expect(events.filter(event => event.kind === "diagnostic")).toHaveLength(3);
	});

	it("emits every supported presentation method without attempting side effects", () => {
		const events: ExtensionUiEvent[] = [];
		const broker = makeBroker(() => {}, event => {
			events.push(event);
		});
		const frames = [
			{ type: "extension_ui_request", id: "notify-1", method: "notify", message: "hello", notifyType: "info" },
			{ type: "extension_ui_request", id: "status-1", method: "setStatus", statusKey: "build", statusText: "ready" },
			{ type: "extension_ui_request", id: "widget-1", method: "setWidget", widgetKey: "logs", widgetLines: ["line"], widgetPlacement: "belowEditor" },
			{ type: "extension_ui_request", id: "title-1", method: "setTitle", title: "Cedia" },
			{ type: "extension_ui_request", id: "text-1", method: "set_editor_text", text: "draft" },
			{ type: "extension_ui_request", id: "url-1", method: "open_url", url: "https://example.test/login", launchUrl: "http://127.0.0.1/launch", instructions: "Open manually" },
		] as const;
		for (const frame of frames) {
			const result = broker.ingest(frame);
			expect(result).toMatchObject({ accepted: true, kind: "presentation" });
		}
		const presentations = events.filter((event): event is ExtensionUiPresentationEvent => event.kind === "presentation");
		expect(presentations.map(event => event.request.method)).toEqual(["notify", "setStatus", "setWidget", "setTitle", "set_editor_text", "open_url"]);
		expect(presentations[5]?.request).toMatchObject({ method: "open_url", url: "https://example.test/login" });
		expect(broker.pendingCount).toBe(0);
	});

	it("claims before async send completes, so duplicate answers cannot replay", async () => {
		let release!: () => void;
		const gate = new Promise<void>(resolve => {
			release = resolve;
		});
		const responses: unknown[] = [];
		const broker = makeBroker(async frame => {
			await gate;
			responses.push(frame);
		});
		const result = broker.ingest({ type: "extension_ui_request", id: "async-1", method: "input", title: "Answer" });
		if (!result.accepted || result.kind !== "interactive") throw new Error("expected interactive request");
		const first = broker.respond(result.token, "first");
		const second = broker.respond(result.token, "second");
		await expect(second).rejects.toMatchObject({ code: "stale-response" });
		release();
		await first;
		expect(responses).toEqual([{ type: "extension_ui_response", id: "async-1", value: "first" }]);
	});

	it("reports a send failure without retrying the consumed response", async () => {
		const broker = makeBroker(() => {
			throw new Error("pipe closed");
		});
		const result = broker.ingest({ type: "extension_ui_request", id: "send-fail-1", method: "editor", title: "Edit" });
		if (!result.accepted || result.kind !== "interactive") throw new Error("expected editor request");
		const error = await broker.respond(result.token, "text").catch(value => value);
		expect(error).toBeInstanceOf(ExtensionUiBrokerError);
		expect(error).toMatchObject({ code: "send-failed", requestId: "send-fail-1" });
		await expect(broker.respond(result.token, "retry")).rejects.toMatchObject({ code: "stale-response" });
		expect(broker.getDiagnostics().map(diagnostic => diagnostic.code)).toEqual(["send-failed", "stale-response"]);
	});

	it("bounds diagnostic memory and refuses unseen ids after the id ledger is full", async () => {
		const broker = makeBroker(() => {}, undefined, { maxDiagnostics: 2, maxSeenRequestIds: 2 });
		const first = broker.ingest({ type: "extension_ui_request", id: "ledger-1", method: "input", title: "One" });
		if (!first.accepted || first.kind !== "interactive") throw new Error("expected first request");
		await broker.respond(first.token, "done");
		const second = broker.ingest({ type: "extension_ui_request", id: "ledger-2", method: "input", title: "Two" });
		if (!second.accepted || second.kind !== "interactive") throw new Error("expected second request");
		await broker.respond(second.token, "done");

		const replay = broker.ingest({ type: "extension_ui_request", id: "ledger-1", method: "input", title: "Replay" });
		expect(replay).toMatchObject({ accepted: false, kind: "diagnostic", diagnostic: { code: "duplicate-request" } });
		const overCapacity = broker.ingest({ type: "extension_ui_request", id: "ledger-3", method: "input", title: "Three" });
		expect(overCapacity).toMatchObject({ accepted: false, kind: "diagnostic", diagnostic: { code: "capacity" } });
		const another = broker.ingest({ type: "extension_ui_request", id: "ledger-4", method: "input", title: "Four" });
		expect(another).toMatchObject({ accepted: false, kind: "diagnostic", diagnostic: { code: "capacity" } });
		expect(broker.getDiagnostics()).toHaveLength(2);
		expect(broker.getDiagnostics().every(diagnostic => diagnostic.code === "capacity")).toBe(true);
	});

	it("rejects timeout values that would overflow a Node timer", () => {
		expect(() => makeBroker(() => {}, undefined, { defaultTimeoutMs: 2_147_483_648 })).toThrow(/defaultTimeoutMs/);
		const broker = makeBroker();
		const invalid = broker.ingest({
			type: "extension_ui_request",
			id: "overflow-timeout",
			method: "select",
			title: "Pick",
			options: ["a"],
			timeout: 2_147_483_648,
		});
		expect(invalid).toMatchObject({ accepted: false, kind: "diagnostic", diagnostic: { code: "invalid-frame" } });
	});

	it("rejects an elapsed deadline even before the timer callback can run", async () => {
		const responses: unknown[] = [];
		const broker = makeBroker(frame => { responses.push(frame); }, undefined, { defaultTimeoutMs: 5 });
		const result = broker.ingest({ type: "extension_ui_request", id: "blocked-loop", method: "confirm", title: "Expired", message: "Never approve" });
		if (!result.accepted || result.kind !== "interactive") throw new Error("expected request");
		const start = performance.now();
		while (performance.now() - start < 15) { /* Hold the event loop past expiry. */ }
		await expect(broker.respond(result.token, true)).rejects.toMatchObject({ code: "stale-response" });
		await new Promise(resolve => setTimeout(resolve, 5));
		expect(responses).toEqual([{ type: "extension_ui_response", id: "blocked-loop", cancelled: true, timedOut: true }]);
		expect(broker.pendingCount).toBe(0);
	});
});
