// FILE: ComposerModelPickerTabs.tsx
// Purpose: Icon tab strip of the composer model picker — starred presets, one tab per
//   offered provider, and a shortcut to provider settings.
// Layer: Chat composer presentation
// Depends on: provider icons/availability helpers and tooltip primitives.

import { type ProviderKind, type ServerProviderStatus } from "@synara/contracts";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

import { DragHandleIcon, GlobeIcon, PlusIcon, StarFilledIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";
import { ProviderGlyphIcon, PROVIDER_ICON_COMPONENT_BY_PROVIDER } from "../ProviderIcon";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { type ComposerModelPickerTab, STARRED_TAB } from "./ComposerModelPicker.logic";
import { getProviderIconClassName, resolveLiveProviderAvailability } from "./ProviderModelPicker";

function PickerTabButton(props: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onSelect: () => void;
  children: ReactNode;
  dragId?: string;
  dragging?: boolean;
  onPointerDown?: (event: PointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            role="tab"
            aria-label={props.label}
            aria-selected={props.active}
            disabled={props.disabled ?? false}
            draggable={false}
            data-provider-tab={props.dragId}
            onDragStart={(event) => event.preventDefault()}
            onPointerDown={props.onPointerDown}
            className={cn(
              "relative flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground/70 outline-none transition-colors hover:bg-[var(--color-background-button-secondary-hover)] hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring/60 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent",
              props.active &&
                // The accent token is theme-injected; fall back to the icon color without it.
                "text-foreground after:absolute after:inset-x-1.5 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-[var(--color-text-accent,currentColor)]",
              props.dragId && "touch-none select-none",
              props.dragging && "cursor-grabbing opacity-50",
            )}
            onClick={props.onSelect}
          />
        }
      >
        {props.children}
      </TooltipTrigger>
      <TooltipPopup side="top" variant="picker">
        {props.label}
      </TooltipPopup>
    </Tooltip>
  );
}

export type ComposerModelPickerProviderTab = {
  provider: ProviderKind;
  tab: ComposerModelPickerTab;
  label: string;
  /** Existing Synara icon for a dynamic upstream provider, or null for a generic glyph. */
  iconProvider: ProviderKind | null;
  /** Set only for dynamic OMP upstream tabs. */
  upstreamProviderId?: string;
  /** Null when the provider can be opened; otherwise why not ("Sign in", "Checking"…). */
  unavailableLabel: string | null;
};

export function resolveComposerModelPickerProviderTabs(
  options: ReadonlyArray<{ value: ProviderKind; label: string }>,
  providers: ReadonlyArray<ServerProviderStatus> | undefined,
): ComposerModelPickerProviderTab[] {
  return options.map((option) => {
    const availability = resolveLiveProviderAvailability(
      providers?.find((entry) => entry.provider === option.value),
    );
    return {
      provider: option.value,
      tab: option.value,
      label: option.label,
      iconProvider: option.value,
      unavailableLabel: availability.disabled ? (availability.label ?? "Unavailable") : null,
    };
  });
}

export function ComposerModelPickerTabs(props: {
  tab: ComposerModelPickerTab;
  providerTabs: ReadonlyArray<ComposerModelPickerProviderTab>;
  onTabChange: (tab: ComposerModelPickerTab) => void;
  /** Omitted while the thread is locked to its provider. */
  onAddProviders?: (() => void) | undefined;
  onReorder?: (activeTab: string, overTab: string) => void;
}) {
  const [draggingTab, setDraggingTab] = useState<string | null>(null);
  const draggingTabRef = useRef<string | null>(null);
  const pointerOverTabRef = useRef<string | null>(null);
  const pointerStartRef = useRef<[number, number] | null>(null);
  const pointerMovedRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const tabListRef = useRef<HTMLDivElement>(null);
  const canReorder = !!props.onReorder && props.providerTabs.length > 1;

  const clearPointerDrag = () => {
    pointerIdRef.current = null;
    draggingTabRef.current = null;
    pointerOverTabRef.current = null;
    pointerStartRef.current = null;
    pointerMovedRef.current = false;
    setDraggingTab(null);
  };

  useEffect(() => {
    const updatePointerTarget = (event: globalThis.PointerEvent) => {
      const target = document
        .elementsFromPoint(event.clientX, event.clientY)
        .find(
          (element): element is HTMLElement =>
            element instanceof HTMLElement && element.dataset.providerTab !== undefined &&
            !!tabListRef.current?.contains(element),
        );
      pointerOverTabRef.current = target?.dataset.providerTab ?? null;
    };
    const onPointerMove = (event: globalThis.PointerEvent) => {
      const activeTab = draggingTabRef.current;
      const start = pointerStartRef.current;
      if (!activeTab || !start || event.pointerId !== pointerIdRef.current) return;
      if (!pointerMovedRef.current && Math.hypot(event.clientX - start[0], event.clientY - start[1]) < 4) {
        return;
      }
      pointerMovedRef.current = true;
      updatePointerTarget(event);
      setDraggingTab(activeTab);
    };
    const onPointerUp = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== pointerIdRef.current) return;
      suppressClickRef.current = pointerMovedRef.current;
      updatePointerTarget(event);
      const activeTab = draggingTabRef.current;
      const overTab = pointerOverTabRef.current;
      if (activeTab && overTab && activeTab !== overTab && pointerMovedRef.current) {
        props.onReorder?.(activeTab, overTab);
      }
      clearPointerDrag();
    };
    const onPointerCancel = (event: globalThis.PointerEvent) => {
      if (event.pointerId === pointerIdRef.current) clearPointerDrag();
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [props.onReorder]);

  return (
    <div
      ref={tabListRef}
      role="tablist"
      aria-label="Model sources"
      className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border p-1.5 [scrollbar-width:none]"
    >
      <PickerTabButton
        label="Starred"
        active={props.tab === STARRED_TAB}
        onSelect={() => props.onTabChange(STARRED_TAB)}
      >
        <StarFilledIcon aria-hidden="true" className="size-3.5" />
      </PickerTabButton>
      {props.providerTabs.map((providerTab) => {
        const TabIcon = providerTab.iconProvider
          ? PROVIDER_ICON_COMPONENT_BY_PROVIDER[providerTab.iconProvider]
          : GlobeIcon;
        return (
          <PickerTabButton
            key={providerTab.tab}
            label={
              providerTab.unavailableLabel
                ? `${providerTab.label} · ${providerTab.unavailableLabel}`
                : providerTab.label
            }
            active={props.tab === providerTab.tab}
            disabled={providerTab.unavailableLabel !== null}
            onSelect={() => {
              if (suppressClickRef.current) {
                suppressClickRef.current = false;
                return;
              }
              props.onTabChange(providerTab.tab);
            }}
            dragId={canReorder ? providerTab.tab : undefined}
            dragging={draggingTab === providerTab.tab}
            onPointerDown={(event) => {
              suppressClickRef.current = false;
              if (!canReorder || event.button !== 0) return;
              pointerIdRef.current = event.pointerId;
              draggingTabRef.current = providerTab.tab;
              pointerOverTabRef.current = providerTab.tab;
              pointerStartRef.current = [event.clientX, event.clientY];
              pointerMovedRef.current = false;
            }}
          >
            {canReorder ? (
              <DragHandleIcon
                aria-hidden="true"
                className="absolute -top-0.5 -right-0.5 size-2.5 text-muted-foreground/55"
              />
            ) : null}
            {providerTab.upstreamProviderId ? (
              <ProviderGlyphIcon
                providerId={providerTab.upstreamProviderId}
                aria-hidden="true"
                className={cn(
                  "size-4",
                  getProviderIconClassName(providerTab.iconProvider ?? providerTab.provider, ""),
                )}
              />
            ) : (
              <TabIcon
                aria-hidden="true"
                className={cn(
                  "size-4",
                  getProviderIconClassName(providerTab.iconProvider ?? providerTab.provider, ""),
                )}
              />
            )}
          </PickerTabButton>
        );
      })}
      {props.onAddProviders ? (
        <PickerTabButton label="Add providers" active={false} onSelect={props.onAddProviders}>
          <PlusIcon aria-hidden="true" className="size-3.5" />
        </PickerTabButton>
      ) : null}
    </div>
  );
}
