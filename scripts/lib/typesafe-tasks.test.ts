import { describe, expect, it } from "bun:test";

import type { Answers } from "./typesafe-shadow-eval.ts";
import {
	changedFilesFromDiff,
	citedPaths,
	diffSections,
	excerptFor,
	rankReviewFocus,
	rankReviewFiles,
	receiptCitations,
	unrankedFiles,
} from "./typesafe-tasks.ts";

const score = (value: number, confidence: number): Answers => ({
	importance: { type: "score", score: value, confidence },
});

const DIFF = [
	"diff --git a/apps/host/src/service.ts b/apps/host/src/service.ts",
	"--- a/apps/host/src/service.ts",
	"+++ b/apps/host/src/service.ts",
	"@@ -1 +1 @@",
	"-old",
	"+new",
	"diff --git a/scripts/lib/new-file.ts b/scripts/lib/new-file.ts",
	"--- /dev/null",
	"+++ b/scripts/lib/new-file.ts",
].join("\n");

describe("review ranking", () => {
	it("reads the changed files out of a unified diff, in first-seen order", () => {
		expect(changedFilesFromDiff(DIFF)).toEqual(["apps/host/src/service.ts", "scripts/lib/new-file.ts"]);
		expect(changedFilesFromDiff("")).toEqual([]);
	});

	it("keeps each file's own hunks together so a ranking sees that file's change", () => {
		const sections = diffSections(DIFF);
		expect([...sections.keys()]).toEqual(["apps/host/src/service.ts", "scripts/lib/new-file.ts"]);
		expect(sections.get("apps/host/src/service.ts")).toContain("+new");
		expect(sections.get("apps/host/src/service.ts")).not.toContain("scripts/lib/new-file.ts");
	});

	it("orders by importance, then by how sure the answer was", () => {
		const files = ["incidental.ts", "central.ts", "supporting.ts"];
		const answers = new Map<string, Answers>([
			["incidental.ts", score(0.1, 0.9)],
			["central.ts", score(2.4, 0.6)],
			["supporting.ts", score(1.2, 0.8)],
		]);
		expect(rankReviewFiles(files, answers).map(entry => entry.file)).toEqual(["central.ts", "supporting.ts", "incidental.ts"]);
	});

	it("keeps unanswered files visible instead of dropping them from the review", () => {
		const files = ["scored.ts", "unanswered.ts"];
		const answers = new Map<string, Answers>([
			["scored.ts", score(1, 0.7)],
			["unanswered.ts", { importance: { type: "noul", noul: 0.5 } }],
		]);
		expect(rankReviewFiles(files, answers).map(entry => entry.file)).toEqual(["scored.ts"]);
		expect(unrankedFiles(files, answers)).toEqual(["unanswered.ts"]);
	});

	it("ranks the focus variant on the probability that a file carries the change", () => {
		const files = ["follows.ts", "carries.ts", "unsure.ts"];
		const answers = new Map<string, Answers>([
			["follows.ts", { carries_intent: { type: "noul", noul: 0.08 } }],
			["carries.ts", { carries_intent: { type: "noul", noul: 0.93 } }],
			["unsure.ts", { carries_intent: { type: "noul", noul: 0.52 } }],
		]);
		const ranked = rankReviewFocus(files, answers);
		expect(ranked.map(entry => entry.file)).toEqual(["carries.ts", "unsure.ts", "follows.ts"]);
		// A near-midpoint answer ranks high only if it also claims to carry intent, and its
		// confidence says how little that claim is worth.
		expect(ranked[1]!.confidence).toBeLessThan(0.1);
	});

	it("ignores an answer of the wrong type rather than inventing a rank", () => {
		const answers = new Map<string, Answers>([["a.ts", score(2, 0.9)]]);
		expect(rankReviewFocus(["a.ts"], answers)).toEqual([]);
	});
});

describe("receipt citations", () => {
	it("keeps repo-relative paths and ignores bare or absolute ones", () => {
		const text = "extension.ts: from = agentsChromeApplied in apps/macos/src/extension.ts, see /Users/pond/cedia/apps/host/src/router.ts and scripts/build-cedia.ts";
		expect(citedPaths(text)).toEqual(["apps/macos/src/extension.ts", "scripts/build-cedia.ts"]);
	});

	it("pairs a claim with the files it cites and respects the caps", () => {
		const receipt = { change: { "apps/macos/src/extension.ts": "hides the stock chrome instead of a no-op" } };
		const citations = receiptCitations(receipt);
		expect(citations).toHaveLength(1);
		expect(citations[0]!.path).toBe("apps/macos/src/extension.ts");
		expect(citations[0]!.claim).toContain("hides the stock chrome");
		expect(receiptCitations(receipt, 1, 1)).toHaveLength(1);
	});

	it("finds nothing in a receipt that cites no repository path", () => {
		expect(receiptCitations({ capturedAt: "2026-09-18", paidModelCalls: 0 })).toEqual([]);
	});
});

describe("excerpt selection", () => {
	const content = [
		"line one",
		"line two",
		...Array.from({ length: 20 }, (_, index) => `filler ${index}`),
		"the retryBudget constant",
		"tail one",
		"tail two",
	].join("\n");

	it("centres the excerpt on a line that shares a word with the claim", () => {
		const excerpt = excerptFor(content, "receipt: adds the retryBudget constant to the client");
		expect(excerpt).toContain("retryBudget");
		// Proves it centred on the match instead of returning the head of the file.
		expect(excerpt).not.toContain("line one");
	});

	it("falls back to the head of the file when nothing matches", () => {
		expect(excerptFor(content, "completely unrelated wording")).toContain("line one");
	});
});
