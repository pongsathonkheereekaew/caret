import { describe, expect, it } from "bun:test";
import {
	applySettingsSection,
	beginSettingsDraft,
	nextSettingsRevision,
	previewResetOverride,
	SETTINGS_APPLY_SCOPE_REASON,
	SETTINGS_APPLY_STALE_REASON,
	SETTINGS_SCOPES,
	settingsScopeWritable,
	settingsSourcePath,
} from "../src/settings-revision.ts";

describe("SETTINGS_SCOPES", () => {
	it("advertises global, project, and session", () => {
		expect([...SETTINGS_SCOPES]).toEqual(["global", "project", "session"]);
	});
});

describe("settingsSourcePath", () => {
	it("labels global as this Mac product prefs", () => {
		expect(settingsSourcePath("global")).toBe("this Mac · product prefs");
	});

	it("marks project and session read-only until a scoped write contract exists", () => {
		expect(settingsSourcePath("project")).toBe(
			"OMP project config (read-only until a scoped write contract exists)",
		);
		expect(settingsSourcePath("session")).toBe(
			"OMP session config (read-only until a scoped write contract exists)",
		);
	});
});

describe("settingsScopeWritable", () => {
	it("allows only global writes from this helper", () => {
		expect(settingsScopeWritable("global")).toBe(true);
		expect(settingsScopeWritable("project")).toBe(false);
		expect(settingsScopeWritable("session")).toBe(false);
	});
});

describe("beginSettingsDraft", () => {
	it("defaults scope to global and snapshots values for local edit", () => {
		const values = { density: "comfortable" };
		const draft = beginSettingsDraft("Appearance", 3, values);
		expect(draft).toEqual({
			section: "Appearance",
			revision: 3,
			values: { density: "comfortable" },
			scope: "global",
		});
		values.density = "detailed";
		expect(draft.values.density).toBe("comfortable");
	});

	it("keeps project and session drafts presentable without making them writable", () => {
		const project = beginSettingsDraft("Agents/OMP", 1, { model: "advertised" }, "project");
		const session = beginSettingsDraft("Agents/OMP", 1, { model: "advertised" }, "session");
		expect(project.scope).toBe("project");
		expect(session.scope).toBe("session");
		expect(settingsScopeWritable(project.scope)).toBe(false);
		expect(settingsScopeWritable(session.scope)).toBe(false);
	});
});

describe("applySettingsSection", () => {
	it("applies a matching global draft and increments revision", () => {
		const draft = beginSettingsDraft("Appearance", 2, { theme: "dark" });
		expect(applySettingsSection(2, draft)).toEqual({
			ok: true,
			revision: 3,
			values: { theme: "dark" },
		});
	});

	it("rejects stale revisions so Apply keeps the draft and old active value", () => {
		const draft = beginSettingsDraft("Appearance", 1, { theme: "dark" });
		expect(applySettingsSection(2, draft)).toEqual({
			ok: false,
			reason: SETTINGS_APPLY_STALE_REASON,
		});
		expect(SETTINGS_APPLY_STALE_REASON).toBe("Config changed — reload before Apply.");
	});

	it("does not advertise project or session writes even when the revision matches", () => {
		const project = beginSettingsDraft("Agents/OMP", 4, { model: "x" }, "project");
		const session = beginSettingsDraft("Notifications", 0, { sound: "off" }, "session");
		expect(applySettingsSection(4, project)).toEqual({
			ok: false,
			reason: SETTINGS_APPLY_SCOPE_REASON,
		});
		expect(applySettingsSection(9, session)).toEqual({
			ok: false,
			reason: SETTINGS_APPLY_SCOPE_REASON,
		});
		expect(SETTINGS_APPLY_SCOPE_REASON).toBe("Project and session writes are not advertised.");
	});
});

describe("previewResetOverride", () => {
	it("previews the inherited value and names only the selected override to remove", () => {
		expect(previewResetOverride("density", "detailed", "comfortable")).toEqual({
			key: "density",
			current: "detailed",
			inherited: "comfortable",
			removes: "density",
		});
	});
});

describe("nextSettingsRevision", () => {
	it("increments a non-negative integer", () => {
		expect(nextSettingsRevision(0)).toBe(1);
		expect(nextSettingsRevision(11)).toBe(12);
	});

	it("increments safely to an integer >= 0", () => {
		expect(nextSettingsRevision(-4)).toBe(0);
		expect(nextSettingsRevision(-0.2)).toBe(1);
		expect(nextSettingsRevision(Number.NaN)).toBe(0);
		expect(nextSettingsRevision(Number.POSITIVE_INFINITY)).toBe(0);
		expect(nextSettingsRevision(2.8)).toBe(3);
		expect(nextSettingsRevision(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
	});
});
