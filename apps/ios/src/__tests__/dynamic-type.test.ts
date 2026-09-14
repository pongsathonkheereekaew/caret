import { describe, expect, test } from "bun:test";
import { DYNAMIC_TYPE_BASELINES, dynamicTypeRoles, resolveFontScale, scaledSize } from "../core/dynamic-type.ts";

describe("ios Dynamic Type roles", () => {
  test("scale 1 keeps D02 baselines", () => {
    expect(dynamicTypeRoles(1)).toEqual({
      taskHeading: 22,
      section: 17,
      body: 17,
      control: 17,
      caption: 13,
    });
    expect(dynamicTypeRoles(1)).toEqual({ ...DYNAMIC_TYPE_BASELINES });
    expect(scaledSize(22, 1)).toBe(22);
    expect(scaledSize(13, 1)).toBe(13);
  });

  test("scale 2 doubles roles and does not cap accessibility sizes", () => {
    expect(dynamicTypeRoles(2)).toEqual({
      taskHeading: 44,
      section: 34,
      body: 34,
      control: 34,
      caption: 26,
    });
    expect(scaledSize(22, 2)).toBe(44);
    expect(scaledSize(22, 10)).toBe(220);
    expect(dynamicTypeRoles(4).taskHeading).toBe(88);
  });

  test("garbage scale falls back to 1", () => {
    expect(resolveFontScale(Number.NaN)).toBe(1);
    expect(resolveFontScale(Number.POSITIVE_INFINITY)).toBe(1);
    expect(resolveFontScale(0)).toBe(1);
    expect(resolveFontScale(-2)).toBe(1);
    expect(resolveFontScale("2")).toBe(1);
    expect(dynamicTypeRoles(Number.NaN)).toEqual(dynamicTypeRoles(1));
    expect(scaledSize(17, Number.NaN)).toBe(17);
  });

  test("roles stay the D02 set and do not invent Cloud", () => {
    expect(Object.keys(dynamicTypeRoles(1)).sort()).toEqual(["body", "caption", "control", "section", "taskHeading"]);
    expect(JSON.stringify(dynamicTypeRoles(2))).not.toMatch(/cloud/i);
  });
});
