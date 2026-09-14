import { describe, expect, it } from "bun:test";
import { settingsHits, type SettingsHit } from "../src/settings-hits.ts";

const ROWS: readonly SettingsHit[] = [
	{
		id: "density",
		section: "Appearance",
		label: "Conversation density",
		description: "Comfortable or Detailed. Presentation only.",
	},
	{
		id: "theme",
		section: "Appearance",
		label: "Theme",
		description: "Follow Code-OSS.",
	},
];

describe("settingsHits", () => {
	it("returns no hits for an empty query", () => {
		expect(settingsHits("", ROWS)).toEqual([]);
		expect(settingsHits("   ", ROWS)).toEqual([]);
	});

	it("hits Appearance density from label, description, or section", () => {
		expect(settingsHits("density", ROWS).map((row) => row.id)).toEqual(["density"]);
		expect(settingsHits("DENSITY", ROWS)[0]?.label).toBe("Conversation density");
		expect(settingsHits("comfortable", ROWS).map((row) => row.id)).toEqual(["density"]);
		expect(settingsHits("appearance", ROWS).map((row) => row.id)).toEqual(["density", "theme"]);
	});

	it("does not invent a Cloud setting when it is not in the rows", () => {
		expect(settingsHits("cloud", ROWS)).toEqual([]);
		expect(settingsHits("cloud", ROWS).some((row) => /cloud/i.test(row.section) || /cloud/i.test(row.label))).toBe(false);
	});
});
