/** In-editor marks for the edits Cedia applied to an open buffer.
 *
 * OMP applies guarded edits through the editor bridge, so they land in the
 * editor's buffer as ordinary unsaved changes: the user can already review
 * them with the normal diff and take them back with undo. What was missing is
 * the Cursor-class affordance on top of that - show which regions Cedia
 * touched, and offer one action to keep them (save) and one to take them back.
 *
 * The geometry and the safety rule are pure so they can be tested without a
 * `vscode` import.
 */

export interface MarkPosition {
	readonly line: number;
	readonly character: number;
}

export interface MarkRange {
	readonly start: MarkPosition;
	readonly end: MarkPosition;
}

export interface MarkEdit {
	readonly range: MarkRange;
	readonly text: string;
}

/** Where each edit's replacement text lands in the *new* document.
 *
 * Editing never moves an earlier position, the bridge rejects overlapping
 * edits, and each edit is applied at its own start, so an edit's new range
 * begins exactly where its old range began and ends after the text it
 * inserted. Returned in document order.
 */
export function appliedRanges(edits: readonly MarkEdit[]): MarkRange[] {
	const ranges = edits.map(edit => {
		const lines = edit.text.split("\n");
		const start = { line: edit.range.start.line, character: edit.range.start.character };
		const end = lines.length === 1
			? { line: start.line, character: start.character + edit.text.length }
			: { line: start.line + lines.length - 1, character: lines[lines.length - 1]!.length };
		return { start, end };
	});
	return ranges.sort((a, b) => a.start.line - b.start.line || a.start.character - b.start.character || a.end.line - b.end.line || a.end.character - b.end.character);
}

function beforeOrAt(a: MarkPosition, b: MarkPosition): boolean {
	return a.line < b.line || (a.line === b.line && a.character <= b.character);
}

/** Merge touching or overlapping ranges so one decoration is not stacked on
 * the same text twice. */
export function mergeRanges(ranges: readonly MarkRange[]): MarkRange[] {
	const sorted = [...ranges].sort((a, b) => a.start.line - b.start.line || a.start.character - b.start.character || a.end.line - b.end.line || a.end.character - b.end.character);
	const merged: MarkRange[] = [];
	for (const range of sorted) {
		const last = merged[merged.length - 1];
		if (last && beforeOrAt(range.start, last.end)) {
			if (!beforeOrAt(range.end, last.end)) merged[merged.length - 1] = { start: last.start, end: range.end };
			continue;
		}
		merged.push(range);
	}
	return merged;
}

/** Distinct document lines the ranges touch. */
export function touchedLineCount(ranges: readonly MarkRange[]): number {
	const lines = new Set<number>();
	for (const range of ranges) for (let line = range.start.line; line <= range.end.line; line += 1) lines.add(line);
	return lines.size;
}

/** One-line label shared by the decoration hover and the status message. */
export function agentEditLabel(path: string, ranges: readonly MarkRange[]): string {
	const lines = touchedLineCount(ranges);
	const regions = ranges.length === 1 ? "1 region" : `${ranges.length} regions`;
	return `${path}: ${regions}, ${lines} ${lines === 1 ? "line" : "lines"} changed by Cedia`;
}

/** The slice of a text document the mark geometry needs. The real
 * `vscode.TextDocument` satisfies this structurally. */
export interface MarkableDocument {
	readonly lineCount: number;
	lineAt(line: number): { readonly range: { readonly end: MarkPosition } };
}

/** The range to paint. A pure deletion leaves a zero-width range, which would
 * be invisible, so it widens to the whole line the deletion sits on. */
export function decorationRange(document: MarkableDocument, range: MarkRange): MarkRange {
	if (range.start.line !== range.end.line || range.start.character !== range.end.character) return range;
	const line = Math.max(0, Math.min(range.start.line, document.lineCount - 1));
	return { start: range.start, end: document.lineAt(line).range.end };
}

/** Hover text on every Cedia mark, naming the file and the two actions. */
export function decorationHover(path: string): string {
	return `Cedia applied this edit to ${path}. Save to keep it, or run "Cedia: Take Back the Cedia Edit".`;
}

/** A Cedia edit waiting on the user's decision. */
export interface PendingAgentEdit {
	/** Workspace-relative path, for the label. */
	readonly path: string;
	readonly ranges: readonly MarkRange[];
	/** Document version the edit produced. */
	readonly version: number;
	/** The buffer's text immediately before the edit, for an exact revert. */
	readonly textBefore: string;
}

export const STALE_AGENT_EDIT_REASON =
	"The file changed after Cedia's edit, so taking that edit back here would also undo your own change. Use Undo instead.";

export type RevertDecision =
	| { readonly ok: true; readonly text: string }
	| { readonly ok: false; readonly reason: string };

/** Reverting means restoring the exact pre-edit text, which is only honest
 * while the buffer still holds the version Cedia produced. Once anything else
 * has touched the buffer, the user's own work is in there too, so Cedia
 * declines and points at Undo instead of silently discarding edits. */
export function revertDecision(pending: PendingAgentEdit, currentVersion: number): RevertDecision {
	if (currentVersion !== pending.version) return { ok: false, reason: STALE_AGENT_EDIT_REASON };
	return { ok: true, text: pending.textBefore };
}

export const AGENT_EDIT_REVIEW_STALE_REASON =
	"The file changed after Cedia's edit, so a diff against the pre-edit text would also show your own change. Use Undo to compare instead.";

export type AgentEditReviewDecision =
	| { readonly ok: true }
	| { readonly ok: false; readonly reason: string };

/** Whether a review diff of *only* Cedia's change is honest to open. The left
 * side is the recorded pre-edit text, so once anything else has touched the
 * buffer the diff would misattribute the user's own change to Cedia; Cedia
 * declines instead of showing a misleading review. */
export function agentEditReviewDecision(pending: PendingAgentEdit, currentVersion: number): AgentEditReviewDecision {
	if (currentVersion !== pending.version) return { ok: false, reason: AGENT_EDIT_REVIEW_STALE_REASON };
	return { ok: true };
}

/** A decision offered on the change itself, as an editor CodeLens. */
export interface AgentEditLensSpec {
	/** Zero-based line the lens sits on. */
	readonly line: number;
	readonly title: string;
	readonly command: string;
}

/** The two decisions, placed on the first region Cedia changed, the way a
 * Cursor-class editor puts Accept/Reject at the hunk instead of only in a menu.
 * Titles mirror the manifest commands so the editor shows one vocabulary. */
export function agentEditLenses(pending: PendingAgentEdit): AgentEditLensSpec[] {
	const line = pending.ranges[0]?.start.line ?? 0;
	return [
		{ line, title: "Keep the Cedia Edit", command: "cedia.keepAgentEdit" },
		{ line, title: "Take Back the Cedia Edit", command: "cedia.revertAgentEdit" },
	];
}

/** Offsets of each line start in `text`, for line/character -> offset math. */
function lineOffsets(text: string): number[] {
	const offsets = [0];
	for (let index = 0; index < text.length; index += 1) if (text[index] === "\n") offsets.push(index + 1);
	return offsets;
}

/** Apply bridge edits to the pre-edit text. Edits carry ranges in the pre-edit
 * document and the bridge rejects overlaps, so splicing from the last edit
 * backwards reproduces the produced text exactly. */
export function applyEdits(before: string, edits: readonly MarkEdit[]): string {
	const offsets = lineOffsets(before);
	const toOffset = (position: MarkPosition): number => (offsets[position.line] ?? before.length) + position.character;
	const spans = edits
		.map(edit => ({ start: toOffset(edit.range.start), end: toOffset(edit.range.end), text: edit.text }))
		.sort((a, b) => b.start - a.start);
	let produced = before;
	for (const span of spans) produced = produced.slice(0, span.start) + span.text + produced.slice(span.end);
	return produced;
}

/** The narrowest whole-line span that differs between two texts, or undefined
 * when they are equal. A native apply can report one whole-file edit even when
 * two characters changed, so the mark is derived from the text the apply
 * actually produced instead of from the edit's own granularity. */
export function changedLineSpan(before: string, after: string): MarkRange | undefined {
	if (before === after) return undefined;
	const beforeLines = before.split("\n");
	const afterLines = after.split("\n");
	let first = 0;
	while (first < beforeLines.length && first < afterLines.length && beforeLines[first] === afterLines[first]) first += 1;
	let beforeLast = beforeLines.length - 1;
	let afterLast = afterLines.length - 1;
	while (beforeLast >= first && afterLast >= first && beforeLines[beforeLast] === afterLines[afterLast]) {
		beforeLast -= 1;
		afterLast -= 1;
	}
	const endLine = Math.max(afterLast, first);
	return { start: { line: first, character: 0 }, end: { line: endLine, character: afterLines[endLine]?.length ?? 0 } };
}

/** Ranges to mark for one applied edit: the changed lines when the produced text
 * shows them, and otherwise the edit geometry, so a change is never silently
 * unmarked when the reported spans and the text disagree. */
export function markRangesFor(textBefore: string, edits: readonly MarkEdit[]): MarkRange[] {
	const span = changedLineSpan(textBefore, applyEdits(textBefore, edits));
	return span ? [span] : mergeRanges(appliedRanges(edits));
}
