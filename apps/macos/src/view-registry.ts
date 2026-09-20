/** Registry for the workbench surfaces that render the Cedia task shell.
 *
 * The same shell can be open in the activity-bar view and in the secondary
 * side bar dock at the same time. A single `#view` field silently dropped
 * every snapshot for whichever surface resolved last, so a focus action or a
 * "Review in diff" render could update one panel and leave the other stale.
 * This keeps the fan-out rule in one place and testable.
 */

export class ViewRegistry<T> {
	readonly #views = new Set<T>();

	add(view: T): void {
		this.#views.add(view);
	}

	remove(view: T): void {
		this.#views.delete(view);
	}

	get size(): number {
		return this.#views.size;
	}

	/** Every currently resolved surface, in insertion order. */
	targets(): readonly T[] {
		return [...this.#views];
	}
}

/** A focus request that arrived before any surface existed yet. It is held
 * once and replayed when the first view resolves, so a keybinding pressed
 * while the dock is collapsed still focuses the composer when it appears. */
export class PendingFocus {
	#pending = false;

	request(): void {
		this.#pending = true;
	}

	/** Claim the pending focus. Returns true only for the first caller. */
	claim(): boolean {
		if (!this.#pending) return false;
		this.#pending = false;
		return true;
	}

	get isPending(): boolean {
		return this.#pending;
	}
}
