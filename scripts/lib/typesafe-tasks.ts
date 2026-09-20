/** Two offline tasks that reuse the TypeSafe judge: review ranking and receipt citation checks.
 *
 * Both are read-only and neither sits in the product flow. The review ranking orders files a
 * human is already going to read; the receipt check asks whether a receipt still describes the
 * code it cites. Code owns the parsing, the file lookups, and the ordering, and the model
 * supplies only the semantic judgment, which keeps the whole thing testable without a provider.
 */

import type { Answers, Questions } from "./typesafe-shadow-eval.ts";

export const reviewRankQuestion = (file: string): Questions => ({
	importance: {
		type: "score",
		// Without this steer the model called almost every file central (2.0 across the board) and
		// the order carried no information. Naming the middle of the scale as the default and
		// reserving the top for one or two files is what makes the score discriminate.
		instructions: `How central is \`${file}\` to what this change is about? Most files in a change support it without carrying it, so reserve the top level for the one or two files a reviewer would read first.`,
		criteria: [
			"Incidental: touched by the change but not needed to understand or review it",
			"Supporting: the usual case; part of the change, but a reviewer accepts it once the main file is understood",
			"Central: at most one or two files that carry the change's own intent, where reviewing it first makes the rest obvious",
		],
	},
});

export const receiptCitationQuestion = (claim: string, file: string): Questions => ({
	citation: {
		type: "choice",
		instructions: `Does the excerpt from \`${file}\` contain the change this receipt claims: "${claim}"?`,
		criteria: {
			supported: "The excerpt shows the code or text the claim describes",
			contradicted: "The excerpt shows this part of the repository does not do what the claim says",
			absent: "The excerpt is unrelated, or too small to tell whether the claim holds",
		},
	},
});

/**
 * The score variant collapsed to the top of its scale (2.0 for every file), which carries no
 * order at all. This asks the narrower question instead: is this file where the change's
 * purpose lives? A probability per file spreads the answer out, and the code sorts on it.
 */
export const reviewFocusQuestion = (file: string): Questions => ({
	carries_intent: {
		type: "noul",
		instructions: `Is \`${file}\` where the intent of this change lives, so that a reviewer reading only this file would understand what the change is for?`,
		criteria: {
			true: "The change's purpose is in this file, and the other files follow from it",
			false: "The change touches this file, but a reviewer could understand the change without reading it",
		},
	},
});

/** Rank files by how much of the change's intent each one carries. */
export function rankReviewFocus(files: readonly string[], answersByFile: ReadonlyMap<string, Answers>): RankedFile[] {
	const ranked: RankedFile[] = [];
	for (const file of files) {
		const answer = answersByFile.get(file)?.carries_intent;
		if (!answer || answer.type !== "noul") continue;
		ranked.push({ file, score: answer.noul, confidence: Math.abs(answer.noul - 0.5) * 2 });
	}
	return ranked.sort((a, b) => b.score - a.score || b.confidence - a.confidence || a.file.localeCompare(b.file));
}

/** Paths a unified diff touches, in the order they first appear. */
export function changedFilesFromDiff(diff: string): string[] {
	const files: string[] = [];
	for (const line of diff.split("\n")) {
		const match = /^\+\+\+ b\/(.+)$/.exec(line) ?? /^--- a\/(.+)$/.exec(line);
		const path = match?.[1]?.trim();
		if (path && path !== "/dev/null" && !files.includes(path)) files.push(path);
	}
	return files;
}

/**
 * The diff text for each touched file, keyed by path. Ranking a file from a keyword window over
 * the whole diff told the model almost nothing about that file, which showed up as low
 * confidence and the wrong order; the file's own hunks are the honest input.
 */
export function diffSections(diff: string): Map<string, string> {
	const sections = new Map<string, string>();
	let current: string | undefined;
	for (const line of diff.split("\n")) {
		const header = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
		if (header) {
			current = header[2]!.trim();
			sections.set(current, `${line}\n`);
			continue;
		}
		if (current) sections.set(current, `${sections.get(current) ?? ""}${line}\n`);
	}
	return sections;
}

export interface RankedFile {
	readonly file: string;
	readonly score: number;
	readonly confidence: number;
}

/** Highest score first; a tie goes to the answer the model was more sure about. */
export function rankReviewFiles(files: readonly string[], answersByFile: ReadonlyMap<string, Answers>): RankedFile[] {
	const ranked: RankedFile[] = [];
	for (const file of files) {
		const answer = answersByFile.get(file)?.importance;
		if (!answer || answer.type !== "score") continue;
		ranked.push({ file, score: answer.score, confidence: answer.confidence });
	}
	return ranked.sort((a, b) => b.score - a.score || b.confidence - a.confidence || a.file.localeCompare(b.file));
}

/** Files the model left unanswered. They stay visible instead of silently leaving the list. */
export function unrankedFiles(files: readonly string[], answersByFile: ReadonlyMap<string, Answers>): string[] {
	return files.filter(file => {
		const answer = answersByFile.get(file)?.importance;
		return !answer || answer.type !== "score";
	});
}

/** Repo-relative paths a receipt mentions, ignoring absolute paths and bare filenames. */
export function citedPaths(text: string): string[] {
	const found: string[] = [];
	for (const match of text.matchAll(/(?:^|[\s("'`])((?:apps|packages|scripts|patches|docs|backlog)\/[\w./@-]+\.\w+)/g)) {
		const path = match[1]!;
		if (!path.includes("..") && !found.includes(path)) found.push(path);
	}
	return found;
}

export interface Citation {
	readonly claim: string;
	readonly path: string;
}

/** One citation per (claim, path) pair, capped so a single receipt cannot flood the request. */
export function receiptCitations(receipt: unknown, maxClaims = 4, maxPaths = 2): Citation[] {
	const citations: Citation[] = [];
	const visit = (value: unknown, key: string): void => {
		if (citations.length >= maxClaims * maxPaths) return;
		if (typeof value === "string") {
			for (const path of citedPaths(value).slice(0, maxPaths)) {
				citations.push({ claim: `${key || "receipt"}: ${value.slice(0, 400)}`, path });
			}
			return;
		}
		if (Array.isArray(value)) { for (const entry of value) visit(entry, key); return; }
		if (value && typeof value === "object") {
			for (const [childKey, child] of Object.entries(value)) {
				// The common receipt shape is `{ "apps/... /file.ts": "what changed there" }`, so a
				// path in the key pairs with the text in the value. Missing this reported zero
				// citations for receipts that cite plenty.
				const keyPath = citedPaths(childKey)[0];
				if (keyPath && typeof child === "string") {
					citations.push({ claim: `${keyPath}: ${child.slice(0, 400)}`, path: keyPath });
					continue;
				}
				visit(child, childKey);
			}
		}
	};
	visit(receipt, "");
	return citations.slice(0, maxClaims * maxPaths);
}

/**
 * A window of the cited file around the first line that shares a word with the claim. Falling
 * back to the head of the file keeps the excerpt honest about what it actually is.
 */
export function excerptFor(content: string, claim: string, radius = 12, maxChars = 2_400): string {
	const lines = content.split("\n");
	const words = [...new Set(claim.toLowerCase().match(/[a-z_][a-z0-9_-]{4,}/g) ?? [])];
	const hit = words.length === 0
		? -1
		: lines.findIndex(line => {
			const lowered = line.toLowerCase();
			return words.some(word => lowered.includes(word));
		});
	const start = hit < 0 ? 0 : Math.max(0, hit - radius);
	const window = lines.slice(start, start + radius * 2).join("\n");
	return window.length > maxChars ? `${window.slice(0, maxChars)}\n[excerpt truncated]` : window;
}
