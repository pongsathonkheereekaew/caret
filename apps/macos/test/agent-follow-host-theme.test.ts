import { describe, expect, it } from "bun:test";
import {
  DEFAULT_THEME_STATE,
  normalizeThemeState,
  parseStoredThemeState,
  serializeThemeState,
} from "../agent-window/vendor/synara/apps/web/src/theme/theme.logic.ts";

const CUSTOM_DARK = {
  accent: "#0169cc",
  contrast: 0,
  fonts: { code: null, ui: "Inter" },
  ink: "#fcfcfc",
  opaqueWindows: true,
  semanticColors: { diffAdded: "#00a240", diffRemoved: "#e02e2a", skill: "#b06dff" },
  surface: "#111111",
};

describe("Follow IDE theme link", () => {
  it("defaults to linked", () => {
    expect(DEFAULT_THEME_STATE.followHostTheme).toBe(true);
    expect(parseStoredThemeState(null).followHostTheme).toBe(true);
  });

  it("round-trips an explicit unlink", () => {
    const next = normalizeThemeState({ ...JSON.parse(serializeThemeState(DEFAULT_THEME_STATE)), followHostTheme: false });
    expect(next.followHostTheme).toBe(false);
    expect(parseStoredThemeState(serializeThemeState(next)).followHostTheme).toBe(false);
  });

  it("migrates pristine legacy states to linked", () => {
    const legacy = JSON.stringify({ mode: "system", chromeThemes: undefined });
    expect(parseStoredThemeState(legacy).followHostTheme).toBe(true);
  });

  it("migrates customized legacy states to unlinked so their look never changes", () => {
    const legacy = JSON.stringify({
      mode: "system",
      chromeThemes: { dark: CUSTOM_DARK },
      codeThemeIds: { dark: "codex", light: "codex" },
    });
    const parsed = parseStoredThemeState(legacy);
    expect(parsed.followHostTheme).toBe(false);
    // The customization itself survives the migration.
    expect(parsed.chromeThemes.dark.accent).toBe("#0169cc");
  });
});
