import { describe, expect, it } from "bun:test";
import {
	projectSessionFilterFields,
	SESSION_ENV_THIS_MAC,
	SESSION_PR_UNKNOWN,
	SESSION_SOURCE_OMP,
	sessionRowMeta,
} from "../src/session-row-meta.ts";

describe("sessionRowMeta", () => {
	it("defaults environment, source, and missing PR to This Mac / omp / Unknown", () => {
		const meta = sessionRowMeta({});
		expect(meta).toEqual({
			environment: SESSION_ENV_THIS_MAC,
			source: SESSION_SOURCE_OMP,
			pr: SESSION_PR_UNKNOWN,
			lines: ["This Mac", "OMP", "PR Unknown"],
		});
		expect(meta.lines.join(" ")).not.toMatch(/No PR/i);
		expect(meta.environment).not.toBe("Cloud");
		expect(meta.source).toBe("omp");
	});

	it("uses advertised environment, source, and PR without inventing remotes or numbers", () => {
		const meta = sessionRowMeta({
			environment: "This Mac",
			source: "omp",
			pr: "gh-42",
		});
		expect(meta.environment).toBe("This Mac");
		expect(meta.source).toBe("omp");
		expect(meta.pr).toBe("gh-42");
		expect(meta.lines).toEqual(["This Mac", "OMP", "PR gh-42"]);
		expect(meta.lines.join(" ")).not.toMatch(/No PR/i);
	});

	it("treats blank, unknown, and Unknown PR as Unknown and never emits No PR", () => {
		for (const pr of [null, "", "   ", "unknown", "Unknown", "UNKNOWN"] as const) {
			const meta = sessionRowMeta({ pr });
			expect(meta.pr).toBe(SESSION_PR_UNKNOWN);
			expect(meta.lines).toContain("PR Unknown");
			expect(JSON.stringify(meta)).not.toMatch(/No PR/i);
		}
	});

	it("adds advertised cwd as a secondary line and does not invent a branch", () => {
		const meta = sessionRowMeta({ cwd: "  /Users/pond/caret/task-a  " });
		expect(meta.lines).toEqual(["This Mac", "OMP", "PR Unknown", "/Users/pond/caret/task-a"]);
		expect(meta.lines.some((line) => /branch/i.test(line))).toBe(false);
	});

	it("treats whitespace-only environment and source as unset defaults", () => {
		const meta = sessionRowMeta({ environment: "  ", source: "\t" });
		expect(meta.environment).toBe(SESSION_ENV_THIS_MAC);
		expect(meta.source).toBe(SESSION_SOURCE_OMP);
		expect(meta.lines[0]).toBe("This Mac");
		expect(meta.lines[1]).toBe("OMP");
	});
});

describe("projectSessionFilterFields", () => {
	it("fills environment and source defaults and maps missing PR to null for isUnknownPr", () => {
		const projected = projectSessionFilterFields({ id: "task-1", title: "Draft" });
		expect(projected).toEqual({
			id: "task-1",
			title: "Draft",
			environment: SESSION_ENV_THIS_MAC,
			source: SESSION_SOURCE_OMP,
			pr: null,
		});
	});

	it("keeps a real advertised PR and still defaults unset environment/source", () => {
		const projected = projectSessionFilterFields({
			id: "task-2",
			pr: "gh-42",
			source: "  ",
		});
		expect(projected.environment).toBe(SESSION_ENV_THIS_MAC);
		expect(projected.source).toBe(SESSION_SOURCE_OMP);
		expect(projected.pr).toBe("gh-42");
	});

	it("maps unknown PR labels to null so the sidebar unknown filter can match", () => {
		expect(projectSessionFilterFields({ pr: "unknown" }).pr).toBeNull();
		expect(projectSessionFilterFields({ pr: "Unknown" }).pr).toBeNull();
		expect(projectSessionFilterFields({ pr: "" }).pr).toBeNull();
		expect(projectSessionFilterFields({ pr: null }).pr).toBeNull();
	});
});
