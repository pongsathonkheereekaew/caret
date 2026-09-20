import { describe, expect, test } from "bun:test";
import {
  activityInboxBody,
  activityInboxFilterChips,
  activityInboxForSession,
  activityInboxItemFromHostCommand,
  activityInboxItemFromPendingUi,
  activityInboxItemFromUnknownCommand,
  activityInboxItemKey,
  activityInboxItemsFromHostCommands,
  activityInboxTapAction,
  activityInboxTapAnswersRequest,
  activityInboxTitle,
  mergeActivityInbox,
  type ActivityInboxItem,
  type ActivityInboxUiRequest,
} from "../core/activity-inbox.ts";
import type { Command, PendingCommand, PendingUiRequest } from "../core/types.ts";

const uiRequest: PendingUiRequest = {
  kind: "interactive",
  token: "tok-1",
  sessionId: "s1",
  incarnation: "inc-1",
  request: { method: "confirm", id: "ui-1", title: "Allow write?", message: "Write card.ts" },
};

const unknownCommand: PendingCommand = {
  commandId: "cmd-1",
  incarnation: "inc-1",
  command: "prompt",
  status: "unknown",
  replayable: false,
  error: "connection dropped",
  createdAt: 1,
  updatedAt: 2,
};

function uiItem(overrides: Partial<ActivityInboxUiRequest> = {}): ActivityInboxUiRequest {
  const item = activityInboxItemFromPendingUi(uiRequest, "s1");
  if (!item) throw new Error("expected ui inbox item");
  return { ...item, ...overrides };
}

function unknownItem(overrides: Partial<Extract<ActivityInboxItem, { kind: "unknown_command" }>> = {}): ActivityInboxItem {
  const item = activityInboxItemFromUnknownCommand(unknownCommand, "s1");
  if (!item) throw new Error("expected unknown-command inbox item");
  return { ...item, ...overrides };
}

describe("mergeActivityInbox", () => {
  test("keeps object identity when token, session, and incarnation match", () => {
    const existing = uiItem();
    const incoming = activityInboxItemFromPendingUi({
      ...uiRequest,
      request: { method: "confirm", id: "ui-1", title: "Allow write?", message: "Write card.ts again" },
    }, "s1");
    expect(incoming).toBeDefined();
    const merged = mergeActivityInbox([existing], [incoming!]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toBe(existing);
    expect(merged[0]).not.toBe(incoming);
  });

  test("replaces the row when the same token belongs to a different session or incarnation", () => {
    const existing = uiItem();
    const incoming = uiItem({ sessionId: "s2", incarnation: "inc-2" });
    const merged = mergeActivityInbox([existing], [incoming]);
    expect(merged[0]).toBe(incoming);
    expect(merged[0]).not.toBe(existing);
  });

  test("keys unknown outcomes by commandId and keeps identity on a match", () => {
    const existing = unknownItem();
    const incoming = unknownItem({ error: "host crash" });
    const merged = mergeActivityInbox([existing], [incoming]);
    expect(activityInboxItemKey(existing)).toBe("cmd:cmd-1");
    expect(merged[0]).toBe(existing);
  });
});

describe("activityInboxForSession", () => {
  test("filters inbox rows to the named session", () => {
    const inbox = [uiItem(), uiItem({ token: "tok-2", sessionId: "s2" }), unknownItem()];
    expect(activityInboxForSession(inbox, "s1").map(item => activityInboxItemKey(item))).toEqual(["ui:tok-1", "cmd:cmd-1"]);
    expect(activityInboxForSession(inbox, "s2")).toHaveLength(1);
    expect(activityInboxForSession(inbox, "")).toEqual([]);
  });
});

describe("activity inbox filter chips", () => {
  test("lists All plus sessions that already have inbox rows", () => {
    const inbox = [uiItem(), uiItem({ token: "tok-2", sessionId: "s2" }), unknownItem()];
    const chips = activityInboxFilterChips(inbox, [
      { id: "s1", title: "Card pass" },
      { id: "s2", title: "Other task" },
      { id: "s3", title: "Empty" },
    ]);
    expect(chips.map(chip => chip.sessionId)).toEqual(["all", "s1", "s2"]);
    expect(chips[0]).toEqual({ sessionId: "all", label: "All" });
    expect(chips[1]).toEqual({ sessionId: "s1", label: "Card pass" });
    expect(activityInboxForSession(inbox, "s3")).toEqual([]);
  });
});

describe("host unknown commands", () => {
  test("keeps outcome_unknown rows and does not invent other statuses", () => {
    const hostUnknown: Command = {
      sessionId: "s2",
      commandId: "cmd-h",
      deviceId: "phone",
      incarnation: "inc-2",
      kind: "prompt",
      payload: {},
      payloadHash: "hash",
      status: "outcome_unknown",
      error: "connection dropped",
      createdAt: "1",
      updatedAt: "2",
    };
    const item = activityInboxItemFromHostCommand(hostUnknown, "s2");
    expect(item).toMatchObject({
      kind: "unknown_command",
      commandId: "cmd-h",
      sessionId: "s2",
      incarnation: "inc-2",
      command: "prompt",
      error: "connection dropped",
    });
    expect(activityInboxItemFromHostCommand({ ...hostUnknown, status: "completed" })).toBeUndefined();
    expect(activityInboxItemFromHostCommand({ ...hostUnknown, status: "failed" })).toBeUndefined();
    expect(activityInboxItemFromHostCommand({ ...hostUnknown, status: "claimed" })).toBeUndefined();
    expect(activityInboxItemsFromHostCommands([
      hostUnknown,
      { ...hostUnknown, commandId: "cmd-ok", status: "completed" },
    ], "s2")).toHaveLength(1);
  });
});

describe("activity inbox tap", () => {
  test("does not treat list tap as an answer", () => {
    const item = uiItem();
    expect(activityInboxTapAnswersRequest(item)).toBe(false);
    expect(activityInboxTapAction(item)).toEqual({ type: "open_session", sessionId: "s1" });
    expect(activityInboxTapAction(item)).not.toHaveProperty("answer");
    expect(activityInboxTapAction(item)).not.toHaveProperty("token");
    expect(activityInboxTitle(item)).toBe("Allow write?");
    expect(activityInboxBody(item, "Card pass")).toContain("open the matching task");
    expect(activityInboxBody(item, "Card pass")).toContain("Approvals are not answered from this list");
    expect(activityInboxTapAction(unknownItem())).toEqual({ type: "open_session", sessionId: "s1" });
    expect(activityInboxTapAnswersRequest(unknownItem())).toBe(false);
    expect(activityInboxTitle(unknownItem())).toBe("Unknown outcome · prompt");
    expect(activityInboxBody(unknownItem(), "Card pass")).toContain("not an approval");
  });

  test("refuses to invent a session when the row has no session id", () => {
    const item = uiItem({ sessionId: undefined });
    expect(activityInboxTapAction(item)).toEqual({
      type: "unavailable",
      reason: "This item has no session id, so it cannot be opened. Cedia will not invent a task.",
    });
    expect(activityInboxTapAnswersRequest(item)).toBe(false);
  });
});
