/** Route native IDE handoffs into the same host project/session identity. */
interface HandoffApi {
  orchestration: {
    getShellSnapshot(): Promise<unknown>;
    getThreadDetailSnapshot(input: { threadId: string }): Promise<unknown>;
    dispatchCommand(input: unknown): Promise<unknown>;
  };
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}
export async function openNativeAgentIntent(api: HandoffApi, folder: unknown, resource: unknown, navigate: (id: string) => void): Promise<void> {
  const session = object(resource);
  if (session.scheme === "cedia" && session.authority === "session" && typeof session.path === "string") {
    const id = session.path.replace(/^\//, "");
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error("Invalid Cedia task link");
    await api.orchestration.getThreadDetailSnapshot({ threadId: id });
    navigate(id);
    return;
  }
  const uri = object(folder);
  if (uri.scheme !== "file" || typeof uri.path !== "string" || !uri.path.startsWith("/")) return;
  const snapshot = object(await api.orchestration.getShellSnapshot());
  const projects = Array.isArray(snapshot.projects) ? snapshot.projects.map(object) : [];
  let project = projects.find(row => row.workspaceRoot === uri.path);
  if (!project) {
    const id = crypto.randomUUID();
    await api.orchestration.dispatchCommand({ type: "project.create", commandId: crypto.randomUUID(), projectId: id, title: uri.path.split("/").filter(Boolean).at(-1) ?? uri.path, workspaceRoot: uri.path });
    project = { id };
  }
  const threads = Array.isArray(snapshot.threads) ? snapshot.threads.map(object) : [];
  const existing = threads.find(row => row.projectId === project.id && !row.archivedAt);
  if (typeof existing?.id === "string") { navigate(existing.id); return; }
  const id = crypto.randomUUID();
  await api.orchestration.dispatchCommand({ type: "thread.create", commandId: crypto.randomUUID(), threadId: id, projectId: project.id, title: "New task" });
  navigate(id);
}
