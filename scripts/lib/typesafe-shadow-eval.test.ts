import { describe, expect, it } from "bun:test";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { casesFromJournal, runCases } from "../typesafe-shadow-eval.ts";
import {
	ABSTAIN_BELOW_CONFIDENCE,
	FIXTURE_CASES,
	fixtureJudge,
	MIN_SCORED_CASES,
	parseCorpus,
	renderReport,
	serializeCorpus,
	SHADOW_QUESTIONS,
	stateFor,
	summarize,
	type CaseResult,
} from "./typesafe-shadow-eval.ts";

/** G0: the fixture judge is deterministic, so these tests never call a provider. */
const answersFor = async () => runCases(FIXTURE_CASES, fixtureJudge());

describe("shadow eval corpus", () => {
	it("round-trips a corpus through JSONL", () => {
		const parsed = parseCorpus(serializeCorpus(FIXTURE_CASES));
		expect(parsed).toHaveLength(FIXTURE_CASES.length);
		expect(parsed[0]).toMatchObject({ id: "fixture-agree-light", source: "fixture" });
	});

	it("fails loudly on a malformed line instead of dropping it", () => {
		expect(() => parseCorpus('{"id":"a","prompt":"hello"}\nnot json\n')).toThrow(/line 2/);
	});

	it("keeps the prompt and the project separate in the state payload", () => {
		const state = stateFor({ id: "x", source: "test", prompt: "do the thing", project: { path: "/tmp" } });
		expect(state.task).toEqual({ prompt: "do the thing" });
		expect(state.project).toEqual({ path: "/tmp" });
		expect(SHADOW_QUESTIONS.task_kind?.type).toBe("choice");
	});

	it("builds a state the judge can answer without a provider", async () => {
		const judge = fixtureJudge();
		await expect(judge.ask(stateFor(FIXTURE_CASES[0]!))).resolves.toMatchObject({ answers: { weight: { type: "choice" } } });
		await expect(judge.ask(stateFor({ id: "y", source: "test", prompt: "not in the fixture set" }))).rejects.toThrow(/No fixture answer/);
	});
});

describe("shadow eval scoring", () => {
	it("counts agreement, disagreement, and abstention separately", async () => {
		const summary = summarize(FIXTURE_CASES, await answersFor());
		expect(summary.weight.labeled).toBe(5);
		expect(summary.weight.predicted).toBe(4);
		expect(summary.weight.agreed).toBe(3);
		expect(summary.weight.abstained).toBe(1);
		expect(summary.weight.disagreements).toEqual(["fixture-disagree"]);
	});

	it("treats a low-confidence answer as no decision", async () => {
		const summary = summarize(FIXTURE_CASES, await answersFor());
		const low = summary.buckets[0]!;
		expect(low.label).toBe("0.00-0.50");
		expect(low.cases).toBe(1);
		expect(low.agreed).toBe(0);
		// An abstained case is still labeled, so it counts against coverage.
		expect(summary.weight.labeled).toBeGreaterThan(summary.weight.predicted);
		expect(ABSTAIN_BELOW_CONFIDENCE).toBe(0.5);
	});

	it("refuses to report accuracy before enough cases carry a label", async () => {
		const summary = summarize(FIXTURE_CASES, await answersFor());
		expect(summary.verdict).toBe("insufficient-labels");
		expect(renderReport(summary, "fixture")).toContain("insufficient scored predictions");
	});

	it("does not call a run measured when the calls failed", () => {
		// A labeled case whose call failed contributes no prediction. Gating on labels alone
		// would report agreement from the handful of calls that happened to succeed.
		const cases = Array.from({ length: MIN_SCORED_CASES }, (_, index) => ({
			id: `c${index}`,
			source: "test",
			prompt: `task ${index}`,
			observed: { modelClass: "light" as const },
		}));
		const results: CaseResult[] = cases.map((entry, index): CaseResult => index === 0
			? {
				id: entry.id,
				answers: { weight: { type: "choice" as const, choice: "light", probabilities: { light: 0.9 }, confidence: 0.9 } },
				latencyMs: 5,
			}
			: { id: entry.id, answers: {}, latencyMs: 5, error: "TypeSafe HTTP 429" });
		const summary = summarize(cases, results);
		expect(summary.weight.labeled).toBe(MIN_SCORED_CASES);
		expect(summary.weight.predicted).toBe(1);
		expect(summary.weight.unanswered).toBe(MIN_SCORED_CASES - 1);
		expect(summary.verdict).toBe("insufficient-labels");
		expect(renderReport(summary, "live")).toContain("produced no usable answer");
	});

	it("records latency and token usage for the run", async () => {
		const summary = summarize(FIXTURE_CASES, await answersFor());
		expect(summary.cases).toBe(FIXTURE_CASES.length);
		expect(summary.errored).toBe(0);
		expect(summary.tokens).toEqual({ inputTokens: 600, outputTokens: 120 });
		expect(summary.latencyMs.max).toBeGreaterThanOrEqual(0);
	});
});

describe("shadow eval report", () => {
	it("exports prompts from a journal copy and leaves no copy behind", () => {
		// The copy holds real prompts and the journal is measured in gigabytes, so a leaked copy
		// is both a disk and a privacy problem. `tempRoot` aims it at a directory this test owns.
		const root = mkdtempSync(join(tmpdir(), "cedia-shadow-journal-"));
		try {
			const journal = join(root, "journal.sqlite");
			const writer = new DatabaseSync(journal);
			writer.exec([
				"CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT);",
				"CREATE TABLE sessions (id TEXT PRIMARY KEY, project_id TEXT, title TEXT, cwd TEXT);",
				"CREATE TABLE commands (session_id TEXT, command_id TEXT, kind TEXT, payload_json TEXT, created_at TEXT);",
			].join("\n"));
			writer.prepare("INSERT INTO projects VALUES (?, ?)").run("p1", "cedia");
			writer.prepare("INSERT INTO sessions VALUES (?, ?, ?, ?)").run("s1", "p1", "a task", "/tmp/ws");
			writer.prepare("INSERT INTO commands VALUES (?, ?, ?, ?, ?)").run(
				"s1", "c1", "prompt", JSON.stringify({ message: "add a test for the worktree guard" }), "2026-01-01",
			);
			writer.prepare("INSERT INTO commands VALUES (?, ?, ?, ?, ?)").run(
				"s1", "c2", "prompt", JSON.stringify({ message: "hi" }), "2026-01-02",
			);
			writer.prepare("INSERT INTO commands VALUES (?, ?, ?, ?, ?)").run(
				"s1", "c3", "set_model", JSON.stringify({ modelId: "model-x", provider: "p" }), "2026-01-03",
			);
			writer.close();

			const scratch = mkdtempSync(join(tmpdir(), "cedia-shadow-scratch-"));
			const selection = casesFromJournal(journal, scratch);
			expect(selection.cases).toHaveLength(1);
			expect(selection.cases[0]).toMatchObject({
				id: "cedia:s1:c1",
				source: "cedia-journal",
				prompt: "add a test for the worktree guard",
				observed: { modelId: "model-x" },
				project: { name: "cedia", path: "/tmp/ws" },
				session: { title: "a task" },
			});
			expect(selection.skipped).toBe(1);
			expect(readdirSync(scratch)).toEqual([]);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("never copies prompt text into the shareable summary", async () => {
		const summary = summarize(FIXTURE_CASES, await answersFor());
		const report = renderReport(summary, "fixture");
		for (const entry of FIXTURE_CASES) expect(report).not.toContain(entry.prompt);
		expect(report).toContain("# TypeSafe shadow eval");
	});

	it("counts a failed case instead of aborting the run", async () => {
		const failing = {
			kind: "fixture" as const,
			questions: SHADOW_QUESTIONS,
			async ask() { throw new Error("upstream unavailable"); },
		};
		const cases = FIXTURE_CASES.slice(0, 2);
		const results = await runCases(cases, failing);
		const summary = summarize(cases, results);
		expect(results.every(result => result.error === "upstream unavailable")).toBe(true);
		expect(summary.errored).toBe(2);
		expect(summary.taskKinds).toEqual([]);
	});
});
