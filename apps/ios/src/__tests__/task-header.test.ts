import { describe, expect, test } from "bun:test";
import {
  advertisedBranch,
  connectionBadgeLabel,
  formatRelativeTime,
  formatTaskHeaderWorkspace,
  lastSyncLabel,
  hostReachabilityCopy,
  MAC_UNREACHABLE_COPY,
  RELAY_UNAVAILABLE_COPY,
  taskHeaderWorkspace,
} from "../core/task-header.ts";

describe("task header workspace", () => {
  test("shows Folder not Branch when no branch is advertised", () => {
    const header = taskHeaderWorkspace({
      project: { name: "Aetheria", path: "/work/aetheria" },
    });
    expect(header.workspaceKind).toBe("folder");
    expect(header.workspaceLabel).toBe("Folder");
    expect(header.destination).toBe("This Mac");
    expect(formatTaskHeaderWorkspace(header)).toBe("Aetheria · Folder · This Mac");
    expect(formatTaskHeaderWorkspace(header)).not.toContain("Branch");
  });

  test("uses the folder name from path when the project has no name", () => {
    const header = taskHeaderWorkspace({ project: { path: "/Users/pond/caret/" } });
    expect(header.projectLabel).toBe("caret");
    expect(header.workspaceLabel).toBe("Folder");
  });

  test("uses an advertised branch only when the host supplies a non-empty string", () => {
    expect(advertisedBranch({ branch: "caret/task-abc" })).toBe("caret/task-abc");
    expect(advertisedBranch({ branch: "   " })).toBeUndefined();
    expect(advertisedBranch({ name: "Aetheria" })).toBeUndefined();
    const header = taskHeaderWorkspace({
      project: { name: "Aetheria", path: "/work/aetheria" },
      advertised: { branch: "caret/task-abc" },
    });
    expect(header.workspaceKind).toBe("branch");
    expect(header.workspaceLabel).toBe("caret/task-abc");
    expect(formatTaskHeaderWorkspace(header)).toBe("Aetheria · caret/task-abc · This Mac");
  });
});

describe("connection badge", () => {
  test("stays honest for offline, running, and unknown", () => {
    expect(connectionBadgeLabel("offline")).toBe("Offline");
    expect(connectionBadgeLabel("running")).toBe("Running");
    expect(connectionBadgeLabel("unknown")).toBe("Unknown");
  });

  test("shows Updating while a foreground catch-up is in flight", () => {
    expect(connectionBadgeLabel("connected", { syncing: true })).toBe("Updating");
    expect(connectionBadgeLabel("running", { syncing: true })).toBe("Updating");
    expect(connectionBadgeLabel("connected", { syncing: false })).toBe("Connected");
  });

  test("appends last-known relative time while Updating", () => {
    const now = Date.parse("2026-09-13T15:00:00.000Z");
    expect(connectionBadgeLabel("connected", { syncing: true, lastKnownAt: now - 3 * 60_000, now })).toBe("Updating · 3m");
    expect(connectionBadgeLabel("running", { syncing: true, lastKnownAt: now - 3 * 60_000, now })).toBe("Updating · 3m");
    expect(formatRelativeTime(now - 3 * 60_000, now)).toBe("3m");
  });

  test("labels last sync freshness from cache metadata", () => {
    const now = Date.parse("2026-09-13T15:00:00.000Z");
    expect(lastSyncLabel({ cacheSavedAt: now - 3 * 60_000, fresh: true }, now)).toBe("Last sync · 3m · Fresh");
    expect(lastSyncLabel({ cacheSavedAt: now - 10 * 60_000, fresh: false }, now)).toBe("Last sync · 10m · Stale");
    expect(lastSyncLabel({ fresh: false }, now)).toBe("Last sync · never · Stale");
  });
});

describe("host reachability copy", () => {
  test("keeps relay-down distinct from Mac unreachable", () => {
    expect(hostReachabilityCopy("offline", "closed")).toBe(RELAY_UNAVAILABLE_COPY);
    expect(hostReachabilityCopy("offline", "idle")).toBe(RELAY_UNAVAILABLE_COPY);
    expect(hostReachabilityCopy("offline", "open")).toBe(MAC_UNREACHABLE_COPY);
    expect(hostReachabilityCopy("offline")).toBe(MAC_UNREACHABLE_COPY);
    expect(RELAY_UNAVAILABLE_COPY).toBe("Relay unavailable — check network or try again.");
    expect(MAC_UNREACHABLE_COPY).toBe("Mac unreachable — it may be asleep or offline.");
  });
});
