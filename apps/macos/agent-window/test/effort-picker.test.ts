import { expect, it } from "bun:test";

import { getComposerTraitSelection } from "../vendor/synara/apps/web/src/components/chat/composerTraits";

it("uses only the selected OMP model's advertised effort options", () => {
  const selection = getComposerTraitSelection(
    "omp",
    "openrouter/deepseek-v4",
    "",
    undefined,
    {
      slug: "openrouter/deepseek-v4",
      name: "DeepSeek V4",
      supportedReasoningEfforts: [
        { value: "low", label: "Low" },
        { value: "high", label: "High", isDefault: true },
      ],
      defaultReasoningEffort: "high",
    },
  );

  expect(selection.effortLevels).toEqual([
    { value: "low", label: "Low" },
    { value: "high", label: "High", isDefault: true },
  ]);
});

it("preserves the selected OMP effort through draft normalization", async () => {
  const { normalizeProviderModelOptions, normalizeModelSelection } = await import("../vendor/synara/apps/web/src/composerDraftModels");
  expect(normalizeProviderModelOptions({ omp: { thinkingLevel: " high " } }, "omp"))
    .toEqual({ omp: { thinkingLevel: "high" } });
  expect(normalizeModelSelection({ provider: "omp", model: "fixture/fixture-model", options: { thinkingLevel: "high" } }))
    .toMatchObject({ provider: "omp", options: { thinkingLevel: "high" } });
  expect(normalizeProviderModelOptions({ omp: { thinkingLevel: " " } }, "omp")).toBeNull();
});

it("uses OMP thinkingLevel for effort selection and reads it back", async () => {
  const { planComposerEffortChange } = await import("../vendor/synara/apps/web/src/components/chat/composerTraits");
  const runtimeModel = {
    slug: "fixture/fixture-model", name: "Fixture model",
    supportedReasoningEfforts: [{ value: "low", label: "Low" }, { value: "high", label: "High" }],
  };
  const selection = getComposerTraitSelection("omp", runtimeModel.slug, "", undefined, runtimeModel);
  expect(planComposerEffortChange({provider: "omp", selection, prompt: "", value: "high"}))
    .toEqual({kind: "options", patch: {thinkingLevel: "high"}});
  expect(getComposerTraitSelection("omp", runtimeModel.slug, "", {thinkingLevel: "high"}, runtimeModel).effort).toBe("high");
});
