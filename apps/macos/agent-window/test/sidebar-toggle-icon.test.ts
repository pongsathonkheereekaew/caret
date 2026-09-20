import { expect, it } from "bun:test";

import { SidebarToggleIcon } from "../vendor/synara/apps/web/src/components/SidebarToggleIcon";

function elementChildren(element: { props: { children?: unknown } }) {
  return Array.isArray(element.props.children)
    ? element.props.children
    : [element.props.children];
}

it("fills the selected side inside the shared sidebar mark", () => {
  const left = SidebarToggleIcon({ side: "left", open: true });
  const right = SidebarToggleIcon({ side: "right", open: false });
  const leftChildren = elementChildren(left);
  const rightChildren = elementChildren(right);

  expect(left.type).toBe("svg");
  expect(left.props.viewBox).toBe("0 0 24 24");
  expect(leftChildren[1]?.props.x).toBe(3.5);
  expect(leftChildren[1]?.props.className).toContain("opacity-80");
  expect(leftChildren[2]?.props.d).toBe("M8.5 4.5V19.5");

  expect(rightChildren[1]?.props.x).toBe(16.5);
  expect(rightChildren[1]?.props.className).toContain("opacity-0");
  expect(rightChildren[2]?.props.d).toBe("M15.5 4.5V19.5");
});

