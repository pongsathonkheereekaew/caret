import { describe, expect, it } from "bun:test";
import { filterBranchHits, parseGitBranchList } from "../src/branch-picker.ts";

describe("parseGitBranchList", () => {
	it("marks current, local, and remote refs without inventing main", () => {
		const hits = parseGitBranchList("* feat/s18\n  notes\n  remotes/origin/feat/s18\n  remotes/origin/HEAD -> origin/feat/s18\n");
		expect(hits.map(item => item.name)).toEqual(["feat/s18", "notes", "origin/feat/s18"]);
		expect(hits[0]).toMatchObject({ kind: "current", current: true });
		expect(hits[1]).toMatchObject({ kind: "local", current: false });
		expect(hits[2]).toMatchObject({ kind: "remote", current: false });
		expect(hits.every(item => item.name !== "main")).toBe(true);
	});
});

describe("filterBranchHits", () => {
	const hits = parseGitBranchList("* feat/s18\n  notes\n  remotes/origin/feat/s18\n");

	it("stays empty-query honest and does not invent a hit", () => {
		const all = filterBranchHits(hits, "  ");
		expect(all.noMatch).toBe(false);
		expect(all.hits).toHaveLength(3);
		expect(all.current).toBe("feat/s18");
	});

	it("returns no-match without selecting a stale row", () => {
		expect(filterBranchHits(hits, "caret-no-ref-137", true)).toMatchObject({
			noMatch: true,
			hits: [],
			loading: true,
		});
	});
});
