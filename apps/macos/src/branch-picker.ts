/** New-draft branch picker (D18). Lists advertised Git refs only. Does not checkout. */

export type BranchKind = "local" | "remote" | "current";

export interface BranchHit {
	readonly name: string;
	readonly kind: BranchKind;
	readonly current: boolean;
}

export interface BranchPickerState {
	readonly query: string;
	readonly hits: readonly BranchHit[];
	readonly noMatch: boolean;
	readonly loading: boolean;
	readonly current?: string;
	readonly selected?: string;
}

export const BRANCH_NO_GIT = "No Git branch until the folder has a repository.";
export const BRANCH_NO_RESULTS = "No matching refs. Refresh to reload advertised local and remote names.";
export const BRANCH_SELECT_REASON = "Selecting a ref targets the new draft. Caret will not checkout until you confirm a workspace workflow.";

export function parseGitBranchList(stdout: string, current?: string): BranchHit[] {
	const seen = new Set<string>();
	const hits: BranchHit[] = [];
	const head = current?.trim();
	for (const raw of stdout.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line || line.endsWith("/HEAD") || line.includes(" -> ")) continue;
		const starred = line.startsWith("*");
		const remote = line.includes("remotes/");
		const name = line.replace(/^\*\s+/, "").replace(/^remotes\//, "").trim();
		if (!name || seen.has(name)) continue;
		seen.add(name);
		const isCurrent = starred || (head !== undefined && name === head);
		hits.push({
			name,
			kind: isCurrent ? "current" : remote ? "remote" : "local",
			current: isCurrent,
		});
	}
	return hits;
}

export function filterBranchHits(hits: readonly BranchHit[], query: string, loading = false): BranchPickerState {
	const needle = query.trim().toLowerCase();
	const filtered = needle ? hits.filter(item => item.name.toLowerCase().includes(needle) || item.kind.includes(needle)) : [...hits];
	const current = hits.find(item => item.current)?.name;
	return {
		query: query.trim(),
		hits: filtered,
		noMatch: Boolean(needle) && filtered.length === 0,
		loading,
		...(current ? { current } : {}),
	};
}

export function emptyBranchPicker(current?: string): BranchPickerState {
	return { query: "", hits: [], noMatch: false, loading: false, ...(current ? { current } : {}) };
}
