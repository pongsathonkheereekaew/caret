import { describe, expect, it } from "bun:test";
import {
	CLONE_LABEL,
	CLONE_UNAVAILABLE_REASON,
	MISSING_RECENT_REASON,
	NEW_TASK_WELCOME_LABEL,
	OPEN_FOLDER_LABEL,
	projectsWelcomeModel,
	recentDisplayName,
} from "../src/projects-welcome.ts";

function modelText(model: ReturnType<typeof projectsWelcomeModel>): string {
	return JSON.stringify(model);
}

describe("projectsWelcomeModel", () => {
	it("disables clone by default and does not invent advertised=true", () => {
		const model = projectsWelcomeModel();
		expect(model.title).toBe("Projects");
		expect(model.kicker).toBe("WELCOME");
		expect(model.recents).toEqual([]);
		expect(model.actions).toEqual([
			{ id: "open_folder", label: OPEN_FOLDER_LABEL, enabled: true },
			{ id: "clone", label: CLONE_LABEL, enabled: false, reason: CLONE_UNAVAILABLE_REASON },
			{ id: "new_task", label: NEW_TASK_WELCOME_LABEL, enabled: true },
		]);
		expect(model.actions.find((action) => action.id === "clone")?.enabled).toBe(false);
		expect(modelText(model)).not.toMatch(/https?:\/\//);
		expect(modelText(model)).not.toMatch(/github\.com|gitlab\.com|git@/);
	});

	it("enables clone only when advertised and does not invent a URL", () => {
		const model = projectsWelcomeModel({ cloneAdvertised: true });
		const clone = model.actions.find((action) => action.id === "clone");
		expect(clone).toEqual({ id: "clone", label: CLONE_LABEL, enabled: true });
		expect(clone).not.toHaveProperty("url");
		expect(model.actions.find((action) => action.id === "open_folder")?.enabled).toBe(true);
		expect(model.actions.find((action) => action.id === "new_task")?.enabled).toBe(true);
		expect(modelText(model)).not.toMatch(/https?:\/\//);
		expect(modelText(model)).not.toMatch(/github\.com|gitlab\.com|git@/);
	});

	it("keeps a missing recent visible and not openable", () => {
		const model = projectsWelcomeModel({
			recents: [
				{ path: "/Users/pond/gone", name: "gone", missing: true },
				{ path: "/Users/pond/caret", name: "caret" },
			],
		});
		expect(model.recents).toHaveLength(2);
		expect(model.recents[0]).toEqual({
			path: "/Users/pond/gone",
			name: "gone",
			missing: true,
			openable: false,
			reason: MISSING_RECENT_REASON,
		});
		expect(model.recents[1]).toEqual({
			path: "/Users/pond/caret",
			name: "caret",
			missing: false,
			openable: true,
		});
		expect(model.recents.some((recent) => recent.path.includes("nearby") || recent.name === "replacement")).toBe(false);
	});

	it("uses Folder for an empty path and derives the last non-empty segment", () => {
		expect(recentDisplayName("")).toBe("Folder");
		expect(recentDisplayName("/")).toBe("Folder");
		expect(recentDisplayName("/Users/pond/caret/")).toBe("caret");
		const model = projectsWelcomeModel({ recents: [{ path: "" }] });
		expect(model.recents[0]?.name).toBe("Folder");
	});

	it("never includes Cloud in the welcome model", () => {
		const model = projectsWelcomeModel({
			recents: [{ path: "/Users/pond/caret" }],
			cloneAdvertised: true,
		});
		expect(modelText(model)).not.toMatch(/cloud/i);
		expect(model.actions.some((action) => /cloud/i.test(action.id) || /cloud/i.test(action.label))).toBe(false);
	});
});
