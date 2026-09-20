import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RPC_COMMAND_TYPES } from "../src/types.ts";

describe("OMP RPC inventory lock", () => {
	it("keeps the adapter command tuple identical to the pinned source inventory", () => {
		const inventory = JSON.parse(readFileSync(join(import.meta.dir, "../../../docs/maintenance/evidence/omp-rpc-2026-09-12/source-inventory.json"), "utf8")) as { rpcCommands: string[] };
		expect([...RPC_COMMAND_TYPES] as string[]).toEqual(inventory.rpcCommands);
		expect(RPC_COMMAND_TYPES).toHaveLength(42);
	});
});
