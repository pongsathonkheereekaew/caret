import { describe, expect, test } from "bun:test";
import {
  TRANSCRIPT_FOLLOW_THRESHOLD_PX,
  distanceFromBottom,
  jumpToLatestLabel,
  nextUnreadCount,
  shouldFollowTranscript,
} from "../core/transcript-follow.ts";

describe("transcript follow", () => {
  test("distanceFromBottom is content minus viewport minus offset", () => {
    expect(distanceFromBottom({ contentHeight: 400, viewportHeight: 200, scrollOffset: 152 })).toBe(48);
    expect(distanceFromBottom({ contentHeight: 400, viewportHeight: 200, scrollOffset: 0 })).toBe(200);
    expect(distanceFromBottom({ contentHeight: 180, viewportHeight: 200, scrollOffset: 0 })).toBe(-20);
  });

  test("follows only when within 48px and not selecting", () => {
    expect(TRANSCRIPT_FOLLOW_THRESHOLD_PX).toBe(48);
    expect(shouldFollowTranscript({ distanceFromBottom: 48 })).toBe(true);
    expect(shouldFollowTranscript({ distanceFromBottom: 49 })).toBe(false);
    expect(shouldFollowTranscript({ distanceFromBottom: 0, selecting: true })).toBe(false);
    expect(shouldFollowTranscript({ distanceFromBottom: -4, selecting: false })).toBe(true);
  });

  test("jumpToLatestLabel omits a unit when unread is unknown", () => {
    expect(jumpToLatestLabel(0)).toBe("Jump to latest");
    expect(jumpToLatestLabel(-3)).toBe("Jump to latest");
    expect(jumpToLatestLabel(4)).toBe("Jump to latest · 4");
  });

  test("nextUnreadCount clears while following and accumulates otherwise", () => {
    expect(nextUnreadCount({ following: true, previousUnread: 5, appended: 2 })).toBe(0);
    expect(nextUnreadCount({ following: false, previousUnread: 5, appended: 2 })).toBe(7);
    expect(nextUnreadCount({ following: false, previousUnread: 0, appended: -2 })).toBe(0);
  });
});
