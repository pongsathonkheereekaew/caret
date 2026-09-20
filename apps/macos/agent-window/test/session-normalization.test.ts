import { expect, test } from "bun:test";
import { normalizeThreadSession } from "../vendor/synara/apps/web/src/storeNormalization";
import { ThreadId } from "../vendor/synara/packages/contracts/src/index";

test("OMP session remains OMP in the renderer store so sends use its availability", () => {
  const session = normalizeThreadSession({
    threadId: ThreadId.makeUnsafe("task"), providerName: "omp", status: "ready",
    runtimeMode: "approval-required", activeTurnId: null, lastError: null,
    updatedAt: "2026-09-19T10:00:00.000Z",
  }, null);
  expect(session?.provider).toBe("omp");
  expect(session?.status).toBe("ready");
});
