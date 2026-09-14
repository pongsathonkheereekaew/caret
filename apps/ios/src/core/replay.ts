import type { EventPage, Session, SessionEvent } from "../../../../packages/protocol/src/index.ts";
import { applyEventPage, createInitialMobileState, reduceMobileState } from "./state.ts";
import type { CachedTaskSnapshot, MobileTaskState } from "./types.ts";

export const SNAPSHOT_VERSION = 1 as const;
export const DEFAULT_CACHE_TTL_MS = 5 * 60_000;
/** AsyncStorage is a continuity hint; large frames stay on the Mac. */
export const MAX_CACHED_SNAPSHOT_BYTES = 8 * 1024 * 1024;

export interface SnapshotCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove?(key: string): Promise<void>;
  keys?(): Promise<readonly string[]>;
}

export function snapshotKey(sessionId: string): string {
  return `caret.mobile.snapshot.v${SNAPSHOT_VERSION}:${encodeURIComponent(sessionId)}`;
}

export function isSnapshotCacheKey(key: string): boolean {
  return key.startsWith(`caret.mobile.snapshot.v${SNAPSHOT_VERSION}:`);
}

/** Removes snapshot keys only. Pairing secrets and composer drafts stay. */
export async function clearSnapshotCache(cache: SnapshotCache): Promise<void> {
  if (!cache.keys || !cache.remove) return;
  const keys = (await cache.keys()).filter(isSnapshotCacheKey);
  await Promise.all(keys.map(key => cache.remove!(key)));
}

export function createCachedSnapshot(state: Pick<MobileTaskState, "session" | "cursor" | "cacheSavedAt" | "cacheExpiresAt" | "events">, now = Date.now(), ttlMs = DEFAULT_CACHE_TTL_MS): CachedTaskSnapshot | null {
  const session = state.session;
  if (!session || !session.incarnation || !Number.isSafeInteger(state.cursor) || state.cursor < 0) return null;
  const savedAt = state.cacheSavedAt ?? now;
  const expiresAt = state.cacheExpiresAt ?? savedAt + ttlMs;
  const snapshot: CachedTaskSnapshot = {
    version: SNAPSHOT_VERSION,
    sessionId: session.id,
    incarnation: session.incarnation,
    cursor: state.cursor,
    events: state.events,
    savedAt,
    expiresAt,
  };
  try {
    if (new TextEncoder().encode(JSON.stringify(snapshot)).byteLength > MAX_CACHED_SNAPSHOT_BYTES) return null;
  } catch {
    return null;
  }
  return snapshot;
}

function isSessionEvent(value: unknown): value is SessionEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.sessionId === "string" && typeof record.incarnation === "string" && Number.isSafeInteger(record.sequence)
    && typeof record.timestamp === "string" && "frame" in record;
}

export function parseCachedSnapshot(value: string): CachedTaskSnapshot | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (record.version !== SNAPSHOT_VERSION || typeof record.sessionId !== "string" || typeof record.incarnation !== "string" || !Number.isSafeInteger(record.cursor) || (record.cursor as number) < 0 || !Number.isSafeInteger(record.savedAt) || !Number.isSafeInteger(record.expiresAt) || !Array.isArray(record.events) || !record.events.every(isSessionEvent)) return null;
    return {
      version: SNAPSHOT_VERSION,
      sessionId: record.sessionId,
      incarnation: record.incarnation,
      cursor: record.cursor as number,
      events: [...record.events],
      savedAt: record.savedAt as number,
      expiresAt: record.expiresAt as number,
    };
  } catch {
    return null;
  }
}

export function isSnapshotFresh(snapshot: Pick<CachedTaskSnapshot, "expiresAt">, now = Date.now()): boolean {
  return snapshot.expiresAt > now;
}

/**
 * Restore only a snapshot for the currently selected session/incarnation.
 * A stale incarnation is discarded instead of being rendered as current.
 */
export function restoreCachedSnapshot(state: MobileTaskState, snapshot: CachedTaskSnapshot, now = Date.now()): MobileTaskState {
  if (!state.session || snapshot.sessionId !== state.session.id || snapshot.incarnation !== state.session.incarnation) return state;
  const restored = applyEventPage(createInitialMobileState({ ...state, transcript: [], events: [], cursor: 0, seenEventKeys: [], uiRequests: [], presentations: [] }), {
    events: [...snapshot.events],
    cursor: snapshot.cursor,
    hasMore: false,
  });
  return reduceMobileState(restored, { type: "cached_meta", savedAt: snapshot.savedAt, expiresAt: snapshot.expiresAt });
}

export async function readCachedSnapshot(cache: SnapshotCache, session: Session, now = Date.now()): Promise<{ snapshot: CachedTaskSnapshot; fresh: boolean } | null> {
  const raw = await cache.get(snapshotKey(session.id));
  if (!raw) return null;
  const snapshot = parseCachedSnapshot(raw);
  if (!snapshot || snapshot.sessionId !== session.id || snapshot.incarnation !== session.incarnation) return null;
  return { snapshot, fresh: isSnapshotFresh(snapshot, now) };
}

export async function writeCachedSnapshot(cache: SnapshotCache, state: MobileTaskState, now = Date.now(), ttlMs = DEFAULT_CACHE_TTL_MS): Promise<CachedTaskSnapshot | null> {
  const snapshot = createCachedSnapshot(state, now, ttlMs);
  if (!snapshot) return null;
  await cache.set(snapshotKey(snapshot.sessionId), JSON.stringify(snapshot));
  return snapshot;
}

export function replayEvents(state: MobileTaskState, events: readonly SessionEvent[], cursor = events.at(-1)?.sequence ?? state.cursor): MobileTaskState {
  const page: EventPage = { events: [...events], cursor, hasMore: false };
  return applyEventPage(state, page);
}
