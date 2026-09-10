// Resume + steer proof (AG-05/06): steer a live turn mid-flight, then resume
// the native thread in a fresh run and verify history continuity. Two turns.
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Fs from "node:fs";
import { execFileSync } from "node:child_process";
import {
  bootDaemonLayer,
  startCaretRun,
  sendCaretTurn,
  steerCaretTurn,
  stopCaretRun,
} from "./daemon.ts";

const REPO = "/tmp/caret-rs-1";
const JOURNAL = "/tmp/caret-rs-1-journal.jsonl";

const git = (args: string[]) =>
  execFileSync("git", ["-c", "user.name=caret", "-c", "user.email=caret@test", "-c", "commit.gpgsign=false", "-c", "init.defaultBranch=main", ...args], { cwd: REPO, stdio: "pipe" });

Fs.rmSync(REPO, { recursive: true, force: true });
Fs.mkdirSync(REPO, { recursive: true });
Fs.rmSync(JOURNAL, { force: true });
git(["init"]);
Fs.writeFileSync(`${REPO}/base.txt`, "base\n");
git(["add", "-A"]);
git(["commit", "-qm", "rs base"]);

const step = (name: string, pass: boolean, detail = "") => {
  console.log(`${pass ? "STEP-PASS" : "STEP-FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!pass) throw new Error(`resume/steer proof failed at ${name}: ${detail}`);
};
const textOf = (payload: unknown): string => {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    const v = p["delta"] ?? p["text"] ?? p["message"];
    return typeof v === "string" ? v : "";
  }
  return "";
};

const program = Effect.gen(function* () {
  const seen: Array<{ type: unknown; payload?: unknown }> = [];
  const opts = {
    configCwd: REPO,
    journalPath: JOURNAL,
    onApproval: async (q: { requestType: unknown }) => {
      console.log(`APPROVAL ${String(q.requestType)} -> accept`);
      return "accept" as const;
    },
  };
  const { run } = yield* startCaretRun(opts, REPO, "rs1");

  // STEER: launch a slow multi-file turn, inject instructions mid-flight.
  const turnFiber = yield* sendCaretTurn(
    run,
    seen,
    "Create files s1.txt, s2.txt, s3.txt in the working directory one by one, each containing exactly one line of text. Work slowly, one file per step.",
    400_000,
  ).pipe(Effect.forkScoped);
  yield* Effect.sleep("12 seconds");
  yield* steerCaretTurn(run, "Add a first line HEADER to every file you create, before its content line.");
  console.log("STEER-SENT");
  yield* Fiber.join(turnFiber);
  const steered = seen.some((e) => e.type === "turn.steered");
  step("steer-acknowledged", steered, "turn.steered event observed");
  const files = ["s1.txt", "s2.txt", "s3.txt"].map((f) =>
    Fs.existsSync(`${run.workDir}/${f}`) ? Fs.readFileSync(`${run.workDir}/${f}`, "utf8") : "<absent>",
  );
  step("steer-applied", files.every((c) => c.includes("HEADER")), JSON.stringify(files).slice(0, 160));

  // Native thread id for resume.
  const started = seen.find((e) => e.type === "thread.started");
  const nativeId = (started?.payload as { providerThreadId?: string } | undefined)?.providerThreadId;
  step("native-id-captured", typeof nativeId === "string" && nativeId.length > 0, String(nativeId).slice(0, 12));
  yield* stopCaretRun(run);

  // RESUME: fresh run + fresh worktree, same native thread.
  const seen2: Array<{ type: unknown; payload?: unknown }> = [];
  const resumed = yield* startCaretRun({ ...opts, resumeCursor: { threadId: nativeId } }, REPO, "rs2");
  let transcript = "";
  yield* sendCaretTurn(resumed.run, seen2, "What files did you create in our previous session? List their names only, no tools, no other text.", 400_000);
  for (const e of seen2) transcript += textOf(e.payload);
  const names = ["s1.txt", "s2.txt", "s3.txt"].filter((n) => transcript.includes(n));
  step("resume-continuity", names.length === 3, `remembered: ${names.join(",") || transcript.slice(0, 120)}`);
  yield* stopCaretRun(resumed.run);
});

await Effect.runPromise(
  program.pipe(Effect.scoped, Effect.provide(bootDaemonLayer(REPO)), Effect.timeout("560 seconds")),
).then(
  () => console.log("RS-PASS: steer mid-turn applied, resume recalled history"),
  (e) => {
    console.log(`RS-FAIL: ${String((e as Error)?.message ?? e).slice(0, 300)}`);
    process.exit(1);
  },
);
