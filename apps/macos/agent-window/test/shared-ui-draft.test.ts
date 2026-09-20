import { afterEach, expect, it } from "bun:test";
import { ThreadId } from "../vendor/synara/packages/contracts/src";
import { useComposerDraftStore } from "../vendor/synara/apps/web/src/composerDraftStore";
import { installSharedUiDraftBridge } from "../vendor/synara/apps/web/src/sharedUiDraftBridge";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const id = ThreadId.makeUnsafe("shared-draft-test");
let dispose: (() => void) | undefined;
function setup() {
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {}, location: { hash: `#/${id}` },
  } });
  useComposerDraftStore.setState({ draftsByThreadId: {}, draftThreadsByThreadId: {}, projectDraftThreadIdByProjectId: {} });
}
afterEach(() => {
  dispose?.(); dispose = undefined;
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

it("does not replace an unsaved edit when focus hydration reads older state", async () => {
  setup();
  let reads = 0;
  const bridge = installSharedUiDraftBridge({ invoke: async (_channel, input) => {
    if ((input as { action: string }).action === "read") reads++;
    return { draft: null, draftThread: null, projectMappings: {} };
  } });
  dispose = bridge.dispose;
  useComposerDraftStore.getState().setPrompt(id, "unsaved local text");
  await bridge.hydrateThread(id);
  expect(reads).toBe(0);
  expect(useComposerDraftStore.getState().draftsByThreadId[id]?.prompt).toBe("unsaved local text");
  await bridge.flush();
  await bridge.hydrateThread(id);
  expect(useComposerDraftStore.getState().draftsByThreadId[id]).toBeUndefined();
});

it("serializes saves so a delayed old write cannot win after the latest flush", async () => {
  setup();
  const seen: string[] = [];
  let release!: () => void;
  const first = new Promise<void>(resolve => { release = resolve; });
  const bridge = installSharedUiDraftBridge({ invoke: async (_channel, input) => {
    const row = input as { action: string; draft: { draft: { prompt: string } } };
    if (row.action === "write") {
      seen.push(row.draft.draft.prompt);
      if (seen.length === 1) await first;
    }
    return null;
  } });
  dispose = bridge.dispose;
  useComposerDraftStore.getState().setPrompt(id, "first");
  const flushingFirst = bridge.flush();
  await tick();
  useComposerDraftStore.getState().setPrompt(id, "second");
  let completed = false;
  const flushingSecond = bridge.flush().then(() => { completed = true; });
  await tick();
  expect(seen).toEqual(["first"]);
  expect(completed).toBe(false);
  release();
  await Promise.all([flushingFirst, flushingSecond]);
  expect(seen).toEqual(["first", "second"]);
  expect(completed).toBe(true);
});
