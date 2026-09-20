// FILE: ComposerModelMenuTrigger.tsx
// Purpose: Fixed-width model/effort trigger; the selected name truncates without changing layout.
// Layer: Chat composer presentation
// Depends on: menu/tooltip primitives, provider icons, and composer picker text tokens.

import type { ProviderKind } from "@synara/contracts";

import { ChevronDownIcon, GlobeIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";
import { ProviderGlyphIcon, PROVIDER_ICON_COMPONENT_BY_PROVIDER } from "../ProviderIcon";
import { Button } from "../ui/button";
import { MenuTrigger } from "../ui/menu";
import { ShortcutKbd } from "../ui/shortcut-kbd";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { COMPOSER_PICKER_TRIGGER_TEXT_CLASS_NAME } from "./composerPickerStyles";
import { getProviderIconClassName } from "./ProviderModelPicker";

// Keep a fixed footprint while exposing the selected model; the title includes full details.
export function ComposerModelMenuTrigger(props: {
  provider: ProviderKind;
  iconProvider?: ProviderKind | null;
  iconProviderId?: string | null;
  modelLabel: string;
  statusLabel: string | null;
  showsFastBadge: boolean;
  hideModelLabel?: boolean | undefined;
  hideStatusLabel?: boolean | undefined;
  disabled?: boolean | undefined;
  isMenuOpen: boolean;
  shortcutLabel?: string | null | undefined;
}) {
  const iconProvider = props.iconProvider === undefined ? props.provider : props.iconProvider;
  const ProviderIcon = iconProvider ? PROVIDER_ICON_COMPONENT_BY_PROVIDER[iconProvider] : GlobeIcon;
  const selectionTitle = [props.modelLabel, props.statusLabel, props.showsFastBadge ? "Fast" : null]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" · ");

  const triggerButton = (
    <Button
      size="sm"
      variant="chrome"
      disabled={props.disabled ?? false}
      className={cn(
        // Keep a generous desktop footprint for the selected model + effort, but let the
        // trigger yield space in the narrow IDE embedding instead of forcing the footer to
        // overflow. The width is still content-independent, so changing selections cannot
        // move the neighbouring controls.
        "w-56 min-w-0 max-w-full shrink justify-start gap-1.5 whitespace-nowrap px-2 sm:px-2.5 [&_svg]:mx-0",
        COMPOSER_PICKER_TRIGGER_TEXT_CLASS_NAME,
      )}
      aria-label="Change model and reasoning"
      title={selectionTitle}
    />
  );

  const triggerContent = (
    <span className="flex w-full min-w-0 items-center gap-1.5 overflow-hidden">
      {props.iconProviderId ? (
        <ProviderGlyphIcon
          providerId={props.iconProviderId}
          aria-hidden="true"
          className={cn(
            // opacity-100 opts out of the Button base's [&_svg]:opacity-80 dimming.
            "size-3.5 shrink-0 opacity-100",
            getProviderIconClassName(iconProvider ?? props.provider, "text-[var(--color-text-foreground)]"),
          )}
        />
      ) : (
        <ProviderIcon
          aria-hidden="true"
          className={cn(
            // opacity-100 opts out of the Button base's [&_svg]:opacity-80 dimming.
            "size-3.5 shrink-0 opacity-100",
            getProviderIconClassName(iconProvider ?? props.provider, "text-[var(--color-text-foreground)]"),
          )}
        />
      )}
      <span className="min-w-0 flex-1 truncate text-[var(--color-text-foreground)]">
        {props.modelLabel || "Select model/effort"}
      </span>
      {props.modelLabel && props.statusLabel ? (
        <span className="shrink-0 text-muted-foreground">{props.statusLabel}</span>
      ) : null}
      <ChevronDownIcon aria-hidden="true" className="ms-0.5 size-3 shrink-0 opacity-60" />
    </span>
  );

  if (!props.shortcutLabel) {
    return <MenuTrigger render={triggerButton}>{triggerContent}</MenuTrigger>;
  }
  return (
    <Tooltip>
      <TooltipTrigger render={<MenuTrigger render={triggerButton} />}>
        {triggerContent}
      </TooltipTrigger>
      {!props.isMenuOpen ? (
        <TooltipPopup side="top" sideOffset={6} variant="picker">
          <span className="inline-flex items-center gap-2 px-1 py-0.5">
            <span>{selectionTitle}</span>
            <ShortcutKbd
              shortcutLabel={props.shortcutLabel}
              className="h-4 min-w-4 px-1 text-[length:var(--app-font-size-ui-2xs,9px)] text-muted-foreground"
            />
          </span>
        </TooltipPopup>
      ) : null}
    </Tooltip>
  );
}
