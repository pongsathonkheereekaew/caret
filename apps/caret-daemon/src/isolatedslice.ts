// Binding proof: session executes in an isolated worktree by default;
// bring-back lands reviewed work onto main; stop cleans up. One engine turn.
import * as Effect from "effect/Effect";
import * as Fs from "node:fs";
import { execFileSync } from "node:child_process";
import {
  bootDaemonLayer,
  startCaretRun,
  sendCaretTurn,
  reviewCaretRun,
  bringBackCaretRun,
  stopCaretRun,
} from "./daemon.ts";

const REPO = "/tmp/caret-bind-1";
const JOURNAL = "/tmp/caret-bind-1-journal.jsonl";

const git = (args: string[]) =>
  execFileSync("git", ["-c", "user.name=caret", "-c", "user.email=caret@test", "-c", "commit.gpgsign=false", "-c", "init.defaultBranch=main", ...args], { cwd: REPO, stdio: "pipe" });

Fs.rmSync(REPO, { recursive: true, force: true });
Fs.mkdirSync(REPO, { recursive: true });
Fs.rmSync(JOURNAL, { force: true });
git(["init"]);
Fs.writeFileSync(`${REPO}/base.txt`, "base\n");
git(["add", "-A"]);
git(["commit", "-qm", "bind base"]);

const step = (name: string, pass: boolean, detail = "") => {
  console.log(`${pass ? "STEP-PASS" : "STEP-FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!pass) throw new Error(`binding proof failed at ${name}: ${detail}`);
};
const readMain = (f: string) => (Fs.existsSync(`${REPO}/${f}`) ? Fs.readFileSync(`${REPO}/${f}`, "utf8") : "<absent>");

const program = Effect.gen(function* () {
  const { run, seen } = yield* startCaretRun(
    {
      configCwd: REPO,
      journalPath: JOURNAL,
      onApproval: async (q) => {
        console.log(`APPROVAL ${String(q.requestType)} -> accept`);
        return "accept";
      },
    },
    REPO,
    "bind1",
  );
  step("isolated-by-default", run.workDir !== REPO && Fs.existsSync(run.workDir), run.workDir);

  yield* sendCaretTurn(run, seen, "Create a file bound.txt in the working directory containing exactly the text bound ok. Do nothing else.");
  const inWork = Fs.existsSync(`${run.workDir}/bound.txt`);
  step("engine-ran-isolated", inWork && readMain("bound.txt") === "<absent>", "file in worktree, main clean");

  const diff = yield* reviewCaretRun(run, 1);
  step("review-diff", diff.includes("bound.txt"), `${diff.length} chars`);

  const brought = yield* bringBackCaretRun(run);
  step("bring-back", brought === true && readMain("bound.txt").trim() === "bound ok", "main has the file");

  const stopped = (yield* stopCaretRun(run)) as { worktreeRemoved?: boolean };
  step("stop-cleans-worktree", stopped.worktreeRemoved === true && !Fs.existsSync(run.workDir), "worktree gone");
});

await Effect.runPromise(
  program.pipe(Effect.scoped, Effect.provide(bootDaemonLayer(REPO)), Effect.timeout("270 seconds")),
).then(
  () => console.log("BIND-PASS: isolated by default, reviewed, brought back, cleaned"),
  (e) => {
    console.log(`BIND-FAIL: ${String((e as Error)?.message ?? e).slice(0, 300)}`);
    process.exit(1);
  },
);
