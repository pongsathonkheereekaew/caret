import AsyncStorage from "@react-native-async-storage/async-storage";

/** Per-session composer drafts only. Not snapshot cache and not pairing secrets. */
export const DRAFT_STORAGE_PREFIX = "cedia.mobile.draft.v1:";

type DraftStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export function draftStorageKey(sessionId: string): string {
  return `${DRAFT_STORAGE_PREFIX}${sessionId}`;
}

export async function readStoredDraft(sessionId: string, storage: DraftStorage = AsyncStorage): Promise<string> {
  try {
    const raw = await storage.getItem(draftStorageKey(sessionId));
    return typeof raw === "string" ? raw : "";
  } catch {
    return "";
  }
}

export async function writeStoredDraft(sessionId: string, draft: string, storage: DraftStorage = AsyncStorage): Promise<void> {
  await storage.setItem(draftStorageKey(sessionId), draft);
}

export async function clearStoredDraft(sessionId: string, storage: DraftStorage = AsyncStorage): Promise<void> {
  await storage.removeItem(draftStorageKey(sessionId));
}
