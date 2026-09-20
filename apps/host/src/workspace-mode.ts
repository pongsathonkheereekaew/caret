/**
 * Opt-in workspace-mode suggestion.
 *
 * The host can already create a session in the plain checkout or in an isolated worktree, but
 * today the caller picks one before it knows what the request will do. This module answers one
 * narrow question ("would this request be risky to run in place?") so a client can offer a
 * safer default.
 *
 * It is additive on purpose: `CediaHost.createSession` keeps its exact behaviour, and nothing
 * here runs unless the operator sets `CEDIA_WORKSPACE_SUGGESTION=typesafe` *and* provides a
 * TypeSafe key. TypeSafe is a paid external service, so it stays an explicit opt-in rather than
 * a dependency the host acquires on its own. A judge that is slow, offline, or malformed
 * returns `undefined`, which callers must treat as "no opinion".
 */

export type WorkspaceMode = "local" | "worktree";

/** Environment switch that turns the integration on. Absent or any other value means off. */
export const WORKSPACE_SUGGESTION_ENV = "CEDIA_WORKSPACE_SUGGESTION";
export const WORKSPACE_SUGGESTION_MODE = "typesafe";
export const TYPESAFE_API_KEY_ENV = "TYPESAFE_API_KEY";
export const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const TYPESAFE_MODEL = "jev-latest";
/** Wall clock budget for a suggestion. Session creation must never wait on this. */
export const SUGGESTION_TIMEOUT_MS = 1_500;

export interface WorkspaceSuggestion {
  readonly mode: WorkspaceMode;
  /** Probability the model reported for the chosen mode, 0..1. */
  readonly probability: number;
  /** Difference between the two options, 0..1. Low values mean the question was a coin flip. */
  readonly confidence: number;
}

export interface WorkspaceJudge {
  suggest(prompt: string, signal?: AbortSignal): Promise<WorkspaceSuggestion | undefined>;
}

/**
 * One Noul question, so the answer is a probability rather than a label the code has to trust.
 * The wording keeps the two outcomes about consequences for the working tree, not about how
 * large the change is: a large edit to tracked files is still safe to run in place.
 */
export const WORKSPACE_QUESTION = {
  instructions:
    "Would running this request directly in the current git checkout risk losing work that is not committed, or leave the working tree in a state the user has to repair?",
  criteria: {
    true: "The work deletes or rewrites uncommitted state, or can leave the checkout unusable",
    false: "The work adds or edits tracked content in a way the user can review and revert normally",
  },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Map a yes/no probability onto a mode. The 0.5 line is the model's own midpoint. */
export function suggestionFromProbability(probability: number): WorkspaceSuggestion | undefined {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) return undefined;
  return {
    mode: probability >= 0.5 ? "worktree" : "local",
    probability,
    confidence: Math.abs(probability - 0.5) * 2,
  };
}

/** Parse the System One response, refusing anything that is not the shape we asked for. */
export function suggestionFromResponse(payload: unknown): WorkspaceSuggestion | undefined {
  if (!isRecord(payload) || !isRecord(payload.answers)) return undefined;
  const answer = payload.answers.isolation_needed;
  if (!isRecord(answer) || answer.type !== "noul") return undefined;
  return typeof answer.noul === "number" ? suggestionFromProbability(answer.noul) : undefined;
}

/** TypeSafe judge. Performs the network call; `suggestWorkspaceMode` owns the deadline. */
export function typesafeWorkspaceJudge(apiKey: string, endpoint: string = TYPESAFE_ENDPOINT): WorkspaceJudge {
  return {
    async suggest(prompt, signal) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          state: { task: { prompt } },
          model: TYPESAFE_MODEL,
          questions: { isolation_needed: { type: "noul", ...WORKSPACE_QUESTION } },
        }),
        ...(signal ? { signal } : {}),
      });
      if (!response.ok) return undefined;
      return suggestionFromResponse(await response.json());
    },
  };
}

/**
 * Ask the judge, and never let it break a caller: a timeout, a thrown error, or a malformed
 * answer all collapse to `undefined`.
 *
 * The deadline is enforced here rather than trusted to the judge: `Promise.race` settles even
 * when a judge ignores the abort signal, which is the difference between a slow suggestion and
 * a stalled caller.
 */
export async function suggestWorkspaceMode(
  judge: WorkspaceJudge,
  prompt: string,
  timeoutMs: number = SUGGESTION_TIMEOUT_MS,
): Promise<WorkspaceSuggestion | undefined> {
  if (prompt.trim().length === 0) return undefined;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<undefined>(resolve => {
    timer = setTimeout(() => { controller.abort(); resolve(undefined); }, timeoutMs);
  });
  try {
    return await Promise.race([judge.suggest(prompt, controller.signal), expired]);
  } catch {
    return undefined;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Build the judge only when the operator opted in and supplied a key. */
export function workspaceJudgeFromEnv(env: NodeJS.ProcessEnv): WorkspaceJudge | undefined {
  if (env[WORKSPACE_SUGGESTION_ENV] !== WORKSPACE_SUGGESTION_MODE) return undefined;
  const apiKey = env[TYPESAFE_API_KEY_ENV];
  return apiKey ? typesafeWorkspaceJudge(apiKey) : undefined;
}
