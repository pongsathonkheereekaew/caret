import { describe, expect, test } from "bun:test";
import {
  iosApprovalCanSubmit,
  iosApprovalDisplayStatus,
  iosApprovalReadonly,
  iosApprovalStatusCopy,
} from "../core/approval-sheet.ts";
import type { PendingUiRequest } from "../core/types.ts";

const pending: PendingUiRequest = {
  kind: "interactive",
  token: "tok-1",
  sessionId: "s1",
  incarnation: "inc-1",
  request: { method: "confirm", id: "ui-1", title: "Allow write?", message: "Write card.ts", timeout: 5_000 },
};

const current = { sessionId: "s1", incarnation: "inc-1", connection: "running" };

describe("ios approval sheet binding", () => {
  test("pending matching session and incarnation can submit while connected or running", () => {
    expect(iosApprovalDisplayStatus(pending, current, 2_000)).toBe("pending");
    expect(iosApprovalCanSubmit("pending", "connected")).toBe(true);
    expect(iosApprovalCanSubmit("pending", "running")).toBe(true);
    expect(iosApprovalReadonly(pending, current, "connected")).toBe(false);
    expect(iosApprovalReadonly(pending, current, "running")).toBe(false);
  });

  test("incarnation mismatch is stale and readonly", () => {
    const status = iosApprovalDisplayStatus(pending, { sessionId: "s1", incarnation: "inc-2", connection: "running" }, 2_000);
    expect(status).toBe("stale");
    expect(iosApprovalCanSubmit(status, "running")).toBe(false);
    expect(iosApprovalReadonly(pending, { sessionId: "s1", incarnation: "inc-2", connection: "running" }, "running")).toBe(true);
  });

  test("timeout is timeout and readonly", () => {
    const timedOut = { ...pending, receivedAt: 1_000 } as PendingUiRequest & { readonly receivedAt: number };
    const status = iosApprovalDisplayStatus(timedOut, current, 7_000);
    expect(status).toBe("timeout");
    expect(iosApprovalCanSubmit(status, "running")).toBe(false);
    expect(iosApprovalReadonly({ ...pending, status: "timeout" }, current, "running")).toBe(true);
  });

  test("responded_elsewhere copy is Thai", () => {
    expect(iosApprovalStatusCopy("responded_elsewhere")).toBe("ตอบคำขอนี้จากอีกอุปกรณ์แล้ว");
  });

  test("stale copy is Thai", () => {
    expect(iosApprovalStatusCopy("stale")).toBe("คำขอนี้ใช้ตอบไม่ได้แล้ว");
  });
});
