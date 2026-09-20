// FILE: ComposerModelPicker.logic.ts
// Purpose: Pure helpers turning composer trait state into starred presets and back.
// Layer: Chat composer state helpers
// Depends on: composer trait resolution and the starred model storage shape.

import type { ProviderKind } from "@synara/contracts";

import { type StarredModel, starredModelKey } from "~/lib/starredModels";
import {
  formatProviderModelOptionName,
  groupProviderModelOptions,
  type ProviderModelOption,
} from "../../providerModelOptions";
import {
  type getComposerTraitSelection,
  planComposerEffortChange,
  supportsComposerFastModeControl,
} from "./composerTraits";

type ComposerTraitSelection = ReturnType<typeof getComposerTraitSelection>;

/** Tab id of the starred presets list; other tabs are native or upstream providers. */
export const STARRED_TAB = "starred";
export const UPSTREAM_PROVIDER_TAB_PREFIX = "upstream:";
const OTHER_UPSTREAM_PROVIDER_ID = "__other__";

/**
 * OMP is the execution provider, but its model catalog carries the upstream
 * vendor for each model.  Keep those vendor tabs separate from ProviderKind so
 * selecting a row still dispatches through OMP while the UI can look like
 * Synara's provider picker.
 */
export type UpstreamProviderTab = `${typeof UPSTREAM_PROVIDER_TAB_PREFIX}${string}`;
export type ComposerModelPickerTab = typeof STARRED_TAB | ProviderKind | UpstreamProviderTab;

export type ComposerModelPickerUpstreamTab = {
  tab: UpstreamProviderTab;
  /** The provider key used by the agent runtime (always OMP for these tabs). */
  provider: ProviderKind;
  /** Stable upstream key used to filter model rows. */
  upstreamProviderId: string;
  label: string;
  /** Existing Synara provider icon when the upstream key has a known equivalent. */
  iconProvider: ProviderKind | null;
};

function normalizeUpstreamProviderId(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/gu, "-");
}

function upstreamProviderIdForOption(option: Pick<ProviderModelOption, "upstreamProviderId" | "upstreamProviderName">): string {
  const rawId = option.upstreamProviderId?.trim() ?? "";
  const rawName = option.upstreamProviderName?.trim() ?? "";
  const candidate = rawId || rawName;
  if (candidate.length === 0 || normalizeUpstreamProviderId(candidate) === "omp") {
    return OTHER_UPSTREAM_PROVIDER_ID;
  }
  return normalizeUpstreamProviderId(candidate);
}

function humanizeUpstreamProviderId(providerId: string): string {
  if (providerId === OTHER_UPSTREAM_PROVIDER_ID) return "Other models";
  return providerId
    .replace(/[-_]+/gu, " ")
    .replace(/\b\w/gu, (character) => character.toUpperCase());
}

/** Map OMP vendor ids to an existing Synara provider icon where one exists. */
export function resolveUpstreamProviderIconProvider(providerId: string): ProviderKind | null {
  const normalized = normalizeUpstreamProviderId(providerId);
  if (normalized === OTHER_UPSTREAM_PROVIDER_ID || normalized === "omp") return null;
  if (normalized === "openai" || normalized.startsWith("openai-")) return "codex";
  if (normalized === "anthropic" || normalized.startsWith("claude")) return "claudeAgent";
  if (normalized === "cursor") return "cursor";
  if (normalized === "google" || normalized.startsWith("gemini")) return "antigravity";
  if (normalized === "xai" || normalized === "grok") return "grok";
  if (normalized === "opencode" || normalized === "open-code") return "opencode";
  if (normalized === "devin") return "devin";
  if (normalized === "droid") return "droid";
  if (normalized === "pi") return "pi";
  return null;
}

function uniqueProviderModelOptions(
  options: ReadonlyArray<ProviderModelOption>,
): ProviderModelOption[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    const slug = option.slug.trim();
    if (slug.length === 0 || seen.has(slug)) return false;
    seen.add(slug);
    return true;
  });
}

/** Build dynamic vendor tabs from OMP's upstream provider metadata. */
export function resolveComposerModelPickerUpstreamTabs(
  options: ReadonlyArray<ProviderModelOption>,
): ComposerModelPickerUpstreamTab[] {
  const tabs: ComposerModelPickerUpstreamTab[] = [];
  const seen = new Set<string>();
  for (const option of uniqueProviderModelOptions(options)) {
    const upstreamProviderId = upstreamProviderIdForOption(option);
    if (seen.has(upstreamProviderId)) continue;
    seen.add(upstreamProviderId);
    const displayName = option.upstreamProviderName?.trim();
    const label =
      displayName && normalizeUpstreamProviderId(displayName) !== "omp"
        ? displayName
        : humanizeUpstreamProviderId(upstreamProviderId);
    tabs.push({
      tab: `${UPSTREAM_PROVIDER_TAB_PREFIX}${upstreamProviderId}` as UpstreamProviderTab,
      provider: "omp",
      upstreamProviderId,
      label,
      iconProvider: resolveUpstreamProviderIconProvider(upstreamProviderId),
    });
  }
  return tabs;
}

/** Choose the vendor tab that owns a provider-qualified model slug. */
export function resolveComposerModelPickerInitialTab(input: {
  provider: ProviderKind;
  model: string;
  options: ReadonlyArray<ProviderModelOption>;
  upstreamTabs: ReadonlyArray<ComposerModelPickerUpstreamTab>;
}): ComposerModelPickerTab {
  if (input.provider !== "omp" || input.upstreamTabs.length === 0) return input.provider;
  const selected = input.options.find((option) => option.slug === input.model);
  const selectedProviderId = selected ? upstreamProviderIdForOption(selected) : null;
  return (
    input.upstreamTabs.find((tab) => tab.upstreamProviderId === selectedProviderId)?.tab ??
    input.upstreamTabs[0]?.tab ??
    input.provider
  );
}

/** Move dynamic OMP vendor tabs while keeping their stable tab ids intact. */
export function moveComposerModelPickerUpstreamTab(
  tabs: ReadonlyArray<ComposerModelPickerUpstreamTab>,
  activeTab: string,
  overTab: string,
): ComposerModelPickerUpstreamTab[] {
  const fromIndex = tabs.findIndex((tab) => tab.tab === activeTab);
  const toIndex = tabs.findIndex((tab) => tab.tab === overTab);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return [...tabs];
  const next = [...tabs];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return next;
  next.splice(toIndex, 0, moved);
  return next;
}

/** Marks the open picker so global mod+digit handlers (thread jump) yield to its rows. */
export const MODEL_PICKER_POPUP_ATTRIBUTE = "data-model-picker-popup";

export function isModelPickerShortcutScopeActive(): boolean {
  return (
    typeof document !== "undefined" &&
    document.querySelector(`[${MODEL_PICKER_POPUP_ATTRIBUTE}]`) !== null
  );
}

/** Rows beyond this index get no ⌘N hint. */
export const MODEL_PICKER_SHORTCUT_ROW_LIMIT = 9;

// Snapshot the traits a star should restore. Controls the model does not expose stay
// `null` so applying the preset never invents an option the provider would reject.
export function resolveStarredTraits(
  selection: Pick<
    ComposerTraitSelection,
    | "caps"
    | "effort"
    | "effortLevels"
    | "fastModeDescriptor"
    | "fastModeEnabled"
    | "thinkingEnabled"
  >,
): Pick<StarredModel, "effort" | "fastMode" | "thinking"> {
  return {
    effort: selection.effortLevels.length > 0 ? selection.effort : null,
    fastMode: supportsComposerFastModeControl(selection) ? selection.fastModeEnabled : null,
    thinking: selection.thinkingEnabled,
  };
}

// Option patch that restores a preset's traits on its model. `selection` must be the
// target model's trait selection so option ids and supported levels come from it.
export function buildStarredModelOptionsPatch(input: {
  provider: ProviderKind;
  selection: ComposerTraitSelection;
  starred: Pick<StarredModel, "effort" | "fastMode" | "thinking">;
}): Record<string, unknown> {
  const { provider, selection, starred } = input;
  const patch: Record<string, unknown> = {};
  if (starred.effort !== null) {
    const plan = planComposerEffortChange({
      provider,
      // A preset is applied independently of the prompt's Ultrathink lock.
      selection: { ...selection, ultrathinkPromptControlled: false },
      prompt: "",
      value: starred.effort,
    });
    if (plan?.kind === "options") {
      Object.assign(patch, plan.patch);
    }
  }
  if (starred.fastMode !== null && supportsComposerFastModeControl(selection)) {
    patch.fastMode = starred.fastMode;
  }
  if (starred.thinking !== null && selection.thinkingEnabled !== null) {
    patch.thinking = starred.thinking;
  }
  return patch;
}

// "High · Fast" style summary of a preset, labelled through the target model's ladder.
export function formatStarredTraitsLabel(
  starred: Pick<StarredModel, "effort" | "fastMode" | "thinking">,
  effortLevels: ComposerTraitSelection["effortLevels"],
): string {
  const effortLabel =
    starred.effort !== null
      ? (effortLevels.find((level) => level.value === starred.effort)?.label ?? starred.effort)
      : null;
  return [
    effortLabel,
    effortLabel === null && starred.thinking !== null
      ? `Thinking ${starred.thinking ? "On" : "Off"}`
      : null,
    starred.fastMode ? "Fast" : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");
}

// A preset counts as "current" when every trait it pins matches the composer's.
export function starredTraitsMatch(
  starred: Pick<StarredModel, "effort" | "fastMode" | "thinking">,
  current: Pick<StarredModel, "effort" | "fastMode" | "thinking">,
): boolean {
  return (
    (starred.effort === null || starred.effort === current.effort) &&
    (starred.fastMode === null || starred.fastMode === current.fastMode) &&
    (starred.thinking === null || starred.thinking === current.thinking)
  );
}

// One row of the picker list, already resolved to what selecting it commits.
export type ComposerModelPickerRow = {
  key: string;
  provider: ProviderKind;
  /** Upstream vendor icon for OMP rows; native providers use `provider`. */
  iconProvider?: ProviderKind | null;
  /** Raw OMP upstream id used to render providers outside Synara's ProviderKind union. */
  upstreamProviderId?: string;
  model: string;
  name: string;
  /** Muted text after the name: the trait summary of a starred preset. */
  detail: string | null;
  selected: boolean;
  groupLabel: string | null;
  /** Present on starred rows: the preset to restore and to un-star. */
  preset: StarredModel | null;
};

export function buildProviderTabRows(input: {
  provider: ProviderKind;
  options: ReadonlyArray<ProviderModelOption>;
  query: string;
  selectedModel: string | null;
  /** When set, this is an OMP vendor tab rather than a native provider tab. */
  upstreamProviderId?: string;
}): ComposerModelPickerRow[] {
  const { provider, query } = input;
  const uniqueOptions = uniqueProviderModelOptions(input.options).filter(
    (option) =>
      input.upstreamProviderId === undefined ||
      upstreamProviderIdForOption(option) === input.upstreamProviderId,
  );
  const filteredOptions =
    query.length > 0
      ? uniqueOptions.filter((option) =>
          // Descriptions are not shown, so they must not produce invisible matches.
          [option.name, option.slug, option.upstreamProviderName, option.upstreamProviderId]
            .join(" ")
            .toLowerCase()
            .includes(query),
        )
      : uniqueOptions;
  return groupProviderModelOptions(filteredOptions).flatMap((group) =>
    group.options.map((option) => ({
      key: `${provider}:${option.slug}`,
      provider,
      ...(provider === "omp"
        ? { upstreamProviderId: upstreamProviderIdForOption(option) }
        : {}),
      model: option.slug,
      name: option.name,
      detail: null,
      selected: option.slug === input.selectedModel,
      // The vendor is already represented by the active tab. Keeping another
      // identical heading above every row makes the compact Synara picker noisy.
      groupLabel: input.upstreamProviderId === undefined ? group.label : null,
      preset: null,
    })),
  );
}

export function buildStarredTabRows(input: {
  starredModels: ReadonlyArray<StarredModel>;
  modelOptionsByProvider: Record<ProviderKind, ReadonlyArray<ProviderModelOption>>;
  query: string;
  current: { provider: ProviderKind; model: string } & Pick<
    StarredModel,
    "effort" | "fastMode" | "thinking"
  >;
  effortLevelsFor: (
    provider: ProviderKind,
    model: string,
  ) => ComposerTraitSelection["effortLevels"];
}): ComposerModelPickerRow[] {
  return input.starredModels.flatMap((entry) => {
    const option = input.modelOptionsByProvider[entry.provider].find(
      (candidate) => candidate.slug === entry.model,
    );
    const name =
      option?.name ?? formatProviderModelOptionName({ provider: entry.provider, slug: entry.model });
    if (
      input.query.length > 0 &&
      !`${name} ${entry.model} ${entry.provider}`.toLowerCase().includes(input.query)
    ) {
      return [];
    }
    const traitsLabel = formatStarredTraitsLabel(
      entry,
      input.effortLevelsFor(entry.provider, entry.model),
    );
    return [
      {
        key: starredModelKey(entry),
        provider: entry.provider,
        ...(entry.provider === "omp" && option
          ? {
              iconProvider: resolveUpstreamProviderIconProvider(upstreamProviderIdForOption(option)),
              upstreamProviderId: upstreamProviderIdForOption(option),
            }
          : {}),
        model: entry.model,
        name,
        detail: traitsLabel.length > 0 ? traitsLabel : null,
        selected:
          entry.provider === input.current.provider &&
          entry.model === input.current.model &&
          starredTraitsMatch(entry, input.current),
        groupLabel: null,
        preset: entry,
      },
    ];
  });
}

// Index (0-based) of the picker row a mod+digit chord addresses, or null.
export function modelPickerShortcutRowIndex(event: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}): number | null {
  if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return null;
  if (!/^[1-9]$/u.test(event.key)) return null;
  return Number(event.key) - 1;
}
