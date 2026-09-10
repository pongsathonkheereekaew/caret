// Run export bundle conformance (M7 primitive): round-trip, overwrite
// refusal, corrupt-bundle rejection, journal cap, single-file containment,
// and handoff assembly against a fixture git repo (real CheckpointStore,
// no engine — CaretRun is fabricated data, the store does real git).
import { mkdtempSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import * as Effect from "effect/Effect";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { ManagedRuntime } from "effect";

import {
  assembleRunBundle,
  readRunBundle,
  writeRunBundle,
  BUNDLE_FILENAME,
  BUNDLE_JOURNAL_CAP,
  type RunBundle,
} from "./export.ts";
import { summarizeRunForHandoff, bootDaemonLayer, type CaretRun } from "./daemon.ts";
import { CheckpointStore } from "../../server/src/checkpointing/Services/CheckpointStore.ts";
import { CheckpointRef } from "@synara/contracts";

const git = (cwd: string, args: string[]) =>
  execFileSync("git", ["-c", "user.name=caret", "-c", "user.email=caret@test", "-c", "commit.gpgsign=false", "-c", "init.defaultBranch=main", ...args], { cwd, stdio: "pipe" });

const runFs = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(effect.pipe(Effect.provide(NodeServices.layer)) as Effect.Effect<A, E>);

const fixtureHandoff = {
  goal: "fixture goal",
  workDir: "/tmp/fixture-wt",
  baseCommit: null,
  filesChanged: ["a.txt"],
  approvals: [{ type: "command", decision: "accept" }],
  diff: "diff --git a/a.txt b/a.txt\n+hello\n",
};

const fixtureBundle = (journal: ReadonlyArray<unknown> = [{ t: "e1" }]): RunBundle =>
  assembleRunBundle({ threadId: "caret-slice-test", goal: "fixture goal", handoff: fixtureHandoff, journal });

describe("RunExport", () => {
  const dirs: string[] = [];
  const scratch = (prefix: string) => {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    dirs.push(dir);
    return dir;
  };
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("round-trips a bundle through exactly one file", async () => {
    const dir = scratch("caret-export-");
    const out = join(dir, "run1");
    const file = await runFs(writeRunBundle(out, fixtureBundle()));
    expect(file.endsWith(BUNDLE_FILENAME)).toBe(true);
    expect(readdirSync(out)).toEqual([BUNDLE_FILENAME]);
    const back = await runFs(readRunBundle(out));
    expect(back.version).toBe(1);
    expect(back.threadId).toBe("caret-slice-test");
    expect(back.goal).toBe("fixture goal");
    expect(back.handoff.filesChanged).toEqual(["a.txt"]);
    expect(back.journal).toEqual([{ t: "e1" }]);
    expect(typeof back.exportedAt).toBe("string");
  });

  it("refuses to overwrite unless asked", async () => {
    const out = join(scratch("caret-export-"), "run1");
    await runFs(writeRunBundle(out, fixtureBundle()));
    await expect(runFs(writeRunBundle(out, fixtureBundle()))).rejects.toThrow(/refusing to overwrite/);
    await runFs(writeRunBundle(out, fixtureBundle([{ t: "e2" }]), true));
    expect((await runFs(readRunBundle(out))).journal).toEqual([{ t: "e2" }]);
  });

  it("rejects missing, corrupt, and wrong-shape bundles with reasons", async () => {
    const dir = scratch("caret-export-");
    await expect(runFs(readRunBundle(join(dir, "absent")))).rejects.toThrow(/no export bundle/);
    const bad = join(dir, "bad");
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(bad, { recursive: true });
    writeFileSync(join(bad, BUNDLE_FILENAME), "{not json");
    await expect(runFs(readRunBundle(bad))).rejects.toThrow(/not JSON/);
    writeFileSync(join(bad, BUNDLE_FILENAME), JSON.stringify({ version: 2 }));
    await expect(runFs(readRunBundle(bad))).rejects.toThrow(/version/);
    writeFileSync(join(bad, BUNDLE_FILENAME), JSON.stringify({ version: 1, threadId: "x" }));
    await expect(runFs(readRunBundle(bad))).rejects.toThrow(/missing/);
  });

  it("caps the journal tail, newest last", async () => {
    const journal = Array.from({ length: BUNDLE_JOURNAL_CAP + 700 }, (_, i) => ({ t: `e${i}` }));
    const bundle = fixtureBundle(journal);
    expect(bundle.journal).toHaveLength(BUNDLE_JOURNAL_CAP);
    expect(bundle.journal[0]).toEqual({ t: "e700" });
    expect(bundle.journal[BUNDLE_JOURNAL_CAP - 1]).toEqual({ t: `e${BUNDLE_JOURNAL_CAP + 699}` });
  });

  it("assembles handoff state from a fixture repo without an engine", async () => {
    const mainDir = scratch("caret-export-main-");
    git(mainDir, ["init"]);
    writeFileSync(join(mainDir, "tracked.txt"), "base\n");
    git(mainDir, ["add", "-A"]);
    git(mainDir, ["commit", "-qm", "base"]);
    const runtime = ManagedRuntime.make(bootDaemonLayer(mainDir));
    try {
      const preRef = "refs/caret-test/pre";
      await runtime.runPromise(
        Effect.gen(function* () {
          const store = yield* CheckpointStore;
          yield* store.captureCheckpoint({ cwd: mainDir, checkpointRef: CheckpointRef.makeUnsafe(preRef) });
        }),
      );
      writeFileSync(join(mainDir, "tracked.txt"), "changed\n");
      writeFileSync(join(mainDir, "new.txt"), "new\n");
      const run = {
        threadId: "caret-slice-test",
        repoDir: mainDir,
        workDir: mainDir,
        isolated: null,
        broughtBack: false,
        preRef,
        postRef: "",
      } as unknown as CaretRun;
      const seen = [
        { type: "request.resolved", payload: { requestType: "command", decision: "accept" } },
        { type: "session.something", payload: {} },
      ];
      const handoff = await runtime.runPromise(summarizeRunForHandoff(run, seen, "test goal"));
      expect(handoff.goal).toBe("test goal");
      expect(handoff.baseCommit).toBeNull();
      expect(handoff.filesChanged.sort()).toEqual(["new.txt", "tracked.txt"]);
      expect(handoff.approvals).toEqual([{ type: "command", decision: "accept" }]);
      expect(handoff.diff).toContain("changed");
    } finally {
      await runtime.dispose();
    }
  });
});
