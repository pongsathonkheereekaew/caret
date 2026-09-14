/** Host event pages are forward-only (`sequence > cursor`). Do not invent a before= API. */

export const EVENT_CATCHUP_PAGE_CAP = 8;

export function shouldFetchNextHostEventPage(input: {
  readonly hasMore: boolean;
  readonly pagesFetched: number;
  readonly cap?: number;
}): boolean {
  return input.hasMore && input.pagesFetched < (input.cap ?? EVENT_CATCHUP_PAGE_CAP);
}
