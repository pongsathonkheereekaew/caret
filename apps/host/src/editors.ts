import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import type { EditorRequest, EditorResponse } from "../../../packages/protocol/src/editor.ts";
import { isUntitledEditorPath } from "../../../packages/protocol/src/editor.ts";
import { within, workspacePath } from "./workspaces.ts";

interface EditorClient { id: string; roots: string[]; lastSeen: number }
interface PendingEdit { clientId: string; request: EditorRequest; sent: boolean; deadline: number; resolve: (value: EditorResponse) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout>; cleanup: () => void }
/** Maximum number of workspace roots retained for this editor bridge incarnation. */
export const MAX_REGISTERED_EDITOR_ROOTS = 10_000;
/** Owner-only native editor channel; a request is delivered once and never replayed after a lost result. */
export class EditorConnections {
  readonly #clients = new Map<string, EditorClient>();
  readonly #pending = new Map<string, PendingEdit>();
  /**
   * Roots are deliberately retained after a window expires or disconnects.
   * Headless disk writes must not become possible merely because the editor UI
   * disappeared; this set is bounded by MAX_REGISTERED_EDITOR_ROOTS.
   */
  readonly #registeredRoots = new Set<string>();
  hasConnection(cwd: string): boolean {
    const root = realpathSync(cwd);
    return [...this.#clients.values()].some(client => Date.now() - client.lastSeen < 5000 && client.roots.some(candidate => within(candidate, root)));
  }
  /** Return whether this bridge incarnation has ever registered a workspace overlapping cwd. */
  hasRegisteredWorkspace(cwd: string): boolean {
    let root: string;
    try { root = realpathSync(cwd); } catch { return false; }
    return [...this.#registeredRoots].some(candidate => within(candidate, root) || within(root, candidate));
  }
  register(id: string, roots: string[]) {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id) || roots.length > 100) throw new Error("Invalid editor registration");
    // Resolve and capacity-check all roots before pruning clients or changing
    // either registry. A failed registration is therefore mutation-free.
    const canonicalRoots = roots.map(root => realpathSync(root));
    const newRoots = new Set(canonicalRoots.filter(root => !this.#registeredRoots.has(root)));
    if (this.#registeredRoots.size + newRoots.size > MAX_REGISTERED_EDITOR_ROOTS) throw new Error("Too many registered editor workspaces");
    const busy = new Set([...this.#pending.values()].map(pending => pending.clientId));
    for (const [key, client] of this.#clients) if (Date.now() - client.lastSeen >= 5000 && !busy.has(key)) this.#clients.delete(key);
    if (!this.#clients.has(id) && this.#clients.size >= 100) throw new Error("Too many editor windows");
    for (const root of canonicalRoots) this.#registeredRoots.add(root);
    this.#clients.set(id, { id, roots: canonicalRoots, lastSeen: Date.now() });
  }
  poll(id: string): EditorRequest[] {
    const client = this.#clients.get(id); if (!client) throw new Error("Register the editor first");
    client.lastSeen = Date.now();
    const requests: EditorRequest[] = [];
    for (const pending of this.#pending.values()) if (pending.clientId === id && !pending.sent) { pending.sent = true; requests.push(pending.request); }
    return requests;
  }
  respond(id: string, response: EditorResponse) {
    const pending = response.requestId ? this.#pending.get(response.requestId) : undefined;
    if (!pending || pending.clientId !== id || !pending.sent || performance.now() >= pending.deadline) throw new Error("Stale editor response");
    pending.cleanup(); pending.resolve(response);
  }
  valid(id: string, requestId: string): boolean {
    const pending = this.#pending.get(requestId);
    return !!pending && pending.clientId === id && pending.sent && performance.now() < pending.deadline;
  }
  request(cwd: string, input: Record<string, unknown>, signal: AbortSignal): Promise<EditorResponse> {
    if (signal.aborted) return Promise.reject(new Error("Editor request cancelled"));
    if (this.#pending.size >= 100) return Promise.reject(new Error("Editor request capacity reached"));
    const root = realpathSync(cwd);
    const client = [...this.#clients.values()].find(client => Date.now() - client.lastSeen < 5000 && client.roots.some(candidate => within(candidate, root)));
    if (!client) return Promise.reject(new Error("Open this task folder in the Cedia editor before using editor tools"));
    if (!["read", "apply", "inventory", "create", "delete", "move"].includes(String(input.kind))) return Promise.reject(new Error("Unknown editor request"));
    const requestId = randomUUID();
    const request = { ...input, protocolVersion: 1, requestId, ...this.#boundPaths(root, input) } as unknown as EditorRequest;
    return new Promise((resolve, reject) => {
      const cleanup = () => { const pending = this.#pending.get(requestId); if (pending) clearTimeout(pending.timer); this.#pending.delete(requestId); signal.removeEventListener("abort", abort); };
      const abort = () => { cleanup(); reject(new Error("Editor request cancelled; if it was delivered, inspect the buffer before retrying")); };
      const timer = setTimeout(() => { cleanup(); reject(new Error("Editor response timed out; outcome may be unknown")); }, 30_000);
      this.#pending.set(requestId, { clientId: client.id, request, sent: false, deadline: performance.now() + 30_000, resolve, reject, timer, cleanup });
      signal.addEventListener("abort", abort, { once: true });
    });
  }
  #editorPath(root: string, value: unknown): string {
    const path = String(value);
    if (isUntitledEditorPath(path)) return path;
    return workspacePath(root, path);
  }
  #boundPaths(root: string, input: Record<string, unknown>): Record<string, unknown> {
    if (input.kind === "inventory") return {};
    const path = this.#editorPath(root, input.path);
    if (input.kind === "move") return { path, destination: this.#editorPath(root, input.destination) };
    return { path };
  }
  close() { for (const pending of [...this.#pending.values()]) { pending.cleanup(); pending.reject(new Error("Editor host closed")); } this.#clients.clear(); }
}
