import { describe, expect, it } from "bun:test";
import { PendingQueue } from "./queue.ts";

describe("PendingQueue", () => {
  it("reorders, edits, and refuses empty replace", () => {
    const q = new PendingQueue();
    q.enqueue("a");
    q.enqueue("b");
    q.enqueue("c");
    q.move(2, 0);
    expect(q.list()).toEqual(["c", "a", "b"]);
    q.replace(1, "  alpha  ");
    expect(q.list()).toEqual(["c", "alpha", "b"]);
    expect(() => q.replace(1, "   ")).toThrow(/empty/);
    expect(() => q.move(9, 0)).toThrow(/no #10/);
  });
});
