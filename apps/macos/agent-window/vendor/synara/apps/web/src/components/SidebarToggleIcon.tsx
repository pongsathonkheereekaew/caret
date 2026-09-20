// FILE: SidebarToggleIcon.tsx
// Purpose: Draws the shared left/right sidebar toggle mark.
// Layer: Desktop shell chrome

import type { SVGProps } from "react";

import { cn } from "~/lib/utils";

/**
 * Compact outline of the shell with the selected side filled. Keeping the mark
 * local instead of relying on two unrelated icon glyphs makes the open state
 * legible at both ends of the top bar: the fill sits inside the corresponding
 * panel and fades with the same motion policy as the rest of the control.
 */
export function SidebarToggleIcon({
  side,
  open,
  className,
  ...props
}: SVGProps<SVGSVGElement> & {
  side: "left" | "right";
  open: boolean;
}) {
  const isLeft = side === "left";
  const panelX = isLeft ? 3.5 : 16.5;
  const dividerX = isLeft ? 8.5 : 15.5;

  return (
    <svg
      {...props}
      aria-hidden={props["aria-hidden"] ?? true}
      className={cn("size-4 shrink-0", className)}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2.5" y="3.5" width="19" height="17" rx="2.75" strokeWidth="1.35" />
      <rect
        x={panelX}
        y="4.5"
        width="4"
        height="15"
        rx="1.1"
        fill="currentColor"
        stroke="none"
        className={cn(
          "transition-opacity duration-200 ease-out motion-reduce:transition-none",
          open ? "opacity-80" : "opacity-0",
        )}
      />
      <path d={`M${dividerX} 4.5V19.5`} strokeWidth="1.35" />
    </svg>
  );
}

