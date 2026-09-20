import { describe, expect, it } from "bun:test";
import { moveProviderInOrder } from "../vendor/synara/apps/web/src/providerOrdering";

describe("provider picker ordering", () => {
	it("moves one provider while preserving every other provider", () => {
		expect(moveProviderInOrder(["omp", "codex", "cursor"], "cursor", "omp")).toEqual([
			"cursor",
			"omp",
			"codex",
		]);
	});
});
