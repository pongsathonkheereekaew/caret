// Agent baseline corpus (Q11 seed, OpenCode free-tier path): 30 small
// file-verifiable tasks, fresh thread each, approvals auto-accepted and
// counted. UNPAIRED baseline — no pass bar; results seed the future
// paired-vs-reference comparison. Writes JSON to CORPUS_OUT.
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import * as Schema from "effect/Schema";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { OpenCodeAdapter } from "../../server/src/provider/Services/OpenCodeAdapter.ts";
import { makeOpenCodeAdapterLive } from "../../server/src/provider/Layers/OpenCodeAdapter.ts";
import { ServerConfig } from "../../server/src/config.ts";
import { ThreadId } from "@synara/contracts";
import * as Fs from "node:fs";
import * as Path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = "/tmp/caret-corpus-agent";
const MODEL = { provider: "opencode", model: "opencode/big-pickle" } as const;
const OUT = process.env["CORPUS_OUT"] ?? "/tmp/caret-corpus-agent-results.json";
Fs.rmSync(ROOT, { recursive: true, force: true });
Fs.mkdirSync(ROOT, { recursive: true });

interface Task {
  id: string;
  goal: string;
  check: () => void;
}

const read = (p: string) => Fs.readFileSync(Path.join(ROOT, p), "utf8");
const must = (cond: boolean, detail: string) => {
  if (!cond) throw new Error(detail);
};
const eq = (p: string, want: string) => must(read(p).trim() === want, `${p} != ${JSON.stringify(want)} got ${JSON.stringify(read(p).trim().slice(0, 80))}`);

const TASKS: Task[] = [
  { id: "c01", goal: "Create t01/hello.txt containing exactly the text hello one. Do nothing else.", check: () => eq("t01/hello.txt", "hello one") },
  { id: "c02", goal: "Create t02/data.json containing exactly {\"a\": 1}. Do nothing else.", check: () => eq("t02/data.json", '{"a": 1}') },
  { id: "c03", goal: "Create t03/notes.md with exactly two lines: first line '# T', second line 'body'. Do nothing else.", check: () => eq("t03/notes.md", "# T\nbody") },
  { id: "c04", goal: "Create t04/app.js containing exactly: console.log(2 + 3). Do nothing else.", check: () => eq("t04/app.js", "console.log(2 + 3)") },
  { id: "c05", goal: "Create t05/empty.txt as an empty file. Do nothing else.", check: () => must(Fs.existsSync(Path.join(ROOT, "t05/empty.txt")), "missing") },
  { id: "e06", goal: "In t06/base.txt change the word RED to BLUE and nothing else.", check: () => eq("t06/base.txt", "paint it BLUE today") },
  { id: "e07", goal: "Append exactly one line 'line3' to t07/list.txt (it has line1, line2).", check: () => eq("t07/list.txt", "line1\nline2\nline3") },
  { id: "e08", goal: "In t08/code.js replace console.log(x) with console.log(x * 2). Nothing else.", check: () => eq("t08/code.js", "console.log(x * 2)") },
  { id: "e09", goal: "Add a second key \"b\": 2 after \"a\" in t09/data.json keeping valid JSON.", check: () => must(JSON.parse(read("t09/data.json")).b === 2, "bad json") },
  { id: "e10", goal: "Delete the line containing TODO from t10/todo.txt, keep the other two lines.", check: () => eq("t10/todo.txt", "keep1\nkeep2") },
  { id: "s11", goal: "Run a shell command to write the text shell-one into t11/out.txt.", check: () => eq("t11/out.txt", "shell-one") },
  { id: "s12", goal: "Create directory t12/sub and an empty file t12/sub/f.txt via shell.", check: () => must(Fs.existsSync(Path.join(ROOT, "t12/sub/f.txt")), "missing") },
  { id: "s13", goal: "Write numbers 1 2 3 each on its own line into t13/nums.txt via shell.", check: () => eq("t13/nums.txt", "1\n2\n3") },
  { id: "s14", goal: "Copy t14/a.txt to t14/b.txt via shell, then append the line tail to t14/b.txt.", check: () => eq("t14/b.txt", "head\ntail") },
  { id: "s15", goal: "Delete t15/gone.txt via shell.", check: () => must(!Fs.existsSync(Path.join(ROOT, "t15/gone.txt")), "still there") },
  { id: "m16", goal: "Create t16/a.txt with 'A' and t16/b.txt with 'B', then create t16/index.txt listing both filenames.", check: () => { eq("t16/a.txt", "A"); eq("t16/b.txt", "B"); must(read("t16/index.txt").includes("a.txt") && read("t16/index.txt").includes("b.txt"), "index incomplete"); } },
  { id: "m17", goal: "Rename t17/old.txt to t17/new.txt keeping its content 'keepme'.", check: () => { eq("t17/new.txt", "keepme"); must(!Fs.existsSync(Path.join(ROOT, "t17/old.txt")), "old remains"); } },
  { id: "m18", goal: "Create t18/src.txt with 'v1', copy it to t18/dst.txt, then change t18/dst.txt to 'v2'.", check: () => { eq("t18/src.txt", "v1"); eq("t18/dst.txt", "v2"); } },
  { id: "m19", goal: "Create t19/one.txt, t19/two.txt, t19/three.txt each containing its own basename without extension.", check: () => { eq("t19/one.txt", "one"); eq("t19/two.txt", "two"); eq("t19/three.txt", "three"); } },
  { id: "m20", goal: "In t20/cfg.ini change port=80 to port=8080 and host=x to host=y.", check: () => { const s = read("t20/cfg.ini"); must(s.includes("port=8080") && s.includes("host=y"), "not applied"); } },
  { id: "i21", goal: "Create t21/out.txt containing exactly the text EXACT, with no extra whitespace or newlines beyond one trailing newline.", check: () => must(/^EXACT\n?$/.test(read("t21/out.txt")), "inexact") },
  { id: "i22", goal: "Write t22/nums.txt with numbers 3 1 2 sorted ascending, one per line.", check: () => eq("t22/nums.txt", "1\n2\n3") },
  { id: "i23", goal: "Create t23/five.txt with exactly 5 lines, each line the word row.", check: () => must(read("t23/five.txt").trim().split("\n").length === 5, "not 5 lines") },
  { id: "i24", goal: "Create t24/valid.json as a JSON array [1, 2, 3] and nothing else.", check: () => must(JSON.stringify(JSON.parse(read("t24/valid.json"))) === "[1,2,3]", "bad json") },
  { id: "i25", goal: "Create t25/upper.txt containing the uppercase of hello world (HELLO WORLD).", check: () => eq("t25/upper.txt", "HELLO WORLD") },
  { id: "r26", goal: "Write t26/fizz.js that prints 1 2 Fizz 4 Buzz for lines 1-5 (FizzBuzz), then run it so t26/out.txt holds that output.", check: () => eq("t26/out.txt", "1\n2\nFizz\n4\nBuzz") },
  { id: "r27", goal: "Count the words in t27/words.txt (it has 'aa bb cc dd') and write just the number 4 into t27/count.txt.", check: () => eq("t27/count.txt", "4") },
  { id: "r28", goal: "Reverse the lines of t28/in.txt (a,b,c) into t28/out.txt (c,b,a).", check: () => eq("t28/out.txt", "c\nb\na") },
  { id: "r29", goal: "Merge t29/a.txt (1,3) and t29/b.txt (2,4) sorted into t29/m.txt (1,2,3,4 one per line).", check: () => eq("t29/m.txt", "1\n2\n3\n4") },
  { id: "r30", goal: "Convert t30/kv.txt lines k=v (name=ada, lang=go) into JSON t30/out.json {\"name\":\"ada\",\"lang\":\"go\"}.", check: () => { const o = JSON.parse(read("t30/out.json")); must(o.name === "ada" && o.lang === "go", "bad convert"); } },
];

const SETUP: Array<[string, string]> = [
  ["t06/base.txt", "paint it RED today\n"],
  ["t07/list.txt", "line1\nline2\n"],
  ["t08/code.js", "console.log(x)\n"],
  ["t09/data.json", '{"a": 1}\n'],
  ["t10/todo.txt", "keep1\nTODO fix\nkeep2\n"],
  ["t14/a.txt", "head\n"],
  ["t15/gone.txt", "bye\n"],
  ["t20/cfg.ini", "host=x\nport=80\n"],
  ["t26/fizz.js", ""],
  ["t27/words.txt", "aa bb cc dd\n"],
  ["t28/in.txt", "a\nb\nc\n"],
  ["t29/a.txt", "1\n3\n"],
  ["t29/b.txt", "2\n4\n"],
  ["t30/kv.txt", "name=ada\nlang=go\n"],
];
for (const [p, content] of SETUP) {
  Fs.mkdirSync(Path.join(ROOT, Path.dirname(p)), { recursive: true });
  Fs.writeFileSync(Path.join(ROOT, p), content);
}

type Seen = Array<{ type: unknown; payload?: unknown }>;
let approvals = 0;

const program = Effect.gen(function* () {
  const adapter = yield* OpenCodeAdapter;
  const seen: Seen = [];
  let currentId = Schema.decodeUnknownSync(ThreadId)("caret-corpus-boot");
  yield* Stream.runForEach(adapter.streamEvents, (event) =>
    Effect.gen(function* () {
      const t = (event as { type?: unknown }).type;
      seen.push({ type: t, payload: (event as { payload?: unknown }).payload });
      if (t === "request.opened") {
        const rid = (event as { requestId?: string }).requestId;
        if (rid) {
          approvals += 1;
          yield* adapter.respondToRequest(currentId as never, rid as never, "accept").pipe(Effect.ignore);
        }
      }
    }),
  ).pipe(Effect.forkScoped);

  const waitTurn = (from: number, timeoutMs: number) =>
    Effect.gen(function* () {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (seen.slice(from).some((e) => e.type === "turn.completed")) return;
        yield* Effect.sleep("3 seconds");
      }
      return yield* Effect.fail(new Error("turn.completed not observed"));
    });

  const rows: Array<Record<string, unknown>> = [];
  for (const t of TASKS) {
    const row: Record<string, unknown> = { id: t.id, goal: t.goal };
    try {
      currentId = Schema.decodeUnknownSync(ThreadId)(`caret-corpus-${t.id}`);
      const t0 = Date.now();
      const ap0 = approvals;
      const n0 = seen.length;
      yield* adapter.startSession({ threadId: currentId, cwd: ROOT, runtimeMode: "approval-required" });
      yield* adapter.sendTurn({ threadId: currentId, input: t.goal, attachments: [], modelSelection: { ...MODEL } });
      yield* waitTurn(n0, 240_000);
      row["ms"] = Date.now() - t0;
      row["approvals"] = approvals - ap0;
      try {
        t.check();
        row["pass"] = true;
        row["detail"] = "";
      } catch (e) {
        row["pass"] = false;
        row["detail"] = e instanceof Error ? e.message : String(e);
      }
      yield* adapter.stopSession({ threadId: currentId }).pipe(Effect.ignore);
    } catch (e) {
      row["pass"] = false;
      row["detail"] = `harness: ${e instanceof Error ? e.message : String(e)}`;
      row["ms"] = -1;
      row["approvals"] = 0;
    }
    rows.push(row);
    console.log(`${row["id"]}: ${row["pass"] ? "PASS" : "FAIL"} ${row["ms"]}ms ap=${row["approvals"]} ${row["detail"] ?? ""}`);
  }
  const passed = rows.filter((r) => r.pass).length;
  const lat = rows.filter((r) => (r["ms"] as number) >= 0).map((r) => r["ms"] as number).sort((a, b) => a - b);
  const summary = {
    n: rows.length,
    passed,
    passRate: passed / rows.length,
    p50: lat[Math.floor(0.5 * lat.length)],
    p95: lat[Math.min(lat.length - 1, Math.floor(0.95 * lat.length))],
    totalApprovals: rows.reduce((n, r) => n + Number(r["approvals"] ?? 0), 0),
    model: `${MODEL.provider}/${MODEL.model}`,
    rows,
  };
  Fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));
  console.log(`CORPUS-DONE ${passed}/${rows.length} pass=${(passed / rows.length).toFixed(2)}`);
});

const layer = makeOpenCodeAdapterLive().pipe(
  Layer.provide(ServerConfig.layerTest(ROOT, { prefix: "caret-corpus-" })),
  Layer.provide(NodeServices.layer),
);

await Effect.runPromise(program.pipe(Effect.scoped, Effect.provide(layer), Effect.timeout("55 minutes"))).then(
  () => {},
  (e) => {
    console.error(`CORPUS-ABORT: ${e}`);
    process.exitCode = 1;
  },
);
