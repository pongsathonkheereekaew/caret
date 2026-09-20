import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { HostHttpError } from "./api.ts";

export function agentUiStateDir(stateDir?: string): string {
  return join(stateDir ?? process.env.CEDIA_STATE_DIR ?? join(homedir(), "Library", "Application Support", "Cedia", "host"), "agent-ui");
}
export function validAgentThreadId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}
function fileFor(directory: string, key: string): string {
  return join(directory, `${createHash("sha256").update(key).digest("hex")}.json`);
}
export async function readAgentUiState(directory: string, key: string): Promise<unknown> {
  try { return JSON.parse(await readFile(fileFor(directory, key), "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}
export async function writeAgentUiState(directory: string, key: string, value: unknown): Promise<void> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const destination = fileFor(directory, key);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
  await rename(temporary, destination);
}
export async function saveIdeHandoff(stateDir: string | undefined, cwd: string, sessionId: string): Promise<void> {
  await writeAgentUiState(agentUiStateDir(stateDir), `handoff:${resolve(cwd)}`, { sessionId, revision: randomUUID() });
}
export async function readIdeHandoff(stateDir: string, cwd: string): Promise<{ sessionId: string; revision: string } | null> {
  const value = await readAgentUiState(agentUiStateDir(stateDir), `handoff:${resolve(cwd)}`) as { sessionId?: unknown; revision?: unknown } | null;
  return value && validAgentThreadId(value.sessionId) && typeof value.revision === "string" ? { sessionId: value.sessionId, revision: value.revision } : null;
}

/** A local unsent draft has an identity before the host creates its OMP session. */
export async function resolveAgentUiThread(stateDir: string | undefined, id: string,
  request: (path: string) => Promise<unknown>): Promise<{ id: string; cwd: string; durable: boolean }> {
  if (!validAgentThreadId(id)) throw new Error("Invalid Agent task");
  try {
    const session = await request(`sessions/${encodeURIComponent(id)}`) as { id?: unknown; cwd?: unknown };
    if (typeof session.cwd !== "string") throw new Error("Invalid Agent session workspace");
    return { id, cwd: session.cwd, durable: true };
  } catch (error) {
    if (!(error instanceof HostHttpError) || error.status !== 404) throw error;
  }
  const payload = await readAgentUiState(agentUiStateDir(stateDir), `draft:${id}`) as { draftThread?: { projectId?: unknown; worktreePath?: unknown; workingDirectory?: unknown } } | null;
  const draft = payload?.draftThread;
  if (!draft || typeof draft.projectId !== "string") throw new Error("Agent draft is unavailable");
  const projects = await request("projects") as { id: string; path: string }[];
  const project = projects.find(item => item.id === draft.projectId);
  if (!project) throw new Error("Agent draft workspace is unavailable");
  const cwd = typeof draft.worktreePath === "string" ? draft.worktreePath : typeof draft.workingDirectory === "string" ? draft.workingDirectory : project.path;
  return { id, cwd, durable: false };
}
