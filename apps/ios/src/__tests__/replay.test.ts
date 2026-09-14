import { describe, expect, test } from "bun:test";
import { createInitialMobileState } from "../core/state.ts";
import { clearSnapshotCache, createCachedSnapshot, isSnapshotCacheKey, parseCachedSnapshot, readCachedSnapshot, restoreCachedSnapshot, snapshotKey, writeCachedSnapshot, type SnapshotCache } from "../core/replay.ts";
import type { Session } from "../../../../packages/protocol/src/index.ts";

const session: Session = { id: "s1", projectId: "p1", title: "Task", cwd: "/work", sessionFile: "/state/s1.jsonl", incarnation: "inc-1", status: "idle", archived: false, createdAt: "now", updatedAt: "now" };
function memoryCache(): SnapshotCache & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    get: async key => values.get(key) ?? null,
    set: async (key, value) => { values.set(key, value); },
    remove: async key => { values.delete(key); },
    keys: async () => [...values.keys()],
  };
}

describe("offline snapshot replay", () => {
  test("writes and reads a bounded incarnation-scoped snapshot", async () => {
    const cache = memoryCache();
    let state = createInitialMobileState({ session });
    state = { ...state, cursor: 2, events: [{ sessionId: "s1", incarnation: "inc-1", sequence: 1, timestamp: "now", frame: { type: "notice", message: "cached" } }] };
    const snapshot = await writeCachedSnapshot(cache, state, 100, 500);
    expect(snapshot?.expiresAt).toBe(600);
    await expect(readCachedSnapshot(cache, session, 599)).resolves.toMatchObject({ fresh: true });
    expect(snapshotKey("s1")).toContain("s1");
    expect(parseCachedSnapshot(JSON.stringify(snapshot))?.incarnation).toBe("inc-1");
  });

  test("never restores a snapshot from a different OMP incarnation", () => {
    const state = createInitialMobileState({ session });
    const snapshot = createCachedSnapshot({ session: { ...session, incarnation: "old" }, cursor: 1, events: [], cacheSavedAt: 10, cacheExpiresAt: 20 });
    expect(snapshot).not.toBeNull();
    expect(restoreCachedSnapshot(state, snapshot!)).toBe(state);
  });

  test("clearSnapshotCache removes snapshot keys and leaves drafts", async () => {
    const cache = memoryCache();
    await cache.set(snapshotKey("s1"), "snap");
    await cache.set("caret.mobile.draft.v1:s1", "keep-draft");
    await cache.set("other", "keep-other");
    expect(isSnapshotCacheKey(snapshotKey("s1"))).toBe(true);
    expect(isSnapshotCacheKey("caret.mobile.draft.v1:s1")).toBe(false);
    await clearSnapshotCache(cache);
    expect(cache.values.has(snapshotKey("s1"))).toBe(false);
    expect(cache.values.get("caret.mobile.draft.v1:s1")).toBe("keep-draft");
    expect(cache.values.get("other")).toBe("keep-other");
  });
});
