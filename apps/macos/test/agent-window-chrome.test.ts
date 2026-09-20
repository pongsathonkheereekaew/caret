import { expect, it } from "bun:test";
// The desktop build owns Electron types; load its pure geometry at runtime.
const desktopChromePath = "../../../desktop/src/vs/platform/window/electron-main/cediaAgentChrome.ts";
const { resolveCediaAgentTrafficLightPosition, CEDIA_AGENT_HEADER_HEIGHT_PX, CEDIA_AGENT_TRAFFIC_LIGHT_DOT_RADIUS_PX } = await import(desktopChromePath);
import { CHAT_SURFACE_HEADER_HEIGHT_PX, MAC_TRAFFIC_LIGHT_DOT_RADIUS_PX, getMacTrafficLightPosition } from "../agent-window/vendor/synara/packages/shared/src/desktopChrome";

it("keeps native traffic lights centered on the renderer header at each supported zoom", () => {
  expect(CEDIA_AGENT_HEADER_HEIGHT_PX).toBe(CHAT_SURFACE_HEADER_HEIGHT_PX);
  expect(CEDIA_AGENT_TRAFFIC_LIGHT_DOT_RADIUS_PX).toBe(MAC_TRAFFIC_LIGHT_DOT_RADIUS_PX);
  expect(resolveCediaAgentTrafficLightPosition(1)).toEqual(getMacTrafficLightPosition());
  for (const factor of [0.5, 1 / 1.2, 1, 1.2, 1.44, 2]) {
    const position = resolveCediaAgentTrafficLightPosition(factor);
    expect(Math.abs(position.y + MAC_TRAFFIC_LIGHT_DOT_RADIUS_PX - CHAT_SURFACE_HEADER_HEIGHT_PX * factor / 2)).toBeLessThanOrEqual(0.5);
  }
});
