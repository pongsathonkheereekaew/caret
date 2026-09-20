/** D13 About identity. Advertised build facts only — no update/notarization claim. */

export interface AboutRow {
	readonly id: string;
	readonly label: string;
	readonly value: string;
	readonly claim: "advertised" | "unavailable";
}

const UNAVAILABLE = "Unavailable — not advertised on this build.";
const UPDATES_UNAVAILABLE = "Update check is read-only. Install is not claimed for this ad-hoc build.";

export function aboutIdentity(input: {
	readonly cediaVersion?: string;
	readonly extensionVersion?: string;
	readonly codeOssVersion?: string;
	readonly ompVersion?: string;
	readonly protocolVersion?: string;
	readonly sourceHash?: string;
	readonly connection?: string;
}): readonly AboutRow[] {
	return [
		row("cedia", "Cedia build", input.cediaVersion),
		row("extension", "Extension", input.extensionVersion),
		row("codeoss", "Code-OSS base", input.codeOssVersion),
		row("omp", "OMP version", input.ompVersion),
		row("protocol", "Protocol", input.protocolVersion),
		row("sourceHash", "Source hash", input.sourceHash),
		{
			id: "updates",
			label: "Updates",
			value: UPDATES_UNAVAILABLE,
			claim: "unavailable",
		},
	];
}

function row(id: string, label: string, value: string | undefined): AboutRow {
	const advertised = value?.trim() ?? "";
	if (!advertised) {
		return { id, label, value: UNAVAILABLE, claim: "unavailable" };
	}
	return { id, label, value: advertised, claim: "advertised" };
}
