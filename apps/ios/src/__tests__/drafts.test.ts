import { describe, expect, test } from "bun:test";
import { clearStoredDraft, draftStorageKey, readStoredDraft, writeStoredDraft } from "../storage/drafts.ts";

function memoryDrafts() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
    removeItem: async (key: string) => { values.delete(key); },
  };
}

describe("composer draft storage", () => {
  test("uses a per-session key and does not auto-send", async () => {
    expect(draftStorageKey("s1")).toBe("cedia.mobile.draft.v1:s1");
    const storage = memoryDrafts();
    await writeStoredDraft("s1", "continue from the phone", storage);
    await expect(readStoredDraft("s1", storage)).resolves.toBe("continue from the phone");
    await expect(readStoredDraft("s2", storage)).resolves.toBe("");
    await clearStoredDraft("s1", storage);
    await expect(readStoredDraft("s1", storage)).resolves.toBe("");
    expect(storage.values.has("cedia.mobile.pairing")).toBe(false);
  });
});
