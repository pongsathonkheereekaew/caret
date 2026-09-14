/** S04 / D06 older-history honesty. Host event pages are forward-only. */

export const OLDER_PAGES_NOTE = "Older pages are not advertised.";
export const HISTORY_CHANGED_NOTE = "History changed";

export interface HistoryBannerInput {
	readonly olderPagesAdvertised?: boolean;
	readonly historyNote?: string;
	readonly anchorMissing?: boolean;
}

export function transcriptHistoryBanner(input: HistoryBannerInput): string | undefined {
	if (input.historyNote?.trim()) return input.historyNote.trim();
	if (input.anchorMissing) return HISTORY_CHANGED_NOTE;
	if (input.olderPagesAdvertised === false) return OLDER_PAGES_NOTE;
	return undefined;
}

export function olderPagesLoadNote(cursor: number): string {
	if (!Number.isFinite(cursor) || cursor <= 0) return OLDER_PAGES_NOTE;
	return HISTORY_CHANGED_NOTE;
}
