/** Theme snapshot publishing from the main process (no extension host needed).
 *
 * Why this file exists: the snapshot the agent renderer follows
 * (`agent-ui/host-theme`) was only written by the extension running in an IDE
 * window. Agents-only usage therefore froze the file at whatever the IDE last
 * wrote, and the agent kept wearing that theme. This publisher runs in the main
 * process next to the agent-window bridge, reads the agents workspace file the
 * window itself renders from, and republishes whenever it changes.
 *
 * Fidelity notes:
 * - With `window.autoDetectColorScheme` the kind comes from the OS (the same
 *   source the workbench resolves), and the name from the preferred theme: exact.
 * - With an explicit theme the name is exact and the kind comes from the theme
 *   file's `uiTheme` looked up in the installed extensions (exact when found),
 *   else a dark/light name match, else the OS scheme.
 * - The main process cannot see the effective `--vscode-*` palette, so it never
 *   writes colors. The snapshot helper keeps previously published colors when the
 *   mode and name are unchanged, and drops them when the theme actually changed.
 */

import { resolveSnapshotThemeName } from "./workbench-mode.ts";
import { AGENT_THEME_COLOR_KEYS, readAgentThemeSnapshot, writeAgentThemeSnapshot } from "./agent-theme.ts";

export type ThemeKind = "light" | "dark";

export interface AgentsWorkspaceThemeSettings {
  readonly colorTheme?: string;
  readonly preferredDarkColorTheme?: string;
  readonly preferredLightColorTheme?: string;
  readonly autoDetectColorScheme?: boolean;
}

/** Read the theme keys out of an `agent-sessions.code-workspace` document. */
export function readAgentsWorkspaceThemeSettings(fileText: string): AgentsWorkspaceThemeSettings | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileText);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
  const settings = (parsed as { settings?: unknown }).settings;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return undefined;
  const row = settings as Record<string, unknown>;
  const text = (value: unknown): string | undefined =>
    typeof value === "string" && value.length > 0 ? value : undefined;
  return {
    colorTheme: text(row["workbench.colorTheme"]),
    preferredDarkColorTheme: text(row["workbench.preferredDarkColorTheme"]),
    preferredLightColorTheme: text(row["workbench.preferredLightColorTheme"]),
    ...(row["window.autoDetectColorScheme"] === true ? { autoDetectColorScheme: true as const } : {}),
  };
}

/** Map a theme file `uiTheme` (`vs`, `vs-dark`, `hc-black`, `hc-light`) onto a kind. */
export function themeKindFromUiTheme(uiTheme: unknown): ThemeKind | undefined {
  if (uiTheme === "vs") return "light";
  if (uiTheme === "vs-dark") return "dark";
  if (uiTheme === "hc-black") return "dark";
  if (uiTheme === "hc-light") return "light";
  return undefined;
}

/** Best-effort kind from a theme name or id (`Dark Modern` -> dark). */
export function themeKindFromName(name: unknown): ThemeKind | undefined {
  if (typeof name !== "string" || name.length === 0) return undefined;
  if (/dark/i.test(name)) return "dark";
  if (/light/i.test(name)) return "light";
  return undefined;
}

/** Locate an installed theme file by theme id or picker label. Returns the file path. */
function findInstalledThemeFile(
  themeRef: string,
  extensionsDirs: readonly string[],
  readTextFile: (path: string) => string | undefined,
  listDir: (path: string) => string[],
  joinPath: (...parts: string[]) => string,
): string | undefined {
  const wanted = themeRef.toLowerCase();
  for (const dir of extensionsDirs) {
    let entries: string[];
    try {
      entries = listDir(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.startsWith(".")) continue;
      const manifestRaw = readTextFile(joinPath(dir, entry, "package.json"));
      if (manifestRaw === undefined) continue;
      let manifest: { contributes?: { themes?: readonly { id?: unknown; label?: unknown; path?: unknown }[] } };
      try {
        manifest = JSON.parse(manifestRaw);
      } catch {
        continue;
      }
      const themes = manifest.contributes?.themes;
      if (!Array.isArray(themes)) continue;
      for (const theme of themes) {
        if (!theme || typeof theme !== "object") continue;
        const id = typeof theme.id === "string" ? theme.id : undefined;
        const label = typeof theme.label === "string" ? theme.label : undefined;
        if (id?.toLowerCase() !== wanted && label?.toLowerCase() !== wanted) continue;
        if (typeof theme.path !== "string" || theme.path.length === 0) continue;
        const themePath = joinPath(dir, entry, theme.path);
        if (readTextFile(themePath) === undefined) continue;
        return themePath;
      }
    }
  }
  return undefined;
}

/**
 * Find a theme's `uiTheme` in installed extensions, matching by theme id or by
 * the label the picker shows (the setting may hold either).
 */
export function findInstalledThemeUiTheme(
  themeRef: string,
  extensionsDirs: readonly string[],
  readTextFile: (path: string) => string | undefined,
  listDir: (path: string) => string[],
  joinPath: (...parts: string[]) => string,
): string | undefined {
  const themePath = findInstalledThemeFile(themeRef, extensionsDirs, readTextFile, listDir, joinPath);
  if (themePath === undefined) return undefined;
  const themeRaw = readTextFile(themePath);
  if (themeRaw === undefined) return undefined;
  try {
    const uiTheme = (JSON.parse(themeRaw) as { uiTheme?: unknown }).uiTheme;
    if (typeof uiTheme === "string" && uiTheme.length > 0) return uiTheme;
  } catch {
    // Fall through to undefined below.
  }
  return undefined;
}

const AGENT_THEME_CSS_KEYS = new Set<string>(AGENT_THEME_COLOR_KEYS);

/** Map a workbench color id (`editor.background`, `focusBorder`) onto its CSS variable. */
function themeFileColorToCssVar(id: string): string | undefined {
  if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/i.test(id)) return undefined;
  return `--vscode-${id.replace(/\./g, "-")}`;
}

/**
 * Read an installed theme file's `colors` palette for the shared snapshot, so the
 * Agents window can wear the exact IDE colors with no IDE window open. Only the
 * snapshot allowlist is kept; the writer sanitizes values. Unknown theme refs and
 * files without a usable palette resolve to undefined (name-only snapshot).
 */
export function findInstalledThemeColors(
  themeRef: string,
  extensionsDirs: readonly string[],
  readTextFile: (path: string) => string | undefined,
  listDir: (path: string) => string[],
  joinPath: (...parts: string[]) => string,
): Record<string, string> | undefined {
  const themePath = findInstalledThemeFile(themeRef, extensionsDirs, readTextFile, listDir, joinPath);
  if (themePath === undefined) return undefined;
  const themeRaw = readTextFile(themePath);
  if (themeRaw === undefined) return undefined;
  let parsed: { colors?: unknown };
  try {
    parsed = JSON.parse(themeRaw);
  } catch {
    return undefined;
  }
  const input = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    && (parsed as { colors?: unknown }).colors;
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const palette: Record<string, string> = {};
  for (const [id, raw] of Object.entries(input as Record<string, unknown>)) {
    if (typeof raw !== "string") continue;
    const cssVar = themeFileColorToCssVar(id);
    if (cssVar === undefined || !AGENT_THEME_CSS_KEYS.has(cssVar)) continue;
    const color = raw.trim().slice(0, 256);
    if (color.length > 0) palette[cssVar] = color;
  }
  return Object.keys(palette).length > 0 ? palette : undefined;
}

export interface PublishedThemeInput {
  readonly settings: AgentsWorkspaceThemeSettings;
  readonly systemDark: boolean;
  readonly findUiTheme: (themeRef: string) => string | undefined;
  readonly findThemeColors?: (themeName: string) => Record<string, string> | undefined;
}

/** Resolve what the snapshot should carry. Pure: unit-tested. */
export function resolvePublishedTheme(input: PublishedThemeInput): { mode: ThemeKind; themeName?: string; colors?: Record<string, string> } {
  const { settings } = input;
  const systemKind: ThemeKind = input.systemDark ? "dark" : "light";
  let mode: ThemeKind;
  if (settings.autoDetectColorScheme === true || settings.colorTheme === undefined) {
    // With auto-detect the OS scheme IS the resolved kind, and the preferred theme
    // for that kind is what the window shows.
    mode = systemKind;
  } else {
    // An explicit theme: its file says the kind exactly when installed.
    const uiTheme = input.findUiTheme(settings.colorTheme);
    mode = (uiTheme !== undefined ? themeKindFromUiTheme(uiTheme) : undefined)
      ?? themeKindFromName(settings.colorTheme)
      ?? systemKind;
  }
  const themeName = resolveSnapshotThemeName({
    colorTheme: settings.colorTheme,
    preferredDarkColorTheme: settings.preferredDarkColorTheme,
    preferredLightColorTheme: settings.preferredLightColorTheme,
    autoDetectColorScheme: settings.autoDetectColorScheme,
    mode,
  });
  if (themeName === undefined) return { mode };
  // Exact IDE colors from the installed theme file: without these the snapshot
  // carries a name the renderer may not know (no pack rule, no tokens), and the
  // window silently keeps its own look even while linked. Unknown themes stay
  // name-only; the writer keeps prior colors whenever mode and name are unchanged.
  const colors = input.findThemeColors?.(themeName);
  return colors === undefined ? { mode, themeName } : { mode, themeName, colors };
}

export interface ThemePublisherDeps {
  readonly stateDir?: string;
  readonly workspaceFile: string;
  readonly extensionsDirs: readonly string[];
  readonly readTextFile: (path: string) => string | undefined;
  readonly listDir: (path: string) => string[];
  readonly joinPath: (...parts: string[]) => string;
  readonly fileMtimeMs: (path: string) => number | undefined;
  readonly readSystemDark: () => boolean;
  /** Native OS-appearance notifications; the poll covers the rest. */
  readonly onSystemThemeUpdated?: (listener: () => void) => () => void;
  readonly pollMs?: number;
  readonly setIntervalFn?: (callback: () => void, ms: number) => unknown;
  readonly clearIntervalFn?: (handle: unknown) => void;
}

/** Publish the agents window theme into the shared snapshot. Keeps no timers when idle. */
export function startAgentThemePublisher(deps: ThemePublisherDeps): { dispose(): void; tick(): Promise<void> } {
  let disposed = false;
  let lastWorkspaceMtime: number | undefined;
  let lastPublishedKey = "";
  const findUiTheme = (themeRef: string): string | undefined =>
    findInstalledThemeUiTheme(themeRef, deps.extensionsDirs, deps.readTextFile, deps.listDir, deps.joinPath);
  const findThemeColors = (themeName: string): Record<string, string> | undefined =>
    findInstalledThemeColors(themeName, deps.extensionsDirs, deps.readTextFile, deps.listDir, deps.joinPath);
  const tick = async (): Promise<void> => {
    if (disposed) return;
    const systemDark = deps.readSystemDark();
    const mtime = deps.fileMtimeMs(deps.workspaceFile);
    if (mtime !== undefined && mtime === lastWorkspaceMtime) return;
    const raw = deps.readTextFile(deps.workspaceFile);
    if (raw === undefined) return;
    const settings = readAgentsWorkspaceThemeSettings(raw);
    if (settings === undefined) return;
    lastWorkspaceMtime = mtime;
    const resolved = resolvePublishedTheme({ settings, systemDark, findUiTheme, findThemeColors });
    const key = JSON.stringify(resolved);
    if (key === lastPublishedKey) return;
    try {
      await writeAgentThemeSnapshot(deps.stateDir, resolved);
    } catch {
      // Theme handoff is cosmetic; a locked state directory must never break the host.
      return;
    }
    lastPublishedKey = key;
  };
  const stopPolling = (() => {
    if (deps.setIntervalFn === undefined) return () => {};
    const handle = deps.setIntervalFn(() => void tick(), deps.pollMs ?? 2000);
    return () => deps.clearIntervalFn?.(handle);
  })();
  const stopSystemWatch = deps.onSystemThemeUpdated?.(() => void tick()) ?? (() => {});
  return {
    dispose: () => {
      disposed = true;
      stopPolling();
      stopSystemWatch();
    },
    tick,
  };
}
