/*
 * Caret's own chat sessions provider.
 *
 * The Agents window is the base sessions workbench; it renders whatever a
 * provider advertises through the proposed `chatSessionsProvider` API. Caret is
 * that provider: this module projects the Caret host's durable sessions and OMP
 * event journal into the native chat UI. It never launches OMP and never keeps
 * a second transcript — the host owns both, so everything here is a projection
 * of `apps/host` state read over `CaretHostClient`.
 */

import * as vscode from "vscode";
import { randomUUID } from "node:crypto";
import type { CaretHostClient } from "./api.ts";
import type { EventPage, Session } from "../../../packages/protocol/src/index.ts";
import { applyEvent, createInitialTaskState, type TaskState, type TranscriptEntry } from "./state.ts";
import {
	abortRequest,
	CARET_CHAT_PARTICIPANT_ID,
	CARET_CHAT_SESSION_SCHEME,
	CARET_CHAT_SESSION_TYPE,
	promptRequest,
	sessionIdFromUri,
	sessionItemShape,
	sessionUriString,
	turnPlansFromTranscript,
	type SessionState,
} from "./chat-sessions-map.ts";

export { CARET_CHAT_PARTICIPANT_ID, CARET_CHAT_SESSION_SCHEME, CARET_CHAT_SESSION_TYPE } from "./chat-sessions-map.ts";

/** Delay between host event polls while a turn is streaming. */
export const STREAM_POLL_INTERVAL_MS = 400;
/** Polls that may return no new frames before a turn is treated as finished. */
export const STREAM_IDLE_POLLS = 5;

function chatSessionStatus(state: SessionState): vscode.ChatSessionStatus {
	switch (state) {
		case "in-progress": return vscode.ChatSessionStatus.InProgress;
		case "failed": return vscode.ChatSessionStatus.Failed;
		default: return vscode.ChatSessionStatus.Completed;
	}
}

export interface ChatSessionsOptions {
	/**
	 * Resolves the live host connection. Caret has exactly one connection owner
	 * (the task view provider), so this is an accessor rather than a client: it
	 * must reuse that owner's reconnect logic and never open a second client.
	 */
	readonly getClient: () => Promise<CaretHostClient>;
	/** Receives short explanations of degraded paths (host down, session missing). */
	readonly log: (message: string) => void;
}

/** Reduce every event page the host holds for a session and report the newest cursor. */
export async function readSessionState(client: CaretHostClient, sessionId: string, pageSize = 500): Promise<{ state: TaskState; cursor: number }> {
	let state = createInitialTaskState();
	let cursor = 0;
	for (;;) {
		const page: EventPage = await client.getEvents(sessionId, cursor, pageSize);
		for (const event of page.events) state = applyEvent(state, event);
		cursor = page.cursor;
		if (!page.hasMore) break;
	}
	return { state, cursor };
}

/**
 * Register Caret as this window's chat session provider and return a disposable
 * that unregisters the participant, controller and content provider together.
 */
export function registerCaretChatSessions(options: ChatSessionsOptions): vscode.Disposable {
	const { getClient, log } = options;
	// The sessions API is proposed and only exists in hosts that ship it (and in
	// the test doubles, not at all). Degrade to a no-op rather than failing the
	// whole activation, so the rest of the extension still works.
	const chat = vscode.chat as Partial<typeof vscode.chat> | undefined;
	if (!chat?.createChatParticipant || !chat.createChatSessionItemController || !chat.registerChatSessionContentProvider) {
		log("This host does not expose the chat sessions API; Caret sessions stay unavailable.");
		return { dispose() { /* nothing was registered */ } };
	}
	const disposables: vscode.Disposable[] = [];

	const participant = chat.createChatParticipant(CARET_CHAT_PARTICIPANT_ID, async () => undefined);
	disposables.push(participant);

	const applyItem = (item: vscode.ChatSessionItem, session: Session, projects: readonly { id: string; name: string }[] | undefined): void => {
		const shape = sessionItemShape(session, projects ? projects.find(project => project.id === session.projectId)?.name : undefined);
		item.label = shape.label;
		item.description = shape.description;
		item.status = chatSessionStatus(shape.state);
		item.timing = shape.timing;
		item.tooltip = session.cwd;
		// The Agents window groups rows by workspace, so the session's own
		// working directory has to travel with the item; without it the row lands
		// in an "Unknown" group even though the host knows exactly where it runs.
		item.metadata = { workingDirectoryPath: session.cwd, repositoryPath: session.cwd };
	};

	const controller = chat.createChatSessionItemController(CARET_CHAT_SESSION_TYPE, async token => {
		try {
			const client = await getClient();
			const [projects, sessions] = await Promise.all([client.listProjects(), client.listSessions()]);
			if (token.isCancellationRequested) return;
			log(`Caret chat sessions: ${sessions.length} session(s) in ${projects.length} project(s) from the host.`);
			controller.items.replace(sessions.map(session => {
				const item = controller.createChatSessionItem(vscode.Uri.parse(sessionUriString(session.id)), session.title);
				applyItem(item, session, projects);
				return item;
			}));
		} catch (error) {
			log(`Caret host sessions are unavailable: ${error instanceof Error ? error.message : String(error)}`);
			controller.items.replace([]);
		}
	});
	disposables.push(controller);

	controller.newChatSessionItemHandler = async (context, token) => {
		const client = await getClient();
		const projects = await client.listProjects();
		if (token.isCancellationRequested) throw new vscode.CancellationError();
		const project = projects.find(candidate => !candidate.archived) ?? projects[0];
		if (!project) throw new Error("Caret needs a project before it can start a session. Add a folder to the Caret host first.");
		const title = context.request.prompt.trim().slice(0, 80) || "New task";
		const session = await client.createSession({ projectId: project.id, title });
		const item = controller.createChatSessionItem(vscode.Uri.parse(sessionUriString(session.id)), session.title);
		applyItem(item, session, projects);
		controller.items.add(item);
		return item;
	};

	const provider: vscode.ChatSessionContentProvider = {
		async provideChatSessionContent(resource, token) {
			const sessionId = sessionIdFromUri(resource);
			if (!sessionId) throw new Error("Caret received a chat session resource it does not own.");
			const client = await getClient();
			const session = await client.getSession(sessionId);
			if (token.isCancellationRequested) throw new vscode.CancellationError();
			const { state } = await readSessionState(client, sessionId);
			return {
				title: session.title,
				history: historyFromState(state, participant.id),
				requestHandler: async (request, _context, stream, requestToken) => {
					await runTurn(client, session, request.prompt, stream, requestToken, log);
				},
			};
		},
	};

	disposables.push(chat.registerChatSessionContentProvider(CARET_CHAT_SESSION_SCHEME, provider, participant, { supportsInterruptions: true }));
	return vscode.Disposable.from(...disposables);
}

/** Convert a reduced transcript into the turns the native chat UI renders. */
export function historyFromState(state: TaskState, participantId: string): ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn2> {
	const turns: Array<vscode.ChatRequestTurn | vscode.ChatResponseTurn2> = [];
	for (const plan of turnPlansFromTranscript(state.transcript)) {
		if (plan.kind === "request") {
			turns.push(new vscode.ChatRequestTurn2(plan.text, undefined, [], participantId, [], undefined, undefined, undefined, undefined));
			continue;
		}
		const parts: vscode.ChatResponseMarkdownPart[] = [];
		if (plan.text) parts.push(new vscode.ChatResponseMarkdownPart(plan.text));
		for (const toolName of plan.toolNames) parts.push(new vscode.ChatResponseMarkdownPart(`\`${toolName}\``));
		if (parts.length === 0) continue;
		turns.push(new vscode.ChatResponseTurn2(parts, {}, participantId));
	}
	return turns;
}

/**
 * Send one prompt to the host and stream the OMP frames it produces back into
 * the native chat view. The host remains the only writer of the transcript:
 * this reads events forward from the cursor captured before the prompt.
 */
export async function runTurn(
	client: CaretHostClient,
	session: Session,
	prompt: string,
	stream: vscode.ChatResponseStream,
	token: vscode.CancellationToken,
	log: (message: string) => void,
): Promise<void> {
	let state = createInitialTaskState({ project: null, session });
	let cursor = 0;
	try {
		const start = await readSessionState(client, session.id);
		state = start.state;
		cursor = start.cursor;
	} catch (error) {
		log(`Caret could not read the existing transcript: ${error instanceof Error ? error.message : String(error)}`);
	}

	let incarnation = session.incarnation;
	try {
		const running = await client.startSession(session.id);
		incarnation = running.incarnation;
		await client.sendCommand(session.id, promptRequest({ ...session, incarnation }, prompt, randomUUID()));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		stream.markdown(`Caret could not start this task: ${message}`);
		throw error;
	}

	let idlePolls = 0;
	let emitted = state.transcript.length;
	for (;;) {
		if (token.isCancellationRequested) {
			try {
				await client.sendCommand(session.id, abortRequest({ ...session, incarnation }, randomUUID()));
			} catch (error) {
				log(`Caret could not stop the task: ${error instanceof Error ? error.message : String(error)}`);
			}
			return;
		}
		await new Promise(resolve => setTimeout(resolve, STREAM_POLL_INTERVAL_MS));

		let page: EventPage;
		try {
			page = await client.getEvents(session.id, cursor, 200);
		} catch (error) {
			log(`Caret lost the event stream: ${error instanceof Error ? error.message : String(error)}`);
			return;
		}
		const before = state.transcript.length;
		for (const event of page.events) state = applyEvent(state, event);
		cursor = page.cursor;
		idlePolls = page.events.length > 0 ? 0 : idlePolls + 1;

		for (const entry of state.transcript.slice(Math.max(before, emitted))) emitEntry(stream, entry);
		emitted = Math.max(emitted, state.transcript.length);

		if (page.events.length === 0 && idlePolls >= STREAM_IDLE_POLLS) {
			try {
				const current = await client.getSession(session.id);
				if (current.status === "running") continue;
			} catch {
				// The host went away; end the turn instead of spinning forever.
			}
			return;
		}
	}
}

function emitEntry(stream: vscode.ChatResponseStream, entry: TranscriptEntry): void {
	if (entry.role === "user" || entry.role === "system") return;
	if (entry.kind === "tool") {
		const label = entry.toolName ?? entry.text;
		if (label) stream.progress(`tool ${entry.toolStatus ?? "running"}: ${label}`);
		return;
	}
	if (entry.text) stream.markdown(entry.text);
}
