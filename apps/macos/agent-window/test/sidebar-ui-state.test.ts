import { afterEach, beforeEach, expect, it } from "bun:test";

import {
  persistSidebarUiState,
  readSidebarUiState,
  subscribeSidebarUiState,
} from "../vendor/synara/apps/web/src/components/Sidebar.uiState";

const STORAGE_KEY = "synara:sidebar-ui:v1";

type StorageListener = (event: StorageEvent) => void;

function installWindowStorage() {
  const values = new Map<string, string>();
  const listeners = new Set<StorageListener>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: storage,
      addEventListener: (_type: string, listener: StorageListener) => listeners.add(listener),
      removeEventListener: (_type: string, listener: StorageListener) => listeners.delete(listener),
    },
  });
  return {
    emitStorageChange: () => {
      for (const listener of listeners) {
        listener({ key: STORAGE_KEY } as StorageEvent);
      }
    },
  };
}

beforeEach(() => {
  installWindowStorage();
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

it("restores a collapsed sidebar and preserves it through other sidebar updates", () => {
  const initial = readSidebarUiState();
  persistSidebarUiState({ ...initial, sidebarOpen: false });

  expect(readSidebarUiState().sidebarOpen).toBe(false);

  // Existing Sidebar.tsx callers omit the shell field; that must not reopen it.
  persistSidebarUiState({
    ...readSidebarUiState(),
    chatSectionExpanded: true,
    sidebarOpen: undefined,
  });

  expect(readSidebarUiState().sidebarOpen).toBe(false);
  expect(readSidebarUiState().chatSectionExpanded).toBe(true);
});

it("notifies a mounted shell when another window changes visibility", () => {
  const { emitStorageChange } = installWindowStorage();
  const states: boolean[] = [];
  const unsubscribe = subscribeSidebarUiState((state) => states.push(state.sidebarOpen));
  try {
    persistSidebarUiState({ ...readSidebarUiState(), sidebarOpen: false });
    emitStorageChange();
    expect(states).toEqual([false]);
  } finally {
    unsubscribe();
  }
});

