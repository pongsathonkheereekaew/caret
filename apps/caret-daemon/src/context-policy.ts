// SEARCH-05: ignore policy and sandbox/tool policy are separate systems.
// Being ignored never grants a tool; being attachable never bypasses sandbox.

export type ContextDecision = "attach" | "ignored" | "denied";

export interface ContextInput {
  readonly ignored: boolean;
  readonly sandboxDenied: boolean;
}

export const decideAttach = (input: ContextInput): ContextDecision => {
  if (input.ignored) return "ignored";
  if (input.sandboxDenied) return "denied";
  return "attach";
};

export const canAttachToPrompt = (input: ContextInput): boolean => decideAttach(input) === "attach";

/** Tool execution is sandbox-only. Ignore files do not authorize or deny tools. */
export const canRunTool = (sandboxDenied: boolean): boolean => !sandboxDenied;
