/** D12 artifact list filters. Client presentation of immutable receipts. */

export const ARTIFACT_TYPE_FILTERS = ["all", "image", "text", "audio", "video", "pdf", "binary", "unknown"] as const;
export type ArtifactTypeFilter = (typeof ARTIFACT_TYPE_FILTERS)[number];

export interface ArtifactFilterInput {
	readonly type?: string;
	readonly build?: string;
	readonly source?: string;
}

export interface FilterableArtifact {
	readonly name?: string;
	readonly mime?: string;
	readonly buildId?: string;
	readonly sha256?: string;
	readonly createdAt?: string;
	readonly preview?: { readonly kind?: string; readonly header?: string };
}

export function normalizeArtifactTypeFilter(value: unknown): ArtifactTypeFilter {
	return typeof value === "string" && (ARTIFACT_TYPE_FILTERS as readonly string[]).includes(value)
		? value as ArtifactTypeFilter
		: "all";
}

export function filterArtifacts<T extends FilterableArtifact>(
	items: readonly T[],
	filter: ArtifactFilterInput = {},
): T[] {
	const type = normalizeArtifactTypeFilter(filter.type);
	const build = (filter.build ?? "").trim().toLowerCase();
	const source = (filter.source ?? "").trim().toLowerCase();
	return items.filter((item) => {
		const kind = item.preview?.kind || "unknown";
		if (type !== "all" && kind !== type) return false;
		if (build && !(item.buildId ?? "").toLowerCase().includes(build)) return false;
		if (source && !`${item.name ?? ""} ${item.sha256 ?? ""} ${item.mime ?? ""}`.toLowerCase().includes(source)) return false;
		return true;
	});
}
