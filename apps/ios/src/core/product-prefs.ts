/** Product presentation prefs (S16 / D13). These do not start or stop OMP. */

export const PRODUCT_DENSITIES = ["comfortable", "detailed"] as const;
export type ProductDensity = (typeof PRODUCT_DENSITIES)[number];
export type WorkPanelPosition = "right" | "bottom";

export const SETTINGS_SCOPES = ["global", "project", "session"] as const;
export type SettingsScope = (typeof SETTINGS_SCOPES)[number];

export const SETTINGS_APPLY_SCOPE_REASON = "Project and session writes are not advertised.";
export const SETTINGS_APPLY_STALE_REASON = "Config changed — reload before Apply.";
export const APPEARANCE_SETTINGS_SOURCE = "this iPhone · product prefs";

export interface ProductPrefs {
  readonly density: ProductDensity;
  readonly panelPosition: WorkPanelPosition;
  readonly submitEnter: boolean;
  readonly reduceMotion: boolean;
  readonly highContrast: boolean;
}

export interface AppearanceValues {
  readonly density: ProductDensity;
  readonly reduceMotion: boolean;
  readonly highContrast: boolean;
}

export interface AppearanceDraft {
  readonly section: "Appearance";
  readonly revision: number;
  readonly values: AppearanceValues;
  readonly scope: SettingsScope;
}

export type ApplyAppearanceResult =
  | { readonly ok: false; readonly reason: string }
  | { readonly ok: true; readonly revision: number; readonly values: AppearanceValues };

export interface ResetOverridePreview {
  readonly key: string;
  readonly current: unknown;
  readonly inherited: unknown;
  readonly removes: string;
}

export const DEFAULT_PRODUCT_PREFS: ProductPrefs = {
  density: "comfortable",
  panelPosition: "right",
  submitEnter: true,
  reduceMotion: false,
  highContrast: false,
};

export function normalizeProductPrefs(value: unknown): ProductPrefs {
  if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_PRODUCT_PREFS;
  const record = value as Record<string, unknown>;
  return {
    density: record.density === "detailed" ? "detailed" : "comfortable",
    panelPosition: record.panelPosition === "bottom" ? "bottom" : "right",
    submitEnter: record.submitEnter !== false,
    reduceMotion: record.reduceMotion === true,
    highContrast: record.highContrast === true,
  };
}

export function applyProductPref(prefs: ProductPrefs, patch: Partial<ProductPrefs>): ProductPrefs {
  return normalizeProductPrefs({ ...prefs, ...patch });
}

export function settingsSourcePath(scope: SettingsScope = "global"): string {
  return scope === "global" ? APPEARANCE_SETTINGS_SOURCE : SETTINGS_APPLY_SCOPE_REASON;
}

export function settingsScopeWritable(scope: SettingsScope): boolean {
  return scope === "global";
}

export function appearanceValues(value: unknown): AppearanceValues {
  const prefs = normalizeProductPrefs(value);
  return { density: prefs.density, reduceMotion: prefs.reduceMotion, highContrast: prefs.highContrast };
}

export function resolveAppearancePrefs(active: ProductPrefs, draft?: AppearanceDraft | null): ProductPrefs {
  return draft ? applyProductPref(active, draft.values) : active;
}

/** OS Reduce Motion wins even if the user draft is off. */
export function effectiveReduceMotion(osEnabled: boolean, userEnabled: boolean): boolean {
  return Boolean(osEnabled) || Boolean(userEnabled);
}

export function beginAppearanceDraft(revision: number, values: unknown): AppearanceDraft {
  return {
    section: "Appearance",
    revision,
    values: appearanceValues(values),
    scope: "global",
  };
}

export function applyAppearanceDraft(activeRevision: number, draft: AppearanceDraft): ApplyAppearanceResult {
  if (draft.scope !== "global") {
    return { ok: false, reason: SETTINGS_APPLY_SCOPE_REASON };
  }
  if (draft.revision !== activeRevision) {
    return { ok: false, reason: SETTINGS_APPLY_STALE_REASON };
  }
  return { ok: true, revision: activeRevision + 1, values: appearanceValues(draft.values) };
}

export function previewResetOverride(key: string, current: unknown, inherited: unknown): ResetOverridePreview {
  return { key, current, inherited, removes: key };
}
