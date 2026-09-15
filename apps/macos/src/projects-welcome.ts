/** S01 / D01 Projects welcome. Open folder is real. Clone stays unavailable until a git-clone contract exists. */

export const CLONE_UNAVAILABLE_REASON = "Clone stays unavailable until a Caret git-clone contract exists. Caret will not run git clone from this screen.";
export const MISSING_RECENT_REASON = "This folder is missing. Caret will not invent a replacement project.";

/**
 * What adding a folder to Caret has to do, given what the host already holds.
 *
 * The Agents sidebar lists a project as the workspace group of its sessions, so a
 * project that is registered but has no open task is added and stays invisible - the
 * task is what makes the row. A folder the host already knows is reused rather than
 * duplicated, and adding back a project Caret had removed un-archives its record.
 */
export function projectAddPlan(input: {
	readonly known?: { readonly archived: boolean };
	readonly openSessions: number;
}): { readonly createProject: boolean; readonly unarchive: boolean; readonly createSession: boolean } {
	return {
		createProject: input.known === undefined,
		unarchive: input.known?.archived === true,
		createSession: input.openSessions === 0,
	};
}
export const OPEN_FOLDER_LABEL = "Open folder";
export const CLONE_LABEL = "Clone repository";
export const NEW_TASK_WELCOME_LABEL = "New task";

export interface WelcomeRecent {
	readonly path: string;
	readonly name: string;
	readonly missing: boolean;
	readonly openable: boolean;
	readonly reason?: string;
}

export interface WelcomeAction {
	readonly id: "open_folder" | "clone" | "new_task";
	readonly label: string;
	readonly enabled: boolean;
	readonly reason?: string;
}

export interface ProjectsWelcomeModel {
	readonly title: "Projects";
	readonly kicker: "WELCOME";
	readonly actions: readonly WelcomeAction[];
	readonly recents: readonly WelcomeRecent[];
}

export function recentDisplayName(path: string): string {
	const segments = path.split(/[/\\]/).filter((segment) => segment.length > 0);
	return segments.at(-1) ?? "Folder";
}

export function projectsWelcomeModel(input: {
	readonly recents?: readonly { path: string; name?: string; missing?: boolean }[];
	readonly cloneAdvertised?: boolean;
} = {}): ProjectsWelcomeModel {
	const cloneAdvertised = input.cloneAdvertised === true;
	return {
		title: "Projects",
		kicker: "WELCOME",
		actions: [
			{ id: "open_folder", label: OPEN_FOLDER_LABEL, enabled: true },
			{
				id: "clone",
				label: CLONE_LABEL,
				enabled: cloneAdvertised,
				...(cloneAdvertised ? {} : { reason: CLONE_UNAVAILABLE_REASON }),
			},
			{ id: "new_task", label: NEW_TASK_WELCOME_LABEL, enabled: true },
		],
		recents: (input.recents ?? []).map((recent) => {
			const missing = recent.missing === true;
			return {
				path: recent.path,
				name: recent.name?.trim() || recentDisplayName(recent.path),
				missing,
				openable: !missing,
				...(missing ? { reason: MISSING_RECENT_REASON } : {}),
			};
		}),
	};
}
