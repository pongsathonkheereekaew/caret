import { describe, expect, it } from "bun:test";
import { createTaskWebviewHtml, TASK_WEBVIEW_SCRIPT } from "../src/webview.ts";

describe("Caret task webview", () => {
	it("uses a nonce CSP and safe DOM rendering primitives", () => {
		const html = createTaskWebviewHtml({ cspSource: "vscode-resource://caret" }, "nonce123");
		expect(html).toContain("script-src 'nonce-nonce123'");
		expect(html).toContain("style-src vscode-resource://caret 'nonce-nonce123'");
		expect(html).toContain("textContent");
		expect(TASK_WEBVIEW_SCRIPT).not.toMatch(/\beval\s*\(/);
		expect(html).toContain("Enter send");
		expect(html).toContain("data-native-action=\"terminal\"");
		expect(html).toContain("OMP login");
		expect(TASK_WEBVIEW_SCRIPT).toContain("start_login");
		expect(TASK_WEBVIEW_SCRIPT).toContain("open_login_url");
	});

	it("keeps interactive controls keyed across polling snapshots", () => {
		expect(TASK_WEBVIEW_SCRIPT).toContain("const uiControls = new Map()");
		expect(TASK_WEBVIEW_SCRIPT).toContain("uiControls.get(item.token)");
		expect(TASK_WEBVIEW_SCRIPT).toContain("record.card.remove(); uiControls.delete(token)");
		expect(TASK_WEBVIEW_SCRIPT).toContain("uiControls.clear(); box.textContent = ''");
	});
});
