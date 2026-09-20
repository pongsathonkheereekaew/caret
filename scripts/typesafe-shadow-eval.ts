#!/usr/bin/env bun
/** CLI for the TypeSafe (Jev) shadow eval. See scripts/lib/typesafe-shadow-eval.ts.
 *
 *   bun scripts/typesafe-shadow-eval.ts --export --from cedia-journal
 *   bun scripts/typesafe-shadow-eval.ts --fixtures
 *   bun scripts/typesafe-shadow-eval.ts --live
 *
 * `--fixtures` is the G0 path: a canned judge with no provider call, safe for CI. `--live`
 * spends the account's TypeSafe quota, so it stays a deliberate flag. Corpus and run
 * artifacts land under `.local/`, which is gitignored: they carry real prompts.
 */

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
	FIXTURE_CASES,
	TYPESAFE_API_KEY_ENV,
	TYPESAFE_ENDPOINT,
	TYPESAFE_MODEL,
	SHADOW_QUESTIONS,
	fixtureJudge,
	isRecord,
	parseCorpus,
	renderReport,
	serializeCorpus,
	stateFor,
	summarize,
	type Answers,
	type CaseResult,
	type Judge,
	type Questions,
	type ShadowCase,
	type TokenUsage,
} from "./lib/typesafe-shadow-eval.ts";
import { changedFilesFromDiff, diffSections, excerptFor, rankReviewFiles, rankReviewFocus, receiptCitationQuestion, receiptCitations, reviewFocusQuestion, reviewRankQuestion, unrankedFiles } from "./lib/typesafe-tasks.ts";

const ROOT = resolve(import.meta.dir, "..");
const DEFAULT_OUT = join(ROOT, ".local", "typesafe-shadow");
const DEFAULT_JOURNAL = join(homedir(), "Library", "Application Support", "Cedia", "host", "journal.sqlite");
const OMP_HISTORY = join(homedir(), ".omp", "agent", "history.db");
/** Prompts shorter than this are CLI words like `exit`, not tasks worth judging. */
const MIN_PROMPT_CHARS = 8;

function usage(): string {
	return [
		"TypeSafe shadow eval",
		"",
		"  --export [--from cedia-journal|omp-history] [--journal <path>] [--out <dir>]",
		"  --fixtures [--out <dir>]",
		"  --live [--corpus <path>] [--out <dir>] [--limit <n>]",
		"  --rank-review [--diff <path>] [--limit <n>]   order changed files by review importance",
		"  --check-receipts [--limit <n>]                check cited files against their receipt claim",
		"",
		`Env: ${TYPESAFE_API_KEY_ENV} is required for --live only.`,
	].join("\n");
}

function parseArgs(argv: readonly string[]): Map<string, string | true> {
	const flags = new Map<string, string | true>();
	for (let index = 0; index < argv.length; index++) {
		const token = argv[index]!;
		if (!token.startsWith("--")) continue;
		const next = argv[index + 1];
		if (next === undefined || next.startsWith("--")) flags.set(token.slice(2), true);
		else { flags.set(token.slice(2), next); index++; }
	}
	return flags;
}

function flagString(flags: Map<string, string | true>, name: string): string | undefined {
	const value = flags.get(name);
	return typeof value === "string" ? value : undefined;
}

export function ensureDir(path: string): string {
	mkdirSync(path, { recursive: true });
	return path;
}

/**
 * Read a SQLite database another process owns. The host keeps its journal open, and a WAL
 * database cannot be read through a stale handle, so copy the database with its WAL and SHM
 * sidecars and read the copy. The live file is never opened.
 *
 * The copy is deleted on the way out: the journal is measured in gigabytes and holds the
 * user's prompts. `immutable=1` is not a substitute for the copy. Probed with 2 rows behind a
 * 16 KB pending WAL, an immutable open reported `no such table`, because the schema itself was
 * still in the WAL; a milder WAL loses the recent rows instead. Both are silent wrong answers.
 */
export function readDatabaseCopy<T>(databasePath: string, read: (db: DatabaseSync) => T, tempRoot = tmpdir()): T {
	if (!existsSync(databasePath)) throw new Error(`Database not found: ${databasePath}`);
	const dir = mkdtempSync(join(tempRoot, "cedia-shadow-db-"));
	try {
		const copy = join(dir, basename(databasePath));
		copyFileSync(databasePath, copy);
		for (const suffix of ["-wal", "-shm"]) {
			if (existsSync(`${databasePath}${suffix}`)) copyFileSync(`${databasePath}${suffix}`, `${copy}${suffix}`);
		}
		const db = new DatabaseSync(copy);
		try {
			db.exec("PRAGMA busy_timeout = 2000;");
			return read(db);
		} finally { db.close(); }
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

export interface ExportSelection { readonly cases: ShadowCase[]; readonly skipped: number }

/** Export the prompts Cedia actually received, with the model the user chose per session. */
export function casesFromJournal(journalPath: string, tempRoot?: string): ExportSelection {
	return readDatabaseCopy(journalPath, db => {
		const sessions = new Map<string, { title: string; cwd: string; projectId: string }>();
		for (const row of db.prepare("SELECT id, title, cwd, project_id FROM sessions").all() as Record<string, unknown>[]) {
			sessions.set(String(row.id), {
				title: String(row.title ?? ""),
				cwd: String(row.cwd ?? ""),
				projectId: String(row.project_id ?? ""),
			});
		}
		const projects = new Map<string, string>();
		for (const row of db.prepare("SELECT id, name FROM projects").all() as Record<string, unknown>[]) {
			projects.set(String(row.id), String(row.name ?? ""));
		}
		// Last write wins: the model in force when the session was last used.
		const chosenModel = new Map<string, string>();
		const modelRows = db.prepare("SELECT session_id, payload_json FROM commands WHERE kind = 'set_model' ORDER BY created_at").all() as Record<string, unknown>[];
		for (const row of modelRows) {
			try {
				const payload = JSON.parse(String(row.payload_json));
				if (isRecord(payload) && typeof payload.modelId === "string") chosenModel.set(String(row.session_id), payload.modelId);
			} catch { /* a malformed historical payload must not abort the export */ }
		}
		const cases: ShadowCase[] = [];
		let skipped = 0;
		const rows = db.prepare("SELECT session_id, command_id, payload_json FROM commands WHERE kind = 'prompt' ORDER BY created_at").all() as Record<string, unknown>[];
		for (const row of rows) {
			let prompt = "";
			try {
				const payload = JSON.parse(String(row.payload_json));
				if (isRecord(payload) && typeof payload.message === "string") prompt = payload.message;
			} catch { /* fall through to the skip below */ }
			if (prompt.trim().length < MIN_PROMPT_CHARS) { skipped++; continue; }
			const session = sessions.get(String(row.session_id));
			const modelId = chosenModel.get(String(row.session_id));
			const projectName = session ? projects.get(session.projectId) : undefined;
			cases.push({
				id: `cedia:${row.session_id}:${row.command_id}`,
				source: "cedia-journal",
				prompt,
				...(session
					? {
						project: { ...(projectName ? { name: projectName } : {}), path: session.cwd },
						session: { title: session.title },
					}
					: {}),
				...(modelId ? { observed: { modelId } } : {}),
			});
		}
		return { cases, skipped };
	}, tempRoot);
}

/** Export prompts from OMP's own history. Opt-in: this is the user's private log. */
export function casesFromOmpHistory(historyPath: string, tempRoot?: string): ExportSelection {
	return readDatabaseCopy(historyPath, db => {
		const cases: ShadowCase[] = [];
		let skipped = 0;
		const rows = db.prepare("SELECT id, prompt, cwd, session_id FROM history ORDER BY id").all() as Record<string, unknown>[];
		for (const row of rows) {
			const prompt = String(row.prompt ?? "");
			// Slash commands and one-word control input are not tasks.
			if (prompt.trim().length < MIN_PROMPT_CHARS || prompt.trimStart().startsWith("/")) { skipped++; continue; }
			cases.push({
				id: `omp-history:${row.id}`,
				source: "omp-history",
				prompt,
				...(typeof row.cwd === "string" && row.cwd ? { project: { path: row.cwd } } : {}),
				...(typeof row.session_id === "string" && row.session_id ? { session: { title: row.session_id } } : {}),
			});
		}
		return { cases, skipped };
	}, tempRoot);
}

/** Keep hand-added labels when the corpus is regenerated: match on the prompt text. */
export function mergeObserved(existing: readonly ShadowCase[], fresh: readonly ShadowCase[]): ShadowCase[] {
	const previous = new Map(existing.map(entry => [entry.prompt, entry.observed]));
	return fresh.map(entry => {
		const observed = previous.get(entry.prompt) ?? entry.observed;
		return observed ? { ...entry, observed } : entry;
	});
}

export function liveJudge(apiKey: string, questions: Questions = SHADOW_QUESTIONS): Judge {
	return {
		kind: "live",
		questions,
		async ask(state) {
			const response = await fetch(TYPESAFE_ENDPOINT, {
				method: "POST",
				headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
				body: JSON.stringify({ state, model: TYPESAFE_MODEL, questions }),
			});
			if (!response.ok) {
				const body = (await response.text()).slice(0, 300);
				throw new Error(`TypeSafe HTTP ${response.status}: ${body}`);
			}
			const payload: unknown = await response.json();
			if (!isRecord(payload) || !isRecord(payload.answers)) throw new Error("TypeSafe response had no answers object");
			const answers = payload.answers as unknown as Answers;
			const missing = Object.keys(questions).filter(key => answers[key] === undefined);
			if (missing.length > 0) throw new Error(`TypeSafe response omitted answers: ${missing.join(", ")}`);
			const usage = isRecord(payload.usage)
				? {
					inputTokens: Number(payload.usage.input_tokens ?? 0),
					outputTokens: Number(payload.usage.output_tokens ?? 0),
				} satisfies TokenUsage
				: undefined;
			return { answers, ...(usage ? { usage } : {}) };
		},
	};
}

export async function runCases(
	cases: readonly ShadowCase[],
	judge: Judge,
	onProgress?: (index: number, total: number) => void,
): Promise<CaseResult[]> {
	const results: CaseResult[] = [];
	for (const [index, entry] of cases.entries()) {
		onProgress?.(index + 1, cases.length);
		const startedAt = Date.now();
		try {
			const { answers, usage } = await judge.ask(stateFor(entry));
			results.push({ id: entry.id, answers, latencyMs: Date.now() - startedAt, ...(usage ? { usage } : {}) });
		} catch (error) {
			results.push({
				id: entry.id,
				answers: {},
				latencyMs: Date.now() - startedAt,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
	return results;
}

function loadCorpus(path: string): ShadowCase[] {
	if (!existsSync(path)) throw new Error(`No corpus at ${path}. Run --export first.`);
	return parseCorpus(readFileSync(path, "utf8"));
}

function writeRun(outDir: string, judge: Judge, cases: readonly ShadowCase[], results: readonly CaseResult[]): void {
	ensureDir(outDir);
	const summary = summarize(cases, results);
	writeFileSync(join(outDir, "run.json"), `${JSON.stringify({ summary, results, cases }, null, 2)}\n`);
	writeFileSync(join(outDir, "report.md"), renderReport(summary, judge.kind));
	console.log(renderReport(summary, judge.kind));
	console.log(`Artifacts: ${join(outDir, "run.json")} and ${join(outDir, "report.md")}`);
}

async function main(): Promise<void> {
	const flags = parseArgs(process.argv.slice(2));
	if (flags.size === 0 || flags.has("help")) { console.log(usage()); return; }
	const outDir = flagString(flags, "out") ?? DEFAULT_OUT;

	if (flags.has("export")) {
		const from = flagString(flags, "from") ?? "cedia-journal";
		const selection = from === "omp-history"
			? casesFromOmpHistory(flagString(flags, "journal") ?? OMP_HISTORY)
			: casesFromJournal(flagString(flags, "journal") ?? DEFAULT_JOURNAL);
		ensureDir(outDir);
		const corpusPath = join(outDir, "corpus.jsonl");
		const existing = existsSync(corpusPath) ? parseCorpus(readFileSync(corpusPath, "utf8")) : [];
		const merged = mergeObserved(existing, selection.cases);
		writeFileSync(corpusPath, serializeCorpus(merged));
		const labeled = merged.filter(entry => entry.observed?.modelClass ?? entry.observed?.modelId).length;
		console.log(`Exported ${merged.length} case(s) from ${from} to ${corpusPath}`);
		console.log(`Skipped ${selection.skipped} row(s) below ${MIN_PROMPT_CHARS} characters or starting with "/"`);
		console.log(`Cases carrying an observed model: ${labeled}`);
		if (from === "cedia-journal" && labeled === 0 && merged.length > 0) {
			// The label comes from a `set_model` command in the same session, so a session that
			// never changed models (or changed them elsewhere) stays unlabeled on purpose. Say so
			// rather than letting the corpus look complete.
			console.log("No session that received a prompt also recorded a model choice, so nothing is labeled yet.");
			console.log("Label a case by adding observed.modelClass (light/standard/heavy) to its line in the corpus.");
		}
		return;
	}

	if (flags.has("fixtures")) {
		const judge = fixtureJudge();
		// Fixture artifacts get their own directory so a G0 run cannot overwrite a live report.
		writeRun(join(outDir, "fixtures"), judge, FIXTURE_CASES, await runCases(FIXTURE_CASES, judge));
		return;
	}

	if (flags.has("live")) {
		const apiKey = process.env[TYPESAFE_API_KEY_ENV];
		if (!apiKey) throw new Error(`${TYPESAFE_API_KEY_ENV} is not set. Add it to .env or the environment.`);
		const corpusPath = flagString(flags, "corpus") ?? join(outDir, "corpus.jsonl");
		const all = loadCorpus(corpusPath);
		const limit = Number(flagString(flags, "limit") ?? all.length);
		if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("--limit must be a positive integer");
		const cases = all.slice(0, limit);
		console.log(`Judging ${cases.length} of ${all.length} case(s) with ${TYPESAFE_MODEL}`);
		const judge = liveJudge(apiKey);
		const results = await runCases(cases, judge, (index, total) => {
			if (index === total || index % 10 === 0) console.log(`  ${index}/${total}`);
		});
		writeRun(outDir, judge, cases, results);
		const failed = results.filter(result => result.error);
		if (failed.length > 0) console.log(`Failed: ${failed.length} (${failed[0]!.error})`);
		return;
	}

	if (flags.has("rank-review")) {
		const apiKey = process.env[TYPESAFE_API_KEY_ENV];
		if (!apiKey) throw new Error(`${TYPESAFE_API_KEY_ENV} is not set. Add it to .env or the environment.`);
		const diffPath = flagString(flags, "diff");
		const diff = diffPath
			? readFileSync(diffPath, "utf8")
			: execFileSync("git", ["diff", "HEAD"], { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
		const files = changedFilesFromDiff(diff);
		if (files.length === 0) { console.log("No changed files in the diff."); return; }
		const sections = diffSections(diff);
		const limit = Number(flagString(flags, "limit") ?? files.length);
		const selected = files.slice(0, Number.isSafeInteger(limit) && limit > 0 ? limit : files.length);
		// The Noul question is the default: the Score version scored every file at the top of its
		// scale, so its order carried no information. `--variant score` keeps it for comparison.
		const byScore = flagString(flags, "variant") === "score";
		console.log(`Ranking ${selected.length} of ${files.length} changed file(s)`);
		const answersByFile = new Map<string, Answers>();
		// Per file, because the question names the file it is asking about.
		for (const file of selected) {
			const questions = byScore ? reviewRankQuestion(file) : reviewFocusQuestion(file);
			// The file's own hunks, with the keyword window only as a fallback for a diff that
			// carries no `diff --git` header.
			const change = (sections.get(file) ?? excerptFor(diff, file.split("/").pop() ?? file, 40, 3_000)).slice(0, 6_000);
			const state = { change: { file, diff: change } };
			try {
				answersByFile.set(file, await liveJudge(apiKey, questions).ask(state).then(result => result.answers));
			} catch (error) {
				console.log(`  skipped ${file}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		console.log(`Review order (most central first, ${byScore ? "score" : "focus"} variant):`);
		for (const entry of (byScore ? rankReviewFiles(selected, answersByFile) : rankReviewFocus(selected, answersByFile))) {
			console.log(`  ${entry.score.toFixed(2)}  ${entry.file}  (confidence ${entry.confidence.toFixed(2)})`);
		}
		if (byScore) for (const file of unrankedFiles(selected, answersByFile)) console.log(`  --    ${file}  (no usable answer)`);
		return;
	}

	if (flags.has("check-receipts")) {
		const apiKey = process.env[TYPESAFE_API_KEY_ENV];
		if (!apiKey) throw new Error(`${TYPESAFE_API_KEY_ENV} is not set. Add it to .env or the environment.`);
		const evidenceDir = join(ROOT, "docs", "maintenance", "evidence");
		const receipts = readdirSync(evidenceDir, { withFileTypes: true })
			.filter(entry => entry.isDirectory())
			.map(entry => join(evidenceDir, entry.name, "receipt.json"))
			.filter(candidate => existsSync(candidate));
		const limit = Number(flagString(flags, "limit") ?? receipts.length);
		const selected = receipts.slice(0, Number.isSafeInteger(limit) && limit > 0 ? limit : receipts.length);
		console.log(`Checking ${selected.length} of ${receipts.length} receipt(s)`);
		const tally = new Map<string, number>();
		let citations = 0;
		for (const receiptPath of selected) {
			const name = basename(dirname(receiptPath));
			let receipt: unknown;
			try { receipt = JSON.parse(readFileSync(receiptPath, "utf8")); } catch { console.log(`  ${name}: unreadable JSON`); continue; }
			for (const citation of receiptCitations(receipt)) {
				const absolute = join(ROOT, citation.path);
				if (!existsSync(absolute)) { console.log(`  ${name}: cites a missing file ${citation.path}`); continue; }
				const questions = receiptCitationQuestion(citation.claim, citation.path);
				const state = { receipt: { claim: citation.claim, file: citation.path, excerpt: excerptFor(readFileSync(absolute, "utf8"), citation.claim) } };
				try {
					citations++;
					const { answers } = await liveJudge(apiKey, questions).ask(state);
					const answer = answers.citation;
					const verdict = answer && answer.type === "choice" ? answer.choice : "absent";
					tally.set(verdict, (tally.get(verdict) ?? 0) + 1);
					if (verdict !== "supported") {
						const confidence = answer && answer.type === "choice" ? answer.confidence.toFixed(2) : "?";
						console.log(`  ${name} -> ${citation.path}: ${verdict} (confidence ${confidence})`);
					}
				} catch (error) {
					console.log(`  ${name} -> ${citation.path}: request failed (${error instanceof Error ? error.message : String(error)})`);
				}
			}
		}
		console.log(`Checked ${citations} citation(s): ${[...tally.entries()].map(([verdict, count]) => `${verdict}=${count}`).join(", ") || "none"}`);
		return;
	}

	console.log(usage());
	process.exitCode = 1;
}

if (import.meta.main) await main();
