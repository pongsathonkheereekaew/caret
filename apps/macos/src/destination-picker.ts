/** D18 destination groups. Presentation only — does not start OMP or invent Cloud. */

export type DestinationGroupId = "run_on" | "connect_via" | "workspace";

export interface DestinationOption {
	readonly id: string;
	readonly group: DestinationGroupId;
	readonly groupLabel: string;
	readonly label: string;
	readonly enabled: boolean;
	readonly current: boolean;
	readonly reason?: string;
	readonly action?: "keep" | "open_worktree" | "unavailable";
}

export const CLOUD_DESTINATION_REASON = "Cloud is not a Caret runtime.";
export const RELAY_UNKNOWN_REASON = "Relay status is unknown until a relay contract exists.";
export const WORKTREE_NO_GIT_REASON = "New worktree needs a Git repository. Use the current folder.";
export const THIS_MAC_LABEL = "This Mac";

export interface DestinationPickerInput {
	readonly hasGit?: boolean;
	readonly hostReachable?: boolean;
	readonly relayStatus?: string;
	readonly projectName?: string;
}

export function destinationOptions(input: DestinationPickerInput = {}): readonly DestinationOption[] {
	const project = input.projectName?.trim() || "Current folder";
	const relayReady = input.relayStatus === "ready" || input.relayStatus === "connected";
	return [
		{
			id: "run-mac",
			group: "run_on",
			groupLabel: "Run on",
			label: THIS_MAC_LABEL,
			enabled: true,
			current: true,
			action: "keep",
			reason: input.hostReachable === false ? "Mac host is unreachable. Draft stays on this device." : undefined,
		},
		{
			id: "run-cloud",
			group: "run_on",
			groupLabel: "Run on",
			label: "Cloud",
			enabled: false,
			current: false,
			action: "unavailable",
			reason: CLOUD_DESTINATION_REASON,
		},
		{
			id: "via-local",
			group: "connect_via",
			groupLabel: "Connect via",
			label: "Local / direct",
			enabled: true,
			current: true,
			action: "keep",
		},
		{
			id: "via-relay",
			group: "connect_via",
			groupLabel: "Connect via",
			label: "Relay",
			enabled: relayReady,
			current: false,
			action: relayReady ? "keep" : "unavailable",
			reason: relayReady ? undefined : RELAY_UNKNOWN_REASON,
		},
		{
			id: "ws-current",
			group: "workspace",
			groupLabel: "Workspace",
			label: project,
			enabled: true,
			current: true,
			action: "keep",
		},
		{
			id: "ws-worktree",
			group: "workspace",
			groupLabel: "Workspace",
			label: "New worktree",
			enabled: input.hasGit === true,
			current: false,
			action: input.hasGit === true ? "open_worktree" : "unavailable",
			reason: input.hasGit === true ? undefined : WORKTREE_NO_GIT_REASON,
		},
	];
}
