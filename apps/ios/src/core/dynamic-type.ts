/** D02 mobile type baselines. Sizes grow with Dynamic Type; accessibility is not capped. */

export const DYNAMIC_TYPE_BASELINES = {
  taskHeading: 22,
  section: 17,
  body: 17,
  control: 17,
  caption: 13,
} as const;

export type DynamicTypeRole = keyof typeof DYNAMIC_TYPE_BASELINES;

export interface DynamicTypeRoles {
  readonly taskHeading: number;
  readonly section: number;
  readonly body: number;
  readonly control: number;
  readonly caption: number;
}

function usableScale(scale: unknown): scale is number {
  return typeof scale === "number" && Number.isFinite(scale) && scale > 0;
}

function readOsFontScale(): number {
  try {
    const rn = require("react-native") as { PixelRatio?: { getFontScale?: () => number } };
    const next = rn.PixelRatio?.getFontScale?.();
    return usableScale(next) ? next : 1;
  } catch {
    return 1;
  }
}

/** Prefer an explicit scale in tests. Otherwise PixelRatio.getFontScale, then 1. */
export function resolveFontScale(scale?: unknown): number {
  if (scale === undefined) return readOsFontScale();
  return usableScale(scale) ? scale : 1;
}

export function scaledSize(base: number, scale?: unknown): number {
  return base * resolveFontScale(scale);
}

export function dynamicTypeRoles(scale?: unknown): DynamicTypeRoles {
  const resolved = resolveFontScale(scale);
  return {
    taskHeading: scaledSize(DYNAMIC_TYPE_BASELINES.taskHeading, resolved),
    section: scaledSize(DYNAMIC_TYPE_BASELINES.section, resolved),
    body: scaledSize(DYNAMIC_TYPE_BASELINES.body, resolved),
    control: scaledSize(DYNAMIC_TYPE_BASELINES.control, resolved),
    caption: scaledSize(DYNAMIC_TYPE_BASELINES.caption, resolved),
  };
}
