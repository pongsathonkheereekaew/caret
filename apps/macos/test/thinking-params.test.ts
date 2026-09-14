import { describe, expect, it } from "bun:test";
import {
	THINKING_NOT_ADVERTISED,
	emptyThinkingParams,
	messagesPageFromOmp,
	ompCommandData,
	parentSessionFromOmpState,
	projectThinkingParams,
	thinkingFromOmpState,
} from "../src/thinking-params.ts";

describe("projectThinkingParams", () => {
	it("stays empty until OMP advertises levels and does not invent Fast or High", () => {
		expect(projectThinkingParams({})).toEqual(emptyThinkingParams());
		expect(thinkingFromOmpState({})).toEqual({ advertised: false, options: [], reason: THINKING_NOT_ADVERTISED });
		const invented = JSON.stringify(projectThinkingParams({ advertisedLevels: [] }));
		expect(invented.toLowerCase()).not.toContain("fast");
		expect(invented.toLowerCase()).not.toContain("high");
	});

	it("lists only advertised levels and keeps the current value", () => {
		const params = thinkingFromOmpState({
			thinkingLevels: ["off", "low"],
			thinkingLevel: "off",
		});
		expect(params).toEqual({
			advertised: true,
			current: "off",
			options: [
				{ id: "off", label: "off", enabled: true },
				{ id: "low", label: "low", enabled: true },
			],
			reason: "",
		});
	});
});

describe("parentSessionFromOmpState", () => {
	it("reads a parent session id without inventing one", () => {
		expect(parentSessionFromOmpState({ parentSession: "sess-parent" })).toBe("sess-parent");
		expect(parentSessionFromOmpState({})).toBeUndefined();
	});
});

describe("messagesPageFromOmp", () => {
	it("marks a page advertised only when the payload is an object", () => {
		expect(messagesPageFromOmp({ messages: [{ id: "m1" }], nextCursor: "c2" })).toEqual({
			messages: [{ id: "m1" }],
			nextCursor: "c2",
			advertised: true,
		});
		expect(messagesPageFromOmp(undefined).advertised).toBe(false);
	});
});

describe("ompCommandData", () => {
	it("unwraps result.data when present", () => {
		expect(ompCommandData({ result: { data: { thinkingLevel: "off" } } })).toEqual({ thinkingLevel: "off" });
	});
});
