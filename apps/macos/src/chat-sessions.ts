/*
 * Cedia's own chat sessions provider.
 *
 * The Agents window is the base sessions workbench; it renders whatever a
 * provider advertises through the proposed `chatSessionsProvider` API. Cedia is
 * that provider: this module projects the Cedia host's durable sessions and OMP
 * event journal into the native chat UI. It never launches OMP and never keeps
 * a second transcript — the host owns both, so everything here is a projection
 * of `apps/host` state read over `CediaHostClient`.
 */

import * as vscode from "vscode";
import { randomUUID } from "node:crypto";
import type { CediaHostClient } from "./api.ts";
import type { Command, EventPage, Session } from "../../../packages/protocol/src/index.ts";
import { applyEvent, createInitialTaskState, type TaskState, type TranscriptEntry, type UiPresentation } from "./state.ts";
import {
	abortRequest,
	attachedContextLabels,
	CEDIA_CHAT_PARTICIPANT_ID,
	CEDIA_CHAT_SESSION_SCHEME,
	CEDIA_CHAT_SESSION_TYPE,
	CEDIA_DRAFT_TITLE,
	CEDIA_OMP_MODELS_GROUP_ID,
	CEDIA_OMP_THINKING_GROUP_ID,
	thinkingPickerGroupFromParams,
	thinkingPickerGroupForModel,
	selectedThinkingLevelFromInputState,
	setThinkingLevelRequest,
	contextUsageFromOmpState,
	currentModelFromOmpState,
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
	ompModelPickId,
	ompModelRows,
	projectOmpModelSnapshot,
	promptImagesFromReferences,
	promptRequest,
	promptWithAttachedContext,
	resolveOmpModelPickProvider,
	ompModelForPickedLanguageModel,
	ompModelPickProviders,
	ompModelRowForPick,
	entryFailureText,
	isCediaDraftUri,
	selectedModelIdFromInputState,
	sessionIdFromUri,
	sessionItemShape,
	sessionUriString,
	setOmpModelRequest,
	toolCardFromEntry,
	turnPlansFromTranscript,
	uiAnswerValue,
	uiCarouselQuestionId,
	uiQuestionFromRequest,
	type CediaPromptReference,
	type OmpAdvertisedModel,
	type OmpCurrentModel,
	type OmpLoginProvider,
	type OmpModelRoles,
	type OmpModelSnapshot,
	type SessionState,
} from "./chat-sessions-map.ts";
import { registerCediaLanguageModels } from "./omp-language-models.ts";
import { emptyThinkingParams, ompCommandData, thinkingFromOmpState, type ThinkingParams } from "./thinking-params.ts";

export { CEDIA_CHAT_PARTICIPANT_ID, CEDIA_CHAT_SESSION_SCHEME, CEDIA_CHAT_SESSION_TYPE } from "./chat-sessions-map.ts";
export type { OmpAdvertisedModel, OmpLoginProvider, OmpModelSnapshot };


/**
 * List OMP's advertised models through the existing host command envelope
 * (`get_available_models:{}` -> ack/result `.models`). No new host route;
 * failures propagate so callers can degrade honestly to an empty catalog.
 */
export async function fetchOmpModels(client: CediaHostClient, session: Session): Promise<OmpAdvertisedModel[]> {
	const result = await client.sendCommand(session.id, getAvailableModelsRequest(session, randomUUID()));
	return normalizeOmpModels(result.result ?? result.ack);
}

/**
 * Read OMP's current model via `get_state`, id and provider together (undefined when unadvertised).
 *
 * The provider travels with the id because the catalogue can carry one id from several providers,
 * and the row - not the id - is what names a model's reasoning ladder.
 */
export async function fetchOmpCurrentModel(client: CediaHostClient, session: Session): Promise<OmpCurrentModel | undefined> {
	const result = await client.sendCommand(session.id, getOmpStateRequest(session, randomUUID()));
	return currentModelFromOmpState(result.result ?? result.ack);
}

/** Read OMP's current model id via `get_state` (undefined when unadvertised). */
export async function fetchOmpCurrentModelId(client: CediaHostClient, session: Session): Promise<string | undefined> {
	return (await fetchOmpCurrentModel(client, session))?.id;
}

/**
 * Read the thinking levels OMP advertises for the session's current model.
 *
 * The answer is per model, so this is re-read whenever the composer asks for the session's state:
 * switching models changes the levels the chip may offer, and a model that advertises none yields
 * an empty projection (no control) rather than an invented ladder. Never throws.
 */
export async function fetchOmpThinking(client: CediaHostClient, session: Session, log: (message: string) => void): Promise<ThinkingParams> {
	try {
		const result = await client.sendCommand(session.id, getOmpStateRequest(session, randomUUID()));
		return thinkingFromOmpState(ompCommandData(result));
	} catch (error) {
		log(`Cedia could not read OMP thinking levels: ${error instanceof Error ? error.message : String(error)}`);
		return emptyThinkingParams();
	}
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
	client: CediaHostClient,
	session: Session,
	options: {
		readonly loginProviders?: readonly OmpLoginProvider[];
		readonly log?: (message: string) => void;
		/** A `get_available_models` answer the caller already has, so it is not asked twice. */
		readonly catalog?: Command;
	} = {},
): Promise<OmpModelSnapshot> {
	let models: OmpAdvertisedModel[] = [];
	let current: OmpCurrentModel | undefined;
	if (options.catalog) {
		models = normalizeOmpModels(options.catalog.result ?? options.catalog.ack);
	} else {
		try {
			models = await fetchOmpModels(client, session);
		} catch (error) {
			options.log?.(`Cedia could not list OMP models: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	try {
		current = await fetchOmpCurrentModel(client, session);
	} catch (error) {
		options.log?.(`Cedia could not read the OMP model state: ${error instanceof Error ? error.message : String(error)}`);
	}
	let loginProviders = options.loginProviders;
	if (loginProviders === undefined) {
		try {
			const result = await client.sendCommand(session.id, getLoginProvidersRequest(session, randomUUID()));
			loginProviders = normalizeOmpLoginProviders(result.result ?? result.ack);
		} catch (error) {
			options.log?.(`Cedia could not list OMP login providers: ${error instanceof Error ? error.message : String(error)}`);
			loginProviders = undefined;
		}
	}
	const snapshot = projectOmpModelSnapshot(models, current?.id, loginProviders, current?.provider);
	// The level OMP reports for that model arrives in the same `get_state` answer. It is kept only
	// beside a selected model, and the composer's chip drops it again if the row's own ladder does
	// not contain it (`thinkingPickerGroupForModel`), so it can never be shown against a model that
	// does not accept it.
	if (snapshot.selectedModelId && current?.thinkingLevel) {
		return { ...snapshot, selectedThinkingLevel: current.thinkingLevel };
	}
	return snapshot;
}

/**
 * Change OMP's model via `set_model:{provider,modelId}`. The provider must come
 * from the advertised catalog (see `fetchOmpModels`); callers resolve it from
 * the snapshot rather than guessing.
 */
export async function setOmpModel(client: CediaHostClient, session: Session, provider: string, modelId: string): Promise<void> {
	if (!provider.trim() || !modelId.trim()) {
		throw new Error("Model provider and id are required; refresh the model list first.");
	}
	const result = await client.sendCommand(session.id, setOmpModelRequest(session, provider, modelId, randomUUID()));
	if (result.status === "failed") throw new Error(result.error ?? "OMP did not accept the model change.");
	if (result.status === "outcome_unknown" || result.status === "not_dispatched") {
		throw new Error(result.error ?? "Model change outcome is unknown; check status before retrying.");
	}
}

/**
 * Apply the composer's model pick to the session it just created.
 *
 * The pick is a property of the composer — a draft has no host session to write `set_model` to — so
 * it arrives with the creation request and is applied here, the moment the session exists. A pick
 * the host's catalogue no longer advertises (a remembered one, or an id from an older catalogue) is
 * reported and skipped: OMP keeps running the model it already resolved instead of being handed a
 * name it cannot find, which is the honest outcome for a stale choice.
 */
export async function applyDraftModelChoice(
	client: CediaHostClient,
	session: Session,
	inputState: unknown,
	log: (message: string) => void,
): Promise<void> {
	const picked = selectedModelIdFromInputState(inputState);
	if (!picked) return;
	let snapshot: OmpModelSnapshot;
	try {
		snapshot = await fetchOmpModelSnapshot(client, session, { log });
	} catch (error) {
		log(`Cedia could not read OMP models before applying the picked model: ${error instanceof Error ? error.message : String(error)}`);
		return;
	}
	const provider = resolveOmpModelPickProvider(snapshot, picked, undefined);
	if (!provider) {
		log(`Cedia kept the host's current model: the picked model '${picked}' is not in OMP's catalogue.`);
		return;
	}
	try {
		// Send the catalogue's own spelling of the model. For an ordinary pick that is the id the
		// user chose; when the pick arrived in `get_state`'s bare form it is the provider-qualified
		// row `set_model` resolves, so the model the composer showed is the model that runs.
		const modelId = ompModelRowForPick(snapshot, picked)?.id ?? picked;
		await setOmpModel(client, session, provider, modelId);
	} catch (error) {
		log(`Cedia could not apply the picked model '${picked}': ${error instanceof Error ? error.message : String(error)}`);
	}
}

/**
 * Apply a draft's reasoning pick, the way {@link applyDraftModelChoice} applies its model pick.
 *
 * The composer's reasoning chip writes through the session option store, and a draft has no host
 * session for that write to land on, so the choice is read back here at session creation and sent as
 * `set_thinking_level` — after the model has been applied, because the ladder belongs to the model.
 * A level the picked model does not advertise is reported and skipped: OMP would refuse it, and
 * quietly running something else is the dishonest outcome.
 */
export async function applyDraftThinkingChoice(
	client: CediaHostClient,
	session: Session,
	inputState: unknown,
	log: (message: string) => void,
): Promise<void> {
	const level = selectedThinkingLevelFromInputState(inputState);
	if (!level) return;
	let snapshot: OmpModelSnapshot;
	try {
		snapshot = await fetchOmpModelSnapshot(client, session, { log });
	} catch (error) {
		log(`Cedia could not read OMP models before applying the picked reasoning level: ${error instanceof Error ? error.message : String(error)}`);
		return;
	}
	// The ladder belongs to the model the draft picked, which is the one `applyDraftModelChoice` has
	// just written to the host — not necessarily the one the probe session was running.
	const pickedModel = selectedModelIdFromInputState(inputState) ?? snapshot.selectedModelId ?? "";
	const row = ompModelRowForPick(snapshot, pickedModel);
	const ladder = row?.thinking?.efforts ?? [];
	if (!ladder.includes(level)) {
		log(`Cedia kept OMP's own reasoning level: '${level}' is not one of the levels this model advertises.`);
		return;
	}
	try {
		await client.sendCommand(session.id, setThinkingLevelRequest(session, level, randomUUID()));
	} catch (error) {
		log(`Cedia could not apply the picked reasoning level '${level}': ${error instanceof Error ? error.message : String(error)}`);
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
	 * Resolves the live host connection. Cedia has exactly one connection owner
	 * (the task view provider), so this is an accessor rather than a client: it
	 * must reuse that owner's reconnect logic and never open a second client.
	 */
	readonly getClient: () => Promise<CediaHostClient>;
	/** Receives short explanations of degraded paths (host down, session missing). */
	readonly log: (message: string) => void;
}

/** Reduce every event page the host holds for a session and report the newest cursor. */
export async function readSessionState(client: CediaHostClient, sessionId: string, pageSize = 500): Promise<{ state: TaskState; cursor: number }> {
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
 * A send can also lose a race with a host refresh and fail on a stale incarnation
 * ("Refresh the task before submitting this command"), so a failed first send re-reads the session
 * once and retries with the incarnation the host now holds — one retry, never more.
 *
 * Bounded to one start and one retry, and it still degrades honestly: a retry that fails, a start
 * that fails, or a catalog OMP genuinely does not advertise, leaves the empty snapshot the picker
 * renders as disabled.
 */
async function snapshotWithOmpRuntime(
	client: CediaHostClient,
	session: Session,
	log: (message: string) => void,
): Promise<OmpModelSnapshot> {
	let current = session;
	for (let attempt = 0; attempt < 2; attempt++) {
		let catalog: Command;
		try {
			catalog = await client.sendCommand(current.id, getAvailableModelsRequest(current, randomUUID()));
		} catch (error) {
			const failure = error instanceof Error ? error.message : String(error);
			if (attempt > 0) {
				log(`Cedia could not list OMP models: ${failure}`);
				return { models: [], hasModels: false };
			}
			try {
				const refreshed = await client.getSession(current.id);
				log(`Cedia is retrying the OMP model list with session '${refreshed.id}' incarnation '${refreshed.incarnation}' (was '${current.incarnation}').`);
				current = refreshed;
			} catch (refreshError) {
				log(`Cedia could not re-read the session before retrying the OMP model list: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}`);
			}
			continue;
		}
		if (catalog.status !== "not_dispatched") {
			return fetchOmpModelSnapshot(client, current, { log, catalog });
		}
		try {
			const running = await client.startSession(current.id);
			return await fetchOmpModelSnapshot(client, running, { log });
		} catch (error) {
			log(`Cedia could not start the OMP session to list models: ${error instanceof Error ? error.message : String(error)}`);
			return fetchOmpModelSnapshot(client, current, { log, catalog });
		}
	}
	return { models: [], hasModels: false };
}

/**
 * List the global OMP catalog through any available session purely as the
 * query envelope; the models are not attributed to that session. The catalog
 * itself is global to OMP. No sessions at all means honestly empty. Never
 * throws — callers stay honest-disabled on failure.
 */
export async function fetchGlobalOmpModelSnapshot(
	getClient: () => Promise<CediaHostClient>,
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
		log(`Cedia could not list OMP models: ${error instanceof Error ? error.message : String(error)}`);
	}
	return { models: [], hasModels: false };
}

/**
 * Fetch the configured model roles through the same envelope the catalog uses.
 * Roles are global to OMP, so any session can answer; no sessions means honestly
 * empty. Never throws — the picker then shows no role labels rather than failing.
 */
export async function fetchOmpModelRoles(
	getClient: () => Promise<CediaHostClient>,
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
		log(`Cedia could not read OMP model roles: ${error instanceof Error ? error.message : String(error)}`);
		return { cycleOrder: [], roles: [] };
	}
}

/**
 * Snapshot for an input-state fetch: the session's own catalog when a host
 * session is resolved, otherwise the global catalog via the probe helper
 * (draft and registration-time fetches).
 */
async function snapshotForInputState(
	getClient: () => Promise<CediaHostClient>,
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
		log(`Cedia could not read OMP models: ${error instanceof Error ? error.message : String(error)}`);
		return { models: [], hasModels: false };
	}
}

/**
 * The registered provider plus the one thing callers need from it: a way to
 * re-read the host's sessions after Cedia changes them itself.
 *
 * Archiving a project's chats happens in the extension, and the Agents sidebar
 * only moves a row between sections when the item collection is republished, so
 * the caller that archived has to be able to ask for that republish.
 */
export interface CediaChatSessionsRegistration extends vscode.Disposable {
	/** Re-read every session from the host and republish the item collection. */
	refresh(): void;
}

/**
 * Register Cedia as this window's chat session provider and return a registration
 * that unregisters the participant, controller and content provider together.
 */
export function registerCediaChatSessions(options: ChatSessionsOptions): CediaChatSessionsRegistration {
	const { getClient, log } = options;
	// The sessions API is proposed and only exists in hosts that ship it (and in
	// the test doubles, not at all). Degrade to a no-op rather than failing the
	// whole activation, so the rest of the extension still works.
	const chat = vscode.chat as Partial<typeof vscode.chat> | undefined;
	if (!chat?.createChatParticipant || !chat.createChatSessionItemController || !chat.registerChatSessionContentProvider) {
		log("This host does not expose the chat sessions API; Cedia sessions stay unavailable.");
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
	disposables.push(registerCediaLanguageModels({
		catalog: async token => (await fetchGlobalOmpModelSnapshot(getClient, log, token)).models,
		roles: () => fetchOmpModelRoles(getClient, log),
		log,
	}));

	// Cedia's participant is this window's default agent (package.json
	// `isDefault`), so the base routes composer sends here: the workbench refuses
	// any send that has no default agent for its location, and Cedia ships no
	// Copilot participant to be that default. This handler is the one live path a
	// submitted prompt takes and it delegates to the same `runTurn` the content
	// provider's own `requestHandler` uses, so a prompt has a single owner: the
	// host and its OMP journal.
	const participant = chat.createChatParticipant(CEDIA_CHAT_PARTICIPANT_ID, async (request, context, stream, token) => {
		const resource = context.chatSessionContext?.chatSessionItem.resource;
		const sessionId = resource ? sessionIdFromUri(resource) : undefined;
		if (!sessionId) {
			log(`Cedia received a chat request outside one of its sessions${resource ? `: ${resource.toString()}` : "."}`);
			return;
		}
		log(`Cedia participant turn for session ${sessionId}`);
		const client = await getClient();
		const hostSession = await client.getSession(sessionId);
		// The composer's model pill is the workbench's own picker, so the pick only runs if it is
		// written to the host here; this handler is the path a submitted prompt actually takes.
		await applyRequestedModel(client, hostSession, request.model, stream, log);
		await runTurn(client, hostSession, request.prompt, stream, token, log, request.references);
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
	// Cedia's own project actions, so an archive started from Cedia's menu reaches
	// the sidebar through exactly the code the first load used.
	const publishItems = async (token: vscode.CancellationToken): Promise<void> => {
		try {
			const client = await getClient();
			const [projects, sessions] = await Promise.all([client.listProjects(), client.listSessions()]);
			if (token.isCancellationRequested) return;
			log(`Cedia chat sessions: ${sessions.length} session(s) in ${projects.length} project(s) from the host.`);
			controller.items.replace(sessions.map(session => {
				const item = controller.createChatSessionItem(vscode.Uri.parse(sessionUriString(session.id)), session.title);
				applyItem(item, session, projects);
				return item;
			}));
		} catch (error) {
			log(`Cedia host sessions are unavailable: ${error instanceof Error ? error.message : String(error)}`);
			controller.items.replace([]);
		}
	};

	const controller = chat.createChatSessionItemController(CEDIA_CHAT_SESSION_TYPE, publishItems);
	disposables.push(controller);

	controller.newChatSessionItemHandler = async (context, token) => {
		const client = await getClient();
		const projects = await client.listProjects();
		if (token.isCancellationRequested) throw new vscode.CancellationError();
		const project = projects.find(candidate => !candidate.archived) ?? projects[0];
		if (!project) throw new Error("Cedia needs a project before it can start a session. Add a folder to the Cedia host first.");
		const title = context.request.prompt.trim().slice(0, 80) || CEDIA_DRAFT_TITLE;
		const session = await client.createSession({ projectId: project.id, title });
		// The pick was made in the composer, which had no host session to write `set_model` to, so
		// this is where it takes effect — the same way the reference's model choice belongs to the
		// composer that becomes the conversation rather than to a session created somewhere else.
		await applyDraftModelChoice(client, session, context.inputState, log);
		// The reasoning chip's pick has the same shape as the model pick, and it is applied second
		// because the ladder it must be checked against belongs to the model just chosen.
		await applyDraftThinkingChoice(client, session, context.inputState, log);
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
	controller.getChatSessionInputState = async (sessionResource, context, token) => {
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
				log(`Cedia could not resolve the session for the model picker: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		const snapshot = await snapshotForInputState(getClient, log, hostSession, token);
		const group = modelPickerGroupFromSnapshot(snapshot);
		// Carry the composer's own pick onto the catalogue we hand back. The workbench keeps the
		// user's choice as a session option and returns it here as `previousInputState` — including
		// when it asks for the state again at session creation, which is the only moment a draft's
		// pick can be read (`applyDraftModelChoice`). A pick the catalogue no longer lists stays
		// unanswered rather than echoed: the host's model is what would really run. The group says
		// so through its description (the picker renders it as the tooltip) instead of inventing a row.
		const carriedId = selectedModelIdFromInputState(context?.previousInputState);
		// Read-alias: the pick may have been stored before the rows carried OMP's selector (a bare
		// model id), and OMP answers one model in both spellings. Resolving through the catalogue
		// carries it forward under the spelling the picker now uses, and refuses an id that two
		// providers still advertise.
		const carriedRow = carriedId ? ompModelRowForPick(snapshot, carriedId) : undefined;
		const carriedItem = carriedRow ? group.items.find(item => item.id === (carriedRow.id ?? carriedId)) : undefined;
		let selectedGroup: typeof group = group;
		if (carriedItem) {
			selectedGroup = { ...group, selected: carriedItem };
		} else if (carriedId) {
			const notice = `Remembered model '${carriedId}' is no longer advertised by OMP; showing the host's current model.`;
			log(`Cedia is not carrying the remembered model '${carriedId}': OMP's catalogue no longer advertises it.`);
			selectedGroup = { ...group, description: group.description ? `${group.description} ${notice}` : notice };
		}
		const inputState = controller.createChatSessionInputState([
			selectedGroup as unknown as vscode.ChatSessionProviderOptionGroup,
		]);
		// The reasoning chip is a second group, and it is per model. Its ladder comes from the
		// catalogue row the picked model owns — the only place OMP advertises one (`thinking.efforts`;
		// `get_state` reports the current `thinkingLevel` and no ladder) — and, for a session, OMP's
		// own answer names the level it is running. That is what makes the chip follow a model change
		// instead of offering one model's ladder to another, and it is also why a draft can show the
		// chip at all: the catalogue needs no session, so the first turn can be sent with a level
		// chosen before any host session existed. Nothing is published when the model advertises none.
		const selectedModelRow = carriedRow ?? ompModelRowForPick(snapshot, snapshot.selectedModelId ?? "");
		if (selectedModelRow?.thinking) {
			const current = hostSession ? (await fetchOmpThinking(await getClient(), hostSession, log)).current : undefined;
			const thinkingGroup = thinkingPickerGroupForModel(selectedModelRow, current);
			if (thinkingGroup) {
				inputState.groups = [...inputState.groups, thinkingGroup as unknown as vscode.ChatSessionProviderOptionGroup];
			}
		}
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
						const picked = inputState.groups.find(candidate => candidate.id === CEDIA_OMP_MODELS_GROUP_ID)?.selected;
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
							log(`Cedia could not refresh OMP models before changing the model: ${error instanceof Error ? error.message : String(error)}`);
						}
						const description = (picked as { readonly description?: unknown }).description;
						const provider = resolveOmpModelPickProvider(liveSnapshot, picked.id, description)
							?? resolveOmpModelPickProvider(snapshot, picked.id, description);
						if (!provider) {
							log(`Cedia cannot change the model: provider for '${picked.id}' is unknown. Refresh the model list first.`);
							return;
						}
						// The option's id is OMP's selector (`provider/model`); `set_model` wants the model
						// id that provider answers to, which is the catalogue row's own id.
						const rowId = ompModelRowForPick(liveSnapshot, picked.id)?.id
							?? ompModelRowForPick(snapshot, picked.id)?.id
							?? picked.id;
						await setOmpModel(await getClient(), watched, provider, rowId);
						selectedId = picked.id;
					} catch (error) {
						log(`Cedia could not change the model: ${error instanceof Error ? error.message : String(error)}`);
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
			log(`Cedia session option catalog: ${group.items.length} model(s) advertised by OMP, ${roles.roles.length} role(s) configured.`);
			// A draft never asks for per-session input state, so this provider-level catalog is the only
			// place its reasoning chip can come from. The ladder belongs to the model the catalogue
			// names as current (what a first turn would run); a session's own state carries the ladder
			// for the model it is actually running, with OMP's current level. The provider from the same
			// `get_state` answer is what resolves an id OMP advertises from more than one provider, so a
			// current model like `deepseek/deepseek-v4.1-flash` (openrouter and commandcode both carry
			// it) still names its row and its ladder instead of dropping out as ambiguous.
			const groups: vscode.ChatSessionProviderOptionGroup[] = [group as unknown as vscode.ChatSessionProviderOptionGroup];
			const currentRow = snapshot.selectedModelId
				? ompModelRowForPick(snapshot, snapshot.selectedModelId, snapshot.selectedModelProvider)
				: undefined;
			const draftThinking = currentRow ? thinkingPickerGroupForModel(currentRow, snapshot.selectedThinkingLevel) : undefined;
			if (draftThinking) {
				// The ladder belongs to one model, and the composer draws the control beside the model
				// it is showing. The group therefore names its model the way this window names models
				// (`<vendor>/<catalogue row id>`, the identifier `omp-language-models.ts` registers), so
				// the composer can refuse to offer one model's levels for another.
				const pickerRow = ompModelRows(snapshot.models).find(candidate =>
					candidate.model === currentRow || (candidate.model.id === currentRow?.id && candidate.model.provider === currentRow?.provider));
				groups.push({
					...draftThinking,
					...(pickerRow ? { detail: ompModelPickId(pickerRow.id) } : {}),
				} as unknown as vscode.ChatSessionProviderOptionGroup);
			}
			log(`Cedia session option catalog: reasoning for ${currentRow ? `'${currentRow.provider ?? '?'}:${currentRow.id}'` : `no row (current model '${snapshot.selectedModelId ?? ''}')`} -> ${draftThinking ? draftThinking.items.map(item => item.id).join('/') : 'none'}.`);
			return { optionGroups: groups };
		},
		provideHandleOptionsChange: (resource, updates) => {
			// Every option the composer writes through ends up here, and this line is the only place
			// that shows *which* resource carried it - the measurement that a Cedia draft's pick never
			// arrives (only a started session's does) rests on it.
			log(`Cedia session option change: ${resource.scheme}://${resource.authority}${resource.path} ${updates.map(update => `${update.optionId}=${update.value === undefined ? 'undefined' : String(update.value).slice(0, 60)}`).join(', ')}`);
			void (async () => {
				try {
					const level = updates.find(update => update.optionId === CEDIA_OMP_THINKING_GROUP_ID)?.value;
					if (level) {
						const sessionId = sessionIdFromUri({ scheme: resource.scheme, authority: resource.authority, path: resource.path });
						if (!sessionId) return; // A draft has no host session to write a level to.
						const client = await getClient();
						const session = await client.getSession(sessionId);
						const thinking = await fetchOmpThinking(client, session, log);
						if (!thinking.options.some(option => option.id === level && option.enabled)) {
							log(`Cedia did not change the thinking level: OMP does not advertise '${level}' for this model.`);
							return;
						}
						const result = await client.sendCommand(session.id, setThinkingLevelRequest(session, level, randomUUID()));
						if (result.status !== "completed") {
							log(`Cedia could not change the thinking level: ${result.error ?? "OMP did not confirm it."}`);
						}
						return;
					}
					const picked = updates.find(update => update.optionId === CEDIA_OMP_MODELS_GROUP_ID)?.value;
					if (!picked) return;
					// Picker identifiers carry the `cedia-omp/` vendor prefix (the
					// workbench resolves the model by that string); the host wants the
					// bare OMP id.
					const modelId = ompModelIdFromPickId(picked);
					const id = sessionIdFromUri({ scheme: resource.scheme, authority: resource.authority, path: resource.path });
					if (!id) {
						// A draft has no host session to write `set_model` to. Its pick is not dropped:
						// it is applied when the first prompt creates the session, through
						// `applyDraftModelChoice`. Anything else here is a resource Cedia does not own.
						if (isCediaDraftUri(resource)) return;
						log(`Cedia cannot change the model: unrecognized session resource ${resource.scheme}://${resource.authority}${resource.path}.`);
						return;
					}
					const client = await getClient();
					const session = await client.getSession(id);
					const snapshot = await fetchOmpModelSnapshot(client, session, { log });
					const provider = resolveOmpModelPickProvider(snapshot, modelId, undefined);
					if (!provider) {
						log(`Cedia cannot change the model: provider for '${modelId}' is unknown. Refresh the model list first.`);
						return;
					}
					// `set_model` takes the provider separately from the model, and the catalogue row is
					// what carries the model id that provider answers to: the pick's own spelling is OMP's
					// selector (`provider/model`), which is not the model id.
					await setOmpModel(client, session, provider, ompModelRowForPick(snapshot, modelId)?.id ?? modelId);
				} catch (error) {
					log(`Cedia could not change the model: ${error instanceof Error ? error.message : String(error)}`);
				}
			})();
		},
		async provideChatSessionContent(resource, token) {
			// A draft has no host session yet, so it has no id to read and no transcript to
			// project. The workbench normally synthesizes this empty session itself from the
			// controller's input state; answering it here keeps the draft resolvable when that
			// is not possible (an empty OMP catalog leaves no option groups to synthesize from).
			// `requestHandler` stays undefined for a draft: the first Send is what creates the
			// session, through `newChatSessionItemHandler` below.
			if (isCediaDraftUri(resource)) {
				return { title: CEDIA_DRAFT_TITLE, history: [], requestHandler: undefined };
			}
			const sessionId = sessionIdFromUri(resource);
			if (!sessionId) throw new Error("Cedia received a chat session resource it does not own.");
			const client = await getClient();
			const session = await client.getSession(sessionId);
			if (token.isCancellationRequested) throw new vscode.CancellationError();
			const { state } = await readSessionState(client, sessionId);
			return {
				title: session.title,
				history: historyFromState(state, participant.id),
				requestHandler: async (request, _context, stream, requestToken) => {
					await applyRequestedModel(client, session, request.model, stream, log);
					await runTurn(client, session, request.prompt, stream, requestToken, log, request.references);
				},
			};
		},
	};

	disposables.push(chat.registerChatSessionContentProvider(CEDIA_CHAT_SESSION_SCHEME, provider, participant, { supportsInterruptions: true }));
	// Cedia's drafts are keyed by the session *type*, not the item scheme: the workbench builds
	// them with `getNewChatSessionResource(sessionType)`, so a draft arrives as
	// `cedia.omp:/untitled-<uuid>`. The workbench resolves a resource by its scheme
	// (`ChatSessionsService.canResolveChatSession` gates on the content-provider map), so without
	// this second key the draft has no provider: its model never loads and the first Send fails
	// with `Unknown session: cedia.omp:/untitled-...` before it can reach the handler above.
	disposables.push(chat.registerChatSessionContentProvider(CEDIA_CHAT_SESSION_TYPE, provider, participant, { supportsInterruptions: true }));
	// One source for every refresh Cedia asks for itself; it is only cancelled when
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
		const parts: Array<vscode.ChatResponseMarkdownPart | vscode.ChatToolInvocationPart> = [];
		if (plan.text) parts.push(new vscode.ChatResponseMarkdownPart(plan.text));
		for (const tool of plan.toolEntries ?? []) {
			const card = toolCardFromEntry(tool.entry);
			if (!card) continue;
			const part = new vscode.ChatToolInvocationPart(card.toolName, tool.id);
			part.isComplete = true;
			part.pastTenseMessage = card.past;
			part.isError = card.isError;
			part.toolSpecificData = { input: card.input, output: card.output };
			parts.push(part);
		}
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
 * Composer attachments travel with the prompt: image references are read into
 * OMP's `images` and every other reference's label is appended to the message
 * text, so a non-image attachment is at least named instead of silently
 * dropped. `streamingBehavior` remains unthreaded.
 */
/**
 * Makes the composer's picked language model the model this turn runs, or says why it cannot.
 *
 * The workbench picks from every model provider the user has installed, so the pick can name
 * something OMP does not run (the user's own Cursor/opencode-go/openrouter rows). Writing the pick
 * to the host is the only thing that makes the composer honest; when OMP has no such model the
 * transcript says so before the turn instead of letting the user believe a model ran that did not.
 */
async function applyRequestedModel(
	client: CediaHostClient,
	session: Session,
	model: { readonly id?: unknown; readonly vendor?: unknown; readonly name?: unknown } | undefined,
	stream: vscode.ChatResponseStream,
	log: (message: string) => void,
): Promise<void> {
	const requestedId = typeof model?.id === "string" ? model.id.trim() : "";
	if (!requestedId) return;
	let snapshot: OmpModelSnapshot;
	try {
		snapshot = await fetchOmpModelSnapshot(client, session, { log });
	} catch (error) {
		log(`Cedia could not read OMP models before applying the composer's model: ${error instanceof Error ? error.message : String(error)}`);
		return;
	}
	const resolved = ompModelForPickedLanguageModel(snapshot, { id: requestedId, vendor: model?.vendor });
	if (!resolved) {
		// An unreadable catalogue is not evidence that OMP lacks the model, so it must not be
		// reported as one; the turn then runs whatever the host already had.
		if (!snapshot.hasModels) {
			log(`Cedia could not read OMP's catalogue before applying the composer's model '${requestedId}'; this turn runs the host's current model.`);
			return;
		}
		const current = snapshot.selectedModelId ?? "OMP's current model";
		// Two providers can advertise the same model id (measured live 2026-09-18:
		// `deepseek/deepseek-v4.1-flash` is on both `openrouter`, which this machine has no
		// credentials for, and `commandcode`, which it has). A name like that is not enough to say
		// which provider runs the turn, so the pick is refused with the choice spelled out rather
		// than resolved to whichever row the catalogue happens to list first.
		const providers = ompModelPickProviders(snapshot, requestedId);
		if (providers.length > 1) {
			stream.markdown(`**Cedia runs this turn with OMP.** More than one provider advertises \`${requestedId}\` (${providers.join(", ")}), so Cedia cannot tell which one you meant; pick the row for the provider you have configured. This turn uses ${current}.`);
			log(`Cedia did not apply the composer's model '${requestedId}': ${providers.join(" and ")} both advertise it.`);
			return;
		}
		stream.markdown(`**Cedia runs this turn with OMP.** \`${requestedId}\` is not a model OMP runs, so the turn uses ${current}. Pick a model from OMP's own list to change it.`);
		log(`Cedia did not apply the composer's model '${requestedId}': it is not in OMP's catalogue.`);
		return;
	}
	if (snapshot.selectedModelId === resolved.modelId) return;
	try {
		await setOmpModel(client, session, resolved.provider, resolved.modelId);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		stream.markdown(`**Cedia could not switch this turn to \`${resolved.modelId}\`.** ${message}`);
		log(`Cedia could not apply the composer's model '${requestedId}': ${message}`);
	}
}

export async function runTurn(
	client: CediaHostClient,
	session: Session,
	prompt: string,
	stream: vscode.ChatResponseStream,
	token: vscode.CancellationToken,
	log: (message: string) => void,
	references?: readonly CediaPromptReference[],
): Promise<void> {
	let state = createInitialTaskState({ project: null, session });
	let cursor = 0;
	try {
		const start = await readSessionState(client, session.id);
		state = start.state;
		cursor = start.cursor;
	} catch (error) {
		log(`Cedia could not read the existing transcript: ${error instanceof Error ? error.message : String(error)}`);
	}

	const images = await promptImagesFromReferences(references);
	const message = promptWithAttachedContext(prompt, attachedContextLabels(references));

	let incarnation = session.incarnation;
	try {
		const running = await client.startSession(session.id);
		incarnation = running.incarnation;
		await client.sendCommand(session.id, promptRequest({ ...session, incarnation }, message, randomUUID(), images));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		stream.markdown(`Cedia could not start this task: ${message}`);
		throw error;
	}

	const sent = new Map<string, TranscriptEntry>();
	for (const existing of state.transcript) sent.set(existing.id, existing);
	const presented = new Set<string>();
	const presentedPresentations = new Set<string>();
	for (const existing of state.presentations) presentedPresentations.add(existing.id);

	let idlePolls = 0;
	for (;;) {
		if (token.isCancellationRequested) {
			try {
				await client.sendCommand(session.id, abortRequest({ ...session, incarnation }, randomUUID()));
			} catch (error) {
				log(`Cedia could not stop the task: ${error instanceof Error ? error.message : String(error)}`);
			}
			return;
		}
		await new Promise(resolve => setTimeout(resolve, STREAM_POLL_INTERVAL_MS));

		let page: EventPage;
		try {
			page = await client.getEvents(session.id, cursor, 200);
		} catch (error) {
			log(`Cedia lost the event stream: ${error instanceof Error ? error.message : String(error)}`);
			return;
		}
		for (const event of page.events) state = applyEvent(state, event);
		cursor = page.cursor;
		idlePolls = page.events.length > 0 ? 0 : idlePolls + 1;

		for (const entry of state.transcript) {
			const previous = sent.get(entry.id);
			if (previous === entry) continue;
			emitEntryUpdate(stream, previous, entry, log);
			sent.set(entry.id, entry);
		}

		for (const presentation of state.presentations) {
			if (presentedPresentations.has(presentation.id)) continue;
			presentedPresentations.add(presentation.id);
			emitPresentation(stream, presentation);
		}

		for (const pending of state.uiRequests) {
			if (presented.has(pending.token)) continue;
			if (pending.status !== undefined && pending.status !== "pending") continue;
			presented.add(pending.token);
			await answerNativeUiRequest(client, { ...session, incarnation }, pending, stream, log);
		}

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
 * (`get_state.contextUsage`), Cedia only relays it; a host that does not report
 * one leaves the meter hidden rather than showing an invented number.
 */
async function reportContextUsage(
	client: CediaHostClient,
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
		log(`Cedia could not read OMP's context usage: ${error instanceof Error ? error.message : String(error)}`);
	}
}

/**
 * Answer one pending host UI request from the native chat by presenting it as a
 * blocking carousel question. A request the native surface may not collect
 * (password, schemaform) is reported instead of silently dropped; a failure
 * never breaks the turn, because the host times the request out on its own and
 * the journal keeps moving.
 */
async function answerNativeUiRequest(
	client: CediaHostClient,
	session: Session,
	pending: TaskState["uiRequests"][number],
	stream: vscode.ChatResponseStream,
	log: (message: string) => void,
): Promise<void> {
	const question = uiQuestionFromRequest(pending.request);
	if (!question) {
		if (pending.request.method === "password" || pending.request.method === "schemaform") {
			stream.warning("This request can only be answered from the Cedia composer in the IDE dock.");
		}
		return;
	}
	let answer: string | boolean | { readonly cancelled: true };
	try {
		const type = question.kind === "text"
			? vscode.ChatQuestionType.Text
			: question.kind === "multi_select" ? vscode.ChatQuestionType.MultiSelect : vscode.ChatQuestionType.SingleSelect;
		const chatQuestion = new vscode.ChatQuestion(question.id, type, question.title, {
			message: question.message,
			options: question.options?.map(option => ({ id: option.id, label: option.label, value: option.value })),
		});
		const answers = await stream.questionCarousel([chatQuestion], true);
		answer = uiAnswerValue(pending.request, answers?.[uiCarouselQuestionId(pending.request)]);
	} catch (error) {
		log(`Cedia could not present this request in the native chat: ${error instanceof Error ? error.message : String(error)}`);
		return;
	}
	try {
		await client.sendUiResponse(session.id, { commandId: randomUUID(), incarnation: session.incarnation, token: pending.token, answer });
	} catch (error) {
		log(`Cedia could not answer this request from the native chat: ${error instanceof Error ? error.message : String(error)}`);
	}
}

function emitPresentation(stream: vscode.ChatResponseStream, presentation: UiPresentation): void {
	try {
		if (presentation.method === "notify") {
			if (!presentation.message) return;
			if (presentation.notifyType === "warning" || presentation.notifyType === "error") stream.warning(presentation.message);
			else stream.info(presentation.message);
			return;
		}
		if (presentation.method === "open_url" && presentation.url) {
			stream.markdown(`[${presentation.instructions ?? "Sign-in URL"}](${presentation.url})`);
		}
	} catch {
		// A presentation is fire-and-forget; a failing sink must not fail the turn.
	}
}

function emitEntryUpdate(stream: vscode.ChatResponseStream, previous: TranscriptEntry | undefined, entry: TranscriptEntry, log: (message: string) => void): void {
	if (entry.role === "user" || entry.role === "system") return;
	if (entry.kind === "tool") {
		if (previous?.kind === "tool" && previous.toolName === entry.toolName && previous.toolStatus === entry.toolStatus && previous.output === entry.output && previous.args === entry.args) return;
		const card = toolCardFromEntry(entry);
		if (!card) return;
		const part = new vscode.ChatToolInvocationPart(card.toolName, entry.id);
		part.invocationMessage = card.invocation;
		part.pastTenseMessage = card.past;
		part.isError = card.isError;
		part.isComplete = card.isComplete;
		part.enablePartialUpdate = true;
		part.toolSpecificData = { input: card.input, output: card.output };
		// The published `push` overload predates the proposed tool part; the host accepts it.
		(stream as unknown as { push(part: vscode.ChatToolInvocationPart): void }).push(part);
		return;
	}
	if (entry.status === "failed" && !entry.text) {
		// A turn can end on the provider's side with no text at all. Rendering nothing is what made
		// a rate-limited turn look like an empty completion in a window whose row still read
		// completed, so the provider's own sentence is what the transcript shows.
		const failure = entryFailureText(entry);
		stream.markdown(failure
			? `**Cedia stopped this turn.** ${failure}`
			: "**Cedia stopped this turn.** OMP reported an error without a message.");
		return;
	}
	if (!entry.text) return;
	const already = previous?.kind === "message" ? previous.text : "";
	if (entry.text === already) return;
	if (!entry.text.startsWith(already)) {
		// The native stream is append-only (markdown cannot be retracted), so a rewrite of
		// text already shown can only be reported, not replayed.
		log(`Cedia cannot rewind already-streamed text for ${entry.id}; the live view keeps the longer prefix.`);
		return;
	}
	stream.markdown(entry.text.slice(already.length));
}
