import { describe, expect, it } from "bun:test";
import {
	abortRequest,
	CARET_CHAT_PARTICIPANT_ID,
	CARET_CHAT_SESSION_SCHEME,
	CARET_CHAT_SESSION_TYPE,
	projectNameFor,
	promptRequest,
	sessionIdFromUri,
	sessionItemShape,
	sessionState,
	sessionUriString,
	turnPlansFromTranscript,
} from "../src/chat-sessions-map.ts";
import type { Project, Session } from "../../../packages/protocol/src/index.ts";
import type { TranscriptEntry } from "../src/state.ts";

function session(patch: Partial<Session> = {}): Session {
	return {
		id: "s1",
		projectId: "p1",
		title: "Fix the sidebar",
		cwd: "/Users/pond/caret",
		sessionFile: "/tmp/session.json",
		incarnation: "inc-1",
		status: "idle",
		archived: false,
		createdAt: "2026-09-14T07:00:00.000Z",
		updatedAt: "2026-09-14T07:30:00.000Z",
		...patch,
	};
}

function project(patch: Partial<Project> = {}): Project {
	return { id: "p1", name: "caret", path: "/Users/pond/caret", archived: false, ...patch } as Project;
}

function entry(patch: Partial<TranscriptEntry> & Pick<TranscriptEntry, "role">): TranscriptEntry {
	return {
		id: "e1",
		kind: "message",
		text: "",
		status: "completed",
		rawFrames: [],
		...patch,
	} as TranscriptEntry;
}

describe("session resource identity", () => {
	it("round-trips a session id through its resource uri", () => {
		expect(sessionIdFromUri({ scheme: CARET_CHAT_SESSION_SCHEME, authority: "session", path: "/abc-123" })).toBe("abc-123");
		expect(CARET_CHAT_SESSION_TYPE).toBe(CARET_CHAT_PARTICIPANT_ID);
	});

	it("does not claim resources owned by another provider", () => {
		expect(sessionIdFromUri({ scheme: "vscode-chat", authority: "session", path: "/abc" })).toBeUndefined();
		expect(sessionIdFromUri({ scheme: CARET_CHAT_SESSION_SCHEME, authority: "other", path: "/abc" })).toBeUndefined();
		expect(sessionIdFromUri({ scheme: CARET_CHAT_SESSION_SCHEME, authority: "session", path: "/" })).toBeUndefined();
	});

	it("keeps ids that need escaping reversible", () => {
		const id = "session/with space+plus";
		const parsed = new URL(sessionUriString(id));
		expect(sessionIdFromUri({ scheme: parsed.protocol.replace(":", ""), authority: parsed.host, path: parsed.pathname })).toBe(id);
	});
});

describe("sessionState", () => {
	it("maps the four host statuses without inventing a fifth", () => {
		expect(sessionState("running")).toBe("in-progress");
		expect(sessionState("recovery_required")).toBe("failed");
		expect(sessionState("idle")).toBe("completed");
		expect(sessionState("stopped")).toBe("completed");
	});
});

describe("sessionItemShape", () => {
	it("carries title, project name and timings from the host record", () => {
		const shape = sessionItemShape(session({ status: "running" }), "caret");
		expect(shape).toMatchObject({ id: "s1", label: "Fix the sidebar", description: "caret", state: "in-progress" });
		expect(shape.timing.created).toBe(Date.parse("2026-09-14T07:00:00.000Z"));
		expect(shape.timing.lastRequestStarted).toBe(Date.parse("2026-09-14T07:30:00.000Z"));
	});

	it("leaves lastRequestEnded unset while a turn is still running", () => {
		expect(sessionItemShape(session({ status: "running" })).timing.lastRequestEnded).toBeUndefined();
		expect(sessionItemShape(session({ status: "idle" })).timing.lastRequestEnded).toBe(Date.parse("2026-09-14T07:30:00.000Z"));
	});

	it("leaves description undefined rather than inventing a project label", () => {
		expect(sessionItemShape(session()).description).toBeUndefined();
	});

	it("resolves the project name from the host list", () => {
		expect(projectNameFor([project(), project({ id: "p2", name: "caret-ios" })], session())).toBe("caret");
		expect(projectNameFor([project({ id: "p2" })], session())).toBeUndefined();
	});
});

describe("turnPlansFromTranscript", () => {
	it("pairs each user request with the assistant and tool work that answered it", () => {
		const plans = turnPlansFromTranscript([
			entry({ id: "u1", role: "user", text: "Fix the sidebar" }),
			entry({ id: "a1", role: "assistant", text: "Looking at the filters." }),
			entry({ id: "t1", role: "tool", kind: "tool", text: "read_file", toolName: "read_file" }),
			entry({ id: "a2", role: "assistant", text: "Fixed." }),
			entry({ id: "u2", role: "user", text: "Thanks" }),
		]);

		expect(plans).toEqual([
			{ kind: "request", text: "Fix the sidebar", toolNames: [] },
			{ kind: "response", text: "Looking at the filters.\n\nFixed.", toolNames: ["read_file"] },
			{ kind: "request", text: "Thanks", toolNames: [] },
		]);
	});

	it("drops system entries instead of showing them as assistant text", () => {
		const plans = turnPlansFromTranscript([
			entry({ id: "s1", role: "system", text: "compaction" }),
			entry({ id: "a1", role: "assistant", text: "Ready." }),
		]);
		expect(plans).toEqual([{ kind: "response", text: "Ready.", toolNames: [] }]);
	});

	it("names a tool run even when the frame carried no label", () => {
		const plans = turnPlansFromTranscript([entry({ id: "t1", role: "tool", kind: "tool", text: "bash" })]);
		expect(plans).toEqual([{ kind: "response", text: "", toolNames: ["bash"] }]);
	});
});

describe("command requests", () => {
	it("sends a prompt as the prompt command against the session incarnation", () => {
		expect(promptRequest(session(), "do the thing", "cmd-1")).toEqual({
			commandId: "cmd-1",
			incarnation: "inc-1",
			command: "prompt",
			payload: { prompt: "do the thing" },
		});
	});

	it("stops a turn with the abort command, never a second prompt", () => {
		expect(abortRequest(session(), "cmd-2")).toEqual({ commandId: "cmd-2", incarnation: "inc-1", command: "abort" });
	});

	it("keeps the participant id extension-owned", () => {
		expect(CARET_CHAT_PARTICIPANT_ID.startsWith("caret.")).toBe(true);
	});
});
