import { describe, expect, test } from "bun:test";
import { CommandConflictError, CommandLedger, CommandRetryError, commandPayloadHash } from "../core/commands.ts";

describe("mobile command idempotency", () => {
  test("same explicit id and payload joins the original record", () => {
    const ledger = new CommandLedger();
    const first = ledger.create({ commandId: "cmd-1", incarnation: "inc-1", command: "prompt", payload: { message: "hello" } });
    const second = ledger.create({ commandId: "cmd-1", incarnation: "inc-1", command: "prompt", payload: { message: "hello" } });
    expect(second.commandId).toBe(first.commandId);
    expect(ledger.list()).toHaveLength(1);
  });

  test("rejects same id with a changed command", () => {
    const ledger = new CommandLedger();
    ledger.create({ commandId: "cmd-1", incarnation: "inc-1", command: "prompt", payload: { message: "hello" } });
    expect(() => ledger.create({ commandId: "cmd-1", incarnation: "inc-1", command: "steer", payload: { message: "hello" } })).toThrow(CommandConflictError);
  });

  test("unknown commands require an explicit retry and preserve the id", () => {
    const ledger = new CommandLedger();
    ledger.create({ commandId: "cmd-1", incarnation: "inc-1", command: "bash", payload: { command: "npm test" } });
    ledger.markUnknown("cmd-1", "connection dropped");
    expect(() => ledger.retryUnknown("cmd-1")).toThrow(CommandRetryError);
    const retry = ledger.retryUnknown("cmd-1", true);
    expect(retry.commandId).toBe("cmd-1");
    expect(retry.status).toBe("queued");
  });

  test("host command receipts can be absorbed without replay", () => {
    const ledger = new CommandLedger();
    ledger.create({ commandId: "cmd-1", incarnation: "inc-1", command: "prompt", payload: { message: "hello" } });
    const receipt = ledger.absorb({ sessionId: "s1", commandId: "cmd-1", deviceId: "phone", incarnation: "inc-1", kind: "prompt", payload: { message: "hello" }, payloadHash: commandPayloadHash({ command: "prompt", incarnation: "inc-1", payload: { message: "hello" } }), status: "outcome_unknown", error: "host crash", createdAt: "now", updatedAt: "now" });
    expect(receipt.status).toBe("unknown");
  });
});
