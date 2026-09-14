/*
 * Pure projection from Caret host state to the shapes the native chat UI
 * expects. Kept free of the `vscode` module so it can be unit-tested with
 * fixtures; the registration layer lives in chat-sessions.ts.
 */

import type { CommandRequest, Project, Session } from "../../../packages/protocol/src/index.ts";
import type { TranscriptEntry } from "./state.ts";

export const CARET_CHAT_SESSION_SCHEME = "caret";
/**
 * One id for the whole surface: the chat session type, the contributed
 * `chatSessions` entry and the default chat participant all use it, because the
 * workbench resolves the participant against the session contribution
 * (`getAllChatSessionContributions().find(c => c.type === id)`).
 */
export const CARET_CHAT_SESSION_TYPE = "caret.omp";
export const CARET_CHAT_PARTICIPANT_ID = "caret.omp";

/** Semantic session state; the registration layer maps it to `vscode.ChatSessionStatus`. */
export type SessionState = "in-progress" | "completed" | "failed";

export interface SessionItemShape {
	readonly id: string;
	readonly label: string;
	readonly description: string | undefined;
	readonly state: SessionState;
	readonly timing: { readonly created: number; readonly lastRequestStarted?: number; readonly lastRequestEnded?: number };
}

/** Provider-independent description of one transcript turn. */
export interface TurnPlan {
	readonly kind: "request" | "response";
	readonly text: string;
	readonly toolNames: readonly string[];
}

export function sessionUriString(sessionId: string): string {
	return `${CARET_CHAT_SESSION_SCHEME}://session/${encodeURIComponent(sessionId)}`;
}

export function sessionIdFromUri(uri: { readonly scheme: string; readonly authority?: string; readonly path: string }): string | undefined {
	if (uri.scheme !== CARET_CHAT_SESSION_SCHEME || uri.authority !== "session") return undefined;
	const id = decodeURIComponent(uri.path.replace(/^\//, ""));
	return id.length > 0 ? id : undefined;
}

/**
 * Host status -> UI state. `idle` and `stopped` are both "the host is not
 * working on this", which the UI shows as completed; only a host that demands
 * reconciliation is reported as failed, because that is the state that needs
 * the user's attention.
 */
export function sessionState(status: Session["status"]): SessionState {
	switch (status) {
		case "running": return "in-progress";
		case "recovery_required": return "failed";
		default: return "completed";
	}
}

function millis(value: string | undefined): number {
	if (!value) return 0;
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

export function sessionItemShape(session: Session, projectName?: string): SessionItemShape {
	const updated = millis(session.updatedAt) || undefined;
	return {
		id: session.id,
		label: session.title,
		description: projectName,
		state: sessionState(session.status),
		timing: {
			created: millis(session.createdAt),
			lastRequestStarted: updated,
			lastRequestEnded: session.status === "running" ? undefined : updated,
		},
	};
}

export function projectNameFor(projects: readonly Project[], session: Session): string | undefined {
	return projects.find(project => project.id === session.projectId)?.name;
}

/**
 * Group a reduced transcript into user requests and the assistant/tool work that
 * answered them. Anything the host did not record is left out, never invented.
 */
export function turnPlansFromTranscript(transcript: readonly TranscriptEntry[]): readonly TurnPlan[] {
	const plans: TurnPlan[] = [];
	for (const entry of transcript) {
		if (entry.role === "user") {
			plans.push({ kind: "request", text: entry.text, toolNames: [] });
			continue;
		}
		if (entry.role === "system") continue;
		// A tool row contributes its name only. Its output is not prose and must
		// not be spliced into the assistant's markdown, and the row's text is the
		// label itself, so appending both would duplicate it.
		const isTool = entry.kind === "tool";
		const toolName = isTool ? (entry.toolName ?? entry.text) : undefined;
		const last = plans.at(-1);
		if (last?.kind === "response") {
			plans[plans.length - 1] = {
				kind: "response",
				text: [last.text, isTool ? "" : entry.text].filter(Boolean).join("\n\n"),
				toolNames: toolName ? [...last.toolNames, toolName] : last.toolNames,
			};
			continue;
		}
		plans.push({ kind: "response", text: isTool ? "" : entry.text, toolNames: toolName ? [toolName] : [] });
	}
	return plans;
}

export function promptRequest(session: Session, prompt: string, commandId: string): CommandRequest {
	return { commandId, incarnation: session.incarnation, command: "prompt", payload: { prompt } };
}

export function abortRequest(session: Session, commandId: string): CommandRequest {
	return { commandId, incarnation: session.incarnation, command: "abort" };
}
