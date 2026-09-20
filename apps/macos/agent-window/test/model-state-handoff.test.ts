import { expect, it } from "bun:test";
import { modelFromFrame } from "../src/cedia-adapter";

it("preserves OMP effort beside its nested model in a restored get_state frame", () => {
  expect(modelFromFrame({ type: "response", command: "get_state", data: {
    model: { id: "fixture-model", provider: "fixture" }, thinkingLevel: "high",
  } })).toEqual({ id: "fixture-model", provider: "fixture", effort: "high" });
  expect(modelFromFrame({ model: { id: "fixture-model", provider: "fixture" }, thinkingLevel: "minimal" }))
    .toEqual({ id: "fixture-model", provider: "fixture", effort: "minimal" });
});
