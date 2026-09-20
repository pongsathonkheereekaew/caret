/**
 * What a refused command means. The host refuses before claiming, so nothing was
 * dispatched: a refresh-and-retry cannot double-send a mutation.
 */
export type CommandFailurePlan = "refresh_and_retry" | "surface_recovery" | "unknown";

function failureCode(error: unknown): unknown {
  return typeof error === "object" && error !== null && "code" in error ? (error as { readonly code?: unknown }).code : undefined;
}

/**
 * Classify a command failure using only the host's duck-typed `code` field. Plain
 * errors (network, transport, timeout) and non-string codes have an ambiguous or
 * non-host cause, so they stay unknown.
 */
export function commandFailurePlan(error: unknown, attempt = 1): CommandFailurePlan {
  const code = failureCode(error);
  if (code === "stale_incarnation" || code === "session_starting") return attempt < 2 ? "refresh_and_retry" : "unknown";
  if (code === "recovery_required") return "surface_recovery";
  return "unknown";
}
