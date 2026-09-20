import { execFile, execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { createAgentGitService } from "../src/agent-window-git.ts";
import { CEDIA_AGENT_GIT_EVENT_CHANNEL, createNativeGitApi } from "../agent-window/src/native-git.ts";

const exec = promisify(execFile);

async function git(cwd: string, ...args: string[]) {

  return await exec("git", args, { cwd, env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1" } });
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "cedia-agent-git-"));
  await git(root, "init", "-b", "main");
  await git(root, "config", "user.email", "cedia@example.test");
  await git(root, "config", "user.name", "Cedia Test");
  await writeFile(join(root, "hello.txt"), "hello\n");
  await git(root, "add", "--", "hello.txt");
  await git(root, "commit", "-m", "initial");
  return root;
}

describe("Cedia native git bridge", () => {
  it("reads status, branches, working-tree diff and stats without a shell", async () => {
    const cwd = await fixture();
    const sender = { send: () => undefined };
    const service = createAgentGitService();
    try {
      await writeFile(join(cwd, "hello.txt"), "hello\nchanged\n");
      await writeFile(join(cwd, "new.txt"), "untracked\n");
      await writeFile(join(cwd, "ชื่อ * file.txt"), "unicode\n");
      const status = await service.handle({ sender }, "status", { cwd }) as Record<string, any>;
      expect(status).toMatchObject({ branch: "main", hasWorkingTreeChanges: true, hasUpstream: false });
      expect(status.workingTree.files).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: "hello.txt" }),
        expect.objectContaining({ path: "new.txt", insertions: 0, deletions: 0 }),
        expect.objectContaining({ path: "ชื่อ * file.txt", insertions: 0, deletions: 0 }),
      ]));
      const branches = await service.handle({ sender }, "listBranches", { cwd }) as Record<string, any>;
      expect(branches).toMatchObject({ isRepo: true, hasOriginRemote: false });
      expect(branches.branches).toEqual([expect.objectContaining({ name: "main", current: true, isDefault: true })]);
      const diff = await service.handle({ sender }, "readWorkingTreeDiff", { cwd, scope: "workingTree" }) as Record<string, any>;
      expect(diff.patch).toContain("changed");
      expect(diff.truncated).toBe(false);
      const stats = await service.handle({ sender }, "workingTreeDiffStats", { cwd, scope: "workingTree" }) as Record<string, any>;
      expect(stats).toMatchObject({ additions: 1, deletions: 0, fileCount: 1 });
      const original = await service.handle({ sender }, "readFileAtRev", { cwd, filePath: "hello.txt" }) as Record<string, any>;
      expect(original).toMatchObject({ resolvedRev: "HEAD", missing: false, truncated: false, contents: "hello\n" });
      const commits = await service.handle({ sender }, "listRecentCommits", { cwd, limit: 2 }) as Record<string, any>;
      expect(commits.commits[0]).toMatchObject({ subject: "initial" });
    } finally {
      service.dispose();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("rejects dirty checkouts, then creates and checks out a branch once clean", async () => {
    const cwd = await fixture();
    const service = createAgentGitService();
    try {
      const sender = { send: () => undefined };
      await service.handle({ sender }, "createBranch", { cwd, branch: "feature/demo", publish: false });
      await service.handle({ sender }, "checkout", { cwd, branch: "feature/demo" });
      await writeFile(join(cwd, "hello.txt"), "dirty\n");
      await expect(service.handle({ sender }, "checkout", { cwd, branch: "main" })).rejects.toThrow(/uncommitted|stash|commit/i);
      expect(execFileSync("git", ["branch", "--show-current"], { cwd, encoding: "utf8" }).trim()).toBe("feature/demo");
      await git(cwd, "checkout", "--", "hello.txt").catch(() => undefined);
      await exec("git", ["restore", "--", "hello.txt"], { cwd });
      await service.handle({ sender }, "checkout", { cwd, branch: "main" });
      expect(execFileSync("git", ["branch", "--show-current"], { cwd, encoding: "utf8" }).trim()).toBe("main");
    } finally {
      service.dispose();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("commits explicit files and emits action progress", async () => {
    const cwd = await fixture();
    const events: unknown[] = [];
    const service = createAgentGitService();
    const sender = { send: (_channel: string, event: unknown) => events.push(event) };
    try {
      await writeFile(join(cwd, "hello.txt"), "hello\ncommitted\n");
      const result = await service.handle({ sender }, "runStackedAction", {
        actionId: "action-1",
        cwd,
        action: "commit",
        commitMessage: "Save from Cedia",
        filePaths: ["hello.txt"],
      }) as Record<string, any>;
      expect(result).toMatchObject({ action: "commit", commit: { status: "created", subject: "Save from Cedia" }, push: { status: "skipped_not_requested" } });
      expect(execFileSync("git", ["log", "-1", "--pretty=%s"], { cwd, encoding: "utf8" }).trim()).toBe("Save from Cedia");
      expect(events.some(event => (event as { kind?: string }).kind === "action_started")).toBe(true);
      expect(events.some(event => (event as { kind?: string }).kind === "action_finished")).toBe(true);
    } finally {
      service.dispose();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("stages all selected files when filePaths are omitted and carries a feature branch", async () => {
    const cwd = await fixture();
    const service = createAgentGitService();
    try {
      await writeFile(join(cwd, "hello.txt"), "hello\nfeature\n");
      const result = await service.handle({ sender: { send: () => undefined } }, "runStackedAction", {
        actionId: "feature-action",
        cwd,
        action: "commit",
        featureBranch: true,
      }) as Record<string, any>;
      expect(result).toMatchObject({
        branch: { status: "created", name: "cedia/update" },
        commit: { status: "created", subject: "Update workspace" },
      });
      expect(execFileSync("git", ["branch", "--show-current"], { cwd, encoding: "utf8" }).trim()).toBe("cedia/update");
      expect(execFileSync("git", ["log", "-1", "--pretty=%s"], { cwd, encoding: "utf8" }).trim()).toBe("Update workspace");
    } finally {
      service.dispose();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("keeps pre-staged files outside an explicit selection out of the commit", async () => {
    const cwd = await fixture();
    const service = createAgentGitService();
    try {
      await writeFile(join(cwd, "other.txt"), "other\n");
      await git(cwd, "add", "--", "other.txt");
      await git(cwd, "commit", "-m", "add other");
      await writeFile(join(cwd, "hello.txt"), "hello\nselected\n");
      await writeFile(join(cwd, "other.txt"), "other\nstaged\n");
      await git(cwd, "add", "--", "other.txt");
      const result = await service.handle({ sender: { send: () => undefined } }, "runStackedAction", {
        actionId: "selected-action",
        cwd,
        action: "commit",
        commitMessage: "Commit selected file",
        filePaths: ["hello.txt"],
      }) as Record<string, any>;
      expect(result.commit).toMatchObject({ status: "created", subject: "Commit selected file" });
      expect(execFileSync("git", ["show", "--pretty=%s", "--name-only", "-1"], { cwd, encoding: "utf8" })).toContain("hello.txt");
      expect(execFileSync("git", ["show", "--pretty=%s", "--name-only", "-1"], { cwd, encoding: "utf8" })).not.toContain("other.txt");
      expect(execFileSync("git", ["diff", "--cached", "--name-only"], { cwd, encoding: "utf8" }).trim()).toBe("other.txt");
    } finally {
      service.dispose();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("classifies remote refs and checks them out as local branches", async () => {
    const cwd = await fixture();
    const remote = await mkdtemp(join(tmpdir(), "cedia-agent-git-remote-"));
    const service = createAgentGitService();
    try {
      await git(remote, "init", "--bare");
      await git(cwd, "remote", "add", "origin", remote);
      await git(cwd, "push", "--set-upstream", "origin", "main");
      const branches = await service.handle({ sender: { send: () => undefined } }, "listBranches", { cwd }) as Record<string, any>;
      expect(branches.branches).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "origin/main", isRemote: true, remoteName: "origin" }),
      ]));
      await service.handle({ sender: { send: () => undefined } }, "createBranch", { cwd, branch: "feature/remote-checkout", publish: false });
      await service.handle({ sender: { send: () => undefined } }, "checkout", { cwd, branch: "feature/remote-checkout" });
      await service.handle({ sender: { send: () => undefined } }, "checkout", { cwd, branch: "origin/main" });
      expect(execFileSync("git", ["branch", "--show-current"], { cwd, encoding: "utf8" }).trim()).toBe("main");
    } finally {
      service.dispose();
      await rm(cwd, { recursive: true, force: true });
      await rm(remote, { recursive: true, force: true });
    }
  });

  it("maps renderer git calls to the guarded panel and event channel", async () => {
    const calls: Array<{ channel: string; input: unknown }> = [];
    const listeners = new Map<string, (event: unknown, ...args: unknown[]) => void>();
    const bridge = {
      invoke: async (channel: string, input: unknown) => {
        calls.push({ channel, input });
        return { branch: "main", hasWorkingTreeChanges: false };
      },
      on: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => { listeners.set(channel, listener); },
      removeListener: (channel: string) => { listeners.delete(channel); },
    };
    const api = createNativeGitApi(bridge);
    await api.status({ cwd: "/tmp/project" });
    expect(calls[0]).toMatchObject({ channel: "vscode:cediaAgent", input: { kind: "panel", surface: "git", method: "status", input: { cwd: "/tmp/project" } } });
    const received: unknown[] = [];
    const dispose = api.onActionProgress(event => received.push(event));
    listeners.get(CEDIA_AGENT_GIT_EVENT_CHANNEL)?.({}, { kind: "action_started" });
    dispose();
    expect(received).toEqual([{ kind: "action_started" }]);
  });
});
