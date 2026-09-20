export type CapabilityStatus =
	| "available"
	| "needs_auth"
	| "unsupported"
	| "error"
	| "blocked_external";

export interface CatalogEntry {
	readonly id: string;
	readonly label: string;
	readonly status: CapabilityStatus;
	readonly owner: string;
	readonly reason: string;
}

export const SETTINGS_SECTIONS = [
	"Appearance",
	"Agents/OMP",
	"Models/providers",
	"Tools/MCP",
	"Skills/rules/hooks/commands",
	"Workspace/editor",
	"Browser/artifacts",
	"Devices/connections",
	"Notifications",
	"Privacy/security",
	"About/updates/licenses",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

const NO_INVENTED_BACKEND = "Cedia does not invent the backend";
const BILLED_FALLBACK_ID = "billed-fallback";

export interface AdvertisedModel {
	readonly id: string;
	readonly label?: string;
	readonly provider?: string;
	readonly authenticated?: boolean;
	readonly status?: CapabilityStatus;
	readonly reason?: string;
	readonly owner?: string;
}

export interface LoginProvider {
	readonly id: string;
	readonly name?: string;
	readonly available?: boolean;
	readonly authenticated?: boolean;
	readonly status?: CapabilityStatus;
	readonly reason?: string;
	readonly owner?: string;
}

export interface CapabilitySignal {
	readonly available?: boolean;
	readonly status?: CapabilityStatus;
	readonly reason?: string;
	readonly owner?: string;
	readonly label?: string;
}

export type CapabilityInput = boolean | CapabilitySignal;

export interface OmpSettingsCatalogInput {
	readonly models?: readonly AdvertisedModel[];
	readonly loginProviders?: readonly LoginProvider[];
	readonly browserBridge?: CapabilityInput;
	readonly voice?: CapabilityInput;
	readonly cloud?: CapabilityInput;
	readonly automations?: CapabilityInput;
}

const GATED = [
	{ key: "browserBridge" as const, id: "browser", label: "Browser", owner: "host" },
	{ key: "voice" as const, id: "voice", label: "Voice", owner: "cedia" },
	{ key: "cloud" as const, id: "cloud", label: "Cloud", owner: "cedia" },
	{ key: "automations" as const, id: "automations", label: "Automations", owner: "cedia" },
];

export function ompSettingsCatalog(input: OmpSettingsCatalogInput = {}): CatalogEntry[] {
	const authByProvider = new Map<string, boolean>();
	for (const provider of input.loginProviders ?? []) {
		if (typeof provider.authenticated === "boolean") {
			authByProvider.set(provider.id, provider.authenticated);
		}
	}

	const entries: CatalogEntry[] = [ompSignInEntry(input.loginProviders)];

	for (const model of input.models ?? []) {
		entries.push(modelEntry(model, authByProvider));
	}

	for (const provider of input.loginProviders ?? []) {
		entries.push(providerEntry(provider));
	}

	for (const gated of GATED) {
		entries.push(gatedEntry(gated.id, gated.label, gated.owner, input[gated.key]));
	}

	return entries.filter((entry) => entry.id !== BILLED_FALLBACK_ID);
}

function ompSignInEntry(providers: readonly LoginProvider[] | undefined): CatalogEntry {
	const meaningful = (providers ?? []).filter(provider => provider.id && provider.available !== false);
	const pending = meaningful.filter(provider => provider.authenticated === false);
	if (meaningful.length > 0 && pending.length === 0) {
		return {
			id: "omp-sign-in",
			label: "OMP sign-in (/login)",
			status: "available",
			owner: "omp",
			reason: `All ${meaningful.length} providers signed in`,
		};
	}
	return {
		id: "omp-sign-in",
		label: "OMP sign-in (/login)",
		status: "needs_auth",
		owner: "omp",
		reason:
			meaningful.length === 0
				? "No providers advertised yet — run Cedia: OMP Sign In (/login), or run omp in a terminal and type /login <provider>"
				: `${pending.length} of ${meaningful.length} providers need sign-in (${pending.map(provider => provider.name ?? provider.id).join(", ")}) — run Cedia: OMP Sign In (/login), or run omp in a terminal and type /login <provider>`,
	};
}

function modelEntry(model: AdvertisedModel, authByProvider: Map<string, boolean>): CatalogEntry {
	const providerUnauthenticated =
		model.authenticated === false ||
		(model.provider !== undefined && authByProvider.get(model.provider) === false);

	let status: CapabilityStatus = "available";
	let reason = "Advertised by OMP";
	if (model.status === "blocked_external" || model.status === "error" || model.status === "unsupported") {
		status = model.status;
		reason = model.reason ?? reasonFor(status, "model");
	} else if (providerUnauthenticated || model.status === "needs_auth") {
		status = "needs_auth";
		reason = model.reason ?? "Provider is not authenticated";
	} else if (model.reason) {
		reason = model.reason;
	}

	return {
		id: `model:${model.id}`,
		label: model.label ?? model.id,
		status,
		owner: model.owner ?? "omp",
		reason,
	};
}

function providerEntry(provider: LoginProvider): CatalogEntry {
	let status: CapabilityStatus = "available";
	let reason = "Advertised by OMP";

	if (provider.status === "blocked_external" || provider.status === "error" || provider.status === "unsupported") {
		status = provider.status;
		reason = provider.reason ?? reasonFor(status, "provider");
	} else if (provider.authenticated === false || provider.status === "needs_auth") {
		status = "needs_auth";
		reason = provider.reason ?? "Provider is not authenticated";
	} else if (provider.available === false) {
		status = "unsupported";
		reason = provider.reason ?? "Provider is not available";
	} else if (provider.reason) {
		reason = provider.reason;
	}

	return {
		id: `provider:${provider.id}`,
		label: provider.name ?? provider.id,
		status,
		owner: provider.owner ?? "omp",
		reason,
	};
}

function gatedEntry(id: string, label: string, owner: string, signal: CapabilityInput | undefined): CatalogEntry {
	if (signal === undefined || signal === false) {
		return {
			id,
			label,
			status: "unsupported",
			owner,
			reason: NO_INVENTED_BACKEND,
		};
	}

	if (signal === true) {
		return {
			id,
			label,
			status: "available",
			owner,
			reason: "Advertised by host",
		};
	}

	if (signal.status === "blocked_external" || signal.status === "error") {
		return {
			id,
			label: signal.label ?? label,
			status: signal.status,
			owner: signal.owner ?? owner,
			reason: signal.reason ?? reasonFor(signal.status, id),
		};
	}

	if (signal.status === "needs_auth") {
		return {
			id,
			label: signal.label ?? label,
			status: "needs_auth",
			owner: signal.owner ?? owner,
			reason: signal.reason ?? "Provider is not authenticated",
		};
	}

	if (signal.status === "unsupported" || signal.available === false) {
		return {
			id,
			label: signal.label ?? label,
			status: "unsupported",
			owner: signal.owner ?? owner,
			reason: signal.reason ?? NO_INVENTED_BACKEND,
		};
	}

	if (signal.status === "available" || signal.available === true) {
		return {
			id,
			label: signal.label ?? label,
			status: "available",
			owner: signal.owner ?? owner,
			reason: signal.reason ?? "Advertised by host",
		};
	}

	return {
		id,
		label: signal.label ?? label,
		status: "unsupported",
		owner: signal.owner ?? owner,
		reason: signal.reason ?? NO_INVENTED_BACKEND,
	};
}

function reasonFor(status: CapabilityStatus, kind: string): string {
	switch (status) {
		case "blocked_external":
			return `${kind} is blocked externally`;
		case "error":
			return `${kind} reported an error`;
		case "unsupported":
			return NO_INVENTED_BACKEND;
		case "needs_auth":
			return "Provider is not authenticated";
		case "available":
			return "Advertised";
	}
}
