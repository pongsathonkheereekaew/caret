// FILE: Sidebar.uiState.browser.tsx
// Purpose: Guards persistence of the shell sidebar visibility preference.

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  persistSidebarUiState,
  readSidebarUiState,
  subscribeSidebarUiState,
} from "./Sidebar.uiState";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("sidebar shell visibility persistence", () => {
  it("restores a collapsed sidebar and preserves it through other sidebar updates", () => {
    const initial = readSidebarUiState();
    persistSidebarUiState({ ...initial, sidebarOpen: false });

    expect(readSidebarUiState().sidebarOpen).toBe(false);

    // Thread-list state is written independently by Sidebar.tsx. Omitting the
    // new shell field must not silently reset the user's collapsed preference.
    persistSidebarUiState({
      ...readSidebarUiState(),
      chatSectionExpanded: true,
      sidebarOpen: undefined,
    });

    expect(readSidebarUiState().sidebarOpen).toBe(false);
    expect(readSidebarUiState().chatSectionExpanded).toBe(true);
  });

  it("notifies a mounted shell when another window changes visibility", () => {
    const states: boolean[] = [];
    const unsubscribe = subscribeSidebarUiState((state) => states.push(state.sidebarOpen));
    try {
      persistSidebarUiState({ ...readSidebarUiState(), sidebarOpen: false });
      window.dispatchEvent(new StorageEvent("storage", { key: "synara:sidebar-ui:v1" }));
      expect(states).toEqual([false]);
    } finally {
      unsubscribe();
    }
  });
});

