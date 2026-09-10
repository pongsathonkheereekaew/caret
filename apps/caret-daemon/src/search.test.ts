// Chat search conformance (Phase A): full-text, type/date filters,
// ranking, snippets, empty/no-result edges. Pure sync fixtures.
import { describe, expect, it } from "vitest";

import { indexableText, searchChats } from "./search.ts";

const EVENTS = [
  { t: "2026-09-10T01:00:00Z", type: "request.resolved", payload: { requestType: "command", decision: "accept", detail: "printf hello > hello.txt" } },
  { t: "2026-09-10T02:00:00Z", type: "caret.run.isolated", workDir: "/tmp/wt-hello", goal: "create hello file" },
  { t: "2026-09-10T03:00:00Z", type: "turn.completed", payload: { state: "completed" } },
  { t: "2026-09-10T04:00:00Z", type: "request.resolved", payload: { requestType: "read", decision: "accept", detail: "read hello.txt" } },
];

describe("ChatSearch", () => {
  it("finds across prompts, decisions, and details with snippets", () => {
    const hits = searchChats(EVENTS, { query: "hello" });
    expect(hits.length).toBe(3);
    // Goal hit outranks detail hits.
    expect(hits[0]).toMatchObject({ type: "caret.run.isolated" });
    expect(hits[0]?.snippet).toContain("hello");
    expect(hits[0]?.score ?? 0).toBeGreaterThan(hits[2]?.score ?? 0);
  });

  it("filters by type and date range", () => {
    expect(searchChats(EVENTS, { query: "accept", types: ["request.resolved"] })).toHaveLength(2);
    expect(searchChats(EVENTS, { query: "accept", types: ["turn.completed"] })).toHaveLength(0);
    expect(searchChats(EVENTS, { query: "hello", since: "2026-09-10T03:00:00Z" })).toHaveLength(1);
    expect(searchChats(EVENTS, { query: "hello", until: "2026-09-10T01:30:00Z" })).toHaveLength(1);
  });

  it("caps, empties, and misses honestly", () => {
    expect(searchChats(EVENTS, { query: "hello", limit: 1 })).toHaveLength(1);
    expect(searchChats(EVENTS, { query: "   " })).toEqual([]);
    expect(searchChats(EVENTS, { query: "zzz-nope" })).toEqual([]);
    expect(indexableText({})).toBe("");
  });
});
