import { describe, expect, it } from "bun:test";
import { isProcessAlive, shouldStopHost, type HostLifetimeState } from "../src/host-lifetime.ts";

/*
 * The host is started detached, so nothing reaps it: before this rule a closed
 * Cedia left `cli.js serve` running with PPID 1 until the machine rebooted, which
 * is what "Cedia keeps running after I close it" was.
 */

const now = 1_700_000_000_000;

function state(patch: Partial<HostLifetimeState> = {}): HostLifetimeState {
	return {
		parentPid: 4242,
		parentAlive: false,
		lastRequestAt: now - 120_000,
		now,
		idleMs: 60_000,
		runningSessions: 0,
		remotePaired: false,
		...patch,
	};
}

describe("host lifetime", () => {
	it("stops an orphaned host that nobody has reached for the idle window", () => {
		expect(shouldStopHost(state())).toBe(true);
	});

	it("keeps running while the app that started it is alive", () => {
		expect(shouldStopHost(state({ parentAlive: true, lastRequestAt: now - 3_600_000 }))).toBe(false);
	});

	it("keeps running while a session is in flight", () => {
		expect(shouldStopHost(state({ runningSessions: 1 }))).toBe(false);
	});

	it("keeps running while a phone or relay client is paired", () => {
		expect(shouldStopHost(state({ remotePaired: true }))).toBe(false);
	});

	it("waits out the idle window instead of stopping the moment the app goes", () => {
		expect(shouldStopHost(state({ lastRequestAt: now - 1_000 }))).toBe(false);
		expect(shouldStopHost(state({ lastRequestAt: now - 60_000 }))).toBe(true);
	});

	it("leaves a host a person started by hand alone", () => {
		// `cli.js serve` with no parent is a deliberate daemon.
		expect(shouldStopHost(state({ parentPid: undefined, lastRequestAt: 0 }))).toBe(false);
	});

	it("tells a live process from a dead one", () => {
		expect(isProcessAlive(process.pid)).toBe(true);
		// A pid that cannot be live: the maximum pid plus one.
		expect(isProcessAlive(99_999_999)).toBe(false);
		expect(isProcessAlive(0)).toBe(false);
		expect(isProcessAlive(-1)).toBe(false);
	});
});
