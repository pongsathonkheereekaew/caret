import { describe, expect, it } from "bun:test";
import { packForIdeThemeName } from "../vendor/synara/apps/web/src/theme/theme.logic";

describe("packForIdeThemeName", () => {
  it("maps exact and decorated IDE theme names", () => {
    expect(packForIdeThemeName("Catppuccin Frappé", "dark")).toBe("catppuccin");
    expect(packForIdeThemeName("Tokyo Night", "dark")).toBe("tokyo-night");
    expect(packForIdeThemeName("Night Owl", "dark")).toBe("night-owl");
    expect(packForIdeThemeName("Rose Pine", "light")).toBe("rose-pine");
    expect(packForIdeThemeName("Solarized Dark", "dark")).toBe("solarized");
    expect(packForIdeThemeName("Monokai", "dark")).toBe("monokai");
    expect(packForIdeThemeName("Dracula", "dark")).toBe("dracula");
    expect(packForIdeThemeName("GitHub Dark", "dark")).toBe("github");
    expect(packForIdeThemeName("Gruvbox Dark", "dark")).toBe("gruvbox");
    expect(packForIdeThemeName("Nord", "dark")).toBe("nord");
  });
  it("is case- and punctuation-insensitive", () => {
    expect(packForIdeThemeName("  TOKYO night!! ", "dark")).toBe("tokyo-night");
    expect(packForIdeThemeName("One Dark Pro", "dark")).toBe("one");
  });
  it("maps the stock VS Code themes to VS Code Plus", () => {
    expect(packForIdeThemeName("Default Dark+", "dark")).toBe("vscode-plus");
    expect(packForIdeThemeName("Default Light+", "light")).toBe("vscode-plus");
    expect(packForIdeThemeName("Dark Modern", "dark")).toBe("vscode-plus");
    expect(packForIdeThemeName("Visual Studio Dark", "dark")).toBe("vscode-plus");
  });
  it("refuses packs that lack the requested variant", () => {
    expect(packForIdeThemeName("Dracula", "light")).toBeUndefined();
    expect(packForIdeThemeName("Monokai", "light")).toBeUndefined();
  });
  it("keeps the stored pack for unknown or missing names", () => {
    expect(packForIdeThemeName("Someone's Custom", "dark")).toBeUndefined();
    expect(packForIdeThemeName("", "dark")).toBeUndefined();
    expect(packForIdeThemeName(undefined, "dark")).toBeUndefined();
    expect(packForIdeThemeName(null, "dark")).toBeUndefined();
  });
});
