import { afterEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readlinkSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  allocateWorkspacePort,
  copyAllowlistedIgnored,
  createWorktree,
  gitRoot,
  loadWorkspaceBootstrap,
  reviewWorkspace,
  saveSnapshotManifest,
  workspacePath,
} from "../src/workspaces.ts";

const directories: string[] = [];
const worktrees: Array<{ root: string; destination: string }> = [];

function temporaryDirectory(prefix = "caret-workspaces-"): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  directories.push(directory);
  return directory;
}

function git(cwd: string, args: string[], input?: string): string {
  return execFileSync("git", ["-C", cwd, ...args], { input, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
}

function gitFixture(): string {
  const root = temporaryDirectory();
  git(root, ["init", "--quiet"]);
  git(root, ["config", "user.email", "caret-fixture@example.invalid"]);
  git(root, ["config", "user.name", "Caret fixture"]);
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src", "main.txt"), "committed\n");
  git(root, ["add", "."]);
  git(root, ["commit", "--quiet", "-m", "fixture"]);
  return root;
}

afterEach(() => {
  for (const { root, destination } of worktrees.splice(0)) {
    try { git(root, ["worktree", "remove", "--force", destination]); } catch { /* fixture may already have cleaned itself */ }
  }
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("workspace boundaries", () => {
  it("accepts missing descendants inside a workspace and rejects traversal or escaping symlinks", () => {
    const root = temporaryDirectory("caret-workspace-path-");
    mkdirSync(join(root, "inside"), { recursive: true });
    const missing = workspacePath(root, "inside/new/file.txt");
    expect(missing).toBe(join(realpathSync(root), "inside", "new", "file.txt"));
    expect(() => workspacePath(root, "../outside.txt")).toThrow(/outside/);

    const outside = temporaryDirectory("caret-workspace-outside-");
    writeFileSync(join(outside, "secret.txt"), "secret");
    symlinkSync(outside, join(root, "escape"));
    expect(() => workspacePath(root, "escape/secret.txt")).toThrow(/outside/);
  });

  it("copies tracked dirty state, nested untracked files, and safe symlinks into an isolated worktree", () => {
    const root = gitFixture();
    writeFileSync(join(root, "src", "main.txt"), "working tree change\n");
    mkdirSync(join(root, "notes", "deep"), { recursive: true });
    writeFileSync(join(root, "notes", "deep", "todo.txt"), "untracked\n");
    symlinkSync("../src/main.txt", join(root, "notes", "tracked-link"));
    const canonicalRoot = realpathSync(root);
    const destination = join(dirname(canonicalRoot), `${canonicalRoot.split("/").pop()}-task`);
    directories.push(destination);
    worktrees.push({ root, destination });

    const snapshot = createWorktree(root, destination, "abc123");
    expect(snapshot.cwd).toBe(destination);
    expect(snapshot.root).toBe(destination);
    expect(snapshot.branch).toBe("caret/task-abc123");
    expect(snapshot.baseCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(snapshot.patchHash).toBe(createHash("sha256").update(git(root, ["diff", "--no-ext-diff", "--binary", "HEAD"])).digest("hex"));
    expect(readFileSync(join(destination, "src", "main.txt"), "utf8")).toBe("working tree change\n");
    expect(readFileSync(join(destination, "notes", "deep", "todo.txt"), "utf8")).toBe("untracked\n");
    expect(readlinkSync(join(destination, "notes", "tracked-link"))).toBe("../src/main.txt");
    expect(snapshot.files).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "notes/deep/todo.txt", kind: "file" }),
      expect.objectContaining({ path: "notes/tracked-link", kind: "symlink" }),
    ]));
    expect(git(root, ["status", "--short"])).toContain("src/main.txt");
    expect(git(root, ["status", "--short"])).toContain("notes/");

    const review = reviewWorkspace(destination);
    expect(review.available).toBe(true);
    expect(review.branch).toBe("caret/task-abc123");
    expect(review.diff).toContain("working tree change");
    expect(review.untracked).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "notes/deep/todo.txt", text: "untracked\n", binary: false }),
    ]));
  });

  it("copies only allowlisted gitignored files and assigns colliding-free ports", () => {
    const root = gitFixture();
    writeFileSync(join(root, ".gitignore"), ".env\n.env.example\n");
    writeFileSync(join(root, ".env"), "SECRET=1\n");
    writeFileSync(join(root, ".env.example"), "SECRET=\n");
    mkdirSync(join(root, ".caret"), { recursive: true });
    writeFileSync(join(root, ".caret", "workspace.json"), JSON.stringify({ ignoreAllowlist: [".env.example"], setup: "bun install", run: "bun run dev", portStart: 42000 }) + "\n");
    const destination = join(dirname(realpathSync(root)), `${realpathSync(root).split("/").pop()}-task-bootstrap`);
    directories.push(destination);
    worktrees.push({ root, destination });
    expect(() => copyAllowlistedIgnored(root, destination, ["../escape"])).toThrow(/workspace-relative/);
    const snapshot = createWorktree(root, destination, "ports", {
      allowlist: loadWorkspaceBootstrap(root).ignoreAllowlist,
      setupScript: "bun install",
      runScript: "bun run dev",
      portStart: 42_000,
      usedPorts: [42_000],
    });
    expect(existsSync(join(destination, ".env"))).toBe(false);
    expect(readFileSync(join(destination, ".env.example"), "utf8")).toBe("SECRET=\n");
    expect(snapshot.port).toBe(42_010);
    expect(snapshot.setupScript).toBe("bun install");
    expect(allocateWorkspacePort([42_000, 42_010], 42_000)).toBe(42_020);
  });

  it("returns unavailable for non-Git folders and writes a private snapshot manifest", () => {
    const root = temporaryDirectory("caret-workspace-plain-");
    expect(gitRoot(root)).toBeUndefined();
    expect(reviewWorkspace(root)).toEqual({ available: false });
    const manifest = join(root, "snapshot.json");
    saveSnapshotManifest(manifest, {
      cwd: root,
      root,
      branch: "local",
      baseCommit: "none",
      patchHash: "hash",
      files: [],
    });
    expect(statSync(manifest).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(manifest, "utf8"))).toMatchObject({ cwd: root, files: [] });
  });
});
