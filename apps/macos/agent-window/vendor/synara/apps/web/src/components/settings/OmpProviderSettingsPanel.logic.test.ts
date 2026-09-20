import { describe, expect, it } from "vitest";

import { groupOmpCatalogModels, summarizeOmpCatalog } from "./OmpProviderSettingsPanel.logic";

describe("OMP provider settings catalog", () => {
  it("groups runtime models by their upstream provider while preserving catalog order", () => {
    const groups = groupOmpCatalogModels([
      {
        slug: "claude/sonnet",
        name: "Sonnet",
        upstreamProviderId: "anthropic",
        upstreamProviderName: "Anthropic",
        supportedReasoningEfforts: [{ value: "high" }],
      },
      {
        slug: "gpt/5",
        name: "GPT-5",
        upstreamProviderId: "openai",
        upstreamProviderName: "OpenAI",
        contextWindowOptions: [{ value: "1m", label: "1M" }],
      },
      {
        slug: "claude/haiku",
        name: "Haiku",
        upstreamProviderId: "anthropic",
        upstreamProviderName: "Anthropic",
      },
    ]);

    expect(groups.map((group) => group.id)).toEqual(["anthropic", "openai"]);
    expect(groups[0]?.name).toBe("Anthropic");
    expect(groups[0]?.models.map((model) => model.slug)).toEqual([
      "claude/sonnet",
      "claude/haiku",
    ]);
    expect(groups[0]?.reasoningModelCount).toBe(1);
    expect(groups[1]?.contextWindowModelCount).toBe(1);
  });

  it("summarizes an empty or unavailable OMP catalog without inventing providers", () => {
    expect(summarizeOmpCatalog([])).toEqual({
      modelCount: 0,
      providerCount: 0,
      reasoningModelCount: 0,
      contextWindowModelCount: 0,
    });
  });
});
