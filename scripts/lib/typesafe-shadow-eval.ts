/** TypeSafe (Jev) shadow evaluation: question set, scoring, and report rendering.
 *
 * The harness never sits in the product flow. It replays prompts Cedia has already
 * received, asks Jev the judgments a future decision layer would ask, and records the
 * answers next to what actually happened. A run is only evidence once enough labeled
 * cases exist, so `summarize` refuses to claim accuracy below `MIN_SCORED_CASES`.
 * Nothing here performs I/O or network calls, which keeps the G0 tests able to cover
 * the pipeline without a provider call.
 */

export const QUESTION_SET_VERSION = "shadow-eval-v1";
export const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const TYPESAFE_MODEL = "jev-latest";
export const TYPESAFE_API_KEY_ENV = "TYPESAFE_API_KEY";
/** Below this many scored predictions, a report states the gap instead of an accuracy figure. */
export const MIN_SCORED_CASES = 20;
/** Confidence below this marks a case as an abstention rather than a prediction. */
export const ABSTAIN_BELOW_CONFIDENCE = 0.5;

export type ModelClass = "light" | "standard" | "heavy";

export interface ChoiceQuestion {
	readonly type: "choice";
	readonly instructions: string;
	readonly criteria: Readonly<Record<string, string | null>>;
}
export interface ScoreQuestion {
	readonly type: "score";
	readonly instructions: string;
	readonly criteria: readonly string[];
}
export interface NoulQuestion {
	readonly type: "noul";
	readonly instructions: string;
	readonly criteria?: { readonly true: string; readonly false: string };
}
export type Question = ChoiceQuestion | ScoreQuestion | NoulQuestion;
export type Questions = Readonly<Record<string, Question>>;

export interface ChoiceAnswer {
	readonly type: "choice";
	readonly choice: string;
	readonly probabilities: Readonly<Record<string, number>>;
	readonly confidence: number;
}
export interface ScoreAnswer {
	readonly type: "score";
	readonly score: number;
	readonly legend?: Readonly<Record<string, string>>;
	readonly confidence: number;
}
export interface NoulAnswer {
	readonly type: "noul";
	readonly noul: number;
}
export type Answer = ChoiceAnswer | ScoreAnswer | NoulAnswer;
export type Answers = Readonly<Record<string, Answer>>;

/**
 * The judgments a decision layer in front of an agent would need. They are separate
 * questions because they fail independently: a large edit can still need no isolation,
 * and a one-line question can be risky to run in place.
 */
export const SHADOW_QUESTIONS: Questions = {
	task_kind: {
		type: "choice",
		instructions: "What kind of work is this request asking for?",
		criteria: {
			question: "Answer an informational question about the project; no repository change is expected",
			investigate: "Diagnose or explore to explain current behaviour; findings, not edits, are the deliverable",
			edit_code: "Change the behaviour, structure, or tests of the software in this repository",
			configure: "Change settings, tooling, environment, or local setup rather than product code",
			review: "Evaluate work that already exists, such as a diff, plan, or document",
		},
	},
	change_scope: {
		type: "score",
		instructions: "If this request were completed, how far would the work reach across the repository?",
		criteria: [
			"One file, or a local change with no effect on other modules",
			"Several files inside a single module, package, or app",
			"Crosses module boundaries, or changes a shared contract, build, or dependency",
		],
	},
	isolation_needed: {
		type: "noul",
		instructions:
			"Would running this request directly in the current checkout risk losing uncommitted work, or leave the working tree in a state the user has to repair?",
		criteria: {
			true: "The work overwrites or deletes state that is not committed, or can leave the checkout unusable",
			false: "The work adds or edits tracked content in a way the user can review and revert normally",
		},
	},
	weight: {
		type: "choice",
		instructions: "Which model capability does completing this request actually require?",
		criteria: {
			light: "A short answer or mechanical edit that a small fast model completes without losing quality",
			standard: "Ordinary implementation or investigation work confined to one area of the codebase",
			heavy: "Multi-step work that must hold several parts of the system in mind, or recover from a failure it cannot foresee",
		},
	},
};

export interface ShadowCase {
	readonly id: string;
	readonly source: string;
	readonly prompt: string;
	readonly project?: { readonly name?: string; readonly path?: string };
	readonly session?: { readonly title?: string; readonly priorTurns?: number };
	/** What actually happened. Absent fields stay unlabeled rather than guessed. */
	readonly observed?: { readonly modelId?: string; readonly modelClass?: ModelClass };
}

export interface TokenUsage {
	readonly inputTokens: number;
	readonly outputTokens: number;
}

export interface CaseResult {
	readonly id: string;
	readonly answers: Answers;
	readonly latencyMs: number;
	readonly usage?: TokenUsage;
	readonly error?: string;
}

/** One-shot judge boundary: fixtures satisfy it without a provider call. */
export interface Judge {
	readonly kind: "fixture" | "live";
	readonly questions: Questions;
	ask(state: unknown): Promise<{ answers: Answers; usage?: TokenUsage }>;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function requireString(value: unknown, what: string): string {
	if (typeof value !== "string" || value.length === 0) throw new Error(`Expected ${what} to be a non-empty string`);
	return value;
}

/** Parse the JSONL corpus, failing loudly on a malformed line instead of skipping it. */
export function parseCorpus(text: string): ShadowCase[] {
	const cases: ShadowCase[] = [];
	for (const [index, line] of text.split("\n").entries()) {
		if (line.trim() === "") continue;
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch (error) {
			throw new Error(`Corpus line ${index + 1} is not JSON: ${error instanceof Error ? error.message : String(error)}`);
		}
		if (!isRecord(parsed)) throw new Error(`Corpus line ${index + 1} is not an object`);
		const observed = isRecord(parsed.observed) ? parsed.observed : undefined;
		const project = isRecord(parsed.project) ? parsed.project : undefined;
		const session = isRecord(parsed.session) ? parsed.session : undefined;
		cases.push({
			id: requireString(parsed.id, `line ${index + 1} id`),
			source: typeof parsed.source === "string" ? parsed.source : "unknown",
			prompt: requireString(parsed.prompt, `line ${index + 1} prompt`),
			...(project
				? { project: {
					...(typeof project.name === "string" ? { name: project.name } : {}),
					...(typeof project.path === "string" ? { path: project.path } : {}),
				} }
				: {}),
			...(session
				? { session: {
					...(typeof session.title === "string" ? { title: session.title } : {}),
					...(typeof session.priorTurns === "number" ? { priorTurns: session.priorTurns } : {}),
				} }
				: {}),
			...(observed
				? { observed: {
					...(typeof observed.modelId === "string" ? { modelId: observed.modelId } : {}),
					...(observed.modelClass === "light" || observed.modelClass === "standard" || observed.modelClass === "heavy"
						? { modelClass: observed.modelClass as ModelClass }
						: {}),
				} }
				: {}),
		});
	}
	return cases;
}

export function serializeCorpus(cases: readonly ShadowCase[]): string {
	return cases.map(entry => JSON.stringify(entry)).join("\n") + (cases.length > 0 ? "\n" : "");
}

/** The state payload. Named fields keep the prompt, project, and session separable. */
export function stateFor(entry: ShadowCase): Record<string, unknown> {
	return {
		task: { prompt: entry.prompt },
		project: entry.project ?? {},
		session: entry.session ?? {},
	};
}

export interface WeightScore {
	/** Cases carrying an observed label, whatever the answer said. */
	readonly labeled: number;
	readonly predicted: number;
	readonly agreed: number;
	readonly abstained: number;
	/** Labeled cases that produced no usable answer: a failed call or an unexpected answer type. */
	readonly unanswered: number;
	/** Cases whose prediction was wrong, listed by id so a failure can be replayed. */
	readonly disagreements: readonly string[];
	readonly confusion: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

/**
 * Compare the `weight` answer against the observed model class. An answer below
 * `ABSTAIN_BELOW_CONFIDENCE` is an abstention: the code policy is that a low-confidence
 * answer is not a decision, so it must not count as a prediction.
 */
export function scoreWeight(cases: readonly ShadowCase[], results: readonly CaseResult[]): WeightScore {
	const byId = new Map(results.map(result => [result.id, result]));
	const confusion: Record<string, Record<string, number>> = {};
	let labeled = 0;
	let predicted = 0;
	let agreed = 0;
	let abstained = 0;
	let unanswered = 0;
	const disagreements: string[] = [];
	for (const entry of cases) {
		const observed = entry.observed?.modelClass;
		if (!observed) continue;
		labeled++;
		const answer = byId.get(entry.id)?.answers.weight;
		// A failed call and a wrongly typed answer are the same thing here: no usable prediction.
		// Counting them keeps labeled = predicted + abstained + unanswered so the report reconciles.
		if (!answer || answer.type !== "choice") { unanswered++; continue; }
		if (answer.confidence < ABSTAIN_BELOW_CONFIDENCE) { abstained++; continue; }
		predicted++;
		const row = confusion[observed] ?? (confusion[observed] = {});
		row[answer.choice] = (row[answer.choice] ?? 0) + 1;
		if (answer.choice === observed) agreed++;
		else disagreements.push(entry.id);
	}
	return { labeled, predicted, agreed, abstained, unanswered, disagreements, confusion };
}

export interface ConfidenceBucket {
	readonly label: string;
	readonly cases: number;
	readonly agreed: number;
}

export function confidenceBuckets(cases: readonly ShadowCase[], results: readonly CaseResult[]): ConfidenceBucket[] {
	const byId = new Map(results.map(result => [result.id, result]));
	const edges = [0, 0.5, 0.8, 1.000001];
	const buckets: ConfidenceBucket[] = [];
	for (let index = 0; index < edges.length - 1; index++) {
		const lower = edges[index]!;
		const upper = edges[index + 1]!;
		let seen = 0;
		let agreed = 0;
		for (const entry of cases) {
			const observed = entry.observed?.modelClass;
			const answer = byId.get(entry.id)?.answers.weight;
			if (!observed || !answer || answer.type !== "choice") continue;
			if (answer.confidence < lower || answer.confidence >= upper) continue;
			seen++;
			if (answer.choice === observed) agreed++;
		}
		buckets.push({ label: `${lower.toFixed(2)}-${Math.min(upper, 1).toFixed(2)}`, cases: seen, agreed });
	}
	return buckets;
}

export function percentile(values: readonly number[], fraction: number): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
	return sorted[index]!;
}

export interface TaskKindCount {
	readonly kind: string;
	readonly cases: number;
	readonly abstained: number;
}

export function taskKindCounts(results: readonly CaseResult[]): TaskKindCount[] {
	const counts = new Map<string, { cases: number; abstained: number }>();
	for (const result of results) {
		const answer = result.answers.task_kind;
		if (!answer || answer.type !== "choice") continue;
		const row = counts.get(answer.choice) ?? { cases: 0, abstained: 0 };
		row.cases++;
		if (answer.confidence < ABSTAIN_BELOW_CONFIDENCE) row.abstained++;
		counts.set(answer.choice, row);
	}
	return [...counts.entries()]
		.map(([kind, row]) => ({ kind, cases: row.cases, abstained: row.abstained }))
		.sort((a, b) => b.cases - a.cases || a.kind.localeCompare(b.kind));
}

export interface IsolationSuggestion {
	readonly suggested: number;
	readonly mean: number;
}

export function isolationSuggestion(results: readonly CaseResult[]): IsolationSuggestion {
	const values = results
		.map(result => result.answers.isolation_needed)
		.filter((answer): answer is NoulAnswer => answer?.type === "noul")
		.map(answer => answer.noul);
	if (values.length === 0) return { suggested: 0, mean: 0 };
	const suggested = values.filter(value => value >= 0.5).length;
	return { suggested, mean: values.reduce((sum, value) => sum + value, 0) / values.length };
}

export interface Summary {
	readonly questionSetVersion: string;
	readonly cases: number;
	readonly errored: number;
	readonly weight: WeightScore;
	readonly buckets: readonly ConfidenceBucket[];
	readonly taskKinds: readonly TaskKindCount[];
	readonly isolation: IsolationSuggestion;
	readonly latencyMs: { readonly p50: number; readonly p95: number; readonly max: number };
	readonly tokens: TokenUsage;
	readonly verdict: "insufficient-labels" | "measured";
}

export function summarize(cases: readonly ShadowCase[], results: readonly CaseResult[]): Summary {
	const ok = results.filter(result => !result.error);
	const latencies = ok.map(result => result.latencyMs);
	const weight = scoreWeight(cases, results);
	return {
		questionSetVersion: QUESTION_SET_VERSION,
		cases: results.length,
		errored: results.length - ok.length,
		weight,
		buckets: confidenceBuckets(cases, results),
		taskKinds: taskKindCounts(ok),
		isolation: isolationSuggestion(ok),
		latencyMs: {
			p50: percentile(latencies, 0.5),
			p95: percentile(latencies, 0.95),
			max: latencies.length === 0 ? 0 : Math.max(...latencies),
		},
		tokens: ok.reduce(
			(total, result) => ({
				inputTokens: total.inputTokens + (result.usage?.inputTokens ?? 0),
				outputTokens: total.outputTokens + (result.usage?.outputTokens ?? 0),
			}),
			{ inputTokens: 0, outputTokens: 0 },
		),
		// Gate on predictions, not labels: a labeled case whose call failed contributes nothing,
		// and counting it would report accuracy from a sample that never produced answers.
		verdict: weight.predicted >= MIN_SCORED_CASES ? "measured" : "insufficient-labels",
	};
}

/**
 * Markdown summary. Aggregate numbers only: prompt text is never copied here, so this
 * file can be quoted on a machine that does not hold the corpus.
 */
export function renderReport(summary: Summary, judgeKind: Judge["kind"]): string {
	const lines: string[] = [];
	lines.push(`# TypeSafe shadow eval (${summary.questionSetVersion})`);
	lines.push("");
	lines.push(`- judge: ${judgeKind}`);
	lines.push(`- cases: ${summary.cases} (${summary.errored} failed)`);
	lines.push(
		`- latency p50/p95/max: ${summary.latencyMs.p50.toFixed(0)}/${summary.latencyMs.p95.toFixed(0)}/${summary.latencyMs.max.toFixed(0)} ms`,
	);
	lines.push(`- tokens in/out: ${summary.tokens.inputTokens}/${summary.tokens.outputTokens}`);
	lines.push("");
	lines.push("## Task kind");
	lines.push("");
	if (summary.taskKinds.length === 0) lines.push("- no answers");
	for (const row of summary.taskKinds) {
		lines.push(`- ${row.kind}: ${row.cases} (${row.abstained} below confidence ${ABSTAIN_BELOW_CONFIDENCE})`);
	}
	lines.push("");
	lines.push("## Isolation suggestion");
	lines.push("");
	lines.push(
		`- would use a separate worktree: ${summary.isolation.suggested} of ${summary.cases} (mean probability ${summary.isolation.mean.toFixed(3)})`,
	);
	lines.push("");
	lines.push("## Weight against the model actually chosen");
	lines.push("");
	lines.push(`- labeled cases: ${summary.weight.labeled}`);
	lines.push(`- scored predictions: ${summary.weight.predicted} (need ${MIN_SCORED_CASES} before this section reports agreement)`);
	if (summary.verdict === "insufficient-labels") {
		lines.push("- verdict: insufficient scored predictions, so no accuracy claim is made.");
		if (summary.weight.unanswered > 0) {
			lines.push(`- ${summary.weight.unanswered} labeled case(s) produced no usable answer (failed call or unexpected answer type); rerun them before scoring.`);
		}
		lines.push("- next: record `observed.modelClass` (light/standard/heavy) for the model the user actually picked on each case.");
	} else {
		lines.push(`- agreed: ${summary.weight.agreed} of ${summary.weight.predicted}`);
		lines.push(`- abstained below confidence ${ABSTAIN_BELOW_CONFIDENCE}: ${summary.weight.abstained}`);
		lines.push(`- disagreements: ${summary.weight.disagreements.length === 0 ? "none" : summary.weight.disagreements.join(", ")}`);
	}
	lines.push("");
	lines.push("### Confidence buckets");
	lines.push("");
	lines.push("| confidence | cases | agreed |");
	lines.push("| --- | --- | --- |");
	for (const bucket of summary.buckets) lines.push(`| ${bucket.label} | ${bucket.cases} | ${bucket.agreed} |`);
	lines.push("");
	return lines.join("\n");
}

function choice(selected: string, confidence: number, rest: Readonly<Record<string, number>>): ChoiceAnswer {
	const probabilities: Record<string, number> = { [selected]: confidence };
	for (const [key, value] of Object.entries(rest)) probabilities[key] = value;
	return { type: "choice", choice: selected, probabilities, confidence };
}

/**
 * Canned cases and answers for the G0 path. They exist to cover the scoring maths, not to
 * represent real work: the corpus shipped here is deliberately stale and synthetic, so a
 * passing fixture run never implies the model performs well on this repository.
 */
const FIXTURES: readonly { readonly entry: ShadowCase; readonly answers: Answers }[] = [
	{
		entry: {
			id: "fixture-agree-light",
			source: "fixture",
			prompt: "rename the exported constant in the parser module",
			observed: { modelId: "small-model", modelClass: "light" },
		},
		answers: {
			task_kind: choice("edit_code", 0.91, { question: 0.05, investigate: 0.02, configure: 0.01, review: 0.01 }),
			change_scope: { type: "score", score: 0.2, confidence: 0.78 },
			isolation_needed: { type: "noul", noul: 0.04 },
			weight: choice("light", 0.9, { standard: 0.08, heavy: 0.02 }),
		},
	},
	{
		entry: {
			id: "fixture-disagree",
			source: "fixture",
			prompt: "rework the session handoff so the host owns the transcript again",
			observed: { modelId: "large-model", modelClass: "heavy" },
		},
		answers: {
			task_kind: choice("edit_code", 0.74, { investigate: 0.12, review: 0.09, question: 0.03, configure: 0.02 }),
			change_scope: { type: "score", score: 2.1, confidence: 0.66 },
			isolation_needed: { type: "noul", noul: 0.81 },
			weight: choice("standard", 0.7, { heavy: 0.25, light: 0.05 }),
		},
	},
	{
		entry: {
			id: "fixture-agree-standard",
			source: "fixture",
			prompt: "add a test for the worktree guard in the host service",
			observed: { modelId: "mid-model", modelClass: "standard" },
		},
		answers: {
			task_kind: choice("edit_code", 0.62, { review: 0.2, investigate: 0.1, question: 0.05, configure: 0.03 }),
			change_scope: { type: "score", score: 1.1, confidence: 0.58 },
			isolation_needed: { type: "noul", noul: 0.2 },
			weight: choice("standard", 0.55, { heavy: 0.27, light: 0.18 }),
		},
	},
	{
		entry: {
			id: "fixture-abstain",
			source: "fixture",
			prompt: "make the thing behave like it used to before the last change",
			observed: { modelId: "large-model", modelClass: "heavy" },
		},
		answers: {
			task_kind: choice("investigate", 0.41, { edit_code: 0.34, question: 0.15, review: 0.06, configure: 0.04 }),
			change_scope: { type: "score", score: 1.4, confidence: 0.39 },
			isolation_needed: { type: "noul", noul: 0.52 },
			weight: choice("light", 0.3, { standard: 0.4, heavy: 0.3 }),
		},
	},
	{
		entry: {
			id: "fixture-agree-light-two",
			source: "fixture",
			prompt: "which file declares the device credential type",
			observed: { modelId: "small-model", modelClass: "light" },
		},
		answers: {
			task_kind: choice("question", 0.88, { investigate: 0.08, review: 0.02, edit_code: 0.01, configure: 0.01 }),
			change_scope: { type: "score", score: 0.1, confidence: 0.83 },
			isolation_needed: { type: "noul", noul: 0.02 },
			weight: choice("light", 0.95, { standard: 0.04, heavy: 0.01 }),
		},
	},
	{
		entry: {
			id: "fixture-unlabeled",
			source: "fixture",
			prompt: "summarise what changed in the relay package this week",
		},
		answers: {
			task_kind: choice("review", 0.7, { investigate: 0.15, question: 0.1, edit_code: 0.03, configure: 0.02 }),
			change_scope: { type: "score", score: 0.4, confidence: 0.64 },
			isolation_needed: { type: "noul", noul: 0.03 },
			weight: choice("standard", 0.52, { light: 0.44, heavy: 0.04 }),
		},
	},
];

export const FIXTURE_CASES: readonly ShadowCase[] = FIXTURES.map(fixture => fixture.entry);

/** Deterministic judge for `--fixtures` and the G0 tests. Performs no I/O. */
export function fixtureJudge(): Judge {
	const byPrompt = new Map(FIXTURES.map(fixture => [fixture.entry.prompt, fixture.answers]));
	return {
		kind: "fixture",
		questions: SHADOW_QUESTIONS,
		async ask(state) {
			const prompt = isRecord(state) && isRecord(state.task) && typeof state.task.prompt === "string" ? state.task.prompt : "";
			const answers = byPrompt.get(prompt);
			if (!answers) throw new Error(`No fixture answer for prompt: ${prompt.slice(0, 60)}`);
			return { answers, usage: { inputTokens: 100, outputTokens: 20 } };
		},
	};
}
