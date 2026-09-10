// Local git lifecycle conformance (REV-06): commit + file-remote sync over
// real git in tmpdir. No network, no hosting API — a bare dir is the
// remote, which exercises the full push/fetch/reject machinery locally.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

import { gitCommit, gitFetch, gitPush, gitSyncStatus } from "./git-local.ts";

const roots: string[] = [];
afterEach(() => {
  while (roots.length > 0) {
    try {
      rmSync(roots.pop() as string, { recursive: true, force: true });
    } catch {
      // Best effort: tmpdir sweep reclaims leftovers.
    }
  }
});

const sh = (cwd: string, args: ReadonlyArray<string>): string =>
  execFileSync("git", ["-c", "init.defaultBranch=main", ...args], { cwd, stdio: "pipe" }).toString();

const freshRepo = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "caret-git-"));
  roots.push(dir);
  sh(dir, ["init"]);
  sh(dir, ["config", "user.name", "caret-test"]);
  sh(dir, ["config", "user.email", "caret@test"]);
  sh(dir, ["config", "commit.gpgsign", "false"]);
  return dir;
};

const bareRemote = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "caret-git-bare-"));
  roots.push(dir);
  sh(dir, ["init", "--bare"]);
  return dir;
};

const cloneOf = (remote: string, name: string): string => {
  const parent = mkdtempSync(join(tmpdir(), "caret-git-clones-"));
  roots.push(parent);
  sh(parent, ["clone", remote, name]);
  const dir = join(parent, name);
  sh(dir, ["config", "user.name", "caret-test"]);
  sh(dir, ["config", "user.email", "caret@test"]);
  sh(dir, ["config", "commit.gpgsign", "false"]);
  return dir;
};

describe("GitLocal", () => {
  it("commits with identity from repo config and refuses empties loudly", async () => {
    const repo = freshRepo();
    writeFileSync(join(repo, "f.txt"), "hello\n");
    const sha = await gitCommit(repo, "hello");
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
    expect(sh(repo, ["log", "--format=%s", "-1"]).trim()).toBe("hello");
    expect(await gitSyncStatus(repo)).toMatchObject({ branch: "main", clean: true, upstream: null });
    await expect(gitCommit(repo, "noop")).rejects.toThrow(/nothing to commit/);
    writeFileSync(join(repo, "g.txt"), "x\n");
    await expect(gitCommit(repo, "   ")).rejects.toThrow(/non-empty message/);
  });

  it("pushes and syncs a second checkout through a file remote", async () => {
    const remote = bareRemote();
    const a = freshRepo();
    sh(a, ["remote", "add", "origin", remote]);
    writeFileSync(join(a, "f.txt"), "v1\n");
    await gitCommit(a, "first");
    const remoteSha = await gitPush(a);
    expect(remoteSha).toMatch(/^[0-9a-f]{40}$/);
    expect(await gitSyncStatus(a)).toMatchObject({ clean: true, upstream: "origin/main", ahead: 0, behind: 0 });
    // A fresh clone sees the pushed content: sync proven without network.
    const b = cloneOf(remote, "b");
    expect(readFileSync(join(b, "f.txt"), "utf8")).toBe("v1\n");
    // Remote advances elsewhere: fetch shows behind 1, worktree untouched.
    writeFileSync(join(a, "f.txt"), "v2\n");
    await gitCommit(a, "second");
    await gitPush(a);
    await gitFetch(b);
    expect(await gitSyncStatus(b)).toMatchObject({ behind: 1, clean: true });
    expect(readFileSync(join(b, "f.txt"), "utf8")).toBe("v1\n");
  });

  it("refuses divergent pushes and reports ahead/behind", async () => {
    const remote = bareRemote();
    const seed = freshRepo();
    sh(seed, ["remote", "add", "origin", remote]);
    writeFileSync(join(seed, "base.txt"), "0\n");
    await gitCommit(seed, "seed");
    await gitPush(seed);
    const a = cloneOf(remote, "a");
    const b = cloneOf(remote, "b");
    writeFileSync(join(a, "fa.txt"), "a\n");
    await gitCommit(a, "from a");
    await gitPush(a);
    writeFileSync(join(b, "fb.txt"), "b\n");
    await gitCommit(b, "from b");
    await expect(gitPush(b)).rejects.toThrow(/failed/);
    await gitFetch(b);
    // B is ahead (own commit) and behind (A's commit): merge/rebase needed.
    expect(await gitSyncStatus(b)).toMatchObject({ ahead: 1, behind: 1, clean: true });
  });
});
