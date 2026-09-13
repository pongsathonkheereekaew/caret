import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { CARET_PROTOCOL_VERSION, type CommandRequest, type UiResponseRequest } from "../../../packages/protocol/src/index.ts";
import { DeviceAuth } from "./auth.ts";
import { CaretHost, HostError } from "./service.ts";
import { reviewWorkspace, workspacePath } from "./workspaces.ts";
import type { ArtifactStore } from "./artifacts.ts";
import type { RemoteConnection } from "./remote.ts";
import type { EditorConnections } from "./editors.ts";
import type { EditorResponse } from "../../../packages/protocol/src/editor.ts";
import { createHash } from "node:crypto";
import { ResponseChunks } from "./response-chunks.ts";

export interface HostRequest { method: string; path: string; token?: string; body?: unknown }
export interface HostResponse { status: number; body: unknown }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HostError("invalid_body", "Expected an object", 400);
  return value as Record<string, unknown>;
}
function string(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 4096) throw new HostError("invalid_body", `Invalid ${name}`, 400);
  return value;
}
function integer(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new HostError("invalid_cursor", "Invalid pagination", 400);
  return Number(value);
}

/** Identical authenticated application router for loopback HTTP and encrypted relay. */
export function createRouter(host: CaretHost, auth: DeviceAuth, extras: { artifacts?: ArtifactStore; remote?: RemoteConnection; editors?: EditorConnections } = {}) {
  const responses = new ResponseChunks();
  return async (request: HostRequest): Promise<HostResponse> => {
    try {
      const device = auth.authenticate(request.token);
      if (!device) throw new HostError("unauthorized", "Device credential is missing or revoked", 401);
      const url = new URL(request.path, "http://caret.local");
      const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
      if (parts[0] !== "v1") throw new HostError("not_found", "Unknown API version", 404);
      const method = request.method.toUpperCase();
      const body = () => record(request.body);
      const owner = () => { if (device.role !== "owner") throw new HostError("forbidden", "Only the local owner can manage devices", 403); };
      let result: unknown;
      if (parts.length === 3 && parts[1] === "responses" && method === "GET") {
        result = responses.read(device.id, parts[2]!, integer(url.searchParams.get("offset"), 0));
      } else if (parts.length === 2 && parts[1] === "health" && method === "GET") {
        result = { protocolVersion: CARET_PROTOCOL_VERSION, status: "ready", ompVersion: "18.1.18" };
      } else if (parts[1] === "projects" && parts.length === 2) {
        if (method === "GET") result = host.store.listProjects({ includeArchived: true });
        else if (method === "POST") { const b = body(); result = host.store.createProject({ path: string(b.path, "path"), ...(b.name === undefined ? {} : { name: string(b.name, "name") }) }); }
        else throw new HostError("method_not_allowed", "Unsupported method", 405);
      } else if (parts[1] === "projects" && parts.length === 3 && method === "PATCH") {
        const b = body();
        for (const key of Object.keys(b)) if (!["name", "pinned", "archived"].includes(key)) throw new HostError("invalid_body", `Unsupported project field ${key}`, 400);
        result = host.store.updateProject(parts[2]!, b);
      } else if (parts[1] === "sessions" && parts.length === 2) {
        if (method === "GET") result = host.store.listSessions(url.searchParams.get("projectId") ?? undefined, { includeArchived: true });
        else if (method === "POST") {
          const b = body();
          if (b.workspaceMode !== undefined && b.workspaceMode !== "local" && b.workspaceMode !== "worktree") throw new HostError("unsupported_workspace", "Choose local or worktree mode", 400);
          result = host.createSession(string(b.projectId, "projectId"), b.title === undefined ? undefined : string(b.title, "title"), b.workspaceMode as "local" | "worktree" | undefined);
        } else throw new HostError("method_not_allowed", "Unsupported method", 405);
      } else if (parts[1] === "sessions" && parts.length >= 3) {
        const id = parts[2]!;
        const session = host.store.getSession(id);
        if (!session) throw new HostError("not_found", "Task not found", 404);
        const action = parts[3];
        if (parts.length === 3 && method === "GET") result = session;
        else if (parts.length === 3 && method === "PATCH") {
          const b = body();
          for (const key of Object.keys(b)) if (!["title", "archived", "pinned"].includes(key)) throw new HostError("invalid_body", `Unsupported task field ${key}`, 400);
          result = host.store.updateSession(id, b);
        } else if (action === "events" && parts.length === 6 && parts[5] === "frame" && method === "GET") {
          const sequence = integer(parts[4]!, 0);
          const event = host.store.readEvents(id, sequence - 1, 1).events[0];
          if (!event || event.sequence !== sequence) throw new HostError("not_found", "Event not found", 404);
          const text = JSON.stringify(event.frame); const offset = integer(url.searchParams.get("offset"), 0);
          result = { sequence, offset, text: text.slice(offset, offset + 24_000), length: text.length, sha256: createHash("sha256").update(text).digest("hex") };
        } else if (action === "artifacts" && parts.length === 5 && method === "GET" && extras.artifacts) result = extras.artifacts.read(id, parts[4]!, integer(url.searchParams.get("offset"), 0));
        else if (parts.length !== 4) throw new HostError("not_found", "Unknown task route", 404);
        else if (action === "artifacts" && method === "GET" && extras.artifacts) result = extras.artifacts.list(id);
        else if (action === "artifacts" && method === "POST" && extras.artifacts) {
          const b = body(); const sourcePaths = b.sourcePaths ?? [];
          if (!Array.isArray(sourcePaths) || sourcePaths.some(path => typeof path !== "string")) throw new HostError("invalid_body", "sourcePaths must be a list of paths", 400);
          result = extras.artifacts.capture(id, session.cwd, string(b.path, "path"), sourcePaths);
        }
        else if (action === "start" && method === "POST") result = await host.startSession(id);
        else if (action === "stop" && method === "POST") result = await host.stopSession(id);
        else if (action === "reconcile" && method === "POST") {
          if (body().acknowledgeUnknown !== true) throw new HostError("acknowledgement_required", "Acknowledge the unknown outcome before reconciliation", 400);
          result = host.reconcile(id);
        } else if (action === "events" && method === "GET") {
          const after = integer(url.searchParams.get("after"), 0);
          const page = host.store.readEvents(id, after, integer(url.searchParams.get("limit"), 200));
          let bytes = 0;
          const events = [];
          for (const event of page.events) {
            const text = JSON.stringify(event.frame);
            const frame = Buffer.byteLength(text) > 48_000 ? { type: "caret_frame_reference", sequence: event.sequence, length: text.length, sha256: createHash("sha256").update(text).digest("hex") } : event.frame;
            const projected = { ...event, frame }; const size = Buffer.byteLength(JSON.stringify(projected));
            if (events.length && bytes + size > 128_000) break;
            events.push(projected); bytes += size;
          }
          result = { events, cursor: events.at(-1)?.sequence ?? after, hasMore: page.hasMore || events.length < page.events.length };
        }
        else if (action === "commands" && method === "GET") result = host.store.listCommands(id);
        else if (action === "commands" && method === "POST") {
          const b = body(); string(b.commandId, "commandId"); string(b.incarnation, "incarnation"); string(b.command, "command");
          if (b.payload !== undefined) record(b.payload);
          result = await host.command(id, device.id, b as unknown as CommandRequest);
        } else if (action === "ui" && method === "GET") result = host.pendingUi(id);
        else if (action === "ui" && method === "POST") {
          const b = body(); string(b.commandId, "commandId"); string(b.incarnation, "incarnation"); string(b.token, "token");
          result = await host.respond(id, device.id, b as unknown as UiResponseRequest);
        } else if (action === "review" && method === "GET") result = reviewWorkspace(session.cwd);
        else if (action === "files" && method === "GET") {
          const path = workspacePath(session.cwd, url.searchParams.get("path") ?? ".");
          const stat = lstatSync(path);
          if (stat.isDirectory()) result = { entries: readdirSync(path, { withFileTypes: true }).slice(0, 1000).map(entry => ({ name: entry.name, directory: entry.isDirectory(), symlink: entry.isSymbolicLink() })) };
          else if (stat.isFile() && stat.size <= 1024 * 1024) { const bytes = readFileSync(path); result = bytes.includes(0) ? { binary: true, size: stat.size } : { text: bytes.toString("utf8"), size: stat.size }; }
          else result = { binary: true, size: stat.size };
        } else throw new HostError("not_found", "Unknown task route", 404);
      } else if (parts[1] === "editors" && extras.editors) {
        owner();
        const id = string(parts[2], "editor client ID");
        if (parts.length === 3 && method === "POST") {
          const roots = body().roots;
          if (!Array.isArray(roots) || roots.some(root => typeof root !== "string")) throw new HostError("invalid_body", "Expected workspace roots", 400);
          extras.editors.register(id, roots); result = { registered: true };
        } else if (parts.length === 4 && parts[3] === "requests" && method === "GET") result = extras.editors.poll(id);
        else if (parts.length === 5 && parts[3] === "requests" && method === "GET") result = { valid: extras.editors.valid(id, parts[4]!) };
        else if (parts.length === 4 && parts[3] === "responses" && method === "POST") { extras.editors.respond(id, body() as unknown as EditorResponse); result = { accepted: true }; }
        else throw new HostError("not_found", "Unknown editor route", 404);
      } else if (parts[1] === "remote" && extras.remote) {
        owner();
        if (parts.length === 2 && method === "GET") result = extras.remote.status();
        else if (parts.length === 3 && parts[2] === "pair" && method === "POST") result = await extras.remote.pair(string(body().name, "name"));
        else if (parts.length === 3 && parts[2] === "disable" && method === "POST") { await extras.remote.disable(); result = extras.remote.status(); }
        else throw new HostError("not_found", "Unknown remote route", 404);
      } else if (parts[1] === "devices") {
        owner();
        if (parts.length === 2 && method === "GET") result = auth.list();
        else if (parts.length === 2 && method === "POST") result = auth.issue(string(body().name, "name"));
        else if (parts.length === 4 && parts[3] === "revoke" && method === "POST") { auth.revoke(parts[2]!); result = { revoked: true }; }
        else throw new HostError("not_found", "Unknown device route", 404);
      } else throw new HostError("not_found", "Unknown route", 404);
      return { status: 200, body: parts[1] === "responses" ? result : responses.wrap(device.id, result) };
    } catch (error) {
      if (error instanceof HostError) return { status: error.status, body: { error: { code: error.code, message: error.message } } };
      // Keep runtime paths, provider credentials and subprocess stderr out of remote errors.
      return { status: 400, body: { error: { code: "request_failed", message: "The host could not complete this request" } } };
    }
  };
}
