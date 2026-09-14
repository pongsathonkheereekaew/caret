/** D13 settings search. Match label/description/section only; go-result focuses the setting label. */

export interface SettingsHit {
	readonly id: string;
	readonly section: string;
	readonly label: string;
	readonly description?: string;
}

export function settingsHits(query: string, rows: readonly SettingsHit[]): readonly SettingsHit[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return [];
	return rows.filter((row) => haystack(row).includes(needle));
}

function haystack(row: SettingsHit): string {
	return [row.label, row.description ?? "", row.section].join("\n").toLowerCase();
}
