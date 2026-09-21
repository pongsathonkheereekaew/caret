import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  findInstalledThemeColors,
  findInstalledThemeUiTheme,
  readAgentsWorkspaceThemeSettings,
  resolvePublishedTheme,
  startAgentThemePublisher,
  themeKindFromName,
  themeKindFromUiTheme,
} from "../src/agent-window-theme-publisher.ts";
import { readAgentThemeSnapshot } from "../src/agent-theme.ts";

const files = new Map<string, string>();
const fileDeps = {
  readTextFile: (path: string): string | undefined => files.get(path),
  listDir: (path: string): string[] => [...files.keys()]
    .filter(key => key.startsWith(`${path}/`))
    .map(key => key.slice(path.length + 1).split("/")[0]!)
    .filter((entry, index, all) => entry.length > 0 && all.indexOf(entry) === index),
  joinPath: (...parts: string[]): string => parts.join("/").replace(/\/\.\//g, "/"),
  fileMtimeMs: (path: string): number | undefined => (files.has(path) ? 7 : undefined),
};

describe("agents workspace theme settings", () => {
  it("reads the theme keys and ignores the rest", () => {
    expect(readAgentsWorkspaceThemeSettings(JSON.stringify({
      folders: [],
      settings: {
        "workbench.colorTheme": "__vs-dark",
        "workbench.preferredDarkColorTheme": "Dark Modern",
        "workbench.preferredLightColorTheme": "Light Modern",
        "window.autoDetectColorScheme": true,
        "other": 1,
      },
    }))).toEqual({
      colorTheme: "__vs-dark",
      preferredDarkColorTheme: "Dark Modern",
      preferredLightColorTheme: "Light Modern",
      autoDetectColorScheme: true,
    });
    expect(readAgentsWorkspaceThemeSettings("{ nope")).toBeUndefined();
    expect(readAgentsWorkspaceThemeSettings(JSON.stringify({}))).toBeUndefined();
  });

  it("maps uiTheme values and theme names onto kinds", () => {
    expect(themeKindFromUiTheme("vs")).toBe("light");
    expect(themeKindFromUiTheme("vs-dark")).toBe("dark");
    expect(themeKindFromUiTheme("hc-black")).toBe("dark");
    expect(themeKindFromUiTheme("hc-light")).toBe("light");
    expect(themeKindFromUiTheme("nope")).toBeUndefined();
    expect(themeKindFromName("Dark Modern")).toBe("dark");
    expect(themeKindFromName("Light Modern")).toBe("light");
    expect(themeKindFromName("Catppuccin Mocha")).toBeUndefined();
  });

  it("finds an installed theme file by id or label", () => {
    files.clear();
    files.set("/ext/catppuccin/package.json", JSON.stringify({
      contributes: { themes: [{ id: "catppuccin-mocha", label: "Catppuccin Mocha", path: "./themes/mocha.json" }] },
    }));
    files.set("/ext/catppuccin/themes/mocha.json", JSON.stringify({ uiTheme: "vs-dark" }));
    const find = (ref: string): string | undefined =>
      findInstalledThemeUiTheme(ref, ["/ext"], fileDeps.readTextFile, fileDeps.listDir, fileDeps.joinPath);
    expect(find("Catppuccin Mocha")).toBe("vs-dark");
    expect(find("catppuccin-mocha")).toBe("vs-dark");
    expect(find("Missing")).toBeUndefined();
  });

  it("reads an installed theme file palette for the snapshot allowlist", () => {
    files.clear();
    files.set("/ext/kimbie/package.json", JSON.stringify({
      contributes: { themes: [{ id: "kimbie-dark", label: "Kimbie Dark", path: "./themes/kimbie-dark.json" }] },
    }));
    files.set("/ext/kimbie/themes/kimbie-dark.json", JSON.stringify({
      uiTheme: "vs-dark",
      colors: {
        "editor.background": "#221a0f",
        "sideBar.background": "#2a2118",
        "button.background": "#a67c3d",
        "focusBorder": "#a57a4c",
        "not.a.color": "#ffffff",
        "editor.background.extra.deep": "#000000",
      },
    }));
    const find = (ref: string): Record<string, string> | undefined =>
      findInstalledThemeColors(ref, ["/ext"], fileDeps.readTextFile, fileDeps.listDir, fileDeps.joinPath);
    expect(find("Kimbie Dark")).toEqual({
      "--vscode-editor-background": "#221a0f",
      "--vscode-sideBar-background": "#2a2118",
      "--vscode-button-background": "#a67c3d",
      "--vscode-focusBorder": "#a57a4c",
    });
    expect(find("Missing")).toBeUndefined();
  });
});

describe("published snapshot resolution", () => {
  const findNone = () => undefined;
  it("follows the OS scheme and preferred theme under auto-detect", () => {
    expect(resolvePublishedTheme({
      settings: {
        colorTheme: "__vs-dark",
        preferredDarkColorTheme: "Dark Modern",
        preferredLightColorTheme: "Light Modern",
        autoDetectColorScheme: true,
      },
      systemDark: true,
      findUiTheme: findNone,
    })).toEqual({ mode: "dark", themeName: "Dark Modern" });
    expect(resolvePublishedTheme({
      settings: {
        colorTheme: "__vs-dark",
        preferredDarkColorTheme: "Dark Modern",
        preferredLightColorTheme: "Light Modern",
        autoDetectColorScheme: true,
      },
      systemDark: false,
      findUiTheme: findNone,
    })).toEqual({ mode: "light", themeName: "Light Modern" });
  });

  it("uses the installed theme file kind for explicit themes", () => {
    expect(resolvePublishedTheme({
      settings: { colorTheme: "Catppuccin Mocha" },
      systemDark: false,
      findUiTheme: () => "vs-dark",
    })).toEqual({ mode: "dark", themeName: "Catppuccin Mocha" });
    expect(resolvePublishedTheme({
      settings: { colorTheme: "Dark Modern" },
      systemDark: false,
      findUiTheme: findNone,
    })).toEqual({ mode: "dark", themeName: "Dark Modern" });
  });
});

describe("theme publisher", () => {
  it("writes on change and stays quiet otherwise", async () => {
    const stateDir = await mkdtemp(join(tmpdir(), "cedia-theme-publisher-"));
    try {
      const workspaceFile = join(stateDir, "agent-sessions.code-workspace");
      let systemDark = true;
      let mtime = 1;
      const text = new Map<string, string>([[workspaceFile, JSON.stringify({
        settings: {
          "workbench.colorTheme": "Dark Modern",
          "window.autoDetectColorScheme": false,
        },
      })]]);
      const writes: string[] = [];
      const publisher = startAgentThemePublisher({
        stateDir,
        workspaceFile,
        extensionsDirs: [],
        readTextFile: path => text.get(path),
        listDir: () => [],
        joinPath: (...parts) => parts.join("/"),
        fileMtimeMs: path => (text.has(path) ? mtime : undefined),
        readSystemDark: () => systemDark,
        setIntervalFn: () => undefined,
      });
      await publisher.tick();
      expect(await readAgentThemeSnapshot(stateDir)).toMatchObject({ mode: "dark", themeName: "Dark Modern" });
      writes.push("first");
      // Same content: no rewrite (mtime unchanged).
      await publisher.tick();
      // Flip the theme: the snapshot follows.
      mtime = 2;
      text.set(workspaceFile, JSON.stringify({
        settings: {
          "workbench.colorTheme": "Light Modern",
          "window.autoDetectColorScheme": false,
        },
      }));
      await publisher.tick();
      expect(await readAgentThemeSnapshot(stateDir)).toMatchObject({ mode: "light", themeName: "Light Modern" });
      writes.push("second");
      expect(writes).toEqual(["first", "second"]);
      publisher.dispose();
    } finally {
      await rm(stateDir, { recursive: true, force: true });
    }
  });

  it("publishes exact theme-file colors so linked windows match", async () => {
    const stateDir = await mkdtemp(join(tmpdir(), "cedia-theme-publisher-colors-"));
    try {
      const workspaceFile = join(stateDir, "agent-sessions.code-workspace");
      const text = new Map<string, string>([[workspaceFile, JSON.stringify({
        settings: {
          "workbench.colorTheme": "Kimbie Dark",
          "window.autoDetectColorScheme": false,
        },
      })]]);
      const ext = new Map<string, string>([
        ["/ext/kimbie/package.json", JSON.stringify({
          contributes: { themes: [{ id: "kimbie-dark", label: "Kimbie Dark", path: "./kimbie-dark.json" }] },
        })],
        ["/ext/kimbie/kimbie-dark.json", JSON.stringify({
          uiTheme: "vs-dark",
          colors: { "editor.background": "#221a0f", "sideBar.background": "#2a2118" },
        })],
      ]);
      const publisher = startAgentThemePublisher({
        stateDir,
        workspaceFile,
        extensionsDirs: ["/ext"],
        readTextFile: path => text.get(path) ?? ext.get(path),
        listDir: path => path === "/ext" ? ["kimbie"] : [],
        joinPath: (...parts) => parts.join("/").replace(/\/\.\//g, "/"),
        fileMtimeMs: path => (text.has(path) ? 1 : undefined),
        readSystemDark: () => true,
        setIntervalFn: () => undefined,
      });
      await publisher.tick();
      const snapshot = await readAgentThemeSnapshot(stateDir);
      expect(snapshot).toMatchObject({ mode: "dark", themeName: "Kimbie Dark" });
      expect(snapshot?.colors?.["--vscode-editor-background"]).toBe("#221a0f");
      expect(snapshot?.colors?.["--vscode-sideBar-background"]).toBe("#2a2118");
      publisher.dispose();
    } finally {
      await rm(stateDir, { recursive: true, force: true });
    }
  });

  it("ignores a workspace file it cannot read", async () => {
    const stateDir = await mkdtemp(join(tmpdir(), "cedia-theme-publisher-bad-"));
    try {
      const publisher = startAgentThemePublisher({
        stateDir,
        workspaceFile: join(stateDir, "missing.code-workspace"),
        extensionsDirs: [],
        readTextFile: () => undefined,
        listDir: () => [],
        joinPath: (...parts) => parts.join("/"),
        fileMtimeMs: () => undefined,
        readSystemDark: () => true,
        setIntervalFn: () => undefined,
      });
      await publisher.tick();
      expect(await readAgentThemeSnapshot(stateDir)).toBeUndefined();
      publisher.dispose();
    } finally {
      await rm(stateDir, { recursive: true, force: true });
    }
  });
});
