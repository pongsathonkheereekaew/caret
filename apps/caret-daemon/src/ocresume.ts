// OpenCode resume probe (AG-06, free tier): start -> turn -> stop ->
// resume via cursor -> recall turn. Keeps proof scripts alongside slice.ts.
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

const SCRATCH = "/tmp/caret-ocrs-1";
const MODEL = { provider: "opencode", model: "opencode/big-pickle" } as const;
Fs.rmSync(SCRATCH, { recursive: true, force: true });
Fs.mkdirSync(SCRATCH, { recursive: true });

type Seen = Array<{ type: unknown; payload?: unknown }>;

const step = (name: string, pass: boolean, detail = "") => {
  console.log(`${pass ? "STEP-PASS" : "STEP-FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!pass) throw new Error(`oc-resume failed at ${name}: ${detail}`);
};

const textOf = (payload: unknown): string => {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    const v = p["delta"] ?? p["text"] ?? p["message"];
    return typeof v === "string" ? v : "";
  }
  return "";
};

interface Tracker {
  streamEvents: Stream.Stream<never>;
  respondToRequest: (threadId: never, requestId: never, decision: "accept") => Effect.Effect<unknown>;
}

const track = (adapter: Tracker, seen: Seen, current: () => ThreadId) =>
  Stream.runForEach(adapter.streamEvents, (event) =>
    Effect.gen(function* () {
      const t = (event as { type?: unknown }).type;
      seen.push({ type: t, payload: (event as { payload?: unknown }).payload });
      if (t === "request.opened") {
        const rid = (event as { requestId?: string }).requestId;
        if (rid) {
          console.log(`APPROVAL ${rid} -> accept`);
          yield* adapter.respondToRequest(current() as never, rid as never, "accept").pipe(Effect.ignore);
        }
      }
    }),
  ).pipe(Effect.forkScoped);

const waitTurn = (seen: Seen, from: number, timeoutMs: number) =>
  Effect.gen(function* () {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (seen.slice(from).some((e) => e.type === "turn.completed")) return;
      yield* Effect.sleep("3 seconds");
    }
    return yield* Effect.fail(new Error("turn.completed not observed"));
  });

const program = Effect.gen(function* () {
  const adapter = yield* OpenCodeAdapter;
  const seen: Seen = [];
  let currentId = Schema.decodeUnknownSync(ThreadId)("caret-ocrs-1");
  yield* track(adapter, seen, () => currentId);

  yield* adapter.startSession({ threadId: currentId, cwd: SCRATCH, runtimeMode: "approval-required" });
  const n0 = seen.length;
  yield* adapter.sendTurn({
    threadId: currentId,
    input: "Create a file ocmem.txt containing exactly the text oc-resume-marker. Do nothing else.",
    attachments: [],
    modelSelection: { ...MODEL },
  });
  yield* waitTurn(seen, n0, 240_000);
  step("turn1-file", Fs.readFileSync(`${SCRATCH}/ocmem.txt`, "utf8").trim() === "oc-resume-marker", "file created via approval");
  const started = seen.find((e) => e.type === "thread.started");
  const nativeId = (started?.payload as { providerThreadId?: string } | undefined)?.providerThreadId;
  step("native-id", typeof nativeId === "string" && nativeId.length > 0, String(nativeId).slice(0, 24));
  yield* adapter.stopSession({ threadId: currentId }).pipe(Effect.ignore);

  currentId = Schema.decodeUnknownSync(ThreadId)("caret-ocrs-2");
  yield* adapter.startSession({
    threadId: currentId,
    cwd: SCRATCH,
    runtimeMode: "approval-required",
    resumeCursor: { openCodeSessionId: nativeId, cwd: SCRATCH },
  });
  const n1 = seen.length;
  yield* adapter.sendTurn({
    threadId: currentId,
    input: "What file did you create in our previous session? Name only, no tools.",
    attachments: [],
    modelSelection: { ...MODEL },
  });
  yield* waitTurn(seen, n1, 240_000);
  let transcript = "";
  for (const e of seen.slice(n1)) transcript += textOf(e.payload);
  step("resume-continuity", transcript.includes("ocmem.txt"), transcript.slice(0, 160));
  yield* adapter.stopSession({ threadId: currentId }).pipe(Effect.ignore);
});

const layer = makeOpenCodeAdapterLive().pipe(
  Layer.provide(ServerConfig.layerTest(SCRATCH, { prefix: "caret-ocrs-" })),
  Layer.provide(NodeServices.layer),
);

await Effect.runPromise(program.pipe(Effect.scoped, Effect.provide(layer), Effect.timeout("540 seconds"))).then(
  () => console.log("OCRS-PASS: stop/resume recalled history"),
  (e) => {
    console.log(`OCRS-FAIL: ${String((e as Error)?.message ?? e).slice(0, 300)}`);
    process.exit(1);
  },
);
