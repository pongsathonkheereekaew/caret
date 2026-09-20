// FILE: providerMetadata.ts
// Purpose: Exhaustive non-secret provider identity and presentation metadata.

import { PROVIDER_DISPLAY_NAMES, type ProviderKind } from "@synara/contracts";

export interface ProviderDescriptor {
  readonly kind: ProviderKind;
  readonly displayName: string;
  readonly available: boolean;
  /**
   * True when the provider runtime can inject a user message into a live turn
   * without interrupting it (Codex `turn/steer`, Pi `session.steer`, Claude
   * streaming-input prompt queue). Mirrors the adapter's
   * `supportsTurnSteering` capability so the pure decider and the web client
   * can route steers without a runtime round-trip; keep the two in sync.
   */
  readonly supportsNativeTurnSteering: boolean;
  /** Synara docs page covering install, sign-in, and verification for this runtime. */
  readonly setupDocsHref: string;
  readonly usage: {
    readonly signInCommand: string;
    readonly learnMoreHref: string;
  } | null;
}

function defineProviderDescriptors<const Descriptors extends readonly ProviderDescriptor[]>(
  descriptors: Descriptors,
): Descriptors {
  return descriptors;
}

// ProviderKind retains legacy members so persisted sessions can decode, but
// Cedia's shipped runtime exposes one agent identity. Upstream model vendors
// remain provenance on the OMP model descriptor rather than provider choices.
export const PROVIDER_DESCRIPTORS = defineProviderDescriptors([
  {
    kind: "omp",
    displayName: PROVIDER_DISPLAY_NAMES.omp,
    available: true,
    supportsNativeTurnSteering: true,
    // OMP is bundled and authenticated through Cedia; there is no provider
    // install page to advertise from Synara's generic settings surface.
    setupDocsHref: "",
    usage: null as ProviderDescriptor["usage"],
  },
] as const satisfies readonly ProviderDescriptor[]);

export const PROVIDER_DESCRIPTOR_BY_KIND = Object.fromEntries(
  PROVIDER_DESCRIPTORS.map((descriptor) => [descriptor.kind, descriptor]),
) as Partial<Record<ProviderKind, (typeof PROVIDER_DESCRIPTORS)[number]>>;

// Accepts plain strings so projection-sourced provider names can be checked
// without casts; unknown providers are simply not steerable.
export const providerSupportsNativeTurnSteering = (kind: string): boolean =>
  PROVIDER_DESCRIPTORS.some(
    (descriptor) => descriptor.kind === kind && descriptor.supportsNativeTurnSteering,
  );
