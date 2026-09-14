import { describe, expect, it } from "bun:test";
import { announceSummary, contrastRoles, CONTRAST_RATIOS, DEFAULT_MOTION_TOKENS, hitAreaCss, motionDuration, motionTokens } from "../src/ui-a11y.ts";

describe("tokens, motion, and a11y helpers (UI-S5)", () => {
	it("documents contrast floors of 4.5:1 text and 3:1 UI", () => {
		expect(CONTRAST_RATIOS.text).toBe(4.5);
		expect(CONTRAST_RATIOS.ui).toBe(3);
		const roles = contrastRoles();
		expect(roles.text.minRatio).toBe(4.5);
		expect(roles.ui.minRatio).toBe(3);
	});

	it("keeps mode switch at 0ms and honors reduced motion", () => {
		expect(motionDuration("modeSwitch", false)).toEqual({ enterMs: 0, exitMs: 0 });
		expect(motionDuration("modeSwitch", true)).toEqual({ enterMs: 0, exitMs: 0 });
		// Drawer steps come from the reference's own duration scale: slow (200)
		// in, normal (150) out.
		expect(motionDuration("drawer", false)).toEqual({ enterMs: 200, exitMs: 150 });
		expect(motionDuration("drawer", true)).toEqual({ enterMs: 0, exitMs: 0 });
		expect(motionDuration("menu", false)).toEqual({ enterMs: 150, exitMs: 100 });
		expect(motionDuration("menu", true)).toEqual({ enterMs: 0, exitMs: 0 });
		expect(motionDuration("toolExpand", false)).toEqual({ enterMs: 150, exitMs: 150 });
		expect(motionDuration("toolExpand", true)).toEqual({ enterMs: 0, exitMs: 0 });
		expect(motionTokens(false)).toEqual(DEFAULT_MOTION_TOKENS);
		expect(motionTokens(true)).toEqual({
			instant: 0,
			feedback: 0,
			surfaceIn: 0,
			surfaceOut: 0,
			drawerIn: 0,
			drawerOut: 0,
			curve: DEFAULT_MOTION_TOKENS.curve,
		});
	});

	it("sets desktop hit area to 32px and mentions 44pt for touch", () => {
		expect(hitAreaCss.desktopMinPx).toBe(32);
		expect(hitAreaCss.touchMinPt).toBe(44);
		expect(hitAreaCss.css).toContain("32");
		expect(hitAreaCss.css).toContain("44");
	});

	it("announces connection and run summaries, never every token", () => {
		const summary = announceSummary({
			connection: "offline",
			run: "running",
			tokenText: "fn foo() { return 1; } ".repeat(40),
		});
		expect(summary).toContain("offline");
		expect(summary.toLowerCase()).toContain("run");
		expect(summary).not.toContain("fn foo");
		expect(announceSummary({ connection: "online", run: "idle" })).toContain("connected");
	});
});
