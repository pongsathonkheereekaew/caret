/**
 * ProviderIcon - shared provider glyphs for chat, sidebar, and picker surfaces.
 *
 * Centralizes provider-to-icon mapping so new providers do not need repeated
 * branching across every UI surface.
 */
import { type ProviderKind } from "@synara/contracts";
import type { ReactNode, SVGProps } from "react";

import { CentralIcon } from "~/lib/central-icons";
import { GlobeIcon, WorkflowIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";
import { providerGlyph, providerGlyphSlug } from "../../../../../../../src/provider-icons.ts";
import commandCodeProviderUrl from "../assets/providers/commandcode.svg";
import {
  AntigravityIcon,
  ClaudeAI,
  CursorIcon,
  DevinIcon,
  DroidIcon,
  GrokIcon,
  type Icon,
  OpenAI,
  OpenCodeIcon,
  PiIcon,
} from "./Icons";

export type ProviderIconTone = "default" | "header";

/**
 * Resolve an OMP upstream id to one of the bundled provider marks.
 *
 * OMP catalogs are not limited to Synara's ProviderKind union (for example,
 * `openrouter`, `meta-llama`, and `openai-codex`). Keep the mapping here at the
 * asset boundary so every picker surface gets the same mark and unknown ids
 * can still use the neutral globe fallback.
 */
export function resolveProviderGlyphId(providerId: string | null | undefined): string | null {
  const raw = providerId?.trim().toLowerCase() ?? "";
  if (raw.length === 0) return null;

  const candidates = new Set<string>([
    raw,
    raw.replace(/\s+/gu, "-"),
    raw.replace(/^provider[-_:]/u, ""),
    raw.split("/", 1)[0] ?? raw,
  ]);
  for (const candidate of candidates) {
    const slug = providerGlyphSlug(candidate);
    if (slug) return slug;
  }

  // Provider ids frequently carry a model-family suffix. Map only aliases
  // whose brand is unambiguous; unknown providers remain intentionally generic.
  if (/^(?:anthropic|claude)(?:[-_].*)?$/u.test(raw)) return "anthropic";
  if (/^(?:openai|openai-codex|codex|gpt)(?:[-_./].*)?$/u.test(raw)) return "openai";
  if (/^(?:google|gemini)(?:[-_./].*)?$/u.test(raw)) return "google";
  if (/^(?:xai|x-ai|grok)(?:[-_].*)?$/u.test(raw)) return "xai";
  if (/^(?:meta|meta-llama|llama)(?:[-_].*)?$/u.test(raw)) return "meta";
  if (/^(?:mistral|mistralai)(?:[-_].*)?$/u.test(raw)) return "mistral";
  if (/^(?:deepseek)(?:[-_].*)?$/u.test(raw)) return "deepseek";
  if (/^(?:qwen)(?:[-_].*)?$/u.test(raw)) return "qwen";
  return null;
}

/** Renders the real bundled mark for an OMP upstream provider. */
export function ProviderGlyphIcon({
  providerId,
  className,
  ...props
}: SVGProps<SVGSVGElement> & { providerId: string | null | undefined }) {
  // CommandCode's official symbol is shipped as a local asset because it is
  // not part of the icon package used for the generated provider marks.
  // Sources: https://commandcode.ai/brand and
  // https://raw.githubusercontent.com/CommandCodeAI/command-code/refs/heads/main/.github/commandcode/symbols/symbol.svg.
  if (providerId?.trim().toLowerCase() === "commandcode") {
    return (
      <svg {...props} className={className} viewBox="0 0 137 137" fill="none">
        <image href={commandCodeProviderUrl} width="137" height="137" preserveAspectRatio="xMidYMid meet" />
      </svg>
    );
  }
  const glyph = providerGlyph(resolveProviderGlyphId(providerId) ?? undefined);
  if (!glyph) {
    return <GlobeIcon aria-hidden="true" className={className} {...props} />;
  }
  return (
    <svg {...props} className={className} viewBox={glyph.viewBox} fill="currentColor">
      {glyph.paths.map((path, index) => (
        <path key={`${providerId ?? "provider"}-${index}`} d={path} />
      ))}
    </svg>
  );
}

// The bundled SVG has a dark outer fill, so dark mode swaps to the reversed Central asset.
// React's SVGProps has no `title`, so accept it via an explicit prop type and forward it
// only to CentralIcon (an HTML span, which supports `title`); the light-mode SVG conveys
// its accessible name through aria-label instead.
const OpenCodeProviderIcon = ({
  className,
  style,
  title,
  role,
  "aria-hidden": ariaHidden,
  "aria-label": ariaLabel,
  ...svgProps
}: SVGProps<SVGSVGElement> & { title?: string }) => {
  const centralIconLabel =
    ariaHidden === true || ariaHidden === "true" || typeof ariaLabel !== "string"
      ? undefined
      : ariaLabel;

  return (
    <>
      <OpenCodeIcon
        {...svgProps}
        aria-hidden={ariaHidden}
        aria-label={ariaLabel}
        role={role}
        className={cn(className, "dark:hidden")}
        style={style}
      />
      <CentralIcon
        name="opencode"
        label={centralIconLabel}
        title={title}
        className={cn(className, "hidden dark:inline-block dark:text-foreground/90")}
        style={style}
      />
    </>
  );
};

export const PROVIDER_ICON_COMPONENT_BY_PROVIDER: Record<ProviderKind, Icon> = {
  codex: OpenAI,
  claudeAgent: ClaudeAI,
  cursor: CursorIcon,
  devin: DevinIcon,
  antigravity: AntigravityIcon,
  grok: GrokIcon,
  droid: DroidIcon,
  opencode: OpenCodeProviderIcon,
  pi: PiIcon,
  omp: WorkflowIcon,
};

export function providerIconToneClassName(
  provider: ProviderKind | null | undefined,
  tone: ProviderIconTone = "default",
): string {
  if (provider === "opencode") {
    return "text-muted-foreground/70";
  }
  if (provider === "codex") {
    return tone === "header" ? "text-muted-foreground/85" : "text-foreground";
  }
  return "text-foreground";
}

export type ProviderIconProps = Omit<SVGProps<SVGSVGElement>, "ref"> & {
  readonly provider: ProviderKind | null | undefined;
  readonly fallback?: ReactNode;
  readonly tone?: ProviderIconTone;
};

export function ProviderIcon({
  provider,
  fallback: fallbackProp,
  tone: toneProp,
  className,
  "aria-hidden": ariaHiddenProp,
  ...svgProps
}: ProviderIconProps) {
  const fallback = fallbackProp ?? null;
  const tone = toneProp ?? "default";
  const ariaHidden = ariaHiddenProp ?? true;
  if (provider === null || provider === undefined) {
    return fallback;
  }

  const Icon = PROVIDER_ICON_COMPONENT_BY_PROVIDER[provider];
  return (
    <Icon
      aria-hidden={ariaHidden}
      {...svgProps}
      className={cn(providerIconToneClassName(provider, tone), className)}
    />
  );
}

export function ProviderOptionLabel({
  provider,
  label,
  className,
  iconClassName,
}: {
  provider: ProviderKind;
  label: ReactNode;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <ProviderIcon provider={provider} className={cn("size-3.5", iconClassName)} />
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}
