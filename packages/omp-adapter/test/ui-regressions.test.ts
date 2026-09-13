import { afterEach, expect, it } from "bun:test";
import { ExtensionUiBroker } from "../src/ui.ts";

const brokers: ExtensionUiBroker[] = [];

afterEach(() => {
	for (const broker of brokers.splice(0)) broker.dispose();
});

it("returns an immutable pending-request snapshot without exposing mutable broker state", async () => {
	const broker = new ExtensionUiBroker({ send: () => {} });
	brokers.push(broker);
	const result = broker.ingest({
		type: "extension_ui_request",
		id: "pending-snapshot",
		method: "select",
		title: "Choose",
		options: ["one", "two"],
		optionDetails: [{ description: "First" }, { description: "Second" }],
	});
	if (!result.accepted || result.kind !== "interactive") throw new Error("expected interactive request");

	const pending = broker.pendingRequests();
	expect(Object.isFrozen(pending)).toBe(true);
	expect(pending).toHaveLength(1);
	expect(Object.isFrozen(pending[0])).toBe(true);
	expect(Object.isFrozen(pending[0]!.request)).toBe(true);
	const selectRequest = pending[0]!.request;
	if (selectRequest.method !== "select") throw new Error("expected select request snapshot");
	expect(Object.isFrozen(selectRequest.options)).toBe(true);
	expect(Object.isFrozen(selectRequest.optionDetails)).toBe(true);
	expect(Object.isFrozen(selectRequest.optionDetails![0])).toBe(true);

	// A consumer can attempt to mutate its copy, but must not alter the broker
	// snapshot or make a stale interaction actionable.
	try { (pending as unknown as unknown[]).pop(); } catch { /* frozen snapshot */ }
	try { (selectRequest as { title: string }).title = "changed"; } catch { /* frozen snapshot */ }
	try { (selectRequest.options as string[]).push("three"); } catch { /* frozen snapshot */ }
	expect(broker.pendingCount).toBe(1);
	const fresh = broker.pendingRequests();
	expect(fresh).toHaveLength(1);
	if (fresh[0]!.request.method !== "select") throw new Error("expected fresh select request snapshot");
	expect(fresh[0]!.request.title).toBe("Choose");
	expect(fresh[0]!.request.options).toEqual(["one", "two"]);

	await broker.respond(result.token, "two");
	expect(broker.pendingRequests()).toEqual([]);
});
