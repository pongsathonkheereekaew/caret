import { describe, expect, it } from "bun:test";
import { createTaskWebviewHtml, TASK_WEBVIEW_SCRIPT } from "../src/webview.ts";

describe("Caret task webview", () => {
	it("uses a nonce CSP and safe DOM rendering primitives", () => {
		const html = createTaskWebviewHtml({ cspSource: "vscode-resource://caret" }, "nonce123");
		expect(html).toContain("script-src 'nonce-nonce123'");
		expect(html).toContain("style-src vscode-resource://caret 'nonce-nonce123'");
		expect(html).toContain("textContent");
		expect(TASK_WEBVIEW_SCRIPT).not.toMatch(/\beval\s*\(/);
		expect(html).toContain("New task");
		expect(html).toContain("data-action=\"clear_search\"");
		expect(html).toContain("search-updating");
		expect(html).toContain("focus_search");
		expect(html).toContain("focus_task");
		expect(html).toContain("open_folder");
		expect(html).toContain("session-row");
		expect(html).toContain("session_menu");
		expect(TASK_WEBVIEW_SCRIPT).toMatch(/code-block|Copied/);
		expect(html).toContain("Plan, Build, / for skills, @ for context");
		expect(html).toContain("Plan New Idea");
		expect(html).toContain("This Mac");
		expect(html).toContain("Repositories");
		expect(html).not.toContain("What should we work on?");
		expect(html).not.toContain(">Host<");
		expect(html).toContain("Agents");
		expect(html).toContain("Pinned");
		expect(html).toContain("Work");
		expect(html).toContain("Files");
		expect(html).toContain("Enter send");
		expect(html).toContain("Hide panel");
		expect(html).toContain("Choose a project");
		expect(TASK_WEBVIEW_SCRIPT).toContain("start_login");
		expect(TASK_WEBVIEW_SCRIPT).toContain("open_login_url");
		expect(html).toContain("data-mode=\"ide\"");
		expect(TASK_WEBVIEW_SCRIPT).toContain("set_workbench_mode");
		expect(TASK_WEBVIEW_SCRIPT).toContain("persist_draft");
		expect(TASK_WEBVIEW_SCRIPT).toContain("persist_scroll");
		expect(TASK_WEBVIEW_SCRIPT).toContain("work_panel");
		expect(TASK_WEBVIEW_SCRIPT).toContain("inspect_outcome");
		expect(html).toContain("Jump to latest");
		expect(html).toContain("capability-catalog");
		expect(html).toContain("settings-route");
		expect(html).toContain("Create draft from query");
		expect(html).toContain("plan-strip");
		expect(html).toContain("attachment-chips");
		expect(html).toContain("data-action=\"show_settings\"");
		expect(html).toContain("data-action=\"task_actions\"");
		expect(html).toContain("data-scope=\"all\"");
		expect(html).toContain("mention-menu");
		expect(html).toContain("search-hits");
		expect(TASK_WEBVIEW_SCRIPT).toContain("review_file");
		expect(TASK_WEBVIEW_SCRIPT).toContain("activateSearchHit");
		expect(TASK_WEBVIEW_SCRIPT).toContain("renderCatalog");
		expect(TASK_WEBVIEW_SCRIPT).toContain("refresh_devices");
		expect(TASK_WEBVIEW_SCRIPT).toContain("open_workspace_file");
		expect(TASK_WEBVIEW_SCRIPT).toContain("pick_attachments");
		expect(TASK_WEBVIEW_SCRIPT).toContain("set_pref");
		expect(TASK_WEBVIEW_SCRIPT).toContain("work_panel_layout");
		expect(TASK_WEBVIEW_SCRIPT).toContain("approvalStatus");
		expect(TASK_WEBVIEW_SCRIPT).toContain("bindSash");
		expect(html).toContain("work-sash");
		expect(html).toContain("Dock bottom");
		expect(html).toContain("sidebar-sash");
		expect(html).toContain("Back to task");
		expect(TASK_WEBVIEW_SCRIPT).toContain("bindSidebarSash");
		expect(TASK_WEBVIEW_SCRIPT).toContain("primaryReason");
		expect(TASK_WEBVIEW_SCRIPT).toContain("Deny");
		expect(TASK_WEBVIEW_SCRIPT).toContain("lastSentDraft");
		expect(TASK_WEBVIEW_SCRIPT).toContain("Apply proposal");
		expect(TASK_WEBVIEW_SCRIPT).toContain("headerMeta");
		expect(html).toContain("a11y-live");
		expect(TASK_WEBVIEW_SCRIPT).not.toContain("workbench.view.scm");
		expect(html).toContain("task-filters");
		expect(html).toContain("restore-sent");
		expect(TASK_WEBVIEW_SCRIPT).toContain("export_diagnostics");
		expect(TASK_WEBVIEW_SCRIPT).toContain("16384");
		expect(TASK_WEBVIEW_SCRIPT).toContain("multi_select");
		expect(TASK_WEBVIEW_SCRIPT).toContain("persistDraftSoon");
		expect(TASK_WEBVIEW_SCRIPT).toContain("apply_settings");
		expect(TASK_WEBVIEW_SCRIPT).toContain("settingsDraft.revision");
		expect(TASK_WEBVIEW_SCRIPT).toContain("reset_settings");
		expect(TASK_WEBVIEW_SCRIPT).toContain("route_error_action");
		expect(TASK_WEBVIEW_SCRIPT).toContain("History changed");
		expect(TASK_WEBVIEW_SCRIPT).toContain("Older pages are not advertised.");
		expect(TASK_WEBVIEW_SCRIPT).toContain("last-good");
		expect(TASK_WEBVIEW_SCRIPT).toContain("Switch to B");
		expect(html).toContain("route-error");
		expect(html).toContain("--caret-sidebar: 180px");
		expect(html).toContain("min-width: 160px");
		expect(html).toContain("--caret-font-xs: 11px");
		expect(html).toContain("--caret-font-sm: 12px");
		expect(html).toContain("--caret-font-base: 13px");
		expect(html).toContain("--caret-font-lg: 14px");
		expect(html).toContain("--caret-lh-xs: 14px");
		expect(html).toContain("--caret-lh-sm: 16px");
		expect(html).toContain("--caret-lh-base: 18px");
		expect(html).toContain("--caret-lh-lg: 22px");
		// The reference's agent CSS sets its sidebar menu/tray rows to
		// --cursor-height-base (28px), but its rendered row BOX measures 30px,
		// which is what a user sees (hover height, list rhythm). Measure both
		// apps the same way and the reference's "New Chat" fill is 30px tall.
		expect(html).toContain("--caret-row: 30px");
		expect(html).toContain("--caret-sidebar-icon: 13px");
		// Same-window-size measurement (1710px): the reference's prompt-input
		// card is 608px wide including its border. 437px was a proportional
		// guess from a 1224px capture that a like-for-like render disproved.
		expect(html).toContain("--caret-transcript-column: 608px");
		expect(html).toContain("--caret-composer-column: 608px");
		// D20 parity locks: values that define the Cursor-matched shell. These
		// must not drift back to raw literals or caretake-only defaults.
		expect(html).toContain("--caret-control-radius: 6px");
		// The reference's prompt-input radii are per state (compact radius-full,
		// island radius-3xl, expanded radius-4xl); Caret's multi-line composer is
		// the expanded shape, so 18px - not the 10/12px Caret shipped.
		expect(html).toContain("--caret-composer-radius: 18px");
		expect(html).toContain("--caret-composer-editor-min: 36px");
		expect(html).toContain("--caret-composer-editor-max: 200px");
		// No border-radius may leave the reference's radius scale
		// (--cursor-radius-none/xs/sm/base/lg/xl/2xl/3xl/4xl/full). Values like
		// 1px, 5px, 10px and 11px are not in it, and two of those shipped.
		const radiusScale = new Set([0, 2, 4, 6, 8, 12, 14, 16, 18, 9999]);
		const offScale: string[] = [];
		for (const decl of html.matchAll(/border-radius:\s*([^;{}]+)/g)) {
			for (const px of decl[1]!.matchAll(/(?<![\w.-])(\d+)px/g)) {
				if (!radiusScale.has(Number(px[1]))) offScale.push(`${px[1]}px in "${decl[1]!.trim()}"`);
			}
		}
		expect(offScale).toEqual([]);
		expect(html).toContain("font-size: var(--caret-font-lg); line-height: var(--caret-lh-lg)");
		// The code role (terminal, diff, tool output) is 13/20 everywhere.
		expect(html).not.toContain("font: 12px/18px ui-monospace");
		expect(html).toContain(".term-log");
		expect(html).toContain("13px/20px var(--vscode-editor-font-family");
		// The floating connection/mode cluster must not sit under the header
		// resource links, and the primary control must size to word labels.
		expect(html).toContain("--caret-top-cluster: 124px");
		expect(html).toContain("padding-right: calc(var(--caret-space-12) + var(--caret-top-cluster))");
		expect(html).toContain(".send-round { width: auto; height: var(--caret-height-lg); min-width: var(--caret-height-lg); padding: 0 var(--caret-space-10); border-radius: var(--caret-radius-full)");
		expect(html).not.toContain("border-radius: 50%; background: var(--caret-text)");
		// The shell also renders in the narrow secondary side bar dock, so the
		// page must not impose a minimum width that causes sideways scrolling.
		expect(html).toContain("body { margin: 0; min-width: 0;");
		expect(html).not.toContain("min-width: 320px;");
		// D20 parity: the CSS fallbacks must equal DEFAULT_MOTION_TOKENS, and both
		// follow the reference product's published motion scale (instant 50, fast
		// 100, normal 150, slow 200; easing-out-cubic).
		expect(html).toContain("--caret-motion-instant: 50ms");
		expect(html).toContain("--caret-motion-drawer-in: 200ms");
		expect(html).toContain("--caret-motion-drawer-out: 150ms");
		expect(html).toContain("cubic-bezier(0.215, 0.61, 0.355, 1)");
		expect(html).toContain("--caret-motion-drawer-in");
		expect(html).toContain("This task is gone");
		expect(html).toContain("more-menu");
		expect(TASK_WEBVIEW_SCRIPT).toContain("more_action");
		expect(TASK_WEBVIEW_SCRIPT).toContain("shellLayout");
		expect(TASK_WEBVIEW_SCRIPT).toContain("noGit");
		expect(TASK_WEBVIEW_SCRIPT).toContain("type: 'viewport'");
		expect(TASK_WEBVIEW_SCRIPT).toContain("copy_queue_draft");
		expect(TASK_WEBVIEW_SCRIPT).toContain("revoke_device");
		expect(TASK_WEBVIEW_SCRIPT).toContain("inlinePreview");
		expect(TASK_WEBVIEW_SCRIPT).toContain("OMP has not advertised queue mutation.");
		expect(TASK_WEBVIEW_SCRIPT).toContain("find_in_transcript");
		expect(TASK_WEBVIEW_SCRIPT).toContain("destination-menu");
		expect(TASK_WEBVIEW_SCRIPT).toContain("All types");
		expect(html).toContain("Find in transcript");
		expect(html).toContain("transcript-find");
		expect(html).toContain("settings-section-select");
		expect(TASK_WEBVIEW_SCRIPT).toContain("Commit and Push");
		expect(TASK_WEBVIEW_SCRIPT).toContain("diagnosticsPreview");
		expect(TASK_WEBVIEW_SCRIPT).toContain("will not auto-push");
		expect(TASK_WEBVIEW_SCRIPT).toContain("mark_all_read");
		expect(TASK_WEBVIEW_SCRIPT).toContain("System notifications: off");
		expect(html).toContain("projects-drawer");
		expect(html).toContain("sidebar-scrim");
		expect(TASK_WEBVIEW_SCRIPT).toContain("sidebar-drawer");
		expect(TASK_WEBVIEW_SCRIPT).toContain("sidebar-open");
		expect(TASK_WEBVIEW_SCRIPT).toContain("controls.primary === 'queue'");
		expect(TASK_WEBVIEW_SCRIPT).toContain("olderPagesAdvertised !== false");
		expect(TASK_WEBVIEW_SCRIPT).toContain("responded_elsewhere");
		expect(TASK_WEBVIEW_SCRIPT).toContain("download_artifact");
		expect(TASK_WEBVIEW_SCRIPT).toContain("filters.environment === 'This Mac'");
		expect(TASK_WEBVIEW_SCRIPT).toContain("Collapse all");
		expect(TASK_WEBVIEW_SCRIPT).toContain("kind === 'user'");
		expect(TASK_WEBVIEW_SCRIPT).toContain("Open user terminal");
		expect(TASK_WEBVIEW_SCRIPT).toContain("does not embed the shell");
		expect(TASK_WEBVIEW_SCRIPT).toContain("focus_user_pty");
		expect(TASK_WEBVIEW_SCRIPT).toContain("open_recent");
		expect(TASK_WEBVIEW_SCRIPT).toContain("welcome-panel");
		expect(TASK_WEBVIEW_SCRIPT).toContain("welcome_clone");
		expect(TASK_WEBVIEW_SCRIPT).toContain("layoutPanes");
		expect(html).toContain("split-host");
		expect(html).toContain("live-pane");
		expect(TASK_WEBVIEW_SCRIPT).toContain("renderSplit");
		expect(TASK_WEBVIEW_SCRIPT).toContain("persist_pane_draft");
		expect(TASK_WEBVIEW_SCRIPT).toContain("set_layout_ratio");
		expect(TASK_WEBVIEW_SCRIPT).toContain("firstVisibleMessageAnchor");
		expect(TASK_WEBVIEW_SCRIPT).toContain("Same task. This pane keeps its own scroll and draft");
		expect(TASK_WEBVIEW_SCRIPT).toContain("layoutBoxes");
		expect(TASK_WEBVIEW_SCRIPT).toContain("layoutSashes");
		expect(TASK_WEBVIEW_SCRIPT).toContain("fillLiveExtraPane");
		expect(TASK_WEBVIEW_SCRIPT).toContain("pop_to_ide");
		expect(TASK_WEBVIEW_SCRIPT).toContain("browserBridge");
		expect(TASK_WEBVIEW_SCRIPT).toContain("Inspect");
		expect(html).toContain("Open in IDE");
		expect(html).toContain("pane-strip");
		expect(html).toContain('data-action="show_projects">Projects');
		expect(TASK_WEBVIEW_SCRIPT).toContain("select_destination");
		expect(TASK_WEBVIEW_SCRIPT).toContain("mention_pick");
		expect(TASK_WEBVIEW_SCRIPT).toContain("refresh_branch");
		expect(TASK_WEBVIEW_SCRIPT).toContain("need-more-space");
		expect(TASK_WEBVIEW_SCRIPT).toContain("Need more space to split this task");
		expect(TASK_WEBVIEW_SCRIPT).toContain("lastHostSyncAt");
		expect(TASK_WEBVIEW_SCRIPT).toContain("applyEmptyHome");
		expect(TASK_WEBVIEW_SCRIPT).toContain("searchComposing");
		expect(TASK_WEBVIEW_SCRIPT).toContain("Open full log");
		expect(TASK_WEBVIEW_SCRIPT).toContain("Open in IDE");
		expect(TASK_WEBVIEW_SCRIPT).toContain("displayStatus");
		expect(TASK_WEBVIEW_SCRIPT).toContain("item.canSubmit === false");
		expect(html).toContain("space-note");
		expect(html).toContain("branch-menu");
		expect(TASK_WEBVIEW_SCRIPT).toContain("select_thinking_level");
		expect(TASK_WEBVIEW_SCRIPT).toContain("retry_attachment");
		expect(TASK_WEBVIEW_SCRIPT).toContain("create_worktree");
		expect(TASK_WEBVIEW_SCRIPT).toContain("cancel_worktree");
		expect(TASK_WEBVIEW_SCRIPT).toContain("restart_resource");
		expect(TASK_WEBVIEW_SCRIPT).toContain("PR ' + pr");
		expect(TASK_WEBVIEW_SCRIPT).toContain("Waiting for host");
		expect(TASK_WEBVIEW_SCRIPT).toContain("Select at least one option.");
		expect(TASK_WEBVIEW_SCRIPT).toContain("data-ui-scoped");
		expect(TASK_WEBVIEW_SCRIPT).toContain("receipt.status === 'creating'");
		expect(html).toContain("worktree-receipt");
		expect(TASK_WEBVIEW_SCRIPT).toContain("highContrast");
		expect(TASK_WEBVIEW_SCRIPT).toContain("review-split");
		expect(TASK_WEBVIEW_SCRIPT).toContain("dirtyConflict");
		expect(TASK_WEBVIEW_SCRIPT).toContain("set_queue_collapsed");
		expect(TASK_WEBVIEW_SCRIPT).toContain("connectionBadge");
		expect(TASK_WEBVIEW_SCRIPT).toContain("closeTransientMenus");
		expect(html).toContain("run-status");
		expect(TASK_WEBVIEW_SCRIPT).toContain("does not invent hunks");
		expect(TASK_WEBVIEW_SCRIPT).toContain("review-request");
		expect(html).toContain("thinking-select");
		expect(html).toContain("Review request");
		expect(html).toContain("aria-live=\"polite\"");
		expect(TASK_WEBVIEW_SCRIPT).toContain("parseMarkdownTable");
		expect(TASK_WEBVIEW_SCRIPT).toContain("maximize_area");
		expect(TASK_WEBVIEW_SCRIPT).toContain("select_branch_ref");
		expect(TASK_WEBVIEW_SCRIPT).toContain("data-setting-id");
		expect(TASK_WEBVIEW_SCRIPT).toContain("subagentTree");
		expect(TASK_WEBVIEW_SCRIPT).toContain("open_in_split");
		expect(TASK_WEBVIEW_SCRIPT).toContain("Open in split");
		expect(TASK_WEBVIEW_SCRIPT).toContain("scrollKey");
		expect(TASK_WEBVIEW_SCRIPT).toContain("startupView");
		expect(TASK_WEBVIEW_SCRIPT).toContain("windowRestore");
		expect(TASK_WEBVIEW_SCRIPT).toContain("autoHideEmptyIde");
		expect(TASK_WEBVIEW_SCRIPT).toContain("select_theme");
		expect(TASK_WEBVIEW_SCRIPT).toContain("open_keybindings");
		expect(TASK_WEBVIEW_SCRIPT).toContain("open_merge_editor");
		expect(TASK_WEBVIEW_SCRIPT).toContain("Open merge editor");
		expect(TASK_WEBVIEW_SCRIPT).toContain("Bring back");
		expect(TASK_WEBVIEW_SCRIPT).toContain("will not invent a bring-back");
		expect(TASK_WEBVIEW_SCRIPT).toContain("shortcutRows");
		expect(TASK_WEBVIEW_SCRIPT).toContain("settingsSection !== 'Tools/MCP'");
		expect(TASK_WEBVIEW_SCRIPT).toContain("if (settingsSection === 'Agents/OMP') post({ type: 'get_login_providers' })");
		expect(TASK_WEBVIEW_SCRIPT).toContain("reconcileTranscriptBox");
		expect(TASK_WEBVIEW_SCRIPT).toContain("card.dataset.built");
		expect(TASK_WEBVIEW_SCRIPT).toContain("navigate_projects");
		expect(TASK_WEBVIEW_SCRIPT).toContain("route_back");
		expect(TASK_WEBVIEW_SCRIPT).toContain("route_forward");
		expect(html).toContain("projects-route");
		expect(TASK_WEBVIEW_SCRIPT).toContain("Retry step");
		expect(TASK_WEBVIEW_SCRIPT).toContain("will not invent a retry owner");
		expect(TASK_WEBVIEW_SCRIPT).toContain("primaryEnabled !== true");
		expect(TASK_WEBVIEW_SCRIPT).toContain("steerEnabled !== true");
		expect(TASK_WEBVIEW_SCRIPT).toContain("stopEnabled !== true");
		expect(TASK_WEBVIEW_SCRIPT).toContain("open_settings");
		expect(TASK_WEBVIEW_SCRIPT).toContain("Connect your iPhone");
		expect(TASK_WEBVIEW_SCRIPT).toContain("host_settings");
		expect(TASK_WEBVIEW_SCRIPT).toContain("function persistDraftNow()");
		expect(TASK_WEBVIEW_SCRIPT).toContain("Use Add \\u2192 Model to refresh");
		expect(TASK_WEBVIEW_SCRIPT).toContain("if (target.dataset.nativeAction === 'files') persistDraftNow()");
		expect(TASK_WEBVIEW_SCRIPT).toContain("action === 'open_folder') { persistDraftNow()");
		expect(html).toContain("composer-bar { display: flex; flex-wrap: nowrap");
		expect(html).toContain("composer-bar .shortcut { display: none; }");
		expect(html).toContain(".sidebar-filters[hidden] { display: none; }");
		expect(html).toContain(".empty[hidden] { display: none; }");
		expect(html).toContain('aria-label="Choose a model"');
		expect(html).toContain("disabled>↑</button>");
		expect(TASK_WEBVIEW_SCRIPT).toContain("let taskActionsOpen = false");
		expect(TASK_WEBVIEW_SCRIPT).toContain("taskActionsTrigger = null");
		expect(TASK_WEBVIEW_SCRIPT).toContain("function closeTaskActions()");
		expect(TASK_WEBVIEW_SCRIPT).toContain("taskActionsOpen = true");
		expect(TASK_WEBVIEW_SCRIPT).toContain("const first = menu.querySelector('button:not([disabled])') || menu.querySelector('button')");
		expect(TASK_WEBVIEW_SCRIPT).toContain("closeTaskActions(); event.preventDefault(); return;");
		expect(TASK_WEBVIEW_SCRIPT).toContain("closeTaskActions(); post({ type: 'more_action'");
		expect(TASK_WEBVIEW_SCRIPT).toContain("closeTaskActions(); openSettings");
		expect(TASK_WEBVIEW_SCRIPT).toContain("closeTaskActions();\n    ['destination-menu'");
		expect(TASK_WEBVIEW_SCRIPT).toContain("steer.title = reason");
		expect(TASK_WEBVIEW_SCRIPT).toContain("queue.title = reason");
		expect(TASK_WEBVIEW_SCRIPT).toContain("stop.title = reason");
		expect(html).toContain("overflow: hidden");
		expect(TASK_WEBVIEW_SCRIPT).not.toContain("workbench.view.scm");
	});

	it("keeps interactive controls keyed across polling snapshots", () => {
		expect(TASK_WEBVIEW_SCRIPT).toContain("const uiControls = new Map()");
		expect(TASK_WEBVIEW_SCRIPT).toContain("uiControls.get(item.token)");
		expect(TASK_WEBVIEW_SCRIPT).toContain("record.card.remove(); uiControls.delete(token)");
		expect(TASK_WEBVIEW_SCRIPT).toContain("uiControls.clear(); box.textContent = ''");
	});
});
