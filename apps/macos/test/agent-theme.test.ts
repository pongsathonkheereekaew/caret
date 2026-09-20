import { describe, expect, it } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readAgentThemeSnapshot, normalizeAgentThemeSnapshot, writeAgentThemeSnapshot } from "../src/agent-theme.ts";
import { createAgentWindowHandler } from "../src/agent-window-main.ts";

describe("Agent theme handoff", () => {
  it("keeps only the bounded Code-OSS color allowlist", () => {
    expect(normalizeAgentThemeSnapshot({
      mode: "dark",
      themeName: "Custom Dark",
      colors: {
        "--vscode-editor-background": "#181818",
        "--vscode-foreground": "rgb(240, 240, 240)",
        "--vscode-button-background": "url(https://example.invalid/exfil)",
        "--not-vscode": "#fff",
      },
    })).toEqual({
      mode: "dark",
      themeName: "Custom Dark",
      colors: {
        "--vscode-editor-background": "#181818",
        "--vscode-foreground": "rgb(240, 240, 240)",
      },
    });
    expect(normalizeAgentThemeSnapshot({ mode: "sepia", colors: {} })).toBeUndefined();
  });

  it("round-trips a validated snapshot through the shared Agent state directory", async () => {
    const stateDir = await mkdtemp(join(tmpdir(), "cedia-agent-theme-"));
    try {
      await writeAgentThemeSnapshot(stateDir, {
        mode: "light",
        themeName: "Light (Custom)",
        colors: { "--vscode-editor-background": "#ffffff" },
      });
      expect(await readAgentThemeSnapshot(stateDir)).toEqual({
        mode: "light",
        themeName: "Light (Custom)",
        colors: { "--vscode-editor-background": "#ffffff" },
      });
      // The helper stores through the same private Agent UI state mechanism.
      expect((await readdir(join(stateDir, "agent-ui"))).length).toBe(1);
    } finally {
      await rm(stateDir, { recursive: true, force: true });
    }
  });

  it("serves the latest snapshot to an already-open Agent renderer", async () => {
    const stateDir = await mkdtemp(join(tmpdir(), "cedia-agent-theme-ipc-"));
    try {
      const handler = createAgentWindowHandler({
        stateDir,
        authorize: () => true,
        ensure: async () => {},
        request: async () => ({}),
        pickFolder: async () => null,
        openIde: async () => {},
        openExternal: async () => {},
      });
      await writeAgentThemeSnapshot(stateDir, { mode: "dark", colors: { "--vscode-editor-background": "#111111" } });
      await expect(handler(null, { kind: "theme" })).resolves.toEqual({ mode: "dark", colors: { "--vscode-editor-background": "#111111" } });
      await writeAgentThemeSnapshot(stateDir, { mode: "light", colors: { "--vscode-editor-background": "#ffffff" } });
      await expect(handler(null, { kind: "theme" })).resolves.toEqual({ mode: "light", colors: { "--vscode-editor-background": "#ffffff" } });
    } finally {
      await rm(stateDir, { recursive: true, force: true });
    }
  });
});

it("retains an effective palette when the same IDE theme republishes its fallback", async () => {
  const stateDir = await mkdtemp(join(tmpdir(), "cedia-theme-fallback-"));
  try {
    await writeAgentThemeSnapshot(stateDir, { mode: "dark", themeName: "Custom", colors: { "--vscode-editor-background": "#123456" } });
    await writeAgentThemeSnapshot(stateDir, { mode: "dark", themeName: "Custom" });
    expect((await readAgentThemeSnapshot(stateDir))?.colors?.["--vscode-editor-background"]).toBe("#123456");
    await writeAgentThemeSnapshot(stateDir, { mode: "light", themeName: "Different" });
    expect((await readAgentThemeSnapshot(stateDir))?.colors).toBeUndefined();
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});
