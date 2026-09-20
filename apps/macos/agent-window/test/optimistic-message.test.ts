import { expect, test } from "bun:test";
import { MessageId } from "../vendor/synara/packages/contracts/src/index";
import type { ChatMessage } from "../vendor/synara/apps/web/src/types";
import { acknowledgedOptimisticIds } from "../vendor/synara/apps/web/src/components/chat/useChatTimelineMessages";
const message = (id: string, second: number): ChatMessage => ({ id: MessageId.makeUnsafe(id), role: "user", text: "repeat", createdAt: `2026-09-19T10:00:0${second}.000Z`, streaming: false });
test("OMP authoritative messages replace optimistic bubbles without dropping repeated sends", () => {
  const pending = [message("ui-1", 2), message("ui-2", 4)];
  const ids = acknowledgedOptimisticIds([message("old", 1), message("omp-1", 3)], pending, true);
  expect(ids.has(pending[0]!.id)).toBe(true);
  expect(ids.has(pending[1]!.id)).toBe(false);
});
