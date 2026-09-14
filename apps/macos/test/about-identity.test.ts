import { describe, expect, it } from "bun:test";
import { aboutIdentity, type AboutRow } from "../src/about-identity.ts";

const UNAVAILABLE = "Unavailable — not advertised on this build.";
const ABOUT_IDS = ["caret", "extension", "codeoss", "omp", "protocol", "sourceHash", "updates"] as const;

function byId(rows: readonly AboutRow[], id: string): AboutRow {
	const found = rows.find((row) => row.id === id);
	if (!found) throw new Error(`missing about row ${id}`);
	return found;
}

describe("aboutIdentity", () => {
	it("keeps missing OMP unavailable and does not invent a marketed version", () => {
		const rows = aboutIdentity({ caretVersion: "0.1.0" });
		expect(rows.map((row) => row.id)).toEqual([...ABOUT_IDS]);
		expect(byId(rows, "omp")).toEqual({
			id: "omp",
			label: "OMP version",
			value: UNAVAILABLE,
			claim: "unavailable",
		});
		expect(byId(rows, "caret")).toEqual({
			id: "caret",
			label: "Caret build",
			value: "0.1.0",
			claim: "advertised",
		});
		expect(byId(rows, "updates")).toEqual({
			id: "updates",
			label: "Updates",
			value: "Update check is read-only. Install is not claimed for this ad-hoc build.",
			claim: "unavailable",
		});
		expect(rows.some((row) => /notariz|latest|1\.0\.0/i.test(row.value) && row.id !== "caret")).toBe(false);
	});

	it("passes provided versions through without claiming install", () => {
		const rows = aboutIdentity({
			caretVersion: "0.2.0",
			extensionVersion: "0.2.0-ext",
			codeOssVersion: "1.96.0",
			ompVersion: "0.4.1",
			protocolVersion: "1",
			sourceHash: "abc123def",
			connection: "online",
		});
		expect(byId(rows, "extension")).toMatchObject({ value: "0.2.0-ext", claim: "advertised" });
		expect(byId(rows, "codeoss")).toMatchObject({ value: "1.96.0", claim: "advertised" });
		expect(byId(rows, "omp")).toMatchObject({ value: "0.4.1", claim: "advertised" });
		expect(byId(rows, "protocol")).toMatchObject({ value: "1", claim: "advertised" });
		expect(byId(rows, "sourceHash")).toMatchObject({ value: "abc123def", claim: "advertised" });
		expect(byId(rows, "updates").claim).toBe("unavailable");
		expect(rows.some((row) => row.id === "connection")).toBe(false);
	});
});
