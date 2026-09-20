export const TRANSCRIPT_FOLLOW_THRESHOLD_PX = 48;

export function distanceFromBottom(input: {
  contentHeight: number;
  viewportHeight: number;
  scrollOffset: number;
}): number {
  return input.contentHeight - input.viewportHeight - input.scrollOffset;
}

export function shouldFollowTranscript(input: {
  distanceFromBottom: number;
  selecting?: boolean;
}): boolean {
  return input.distanceFromBottom <= TRANSCRIPT_FOLLOW_THRESHOLD_PX && input.selecting !== true;
}

export function jumpToLatestLabel(unread: number): string {
  if (unread <= 0) return "Jump to latest";
  return `Jump to latest · ${unread}`;
}

export function nextUnreadCount(input: {
  following: boolean;
  previousUnread: number;
  appended: number;
}): number {
  if (input.following) return 0;
  return Math.max(0, input.previousUnread + input.appended);
}
