// FILE: SynaraLogo.tsx
// Purpose: Render Cedia's terminal mark while retaining the upstream component API.
// Layer: Shared app branding primitive

import type { SVGProps } from "react";
import { cn } from "~/lib/utils";

export function SynaraLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  // Keep the upstream export name so its consumers remain source-compatible, but
  // never expose Synara's brand in the Cedia application. If a caller supplied a
  // label (including the old "Synara" label), expose the Cedia name instead.
  const suppliedAriaLabel = props["aria-label"] !== undefined;
  const { ["aria-label"]: _ignoredAriaLabel, ...svgProps } = props;

  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...svgProps}
      aria-hidden={suppliedAriaLabel ? undefined : true}
      aria-label={suppliedAriaLabel ? "Cedia" : undefined}
      className={cn("shrink-0 text-foreground", className)}
    >
      <path
        d="M4.5 4.75 7.75 8 4.5 11.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.5 4.75v6.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
