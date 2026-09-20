// FILE: ide-mode.ts
// Purpose: Small runtime seam shared by the IDE webview and the standalone agent UI.
// Layer: Web shell mode detection and IDE handoff helpers
// Depends on: the host-owned acquireVsCodeApi bridge installed by ide-bootstrap.ts.

export interface CediaIdeContext {
  readonly cwd: string | null;
  readonly sessionId?: string;
}

export interface CediaIdeBridge {
  invoke: (channel: string, input?: unknown) => Promise<unknown>;
}

declare global {
  interface Window {
    /** Set by the IDE webview bootstrap before the shared app is imported. */
    __CEDIA_IDE_EMBEDDED__?: boolean;
    /** The context sent by the IDE host (and refreshed when the active session changes). */
    __CEDIA_IDE_CONTEXT__?: CediaIdeContext;
    /** The narrow bridge exposed by ide-bootstrap; kept out of NativeApi on purpose. */
    __CEDIA_IDE_BRIDGE__?: CediaIdeBridge;
    /** Cross-window draft writes that must settle before a handoff. */
    __CEDIA_DRAFT_FLUSH__?: () => Promise<void>;
  }
}

/** Read the flag at call time so tests and the webview host can set it before a render. */
export function isIdeEmbeddedRuntime(): boolean {
  return typeof window !== "undefined" && window.__CEDIA_IDE_EMBEDDED__ === true;
}

/** Snapshot the latest host context without exposing the transport to UI components. */
export function readIdeContext(): CediaIdeContext {
  if (typeof window === "undefined") return { cwd: null };
  const context = window.__CEDIA_IDE_CONTEXT__;
  return {
    cwd: typeof context?.cwd === "string" && context.cwd.length > 0 ? context.cwd : null,
    ...(typeof context?.sessionId === "string" && context.sessionId.length > 0
      ? { sessionId: context.sessionId }
      : {}),
  };
}

/**
 * Ask the owning IDE window to reveal the same thread in the standalone Agents Window.
 * The host validates the session id and cwd; the UI only sends the current route/context.
 */
export async function openAgentsWindowFromIde(): Promise<void> {
  if (typeof window === "undefined" || !window.__CEDIA_IDE_BRIDGE__) {
    throw new Error("Cedia IDE bridge is unavailable");
  }
  await window.__CEDIA_DRAFT_FLUSH__?.();
  const context = readIdeContext();
  const routeSessionId = decodeSessionIdFromHash(window.location.hash);
  await window.__CEDIA_IDE_BRIDGE__.invoke("vscode:cediaAgent", {
    kind: "openAgents",
    ...(routeSessionId ? { sessionId: routeSessionId } : context.sessionId ? { sessionId: context.sessionId } : {}),
    ...(context.cwd ? { cwd: context.cwd } : {}),
  });
}

/** Hash history stores a session route as `#/thread-id`; reject arbitrary paths. */
export function decodeSessionIdFromHash(hash: string): string | null {
  const route = hash.replace(/^#/, "").replace(/^\/+/, "").split(/[/?#]/, 1)[0] ?? "";
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(route)) return null;
  return route;
}
