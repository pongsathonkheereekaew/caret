// Shared reading of an OMP command result.
//
// A mutating request only counts when the host confirmed it. `acknowledged`
// covers turn commands, which the host acknowledges before the agent replies.
// Everything else - including a swallowed transport error, which surfaces as
// `undefined` - means the change did not happen, and the caller owes the user
// an explanation instead of a silent no-op.

export interface OmpCommandStatusLike {
	readonly status?: string;
}

export function ompCommandConfirmed<T extends OmpCommandStatusLike>(result: T | undefined): result is T {
	return !!result && (result.status === "completed" || result.status === "acknowledged");
}

export const THINKING_NOT_APPLIED_REASON =
	"Caret could not change the thinking level: OMP did not confirm it. The previous level is still in effect.";
export const FORK_NOT_CREATED_REASON =
	"Caret could not fork this task: OMP did not confirm the new session. The original task is unchanged.";
