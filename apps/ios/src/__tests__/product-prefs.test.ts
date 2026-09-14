import { describe, expect, test } from "bun:test";
import {
  APPEARANCE_SETTINGS_SOURCE,
  applyAppearanceDraft,
  applyProductPref,
  beginAppearanceDraft,
  DEFAULT_PRODUCT_PREFS,
  effectiveReduceMotion,
  normalizeProductPrefs,
  previewResetOverride,
  resolveAppearancePrefs,
  SETTINGS_APPLY_SCOPE_REASON,
  SETTINGS_APPLY_STALE_REASON,
  SETTINGS_SCOPES,
  settingsScopeWritable,
  settingsSourcePath,
} from "../core/product-prefs.ts";

describe("product prefs", () => {
  test("defaults to comfortable density and does not invent a theme", () => {
    expect(normalizeProductPrefs(undefined)).toEqual(DEFAULT_PRODUCT_PREFS);
    expect(normalizeProductPrefs(null)).toEqual(DEFAULT_PRODUCT_PREFS);
    expect(normalizeProductPrefs([])).toEqual(DEFAULT_PRODUCT_PREFS);
    expect(normalizeProductPrefs({ density: "compact", submitEnter: false }).density).toBe("comfortable");
    expect(normalizeProductPrefs({ density: "detailed" }).density).toBe("detailed");
  });

  test("applyProductPref patches without starting or stopping OMP fields", () => {
    expect(applyProductPref(DEFAULT_PRODUCT_PREFS, { reduceMotion: true, density: "detailed" })).toEqual({
      density: "detailed",
      panelPosition: "right",
      submitEnter: true,
      reduceMotion: true,
      highContrast: false,
    });
    expect(applyProductPref(DEFAULT_PRODUCT_PREFS, { panelPosition: "bottom", submitEnter: false })).toEqual({
      density: "comfortable",
      panelPosition: "bottom",
      submitEnter: false,
      reduceMotion: false,
      highContrast: false,
    });
    expect(applyProductPref(DEFAULT_PRODUCT_PREFS, { density: "detailed" })).not.toHaveProperty("omp");
  });
});

describe("appearance source and scopes", () => {
  test("labels global as this iPhone product prefs", () => {
    expect(settingsSourcePath("global")).toBe("this iPhone · product prefs");
    expect(APPEARANCE_SETTINGS_SOURCE).toBe("this iPhone · product prefs");
  });

  test("does not advertise project or session writes", () => {
    expect([...SETTINGS_SCOPES]).toEqual(["global", "project", "session"]);
    expect(settingsScopeWritable("global")).toBe(true);
    expect(settingsScopeWritable("project")).toBe(false);
    expect(settingsScopeWritable("session")).toBe(false);
    expect(settingsSourcePath("project")).toBe(SETTINGS_APPLY_SCOPE_REASON);
    expect(settingsSourcePath("session")).toBe(SETTINGS_APPLY_SCOPE_REASON);
    expect(SETTINGS_APPLY_SCOPE_REASON).toBe("Project and session writes are not advertised.");
  });
});

describe("beginAppearanceDraft", () => {
  test("snapshots values for a local Appearance draft", () => {
    const values = { density: "detailed" as const, reduceMotion: true };
    const draft = beginAppearanceDraft(3, values);
    expect(draft).toEqual({
      section: "Appearance",
      revision: 3,
      values: { density: "detailed", reduceMotion: true, highContrast: false },
      scope: "global",
    });
    values.density = "comfortable";
    values.reduceMotion = false;
    expect(draft.values).toEqual({ density: "detailed", reduceMotion: true, highContrast: false });
  });
});

describe("applyAppearanceDraft", () => {
  test("applies a matching global draft and increments revision", () => {
    const draft = beginAppearanceDraft(2, { density: "detailed", reduceMotion: true });
    expect(applyAppearanceDraft(2, draft)).toEqual({
      ok: true,
      revision: 3,
      values: { density: "detailed", reduceMotion: true, highContrast: false },
    });
  });

  test("rejects a stale revision so Apply keeps the draft and old active value", () => {
    const active = DEFAULT_PRODUCT_PREFS;
    const draft = beginAppearanceDraft(1, { density: "detailed", reduceMotion: true });
    expect(applyAppearanceDraft(2, draft)).toEqual({
      ok: false,
      reason: SETTINGS_APPLY_STALE_REASON,
    });
    expect(SETTINGS_APPLY_STALE_REASON).toBe("Config changed — reload before Apply.");
    expect(draft.values.density).toBe("detailed");
    expect(active.density).toBe("comfortable");
  });

  test("does not advertise project or session writes even when the revision matches", () => {
    const base = beginAppearanceDraft(4, { density: "detailed" });
    expect(applyAppearanceDraft(4, { ...base, scope: "project" })).toEqual({
      ok: false,
      reason: SETTINGS_APPLY_SCOPE_REASON,
    });
    expect(applyAppearanceDraft(4, { ...base, scope: "session" })).toEqual({
      ok: false,
      reason: SETTINGS_APPLY_SCOPE_REASON,
    });
  });
});

describe("previewResetOverride", () => {
  test("previews inherited comfortable density and updates only that override", () => {
    expect(previewResetOverride("density", "detailed", DEFAULT_PRODUCT_PREFS.density)).toEqual({
      key: "density",
      current: "detailed",
      inherited: "comfortable",
      removes: "density",
    });
  });

  test("previews inherited reduceMotion false and updates only that override", () => {
    expect(previewResetOverride("reduceMotion", true, DEFAULT_PRODUCT_PREFS.reduceMotion)).toEqual({
      key: "reduceMotion",
      current: true,
      inherited: false,
      removes: "reduceMotion",
    });
  });
});

describe("appearance draft overlay and OS motion", () => {
  test("resolveAppearancePrefs keeps active values until a draft exists", () => {
    const active = applyProductPref(DEFAULT_PRODUCT_PREFS, { density: "comfortable", reduceMotion: false });
    const draft = beginAppearanceDraft(0, { density: "detailed", reduceMotion: true });
    expect(resolveAppearancePrefs(active)).toEqual(active);
    expect(resolveAppearancePrefs(active, draft)).toEqual({
      density: "detailed",
      panelPosition: "right",
      submitEnter: true,
      reduceMotion: true,
      highContrast: false,
    });
  });

  test("OS Reduce Motion wins even if the user draft is off", () => {
    expect(effectiveReduceMotion(true, false)).toBe(true);
    expect(effectiveReduceMotion(true, true)).toBe(true);
    expect(effectiveReduceMotion(false, false)).toBe(false);
    expect(effectiveReduceMotion(false, true)).toBe(true);
  });
});
