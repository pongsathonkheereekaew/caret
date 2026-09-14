import { isRecord, nonEmptyString, type ConnectionState } from "./types.ts";

export const TASK_DESTINATION = "This Mac" as const;

export interface TaskHeaderWorkspace {
  readonly projectLabel: string;
  readonly workspaceKind: "folder" | "branch";
  readonly workspaceLabel: string;
  readonly destination: typeof TASK_DESTINATION;
}

export function folderNameFromPath(path: string): string {
  const trimmed = path.trim().replace(/[\\/]+$/, "");
  const parts = trimmed.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? "Folder";
}

/** Only an advertised non-empty branch string counts. Missing/blank stays Folder. */
export function advertisedBranch(source: unknown): string | undefined {
  if (!isRecord(source)) return undefined;
  const branch = source.branch;
  return nonEmptyString(branch) ? branch.trim() : undefined;
}

export function taskHeaderWorkspace(input: {
  readonly project?: { readonly name?: string; readonly path?: string } | null;
  readonly advertised?: unknown;
}): TaskHeaderWorkspace {
  const project = input.project;
  const projectLabel = project && nonEmptyString(project.name)
    ? project.name.trim()
    : project && nonEmptyString(project.path)
      ? folderNameFromPath(project.path)
      : "Folder";
  const branch = advertisedBranch(input.advertised ?? project);
  return {
    projectLabel,
    workspaceKind: branch ? "branch" : "folder",
    workspaceLabel: branch ?? "Folder",
    destination: TASK_DESTINATION,
  };
}

export function formatTaskHeaderWorkspace(workspace: TaskHeaderWorkspace): string {
  return `${workspace.projectLabel} · ${workspace.workspaceLabel} · ${workspace.destination}`;
}

/** Relative age for last-sync / Updating badges. Accepts ISO strings or epoch ms. */
export function formatRelativeTime(timestamp: string | number | undefined, now = Date.now()): string {
  if (timestamp === undefined || timestamp === "") return "";
  const date = typeof timestamp === "number" ? new Date(timestamp) : new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";
  const minutes = Math.max(0, Math.round((now - date.getTime()) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function lastSyncLabel(input: { readonly cacheSavedAt?: number; readonly fresh: boolean }, now = Date.now()): string {
  const when = formatRelativeTime(input.cacheSavedAt, now);
  return `Last sync · ${when || "never"} · ${input.fresh ? "Fresh" : "Stale"}`;
}

export function connectionBadgeLabel(
  connection: ConnectionState,
  options?: { readonly syncing?: boolean; readonly lastKnownAt?: string | number; readonly now?: number },
): string {
  if (options?.syncing) {
    const relative = formatRelativeTime(options.lastKnownAt, options.now);
    return relative ? `Updating · ${relative}` : "Updating";
  }
  switch (connection) {
    case "offline":
      return "Offline";
    case "running":
      return "Running";
    case "unknown":
      return "Unknown";
    case "connecting":
      return "Connecting";
    case "reconnecting":
      return "Reconnecting";
    case "connected":
      return "Connected";
  }
}

export type RelayReachabilityState = "idle" | "connecting" | "open" | "closed";

export const RELAY_UNAVAILABLE_COPY = "Relay unavailable — check network or try again.";
export const MAC_UNREACHABLE_COPY = "Mac unreachable — it may be asleep or offline.";

/** Offline copy splits relay-down from a reachable relay that cannot see the Mac. */
export function hostReachabilityCopy(
  connection: ConnectionState,
  relayState?: RelayReachabilityState,
): string {
  if (connection === "offline") {
    if (relayState === "open") return MAC_UNREACHABLE_COPY;
    if (relayState === "idle" || relayState === "closed" || relayState === "connecting") return RELAY_UNAVAILABLE_COPY;
    return MAC_UNREACHABLE_COPY;
  }
  if (connection === "connecting" || connection === "reconnecting") return "Reaching the paired Mac…";
  if (connection === "unknown") return "Host reachability is unknown. Check the Mac before retrying a command.";
  if (connection === "running") return "Connected to the paired Mac. The same OMP session is working.";
  return "Connected to the paired Mac.";
}
