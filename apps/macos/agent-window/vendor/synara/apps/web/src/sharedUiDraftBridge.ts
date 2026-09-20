// FILE: sharedUiDraftBridge.ts
// Purpose: Keep the serializable composer draft for one thread shared between
// the standalone Agents Window and the IDE webview.
// Layer: Renderer persistence seam
// Depends on: the host's scoped `vscode:cediaAgent` uiDraft request and Synara's
// existing composer draft persistence normalizer.

import type { ThreadId } from "@synara/contracts";

import {
  migratePersistedComposerDraftStoreState,
  partializeComposerDraftStoreState,
  toHydratedThreadDraft,
  type PersistedComposerDraftStoreState,
} from "./composerDraftPersistence";
import { useComposerDraftStore } from "./composerDraftStore";
import type { ComposerDraftStoreState } from "./composerDraftDomain";

const CEDIA_AGENT_CHANNEL = "vscode:cediaAgent";
const WRITE_DEBOUNCE_MS = 160;

export interface SharedUiDraftPayload {
  readonly draft: unknown | null;
  readonly draftThread: unknown | null;
  /** Mapping entries that point at this thread (kept narrow to avoid full-store writes). */
  readonly projectMappings?: Readonly<Record<string, string>>;
}

export interface SharedUiDraftBridge {
  hydrateThread: (threadId: string) => Promise<void>;
  flush: () => Promise<void>;
  dispose: () => void;
}

interface SharedUiDraftTransport {
  invoke: (channel: string, input?: unknown) => Promise<unknown>;
}

interface SharedUiDraftRequest {
  readonly kind: "uiDraft";
  readonly threadId: string;
  readonly action: "read" | "write";
  readonly draft?: SharedUiDraftPayload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function payloadFromValue(value: unknown): SharedUiDraftPayload | null {
  if (!isRecord(value)) return null;
  const draft = value.draft;
  const draftThread = value.draftThread;
  const projectMappings = isRecord(value.projectMappings)
    ? Object.fromEntries(
        Object.entries(value.projectMappings).filter(
          ([, mapping]) => typeof mapping === "string",
        ) as Array<[string, string]>,
      )
    : undefined;
  if (draft === undefined && draftThread === undefined && projectMappings === undefined) {
    return null;
  }
  return {
    draft: draft ?? null,
    draftThread: draftThread ?? null,
    ...(projectMappings ? { projectMappings } : {}),
  };
}

function draftPayloadForThread(
  state: ComposerDraftStoreState,
  threadId: string,
): SharedUiDraftPayload {
  const persisted = partializeComposerDraftStoreState(state);
  const projectMappings = Object.fromEntries(
    Object.entries(persisted.projectDraftThreadIdByProjectId).filter(
      ([, mappedThreadId]) => mappedThreadId === threadId,
    ),
  );
  return {
    draft: persisted.draftsByThreadId[threadId as ThreadId] ?? null,
    draftThread: persisted.draftThreadsByThreadId[threadId as ThreadId] ?? null,
    // An empty mapping set is meaningful: it tells the other renderer to
    // remove stale project -> draft ownership after a draft is cleared.
    projectMappings,
  };
}

function serializedDraftForThread(state: ComposerDraftStoreState, threadId: string): string {
  return JSON.stringify(draftPayloadForThread(state, threadId));
}

function threadIdsForPayload(
  state: ComposerDraftStoreState,
  payload: SharedUiDraftPayload,
  threadId: string,
): PersistedComposerDraftStoreState {
  return migratePersistedComposerDraftStoreState({
    draftsByThreadId:
      payload.draft === null || payload.draft === undefined
        ? {}
        : { [threadId]: payload.draft },
    draftThreadsByThreadId:
      payload.draftThread === null || payload.draftThread === undefined
        ? {}
        : { [threadId]: payload.draftThread },
    projectDraftThreadIdByProjectId: payload.projectMappings ?? {},
    // Preserve the local sticky selections; the host payload is intentionally per-thread.
    stickyModelSelectionByProvider: partializeComposerDraftStoreState(state).stickyModelSelectionByProvider,
    stickyActiveProvider: partializeComposerDraftStoreState(state).stickyActiveProvider,
  });
}

function applyRemoteDraft(threadId: string, payload: SharedUiDraftPayload): void {
  const currentState = useComposerDraftStore.getState();
  const normalized = threadIdsForPayload(currentState, payload, threadId);
  const nextDrafts = { ...currentState.draftsByThreadId };
  const persistedDraft = normalized.draftsByThreadId[threadId as ThreadId];
  if (payload.draft === null) {
    delete nextDrafts[threadId as ThreadId];
  } else if (persistedDraft) {
    nextDrafts[threadId as ThreadId] = toHydratedThreadDraft(threadId as ThreadId, persistedDraft);
  }

  const nextDraftThreads = { ...currentState.draftThreadsByThreadId };
  const persistedDraftThread = normalized.draftThreadsByThreadId[threadId as ThreadId];
  if (payload.draftThread === null) {
    delete nextDraftThreads[threadId as ThreadId];
  } else if (persistedDraftThread) {
    nextDraftThreads[threadId as ThreadId] = persistedDraftThread;
  }

  const nextMappings = { ...currentState.projectDraftThreadIdByProjectId };
  if (payload.projectMappings !== undefined) {
    const remoteMappings = normalized.projectDraftThreadIdByProjectId as Readonly<Record<string, string>>;
    for (const [mappingKey, mappedThreadId] of Object.entries(nextMappings)) {
      if (mappedThreadId === threadId && remoteMappings[mappingKey] === undefined) {
        delete nextMappings[mappingKey];
      }
    }
  }
  for (const [mappingKey, mappedThreadId] of Object.entries(normalized.projectDraftThreadIdByProjectId)) {
    if (mappedThreadId === threadId) nextMappings[mappingKey] = mappedThreadId;
  }

  useComposerDraftStore.setState({
    draftsByThreadId: nextDrafts,
    draftThreadsByThreadId: nextDraftThreads,
    projectDraftThreadIdByProjectId: nextMappings,
  });
}

function currentRouteThreadId(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.location.hash.replace(/^#/, "").replace(/^\/+/, "").split(/[/?#]/, 1)[0] ?? "";
  return /^[A-Za-z0-9_-]{1,128}$/.test(raw) ? raw : null;
}

/**
 * Install the same small synchronization loop in both renderers. LocalStorage
 * remains the fast local cache; this bridge is the cross-origin handoff source.
 */
export function installSharedUiDraftBridge(
  transport: SharedUiDraftTransport,
): SharedUiDraftBridge {
  const pendingTimers = new Map<string, number>();
  const revisions = new Map<string, number>();
  const snapshots = new Map<string, string>();
  // Keep one ordered write tail per thread. The host may complete requests out
  // of order; chaining prevents an older payload from winning after a newer
  // keystroke has already been flushed.
  const writes = new Map<string, Promise<void>>();
  let applyingRemote = false;

  const initial = partializeComposerDraftStoreState(useComposerDraftStore.getState());
  for (const threadId of new Set([
    ...Object.keys(initial.draftsByThreadId),
    ...Object.keys(initial.draftThreadsByThreadId),
  ])) {
    snapshots.set(threadId, serializedDraftForThread(useComposerDraftStore.getState(), threadId));
    revisions.set(threadId, 0);
  }

  const writeThread = (threadId: string, expectedRevision: number): Promise<void> => {
    const payload = draftPayloadForThread(useComposerDraftStore.getState(), threadId);
    const request: SharedUiDraftRequest = {
      kind: "uiDraft",
      threadId,
      action: "write",
      draft: payload,
    };
    const previous = writes.get(threadId) ?? Promise.resolve();
    const write = previous
      .catch(() => undefined)
      .then(() => transport.invoke(CEDIA_AGENT_CHANNEL, request))
      .then(() => {
        if ((revisions.get(threadId) ?? 0) === expectedRevision) {
          snapshots.set(threadId, JSON.stringify(payload));
        }
      })
      .catch(() => undefined);
    const tail = write.finally(() => {
      if (writes.get(threadId) === tail) writes.delete(threadId);
    });
    writes.set(threadId, tail);
    return tail;
  };

  const scheduleWrite = (threadId: string): void => {
    const existing = pendingTimers.get(threadId);
    if (existing !== undefined) window.clearTimeout(existing);
    const timer = window.setTimeout(() => {
      pendingTimers.delete(threadId);
      void writeThread(threadId, revisions.get(threadId) ?? 0);
    }, WRITE_DEBOUNCE_MS);
    pendingTimers.set(threadId, timer);
  };

  const unsubscribe = useComposerDraftStore.subscribe((state) => {
    if (applyingRemote) return;
    const persisted = partializeComposerDraftStoreState(state);
    const threadIds = new Set([
      ...Object.keys(persisted.draftsByThreadId),
      ...Object.keys(persisted.draftThreadsByThreadId),
      ...snapshots.keys(),
    ]);
    for (const threadId of threadIds) {
      const nextSnapshot = serializedDraftForThread(state, threadId);
      if (snapshots.get(threadId) === nextSnapshot) continue;
      revisions.set(threadId, (revisions.get(threadId) ?? 0) + 1);
      scheduleWrite(threadId);
    }
  });

  const hydrateThread = async (threadId: string): Promise<void> => {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(threadId)) return;
    const currentSnapshot = serializedDraftForThread(useComposerDraftStore.getState(), threadId);
    if (
      pendingTimers.has(threadId) ||
      writes.has(threadId) ||
      (snapshots.has(threadId) && snapshots.get(threadId) !== currentSnapshot)
    ) {
      return;
    }
    const revisionAtStart = revisions.get(threadId) ?? 0;
    let value: unknown;
    try {
      value = await transport.invoke(CEDIA_AGENT_CHANNEL, {
        kind: "uiDraft",
        threadId,
        action: "read",
      } satisfies SharedUiDraftRequest);
    } catch {
      return;
    }
    if ((revisions.get(threadId) ?? 0) !== revisionAtStart) return;
    const payload = payloadFromValue(value);
    if (!payload) return;
    applyingRemote = true;
    try {
      applyRemoteDraft(threadId, payload);
      snapshots.set(threadId, serializedDraftForThread(useComposerDraftStore.getState(), threadId));
    } finally {
      applyingRemote = false;
    }
  };

  const onHashChange = (): void => {
    const threadId = currentRouteThreadId();
    if (threadId) void hydrateThread(threadId);
  };
  window.addEventListener("hashchange", onHashChange);
  window.addEventListener("focus", onHashChange);

  return {
    hydrateThread,
    flush: async () => {
      for (const [threadId, timer] of pendingTimers) {
        window.clearTimeout(timer);
        pendingTimers.delete(threadId);
        void writeThread(threadId, revisions.get(threadId) ?? 0);
      }
      await Promise.all([...writes.values()]);
    },
    dispose: () => {
      unsubscribe();
      for (const timer of pendingTimers.values()) window.clearTimeout(timer);
      pendingTimers.clear();
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("focus", onHashChange);
    },
  };
}
