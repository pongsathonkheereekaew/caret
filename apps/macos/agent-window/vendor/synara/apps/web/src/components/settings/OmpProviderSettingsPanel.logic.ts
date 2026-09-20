/**
 * Pure projections for the OMP provider settings surface.
 *
 * OMP is one execution provider from Cedia's point of view, while its live
 * model catalogue carries the upstream vendors that appear as picker tabs.
 * Keep that distinction here so settings can explain the catalogue without
 * pretending each upstream vendor is a separately configurable runtime.
 */

export type OmpCatalogModel = {
  readonly slug: string;
  readonly name: string;
  readonly upstreamProviderId?: string;
  readonly upstreamProviderName?: string;
  readonly supportedReasoningEfforts?: ReadonlyArray<unknown>;
  readonly contextWindowOptions?: ReadonlyArray<unknown>;
};

export type OmpCatalogProviderGroup = {
  readonly id: string;
  readonly name: string;
  readonly models: ReadonlyArray<OmpCatalogModel>;
  readonly reasoningModelCount: number;
  readonly contextWindowModelCount: number;
};

export type OmpCatalogSummary = {
  readonly modelCount: number;
  readonly providerCount: number;
  readonly reasoningModelCount: number;
  readonly contextWindowModelCount: number;
};

function humanizeProviderId(value: string): string {
  return value
    .replace(/[-_]+/gu, " ")
    .replace(/\b\w/gu, (character) => character.toUpperCase());
}

function providerIdentity(model: OmpCatalogModel): { readonly id: string; readonly name: string } {
  const id = model.upstreamProviderId?.trim() || "unknown";
  const explicitName = model.upstreamProviderName?.trim();
  return {
    id,
    name: explicitName || (id === "unknown" ? "Other providers" : humanizeProviderId(id)),
  };
}

/** Group the runtime catalogue by upstream provider in first-seen order. */
export function groupOmpCatalogModels(
  models: ReadonlyArray<OmpCatalogModel>,
): OmpCatalogProviderGroup[] {
  const groups = new Map<
    string,
    { name: string; models: OmpCatalogModel[]; reasoningModelCount: number; contextWindowModelCount: number }
  >();

  for (const model of models) {
    const identity = providerIdentity(model);
    const existing = groups.get(identity.id);
    const group = existing ?? {
      name: identity.name,
      models: [],
      reasoningModelCount: 0,
      contextWindowModelCount: 0,
    };
    group.models.push(model);
    if ((model.supportedReasoningEfforts?.length ?? 0) > 0) group.reasoningModelCount += 1;
    if ((model.contextWindowOptions?.length ?? 0) > 0) group.contextWindowModelCount += 1;
    groups.set(identity.id, group);
  }

  return [...groups].map(([id, group]) => ({ id, ...group }));
}

/** Return the small set of facts that is useful in the settings summary. */
export function summarizeOmpCatalog(
  models: ReadonlyArray<OmpCatalogModel>,
): OmpCatalogSummary {
  const groups = groupOmpCatalogModels(models);
  return {
    modelCount: models.length,
    providerCount: groups.length,
    reasoningModelCount: groups.reduce((count, group) => count + group.reasoningModelCount, 0),
    contextWindowModelCount: groups.reduce(
      (count, group) => count + group.contextWindowModelCount,
      0,
    ),
  };
}
