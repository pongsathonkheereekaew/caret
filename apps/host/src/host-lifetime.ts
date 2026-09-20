/**
 * When a Cedia host should stop on its own.
 *
 * The host is started detached so it can outlive the short-lived launcher, which
 * also means nothing reaps it: closing Cedia used to leave `cli.js serve` running
 * with PPID 1 until the machine rebooted. A host that a person started by hand
 * (`cli.js serve`, no parent) is a deliberate daemon and is left alone; a host the
 * app started is tied to that app.
 */

export interface HostLifetimeState {
	/** The process that started this host, when it was started by the app. */
	readonly parentPid: number | undefined;
	readonly parentAlive: boolean;
	/** When any client last reached the host, in epoch ms. */
	readonly lastRequestAt: number;
	readonly now: number;
	/** Quiet time after the parent is gone before the host stops. */
	readonly idleMs: number;
	/** OMP work in flight is the host's reason to exist; it always wins. */
	readonly runningSessions: number;
	/** A paired phone or relay client may reconnect, so the host stays. */
	readonly remotePaired: boolean;
}

export function shouldStopHost(state: HostLifetimeState): boolean {
	// No parent means a deliberate `serve`: leave it running.
	if (state.parentPid === undefined) return false;
	if (state.parentAlive) return false;
	if (state.runningSessions > 0) return false;
	if (state.remotePaired) return false;
	return state.now - state.lastRequestAt >= state.idleMs;
}

export function isProcessAlive(pid: number): boolean {
	if (!Number.isInteger(pid) || pid <= 0) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		// EPERM means the process exists but belongs to someone else.
		return (error as NodeJS.ErrnoException)?.code === "EPERM";
	}
}
