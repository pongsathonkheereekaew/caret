// Webhook intake conformance (M9 seed): duplicates, late/out-of-order,
// per-entity independence, window bound, missing ids. Pure sync.
import { describe, expect, it } from "vitest";

import { WebhookDedup, WebhookError } from "./webhook.ts";

const evt = (over: Partial<{ id: string; kind: string; key: string; at: number }> = {}) => ({
  id: "d1",
  kind: "pr.commented",
  key: "acme/app#7",
  at: 1_000_000,
  ...over,
});

describe("WebhookDedup", () => {
  it("applies first delivery, skips redelivery by id", () => {
    const intake = new WebhookDedup();
    expect(intake.check(evt())).toEqual({ action: "apply" });
    // Even a "newer" copy of the same delivery id stays a duplicate.
    expect(intake.check(evt({ at: 2_000_000 }))).toEqual({
      action: "skip",
      reason: "duplicate delivery d1",
    });
  });

  it("skips late and out-of-order events per entity", () => {
    const intake = new WebhookDedup();
    expect(intake.check(evt({ id: "d1", at: 100 }))).toEqual({ action: "apply" });
    expect(intake.check(evt({ id: "d2", at: 200 }))).toEqual({ action: "apply" });
    expect(intake.check(evt({ id: "d3", at: 150 }))).toEqual({
      action: "skip",
      reason: "stale pr.commented for acme/app#7",
    });
    expect(intake.check(evt({ id: "d4", at: 200 }))).toEqual({ action: "apply" });
  });

  it("tracks entities independently", () => {
    const intake = new WebhookDedup();
    expect(intake.check(evt({ id: "d1", at: 500 }))).toEqual({ action: "apply" });
    expect(intake.check(evt({ id: "d2", key: "acme/app#8", at: 100 }))).toEqual({ action: "apply" });
    expect(intake.check(evt({ id: "d3", kind: "pr.merged", at: 100 }))).toEqual({ action: "apply" });
  });

  it("documents its window: replays past the cap apply again", () => {
    const intake = new WebhookDedup(3);
    intake.check(evt({ id: "d1", at: 100 }));
    intake.check(evt({ id: "d2", at: 200 }));
    intake.check(evt({ id: "d3", at: 300 }));
    intake.check(evt({ id: "d4", at: 400 }));
    // d1 fell out of the 3-id window: a redelivery with fresh time applies
    // again — honest bound, providers must redeliver inside the window.
    expect(intake.check(evt({ id: "d1", at: 500 }))).toEqual({ action: "apply" });
    expect(() => intake.check(evt({ id: "", at: 500 }))).toThrow(WebhookError);
  });
});
