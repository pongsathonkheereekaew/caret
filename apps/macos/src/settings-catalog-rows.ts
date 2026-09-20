/** D13 structured settings rows from already-fetched OMP lists. Presentation only — no invented backends. */

import { SETTINGS_APPLY_SCOPE_REASON, type SettingsScope } from "./settings-revision.ts";

const DEFAULT_SOURCE = "this Mac · OMP registry";
const HOSTED_ACTION_REASON = "Action stays on the existing Refresh/Log in/Run controls.";
const MCP_BROWSE_REASON = "Browse is not install. Lifecycle stays on the host/OMP registry.";
const MCP_NONE_REASON = "OMP has not advertised MCP servers. Browse is not install.";
const AUTOMATIONS_REASON = "Automations stay unavailable until advertised.";
const BILLED_FALLBACK_ID = "billed-fallback";

export interface SettingsBoundRow {
	readonly id: string;
	readonly section: string;
	readonly label: string;
	readonly value: string;
	readonly source: string;
	readonly scope: "global" | "project" | "session";
	readonly writable: boolean;
	readonly reason?: string;
}

/** Skills OMP advertises as slash commands, as the dock's skills collection. */
export function skillsFromSlashCommands(commands: readonly { readonly name: string; readonly source?: string }[]): readonly { readonly id: string; readonly label: string }[] {
	const skills: { readonly id: string; readonly label: string }[] = [];
	for (const command of commands) {
		if (command.source !== "skill" || !command.name) continue;
		if (skills.some((skill) => skill.id === command.name)) continue;
		skills.push({ id: command.name, label: command.name });
	}
	return skills;
}

/** OMP commands that already have a dedicated Cedia surface; the JSON picker omits them. */
export const OMP_COMMANDS_WITH_DEDICATED_UI: readonly string[] = ["get_available_models", "get_login_providers", "get_available_commands", "get_state"];

export function jsonPickerCommands(commands: readonly string[]): readonly string[] {
	return commands.filter((command) => !OMP_COMMANDS_WITH_DEDICATED_UI.includes(command));
}

export function bindSettingsCatalogRows(input: {
	readonly section: string;
	readonly models?: readonly { readonly id: string; readonly label?: string; readonly provider?: string; readonly available?: boolean; readonly authenticated?: boolean }[];
	readonly loginProviders?: readonly { readonly id: string; readonly name?: string; readonly available?: boolean; readonly authenticated?: boolean }[];
	readonly slashCommands?: readonly { readonly name: string; readonly description?: string }[];
	readonly mcpServers?: readonly { readonly id: string; readonly label?: string; readonly status?: string; readonly reason?: string }[];
	readonly skills?: readonly { readonly id: string; readonly label?: string }[];
	readonly hooks?: readonly { readonly id: string; readonly label?: string }[];
	readonly source?: string;
}): readonly SettingsBoundRow[] {
	const source = input.source ?? DEFAULT_SOURCE;
	const section = input.section;

	if (section === "Models/providers") {
		const rows: SettingsBoundRow[] = [];
		for (const model of input.models ?? []) {
			if (!model.id || model.id === BILLED_FALLBACK_ID) continue;
			rows.push(boundRow({
				id: `model:${model.id}`,
				section,
				label: model.label ?? model.id,
				value: modelValue(model),
				source,
				kind: "informational",
			}));
		}
		return rows;
	}

	if (section === "Agents/OMP") {
		const rows: SettingsBoundRow[] = [];
		rows.push(ompSignInRow(section, source, input.loginProviders));
		for (const provider of input.loginProviders ?? []) {
			if (!provider.id || provider.id === BILLED_FALLBACK_ID) continue;
			rows.push(boundRow({
				id: `provider:${provider.id}`,
				section,
				label: provider.name ?? provider.id,
				value: providerValue(provider),
				source,
				kind: "hosted-action",
			}));
		}
		return rows;
	}

	if (section === "Tools/MCP") {
		return bindMcpRows(section, source, input.mcpServers);
	}

	if (section === "Skills/rules/hooks/commands") {
		const rows: SettingsBoundRow[] = [];
		for (const command of input.slashCommands ?? []) {
			if (!command.name) continue;
			rows.push(boundRow({
				id: `slash:${command.name}`,
				section,
				label: `/${command.name}`,
				value: command.description?.trim() ? command.description : "OMP slash command",
				source,
				kind: "hosted-action",
			}));
		}
		pushAdvertisedOrNone(rows, {
			section,
			source,
			items: input.skills,
			prefix: "skill",
			noneLabel: "Skills",
		});
		pushAdvertisedOrNone(rows, {
			section,
			source,
			items: input.hooks,
			prefix: "hook",
			noneLabel: "Hooks",
		});
		rows.push(boundRow({
			id: "automations",
			section,
			label: "Automations",
			value: "unavailable",
			source,
			kind: "unavailable",
			reason: AUTOMATIONS_REASON,
		}));
		return rows;
	}

	return [];
}

function bindMcpRows(
	section: string,
	source: string,
	mcpServers: readonly { readonly id: string; readonly label?: string; readonly status?: string }[] | undefined,
): readonly SettingsBoundRow[] {
	if (!mcpServers || mcpServers.length === 0) {
		return [boundRow({
			id: "mcp:none",
			section,
			label: "MCP servers",
			value: "none advertised",
			source,
			kind: "unavailable",
			reason: MCP_NONE_REASON,
		})];
	}

	const rows: SettingsBoundRow[] = [];
	for (const server of mcpServers) {
		if (!server.id) continue;
		rows.push(boundRow({
			id: `mcp:${server.id}`,
			section,
			label: server.label ?? server.id,
			value: server.status?.trim() ? server.status : "advertised",
			source,
			kind: "unavailable",
			reason: MCP_BROWSE_REASON,
		}));
	}
	return rows;
}

function pushAdvertisedOrNone(
	rows: SettingsBoundRow[],
	input: {
		readonly section: string;
		readonly source: string;
		readonly items: readonly { readonly id: string; readonly label?: string }[] | undefined;
		readonly prefix: "skill" | "hook";
		readonly noneLabel: string;
	},
): void {
	const advertised = (input.items ?? []).filter((item) => item.id);
	if (advertised.length === 0) {
		rows.push(boundRow({
			id: `${input.prefix}:none`,
			section: input.section,
			label: input.noneLabel,
			value: "none advertised",
			source: input.source,
			kind: "unavailable",
		}));
		return;
	}
	for (const item of advertised) {
		rows.push(boundRow({
			id: `${input.prefix}:${item.id}`,
			section: input.section,
			label: item.label ?? item.id,
			value: "advertised",
			source: input.source,
			kind: "unavailable",
		}));
	}
}

function modelValue(model: {
	readonly provider?: string;
	readonly available?: boolean;
}): string {
	if (model.available === false) return "unavailable";
	return model.provider ? `available · ${model.provider}` : "available";
}

function ompSignInRow(
	section: string,
	source: string,
	providers: readonly { readonly id: string; readonly name?: string; readonly available?: boolean; readonly authenticated?: boolean }[] | undefined,
): SettingsBoundRow {
	const meaningful = (providers ?? []).filter(provider => provider.id && provider.available !== false);
	const pending = meaningful.filter(provider => provider.authenticated === false);
	if (meaningful.length > 0 && pending.length === 0) {
		return boundRow({
			id: "omp:sign-in",
			section,
			label: "OMP sign-in (/login)",
			value: `all ${meaningful.length} signed in`,
			source,
			kind: "hosted-action",
			reason: "Sign in state comes from the same store as omp in a terminal; run Cedia: OMP Sign In (/login) to attach another provider.",
		});
	}
	return boundRow({
		id: "omp:sign-in",
		section,
		label: "OMP sign-in (/login)",
		value: meaningful.length === 0 ? "no providers advertised" : `${pending.length} of ${meaningful.length} need sign-in`,
		source,
		kind: "hosted-action",
		reason: "Run Cedia: OMP Sign In (/login), or run omp in a terminal and type /login <provider> — same credential store either way.",
	});
}

function providerValue(provider: {
	readonly available?: boolean;
	readonly authenticated?: boolean;
}): string {
	if (provider.authenticated) return "signed in";
	if (provider.available === false) return "unavailable";
	return "not signed in";
}

function writePolicy(scope: SettingsScope, kind: "informational" | "hosted-action" | "unavailable"): Pick<SettingsBoundRow, "writable" | "reason"> {
	if (scope === "project" || scope === "session") {
		return { writable: false, reason: SETTINGS_APPLY_SCOPE_REASON };
	}
	if (kind === "hosted-action") {
		return { writable: false, reason: HOSTED_ACTION_REASON };
	}
	if (kind === "unavailable") {
		return { writable: false };
	}
	return { writable: true };
}

function boundRow(input: {
	readonly id: string;
	readonly section: string;
	readonly label: string;
	readonly value: string;
	readonly source: string;
	readonly kind: "informational" | "hosted-action" | "unavailable";
	readonly reason?: string;
}): SettingsBoundRow {
	const scope = "global";
	const policy = writePolicy(scope, input.kind);
	const reason = input.reason ?? policy.reason;
	return {
		id: input.id,
		section: input.section,
		label: input.label,
		value: input.value,
		source: input.source,
		scope,
		writable: policy.writable,
		...(reason ? { reason } : {}),
	};
}
