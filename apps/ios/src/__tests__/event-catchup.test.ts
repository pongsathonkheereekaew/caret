import { describe, expect, test } from "bun:test";
import { EVENT_CATCHUP_PAGE_CAP, shouldFetchNextHostEventPage } from "../core/event-catchup.ts";

describe("host event catch-up", () => {
  test("continues only while the page advertises hasMore and the cap remains", () => {
    expect(EVENT_CATCHUP_PAGE_CAP).toBe(8);
    expect(shouldFetchNextHostEventPage({ hasMore: true, pagesFetched: 1 })).toBe(true);
    expect(shouldFetchNextHostEventPage({ hasMore: true, pagesFetched: 8 })).toBe(false);
    expect(shouldFetchNextHostEventPage({ hasMore: false, pagesFetched: 1 })).toBe(false);
  });

  test("does not invent a backward page when hasMore is false", () => {
    expect(shouldFetchNextHostEventPage({ hasMore: false, pagesFetched: 0, cap: 8 })).toBe(false);
  });
});
