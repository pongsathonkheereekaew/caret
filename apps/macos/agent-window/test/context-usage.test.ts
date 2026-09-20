import { expect, it } from "bun:test";
import { contextUsageFromFrame } from "../src/cedia-adapter";
import { deriveRuntimeModelContextWindowSnapshot } from "../vendor/synara/apps/web/src/lib/contextWindow";

it("maps OMP current occupancy, including zero, without confusing lifetime usage", () => {
  expect(contextUsageFromFrame({ result: { data: { contextUsage: { tokens: 32000, contextWindow: 200000 } } } }))
    .toEqual({ usedTokens: 32000, maxTokens: 200000, usedPercent: 16 });
  expect(contextUsageFromFrame({ data: { contextUsage: { tokens: 0, contextWindow: 1000000 } } }))
    .toEqual({ usedTokens: 0, maxTokens: 1000000, usedPercent: 0 });
  expect(contextUsageFromFrame({ usage: { totalTokens: 999999 } })).toBeUndefined();
  expect(contextUsageFromFrame({ data: { contextUsage: { tokens: null, contextWindow: 200000 } } })).toBeUndefined();
  expect(contextUsageFromFrame({ data: { contextUsage: { tokens: 100, contextWindow: 0 } } })).toBeUndefined();
  expect(deriveRuntimeModelContextWindowSnapshot({ contextWindowOptions: [{ value: "128000", isDefault: true }] })).toMatchObject({ maxTokens: 128000, usedPercentage: 0 });
  expect(deriveRuntimeModelContextWindowSnapshot({ contextWindowOptions: [{ value: "128k", isDefault: true }] })).toMatchObject({ maxTokens: 128000, usedPercentage: 0 });
});
