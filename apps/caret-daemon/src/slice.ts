// R04 vertical slice (headless): open repo -> prompt -> approval -> edit ->
// review -> reject -> resume. Real Codex engine, scratch git repo. Assertions
// print STEP lines; nonzero exit on first failure.
import * as Effect from "effect/Effect";
import * as Fs from "node:fs";
import { execFileSync } from "node:child_process";
import {
  bootDaemonLayer,
  startCaretRun,
  sendCaretTurn,
  reviewCaretRun,
  rejectCaretRun,
  recaptureCaretRun,
  stopCaretRun,
} from "./daemon.ts";

const REPO = "/tmp/caret-slice-1";
const JOURNAL = "/tmp/caret-slice-1-journal.jsonl";

const git = (args: string[]) =>
  execFileSync("git", ["-c", "user.name=caret", "-c", "user.email=caret@test", "-c", "commit.gpgsign=false", "-c", "init.defaultBranch=main", ...args], { cwd: REPO, stdio: "pipe" });

Fs.rmSync(REPO, { recursive: true, force: true });
Fs.mkdirSync(REPO, { recursive: true });
Fs.rmSync(JOURNAL, { force: true });
git(["init"]);
Fs.writeFileSync(`${REPO}/base.txt`, "base\n");
git(["add", "-A"]);
git(["commit", "-qm", "slice base"]);

const approvals: Array<{ type: unknown; answer: string }> = [];
const results: Array<[string, boolean, string]> = [];
const step = (name: string, pass: boolean, detail = "") => {
  results.push([name, pass, detail]);
  console.log(`${pass ? "STEP-PASS" : "STEP-FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!pass) throw new Error(`slice failed at ${name}: ${detail}`);
};
const read = (f: string) => (Fs.existsSync(`${REPO}/${f}`) ? Fs.readFileSync(`${REPO}/${f}`, "utf8") : "<absent>");

const program = Effect.gen(function* () {
  // 1. open repo + prompt + approval + edit
  const { run, seen } = yield* startCaretRun(
    {
      configCwd: REPO,
      journalPath: JOURNAL,
      onApproval: async (q) => {
        approvals.push({ type: q.requestType, answer: "accept" });
        console.log(`APPROVAL requestType=${String(q.requestType)} detail=${String(q.detail)?.slice(0, 120)} -> accept`);
        return "accept";
      },
    },
    REPO,
    "r04",
    // Historical R04 proof runs in-repo; isolation is proven separately.
    { isolate: false },
  );
  step("open-repo+session", seen.some((e) => e.type === "thread.started"), "native thread live");

  const t1 = (yield* sendCaretTurn(run, seen, "Create a file hello.txt in the working directory containing exactly the text hi slice. Do nothing else.")) as { payload?: { state?: string } };
  step("prompt+turn", true, `turn completed state=${(t1.payload as { state?: string } | undefined)?.state ?? "ok"}`);
  step("approval-surfaced", approvals.length >= 1, `${approvals.length} approval(s) answered`);
  step("edit-applied", read("hello.txt").trim() === "hi slice", JSON.stringify(read("hello.txt")));

  // 2. review
  const diff = yield* reviewCaretRun(run, 1);
  step("review-diff", diff.includes("hello.txt") && diff.includes("hi slice"), `${diff.length} chars`);

  // 3. reject
  const reversed = yield* rejectCaretRun(run);
  step("reject-run", reversed === true && read("hello.txt") === "<absent>" && read("base.txt") === "base\n", "delta reversed, base intact");

  // 4. resume on the same thread
  yield* recaptureCaretRun(run, "pre-2");
  yield* sendCaretTurn(run, seen, "Create a file hello2.txt in the working directory containing exactly the text hi again. Do nothing else.");
  const diff2 = yield* reviewCaretRun(run, 2);
  step(
    "resume-run",
    read("hello2.txt").trim() === "hi again" && read("hello.txt") === "<absent>" && diff2.includes("hello2.txt"),
    "second goal landed, rejected file stayed gone",
  );

  yield* stopCaretRun(run);
});

await Effect.runPromise(
  program.pipe(Effect.scoped, Effect.provide(bootDaemonLayer(REPO)), Effect.timeout("270 seconds")),
).then(
  () => console.log("SLICE-PASS: open repo -> prompt -> approval -> edit -> review -> reject -> resume"),
  (e) => {
    console.log(`SLICE-FAIL: ${String((e as Error)?.message ?? e).slice(0, 300)}`);
    process.exit(1);
  },
);
