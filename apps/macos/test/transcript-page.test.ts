import { describe, expect, it } from "bun:test";
import { prependTranscriptEntries, transcriptEntriesFromOmpMessages } from "../src/transcript-page.ts";

describe("transcriptEntriesFromOmpMessages", () => {
	it("maps advertised OMP rows and does not invent empty history", () => {
		expect(transcriptEntriesFromOmpMessages([])).toEqual([]);
		expect(transcriptEntriesFromOmpMessages([null, 1, {}])).toEqual([]);
		const entries = transcriptEntriesFromOmpMessages([
			{ id: "m1", role: "user", text: "hello" },
			{ messageId: "m2", role: "assistant", content: [{ text: "there" }] },
		]);
		expect(entries).toEqual([
			{ id: "omp-hist:m1", kind: "message", role: "user", text: "hello", status: "completed", rawFrames: [{ id: "m1", role: "user", text: "hello" }] },
			{ id: "omp-hist:m2", kind: "message", role: "assistant", text: "there", status: "completed", rawFrames: [{ messageId: "m2", role: "assistant", content: [{ text: "there" }] }] },
		]);
	});
});

describe("prependTranscriptEntries", () => {
	it("prepends unique older rows and keeps the live journal identity", () => {
		const live = [{ id: "host:1", kind: "message" as const, role: "user" as const, text: "now", status: "completed" as const, rawFrames: [] }];
		const older = transcriptEntriesFromOmpMessages([{ id: "m1", role: "user", text: "hello" }]);
		expect(prependTranscriptEntries(live, older).map(item => item.id)).toEqual(["omp-hist:m1", "host:1"]);
		expect(prependTranscriptEntries(live, older).map(item => item.id)).toEqual(prependTranscriptEntries(prependTranscriptEntries(live, older), older).map(item => item.id));
	});
});
