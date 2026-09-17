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
import type { Command, EventPage, Session } from "../../../packages/protocol/src/index.ts";
import { applyEvent, createInitialTaskState, type TaskState, type TranscriptEntry } from "./state.ts";
import {
	abortRequest,
	CARET_CHAT_PARTICIPANT_ID,
	CARET_CHAT_SESSION_SCHEME,
	CARET_CHAT_SESSION_TYPE,
	contextUsageFromOmpState,
	currentModelIdFromOmpState,
	getAvailableModelsRequest,
	getLoginProvidersRequest,
	getOmpStateRequest,
	modelPickerGroupFromSnapshot,
	normalizeOmpLoginProviders,
	normalizeOmpModels,
	getModelRolesRequest,
	normalizeOmpModelRoles,
	ompModelIdFromPickId,
	projectOmpModelSnapshot,
	promptRequest,
	resolveOmpModelPickProvider,
	sessionIdFromUri,
	sessionItemShape,
	sessionUriString,
	setOmpModelRequest,
	turnPlansFromTranscript,
	type OmpAdvertisedModel,
	type OmpLoginProvider,
	type OmpModelRoles,
	type OmpModelSnapshot,
	type SessionState,
} from "./chat-sessions-map.ts";
import { registerCaretLanguageModels } from "./omp-language-models.ts";

export { CARET_CHAT_PARTICIPANT_ID, CARET_CHAT_SESSION_SCHEME, CARET_CHAT_SESSION_TYPE } from "./chat-sessions-map.ts";
export type { OmpAdvertisedModel, OmpLoginProvider, OmpModelSnapshot };

/** Option-group id the native and webview model pickers share. */
export const CARET_OMP_MODELS_GROUP_ID = "models";


/**
 * List OMP's advertised models through the existing host command envelope
 * (`get_available_models:{}` -> ack/result `.models`). No new host route;
 * failures propagate so callers can degrade honestly to an empty catalog.
 */
export async function fetchOmpModels(client: CaretHostClient, session: Session): Promise<OmpAdvertisedModel[]> {
	const result = await client.sendCommand(session.id, getAvailableModelsRequest(session, randomUUID()));
	return normalizeOmpModels(result.result ?? result.ack);
}

/** Read OMP's current model id via `get_state` (undefined when unadvertised). */
export async function fetchOmpCurrentModelId(client: CaretHostClient, session: Session): Promise<string | undefined> {
	const result = await client.sendCommand(session.id, getOmpStateRequest(session, randomUUID()));
	return currentModelIdFromOmpState(result.result ?? result.ack);
}

/**
 * Honest OMP catalog snapshot: models plus the current id when still
 * advertised, annotated with `needs_auth` from `get_login_providers` when OMP
 * has that data. Never throws and never invents a fallback — host failures
 * yield an empty catalog (and empty login data) so the picker stays
 * honest-disabled. An explicit `options.loginProviders` wins (fixture
 * injection); otherwise the providers are fetched best-effort in this same
 * path and a fetch failure degrades to unannotated rather than throwing.
 */
export async function fetchOmpModelSnapshot(
	client: CaretHostClient,
	session: Session,
	options: {
		readonly loginProviders?: readonly OmpLoginProvider[];
		readonly log?: (message: string) => void;
		/** A `get_available_models` answer the caller already has, so it is not asked twice. */
		readonly catalog?: Command;
	} = {},
): Promise<OmpModelSnapshot> {
	let models: OmpAdvertisedModel[] = [];
	let current: string | undefined;
	if (options.catalog) {
		models = normalizeOmpModels(options.catalog.result ?? options.catalog.ack);
	} else {
		try {
			models = await fetchOmpModels(client, session);
		} catch (error) {
			options.log?.(`Caret could not list OMP models: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	try {
		current = await fetchOmpCurrentModelId(client, session);
	} catch (error) {
		options.log?.(`Caret could not read the OMP model state: ${error instanceof Error ? error.message : String(error)}`);
	}
	let loginProviders = options.loginProviders;
	if (loginProviders === undefined) {
		try {
			const result = await client.sendCommand(session.id, getLoginProvidersRequest(session, randomUUID()));
			loginProviders = normalizeOmpLoginProviders(result.result ?? result.ack);
		} catch (error) {
			options.log?.(`Caret could not list OMP login providers: ${error instanceof Error ? error.message : String(error)}`);
			loginProviders = undefined;
		}
	}
	return projectOmpModelSnapshot(models, current, loginProviders);
}

/**
 * Change OMP's model via `set_model:{provider,modelId}`. The provider must come
 * from the advertised catalog (see `fetchOmpModels`); callers resolve it from
 * the snapshot rather than guessing.
 */
export async function setOmpModel(client: CaretHostClient, session: Session, provider: string, modelId: string): Promise<void> {
	if (!provider.trim() || !modelId.trim()) {
		throw new Error("Model provider and id are required; refresh the model list first.");
	}
	const result = await client.sendCommand(session.id, setOmpModelRequest(session, provider, modelId, randomUUID()));
	if (result.status === "failed") throw new Error(result.error ?? "OMP did not accept the model change.");
	if (result.status === "outcome_unknown" || result.status === "not_dispatched") {
		throw new Error(result.error ?? "Model change outcome is unknown; check status before retrying.");
	}
}

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
 * The catalog, read from a session that can actually answer it.
 *
 * OMP's catalog is global, but only a live OMP process holds it: a session the host has not
 * started answers `get_available_models` with `not_dispatched` ("Start or reconcile the OMP
 * session before sending commands" - the host's own guard), which is what left the picker
 * honestly-disabled in every window that had not sent a prompt yet. So a refused read starts
 * that session once and asks again. Starting mints a new incarnation, so the retry reads the
 * session `start` returned instead of the one that was refused.
 *
 * Bounded to one start, and it still degrades honestly: a start that fails, or a catalog OMP
 * genuinely does not advertise, leaves the empty snapshot the picker renders as disabled.
 */
async function snapshotWithOmpRuntime(
	client: CaretHostClient,
	session: Session,
	log: (message: string) => void,
): Promise<OmpModelSnapshot> {
	let catalog: Command | undefined;
	try {
		catalog = await client.sendCommand(session.id, getAvailableModelsRequest(session, randomUUID()));
	} catch (error) {
		// The host itself failed (down, unauthorized): starting a session cannot help.
		log(`Caret could not list OMP models: ${error instanceof Error ? error.message : String(error)}`);
		return { models: [], hasModels: false };
	}
	if (catalog.status !== "not_dispatched") {
		return fetchOmpModelSnapshot(client, session, { log, catalog });
	}
	try {
		const running = await client.startSession(session.id);
		return await fetchOmpModelSnapshot(client, running, { log });
	} catch (error) {
		log(`Caret could not start the OMP session to list models: ${error instanceof Error ? error.message : String(error)}`);
		return fetchOmpModelSnapshot(client, session, { log, catalog });
	}
}

/**
 * List the global OMP catalog through any available session purely as the
 * query envelope; the models are not attributed to that session. The catalog
 * itself is global to OMP. No sessions at all means honestly empty. Never
 * throws — callers stay honest-disabled on failure.
 */
export async function fetchGlobalOmpModelSnapshot(
	getClient: () => Promise<CaretHostClient>,
	log: (message: string) => void,
	token?: { readonly isCancellationRequested: boolean },
): Promise<OmpModelSnapshot> {
	try {
		const client = await getClient();
		const sessions = await client.listSessions();
		const probe = sessions.find(candidate => !candidate.archived) ?? sessions[0];
		if (probe && !(token?.isCancellationRequested ?? false)) {
			return await snapshotWithOmpRuntime(client, probe, log);
		}
	} catch (error) {
		log(`Caret could not list OMP models: ${error instanceof Error ? error.message : String(error)}`);
	}
	return { models: [], hasModels: false };
}

/**
 * Fetch the configured model roles through the same envelope the catalog uses.
 * Roles are global to OMP, so any session can answer; no sessions means honestly
 * empty. Never throws — the picker then shows no role labels rather than failing.
 */
export async function fetchOmpModelRoles(
	getClient: () => Promise<CaretHostClient>,
	log: (message: string) => void,
): Promise<OmpModelRoles> {
	try {
		const client = await getClient();
		const sessions = await client.listSessions();
		const probe = sessions.find(candidate => !candidate.archived) ?? sessions[0];
		if (!probe) return { cycleOrder: [], roles: [] };
		const session = probe.status === "running" ? probe : await client.startSession(probe.id);
		const result = await client.sendCommand(session.id, getModelRolesRequest(session, randomUUID()));
		if (result.status === "not_dispatched" || result.status === "failed") {
			return { cycleOrder: [], roles: [] };
		}
		return normalizeOmpModelRoles(result.result ?? result.ack);
	} catch (error) {
		log(`Caret could not read OMP model roles: ${error instanceof Error ? error.message : String(error)}`);
		return { cycleOrder: [], roles: [] };
	}
}

/**
 * Snapshot for an input-state fetch: the session's own catalog when a host
 * session is resolved, otherwise the global catalog via the probe helper
 * (draft and registration-time fetches).
 */
async function snapshotForInputState(
	getClient: () => Promise<CaretHostClient>,
	log: (message: string) => void,
	hostSession: Session | undefined,
	token: { readonly isCancellationRequested: boolean },
): Promise<OmpModelSnapshot> {
	if (!hostSession) {
		return fetchGlobalOmpModelSnapshot(getClient, log, token);
	}
	if (token.isCancellationRequested) {
		return { models: [], hasModels: false };
	}
	try {
		return await snapshotWithOmpRuntime(await getClient(), hostSession, log);
	} catch (error) {
		log(`Caret could not read OMP models: ${error instanceof Error ? error.message : String(error)}`);
		return { models: [], hasModels: false };
	}
}

/**
 * The registered provider plus the one thing callers need from it: a way to
 * re-read the host's sessions after Caret changes them itself.
 *
 * Archiving a project's chats happens in the extension, and the Agents sidebar
 * only moves a row between sections when the item collection is republished, so
 * the caller that archived has to be able to ask for that republish.
 */
export interface CaretChatSessionsRegistration extends vscode.Disposable {
	/** Re-read every session from the host and republish the item collection. */
	refresh(): void;
}

/**
 * Register Caret as this window's chat session provider and return a registration
 * that unregisters the participant, controller and content provider together.
 */
export function registerCaretChatSessions(options: ChatSessionsOptions): CaretChatSessionsRegistration {
	const { getClient, log } = options;
	// The sessions API is proposed and only exists in hosts that ship it (and in
	// the test doubles, not at all). Degrade to a no-op rather than failing the
	// whole activation, so the rest of the extension still works.
	const chat = vscode.chat as Partial<typeof vscode.chat> | undefined;
	if (!chat?.createChatParticipant || !chat.createChatSessionItemController || !chat.registerChatSessionContentProvider) {
		log("This host does not expose the chat sessions API; Caret sessions stay unavailable.");
		return {
			dispose() { /* nothing was registered */ },
			refresh() { /* nothing to republish */ },
		};
	}
	const disposables: vscode.Disposable[] = [];

	// The workbench needs a language model for every request it builds, including
	// the ones this provider owns (see omp-language-models.ts). Registered with
	// the sessions so the catalogue and the sessions that use it live and die
	// together.
	disposables.push(registerCaretLanguageModels({
		catalog: async token => (await fetchGlobalOmpModelSnapshot(getClient, log, token)).models,
		roles: () => fetchOmpModelRoles(getClient, log),
		log,
	}));

	// Caret's participant is this window's default agent (package.json
	// `isDefault`), so the base routes composer sends here: the workbench refuses
	// any send that has no default agent for its location, and Caret ships no
	// Copilot participant to be that default. This handler is the one live path a
	// submitted prompt takes and it delegates to the same `runTurn` the content
	// provider's own `requestHandler` uses, so a prompt has a single owner: the
	// host and its OMP journal.
	const participant = chat.createChatParticipant(CARET_CHAT_PARTICIPANT_ID, async (request, context, stream, token) => {
		const resource = context.chatSessionContext?.chatSessionItem.resource;
		const sessionId = resource ? sessionIdFromUri(resource) : undefined;
		if (!sessionId) {
			log(`Caret received a chat request outside one of its sessions${resource ? `: ${resource.toString()}` : "."}`);
			return;
		}
		log(`Caret participant turn for session ${sessionId}`);
		const client = await getClient();
		const hostSession = await client.getSession(sessionId);
		await runTurn(client, hostSession, request.prompt, stream, token, log);
	});
	disposables.push(participant);

	const applyItem = (item: vscode.ChatSessionItem, session: Session, projects: readonly { id: string; name: string }[] | undefined): void => {
		const shape = sessionItemShape(session, projects ? projects.find(project => project.id === session.projectId)?.name : undefined);
		item.label = shape.label;
		item.description = shape.description;
		item.status = chatSessionStatus(shape.state);
		item.timing = shape.timing;
		item.tooltip = session.cwd;
		// The sidebar keeps archived rows in its Done section, and only the item
		// says which rows those are: the host's own archived flag has to travel
		// with the item or an archived chat stays in its workspace group forever.
		item.archived = shape.archived;
		// The Agents window groups rows by workspace, so the session's own
		// working directory has to travel with the item; without it the row lands
		// in an "Unknown" group even though the host knows exactly where it runs.
		item.metadata = { workingDirectoryPath: session.cwd, repositoryPath: session.cwd };
	};

	// One listing path serves the window's first load, its refresh requests and
	// Caret's own project actions, so an archive started from Caret's menu reaches
	// the sidebar through exactly the code the first load used.
	const publishItems = async (token: vscode.CancellationToken): Promise<void> => {
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
	};

	const controller = chat.createChatSessionItemController(CARET_CHAT_SESSION_TYPE, publishItems);
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

	// The native model picker reads this input state. It lists exactly what OMP
	// advertised via `get_available_models` (plus the `get_state` current id for
	// the initial selection) and writes the user's choice back with `set_model`.
	// Empty catalogs stay empty: no fallback is invented, so the picker shows
	// its honest-disabled state downstream.
	controller.getChatSessionInputState = async (sessionResource, _context, token) => {
		let hostSession: Session | undefined;
		if (sessionResource) {
			try {
				const id = sessionIdFromUri({
					scheme: sessionResource.scheme,
					authority: sessionResource.authority,
					path: sessionResource.path,
				});
				if (id) {
					if (token.isCancellationRequested) return controller.createChatSessionInputState([]);
					hostSession = await (await getClient()).getSession(id);
				}
			} catch (error) {
				log(`Caret could not resolve the session for the model picker: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		const snapshot = await snapshotForInputState(getClient, log, hostSession, token);
		const group = modelPickerGroupFromSnapshot(snapshot);
		const inputState = controller.createChatSessionInputState([
			group as unknown as vscode.ChatSessionProviderOptionGroup,
		]);
		// Publish the catalog to the main-side type store (the input-state
		// result itself only carries selected values downstream). Replacing the
		// whole groups array is the API's update mechanism, so this pushes the
		// OMP catalog where native pickers and the bridge snapshot can list it.
		inputState.groups = [...inputState.groups];
		if (hostSession) {
			const watched = hostSession;
			let selectedId = snapshot.selectedModelId;
			let liveSnapshot = snapshot;
			inputState.onDidChange(() => {
				void (async () => {
					try {
						const picked = inputState.groups.find(candidate => candidate.id === CARET_OMP_MODELS_GROUP_ID)?.selected;
						// The outer `token` belongs to the getChatSessionInputState
						// fetch and is normally cancelled by the time the user
						// picks, so it must not gate the pick — dropping it here
						// was a ship-blocker (every pick returned early).
						if (!picked || picked.id === selectedId) return;
						// Re-read the catalog so a pick after a catalog change
						// resolves against live data instead of the captured
						// snapshot; on refresh failure fall back honestly.
						try {
							liveSnapshot = await fetchOmpModelSnapshot(await getClient(), watched, { log });
						} catch (error) {
							log(`Caret could not refresh OMP models before changing the model: ${error instanceof Error ? error.message : String(error)}`);
						}
						const description = (picked as { readonly description?: unknown }).description;
						const provider = resolveOmpModelPickProvider(liveSnapshot, picked.id, description)
							?? resolveOmpModelPickProvider(snapshot, picked.id, description);
						if (!provider) {
							log(`Caret cannot change the model: provider for '${picked.id}' is unknown. Refresh the model list first.`);
							return;
						}
						await setOmpModel(await getClient(), watched, provider, picked.id);
						selectedId = picked.id;
					} catch (error) {
						log(`Caret could not change the model: ${error instanceof Error ? error.message : String(error)}`);
					}
				})();
			});
		}
		return inputState;
	};

	const provider: vscode.ChatSessionContentProvider & {
		/**
		 * Workbench picker write-through. The native composer pick stays
		 * workbench-local, so the patched widget forwards it here as a session
		 * option change (patch 0014), and this resolves the id against the live
		 * catalog and writes it to the host with `set_model`. The base calls it
		 * dynamically (the public d.ts predates the method); failures only log.
		 */
		provideHandleOptionsChange?: (
			resource: vscode.Uri,
			updates: ReadonlyArray<{ readonly optionId: string; readonly value: string | undefined }>,
			token: vscode.CancellationToken,
		) => void;
	} = {
		// Provider-level catalog for the scheme-keyed option store. The base
		// refreshes this at content-provider registration (before any session
		// opens), so native pickers list OMP models instead of reporting
		// setup-required. Same probe rules as the draft input state.
		provideChatSessionProviderOptions: async token => {
			const snapshot = await fetchGlobalOmpModelSnapshot(getClient, log, token);
			// Model roles render on the language-model rows (`detail`), which is the
			// surface the picker actually draws: an option item's `description` is
			// tooltip-only, so annotating this group put the labels nowhere.
			const roles = await fetchOmpModelRoles(getClient, log);
			const group = modelPickerGroupFromSnapshot(snapshot);
			log(`Caret session option catalog: ${group.items.length} model(s) advertised by OMP, ${roles.roles.length} role(s) configured.`);
			return { optionGroups: [group as unknown as vscode.ChatSessionProviderOptionGroup] };
		},
		provideHandleOptionsChange: (resource, updates) => {
			void (async () => {
				try {
					const picked = updates.find(update => update.optionId === CARET_OMP_MODELS_GROUP_ID)?.value;
					if (!picked) return;
					// Picker identifiers carry the `caret-omp/` vendor prefix (the
					// workbench resolves the model by that string); the host wants the
					// bare OMP id.
					const modelId = ompModelIdFromPickId(picked);
					const id = sessionIdFromUri({ scheme: resource.scheme, authority: resource.authority, path: resource.path });
					if (!id) {
						log(`Caret cannot change the model: unrecognized session resource ${resource.scheme}://${resource.authority}${resource.path}.`);
						return;
					}
					const client = await getClient();
					const session = await client.getSession(id);
					const snapshot = await fetchOmpModelSnapshot(client, session, { log });
					const provider = resolveOmpModelPickProvider(snapshot, modelId, undefined);
					if (!provider) {
						log(`Caret cannot change the model: provider for '${modelId}' is unknown. Refresh the model list first.`);
						return;
					}
					await setOmpModel(client, session, provider, modelId);
				} catch (error) {
					log(`Caret could not change the model: ${error instanceof Error ? error.message : String(error)}`);
				}
			})();
		},
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
	// One source for every refresh Caret asks for itself; it is only cancelled when
	// the registration goes away.
	const selfRefresh = new vscode.CancellationTokenSource();
	disposables.push(selfRefresh);
	return {
		dispose: () => vscode.Disposable.from(...disposables).dispose(),
		refresh: () => void publishItems(selfRefresh.token),
	};
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
 *
 * S2 is text-only: `prompt` is a plain string (see `promptRequest`) and the
 * bridge forwards `query` only. Images, attachments and streamingBehavior are
 * accepted nowhere on this path yet; thread them through `promptRequest` and
 * the bridge `sendRequest` when that slice lands. No silent downgrade beyond
 * this note.
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
			await reportContextUsage(client, session, incarnation, stream, log);
			return;
		}
	}
}

/**
 * Report OMP's own context occupancy for the turn that just finished, so the
 * composer's context meter reads the real conversation size. OMP measures it
 * (`get_state.contextUsage`), Caret only relays it; a host that does not report
 * one leaves the meter hidden rather than showing an invented number.
 */
async function reportContextUsage(
	client: CaretHostClient,
	session: Session,
	incarnation: string,
	stream: vscode.ChatResponseStream,
	log: (message: string) => void,
): Promise<void> {
	const usage = stream.usage;
	if (typeof usage !== "function") {
		return;
	}
	try {
		const result = await client.sendCommand(session.id, getOmpStateRequest({ ...session, incarnation }, randomUUID()));
		const contextUsage = contextUsageFromOmpState(result.result ?? result.ack);
		if (!contextUsage) {
			return;
		}
		usage.call(stream, { promptTokens: contextUsage.tokens, completionTokens: 0 });
	} catch (error) {
		log(`Caret could not read OMP's context usage: ${error instanceof Error ? error.message : String(error)}`);
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
