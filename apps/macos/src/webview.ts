/** Framework-free task surface used by both the sidebar view and the full
 * Agents window.  Dynamic values are always assigned with textContent or
 * attribute setters; the page never accepts HTML from OMP. */

export interface WebviewLike {
	readonly cspSource: string;
}

export const TASK_WEBVIEW_CSS = String.raw`
:root {
	color-scheme: light dark;
	--caret-bg: var(--vscode-editor-background, #202124);
	--caret-panel: var(--vscode-sideBar-background, #252526);
	--caret-panel-raised: var(--vscode-editorWidget-background, #2d2d30);
	--caret-input: var(--vscode-input-background, #313131);
	--caret-text: var(--vscode-foreground, #e7e7e7);
	--caret-muted: var(--vscode-descriptionForeground, #a8a8a8);
	--caret-border: var(--vscode-panel-border, #3d3d40);
	--caret-control-border: var(--vscode-input-border, var(--vscode-contrastBorder, #3d3d40));
	--caret-focus: var(--vscode-focusBorder, #6cb6ff);
	--caret-accent: var(--vscode-button-background, #0e639c);
	--caret-accent-text: var(--vscode-button-foreground, #fff);
	--caret-link: var(--vscode-textLink-foreground, #6cb6ff);
	--caret-selected-bg: var(--vscode-list-activeSelectionBackground, #094771);
	--caret-selected-fg: var(--vscode-list-activeSelectionForeground, #fff);
	--caret-hover-bg: var(--vscode-list-hoverBackground, #2a2d2e);
	--caret-danger: var(--vscode-errorForeground, #f48771);
	--caret-warning: var(--vscode-editorWarning-foreground, #cca700);
	--caret-success: var(--vscode-testing-iconPassed, #73c991);
	/* Cursor UI roles: metadata xs/sm, sidebar sm, controls base, transcript lg. */
	--caret-font-xs: 11px; --caret-font-sm: 12px; --caret-font-base: 13px; --caret-font-lg: 14px;
	--caret-lh-xs: 14px; --caret-lh-sm: 16px; --caret-lh-base: 18px; --caret-lh-lg: 22px;
	--caret-height-xs: 20px; --caret-height-sm: 24px; --caret-height-base: 28px; --caret-height-lg: 32px;
	/* Sidebar row height. The reference's own agent CSS sets
	 * --ui-sidebar-menu-button-min-height and --ui-tray-row-min-height to
	 * --cursor-height-base (28px), but its rendered row BOX measures 30px: the
	 * "New Chat" row's own highlight fill spans y48..77 of a 1073px window,
	 * and the sidebar's text-row pitch measures ~30.7px over ~20 rows. A
	 * min-height of 28 with zero padding cannot produce that, so the rendered
	 * box is what a user sees (hover height, list rhythm) and Caret matches the
	 * box. Set this back to 28px to reproduce only the token. */
	--caret-row: 30px;
	/* Reference: --ui-sidebar-action-icon-size = spacing-3-25 = 13px. */
	--caret-sidebar-icon: 13px;
	--caret-space-4: 4px; --caret-space-6: 6px; --caret-space-8: 8px; --caret-space-10: 10px; --caret-space-12: 12px; --caret-space-16: 16px; --caret-space-20: 20px; --caret-space-24: 24px; --caret-space-28: 28px; --caret-space-32: 32px; --caret-space-40: 40px; --caret-space-44: 44px; --caret-space-48: 48px;
	--caret-radius-xs: 2px; --caret-radius-sm: 4px; --caret-radius-md: 6px; --caret-radius: 8px; --caret-radius-xl: 12px; --caret-radius-2xl: 14px; --caret-radius-3xl: 16px; --caret-radius-4xl: 18px; --caret-radius-full: 9999px;
	/* control radius = the reference's radius-base (6). The composer uses the
	 * reference's prompt-input radii, which are per state: compact is
	 * radius-full, dynamic island is radius-3xl (16) and expanded - a multi-line
	 * composer with a toolbar, which is what Caret's is - is radius-4xl (18).
	 * Caret used 10px then 12px, neither of which is a composer radius in the
	 * reference's scale. */
	--caret-control-radius: 6px; --caret-composer-radius: 18px;
	/* Reference --prompt-input-editor-min-height = spacing-9 = 36px and
	 * --prompt-input-editor-max-height = 200px. */
	--caret-composer-editor-min: 36px; --caret-composer-editor-max: 200px;
	/* Composer surface. The reference paints the prompt input with
	 * --prompt-input-container-bg = --cursor-bg-input-surface =
	 * color-mix(in srgb, var(--cursor-base) 6%, transparent), i.e. one 6% step
	 * above the page, not a raised panel. Measured in the reference's live
	 * light window: the card reads #FCFCFC - the same value as
	 * editor.background - on a page that reads #F5F5F6, and its own token
	 * --prompt-input-container-shadow is none. Caret painted the card with
	 * the chrome colour (#F3F3F3), one step BELOW the page: the opposite
	 * direction from the reference. */
	--caret-composer-surface: color-mix(in srgb, #fff 6%, var(--caret-bg));
	/* Transcript / composer column. Measured directly: with the SAME 1710px
	 * window as the reference, the reference's empty-draft prompt-input card
	 * spans x679..1286 = 608px (its 1px border included), centred in the main
	 * pane. The 437px Caret shipped came from a proportional guess (41.8% of
	 * the pane) off a 1224px render, and a same-size render disproves it:
	 * Caret's own card is 397px at both 1224px and 1710px windows, i.e. the
	 * column is fixed, not proportional, and Caret's number was simply short.
	 * Still open: whether the reference's 608 is itself fixed or 41.8% of the
	 * pane (that reading gives 639 in Caret's pane). 608 is the only value
	 * measured on the reference at a like-for-like window size. */
	--caret-transcript-column: 608px; --caret-composer-column: 608px; --caret-composer-column-outer: calc(var(--caret-composer-column) + 2 * var(--caret-gutter));
	--caret-sidebar: 180px; --caret-panel-w: 360px; --caret-panel-h: 40vh; --caret-gutter: 24px;
	/* Lane reserved for the floating connection / mode cluster in the task
	 * header. The cluster is positioned over the header row, so the row must
	 * stop before it or the resource links underneath become unclickable. */
	--caret-top-cluster: 124px;
	--caret-elevate-1: 0 2px 8px rgb(0 0 0 / .32);
	--caret-elevate-2: 0 12px 36px rgb(0 0 0 / .24);
	/* These fallbacks must equal DEFAULT_MOTION_TOKENS (ui-a11y.ts) or the shell
	 * animates with one timing before the first host snapshot and a different
	 * one after. The values are the reference product's own motion scale
	 * (--cursor-duration-* / --cursor-easing-out-cubic). Tests pin them. */
	--caret-motion-instant: 50ms;
	--caret-motion-feedback: 100ms;
	--caret-motion-surface-in: 150ms;
	--caret-motion-surface-out: 100ms;
	--caret-motion-drawer-in: 200ms;
	--caret-motion-drawer-out: 150ms;
	--caret-motion-curve: cubic-bezier(0.215, 0.61, 0.355, 1);
}
/* hidden always wins: class display rules (grid/flex) must never unhide. */
[hidden] { display: none !important; }
* { box-sizing: border-box; }
html, body { height: 100%; }
/* No min-width: the same shell renders in the narrow secondary side bar dock,
 * where a 320px floor would force the whole surface to scroll sideways. */
body { margin: 0; min-width: 0; background: var(--caret-bg); color: var(--caret-text); font: var(--caret-font-base)/var(--caret-lh-base) var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif); }
a { color: var(--caret-link); text-decoration: underline; }
button, input, textarea, select { font: inherit; }
button { border: 1px solid transparent; border-radius: var(--caret-control-radius); background: transparent; color: inherit; cursor: pointer; min-height: var(--caret-height-base); min-width: var(--caret-height-base); padding: 0 var(--caret-space-8); }
button:hover:not(:disabled) { background: var(--caret-hover-bg); transition: background var(--caret-motion-feedback) var(--caret-motion-curve); }
button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible { outline: 2px solid var(--caret-focus); outline-offset: 2px; }
button.primary { background: var(--caret-accent); color: var(--caret-accent-text); font-weight: 500; }
button.ghost { color: var(--caret-muted); }
button.danger { color: var(--caret-danger); }
button:disabled { cursor: default; opacity: .55; }
input, textarea, select { border: 1px solid var(--caret-control-border); border-radius: var(--caret-control-radius); background: var(--caret-input); color: var(--caret-text); padding: 7px 9px; }
input::placeholder, textarea::placeholder { color: var(--caret-muted); }
.shell { display: grid; grid-template-columns: var(--caret-sidebar) 2px minmax(360px, 1fr); height: 100vh; overflow: hidden; }
.shell.work-open { grid-template-columns: var(--caret-sidebar) 2px minmax(360px, 1fr) 2px var(--caret-panel-w); }
.shell.sidebar-closed { grid-template-columns: minmax(360px, 1fr); }
.shell.sidebar-closed.work-open { grid-template-columns: minmax(360px, 1fr) 2px var(--caret-panel-w); }
.shell.sidebar-closed .sidebar, .shell.sidebar-closed .sidebar-sash { display: none; }
.shell:not(.work-open) .resources, .shell:not(.work-open) #work-sash { display: none; }
.sash { width: 2px; background: var(--caret-border); cursor: col-resize; }
.sash:focus-visible { outline: 2px solid var(--caret-focus); outline-offset: 0; }
.shell.work-bottom.work-open { grid-template-columns: var(--caret-sidebar) 2px minmax(360px, 1fr); grid-template-rows: minmax(240px, 1fr) 2px var(--caret-panel-h); }
.shell.work-bottom.sidebar-closed.work-open { grid-template-columns: minmax(0, 1fr); }
.shell.work-bottom.work-open #work-sash { width: auto; height: 2px; cursor: row-resize; grid-column: 1 / -1; }
.shell.work-bottom.work-open .sidebar-sash { width: 2px; height: auto; cursor: col-resize; }
.shell.work-bottom.work-open .resources { grid-column: 1 / -1; width: auto; max-width: none; min-width: 0; border-left: 0; border-top: 1px solid var(--caret-border); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.queue-item .meta { color: var(--caret-muted); font-size: 12px; line-height: 18px; }
.shell.density-detailed .message-body { font-size: 15px; line-height: 24px; }
.shell.resource-route { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); }
.shell.resource-route .sidebar, .shell.resource-route .sidebar-sash, .shell.resource-route .main, .shell.resource-route #work-sash { display: none; }
.shell.resource-route .resources { display: flex; width: auto; max-width: none; min-width: 0; border: 0; }
html.reduce-motion *, html.reduce-motion *::before, html.reduce-motion *::after { scroll-behavior: auto !important; transition: none !important; animation: none !important; }
.sidebar, .resources { display: flex; min-width: 0; flex-direction: column; background: var(--caret-panel); }
.sidebar { width: var(--caret-sidebar); min-width: 160px; max-width: 360px; border-right: 1px solid var(--caret-border); }
.resources { width: var(--caret-panel-w); min-width: 280px; max-width: 640px; border-left: 1px solid var(--caret-border); }
.sidebar-head, .resource-head, .topbar { display: flex; align-items: center; gap: var(--caret-space-8); min-width: 0; min-height: 46px; padding: 0 var(--caret-space-12); border-bottom: 1px solid var(--caret-border); }
/* The connection / mode cluster floats over the header row. Keep header
 * content out of that lane so Changes/Browser/Terminal/Files/More stay
 * clickable; below the wrap breakpoint the header stacks instead. */
@media (min-width: 620px) { .topbar { padding-right: calc(var(--caret-space-12) + var(--caret-top-cluster)); } }
.card-header { min-height: 30px; height: 30px; }
.topbar { position: relative; }
.brand { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; line-height: 22px; }
.brand-mark { width: 16px; height: 16px; flex: 0 0 auto; color: var(--caret-text); }
.sidebar-head .spacer, .topbar .spacer, .resource-head .spacer { flex: 1; }
.sidebar-search { padding: var(--caret-space-8) var(--caret-space-12); }
.attention { min-width: 22px; min-height: 22px; border-radius: var(--caret-radius-full); background: var(--caret-warning); color: var(--caret-bg); font-size: 12px; line-height: 22px; text-align: center; padding: 0 6px; }
.sidebar-search input { width: 100%; }
.section-label { display: flex; align-items: center; padding: var(--caret-space-16) var(--caret-space-12) var(--caret-space-8); color: var(--caret-text); font-size: 14px; font-weight: 600; line-height: 22px; }
.list { overflow: auto; padding: 0 var(--caret-space-4) var(--caret-space-16); }
.project, .session { display: flex; align-items: center; gap: 4px; width: 100%; min-height: var(--caret-row); height: var(--caret-row); margin: 0; padding: 0 var(--caret-space-4); border-radius: var(--caret-radius-sm); text-align: left; font-size: var(--caret-font-sm); line-height: var(--caret-lh-sm); }
.project:hover, .session:hover { background: var(--caret-hover-bg); }
.project.selected, .session.selected { background: var(--caret-selected-bg); color: var(--caret-selected-fg); }
.project .name, .session .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.project .meta, .session .meta { display: block; color: var(--caret-muted); font-size: 12px; line-height: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.session .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--caret-muted); flex: 0 0 auto; }
.session.running .dot { background: var(--caret-success); }
.session.unknown .dot, .session.recovery_required .dot { background: var(--caret-warning); }
.session .status-label { color: var(--caret-muted); font-size: var(--caret-font-xs); line-height: var(--caret-lh-xs); }
.sidebar-foot { margin-top: auto; padding: var(--caret-space-12); border-top: 1px solid var(--caret-border); display: grid; gap: 8px; }
.mode-switch { display: inline-flex; border: 1px solid var(--caret-control-border); border-radius: var(--caret-control-radius); }
.mode-switch button { min-width: 72px; min-height: 32px; border-radius: 0; font-weight: 500; }
.mode-switch button:first-child { border-radius: var(--caret-control-radius) 0 0 var(--caret-control-radius); }
.mode-switch button:last-child { border-radius: 0 var(--caret-control-radius) var(--caret-control-radius) 0; }
.mode-switch button[aria-pressed="true"] { background: var(--caret-selected-bg); color: var(--caret-selected-fg); }
.mode-switch button, .ide-btn { transition: none; }
.main { display: flex; min-width: 0; flex-direction: column; background: var(--caret-bg); }
.title-stack { min-width: 0; display: grid; }
.task-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 18px; line-height: 26px; font-weight: 600; }
.task-project { color: var(--caret-muted); font-size: 12px; line-height: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.connection { display: inline-flex; align-items: center; gap: var(--caret-space-6); min-height: var(--caret-height-sm); padding: 0 var(--caret-space-6); border: 1px solid var(--caret-control-border); border-radius: var(--caret-radius-sm); color: var(--caret-muted); font-size: var(--caret-font-xs); line-height: var(--caret-lh-xs); }
.connection::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.connection.running { color: var(--caret-success); }
.connection.unknown, .connection.connecting { color: var(--caret-warning); }
.connection.offline { color: var(--caret-danger); }
.run { display: inline-flex; align-items: center; min-height: var(--caret-height-sm); padding: 0 var(--caret-space-6); color: var(--caret-muted); font-size: var(--caret-font-xs); line-height: var(--caret-lh-xs); }
.run.running, .run.waiting { color: var(--caret-warning); }
.transcript-wrap { position: relative; flex: 1; min-height: 0; overflow: auto; }
.transcript { max-width: var(--caret-transcript-column); margin: 0 auto; padding: var(--caret-space-16) var(--caret-gutter) var(--caret-space-24); }
.message-body { max-width: 72ch; white-space: pre-wrap; overflow-wrap: anywhere; user-select: text; font-size: var(--caret-font-lg); line-height: var(--caret-lh-lg); font-weight: 400; }
.empty { display: grid; min-height: 240px; place-items: center; color: var(--caret-muted); text-align: center; padding: var(--caret-space-24); }
.empty strong { display: block; margin-bottom: 8px; color: var(--caret-text); font-size: 18px; font-weight: 600; line-height: 26px; }
.empty span { display: block; max-width: 42em; margin: 0 auto 16px; font-size: 14px; line-height: 22px; }
.empty-actions { display: flex; justify-content: center; gap: 8px; }
.empty[hidden] { display: none; }
.main.is-empty { justify-content: center; }
/* The docked composer carries --caret-gutter inline padding (line below), which
 * is correct for the task view but wrong for the empty state: it inset the
 * prompt-input card by 2*24px, so a 608px column rendered a 560px card. The
 * reference's empty card spans its whole column. */
.main.is-empty .composer { padding: 0; max-width: var(--caret-composer-column); width: min(var(--caret-composer-column), calc(100% - 48px)); margin: 0 auto; transform: none; border-top: 0; }
.main.is-empty .composer-box { border-radius: var(--caret-composer-radius); box-shadow: none; padding: 12px; }
.main.is-empty .chip-row { display: none; }
.main:not(.is-empty) .pills { display: none; }
.main.is-empty .transcript-wrap { display: none; }
.message { margin: 0 0 16px; }
.message-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; color: var(--caret-muted); font-size: 12px; line-height: 18px; }
.message-head strong { color: var(--caret-text); font-size: 12px; }
.message.user { padding: 12px; border: 1px solid var(--caret-border); border-radius: var(--caret-radius); background: var(--caret-panel); }
.tool-card { margin: 8px 0 12px; border: 1px solid var(--caret-border); border-radius: var(--caret-radius); overflow: hidden; }
.tool-summary { display: flex; align-items: center; gap: 8px; width: 100%; padding: 12px; text-align: left; }
.tool-summary .tool-name { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tool-state { color: var(--caret-muted); font-size: 12px; }
.tool-state.running { color: var(--caret-warning); }
.tool-state.completed { color: var(--caret-success); }
.tool-state.failed { color: var(--caret-danger); }
.tool-details { display: block; max-height: 0; opacity: 0; overflow: hidden; padding: 0 12px; border-top: 0; transition: max-height var(--caret-motion-surface-in) var(--caret-motion-curve), opacity var(--caret-motion-surface-in) linear; }
.tool-card.expanded .tool-details { max-height: 240px; opacity: 1; padding: 0 12px 12px; border-top: 1px solid var(--caret-border); overflow: auto; }
.tool-card.full-log.expanded .tool-details, .tool-card.full-log .tool-details pre { max-height: none; }
.tool-details pre { max-height: 240px; margin: 8px 0; padding: 8px; overflow: auto; border: 1px solid var(--caret-border); border-radius: 4px; background: var(--caret-input); font: 13px/20px var(--vscode-editor-font-family, ui-monospace, monospace); white-space: pre-wrap; overflow-wrap: anywhere; }
.tool-actions { display: flex; justify-content: flex-end; gap: 8px; }
.event-row { margin: 8px 0; padding: 8px; border-left: 2px solid var(--caret-border); color: var(--caret-muted); font-size: 12px; }
.composer { padding: var(--caret-space-12) var(--caret-gutter) var(--caret-space-16); border-top: 1px solid var(--caret-border); }
.composer-target { max-width: var(--caret-composer-column); margin: 0 auto var(--caret-space-8); color: var(--caret-muted); font-size: var(--caret-font-sm); line-height: var(--caret-lh-sm); }
.composer-box { max-width: var(--caret-composer-column); margin: 0 auto; border: 1px solid var(--caret-control-border); border-radius: var(--caret-composer-radius); background: var(--caret-composer-surface); box-shadow: none; }
.composer textarea { display: block; width: 100%; min-height: var(--caret-composer-editor-min); max-height: var(--caret-composer-editor-max); resize: vertical; border: 0; border-radius: var(--caret-composer-radius) var(--caret-composer-radius) 0 0; background: transparent; padding: var(--caret-space-8) var(--caret-space-12); font-size: var(--caret-font-lg); line-height: var(--caret-lh-lg); }
.composer textarea:focus { outline: none; }
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 12px 8px; }
.chip { display: inline-flex; align-items: center; gap: var(--caret-space-6); min-height: var(--caret-height-sm); padding: 0 var(--caret-space-6); border: 1px solid var(--caret-control-border); border-radius: var(--caret-radius-sm); color: var(--caret-muted); font-size: var(--caret-font-sm); line-height: var(--caret-lh-sm); }
.composer-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px; border-top: 1px solid var(--caret-border); }
.composer-controls .spacer { flex: 1; }
.composer-bar { display: flex; flex-wrap: nowrap; align-items: center; gap: 8px; min-width: 0; padding: 8px; overflow: hidden; }
.composer-bar .spacer { flex: 1 1 auto; min-width: 0; }
.composer-bar .shortcut { display: none; flex: 0 1 auto; min-width: 0; } /* composer-bar .shortcut { display: none; } */
.composer-bar .shortcut:not([hidden]) { display: inline-block; }
.composer-bar .shortcut[hidden] { display: none !important; }
.shortcut { color: var(--caret-muted); font-size: 12px; line-height: 18px; max-width: 28ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 0 1 auto; }
.sidebar-scrim { display: none; position: fixed; inset: 0; background: rgb(0 0 0 / .32); z-index: 5; }
.shell.sidebar-drawer.sidebar-open .sidebar-scrim { display: block; }
#projects-drawer { display: none; }
.shell.sidebar-drawer #projects-drawer { display: inline-flex; }
#projects-drawer[hidden] { display: none !important; }
.model-select { max-width: 200px; min-height: var(--caret-height-sm); border: 0; background: transparent; color: var(--caret-muted); }
.jump-latest { display: none; position: sticky; bottom: 8px; margin: 0 auto 8px; }
.jump-latest.visible { display: inline-flex; }
.queue-list { max-width: var(--caret-composer-column); margin: 0 auto var(--caret-space-8); }
.queue-item { padding: 8px; border: 1px solid var(--caret-border); border-radius: 8px; color: var(--caret-muted); font-size: 12px; }
.resource-tabs { display: flex; flex-wrap: nowrap; gap: 4px; overflow: auto; padding: 8px; border-bottom: 1px solid var(--caret-border); }
.resource-tabs button { min-height: 32px; }
.resource-tabs button[aria-selected="true"] { background: var(--caret-selected-bg); color: var(--caret-selected-fg); }
.resources .resource-body { overflow: auto; padding: var(--caret-space-16); }
.resource-card { margin-bottom: 16px; padding: 12px; border: 1px solid var(--caret-border); border-radius: var(--caret-radius); }
.resource-card h3 { margin: 0 0 8px; font-size: 14px; line-height: 22px; font-weight: 600; }
.resource-card p { margin: 0 0 12px; color: var(--caret-muted); font-size: 12px; line-height: 18px; }
.resource-action { display: flex; align-items: center; width: 100%; gap: 8px; margin: 4px 0; padding: 8px 12px; border: 1px solid var(--caret-control-border); text-align: left; }
.login-row { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
.login-row .name { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.login-row .meta { color: var(--caret-muted); font-size: 12px; line-height: 18px; }
.presentations { display: grid; gap: 8px; margin-top: 8px; }
.status-line { min-height: var(--caret-lh-sm); max-width: var(--caret-composer-column); margin: var(--caret-space-8) auto 0; color: var(--caret-muted); font-size: var(--caret-font-sm); line-height: var(--caret-lh-sm); }
.ui-requests { position: absolute; inset-inline: var(--caret-gutter); bottom: 16px; z-index: 2; display: grid; gap: 8px; max-width: 560px; margin: 0 auto; }
.ui-card { padding: 16px; border: 1px solid var(--caret-warning); border-radius: 12px; background: var(--caret-panel-raised); box-shadow: var(--caret-elevate-2); }
.ui-card h3 { margin: 0 0 8px; font-size: 14px; line-height: 22px; }
.ui-card p { margin: 0 0 12px; color: var(--caret-muted); white-space: pre-wrap; }
.ui-card textarea, .ui-card input, .ui-card select { width: 100%; margin: 0 0 12px; }
.ui-card.readonly { border-color: var(--caret-border); opacity: .92; }
.ui-meta { margin: 0 0 12px; color: var(--caret-muted); font-size: 12px; line-height: 18px; white-space: pre-wrap; }
.ui-actions { display: flex; justify-content: flex-end; gap: 8px; }
.pref-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
.pref-row button[aria-pressed="true"] { background: var(--caret-selected-bg); color: var(--caret-selected-fg); }
.term-log { margin: 0 0 12px; padding: 8px; max-height: 280px; overflow: auto; border: 1px solid var(--caret-border); border-radius: 6px; background: var(--caret-input); font: 13px/20px var(--vscode-editor-font-family, ui-monospace, monospace); white-space: pre-wrap; }
.term-meta { color: var(--caret-muted); font-size: 12px; }
.reconnect-banner { display: none; padding: 8px 12px; background: color-mix(in srgb, var(--caret-warning) 15%, transparent); color: var(--caret-warning); font-size: 12px; line-height: 18px; text-align: center; }
.reconnect-banner.visible { display: block; }
.search-empty { padding: 8px 12px 16px; color: var(--caret-muted); font-size: 12px; line-height: 18px; }
@media (max-width: 1199px) { :root { --caret-sidebar: 180px; --caret-gutter: 16px; } }
@media (max-width: 899px) { .shell, .shell.work-open { grid-template-columns: minmax(0, 1fr); } .sidebar { display: none; } .shell.sidebar-drawer .sidebar { display: flex; position: fixed; inset: 0 auto 0 0; width: min(320px, 86vw); max-width: 360px; z-index: 6; transform: translateX(-24px); opacity: 0; pointer-events: none; transition: transform var(--caret-motion-drawer-in) var(--caret-motion-curve), opacity var(--caret-motion-drawer-in) linear; } .shell.sidebar-drawer.sidebar-open .sidebar { transform: none; opacity: 1; pointer-events: auto; } .shell.work-open .resources { position: absolute; inset: 0; width: auto; max-width: none; min-width: 0; border: 0; z-index: 3; } :root { --caret-gutter: 16px; } }
@media (max-width: 619px) { :root { --caret-gutter: 12px; } .topbar { flex-wrap: wrap; min-height: 46px; } .shortcut { display: none; } }
/* Narrow single-column layout: let the composer bar wrap so the primary
 * control and Stop are never clipped by the nowrap overflow guard. */
@media (max-width: 619px) { .composer-bar { flex-wrap: wrap; overflow: visible; } .composer-bar .spacer { flex: 1 1 100%; } .model-select { max-width: 132px; } }
.sidebar { background: var(--caret-panel); }
.main { background: var(--caret-bg); }
.nav-row, .search-row { display: flex; align-items: center; gap: var(--caret-space-4); width: 100%; margin: 0; padding: 0 var(--caret-space-4); border-radius: var(--caret-radius-sm); text-align: left; color: var(--caret-text); font-size: var(--caret-font-sm); line-height: var(--caret-lh-sm); min-height: var(--caret-row); height: var(--caret-row); }
.nav-row .nav-icon, .search-row .nav-icon { width: var(--caret-sidebar-icon); height: var(--caret-sidebar-icon); flex: 0 0 auto; color: var(--caret-muted); }
.nav-row.current .nav-icon, .nav-row:hover:not(:disabled) .nav-icon { color: var(--caret-text); }
.nav-row .nav-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nav-row.current, .nav-row:hover:not(:disabled) { background: color-mix(in srgb, var(--caret-text) 8%, transparent); }
.search-row { position: relative; color: var(--caret-muted); gap: 8px; }
.search-row > span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
.search-row input { position: static; flex: 1; min-width: 0; opacity: 1; border: 0; background: transparent; color: var(--caret-text); padding: 0; }
.search-row:focus-within { background: color-mix(in srgb, var(--caret-text) 8%, transparent); color: var(--caret-text); }
.session-row { display: flex; align-items: center; gap: 2px; width: 100%; }
.session-row .session-open { flex: 1; min-width: 0; }
.ui-error { margin: 0 0 8px; color: var(--caret-danger); font-size: 12px; line-height: 18px; }
.worktree-receipt { margin: 8px 0 0; color: var(--caret-muted); font-size: 12px; line-height: 18px; }
.session-menu { flex: 0 0 auto; min-width: var(--caret-row); min-height: var(--caret-row); padding: 0; color: var(--caret-muted); }
.code-block { margin: 8px 0; border: 1px solid var(--caret-border); border-radius: 6px; overflow: hidden; background: var(--caret-input); }
.code-head { display: flex; align-items: center; gap: 8px; padding: 4px 8px; border-bottom: 1px solid var(--caret-border); color: var(--caret-muted); font-size: 12px; }
.code-head .code-lang { flex: 1; min-width: 0; }
.code-block pre { margin: 0; padding: 8px; overflow: auto; white-space: pre; }
.code-block pre.wrap { white-space: pre-wrap; }
.md-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 13px; }
.md-table th, .md-table td { border: 1px solid var(--caret-border); padding: 6px 8px; text-align: left; }
.md-table th { color: var(--caret-muted); font-weight: 600; }
.space-note-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.nav-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--caret-space-6); min-height: 32px; margin: var(--caret-space-10) 0 0; padding: 0 var(--caret-space-6); color: var(--caret-muted); font-size: var(--caret-font-sm); line-height: var(--caret-lh-sm); font-weight: 500; }
.nav-heading .nav-heading-label { min-width: 0; min-height: 32px; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; }
.nav-heading .nav-heading-label:hover:not(:disabled) { background: transparent; color: var(--caret-text); }
.nav-heading .nav-icon { width: 16px; height: 16px; }
.icon-quiet { min-width: 32px; min-height: 32px; padding: 0; color: var(--caret-muted); }
.session, .project { border-radius: var(--caret-radius-sm); min-height: var(--caret-row); height: var(--caret-row); gap: 4px; padding: 0 var(--caret-space-4); }
.session .meta, .project .meta { margin-left: auto; color: var(--caret-muted); font-size: var(--caret-font-sm); }
.nav-foot { margin-top: auto; padding: var(--caret-space-4) var(--caret-space-4) var(--caret-space-12); border-top: 0; }
.ide-btn { min-width: 52px; border: 0; color: var(--caret-muted); font-weight: 500; }
.top-ide { position: absolute; top: 8px; right: 12px; z-index: 2; display: flex; justify-content: flex-end; }
.main { position: relative; }
.home-stage { display: none; }
.thread { display: flex; flex: 1; min-height: 0; flex-direction: column; }
.welcome-panel { display: flex; flex-direction: column; gap: 8px; max-width: 420px; width: 100%; margin: 0 auto 16px; }
.welcome-kicker { font-size: 12px; letter-spacing: 0.08em; color: var(--caret-muted); }
.welcome-title { font-size: 18px; line-height: 26px; font-weight: 600; }
.pane-strip { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 12px 8px; }
.pane-strip[hidden] { display: none; }
.pane-chip { min-height: 32px; border-radius: var(--caret-control-radius); border: 1px solid var(--caret-border); background: var(--caret-panel); color: var(--caret-text); padding: 0 10px; }
.pane-chip.active { border-color: var(--caret-accent); }
.split-host { display: flex; flex: 1; min-height: 0; min-width: 0; position: relative; }
.split-host.split-row { flex-direction: row; }
.split-host.split-column { flex-direction: column; }
.split-host.split-painted { display: block; }
.split-pane { display: flex; flex: 1 1 0; flex-direction: column; min-width: 0; min-height: 0; }
.split-host.split-painted .split-pane { overflow: hidden; }
.split-sash { flex: 0 0 2px; background: var(--caret-border); cursor: col-resize; z-index: 3; }
.split-host.split-column .split-sash { cursor: row-resize; }
.pane-draft { flex: 1; min-height: 72px; width: 100%; resize: none; background: var(--caret-input); color: var(--caret-text); border: 1px solid var(--caret-control-border); border-radius: var(--caret-control-radius); padding: 8px; }
.pane-head { display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 12px; border-bottom: 1px solid var(--caret-border); }
.pane-transcript { flex: 1; min-height: 0; overflow: auto; }
.pane-composer { display: flex; gap: 8px; align-items: flex-end; padding: 8px; border-top: 1px solid var(--caret-border); }
.work-tab-badge { margin-left: 6px; min-width: 8px; min-height: 8px; border-radius: 4px; background: var(--caret-warning); }
.work-tab-badge.error { background: var(--caret-danger); }
button.unavailable { opacity: .7; }
.main.split-open { justify-content: stretch; padding: 0; }
.main.split-open.is-empty .split-host { flex: 1; min-height: 360px; }
.main.is-empty .home-stage { display: flex; flex-direction: column; align-items: center; justify-content: center; padding-top: 0; }
.main.is-empty .thread { display: none; }
.main.is-empty { justify-content: center; padding: 12vh 24px 8vh; }
@media (min-height: 600px) { .main.is-empty { justify-content: flex-start; padding-top: 35vh; } }
.main.is-empty .composer { padding: 0; max-width: var(--caret-composer-column); width: min(var(--caret-composer-column), calc(100% - 48px)); margin: 0 auto; transform: none; border-top: 0; }
.main.is-empty .composer-box { border: 1px solid var(--caret-control-border); border-radius: var(--caret-composer-radius); background: var(--caret-composer-surface); box-shadow: none; padding: var(--caret-space-12); }
/* One-line draft, like the reference: --prompt-input-editor-min-height is 36px
 * (spacing-9) and its empty composer renders a single line above the toolbar.
 * Caret shipped rows=3, which made the empty card 46px taller than the
 * reference's 106px. */
.main.is-empty textarea { border: 0; background: transparent; height: var(--caret-composer-editor-min); min-height: var(--caret-composer-editor-min); max-height: var(--caret-composer-editor-min); resize: none; padding: 0; }
.main.is-empty .composer-bar { display: flex; align-items: center; gap: var(--caret-space-8); padding: 0; }
.main.is-empty #steer, .main.is-empty #follow-up, .main.is-empty #stop, .main.is-empty #shortcut-hint { display: none !important; }
.main:not(.is-empty) .home-stage, .main:not(.is-empty) .mode-pills, .main:not(.is-empty) .ideas { display: none; }
.main:not(.is-empty) .composer { margin-top: auto; }
.plus { width: 32px; height: 32px; min-width: 32px; padding: 0; border-radius: 50%; border: 1px solid var(--caret-control-border); }
.plus-menu { display: grid; margin-top: 8px; border: 1px solid var(--caret-border); border-radius: 8px; background: var(--caret-panel); box-shadow: var(--caret-elevate-1); }
.plus-menu[hidden], .more-menu[hidden] { display: none; }
.menu-empty { padding: 8px 12px; color: var(--caret-muted); font-size: 12px; line-height: 18px; }
.more-menu { position: absolute; right: 12px; top: 46px; z-index: 4; display: grid; min-width: 220px; border: 1px solid var(--caret-border); border-radius: 8px; background: var(--caret-panel); box-shadow: var(--caret-elevate-1); }
.plus-menu button { text-align: left; }
.target-pills, .mode-pills { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin: 0 auto 16px; }
.mode-pills { margin: var(--caret-space-8) auto var(--caret-space-16); justify-content: flex-start; }
.pill { border: 1px solid var(--caret-control-border); border-radius: var(--caret-radius-full); min-height: 32px; padding: 0 var(--caret-space-10); background: transparent; color: var(--caret-text); font-size: var(--caret-font-base); line-height: var(--caret-lh-base); }
.pill[disabled] { color: var(--caret-muted); }
/* The reference puts the branch/This Mac selector row INSIDE the prompt-input
 * card, above the editor, not in a separate band above it. Caret had it in
 * .home-stage, which both added a band the reference does not have and left
 * the card 46px shorter than the reference's. */
.target-pills { align-items: center; justify-content: flex-start; gap: 2px; margin: 0 0 var(--caret-space-8); padding: 0; }
.target-pills .pill { display: inline-flex; align-items: center; gap: var(--caret-space-4); min-height: var(--caret-height-xs); padding: 0 var(--caret-space-4); border: 0; border-radius: var(--caret-radius-sm); background: transparent; color: var(--caret-muted); font-size: var(--caret-font-base); line-height: var(--caret-lh-base); }
.target-pills .pill:hover:not(:disabled) { background: var(--caret-hover-bg); color: var(--caret-text); }
.target-pills .pill::after { content: ""; width: 5px; height: 5px; margin-left: 2px; border-right: 1.3px solid currentColor; border-bottom: 1.3px solid currentColor; border-radius: var(--caret-radius-xs); transform: rotate(45deg) translate(-1px, -1px); }
/* The primary dispatch control carries a word label while a run is active
 * ("Queue", "Sending…", "Choose project"), so it sizes to its label with a
 * 32px floor instead of clipping a word inside a fixed circle. */
.send-round { width: auto; height: var(--caret-height-lg); min-width: var(--caret-height-lg); padding: 0 var(--caret-space-10); border-radius: var(--caret-radius-full); background: var(--caret-text); color: var(--caret-bg); font-weight: 600; white-space: nowrap; transition: transform var(--caret-motion-surface-in) var(--caret-motion-curve); }
.send-round:active { transform: scale(.96); }
.ideas { display: grid; gap: 0; max-width: var(--caret-composer-column); margin: 0 auto; }
.ideas button { display: flex; align-items: center; gap: var(--caret-space-8); width: 100%; min-height: 26px; height: 26px; text-align: left; padding: 0; color: var(--caret-text); font-size: var(--caret-font-base); line-height: var(--caret-lh-base); border-radius: 0; border-bottom: 1px solid var(--caret-border); }
.ideas .nav-icon { width: 16px; height: 16px; flex: 0 0 auto; color: var(--caret-muted); }
.ideas .idea-title { color: var(--caret-text); flex: 0 0 auto; }
.ideas .idea-copy { color: var(--caret-muted); min-width: 0; }
.model-select { border: 0; background: transparent; min-width: 72px; }
.settings-route { position: fixed; inset: 0; z-index: 6; display: flex; flex-direction: column; background: var(--caret-bg); opacity: 0; visibility: hidden; pointer-events: none; transform: translateX(24px); transition: opacity var(--caret-motion-drawer-out) linear, transform var(--caret-motion-drawer-out) var(--caret-motion-curve); }
.settings-route.open { opacity: 1; visibility: visible; pointer-events: auto; transform: none; transition-duration: var(--caret-motion-drawer-in), var(--caret-motion-drawer-in); }
.settings-route[hidden] { display: none; }
.projects-route-head { display: flex; align-items: center; gap: 12px; padding: 16px 24px 8px; }
.projects-route-page { padding: 8px 24px 32px; overflow: auto; }
.plus-menu { transition: opacity var(--caret-motion-surface-in) linear, transform var(--caret-motion-surface-in) var(--caret-motion-curve); transform: translateY(4px); opacity: 0; }
.plus-menu:not([hidden]) { opacity: 1; transform: none; }
.route-error { position: fixed; inset: 0; z-index: 7; display: none; place-items: center; background: color-mix(in srgb, var(--caret-bg) 88%, transparent); }
.route-error.open { display: grid; }
.route-error-card { max-width: 42em; margin: 24px; padding: 24px; border: 1px solid var(--caret-border); border-radius: 12px; background: var(--caret-panel-raised); box-shadow: var(--caret-elevate-2); }
.route-error-card h2 { margin: 0 0 8px; font-size: 18px; line-height: 26px; }
.route-error-card p { margin: 0 0 16px; color: var(--caret-muted); }
.history-banner { margin: 0 0 12px; padding: 8px 12px; border: 1px solid var(--caret-warning); border-radius: 8px; color: var(--caret-warning); font-size: 12px; line-height: 18px; }
.preview-frame { min-height: 160px; margin: 12px 0; padding: 16px; border: 1px dashed var(--caret-border); border-radius: 8px; color: var(--caret-muted); }
.settings-source, .settings-apply-error { color: var(--caret-muted); font-size: 12px; line-height: 18px; }
.settings-apply-error { color: var(--caret-danger); }
.settings-apply-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0 0; }
.settings-top { display: flex; align-items: center; gap: 8px; min-height: 46px; padding: 0 12px; border-bottom: 1px solid var(--caret-border); }
.settings-body { display: grid; grid-template-columns: 180px minmax(0, 1fr); min-height: 0; flex: 1; }
.settings-nav { overflow: auto; padding: 8px; border-right: 1px solid var(--caret-border); }
.settings-nav button { display: block; width: 100%; text-align: left; margin: 2px 0; }
.settings-nav button[aria-current="true"] { background: var(--caret-selected-bg); color: var(--caret-selected-fg); }
.settings-page { overflow: auto; padding: 16px 24px 32px; }
.settings-page h2 { margin: 0 0 8px; font-size: 18px; line-height: 26px; }
.settings-page p { color: var(--caret-muted); max-width: 72ch; }
.settings-search { min-width: 160px; margin-left: auto; }
.plan-strip { max-width: var(--caret-composer-column); margin: 0 auto var(--caret-space-8); padding: var(--caret-space-8) var(--caret-space-12); border: 1px solid var(--caret-border); border-radius: var(--caret-radius); }
.plan-strip h3 { margin: 0 0 6px; font-size: 13px; }
.plan-step { display: flex; gap: 8px; font-size: 12px; color: var(--caret-muted); }
.review-row { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; margin: 2px 0; }
.review-row .mark { min-width: 18px; color: var(--caret-muted); font: 13px/20px var(--vscode-editor-font-family, ui-monospace, monospace); }
.browser-chrome { display: flex; gap: 6px; margin-bottom: 12px; }
.browser-chrome input { flex: 1; }
.chip-row:empty { display: none; }
.scope-chips { display: none; flex-wrap: wrap; gap: 4px; padding: 2px 6px 8px; }
.sidebar.searching .scope-chips { display: flex; }
.scope-chips button { min-height: var(--caret-height-xs); padding: 0 var(--caret-space-6); color: var(--caret-muted); font-size: var(--caret-font-xs); line-height: var(--caret-lh-xs); }
.scope-chips button[aria-pressed="true"] { background: var(--caret-selected-bg); color: var(--caret-selected-fg); }
.sidebar-filters { display: flex; flex-wrap: wrap; gap: var(--caret-space-4); padding: 2px var(--caret-space-6) var(--caret-space-8); }
.sidebar-filters[hidden] { display: none; }
.sidebar-filters button { min-height: var(--caret-height-xs); padding: 0 var(--caret-space-6); border: 1px solid var(--caret-control-border); border-radius: var(--caret-radius-full); color: var(--caret-muted); font-size: var(--caret-font-xs); line-height: var(--caret-lh-xs); }
#filter-empty.empty { min-height: 0; padding: var(--caret-space-4) var(--caret-space-10) var(--caret-space-8); place-items: start; justify-items: start; text-align: left; font-size: var(--caret-font-sm); line-height: var(--caret-lh-sm); }
#recents .welcome-panel { display: flex; flex-direction: column; gap: 2px; max-width: none; width: 100%; margin: 0; }
.search-hits { padding: 0 8px 8px; }
.search-hit { display: block; width: 100%; text-align: left; }
.hunk { margin: 8px 0; border: 1px solid var(--caret-border); border-radius: 6px; overflow: auto; }
.hunk-head { padding: 6px 8px; color: var(--caret-muted); font: 13px/20px var(--vscode-editor-font-family, ui-monospace, monospace); }
.hunk pre { margin: 0; padding: 8px; max-height: 240px; font: 13px/20px var(--vscode-editor-font-family, ui-monospace, monospace); white-space: pre; }
.mention-menu { display: grid; margin: 0 12px 8px; border: 1px solid var(--caret-border); border-radius: 8px; background: var(--caret-panel); }
.mention-menu[hidden] { display: none; }
.message-body a { color: var(--caret-link); }
.find-bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--caret-space-8); max-width: var(--caret-composer-column-outer); margin: 0 auto; padding: var(--caret-space-8) var(--caret-gutter); }
.find-bar[hidden] { display: none; }
.find-bar input { flex: 1; min-width: 160px; }
mark.find-hit { background: var(--caret-warning); color: var(--caret-bg); }
mark.find-hit.current { outline: 2px solid var(--caret-focus); outline-offset: 1px; }
.destination-menu { display: grid; margin-top: 8px; border: 1px solid var(--caret-border); border-radius: 8px; background: var(--caret-panel); padding: 8px; gap: 4px; }
.destination-menu[hidden] { display: none; }
#space-note { display: none; margin: 0 var(--caret-gutter, 20px) 8px; color: var(--caret-muted); font-size: 12px; line-height: 18px; }
.shell.need-more-space #space-note { display: block; }
.shell.high-contrast { --caret-elevate-1: none; --caret-elevate-2: none; }
.shell.high-contrast .composer-box, .shell.high-contrast .ui-card, .shell.high-contrast .tool-card, .shell.high-contrast .review-row { border-width: 2px; }
.review-split { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.review-split pre { margin: 0; }
.thinking-select { max-width: 140px; min-height: var(--caret-height-sm); border: 0; background: transparent; color: var(--caret-muted); }
.destination-group { color: var(--caret-muted); font-size: 12px; line-height: 18px; margin-top: 8px; }
.settings-section-select { display: none; width: calc(100% - 16px); margin: 8px; }
.preview-toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
.preview-frame img { display: block; max-width: 100%; transform-origin: top left; }
@media (max-width: 719px) { .settings-body { grid-template-columns: 1fr; } .settings-nav { display: none; } .settings-section-select { display: block; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; animation: none !important; } }
`;

export const TASK_WEBVIEW_SCRIPT = String.raw`
(() => {
  const vscode = acquireVsCodeApi();
  const root = document;
  const state = { connection: 'offline', projects: [], sessions: [], transcript: [], uiRequests: [], pendingCommands: {}, models: [], loginProviders: [], presentations: [], draft: '', drafts: {}, workbenchMode: 'agents', transcriptScrolls: {}, followLatest: true, session: null, project: null, cursor: 0, hasMoreEvents: false };
  let composing = false;
  let taskActionsOpen = false;
  let taskActionsTrigger = null;
  let expandedTools = new Set();
  let lastSeenTranscript = 0;
  let lastSentDraft = '';
  let sessionsCollapsed = false;
  let lastMentionQuery = '';
  function closeSidebarDrawer() {
    const shell = document.getElementById('shell');
    if (shell && shell.classList.contains('sidebar-drawer')) shell.classList.remove('sidebar-open');
  }
  function unreadCount() {
    const n = (state.transcript || []).length;
    if (state.followLatest !== false && !state.markedUnread) { lastSeenTranscript = n; return 0; }
    return Math.max(0, n - lastSeenTranscript);
  }
  // OMP UI requests are polled snapshots. Keep each control/card keyed by its
  // token so a refresh does not recreate an active input, destroying its draft
  // or keyboard focus. Entries leave the map only when the host resolves them
  // (token disappears) or a new session incarnation is selected.
  let uiIncarnation = '';
  const uiControls = new Map();
  let findQuery = '';
  let findIndex = 0;
  let artifactTypeFilter = 'all';
  let previewZoom = 1;
  const byId = (id) => root.getElementById(id);
  const post = (message) => vscode.postMessage(message);
  const text = (node, value) => { node.textContent = value == null ? '' : String(value); return node; };
  const element = (tag, className, value) => { const node = root.createElement(tag); if (className) node.className = className; if (value !== undefined) text(node, value); return node; };
  function parseMarkdownTable(value) {
    const lines = String(value || '').split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) return null;
    const cells = (line) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
    const header = cells(lines[0]);
    const sep = cells(lines[1]);
    if (!header.length || sep.length < header.length || !sep.every((cell) => /^:?-{3,}:?$/.test(cell))) return null;
    return { header: header, rows: lines.slice(2).map(cells) };
  }
  function appendRichText(parent, value) {
    const parsed = parseMarkdownTable(value);
    if (parsed) {
      const table = element('table', 'md-table');
      const head = root.createElement('thead');
      const hr = root.createElement('tr');
      parsed.header.forEach((cell) => hr.appendChild(element('th', '', cell)));
      head.appendChild(hr);
      table.appendChild(head);
      const body = root.createElement('tbody');
      parsed.rows.forEach((row) => {
        const tr = root.createElement('tr');
        row.forEach((cell) => tr.appendChild(element('td', '', cell)));
        body.appendChild(tr);
      });
      table.appendChild(body);
      parent.appendChild(table);
      return;
    }
    const block = element('div', '');
    String(value).split(/(https?:\/\/[^\s]+)/).forEach((part, index) => {
      if (index % 2 === 1) {
        const link = element('a', '', part); link.href = part; link.rel = 'noreferrer noopener';
        link.addEventListener('click', (event) => { event.preventDefault(); post({ type: 'open_login_url', url: part }); });
        block.appendChild(link);
      } else if (part) block.appendChild(root.createTextNode(part));
    });
    parent.appendChild(block);
  }
  const safeJson = (value) => { try { return JSON.stringify(value, null, 2); } catch (_) { return '[unserializable]'; } };
  const statusLabel = (value) => ({ offline: 'Offline', connecting: 'Connecting…', reconnecting: 'Reconnecting…', connected: 'Ready', running: 'Running', unknown: 'Outcome unknown' }[value] || 'Unknown');
  function applyEmptyHome() {
    const main = byId('main');
    if (!main || composing) return;
    main.classList.toggle('is-empty', !(state.transcript && state.transcript.length));
  }
  function renderWelcome() {
    const host = byId('recents');
    if (!host) return;
    let panel = byId('welcome-panel');
    if (!panel) {
      panel = element('div', 'welcome-panel');
      panel.id = 'welcome-panel';
      host.appendChild(panel);
    }
    panel.textContent = '';
    const welcome = state.welcome;
    const recents = (welcome && welcome.recents) || [];
    if (!welcome || recents.length === 0) { panel.hidden = true; return; }
    panel.hidden = false;
    // Recent folders belong to the sidebar list, next to Projects. The empty
    // draft keeps the centre for the composer, matching the reference shell.
    recents.forEach((recent) => {
      const button = element('button', 'nav-row', recent.name || recent.path || 'Folder');
      button.type = 'button';
      button.disabled = recent.openable === false;
      if (recent.reason) button.title = recent.reason;
      if (recent.openable !== false && recent.path) {
        button.dataset.action = 'open_recent';
        button.dataset.recentPath = recent.path;
      }
      panel.appendChild(button);
    });
  }
  function renderPaneStrip() {
    const strip = byId('pane-strip');
    if (!strip) return;
    const panes = state.layoutPanes || [];
    strip.textContent = '';
    strip.hidden = panes.length < 2;
    panes.forEach((pane) => {
      const button = element('button', 'pane-chip' + (pane.active ? ' active' : ''), pane.label || 'New task');
      button.type = 'button';
      button.dataset.action = 'focus_pane';
      button.dataset.viewId = pane.viewId;
      strip.appendChild(button);
    });
  }
  function placeSplitBox(el, box, maxX, maxY) {
    if (!box || !el) return;
    el.style.position = 'absolute';
    el.style.left = (box.x / maxX * 100) + '%';
    el.style.top = (box.y / maxY * 100) + '%';
    el.style.width = (box.width / maxX * 100) + '%';
    el.style.height = (box.height / maxY * 100) + '%';
    el.style.minWidth = '0';
    el.style.minHeight = '0';
  }
  function renderSplit() {
    const host = byId('split-host');
    const live = byId('live-pane');
    const main = byId('main');
    if (!host || !live) return;
    const panes = state.layoutPanes || [];
    const boxes = state.layoutBoxes || [];
    const sashes = state.layoutSashes || [];
    const axis = state.layoutAxis || 'single';
    const painted = panes.length > 1 && axis !== 'single';
    host.className = 'split-host' + (axis === 'row' ? ' split-row' : axis === 'column' ? ' split-column' : '') + (painted ? ' split-painted' : '');
    if (main) main.classList.toggle('split-open', painted);
    host.querySelectorAll('[data-split-sash]').forEach((node) => node.remove());
    const keep = {};
    panes.forEach((pane) => { if (!pane.active) keep[pane.viewId] = pane; });
    host.querySelectorAll('[data-split-extra]').forEach((node) => {
      if (!keep[node.dataset.paneViewId]) node.remove();
    });
    live.style.cssText = '';
    if (!painted) return;
    const boxById = {};
    boxes.forEach((box) => { boxById[box.viewId] = box; });
    const maxX = boxes.reduce((n, box) => Math.max(n, box.x + box.width), 1);
    const maxY = boxes.reduce((n, box) => Math.max(n, box.y + box.height), 1);
    const active = panes.find((pane) => pane.active) || panes[0];
    placeSplitBox(live, boxById[active.viewId], maxX, maxY);
    panes.filter((pane) => !pane.active).forEach((pane) => {
      let card = host.querySelector('[data-pane-view-id="' + pane.viewId + '"]');
      if (!card) {
        card = element('div', 'split-pane live-extra');
        card.dataset.splitExtra = '1';
        card.dataset.paneViewId = pane.viewId;
        host.appendChild(card);
      }
      fillLiveExtraPane(card, pane);
      placeSplitBox(card, boxById[pane.viewId], maxX, maxY);
    });
    sashes.forEach((sash) => {
      const bar = element('div', 'sash split-sash');
      bar.dataset.splitSash = '1';
      bar.setAttribute('role', 'separator');
      bar.setAttribute('aria-orientation', sash.orientation === 'row' ? 'vertical' : 'horizontal');
      bar.style.position = 'absolute';
      bar.style.left = (sash.x / maxX * 100) + '%';
      bar.style.top = (sash.y / maxY * 100) + '%';
      if (sash.orientation === 'row') {
        bar.style.width = '2px';
        bar.style.height = (sash.length / maxY * 100) + '%';
        bar.style.cursor = 'col-resize';
      } else {
        bar.style.height = '2px';
        bar.style.width = (sash.length / maxX * 100) + '%';
        bar.style.cursor = 'row-resize';
      }
      bar.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        const rect = host.getBoundingClientRect();
        const onUp = (move) => {
          window.removeEventListener('pointerup', onUp);
          const raw = sash.orientation === 'row' ? (move.clientX - rect.left) / rect.width : (move.clientY - rect.top) / rect.height;
          const ratio = Math.min(0.95, Math.max(0.05, raw));
          post({ type: 'set_layout_ratio', firstViewId: sash.firstViewId, ratio: ratio });
        };
        window.addEventListener('pointerup', onUp);
      });
      host.appendChild(bar);
    });
  }
  function entryStamp(entry) {
    return [entry.id, entry.status || '', entry.text || '', entry.output || '', entry.toolStatus || '', entry.kind || ''].join('\n');
  }
  function reconcileTranscriptBox(box, visible, emptyCopy) {
    if (!box) return;
    const keepIds = new Set(visible.map((entry) => entry.id));
    Array.from(box.querySelectorAll('[data-message-id]')).forEach((node) => {
      if (!keepIds.has(node.getAttribute('data-message-id'))) node.remove();
    });
    const empty = box.querySelector('[data-pane-empty]');
    if (!visible.length) {
      if (!empty) {
        const note = element('p', 'welcome-kicker', emptyCopy || 'New task');
        note.dataset.paneEmpty = '1';
        box.appendChild(note);
      } else text(empty, emptyCopy || 'New task');
      return;
    }
    if (empty) empty.remove();
    let cursor = box.querySelector('[data-transcript-chrome="older"]') || box.querySelector('[data-transcript-chrome="banner"]');
    visible.forEach((entry) => {
      const existing = box.querySelector('[data-message-id="' + entry.id + '"]');
      if (existing && existing.dataset.stamp === entryStamp(entry)) {
        cursor = existing;
        return;
      }
      const next = messageNode(entry);
      next.dataset.stamp = entryStamp(entry);
      if (existing) existing.replaceWith(next);
      else if (cursor && cursor.nextSibling) box.insertBefore(next, cursor.nextSibling);
      else box.appendChild(next);
      cursor = next;
    });
  }
  function fillLiveExtraPane(card, pane) {
    const visible = (pane.transcript || []).filter((entry) => entry.kind !== 'event' || entry.status === 'failed');
    if (card.dataset.built === pane.viewId) {
      const title = card.querySelector('.pane-head strong');
      if (title) text(title, pane.label || 'New task');
      const wrap = card.querySelector('.pane-transcript');
      const box = wrap && wrap.querySelector('.transcript');
      const follow = wrap && (wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight < 48);
      const keep = wrap && box && !follow ? firstVisibleMessageAnchor(wrap, box) : null;
      reconcileTranscriptBox(box, visible, pane.sessionId ? 'Same task. This pane keeps its own scroll and draft' : 'New task');
      if (wrap && keep && keep.id) {
        const node = box.querySelector('[data-message-id="' + keep.id + '"]');
        wrap.scrollTop = node ? Math.max(0, node.offsetTop - keep.delta) : wrap.scrollTop;
      } else if (wrap && follow) wrap.scrollTop = wrap.scrollHeight;
      const area = card.querySelector('.pane-draft');
      if (area && document.activeElement !== area && area.value !== (pane.draft || '')) area.value = pane.draft || '';
      return;
    }
    const focused = card.querySelector('textarea');
    const keepDraft = focused && document.activeElement === focused ? focused.value : (pane.draft || '');
    card.textContent = '';
    card.dataset.built = pane.viewId;
    const head = element('div', 'pane-head');
    head.appendChild(element('strong', '', pane.label || 'New task'));
    const open = element('button', 'ghost', 'Focus pane');
    open.type = 'button';
    open.dataset.action = 'focus_pane';
    open.dataset.viewId = pane.viewId;
    head.appendChild(open);
    card.appendChild(head);
    const wrap = element('div', 'transcript-wrap pane-transcript');
    const box = element('section', 'transcript');
    if (!visible.length) {
      const note = element('p', 'welcome-kicker', pane.sessionId ? 'Same task. This pane keeps its own scroll and draft' : 'New task');
      note.dataset.paneEmpty = '1';
      box.appendChild(note);
    }
    visible.forEach((entry) => {
      const node = messageNode(entry);
      node.dataset.stamp = entryStamp(entry);
      box.appendChild(node);
    });
    wrap.appendChild(box);
    const savedPane = state.transcriptScrolls && pane.draftKey ? state.transcriptScrolls[pane.draftKey] : null;
    if (savedPane && typeof savedPane.offset === 'number') wrap.scrollTop = savedPane.offset;
    wrap.addEventListener('scroll', () => {
      const followLatest = wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight < 48;
      const last = visible[visible.length - 1];
      post({ type: 'persist_scroll', offset: wrap.scrollTop, followLatest: followLatest, eventId: last && last.id, viewId: pane.viewId });
    });
    card.appendChild(wrap);
    const composer = element('div', 'composer pane-composer');
    const area = element('textarea', 'pane-draft');
    area.value = keepDraft;
    area.setAttribute('aria-label', 'Message in this pane');
    area.addEventListener('input', () => post({ type: 'persist_pane_draft', viewId: pane.viewId, draft: area.value }));
    const send = element('button', 'send-round', '\u2191');
    send.type = 'button';
    send.setAttribute('aria-label', 'Send');
    send.addEventListener('click', () => {
      const value = area.value;
      if (!value.trim()) return;
      post({ type: 'send_prompt', text: value, viewId: pane.viewId });
    });
    composer.append(area, send);
    card.appendChild(composer);
  }
  function renderStatus() {
    const status = byId('connection');
    const connection = state.connectionBadge || (state.connection === 'running' ? 'connected' : (state.connection || 'offline'));
    status.className = 'connection ' + connection;
    const sync = state.lastHostSyncAt;
    const unsettled = connection === 'offline' || connection === 'connecting' || connection === 'reconnecting' || connection === 'unknown';
    text(status, statusLabel(connection) + (unsettled && sync ? ' · last ' + sync : ''));
    status.hidden = false;
    const run = byId('run-status');
    if (run) {
      const runStatus = state.runStatus || 'idle';
      const labels = { idle: '', running: 'Working', stopping: 'Stopping…', waiting: 'Waiting', unknown: 'Unknown run' };
      run.className = 'run ' + runStatus;
      text(run, labels[runStatus] || '');
      run.hidden = !labels[runStatus];
    }
    const title = state.session && state.session.title ? state.session.title : (state.project && state.project.name ? state.project.name : 'New task');
    text(byId('task-title'), title);
    const projectLine = byId('task-project');
    if (projectLine) {
      const meta = state.headerMeta || {};
      if (meta.summary && state.project) text(projectLine, meta.summary + (String(meta.summary).includes('This Mac') ? '' : ' · This Mac'));
      else {
        const branch = state.project && state.project.branch ? state.project.branch : (state.gitBranch || '');
        const place = branch ? branch : (state.project && state.project.path ? 'Folder' : '');
        text(projectLine, state.project && state.project.name ? (place ? state.project.name + ' · ' + place + ' · This Mac' : state.project.name) : 'Choose a project');
      }
    }
    const live = byId('a11y-live');
    if (live && state.a11ySummary && live.textContent !== state.a11ySummary) text(live, state.a11ySummary);
    const target = byId('composer-target');
    if (target) text(target, state.project && state.project.path ? (state.project.name || 'Folder') + ' · This Mac · draft stays on this device' : 'Choose a project before Send. New task creates a local draft first.');
    document.title = (state.session && state.session.title ? state.session.title : 'New task') + ' — ' + (state.project && state.project.name ? state.project.name : 'Caret') + ' — Caret';
    applyEmptyHome();
    renderWelcome();
    renderPaneStrip();
    renderSplit();
    const folderPill = byId('pill-folder');
    if (folderPill) text(folderPill, state.project && state.project.name ? state.project.name : 'Folder');
    const branchPill = byId('pill-branch');
    if (branchPill) {
      const meta = state.headerMeta || {};
      const branch = meta.branch || (state.project && state.project.branch) || state.gitBranch || '';
      text(branchPill, branch || (meta.locationLabel || 'Folder'));
      branchPill.disabled = false;
      branchPill.title = branch ? branch : 'No Git branch until the folder has a repository.';
    }
    const branchMenu = byId('branch-menu');
    if (branchMenu && !branchMenu.hidden) renderBranchMenu();
    const envPill = byId('pill-env');
    if (envPill) {
      text(envPill, 'This Mac');
      envPill.disabled = false;
      envPill.title = 'Run on This Mac. Cloud and relay destinations are not advertised.';
    }
    renderDestinations();
    document.querySelectorAll('[data-action="open_work_panel"][data-tab="browser"]').forEach((btn) => {
      const liveBridge = state.browserBridge === true;
      btn.classList.toggle('unavailable', !liveBridge);
      btn.title = liveBridge ? 'Browser' : 'Unsupported until the OMP browser bridge advertises a live handle. Opens the honest stub.';
      btn.setAttribute('aria-description', liveBridge ? 'Browser' : 'Browser bridge is not advertised.');
    });
    const attention = byId('approval-attention');
    if (attention) {
      const pending = (state.uiRequests || []).filter((item) => !item.status || item.status === 'pending').length;
      text(attention, pending ? String(pending) : '');
      attention.hidden = pending === 0;
    }
    const banner = byId('reconnect-banner');
    const recovery = state.recovery || {};
    banner.classList.toggle('visible', Boolean(recovery.title));
    text(banner, recovery.title || '');
    banner.onclick = recovery.primaryAction && recovery.primaryAction.id === 'inspect' ? () => post({ type: 'inspect_outcome' }) : recovery.primaryAction ? () => post({ type: 'refresh' }) : null;
    const reviewReq = byId('review-request');
    if (reviewReq) {
      const pending = (state.uiRequests || []).some((item) => !approvalReadonly(item));
      reviewReq.hidden = !pending;
    }
    text(byId('status-line'), state.lastError || recovery.body || '');
    const jump = byId('jump-latest');
    if (jump) {
      const unread = unreadCount();
      text(jump, unread > 0 ? 'Jump to latest · ' + unread : 'Jump to latest');
      jump.classList.toggle('visible', state.followLatest === false || state.markedUnread === true || unread > 0);
    }
    const agents = byId('mode-agents'); const ide = byId('mode-ide');
    if (agents && ide) {
      const mode = state.workbenchMode === 'ide' ? 'ide' : 'agents';
      agents.hidden = mode !== 'ide';
      agents.setAttribute('aria-pressed', mode === 'agents' ? 'true' : 'false');
      ide.setAttribute('aria-pressed', mode === 'ide' ? 'true' : 'false');
    }
  }
  function renderProjects() {
    const box = byId('projects'); box.textContent = '';
    (state.projects || []).filter((project) => !project.archived).forEach((project) => {
      const button = element('button', 'project' + (state.project && state.project.id === project.id ? ' selected' : ''));
      button.type = 'button'; button.dataset.projectId = project.id;
      button.appendChild(element('span', 'name', project.name || 'Folder'));
      box.appendChild(button);
    });
  }
  function sessionStatusLabel(session) {
    const status = session.status || 'idle';
    const title = (session.title || '').trim();
    const draft = (!title || title === 'New task') && status !== 'running' && status !== 'waiting' && status !== 'unknown' && status !== 'recovery_required';
    const labels = { running: 'Working', recovery_required: 'Needs review', unknown: 'Unknown', waiting: 'Waiting', idle: draft ? 'Draft' : '', completed: 'Completed' };
    return labels[status] || (draft ? 'Draft' : '');
  }
  function appendSessionRow(box, session) {
    const status = session.status || 'idle';
    const selected = state.session && state.session.id === session.id;
    const row = element('div', 'session-row' + (selected ? ' selected' : ''));
    const button = element('button', 'session session-open ' + status + (selected ? ' selected' : ''));
    button.type = 'button';
    button.dataset.action = 'open_session';
    button.dataset.sessionId = session.id;
    button.appendChild(element('span', 'dot', ''));
    button.appendChild(element('span', 'name', session.title || 'Untitled'));
    const label = sessionStatusLabel(session);
    if (label) button.appendChild(element('span', 'status-label', label));
    const stamp = session.updatedAt || session.createdAt;
    const mins = stamp ? Math.round((Date.now() - Date.parse(stamp)) / 60000) : NaN;
    const ago = !Number.isFinite(mins) ? '' : mins < 60 ? mins + 'm' : mins < 1440 ? Math.round(mins / 60) + 'h' : Math.round(mins / 1440) + 'd';
    if (ago) button.appendChild(element('span', 'meta', ago));
    const menu = element('button', 'session-menu', '\u22EF');
    menu.type = 'button';
    menu.setAttribute('aria-label', 'Task actions');
    menu.setAttribute('aria-haspopup', 'menu');
    menu.dataset.action = 'session_menu';
    menu.dataset.sessionId = session.id;
    menu.dataset.pinned = session.pinned ? 'true' : 'false';
    menu.dataset.archived = session.archived ? 'true' : 'false';
    const env = (session.environment || 'This Mac').trim();
    const sourceRaw = (session.source || 'omp').trim();
    const source = sourceRaw === 'omp' ? 'OMP' : sourceRaw;
    const prRaw = session.pr == null ? '' : String(session.pr).trim();
    const pr = !prRaw || prRaw.toLowerCase() === 'unknown' ? 'Unknown' : prRaw;
    // One-line rows keep the density of the reference shell; the environment,
    // source and PR stay reachable as the row tooltip instead of a second line.
    button.title = env + ' \u00B7 ' + source + ' \u00B7 PR ' + pr;
    row.append(button, menu);
    box.appendChild(row);
  }
  function openSessionRowMenu(sessionId, pinned, archived) {
    const menu = byId('session-row-menu');
    if (!menu) return;
    const same = !menu.hidden && menu.dataset.sessionId === sessionId;
    menu.textContent = '';
    if (same) { menu.hidden = true; delete menu.dataset.sessionId; return; }
    menu.hidden = false;
    menu.dataset.sessionId = sessionId;
    menu.setAttribute('role', 'menu');
    [['Open in split', 'open_in_split'], ['Rename', 'rename'], [pinned ? 'Unpin' : 'Pin', pinned ? 'unpin' : 'pin'], [archived ? 'Restore' : 'Archive', archived ? 'restore' : 'archive']].forEach((item) => {
      const button = element('button', 'more-item', item[0]);
      button.type = 'button';
      button.dataset.action = 'session_action';
      button.dataset.sessionAction = item[1];
      button.dataset.sessionId = sessionId;
      menu.appendChild(button);
    });
  }
  function renderPinned() {
    const box = byId('pinned'); if (!box) return; box.textContent = '';
    (state.sessions || []).filter((session) => session.pinned && !session.archived).forEach((session) => appendSessionRow(box, session));
  }
  function renderSessions() {
    const box = byId('sessions'); box.textContent = '';
    const filters = state.sidebarFilters || {};
    const bar = byId('task-filters');
    if (bar) {
      bar.textContent = '';
      const status = element('button', 'ghost', filters.status === 'running' ? 'Status · Running' : 'Status'); status.type = 'button';
      status.addEventListener('click', () => post({ type: 'set_sidebar_filters', filters: { status: filters.status === 'running' ? '' : 'running' } }));
      const archived = element('button', 'ghost', filters.archived ? 'Archived on' : 'Archived'); archived.type = 'button';
      archived.addEventListener('click', () => post({ type: 'set_sidebar_filters', filters: { archived: !filters.archived } }));
      const clear = element('button', 'ghost', 'Clear filters'); clear.type = 'button';
      clear.addEventListener('click', () => post({ type: 'set_sidebar_filters', filters: { status: '', archived: false, show: ['active', 'draft'], environment: '', source: '', pr: '' } }));
      const env = element('button', 'ghost', filters.environment === 'This Mac' ? 'Env · This Mac' : 'Env'); env.type = 'button';
      env.title = 'Only sessions that advertise This Mac. Cloud is not a filter value.';
      env.addEventListener('click', () => post({ type: 'set_sidebar_filters', filters: { environment: filters.environment === 'This Mac' ? '' : 'This Mac' } }));
      const source = element('button', 'ghost', filters.source === 'omp' ? 'Source · OMP' : 'Source'); source.type = 'button';
      source.addEventListener('click', () => post({ type: 'set_sidebar_filters', filters: { source: filters.source === 'omp' ? '' : 'omp' } }));
      const pr = element('button', 'ghost', filters.pr === 'unknown' ? 'PR · unknown' : 'PR'); pr.type = 'button';
      pr.title = 'PR unknown only. Open/closed PR states are not advertised.';
      pr.addEventListener('click', () => post({ type: 'set_sidebar_filters', filters: { pr: filters.pr === 'unknown' ? '' : 'unknown' } }));
      const collapse = element('button', 'ghost', sessionsCollapsed ? 'Expand all' : 'Collapse all'); collapse.type = 'button';
      collapse.addEventListener('click', () => { sessionsCollapsed = !sessionsCollapsed; renderSessions(); });
      const mark = state.markAllRead || {};
      const markBtn = element('button', 'ghost', 'Mark ' + (mark.label || '0 selected results') + ' as read'); markBtn.type = 'button';
      markBtn.title = 'Clears unread on the filtered results in this window. Caret will not mark every project read.';
      markBtn.addEventListener('click', () => post({ type: 'mark_all_read' }));
      bar.append(status, archived, env, source, pr, clear, collapse, markBtn);
      (state.filterChips || []).forEach((chip) => bar.appendChild(element('span', 'chip', chip.label)));
    }
    if (bar) bar.hidden = (state.sessions || []).length === 0;
    const rows = sessionsCollapsed ? [] : (state.visibleSessions || (state.sessions || []).filter((session) => !session.archived));
    const empty = byId('filter-empty');
    if (empty) {
      if (sessionsCollapsed) { text(empty, 'Session list collapsed'); empty.hidden = false; }
      else {
        const copy = state.filterEmpty || {};
        text(empty, copy.th || copy.en || '');
        empty.hidden = (state.sessions || []).length === 0 || !(copy.th || copy.en);
      }
    }
    rows.forEach((session) => appendSessionRow(box, session));
  }
  function renderSearch() {
    const search = state.search || {};
    const input = byId('task-search');
    if (input && document.activeElement !== input && typeof search.query === 'string' && input.value !== search.query) input.value = search.query;
    const scopes = byId('search-scopes');
    if (scopes) {
      scopes.querySelectorAll('[data-scope]').forEach((button) => {
        button.setAttribute('aria-pressed', button.dataset.scope === (search.scope || 'all') ? 'true' : 'false');
      });
    }
    const updating = byId('search-updating');
    if (updating) {
      updating.hidden = !search.updating;
      text(updating, search.updating ? ('Updating' + (search.queryId ? ' \u00B7 ' + search.queryId : '')) : '');
    }
    const indexed = byId('search-indexed');
    if (indexed) {
      text(indexed, search.lastIndexedNote || '');
      indexed.hidden = !search.lastIndexedNote;
    }
    const hits = byId('search-hits');
    if (hits) {
      hits.textContent = '';
      (search.hits || []).forEach((hit) => {
        const button = element('button', 'search-hit', hit.label + (hit.detail ? ' \u00B7 ' + hit.detail : ''));
        button.type = 'button';
        button.dataset.action = 'search_hit';
        button.dataset.hitAction = hit.action;
        button.dataset.hitId = hit.id;
        hits.appendChild(button);
      });
      hits.hidden = !(search.hits && search.hits.length);
    }
    const empty = byId('search-empty');
    if (empty) empty.hidden = !search.noMatch;
    syncSearching();
  }
  /** Search scopes stay collapsed until search is actually engaged. */
  function syncSearching() {
    const sidebar = byId('sidebar');
    const input = byId('task-search');
    if (!sidebar || !input) return;
    const search = state.search || {};
    const active = document.activeElement === input
      || !!(input.value || '').trim()
      || !!(search.query || '').trim()
      || !!(search.scope && search.scope !== 'all')
      || !!(search.hits && search.hits.length)
      || !!search.noMatch
      || !!search.updating;
    sidebar.classList.toggle('searching', active);
  }
  function messageNode(entry) {
    if (entry.kind === 'tool') return toolNode(entry);
    if (entry.kind === 'event') { const row = element('div', 'event-row', entry.text || 'event'); row.dataset.messageId = entry.id; return row; }
    const row = element('article', 'message ' + (entry.role || 'assistant')); row.dataset.messageId = entry.id;
    const head = element('div', 'message-head'); head.appendChild(element('strong', '', entry.role === 'user' ? 'You' : entry.role === 'system' ? 'Caret' : 'Caret')); head.appendChild(element('span', '', entry.status === 'streaming' ? 'typing…' : ''));
    row.append(head, messageBody(entry.text || ''));
    return row;
  }
  function messageBody(value) {
    const box = element('div', 'message-body');
    String(value || '').split(String.fromCharCode(96, 96, 96)).forEach((part, index) => {
      if (index % 2 === 0) {
        if (part) appendRichText(box, part);
        return;
      }
      const nl = part.indexOf('\n');
      const lang = nl >= 0 ? part.slice(0, nl).trim() : '';
      const code = nl >= 0 ? part.slice(nl + 1) : part;
      const block = element('div', 'code-block');
      const head = element('div', 'code-head');
      head.appendChild(element('span', 'code-lang', lang || 'plain'));
      const copy = element('button', 'ghost', 'Copy');
      copy.type = 'button';
      const wrap = element('button', 'ghost', 'Wrap');
      wrap.type = 'button';
      wrap.setAttribute('aria-pressed', 'false');
      const pre = element('pre', '', code);
      if (lang) pre.dataset.lang = lang;
      copy.addEventListener('click', () => {
        const done = () => { copy.textContent = 'Copied'; window.setTimeout(() => { copy.textContent = 'Copy'; }, 1500); };
        const fallback = () => {
          const area = document.createElement('textarea');
          area.value = code;
          area.setAttribute('readonly', '');
          document.body.appendChild(area);
          area.select();
          try { document.execCommand('copy'); } catch (err) {}
          area.remove();
          done();
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done).catch(fallback);
        else fallback();
      });
      wrap.addEventListener('click', () => {
        const on = pre.classList.toggle('wrap');
        wrap.setAttribute('aria-pressed', on ? 'true' : 'false');
        wrap.textContent = on ? 'Unwrap' : 'Wrap';
      });
      head.append(copy, wrap);
      block.append(head, pre);
      box.appendChild(block);
    });
    return box;
  }
  function toolNode(entry) {
    const card = element('article', 'tool-card' + (expandedTools.has(entry.id) ? ' expanded' : '')); card.dataset.messageId = entry.id;
    const summary = element('button', 'tool-summary'); summary.type = 'button'; summary.setAttribute('aria-expanded', expandedTools.has(entry.id) ? 'true' : 'false');
    summary.appendChild(element('span', 'tool-name', entry.toolName || 'Tool'));
    const status = entry.toolStatus || 'unknown'; summary.appendChild(element('span', 'tool-state ' + status, status));
    const started = entry.createdAt ? Date.parse(entry.createdAt) : NaN;
    if (Number.isFinite(started)) {
      const seconds = Math.max(0, Math.round((Date.now() - started) / 1000));
      summary.appendChild(element('span', 'meta', seconds < 60 ? seconds + 's' : Math.round(seconds / 60) + 'm'));
    }
    summary.appendChild(element('span', '', expandedTools.has(entry.id) ? '⌃' : '⌄'));
    summary.addEventListener('click', () => { if (expandedTools.has(entry.id)) expandedTools.delete(entry.id); else expandedTools.add(entry.id); renderTranscript(); }); card.appendChild(summary);
    const details = element('div', 'tool-details');
    const detailed = presentationPrefs().density === 'detailed';
    const argText = entry.args !== undefined ? safeJson(entry.args) : '';
    const outText = entry.output || '';
    if (!detailed && (argText || outText)) details.appendChild(element('p', 'meta', (argText || outText).split('\n')[0].slice(0, 120)));
    if (detailed && entry.args !== undefined) { details.appendChild(element('div', 'message-head', 'Arguments')); details.appendChild(element('pre', '', argText)); }
    if (detailed && entry.output) { details.appendChild(element('div', 'message-head', 'Output')); details.appendChild(element('pre', '', outText)); }
    if (!detailed && expandedTools.has(entry.id)) {
      if (argText) { details.appendChild(element('div', 'message-head', 'Arguments')); details.appendChild(element('pre', '', argText)); }
      if (outText) { details.appendChild(element('div', 'message-head', 'Output')); details.appendChild(element('pre', '', outText)); }
    }
    const actions = element('div', 'tool-actions'); const copy = element('button', 'ghost', 'Copy output'); copy.type = 'button'; copy.addEventListener('click', () => { const clipboard = navigator.clipboard; if (clipboard) void clipboard.writeText(entry.output || safeJson(entry.args) || '').then(() => { text(byId('status-line'), 'Copied tool output.'); }); }); actions.appendChild(copy);
    const full = element('button', 'ghost', 'Open full log'); full.type = 'button';
    full.addEventListener('click', () => { card.classList.toggle('full-log'); full.textContent = card.classList.contains('full-log') ? 'Collapse log' : 'Open full log'; });
    actions.appendChild(full); details.appendChild(actions); card.appendChild(details); return card;
  }
  function firstVisibleMessageAnchor(wrap, box) {
    if (!wrap || !box) return null;
    const nodes = box.querySelectorAll('[data-message-id]');
    const top = wrap.scrollTop;
    let found = null;
    nodes.forEach((item) => {
      if (found) return;
      if (item.offsetTop + item.offsetHeight > top + 4) {
        found = { id: item.getAttribute('data-message-id'), delta: item.offsetTop - top };
      }
    });
    return found;
  }
  function renderTranscript() {
    const box = byId('transcript');
    const wrap = byId('transcript-wrap');
    const keep = state.followLatest === false ? firstVisibleMessageAnchor(wrap, box) : null;
    const prevHeight = wrap ? wrap.scrollHeight : 0;
    const firstId = box && box.querySelector('[data-message-id]') ? box.querySelector('[data-message-id]').getAttribute('data-message-id') : '';
    const visible = (state.transcript || []).filter(entry => entry.kind !== 'event' || entry.status === 'failed');
    const key = state.scrollKey || ((state.project && state.project.id ? state.project.id : 'none') + '/' + (state.session && state.session.id ? state.session.id : 'local-new'));
    const saved = state.transcriptScrolls && state.transcriptScrolls[key];
    const anchorMissing = Boolean(saved && saved.eventId && !visible.some((entry) => entry.id === saved.eventId));
    const bannerText = state.historyNote || (anchorMissing ? 'History changed' : (state.olderPagesAdvertised === false && visible.length ? 'Older pages are not advertised.' : ''));
    let banner = box.querySelector('[data-transcript-chrome="banner"]');
    if (bannerText) {
      if (!banner) { banner = element('div', 'history-banner'); banner.dataset.transcriptChrome = 'banner'; box.insertBefore(banner, box.firstChild); }
      text(banner, bannerText);
    } else if (banner) banner.remove();
    let older = box.querySelector('[data-transcript-chrome="older"]');
    if (visible.length && state.olderPagesAdvertised !== false) {
      if (!older) {
        older = element('button', 'ghost', 'Check older activity'); older.type = 'button';
        older.dataset.transcriptChrome = 'older';
        older.addEventListener('click', () => post({ type: 'load_more' }));
        const after = box.querySelector('[data-transcript-chrome="banner"]');
        if (after && after.nextSibling) box.insertBefore(older, after.nextSibling);
        else if (after) box.appendChild(older);
        else box.insertBefore(older, box.firstChild);
      }
    } else if (older) older.remove();
    reconcileTranscriptBox(box, visible, '');
    applyTranscriptFind();
    if (!wrap) return;
    const prepended = Boolean(firstId && visible[0] && visible[0].id !== firstId && state.followLatest === false);
    if (prepended) wrap.scrollTop += Math.max(0, wrap.scrollHeight - prevHeight);
    else if (keep && keep.id) {
      const node = box.querySelector('[data-message-id="' + keep.id + '"]');
      wrap.scrollTop = node ? Math.max(0, node.offsetTop - keep.delta) : (saved && saved.offset || 0);
    } else if (state.followLatest !== false) wrap.scrollTop = wrap.scrollHeight;
    else if (saved && saved.eventId) {
      const node = box.querySelector('[data-message-id="' + saved.eventId + '"]');
      wrap.scrollTop = node ? node.offsetTop : (saved.offset || 0);
    } else if (saved) wrap.scrollTop = saved.offset;
  }
  function approvalStatus(item) {
    if (item.displayStatus) return item.displayStatus;
    const request = item.request || {};
    if (item.status && item.status !== 'pending') return item.status;
    const session = state.session || {};
    if (item.sessionId && session.id && item.sessionId !== session.id) return 'stale';
    if (item.incarnation && session.incarnation && item.incarnation !== session.incarnation) return 'stale';
    if (request.timeout > 0 && item.receivedAt && Date.now() >= item.receivedAt + request.timeout) return 'timeout';
    return 'pending';
  }
  function approvalReadonly(item) {
    const status = approvalStatus(item);
    if (item.canSubmit === false) return true;
    if (status === 'responded_elsewhere' || status === 'denied' || status === 'timeout' || status === 'stale') return true;
    return status !== 'pending' || (state.connection !== 'connected' && state.connection !== 'running' && state.connection !== 'online');
  }
  function approvalStatusCopy(status) {
    return ({
      responded_elsewhere: 'ตอบคำขอนี้จากอีกอุปกรณ์แล้ว',
      stale: 'คำขอนี้ใช้ตอบไม่ได้แล้ว',
      timeout: 'คำขอนี้ใช้ตอบไม่ได้แล้ว',
      denied: 'Denied',
      approved: 'Approved',
    })[status] || '';
  }
  function approvalOptionRows(request) {
    const options = request.options || [];
    const details = request.optionDetails || [];
    const rows = [];
    for (let index = 0; index < options.length; index++) {
      const detail = details[index] || {};
      const value = detail.value || options[index];
      if (!value) continue;
      rows.push({ value, label: detail.label || value, description: detail.description || '' });
    }
    return rows;
  }
  function approvalValue(request, control) {
    if (request.method === 'confirm' || !control) return true;
    if (control.multiple) return Array.from(control.selectedOptions || []).map((option) => option.value);
    return control.value;
  }
  function approvalBlockedReason(request, value) {
    if (request.required !== true || request.method === 'confirm' || value === true) return '';
    const multi = request.method === 'multi_select' || request.multiple === true;
    if (multi) return (Array.isArray(value) ? value.length : 0) ? '' : 'Select at least one option.';
    if (request.method === 'select' || request.method === 'input' || request.method === 'password' || request.method === 'editor') {
      if (Array.isArray(value)) return value.length ? '' : 'This field is required.';
      return typeof value === 'string' && value.trim() ? '' : 'This field is required.';
    }
    return '';
  }
  function buildUiCard(token, request) {
    const card = element('section', 'ui-card'); card.dataset.token = token; card.dataset.uiMethod = request.method || '';
    const heading = element('h3', '', request.title || 'Caret needs your input'); heading.dataset.uiHeading = 'true'; card.appendChild(heading);
    const meta = element('p', 'ui-meta'); meta.dataset.uiMeta = 'true'; card.appendChild(meta);
    const message = element('p', '', request.message || ''); message.dataset.uiMessage = 'true'; if (request.method !== 'confirm') message.hidden = true; card.appendChild(message);
    let control;
    const multiple = request.method === 'multi_select' || request.multiple === true;
    const secret = request.method === 'password' || request.secret === true;
    if (request.method === 'select' || request.method === 'multi_select') { control = element('select'); if (multiple) control.multiple = true; }
    else if (request.method === 'editor') { control = element('textarea'); control.rows = 6; control.value = request.prefill || ''; }
    else if (request.method === 'input' || request.method === 'password') { control = element('input'); control.type = secret ? 'password' : 'text'; control.placeholder = request.placeholder || ''; }
    if (request.method === 'schemaform') card.appendChild(element('p', '', 'Unsupported interaction. Caret will not render untrusted form HTML. Update or Cancel.'));
    if (control) { control.dataset.uiControl = 'true'; card.appendChild(control); }
    const error = element('p', 'ui-error'); error.dataset.uiError = 'true'; card.appendChild(error);
    if (Array.isArray(request.scopes) && request.scopes.length) {
      request.scopes.forEach((scope) => {
        const scoped = element('button', 'ghost', 'Allow scoped \u00B7 ' + scope); scoped.type = 'button';
        scoped.dataset.uiScoped = 'true';
        scoped.addEventListener('click', () => post({ type: 'ui_answer', token, answer: 'scope:' + scope }));
        card.appendChild(scoped);
      });
    }
    const target = request.target || request.tool || request.cwd || request.message || '';
    if (target.length > 80) {
      const expand = element('button', 'ghost', 'Expand'); expand.type = 'button';
      const full = element('pre', '', target); full.hidden = true;
      expand.addEventListener('click', () => { full.hidden = !full.hidden; text(expand, full.hidden ? 'Expand' : 'Collapse'); });
      card.append(expand, full);
    }
    const actions = element('div', 'ui-actions'); const cancel = element('button', 'ghost', 'Cancel'); cancel.type = 'button'; cancel.addEventListener('click', () => post({ type: 'ui_cancel', token })); actions.appendChild(cancel);
    const deny = element('button', 'danger', 'Deny'); deny.type = 'button'; deny.addEventListener('click', () => post({ type: 'ui_answer', token, answer: false })); if (request.method === 'confirm') actions.appendChild(deny);
    const submit = element('button', 'primary', request.method === 'confirm' ? 'Allow' : 'Submit'); submit.type = 'button';
    submit.addEventListener('click', () => {
      const value = approvalValue(request, control);
      const blocked = approvalBlockedReason(request, value);
      if (blocked) { text(error, blocked); if (control) control.focus(); return; }
      text(error, '');
      post({ type: 'ui_answer', token, answer: value });
    });
    actions.appendChild(submit); card.appendChild(actions);
    const record = { card, control, method: request.method, prefill: request.prefill || '', userEdited: false, cancel, deny, submit, dangerous: request.dangerous === true, didFocus: false };
    if (control) control.addEventListener('input', () => { record.userEdited = true; });
    return record;
  }
  function updateUiCard(record, item) {
    const request = item.request || {};
    const heading = record.card.querySelector('[data-ui-heading]'); if (heading) text(heading, request.title || 'Caret needs your input');
    const message = record.card.querySelector('[data-ui-message]'); if (message) { text(message, request.message || ''); message.hidden = request.method !== 'confirm'; }
    const meta = record.card.querySelector('[data-ui-meta]');
    const status = approvalStatus(item);
    const lines = ['Request ' + (request.id || item.token), 'Method ' + (request.method || 'unknown'), 'Status ' + status];
    const statusCopy = approvalStatusCopy(status);
    if (statusCopy) lines.push(statusCopy);
    if (item.tool) lines.push('Tool ' + item.tool);
    if (item.target) lines.push('Target ' + item.target);
    if (item.cwd) lines.push('cwd ' + item.cwd);
    if (item.sessionId) lines.push('Session ' + item.sessionId);
    if (item.incarnation) lines.push('Incarnation ' + item.incarnation);
    if (request.timeout > 0 && item.receivedAt) {
      const remaining = Math.max(0, item.receivedAt + request.timeout - Date.now());
      lines.push(remaining <= 0 ? 'Expired' : ('Expires in ' + Math.ceil(remaining / 1000) + 's'));
    }
    if (state.connection !== 'connected' && state.connection !== 'running' && state.connection !== 'online') lines.push('Waiting for host');
    if (meta) text(meta, lines.join('\n'));
    const readonly = approvalReadonly(item);
    record.card.classList.toggle('readonly', readonly);
    if (record.control) record.control.disabled = readonly;
    if (record.cancel) record.cancel.disabled = readonly;
    if (record.deny) record.deny.disabled = readonly;
    if (record.submit) record.submit.disabled = readonly;
    record.card.querySelectorAll('[data-ui-scoped]').forEach((button) => { button.disabled = readonly; });
    if (!record.didFocus && request.dangerous === true && record.cancel && !readonly) {
      record.didFocus = true;
      record.cancel.focus();
    }
    const control = record.control;
    if (!control) return;
    if (request.method === 'select' || request.method === 'multi_select') {
      const selected = new Set(Array.from(control.selectedOptions || []).map((option) => option.value));
      if (!selected.size && control.value) selected.add(control.value);
      control.textContent = '';
      approvalOptionRows(request).forEach((row) => {
        const node = element('option', '', row.label); node.value = row.value;
        if (row.description) node.title = row.description;
        if (selected.has(row.value)) node.selected = true;
        control.appendChild(node);
      });
    } else if (request.method === 'input' || request.method === 'password') {
      control.placeholder = request.placeholder || '';
      if (request.method === 'password' || request.secret === true) control.type = 'password';
    } else if (request.method === 'editor' && !record.userEdited && document.activeElement !== control && record.prefill !== (request.prefill || '')) {
      control.value = request.prefill || ''; record.prefill = request.prefill || '';
    }
  }
  let approvalTick = 0;
  function renderUiRequests() {
    const box = byId('ui-requests');
    const incarnation = state.session && state.session.incarnation ? state.session.incarnation : '';
    if (uiIncarnation !== incarnation) { uiControls.clear(); box.textContent = ''; uiIncarnation = incarnation; }
    const active = new Set();
    (state.uiRequests || []).forEach((item) => {
      if (!item || !item.token || !item.request) return;
      active.add(item.token);
      let record = uiControls.get(item.token);
      if (record && record.method !== item.request.method) { record.card.remove(); record = undefined; }
      if (!record) { record = buildUiCard(item.token, item.request); uiControls.set(item.token, record); }
      updateUiCard(record, item);
      box.appendChild(record.card);
    });
    for (const [token, record] of uiControls) if (!active.has(token)) { record.card.remove(); uiControls.delete(token); }
    const ticking = (state.uiRequests || []).some((item) => item && item.request && item.request.timeout > 0 && !approvalReadonly(item));
    if (ticking && !approvalTick) {
      approvalTick = setInterval(() => { renderUiRequests(); }, 1000);
    } else if (!ticking && approvalTick) {
      clearInterval(approvalTick); approvalTick = 0;
    }
  }
  function renderModels() { const select = byId('model-select'); const selected = state.selectedModel || ''; select.textContent = ''; if (!state.models || !state.models.length) { select.appendChild(element('option', '', 'Model')); select.disabled = true; select.title = 'Choose a model. Use Add \u2192 Model to refresh. Caret does not pick a billed fallback.'; return; } select.disabled = false; select.title = ''; state.models.forEach((model) => { const option = element('option', '', model.label || model.id); option.value = model.id; option.disabled = model.available === false; if (model.id === selected) option.selected = true; select.appendChild(option); }); }
  function renderThinking() {
    const select = byId('thinking-select'); if (!select) return;
    const thinking = state.thinking || {};
    const options = thinking.options || [];
    select.textContent = '';
    if (!thinking.advertised || !options.length) {
      const option = element('option', '', 'Thinking'); option.value = '';
      select.appendChild(option); select.disabled = true;
      select.title = thinking.reason || 'OMP has not advertised thinking levels for this model.';
      return;
    }
    select.disabled = false; select.title = '';
    options.forEach((item) => {
      const option = element('option', '', item.label || item.id); option.value = item.id;
      option.disabled = item.enabled === false;
      if (item.id === thinking.current) option.selected = true;
      select.appendChild(option);
    });
  }
  function renderLogin() {
    const box = byId('login-providers'); if (!box) return; box.textContent = '';
    const providers = state.loginProviders || [];
    if (!providers.length) { box.appendChild(element('p', '', 'Refresh to list OMP login providers. Caret does not open a browser until you ask.')); return; }
    providers.forEach((provider) => {
      const row = element('div', 'login-row');
      const wrap = element('span'); wrap.appendChild(element('span', 'name', provider.name || provider.id)); wrap.appendChild(element('span', 'meta', provider.authenticated ? 'signed in' : (provider.available === false ? 'unavailable' : 'not signed in')));
      const button = element('button', 'ghost', provider.authenticated ? 'Re-login' : 'Log in'); button.type = 'button'; button.disabled = provider.available === false; button.addEventListener('click', () => post({ type: 'start_login', providerId: provider.id }));
      row.append(wrap, button); box.appendChild(row);
    });
  }
  function renderSlash() {
    const box = byId('slash-commands'); if (!box) return; box.textContent = '';
    const commands = state.slashCommands || [];
    if (!commands.length) { box.appendChild(element('p', '', 'Refresh to list OMP slash commands. Running one sends it as a prompt on this session.')); return; }
    commands.forEach((command) => {
      const row = element('div', 'login-row');
      const wrap = element('span'); wrap.appendChild(element('span', 'name', '/' + command.name)); if (command.description) wrap.appendChild(element('span', 'meta', command.description));
      const button = element('button', 'ghost', 'Run'); button.type = 'button';
      button.addEventListener('click', () => post({ type: 'run_slash', name: command.name }));
      row.append(wrap, button); box.appendChild(row);
    });
  }
  let settingsSection = 'Appearance';
  let settingsQuery = '';
  let settingsCloseTimer = 0;
  function presentationPrefs() {
    const prefs = state.prefs || {};
    const draft = state.settingsDraft && state.settingsDraft.values ? state.settingsDraft.values : {};
    return {
      density: draft.density || prefs.density || 'comfortable',
      panelPosition: draft.panelPosition || prefs.panelPosition || 'right',
      submitEnter: draft.submitEnter == null ? prefs.submitEnter !== false : draft.submitEnter !== false,
      reduceMotion: draft.reduceMotion == null ? prefs.reduceMotion === true : draft.reduceMotion === true,
      highContrast: draft.highContrast == null ? prefs.highContrast === true : draft.highContrast === true,
      startupView: draft.startupView || prefs.startupView || 'agents',
      windowRestore: draft.windowRestore == null ? prefs.windowRestore !== false : draft.windowRestore !== false,
      autoHideEmptyIde: draft.autoHideEmptyIde == null ? prefs.autoHideEmptyIde === true : draft.autoHideEmptyIde === true,
      sidebarWidth: prefs.sidebarWidth || 180,
    };
  }
  function settingsOpen() { const route = byId('settings-route'); return Boolean(route && route.classList.contains('open')); }
  function openSettings(section) {
    if (section) settingsSection = section;
    const route = byId('settings-route');
    if (settingsCloseTimer) { clearTimeout(settingsCloseTimer); settingsCloseTimer = 0; }
    if (route) { route.classList.add('open'); route.removeAttribute('hidden'); }
    if (settingsSection === 'Devices/connections') post({ type: 'refresh_devices' });
    if (settingsSection === 'Models/providers') post({ type: 'get_models' });
    if (settingsSection === 'Skills/rules/hooks/commands') post({ type: 'get_slash_commands' });
    if (settingsSection === 'Agents/OMP') post({ type: 'get_login_providers' });
    renderCatalog();
  }
  function closeSettings() {
    const route = byId('settings-route');
    if (!route) return;
    route.classList.remove('open');
    if (settingsCloseTimer) clearTimeout(settingsCloseTimer);
    const ms = presentationPrefs().reduceMotion === true ? 0 : ((state.motion && state.motion.drawerOut) || 0);
    const finish = function() { route.setAttribute('hidden', ''); settingsCloseTimer = 0; };
    if (ms <= 0) { finish(); return; }
    settingsCloseTimer = setTimeout(finish, ms);
  }
  function renderLoginRows(target) {
    const providers = state.loginProviders || [];
    if (!providers.length) { target.appendChild(element('p', '', 'Refresh to list OMP login providers. Caret does not open a browser until you ask.')); return; }
    providers.forEach((provider) => {
      const row = element('div', 'login-row');
      const wrap = element('span'); wrap.appendChild(element('span', 'name', provider.name || provider.id)); wrap.appendChild(element('span', 'meta', provider.authenticated ? 'signed in' : (provider.available === false ? 'unavailable' : 'not signed in')));
      const button = element('button', 'ghost', provider.authenticated ? 'Re-login' : 'Log in'); button.type = 'button'; button.disabled = provider.available === false; button.addEventListener('click', () => post({ type: 'start_login', providerId: provider.id }));
      row.append(wrap, button); target.appendChild(row);
    });
  }
  function renderSlashRows(target) {
    const commands = state.slashCommands || [];
    if (!commands.length) { target.appendChild(element('p', '', 'Refresh to list OMP slash commands. Running one sends it as a prompt on this session.')); return; }
    commands.forEach((command) => {
      const row = element('div', 'login-row');
      const wrap = element('span'); wrap.appendChild(element('span', 'name', '/' + command.name)); if (command.description) wrap.appendChild(element('span', 'meta', command.description));
      const button = element('button', 'ghost', 'Run'); button.type = 'button';
      button.addEventListener('click', () => post({ type: 'run_slash', name: command.name }));
      row.append(wrap, button); target.appendChild(row);
    });
  }
  function renderCatalog() {
    const route = byId('settings-route');
    if (!route || !route.classList.contains('open')) return;
    const q = settingsQuery.trim().toLowerCase();
    const sections = (state.settingsSections || []).filter((name) => !q || name.toLowerCase().includes(q));
    const nav = byId('settings-nav');
    const page = byId('settings-page');
    if (nav) {
      nav.textContent = '';
      (sections.length ? sections : state.settingsSections || []).forEach((name) => {
        const button = element('button', '', name); button.type = 'button';
        if (name === settingsSection) button.setAttribute('aria-current', 'true');
        button.addEventListener('click', () => openSettings(name));
        nav.appendChild(button);
      });
    }
    const select = byId('settings-section-select');
    if (select) {
      select.textContent = '';
      (state.settingsSections || []).forEach((name) => {
        const option = element('option', '', name); option.value = name;
        if (name === settingsSection) option.selected = true;
        select.appendChild(option);
      });
      select.setAttribute('aria-label', 'Settings category');
    }
    if (!page) return;
    page.textContent = '';
    page.appendChild(element('h2', '', settingsSection));
    const settingIndex = [
      { id: 'density', section: 'Appearance', label: 'Conversation density', description: 'Comfortable or detailed presentation' },
      { id: 'panelPosition', section: 'Appearance', label: 'Work panel position', description: 'Right or bottom' },
      { id: 'submitEnter', section: 'Appearance', label: 'Submit on Enter', description: 'Desktop Enter sends' },
      { id: 'reduceMotion', section: 'Appearance', label: 'Reduce motion' },
      { id: 'highContrast', section: 'Appearance', label: 'High contrast' },
      { id: 'startupView', section: 'Appearance', label: 'Startup view', description: 'IDE with the agent docked, the full Agents shell, or whichever was last used. Does not start a run.' },
      { id: 'windowRestore', section: 'Appearance', label: 'Window restore', description: 'Restore previous IDE chrome when enabled.' },
      { id: 'autoHideEmptyIde', section: 'Appearance', label: 'Auto-hide empty IDE', description: 'Off by default. Does not surprise-switch when closing a file.' },
      { id: 'theme', section: 'Appearance', label: 'Theme', description: 'Follows Code-OSS. Opens the theme picker.' },
      { id: 'shortcuts', section: 'Appearance', label: 'Shortcuts', description: 'Advertised Caret chords. Edit in Code-OSS Keyboard Shortcuts.' },
      { id: 'in-app', section: 'Notifications', label: 'In-app attention' },
      { id: 'system-notify', section: 'Notifications', label: 'System notifications' },
    ];
    (state.settingsRows || []).forEach((item) => settingIndex.push({ id: item.id, section: item.section, label: item.label, description: (item.value || '') + ' ' + (item.reason || '') }));
    if (q) {
      settingIndex.filter((item) => [item.label, item.description, item.section, item.id].join(' ').toLowerCase().includes(q)).forEach((hit) => {
        const button = element('button', 'search-hit', hit.label + ' · ' + hit.section);
        button.type = 'button';
        button.addEventListener('click', () => {
          settingsSection = hit.section;
          settingsQuery = '';
          const input = byId('settings-search');
          if (input) input.value = '';
          renderCatalog();
          const target = page.querySelector('[data-setting-id="' + hit.id + '"]');
          if (target && typeof target.focus === 'function') { target.setAttribute('tabindex', '-1'); target.focus(); }
        });
        page.appendChild(button);
      });
    }
    const copy = {
      'Appearance': 'Theme follows Code-OSS. Density and motion stay presentation-only. Errors and approvals stay visible.',
      'Agents/OMP': 'OMP is the only execution owner. Agent↔IDE is a view switch, not a new session.',
      'Models/providers': 'Listed models come from the host registry. Unavailable rows stay visible. Caret does not silently pick a billed fallback.',
      'Tools/MCP': 'MCP and tools appear only when the host advertises them. Browse is not install.',
      'Skills/rules/hooks/commands': 'Slash commands are OMP-owned. Running one sends a prompt on this session. Automations stay unavailable.',
      'Workspace/editor': 'Code-OSS owns Explorer, LSP, undo, and editor settings. Caret does not replace the IDE.',
      'Browser/artifacts': 'Browser stays unsupported until a live bridge handle exists. Artifacts are immutable receipts.',
      'Devices/connections': 'Pair or revoke an iPhone from this Mac. Host reachability is not relay status.',
      'Notifications': 'In-app attention is on. System notifications stay off until a Caret notification contract exists. Sound stays off.',
      'Privacy/security': 'Secrets stay redacted. Caret does not export provider tokens. Diagnostics preview redaction before export when that flow exists.',
      'About/updates/licenses': 'Caret.app is an ad-hoc personal build. Updates and notarization are not claimed.',
    }[settingsSection] || '';
    if (copy) page.appendChild(element('p', '', copy));
    if (settingsSection === 'Notifications') {
      const inApp = element('button', '', 'In-app attention: on'); inApp.type = 'button'; inApp.disabled = true; inApp.title = 'In-app attention is always on for unanswered requests.';
      const system = element('button', '', 'System notifications: off'); system.type = 'button'; system.disabled = true; system.title = 'System notifications stay off until a Caret notification contract exists.';
      const sound = element('button', '', 'Sound: off'); sound.type = 'button'; sound.disabled = true; sound.title = 'Completion sound stays off.';
      const row = element('div', 'pref-row'); row.append(inApp, system, sound); page.appendChild(row);
    }
    if (settingsSection === 'Appearance') {
      const prefs = presentationPrefs();
      const scopes = element('div', 'scope-chips');
      ['Global', 'Project', 'Session'].forEach((name) => {
        const chip = element('button', '', name); chip.type = 'button';
        chip.disabled = name !== 'Global';
        if (name === 'Global') chip.setAttribute('aria-pressed', 'true');
        chip.title = name === 'Global' ? 'Product presentation on this Mac. These values do not start or stop OMP.' : 'Project and session writes are not advertised.';
        scopes.appendChild(chip);
      });
      page.appendChild(scopes);
      const connectPhone = element('button', 'ghost', 'Connect your iPhone'); connectPhone.type = 'button';
      connectPhone.addEventListener('click', () => openSettings('Devices/connections'));
      page.appendChild(connectPhone);
      page.appendChild(element('p', 'settings-source', 'Effective · ' + (state.settingsSource || 'this Mac · product prefs') + ' · revision ' + String(state.settingsRevision || 0)));
      if (state.settingsApplyError) page.appendChild(element('p', 'settings-apply-error', state.settingsApplyError));
      if (state.settingsResetPreview) page.appendChild(element('p', 'settings-source', 'Reset preview · ' + state.settingsResetPreview.key + ' ' + String(state.settingsResetPreview.current) + ' → ' + String(state.settingsResetPreview.inherited) + ' removes ' + (state.settingsResetPreview.removes || '')));
      const density = element('div', 'pref-row');
      [['comfortable', 'Comfortable'], ['detailed', 'Detailed']].forEach((pair) => {
        const button = element('button', '', pair[1]); button.type = 'button';
        button.setAttribute('aria-pressed', (prefs.density || 'comfortable') === pair[0] ? 'true' : 'false');
        button.dataset.settingId = 'density';
        button.addEventListener('click', () => post({ type: 'set_pref', key: 'density', value: pair[0] }));
        density.appendChild(button);
      });
      page.appendChild(element('p', '', 'Conversation density is presentation-only. Errors and approvals stay visible.'));
      page.appendChild(density);
      const dock = element('div', 'pref-row');
      [['right', 'Work panel right'], ['bottom', 'Work panel bottom']].forEach((pair) => {
        const button = element('button', '', pair[1]); button.type = 'button';
        button.setAttribute('aria-pressed', (prefs.panelPosition || 'right') === pair[0] ? 'true' : 'false');
        button.dataset.settingId = 'panelPosition';
        button.addEventListener('click', () => post({ type: 'set_pref', key: 'panelPosition', value: pair[0] }));
        dock.appendChild(button);
      });
      page.appendChild(dock);
      const enter = element('button', '', prefs.submitEnter === false ? 'Submit on Enter: off' : 'Submit on Enter: on'); enter.type = 'button'; enter.dataset.settingId = 'submitEnter';
      enter.setAttribute('aria-pressed', prefs.submitEnter === false ? 'false' : 'true');
      enter.addEventListener('click', () => post({ type: 'set_pref', key: 'submitEnter', value: prefs.submitEnter === false }));
      const motion = element('button', '', prefs.reduceMotion ? 'Reduce motion: on' : 'Reduce motion: off'); motion.type = 'button'; motion.dataset.settingId = 'reduceMotion';
      motion.setAttribute('aria-pressed', prefs.reduceMotion ? 'true' : 'false');
      motion.addEventListener('click', () => post({ type: 'set_pref', key: 'reduceMotion', value: !prefs.reduceMotion }));
      const contrast = element('button', '', prefs.highContrast ? 'High contrast: on' : 'High contrast: off'); contrast.type = 'button'; contrast.dataset.settingId = 'highContrast';
      contrast.setAttribute('aria-pressed', prefs.highContrast ? 'true' : 'false');
      contrast.addEventListener('click', () => post({ type: 'set_pref', key: 'highContrast', value: !prefs.highContrast }));
      const row = element('div', 'pref-row'); row.append(enter, motion, contrast); page.appendChild(row);
      const start = element('div', 'pref-row');
      [['ide', 'Startup: IDE + dock'], ['agents', 'Startup: Agents'], ['last_task', 'Startup: last used']].forEach((pair) => {
        const button = element('button', '', pair[1]); button.type = 'button';
        button.setAttribute('aria-pressed', (prefs.startupView || 'ide') === pair[0] ? 'true' : 'false');
        button.dataset.settingId = 'startupView';
        button.addEventListener('click', () => post({ type: 'set_pref', key: 'startupView', value: pair[0] }));
        start.appendChild(button);
      });
      page.appendChild(element('p', '', 'Startup view does not start a new run. IDE + dock keeps the Code-OSS editor with the agent beside it; last used restores whichever surface you left.'));
      page.appendChild(start);
      const restore = element('button', '', prefs.windowRestore === false ? 'Window restore: off' : 'Window restore: on'); restore.type = 'button'; restore.dataset.settingId = 'windowRestore';
      restore.setAttribute('aria-pressed', prefs.windowRestore === false ? 'false' : 'true');
      restore.addEventListener('click', () => post({ type: 'set_pref', key: 'windowRestore', value: prefs.windowRestore === false }));
      const hideIde = element('button', '', prefs.autoHideEmptyIde ? 'Auto-hide empty IDE: on' : 'Auto-hide empty IDE: off'); hideIde.type = 'button'; hideIde.dataset.settingId = 'autoHideEmptyIde';
      hideIde.setAttribute('aria-pressed', prefs.autoHideEmptyIde ? 'true' : 'false');
      hideIde.addEventListener('click', () => post({ type: 'set_pref', key: 'autoHideEmptyIde', value: !prefs.autoHideEmptyIde }));
      const win = element('div', 'pref-row'); win.append(restore, hideIde); page.appendChild(win);
      const theme = element('button', 'ghost', 'Choose Code-OSS theme'); theme.type = 'button'; theme.dataset.settingId = 'theme';
      theme.addEventListener('click', () => post({ type: 'select_theme' }));
      page.appendChild(theme);
      page.appendChild(element('p', '', 'Shortcuts are advertised Caret chords. Collision and remapping stay in Code-OSS Keyboard Shortcuts.'));
      const shortcuts = state.shortcutRows || [];
      if (!shortcuts.length) page.appendChild(element('p', 'settings-source', 'No advertised Caret keybindings.'));
      shortcuts.forEach((item) => {
        const line = element('p', 'settings-source', (item.title || item.command) + '  ' + (item.keybinding || ''));
        line.dataset.settingId = item.id || item.command;
        page.appendChild(line);
      });
      const keys = element('button', 'ghost', 'Open Keyboard Shortcuts'); keys.type = 'button'; keys.dataset.settingId = 'shortcuts';
      keys.addEventListener('click', () => post({ type: 'open_keybindings' }));
      page.appendChild(keys);
      const applyRow = element('div', 'settings-apply-row');
      const apply = element('button', 'primary', 'Apply'); apply.type = 'button';
      apply.addEventListener('click', () => post({ type: 'apply_settings', section: 'Appearance', revision: (state.settingsDraft && state.settingsDraft.revision != null ? state.settingsDraft.revision : (state.settingsRevision || 0)), scope: 'global', values: { density: prefs.density, panelPosition: prefs.panelPosition, submitEnter: prefs.submitEnter !== false, reduceMotion: prefs.reduceMotion === true, highContrast: prefs.highContrast === true, startupView: prefs.startupView || 'ide', windowRestore: prefs.windowRestore !== false, autoHideEmptyIde: prefs.autoHideEmptyIde === true } }));
      applyRow.appendChild(apply);
      ['density', 'panelPosition', 'submitEnter', 'reduceMotion', 'highContrast', 'startupView', 'windowRestore', 'autoHideEmptyIde'].forEach((key) => {
        const reset = element('button', 'ghost', 'Reset ' + key); reset.type = 'button';
        reset.addEventListener('click', () => post({ type: 'reset_settings', key: key, revision: state.settingsRevision || 0 }));
        applyRow.appendChild(reset);
      });
      page.appendChild(applyRow);
    }
    if (settingsSection === 'Models/providers' || settingsSection === 'Tools/MCP' || settingsSection === 'Agents/OMP') {
      (state.catalog || []).forEach((item) => {
        const row = element('div', 'login-row');
        row.appendChild(element('span', 'name', item.label || item.id));
        row.appendChild(element('span', 'meta', (item.status || 'unsupported') + ' · ' + (item.reason || '')));
        page.appendChild(row);
      });
      (state.settingsRows || []).filter((item) => item.section === settingsSection).forEach((item) => {
        const row = element('div', 'login-row');
        row.appendChild(element('span', 'name', item.label || item.id));
        row.appendChild(element('span', 'meta', (item.value || '') + ' · ' + (item.source || '') + (item.writable ? '' : ' · read-only') + (item.reason ? ' · ' + item.reason : '')));
        page.appendChild(row);
      });
      if (settingsSection !== 'Tools/MCP') renderLoginRows(page);
    }
    if (settingsSection === 'Skills/rules/hooks/commands') {
      (state.settingsRows || []).filter((item) => item.section === settingsSection).forEach((item) => {
        const row = element('div', 'login-row');
        row.appendChild(element('span', 'name', item.label || item.id));
        row.appendChild(element('span', 'meta', item.value || ''));
        page.appendChild(row);
      });
      renderSlashRows(page);
    }
    if (settingsSection === 'Workspace/editor') {
      const open = element('button', 'ghost', 'Open Code-OSS settings'); open.type = 'button';
      open.addEventListener('click', () => post({ type: 'native_action', action: 'host_settings' }));
      const theme = element('button', 'ghost', 'Choose Code-OSS theme'); theme.type = 'button';
      theme.addEventListener('click', () => post({ type: 'select_theme' }));
      const keys = element('button', 'ghost', 'Open Keyboard Shortcuts'); keys.type = 'button';
      keys.addEventListener('click', () => post({ type: 'open_keybindings' }));
      page.append(open, theme, keys);
    }
    if (settingsSection === 'Devices/connections') {
      page.appendChild(element('p', '', 'Host: ' + (state.hostReachable ? 'reachable' : 'unreachable') + '. Relay: ' + (state.relayStatus || 'unknown') + '. Last host sync: ' + (state.lastHostSyncAt || 'never') + '.'));
      if (state.devicesError) page.appendChild(element('p', '', state.devicesError));
      (state.devices || []).filter((device) => device.role !== 'owner' && !device.revokedAt).forEach((device) => {
        const row = element('div', 'login-row');
        row.appendChild(element('span', 'name', device.name || device.id));
        row.appendChild(element('span', 'meta', device.role || 'device'));
        const revoke = element('button', 'danger', 'Revoke'); revoke.type = 'button';
        revoke.addEventListener('click', () => post({ type: 'revoke_device', deviceId: device.id }));
        row.appendChild(revoke);
        page.appendChild(row);
      });
      const pair = element('button', 'primary', 'Connect your iPhone'); pair.type = 'button';
      pair.addEventListener('click', () => post({ type: 'native_action', action: 'pair' }));
      const manage = element('button', 'ghost', 'Manage devices'); manage.type = 'button';
      manage.addEventListener('click', () => post({ type: 'native_action', action: 'devices' }));
      const refresh = element('button', 'ghost', 'Refresh devices'); refresh.type = 'button';
      refresh.addEventListener('click', () => post({ type: 'refresh_devices' }));
      page.append(pair, manage, refresh);
    }
    if (settingsSection === 'Privacy/security') {
      page.appendChild(element('p', '', 'Redaction preview before export. Provider tokens are not included. Export stays local until a signed support channel exists.'));
      page.appendChild(element('pre', '', state.diagnosticsPreview || 'connection=unknown\nsession=none\nproject=none\nrelay=unknown\nsecrets=redacted'));
      const exportBtn = element('button', 'ghost', 'Export redacted diagnostics'); exportBtn.type = 'button';
      exportBtn.addEventListener('click', () => post({ type: 'export_diagnostics' }));
      page.appendChild(exportBtn);
    }
    if (settingsSection === 'About/updates/licenses') {
      page.appendChild(element('p', '', 'Protocol owner: OMP. IDE: Code-OSS. Host connection: ' + (state.connection || 'unknown') + '.'));
      (state.about || []).forEach((row) => {
        const line = element('p', 'settings-source', (row.label || row.id) + ' · ' + (row.value || '') + (row.claim === 'unavailable' ? ' · unavailable' : ''));
        line.dataset.settingId = row.id;
        page.appendChild(line);
      });
      page.appendChild(element('p', '', 'Update check is read-only. Install needs a compatible version, migration backup, and an explicit restart. Active jobs are not killed silently.'));
    }
  }
  function renderPresentations() {
    const box = byId('presentations'); if (!box) return; box.textContent = '';
    (state.presentations || []).filter((item) => item && item.method === 'open_url' && item.url).forEach((item) => {
      const card = element('section', 'resource-card');
      card.appendChild(element('h3', '', 'Sign-in URL'));
      if (item.instructions) card.appendChild(element('p', '', item.instructions));
      const open = element('button', 'resource-action', ''); open.type = 'button';
      open.appendChild(element('span', 'symbol', '↗')); open.appendChild(element('span', '', 'Open in browser'));
      open.addEventListener('click', () => post({ type: 'open_login_url', url: item.url }));
      card.appendChild(open); box.appendChild(card);
    });
  }
  function renderComposer() {
    const controls = state.composer || {};
    const authoritative = Boolean(state.composer);
    const reasonFor = (key, fallback) => controls[key] || fallback;

    const send = byId('send'); const steer = byId('steer'); const queue = byId('follow-up'); const stop = byId('stop'); const models = byId('model-select');
    const emptyHome = !(state.transcript && state.transcript.length);
    if (send) { text(send, emptyHome ? '↑' : (controls.primaryLabel || 'Send')); send.disabled = !authoritative || controls.primaryEnabled !== true; send.dataset.intent = controls.sendIntent || controls.primary || ''; send.title = reasonFor('primaryReason', 'Waiting for the host composer snapshot'); send.setAttribute('aria-label', send.title); }
    if (steer) { const reason = reasonFor('steerReason', 'Waiting for the host composer snapshot'); steer.hidden = !authoritative || controls.steerEnabled !== true || controls.primary === 'queue'; steer.disabled = !authoritative || controls.steerEnabled !== true || controls.primary === 'queue'; steer.title = reason; steer.setAttribute('aria-label', 'Steer — ' + reason); }
    if (queue) { const reason = reasonFor('queueReason', 'Waiting for the host composer snapshot'); queue.hidden = !authoritative || controls.queueVisible !== true || controls.primary === 'queue'; queue.disabled = !authoritative || controls.queueEnabled !== true; queue.title = reason; queue.setAttribute('aria-label', 'Queue — ' + reason); }
    if (stop) { const reason = reasonFor('stopReason', 'Waiting for the host composer snapshot'); stop.hidden = !authoritative || controls.stopEnabled !== true; text(stop, controls.stopLabel || 'Stop'); stop.disabled = !authoritative || controls.stopEnabled !== true; stop.title = reason; stop.setAttribute('aria-label', (controls.stopLabel || 'Stop') + ' — ' + reason); }
    if (models) models.disabled = controls.modelEnabled !== true;
    const hint = byId('shortcut-hint');
    if (hint) {
      hint.hidden = true;
      text(hint, controls.primaryReason || (presentationPrefs().submitEnter === false ? 'Enter newline \u00B7 \u2318Enter send' : 'Enter send \u00B7 Shift+Enter newline'));
    }
    const restore = byId('restore-sent');
    if (restore) {
      restore.hidden = !state.lastSentDraft;
      restore.disabled = !state.lastSentDraft;
    }
    const box = byId('queue-list');
    if (box) {
      box.textContent = '';
      const queued = Object.values(state.pendingCommands || {}).filter((item) => item && (item.status === 'queued' || item.command === 'follow_up'));
      box.hidden = queued.length === 0;
      if (queued.length) {
        const toggle = element('button', 'ghost', (state.queueCollapsed ? 'Show queue · ' : 'Hide queue · ') + queued.length); toggle.type = 'button';
        toggle.setAttribute('aria-expanded', state.queueCollapsed ? 'false' : 'true');
        toggle.addEventListener('click', () => post({ type: 'set_queue_collapsed', collapsed: !state.queueCollapsed }));
        box.appendChild(toggle);
      }
      if (state.queueCollapsed) return;
      queued.forEach((item) => {
        const row = element('div', 'queue-item');
        const id = item.commandId ? String(item.commandId).slice(0, 8) : '';
        row.appendChild(element('div', '', (item.command || 'queued') + ' · ' + (item.status || '') + (id ? ' · ' + id : '')));
        const message = item.payload && item.payload.message != null ? String(item.payload.message) : '';
        const preview = message.split('\n').filter(Boolean).slice(0, 2).join(' · ');
        const extras = [];
        if (item.payload && item.payload.attachments) extras.push(Array.isArray(item.payload.attachments) ? item.payload.attachments.length + ' attachments' : 'attachments');
        if (state.project && state.project.name) extras.push(state.project.name);
        if (preview || extras.length) row.appendChild(element('div', 'meta', [preview, extras.join(' · ')].filter(Boolean).join(' · ')));
        const actions = element('div', 'pref-row');
        if (item.commandId && message.trim()) {
          const copy = element('button', 'ghost', 'Copy to draft'); copy.type = 'button';
          copy.addEventListener('click', () => post({ type: 'copy_queue_draft', commandId: item.commandId }));
          actions.appendChild(copy);
        }
        const edit = element('button', 'ghost', 'Edit'); edit.type = 'button'; edit.disabled = true; edit.title = 'OMP has not advertised queue mutation.';
        const remove = element('button', 'ghost', 'Remove'); remove.type = 'button'; remove.disabled = true; remove.title = 'OMP has not advertised queue mutation.';
        actions.append(edit, remove);
        row.appendChild(actions);
        box.appendChild(row);
      });
    }
  }
  function renderPlan() {
    const box = byId('plan-strip'); if (!box) return;
    const plan = state.plan || {};
    const steps = plan.steps || [];
    const goals = plan.goals || [];
    const subagents = plan.subagents || [];
    box.textContent = '';
    if (!plan.advertised) { box.hidden = true; return; }
    box.hidden = false;
    box.appendChild(element('h3', '', 'Plan'));
    if (!plan.advertised) box.appendChild(element('p', '', plan.reason || 'OMP has not advertised a plan for this task.'));
    steps.forEach((step) => box.appendChild(element('div', 'plan-step', (step.status || 'unknown') + ' · ' + (step.label || step.id))));
    goals.forEach((goal) => box.appendChild(element('div', 'plan-step', 'goal · ' + (goal.status || 'active') + ' · ' + (goal.label || goal.id))));
    const nest = (rows, depth) => {
      (rows || []).forEach((row) => {
        const line = element('div', 'plan-step');
        line.style.paddingLeft = String(8 + depth * 16) + 'px';
        text(line, (depth ? '└ ' : '') + 'subagent · ' + (row.status || 'unknown') + ' · ' + (row.label || row.id));
        box.appendChild(line);
        nest(row.children || [], depth + 1);
      });
    };
    if (plan.subagentTree && plan.subagentTree.length) nest(plan.subagentTree, 0);
    else subagents.forEach((row) => {
      const line = element('div', 'plan-step', 'subagent · ' + (row.status || 'unknown') + ' · ' + (row.label || row.id));
      if (row.id && (state.sessions || []).some((session) => session.id === row.id)) {
        line.dataset.action = 'open_session';
        line.dataset.sessionId = row.id;
      }
      box.appendChild(line);
    });
    const actions = element('div', 'pref-row');
    [['Retry step', 'OMP has not advertised plan step retry. Caret will not invent a retry owner.'], ['Cancel subagent', 'OMP has not advertised subagent cancel. Caret will not stop a child run from this strip.'], ['Reorder', 'OMP has not advertised plan reorder.']].forEach((pair) => {
      const button = element('button', 'ghost', pair[0]); button.type = 'button'; button.disabled = true; button.title = pair[1];
      actions.appendChild(button);
    });
    box.appendChild(actions);
  }
  function renderAttachments() {
    const box = byId('attachment-chips'); if (!box) return; box.textContent = '';
    (state.attachments || []).forEach((item) => {
      const chip = element('span', 'chip');
      chip.appendChild(element('span', '', item.name || 'file'));
      const progress = item.state === 'uploading' && item.bytes ? ' · ' + (item.uploadedBytes || 0) + '/' + item.bytes : '';
      chip.appendChild(element('span', 'meta', item.state + progress + (item.error ? ' · ' + item.error : '')));
      if (item.state === 'failed') {
        const retry = element('button', 'ghost', 'Retry'); retry.type = 'button';
        retry.setAttribute('aria-label', 'Retry ' + (item.name || 'file'));
        retry.addEventListener('click', () => post({ type: 'retry_attachment', id: item.id }));
        chip.appendChild(retry);
      }
      const remove = element('button', 'ghost', 'Remove'); remove.type = 'button';
      remove.setAttribute('aria-label', 'Remove ' + (item.name || 'file'));
      remove.addEventListener('click', () => post({ type: 'remove_attachment', id: item.id }));
      chip.appendChild(remove); box.appendChild(chip);
    });
  }
  function renderWorkTabs() {
    const box = byId('resource-tabs'); if (!box) return; box.textContent = '';
    const tabs = state.workTabs || ['changes','terminal','browser','preview','artifacts','files'];
    const labels = { changes: 'Changes', terminal: 'Terminal', browser: 'Browser', preview: 'Preview', artifacts: 'Artifacts', files: 'Files' };
    const active = (state.workPanel && state.workPanel.activeTab) || 'changes';
    const resources = state.visibleResources || [];
    tabs.forEach((tab) => {
      const button = element('button', '', labels[tab] || tab);
      button.type = 'button'; button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', tab === active ? 'true' : 'false');
      const resource = resources.find((item) => item.tab === tab);
      const badgeKind = resource && (resource.status === 'error' || resource.status === 'expired') ? 'error' : (resource && resource.status === 'stale' ? 'stale' : '');
      if (badgeKind) {
        const badge = element('span', 'work-tab-badge ' + badgeKind);
        badge.title = resource.status;
        button.appendChild(badge);
      }
      if (tab === 'browser' && state.browserBridge !== true) {
        button.classList.add('unavailable');
        button.title = 'Unsupported until the OMP browser bridge advertises a live handle.';
      }
      button.addEventListener('click', () => { document.getElementById('shell').classList.add('work-open'); post({ type: 'work_panel', tab }); });
      box.appendChild(button);
    });
    const page = byId('work-page'); if (!page) return; page.textContent = '';
    const copy = {
      changes: ['Changes', 'Tracked and untracked files for this task workspace. Stage and commit stay in Code-OSS until a Caret review contract exists.', '', ''],
      terminal: ['Terminal', 'User PTY is separate from OMP tool output. Hide panel does not stop the process.', 'Open terminal', 'terminal'],
      browser: ['Browser', 'Unsupported until the OMP browser bridge advertises a live handle. No page was opened.', '', ''],
      preview: ['Preview', 'MIME-aware viewer. Failed builds keep last-good. Unknown MIME is download only.', '', ''],
      artifacts: ['Artifacts', 'Immutable receipts with hash and build id. Caret does not execute unknown MIME.', 'Open artifacts', 'artifacts'],
      files: ['Files', 'Code-OSS owns Explorer, search, LSP, and undo. Caret does not replace the editor.', 'Files & editor', 'files'],
    }[active] || ['Work', 'Open a resource for this task.', 'Files & editor', 'files'];
    const card = element('section', 'resource-card');
    card.appendChild(element('h3', '', copy[0]));
    card.appendChild(element('p', '', copy[1]));
    if (active === 'terminal') {
      const terms = state.terminals || [];
      const users = state.userPtys && state.userPtys.length ? state.userPtys : terms.filter((term) => term.kind === 'user');
      const agents = terms.filter((term) => term.kind !== 'user');
      card.appendChild(element('p', '', state.userPtyOpenReason || 'Opens a user PTY in Code-OSS. Hide panel does not stop the process. This work panel does not embed the shell.'));
      if (!terms.length && !users.length) card.appendChild(element('p', '', 'No OMP interaction log for this session yet. User PTY receipts appear here after Open user terminal.'));
      users.forEach((term) => {
        const cwd = term.cwd || 'cwd unknown';
        const status = term.status || (term.ended ? 'exited' : 'live');
        const row = element('div', 'term-row');
        row.appendChild(element('p', 'term-meta', (term.title || 'User terminal') + ' · ' + cwd + ' · ' + status + ' · user PTY, not OMP log'));
        const focus = element('button', 'ghost', 'Focus'); focus.type = 'button';
        focus.dataset.action = 'focus_user_pty';
        focus.dataset.ptyId = term.id;
        focus.title = state.userPtyFocusReason || 'Focus shows the Code-OSS terminal. Caret does not embed a second PTY renderer.';
        row.appendChild(focus);
        card.appendChild(row);
      });
      agents.forEach((term) => {
        const cwd = term.cwd || (state.session && state.session.cwd) || 'cwd unknown';
        const meta = element('p', 'term-meta', (term.title || 'OMP interaction') + ' · ' + cwd + ' · ' + (term.ended ? 'exited' : 'live') + (term.truncated ? ' · truncated' : '') + ' · agent log, not user shell');
        const log = element('pre', 'term-log', term.text || '');
        card.append(meta, log);
      });
      const openUser = element('button', 'ghost', 'Open user terminal'); openUser.type = 'button';
      openUser.title = state.userPtyOpenReason || 'Opens a user PTY in Code-OSS. Hide panel does not stop the process. This work panel does not embed the shell.';
      openUser.addEventListener('click', () => post({ type: 'native_action', action: 'terminal' }));
      card.appendChild(openUser);
    }
    if (active === 'preview') {
      const receipts = state.artifacts || [];
      const lastGood = state.lastGoodPreview;
      const retained = receipts.find((item) => item.retainedLastGood);
      if (retained) card.appendChild(element('p', '', 'Showing last-good. Current build is download only.'));
      if (lastGood) {
        card.appendChild(element('p', '', lastGood.header || 'Last-good preview'));
        card.appendChild(element('p', '', (lastGood.kind || 'unknown') + (lastGood.reason ? ' · ' + lastGood.reason : '') + (lastGood.viewer === 'download' ? ' · download only' : '')));
        const inline = state.inlinePreview || {};
        const frame = element('div', 'preview-frame', lastGood.viewer === 'inline' ? 'Inline preview reserved. File is not executed.' : 'Unknown MIME is download only. Caret will not execute this file.');
        if (inline.dataUrl && inline.kind === 'image') {
          const img = element('img', '');
          img.src = inline.dataUrl;
          img.alt = lastGood.header || 'Last-good preview';
          img.style.maxWidth = previewZoom > 1 ? 'none' : '100%';
          img.style.transform = previewZoom > 1 ? 'scale(' + previewZoom + ')' : 'none';
          const toolbar = element('div', 'preview-toolbar');
          ['Fit', 'Actual', 'Reset'].forEach((label) => {
            const button = element('button', 'ghost', label); button.type = 'button';
            button.addEventListener('click', () => {
              previewZoom = label === 'Actual' ? 2 : 1;
              img.style.transform = label === 'Actual' ? 'scale(2)' : 'none';
              img.style.maxWidth = label === 'Actual' ? 'none' : '100%';
            });
            toolbar.appendChild(button);
          });
          frame.textContent = '';
          card.appendChild(toolbar);
          frame.appendChild(img);
        } else if (inline.text && inline.kind === 'text') {
          frame.textContent = '';
          frame.appendChild(element('pre', '', inline.text));
        }
        card.appendChild(frame);
        if (retained && retained.incomingPreview) {
          const switchB = element('button', 'ghost', 'Switch to B'); switchB.type = 'button';
          switchB.title = 'Current build is download only. Caret will not execute it.';
          switchB.addEventListener('click', () => { text(frame, (retained.incomingPreview.header || 'Current build') + ' · download only. File is not executed.'); });
          card.appendChild(switchB);
        }
      } else if (!receipts.length) {
        card.appendChild(element('p', '', 'No captured receipts for this task. Preview stays MIME-aware and never executes.'));
      }
      receipts.forEach((item) => {
        const row = element('div', 'review-row');
        const preview = item.preview || {};
        row.appendChild(element('span', 'name', preview.header || item.name || item.sha256));
        row.appendChild(element('span', 'meta', (preview.kind || 'unknown') + (preview.reason ? ' · ' + preview.reason : '') + (item.retainedLastGood ? ' · last-good' : '') + (preview.viewer === 'download' ? ' · download only' : '')));
        if (item.sha256) {
          const download = element('button', 'ghost', 'Download'); download.type = 'button';
          download.addEventListener('click', () => post({ type: 'download_artifact', sha256: item.sha256 }));
          row.appendChild(download);
        }
        card.appendChild(row);
      });
    }
    if (active === 'artifacts') {
      if (state.artifactsError) card.appendChild(element('p', '', state.artifactsError));
      const types = ['all', 'image', 'text', 'audio', 'video', 'pdf', 'binary', 'unknown'];
      const filters = element('div', 'preview-toolbar');
      types.forEach((kind) => {
        const button = element('button', artifactTypeFilter === kind ? 'primary' : 'ghost', kind === 'all' ? 'All types' : kind); button.type = 'button';
        button.setAttribute('aria-pressed', artifactTypeFilter === kind ? 'true' : 'false');
        button.addEventListener('click', () => { artifactTypeFilter = kind; renderWorkTabs(); });
        filters.appendChild(button);
      });
      card.appendChild(filters);
      const receipts = (state.artifacts || []).filter((item) => {
        const preview = item.preview || {};
        return artifactTypeFilter === 'all' || preview.kind === artifactTypeFilter;
      });
      if (!receipts.length && !state.artifactsError) card.appendChild(element('p', '', (state.artifacts || []).length ? 'No artifacts match this type filter.' : 'No captured receipts for this task. Capture stays an explicit host action.'));
      receipts.forEach((item) => {
        const row = element('div', 'review-row');
        const preview = item.preview || {};
        row.appendChild(element('span', 'name', preview.header || item.name || item.sha256));
        row.appendChild(element('span', 'meta', (preview.kind || 'unknown') + (preview.reason ? ' · ' + preview.reason : '') + (preview.viewer === 'download' ? ' · download only' : '')));
        if (item.sha256) {
          const download = element('button', 'ghost', 'Download'); download.type = 'button';
          download.addEventListener('click', () => post({ type: 'download_artifact', sha256: item.sha256 }));
          row.appendChild(download);
        }
        card.appendChild(row);
      });
    }
    if (active === 'browser') {
      const chrome = element('div', 'browser-chrome');
      ['Back', 'Forward', 'Reload', 'Inspect', 'Console', 'Network'].forEach((label) => { const btn = element('button', 'ghost', label); btn.type = 'button'; btn.disabled = true; btn.title = 'Browser controls stay disabled until a live bridge handle exists.'; chrome.appendChild(btn); });
      const url = element('input'); url.type = 'text'; url.placeholder = 'No live browser handle'; url.disabled = true; url.setAttribute('aria-label', 'Browser URL'); chrome.appendChild(url);
      card.appendChild(chrome);
    }
    if (active === 'changes') {
      const review = state.review || {};
      const summary = review.summary || {};
      card.appendChild(element('p', '', (review.workspaceLabel || review.cwd || 'Folder') + (summary.total ? ' · ' + summary.total + ' files' : '') + (summary.plus || summary.minus ? ' · +' + (summary.plus || 0) + '/−' + (summary.minus || 0) : '')));
      if (review.stale) card.appendChild(element('p', '', review.staleReason || 'The file changed — reload the diff. Caret will not apply a stale hunk.'));
      if (review.dirtyConflict) card.appendChild(element('p', '', review.dirtyConflictReason || 'The file has unsaved edits. Caret will not apply a proposal over a dirty buffer.'));
      if (review.noGit) {
        card.appendChild(element('p', '', review.error || 'This folder is not a Git repository. Git setup is an explicit choice. Caret does not initialize a repository from this panel.'));
        if (!(review.proposals || []).length) card.appendChild(element('p', '', 'No advertised agent proposals for this folder. Caret does not invent hunks outside Git or OMP.'));
      }
      else if (review.error) card.appendChild(element('p', '', review.error));
      else if (!(review.files || []).length) card.appendChild(element('p', '', review.cwd ? 'No tracked or untracked changes in ' + review.cwd + '.' : 'Open a project to list task-scoped changes.'));
      (review.files || []).forEach((file) => {
        const row = element('button', 'review-row'); row.type = 'button';
        row.appendChild(element('span', 'mark', file.status === 'conflict' ? 'U' : (file.status === 'untracked' || !file.tracked ? '?' : (file.status === 'added' ? 'A' : (file.status === 'deleted' ? 'D' : (file.status === 'renamed' ? 'R' : 'M'))))));
        row.appendChild(element('span', 'name', file.path));
        row.appendChild(element('span', 'meta', (file.status || 'unknown') + (file.binaryHint ? ' · binary' : '') + (file.staged ? ' · staged' : '') + (file.unstaged ? ' · unstaged' : '')));
        row.addEventListener('click', () => post({ type: 'review_file', path: file.path }));
        card.appendChild(row);
        const native = element('button', 'ghost', 'Review in diff');
        native.type = 'button';
        native.title = 'Open this file in the Code-OSS diff editor against HEAD (Cmd+Alt+R).';
        native.addEventListener('click', (event) => { event.stopPropagation(); post({ type: 'native_diff', path: file.path }); });
        card.appendChild(native);
      });
      if (review.selectedPath) {
        card.appendChild(element('p', '', 'Selected · ' + review.selectedPath));
        const open = element('button', 'ghost', 'Open in IDE'); open.type = 'button';
        open.addEventListener('click', () => post({ type: 'open_workspace_file', path: review.selectedPath }));
        card.appendChild(open);
        const selected = (review.files || []).find((file) => file.path === review.selectedPath);
        if (selected && selected.status === 'conflict') {
          const merge = element('button', 'ghost', 'Open merge editor'); merge.type = 'button';
          merge.title = 'Conflict. Caret will not merge. Open the Code-OSS merge editor if Git advertised one.';
          merge.addEventListener('click', () => post({ type: 'open_merge_editor', path: review.selectedPath }));
          card.appendChild(merge);
        }
      }
      const bring = element('button', 'ghost', 'Bring back'); bring.type = 'button'; bring.disabled = true;
      bring.title = 'OMP has not advertised a checkpoint to restore. Caret will not invent a bring-back.';
      card.appendChild(bring);
      if (review.diffError) card.appendChild(element('p', '', review.diffError));
      const wide = window.innerWidth >= 900;
      (review.hunks || []).forEach((hunk) => {
        const block = element('div', 'hunk');
        block.appendChild(element('div', 'hunk-head', hunk.header || 'hunk'));
        if (wide) {
          const split = element('div', 'review-split');
          const left = []; const right = [];
          (hunk.lines || []).forEach((line) => {
            if (line.startsWith('+') && !line.startsWith('+++')) { left.push(' '); right.push(line); }
            else if (line.startsWith('-') && !line.startsWith('---')) { left.push(line); right.push(' '); }
            else { left.push(line); right.push(line); }
          });
          split.appendChild(element('pre', '', left.join('\n')));
          split.appendChild(element('pre', '', right.join('\n')));
          block.appendChild(split);
        } else {
          block.appendChild(element('pre', '', (hunk.lines || []).join('\n')));
        }
        card.appendChild(block);
      });
      const refresh = element('button', 'ghost', 'Refresh changes'); refresh.type = 'button';
      refresh.addEventListener('click', () => post({ type: 'refresh_review' }));
      card.appendChild(refresh);
      ['Apply proposal', 'Discard proposed hunk', 'Stage hunk', 'Unstage hunk'].forEach((label) => {
        const button = element('button', 'ghost', label); button.type = 'button'; button.disabled = true;
        button.title = review.dirtyConflict
          ? (review.dirtyConflictReason || 'The file has unsaved edits. Caret will not apply a proposal over a dirty buffer.')
          : 'Unavailable until OMP advertises a task-scoped review contract. Stage and commit stay in Code-OSS.';
        card.appendChild(button);
      });
      const commit = review.commit || {};
      const dialog = element('div', 'resource-card');
      dialog.appendChild(element('h3', '', 'Commit'));
      dialog.appendChild(element('p', '', 'Branch · ' + (commit.branch || review.workspaceLabel || 'Folder')));
      dialog.appendChild(element('p', '', 'Staged ' + String(commit.staged || 0) + ' · unstaged ' + String(commit.unstaged || 0) + ' not included'));
      const message = element('textarea'); message.rows = 3; message.placeholder = 'Commit message'; message.setAttribute('aria-label', 'Commit message');
      dialog.appendChild(message);
      const commitBtn = element('button', 'primary', 'Commit'); commitBtn.type = 'button'; commitBtn.disabled = true; commitBtn.title = commit.commitReason || 'Commit stays in Code-OSS until OMP advertises a task-scoped commit contract. Caret will not auto-push.';
      const pushBtn = element('button', 'ghost', 'Commit and Push'); pushBtn.type = 'button'; pushBtn.disabled = true; pushBtn.title = commit.pushReason || 'Commit and Push is a separate explicit action. No remote destination is advertised.';
      dialog.append(commitBtn, pushBtn);
      card.appendChild(dialog);
    }
    if (copy[2] && copy[3]) {
      const action = element('button', 'resource-action', copy[2]); action.type = 'button';
      action.addEventListener('click', () => post({ type: 'native_action', action: copy[3] }));
      card.appendChild(action);
    }
    (state.visibleResources || []).filter((item) => item.status === 'expired').forEach((item) => {
      card.appendChild(element('p', '', (item.label || item.id) + ' expired — Caret will not restart it automatically.'));
      const restart = element('button', 'resource-action', 'Restart'); restart.type = 'button';
      restart.addEventListener('click', () => post({ type: 'restart_resource', tab: item.tab }));
      card.appendChild(restart);
    });
    page.appendChild(card);
  }
  function applyLayout() {
    const shell = byId('shell');
    const sash = byId('work-sash');
    const prefs = presentationPrefs();
    const panel = state.workPanel || {};
    const layout = state.shellLayout || {};
    const position = prefs.panelPosition || panel.position || 'right';
    const width = layout.panelWidth || panel.preferredWidth || 360;
    const height = layout.panelHeight || panel.preferredHeight || 0;
    const sidebar = layout.sidebarWidth || prefs.sidebarWidth || 180;
    if (width) document.documentElement.style.setProperty('--caret-panel-w', width + 'px');
    if (height) document.documentElement.style.setProperty('--caret-panel-h', height + 'px');
    document.documentElement.style.setProperty('--caret-sidebar', sidebar + 'px');
    const fullRoute = layout.fullResourceRoute === true || (Boolean(panel.open) && window.innerHeight < 480);
    const workOpen = layout.workOpen === true || (Boolean(panel.open) && !fullRoute);
    if (shell) {
      shell.classList.toggle('work-open', workOpen);
      shell.classList.toggle('resource-route', fullRoute);
      shell.classList.toggle('work-bottom', layout.workBottom === true || (position === 'bottom' && !fullRoute));
      const drawer = layout.sidebarDrawer === true;
      shell.classList.toggle('sidebar-drawer', drawer);
      if (!drawer) shell.classList.remove('sidebar-open');
      shell.classList.toggle('sidebar-closed', layout.sidebarHidden === true && !drawer);
      shell.classList.toggle('density-detailed', prefs.density === 'detailed');
      shell.classList.toggle('need-more-space', layout.needMoreSpace === true);
      shell.classList.toggle('high-contrast', prefs.highContrast === true);
    }
    const spaceNote = byId('space-note');
    if (spaceNote) {
      spaceNote.hidden = layout.needMoreSpace !== true;
      spaceNote.textContent = '';
      if (layout.needMoreSpace === true) {
        spaceNote.appendChild(element('div', '', 'Need more space to split this task. Widen the window past 720px.'));
        const actions = element('div', 'space-note-actions');
        const maximize = element('button', 'ghost', 'Maximize area'); maximize.type = 'button';
        maximize.dataset.action = 'maximize_area';
        const other = element('button', 'ghost', 'Open another window'); other.type = 'button';
        other.dataset.action = 'open_another_window';
        actions.append(maximize, other);
        spaceNote.appendChild(actions);
      }
    }
    const projectsDrawer = byId('projects-drawer');
    if (projectsDrawer) projectsDrawer.hidden = layout.sidebarDrawer !== true;
    const back = document.querySelector('[data-action="back_to_task"]');
    if (back) back.hidden = !fullRoute;
    const motion = state.motion || {};
    const reduced = prefs.reduceMotion === true;
    const setMs = (name, value, fallback) => { document.documentElement.style.setProperty(name, String(reduced ? 0 : (value == null ? fallback : value)) + 'ms'); };
    // Fallbacks mirror the CSS token block and DEFAULT_MOTION_TOKENS
    // (ui-a11y.ts), which follow the reference product's motion scale.
    setMs('--caret-motion-instant', motion.instant, 50);
    setMs('--caret-motion-feedback', motion.feedback, 100);
    setMs('--caret-motion-surface-in', motion.surfaceIn, 150);
    setMs('--caret-motion-surface-out', motion.surfaceOut, 100);
    setMs('--caret-motion-drawer-in', motion.drawerIn, 200);
    setMs('--caret-motion-drawer-out', motion.drawerOut, 150);
    document.documentElement.classList.toggle('reduce-motion', reduced);
    if (sash) sash.setAttribute('aria-orientation', position === 'bottom' ? 'horizontal' : 'vertical');
    const dock = document.querySelector('[data-action="dock_panel"]');
    if (dock) text(dock, position === 'bottom' ? 'Dock right' : 'Dock bottom');
    if (prefs.density === 'detailed') (state.transcript || []).filter((entry) => entry.kind === 'tool').forEach((entry) => expandedTools.add(entry.id));
  }
  function bindSash() {
    const sash = byId('work-sash');
    if (!sash || sash.dataset.bound === '1') return;
    sash.dataset.bound = '1';
    let start = 0; let startW = 360; let startH = 240; let vertical = false;
    const onMove = (event) => {
      if (vertical) document.documentElement.style.setProperty('--caret-panel-h', Math.max(160, startH + (start - event.clientY)) + 'px');
      else document.documentElement.style.setProperty('--caret-panel-w', Math.max(280, Math.min(640, startW + (start - event.clientX))) + 'px');
    };
    const onUp = (event) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (vertical) post({ type: 'work_panel_layout', preferredHeight: Math.max(160, startH + (start - event.clientY)) });
      else post({ type: 'work_panel_layout', preferredWidth: Math.max(280, Math.min(640, startW + (start - event.clientX))) });
    };
    sash.addEventListener('pointerdown', (event) => {
      const panel = state.workPanel || {};
      const prefs = state.prefs || {};
      vertical = (prefs.panelPosition || panel.position) === 'bottom';
      start = vertical ? event.clientY : event.clientX;
      startW = panel.preferredWidth || 360;
      startH = panel.preferredHeight || Math.round(window.innerHeight * 0.4);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
    window.addEventListener('resize', () => { applyLayout(); post({ type: 'viewport', width: window.innerWidth, height: window.innerHeight }); });
    sash.addEventListener('keydown', (event) => {
      const panel = state.workPanel || {};
      const prefs = state.prefs || {};
      const bottom = (prefs.panelPosition || panel.position) === 'bottom';
      let delta = 0;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') delta = -16;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') delta = 16;
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        if (bottom) post({ type: 'work_panel_layout', preferredHeight: event.key === 'Home' ? 160 : Math.round(window.innerHeight * 0.6) });
        else post({ type: 'work_panel_layout', preferredWidth: event.key === 'Home' ? 280 : 640 });
        return;
      }
      if (!delta) return;
      event.preventDefault();
      if (bottom) post({ type: 'work_panel_layout', preferredHeight: Math.max(160, (panel.preferredHeight || 240) - (event.key === 'ArrowDown' ? 16 : -16)) });
      else post({ type: 'work_panel_layout', preferredWidth: Math.max(280, Math.min(640, (panel.preferredWidth || 360) + (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 16 : -16))) });
    });
  }
  function bindSidebarSash() {
    const sash = byId('sidebar-sash');
    if (!sash || sash.dataset.bound === '1') return;
    sash.dataset.bound = '1';
    let start = 0; let startW = 180;
    const onMove = (event) => {
      document.documentElement.style.setProperty('--caret-sidebar', Math.max(160, Math.min(360, startW + (event.clientX - start))) + 'px');
    };
    const onUp = (event) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      post({ type: 'work_panel_layout', preferredSidebarWidth: Math.max(160, Math.min(360, startW + (event.clientX - start))) });
    };
    sash.addEventListener('pointerdown', (event) => {
      start = event.clientX;
      startW = (state.prefs && state.prefs.sidebarWidth) || 180;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
    sash.addEventListener('keydown', (event) => {
      let delta = 0;
      if (event.key === 'ArrowLeft') delta = -16;
      if (event.key === 'ArrowRight') delta = 16;
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        post({ type: 'work_panel_layout', preferredSidebarWidth: event.key === 'Home' ? 160 : 360 });
        return;
      }
      if (!delta) return;
      event.preventDefault();
      post({ type: 'work_panel_layout', preferredSidebarWidth: Math.max(160, Math.min(360, ((state.prefs && state.prefs.sidebarWidth) || 180) + delta)) });
    });
  }
  function renderRouteError() {
    const page = byId('route-error');
    if (!page) return;
    const err = state.routeError;
    if (!err) { page.classList.remove('open'); page.setAttribute('hidden', ''); return; }
    page.classList.add('open');
    page.removeAttribute('hidden');
    text(byId('route-error-title'), err.title || 'This task is gone');
    text(byId('route-error-body'), err.body || 'This task is missing. Caret will not open a different task.');
    const btn = byId('route-error-primary');
    if (btn) { text(btn, err.primaryLabel || 'Projects'); btn.dataset.routeAction = err.primary || 'projects'; }
  }
  function closeTaskActions() {
    const menu = byId('more-menu');
    if (menu) menu.hidden = true;
    taskActionsOpen = false;
    const trigger = taskActionsTrigger || document.querySelector('[data-action="task_actions"]');
    if (trigger) { trigger.setAttribute('aria-expanded', 'false'); if (taskActionsTrigger) trigger.focus(); }
    taskActionsTrigger = null;
  }
  function renderMoreMenu() {
    const menu = byId('more-menu');
    if (!menu) return;
    const shouldOpen = taskActionsOpen;
    menu.textContent = '';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Task actions');
    (state.moreActions || []).forEach((item) => {
      const button = element('button', '', item.label || item.id); button.type = 'button';
      button.setAttribute('role', 'menuitem');
      button.disabled = item.enabled === false;
      if (item.reason) button.title = item.reason;
      button.dataset.action = 'more_action';
      button.dataset.moreId = item.id;
      menu.appendChild(button);
    });
    if (!(state.moreActions || []).length) {
      const empty = element('div', 'menu-empty', 'No additional task actions are available.');
      empty.setAttribute('role', 'status');
      menu.appendChild(empty);
    }
    const pair = element('button', '', 'Connect your iPhone'); pair.type = 'button';
    pair.setAttribute('role', 'menuitem');
    pair.dataset.action = 'native';
    pair.dataset.nativeAction = 'pair';
    const settings = element('button', '', 'Settings'); settings.type = 'button';
    settings.setAttribute('role', 'menuitem');
    settings.dataset.action = 'show_settings';
    settings.dataset.section = 'Devices/connections';
    menu.append(pair, settings);
    if (!menu.childElementCount) {
      const empty = element('div', 'menu-empty', 'No extra task actions are available for this task.');
      empty.setAttribute('role', 'status');
      menu.appendChild(empty);
    }
    menu.hidden = !shouldOpen;
  }
  function renderWorktreeReceipt() {
    const note = byId('worktree-receipt');
    if (!note) return;
    const receipt = state.worktreeReceipt || {};
    const copy = receipt.status === 'creating' ? 'Creating worktree\u2026'
      : receipt.status === 'ready' ? 'Worktree ready.'
      : receipt.status === 'failed' ? ('Worktree failed. ' + (receipt.reason || ''))
      : receipt.status === 'cancelled' ? (receipt.reason || 'Cancelled. No worktree was created.')
      : '';
    note.textContent = '';
    if (!copy) { note.hidden = true; return; }
    note.hidden = false;
    note.appendChild(element('p', '', copy));
    if (receipt.status === 'creating') {
      const cancel = element('button', 'ghost', 'Cancel'); cancel.type = 'button';
      cancel.addEventListener('click', () => post({ type: 'cancel_worktree' }));
      note.appendChild(cancel);
    }
  }
  function renderDestinations() {
    const menu = byId('destination-menu');
    if (!menu) return;
    renderWorktreeReceipt();
    if (menu.dataset.form === 'worktree') return;
    menu.textContent = '';
    const rows = state.destinations || [];
    let lastGroup = '';
    rows.forEach((item) => {
      if (item.groupLabel && item.groupLabel !== lastGroup) {
        lastGroup = item.groupLabel;
        menu.appendChild(element('div', 'destination-group', item.groupLabel));
      }
      const button = element('button', '', item.label + (item.current ? ' · current' : '')); button.type = 'button';
      button.disabled = !item.enabled || item.current;
      button.title = item.reason || item.label;
      if (item.enabled && !item.current && item.id === 'ws-worktree') button.addEventListener('click', () => renderWorktreeForm());
      else if (item.enabled && !item.current) button.addEventListener('click', () => { post({ type: 'select_destination', id: item.id }); menu.hidden = true; });
      menu.appendChild(button);
    });
  }
  function renderWorktreeForm() {
    const menu = byId('destination-menu');
    if (!menu) return;
    menu.hidden = false;
    menu.dataset.form = 'worktree';
    menu.textContent = '';
    const meta = state.headerMeta || {};
    const repo = (state.project && (state.project.path || state.project.name)) || 'Current folder';
    const base = meta.branch || (state.project && state.project.branch) || state.gitBranch || 'HEAD';
    menu.appendChild(element('div', 'destination-group', 'New worktree'));
    menu.appendChild(element('p', '', 'Repository · ' + repo));
    menu.appendChild(element('p', '', 'Base ref · ' + base));
    menu.appendChild(element('p', '', 'Destination · This Mac. Dirty source copies the current Git working state.'));
    menu.appendChild(element('p', '', 'OMP names the worktree branch. Custom branch names are not advertised.'));
    const create = element('button', 'primary', 'Create worktree'); create.type = 'button';
    create.addEventListener('click', () => { post({ type: 'create_worktree' }); delete menu.dataset.form; menu.hidden = true; });
    const cancel = element('button', 'ghost', 'Cancel'); cancel.type = 'button';
    cancel.addEventListener('click', () => { post({ type: 'cancel_worktree' }); delete menu.dataset.form; menu.hidden = true; });
    menu.append(create, cancel);
  }
  function renderBranchMenu() {
    const menu = byId('branch-menu');
    if (!menu) return;
    menu.textContent = '';
    const meta = state.headerMeta || {};
    const branch = state.draftBranchRef || meta.branch || (state.project && state.project.branch) || state.gitBranch || '';
    const rows = state.branches || [];
    menu.appendChild(element('div', 'destination-group', 'Branch'));
    menu.appendChild(element('p', '', branch ? ('Current · ' + branch + '. Selecting a ref targets the new draft. Caret will not checkout until you confirm a workspace workflow.') : 'No Git branch until the folder has a repository. New worktree stays unavailable.'));
    const search = element('input', '');
    search.type = 'search';
    search.setAttribute('aria-label', 'Search branches');
    search.placeholder = 'Search local and remote refs';
    const list = element('div', 'search-hits');
    const empty = element('p', 'search-empty', 'No matching refs. Refresh to reload advertised local and remote names.');
    empty.hidden = true;
    const paint = (query) => {
      list.textContent = '';
      const needle = String(query || '').trim().toLowerCase();
      const hits = needle ? rows.filter((item) => String(item.name || '').toLowerCase().includes(needle)) : rows;
      empty.hidden = !(needle && !hits.length);
      hits.forEach((item) => {
        const button = element('button', '', item.name + (item.current ? ' · current' : '') + (item.kind === 'remote' ? ' · remote' : item.kind === 'local' ? ' · local' : ''));
        button.type = 'button';
        button.disabled = item.name === (state.draftBranchRef || branch);
        button.addEventListener('click', () => { post({ type: 'select_branch_ref', ref: item.name }); menu.hidden = true; });
        list.appendChild(button);
      });
    };
    search.addEventListener('input', () => paint(search.value));
    search.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (!rows.length || search.dataset.loading === 'true') return;
    });
    paint('');
    const refresh = element('button', '', 'Refresh'); refresh.type = 'button';
    refresh.addEventListener('click', () => post({ type: 'refresh_branch' }));
    menu.append(search, list, empty, refresh);
  }
  function applyTranscriptFind() {
    const input = byId('transcript-find');
    const count = byId('transcript-find-count');
    const query = input && input.value ? String(input.value).trim() : findQuery;
    findQuery = query;
    const marks = [];
    if (query) {
      const box = byId('transcript');
      if (box) {
        const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        const lowerQuery = query.toLowerCase();
        nodes.forEach((textNode) => {
          const value = textNode.nodeValue || '';
          const lower = value.toLowerCase();
          let from = 0;
          let idx = lower.indexOf(lowerQuery);
          if (idx < 0) return;
          const frag = document.createDocumentFragment();
          while (idx >= 0) {
            if (idx > from) frag.appendChild(document.createTextNode(value.slice(from, idx)));
            const mark = element('mark', 'find-hit', value.slice(idx, idx + query.length));
            marks.push(mark);
            frag.appendChild(mark);
            from = idx + query.length;
            idx = lower.indexOf(lowerQuery, from);
          }
          if (from < value.length) frag.appendChild(document.createTextNode(value.slice(from)));
          if (textNode.parentNode) textNode.parentNode.replaceChild(frag, textNode);
        });
      }
    }
    if (marks.length) {
      if (findIndex >= marks.length) findIndex = 0;
      marks.forEach((mark, index) => { if (index === findIndex) mark.classList.add('current'); });
      marks[findIndex].scrollIntoView({ block: 'nearest' });
    } else {
      findIndex = 0;
    }
    if (count) text(count, query ? (marks.length ? String(findIndex + 1) + ' of ' + marks.length : 'No matches') : '');
  }
  function openTranscriptFind() {
    const bar = byId('transcript-find-bar');
    if (!bar) return;
    bar.hidden = false;
    const input = byId('transcript-find');
    if (input) { input.focus(); input.select(); }
  }
  function renderProjectsRoute() {
    const route = byId('projects-route');
    if (!route) return;
    const open = state.routeKind === 'projects';
    route.classList.toggle('open', open);
    if (open) route.removeAttribute('hidden');
    else route.setAttribute('hidden', '');
    const back = byId('route-back');
    const forward = byId('route-forward');
    if (back) { back.disabled = state.canRouteBack !== true; back.title = state.canRouteBack ? 'Back to the previous view. This does not undo agent work.' : 'No previous view.'; }
    if (forward) { forward.disabled = state.canRouteForward !== true; forward.title = state.canRouteForward ? 'Forward to the next view. This does not replay agent work.' : 'No next view.'; }
    const page = byId('projects-route-page');
    if (!page || !open) return;
    page.textContent = '';
    const welcome = state.welcome || {};
    page.appendChild(element('p', 'welcome-kicker', welcome.kicker || 'PROJECTS'));
    page.appendChild(element('h2', 'welcome-title', welcome.title || 'Projects'));
    page.appendChild(element('p', '', 'Open a folder or a recent path. This route does not start a run.'));
    (welcome.actions || []).forEach((item) => {
      const button = element('button', 'ghost', item.label || item.id);
      button.type = 'button';
      button.disabled = item.enabled === false;
      if (item.reason) button.title = item.reason;
      if (item.id === 'open_folder') button.dataset.action = 'open_folder';
      else if (item.id === 'new_task') button.dataset.action = 'new_task';
      else button.dataset.action = 'welcome_clone';
      page.appendChild(button);
    });
    (welcome.recents || []).forEach((recent) => {
      const button = element('button', 'nav-row', recent.name || recent.path || 'Folder');
      button.type = 'button';
      button.disabled = recent.openable === false;
      if (recent.reason) button.title = recent.reason;
      if (recent.openable !== false && recent.path) {
        button.dataset.action = 'open_recent';
        button.dataset.recentPath = recent.path;
      }
      page.appendChild(button);
    });
  }
  function render() { applyLayout(); bindSash(); bindSidebarSash(); renderStatus(); renderPinned(); renderProjects(); renderSessions(); renderSearch(); renderTranscript(); renderUiRequests(); renderModels(); renderThinking(); renderLogin(); renderSlash(); renderPresentations(); renderCatalog(); renderComposer(); renderPlan(); renderAttachments(); renderWorkTabs(); renderRouteError(); renderMoreMenu(); renderProjectsRoute(); const draft = byId('composer-input'); if (draft && draft.value !== state.draft) { if (document.activeElement !== draft || (state.draft === '' && draft.value === lastSentDraft)) { draft.value = state.draft || ''; if (state.draft === '') lastSentDraft = ''; } } if (draft) renderMentions(draft.value); }
  function activateSearchHit(kind, id) {
    if (kind === 'select_session') post({ type: 'select_session', sessionId: id });
    else if (kind === 'open_file') post({ type: 'open_workspace_file', path: id });
    else if (kind === 'open_settings') openSettings(id);
    else if (kind === 'run_action' && id === 'new_task') post({ type: 'new_task' });
    else if (kind === 'run_action' && id === 'pair') post({ type: 'native_action', action: 'pair' });
    else if (kind === 'run_action' && id === 'ide') post({ type: 'set_workbench_mode', mode: 'ide' });
    else if (kind === 'run_action' && id === 'agents') post({ type: 'set_workbench_mode', mode: 'agents' });
    else if (kind === 'run_action' && id === 'settings') openSettings();
    else if (kind === 'run_action' && id === 'find_in_transcript') openTranscriptFind();
  }
  function readyAttachmentCount() {
    return (state.attachments || []).filter((item) => item && item.state === 'ready' && item.contentRef).length;
  }
  function send(kind) {
    const input = byId('composer-input');
    const value = input.value;
    const controls = state.composer || {};
    if (kind === 'send_prompt' && controls.primary === 'choose_project') { post({ type: 'open_folder' }); return; }
    if (kind === 'send_prompt' && controls.primary === 'check_status') { post({ type: 'inspect_outcome' }); return; }
    if (kind === 'steer') { if (controls.steerEnabled !== true) return; }
    else if (controls.primaryEnabled !== true) return;
    if (!value.trim() && !readyAttachmentCount()) return;
    lastSentDraft = value;
    post({ type: kind, text: value });
  }
  root.addEventListener('click', (event) => { const target = event.target.closest('[data-action]'); if (target) { const action = target.dataset.action; if (action === 'task_actions') { const menu = byId('more-menu'); if (menu) { const opening = !taskActionsOpen; if (!opening) { closeTaskActions(); } else { taskActionsOpen = true; taskActionsTrigger = target; target.setAttribute('aria-expanded', 'true'); renderMoreMenu(); const first = menu.querySelector('button:not([disabled])') || menu.querySelector('button'); if (first) first.focus(); } } } else if (action === 'more_action') { closeTaskActions(); post({ type: 'more_action', id: target.dataset.moreId }); } else if (action === 'new_task') post({ type: 'new_task' }); else if (action === 'open_folder') { persistDraftNow(); post({ type: 'open_folder' }); } else if (action === 'open_session') { closeSidebarDrawer(); post({ type: 'select_session', sessionId: target.dataset.sessionId }); } else if (action === 'session_menu') openSessionRowMenu(target.dataset.sessionId, target.dataset.pinned === 'true', target.dataset.archived === 'true'); else if (action === 'session_action') { const menu = byId('session-row-menu'); if (menu) menu.hidden = true; const sid = target.dataset.sessionId; const kind = target.dataset.sessionAction; if (kind === 'open_in_split') post({ type: 'open_in_split', sessionId: sid }); else if (kind === 'rename') post({ type: 'rename_session', sessionId: sid }); else if (kind === 'archive') post({ type: 'archive_session', sessionId: sid, archived: true }); else if (kind === 'restore') post({ type: 'archive_session', sessionId: sid, archived: false }); else if (kind === 'pin') post({ type: 'pin_session', sessionId: sid, pinned: true }); else if (kind === 'unpin') post({ type: 'pin_session', sessionId: sid, pinned: false }); } else if (action === 'clear_search') { const search = byId('task-search'); if (search) search.value = ''; post({ type: 'search', query: '', scope: 'all' }); if (search) search.focus(); } else if (action === 'maximize_area') { const shell = document.getElementById('shell'); if (shell) { shell.classList.add('sidebar-closed'); shell.classList.remove('work-open', 'sidebar-open'); } post({ type: 'more_action', id: 'maximize_area' }); } else if (action === 'open_another_window') post({ type: 'more_action', id: 'open_ide_new_window' }); else if (action === 'refresh') post({ type: 'refresh' }); else if (action === 'stop') post({ type: 'stop' }); else if (action === 'steer') send('steer'); else if (action === 'follow_up') send('follow_up'); else if (action === 'get_models') post({ type: 'get_models' }); else if (action === 'get_login_providers') post({ type: 'get_login_providers' }); else if (action === 'get_slash_commands') post({ type: 'get_slash_commands' }); else if (action === 'compact') post({ type: 'compact' }); else if (action === 'set_mode') post({ type: 'set_workbench_mode', mode: target.dataset.mode }); else if (action === 'jump_latest') post({ type: 'jump_latest' }); else if (action === 'toggle_plus') { const menu = byId('plus-menu'); menu.hidden = !menu.hidden; target.setAttribute('aria-expanded', menu.hidden ? 'false' : 'true'); } else if (action === 'prefill') { const input = byId('composer-input'); input.value = (target.dataset.text || '') + (input.value || ''); state.draft = input.value; post({ type: 'persist_draft', draft: input.value }); input.focus(); byId('plus-menu').hidden = true; } else if (action === 'show_projects') { closeSidebarDrawer(); post({ type: 'navigate_projects' }); } else if (action === 'route_back') post({ type: 'route_back' }); else if (action === 'route_forward') post({ type: 'route_forward' }); else if (action === 'toggle_sidebar') { const shell = document.getElementById('shell'); if (shell.classList.contains('sidebar-drawer')) shell.classList.toggle('sidebar-open'); else shell.classList.toggle('sidebar-closed'); } else if (action === 'open_work_panel') { document.getElementById('shell').classList.add('work-open'); post({ type: 'work_panel', tab: target.dataset.tab || (state.workPanel && state.workPanel.activeTab) || 'changes' }); } else if (action === 'close_work_panel' || action === 'back_to_task') { document.getElementById('shell').classList.remove('work-open'); document.getElementById('shell').classList.remove('resource-route'); post({ type: 'close_work_panel' }); } else if (action === 'dock_panel') { const prefs = presentationPrefs(); const next = (prefs.panelPosition || (state.workPanel && state.workPanel.position) || 'right') === 'bottom' ? 'right' : 'bottom'; post({ type: 'set_pref', key: 'panelPosition', value: next }); } else if (action === 'show_settings') { closeTaskActions(); openSettings(target.dataset.section || settingsSection); } else if (action === 'close_settings') closeSettings(); else if (action === 'pick_attachments') { post({ type: 'pick_attachments' }); byId('plus-menu').hidden = true; } else if (action === 'restore_sent_draft') { post({ type: 'restore_sent_draft' }); } else if (action === 'create_draft') { const query = (byId('task-search').value || '').trim(); if (!query) return; const input = byId('composer-input'); input.value = query; state.draft = query; post({ type: 'persist_draft', draft: query }); input.focus(); } else if (action === 'search_scope') post({ type: 'search', query: byId('task-search').value || '', scope: target.dataset.scope }); else if (action === 'search_hit') activateSearchHit(target.dataset.hitAction, target.dataset.hitId); else if (action === 'route_error_action') post({ type: 'route_error_action', action: target.dataset.routeAction || 'back' }); else if (action === 'open_recent') { if (target.dataset.recentPath) post({ type: 'open_recent', path: target.dataset.recentPath }); } else if (action === 'focus_user_pty') { if (target.dataset.ptyId) post({ type: 'focus_user_pty', id: target.dataset.ptyId }); } else if (action === 'focus_pane') { if (target.dataset.viewId) post({ type: 'focus_pane', viewId: target.dataset.viewId }); } else if (action === 'pop_to_ide') post({ type: 'pop_to_ide', tab: (state.workPanel && state.workPanel.activeTab) || 'changes' }); else if (action === 'welcome_clone') { /* clone stays unavailable until advertised */ } else if (action === 'native') { const menu = byId('more-menu'); if (menu) menu.hidden = true; if (target.dataset.nativeAction === 'files') persistDraftNow(); if (target.dataset.nativeAction === 'settings') openSettings(); else post({ type: 'native_action', action: target.dataset.nativeAction }); } } const project = event.target.closest('[data-project-id]'); if (project) post({ type: 'select_project', projectId: project.dataset.projectId }); });
  let draftTimer = 0;
  function persistDraftNow() {
    const input = byId('composer-input');
    const value = input ? input.value : (state.draft || '');
    state.draft = value;
    if (draftTimer) { clearTimeout(draftTimer); draftTimer = 0; }
    post({ type: 'persist_draft', draft: value });
  }
  function persistDraftSoon(value) {
    state.draft = value;
    if (draftTimer) clearTimeout(draftTimer);
    draftTimer = setTimeout(() => { post({ type: 'persist_draft', draft: value }); draftTimer = 0; }, 300);
  }
  byId('send').addEventListener('click', () => { const controls = state.composer || {}; send(controls.sendIntent === 'follow_up' ? 'follow_up' : 'send_prompt'); }); byId('composer-input').addEventListener('compositionstart', () => { composing = true; }); byId('composer-input').addEventListener('compositionend', () => { composing = false; applyEmptyHome(); }); byId('composer-input').addEventListener('input', (event) => { persistDraftSoon(event.target.value); renderMentions(event.target.value); });
  byId('composer-input').addEventListener('blur', () => { if (draftTimer) { clearTimeout(draftTimer); draftTimer = 0; } post({ type: 'persist_draft', draft: byId('composer-input').value }); });
  byId('composer-input').addEventListener('paste', (event) => {
    const pasted = event.clipboardData && event.clipboardData.getData('text');
    if (!pasted || pasted.length <= 16384) return;
    event.preventDefault();
    const keep = window.confirm('Pasted text is larger than 16KiB. OK keeps it as text. Cancel leaves the clipboard and draft unchanged. Attach as file is unavailable until the host advertises upload.');
    if (!keep) return;
    const input = byId('composer-input');
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    input.value = input.value.slice(0, start) + pasted + input.value.slice(end);
    persistDraftSoon(input.value);
  });
  const envPill = byId('pill-env');
  if (envPill) envPill.addEventListener('click', () => {
    const menu = byId('destination-menu');
    const branchMenu = byId('branch-menu');
    if (branchMenu) branchMenu.hidden = true;
    if (menu) menu.hidden = !menu.hidden;
  });
  const branchPill = byId('pill-branch');
  if (branchPill) branchPill.addEventListener('click', () => {
    const menu = byId('branch-menu');
    const dest = byId('destination-menu');
    if (dest) dest.hidden = true;
    if (menu) { menu.hidden = !menu.hidden; if (!menu.hidden) renderBranchMenu(); }
  });
  const findInput = byId('transcript-find');
  if (findInput) findInput.addEventListener('input', () => { findIndex = 0; renderTranscript(); });
  const findPrev = byId('transcript-find-prev');
  if (findPrev) findPrev.addEventListener('click', () => { findIndex = findIndex <= 0 ? 0 : findIndex - 1; renderTranscript(); });
  const findNext = byId('transcript-find-next');
  if (findNext) findNext.addEventListener('click', () => { findIndex += 1; renderTranscript(); });
  const settingsSelect = byId('settings-section-select');
  if (settingsSelect) settingsSelect.addEventListener('change', (event) => openSettings(event.target.value));
  root.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
      event.preventDefault();
      openTranscriptFind();
    }
  });
  function renderMentions(value) {
    const menu = byId('mention-menu'); if (!menu) return;
    const at = value.lastIndexOf('@');
    const slash = value.lastIndexOf('/');
    const tokenAt = at >= 0 && (at === 0 || /\s/.test(value[at - 1])) ? value.slice(at + 1) : '';
    const tokenSlash = slash >= 0 && (slash === 0 || /\s/.test(value[slash - 1])) ? value.slice(slash + 1).split(/\s/)[0] : '';
    menu.textContent = '';
    if (slash >= 0 && (tokenSlash !== '' || slash === value.length - 1) && !tokenSlash.includes('\n')) {
      if (!(state.slashCommands || []).length) post({ type: 'get_slash_commands' });
      (state.slashCommands || []).filter((item) => !tokenSlash || item.name.toLowerCase().includes(tokenSlash.toLowerCase())).slice(0, 8).forEach((item) => {
        const button = element('button', '', '/' + item.name + (item.description ? ' — ' + item.description : '')); button.type = 'button';
        button.addEventListener('click', () => { const input = byId('composer-input'); input.value = value.slice(0, slash) + '/' + item.name + ' '; state.draft = input.value; post({ type: 'persist_draft', draft: input.value }); menu.hidden = true; input.focus(); });
        menu.appendChild(button);
      });
      menu.hidden = menu.childElementCount === 0;
      return;
    }
    if (at >= 0 && !tokenAt.includes(' ') && !tokenAt.includes('\n')) {
      if (tokenAt && tokenAt !== lastMentionQuery) { lastMentionQuery = tokenAt; post({ type: 'search', query: tokenAt, scope: 'files' }); }
      if (!tokenAt) lastMentionQuery = '';
      const needle = tokenAt.toLowerCase();
      const rows = (state.mentions || []).filter((item) => !needle || (item.label || '').toLowerCase().includes(needle) || item.kind === 'selection' || item.kind === 'logs');
      (rows.length ? rows : (state.sessions || []).map((item) => ({ id: item.id, kind: 'session', label: item.title || item.id, insert: '@' + (item.title || item.id), enabled: true, action: 'insert' }))).slice(0, 12).forEach((item) => {
        const button = element('button', '', item.label + (item.reason ? ' — ' + item.reason : '')); button.type = 'button';
        button.disabled = item.enabled === false;
        if (item.reason) button.title = item.reason;
        button.addEventListener('click', () => {
          post({ type: 'mention_pick', kind: item.kind || 'session', id: item.id });
          if (item.action === 'open_work_tab') { menu.hidden = true; return; }
          if (item.enabled === false) return;
          const input = byId('composer-input');
          input.value = value.slice(0, at) + (item.insert || ('@' + item.label)) + ' ';
          state.draft = input.value;
          post({ type: 'persist_draft', draft: input.value });
          menu.hidden = true;
          input.focus();
        });
        menu.appendChild(button);
      });
      menu.hidden = menu.childElementCount === 0;
      return;
    }
    menu.hidden = true;
  }
  const transcriptWrap = byId('transcript-wrap');
  if (transcriptWrap) transcriptWrap.addEventListener('scroll', () => {
    const followLatest = transcriptWrap.scrollHeight - transcriptWrap.scrollTop - transcriptWrap.clientHeight < 48;
    const last = (state.transcript || [])[(state.transcript || []).length - 1];
    post({ type: 'persist_scroll', offset: transcriptWrap.scrollTop, followLatest, eventId: last && last.id });
  }); byId('composer-input').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const controls = state.composer || {};
    const prefs = presentationPrefs();
    const submitEnter = prefs.submitEnter !== false;
    const metaKey = event.metaKey || event.ctrlKey;
    let intent = 'ignore';
    if (composing || event.isComposing) intent = 'ignore';
    else if (event.shiftKey) intent = 'newline';
    else if (!submitEnter) {
      if (!metaKey) intent = 'newline';
      else if (controls.primary === 'send' && controls.primaryEnabled) intent = 'send';
      else if (controls.primary === 'queue' && controls.primaryEnabled) intent = 'queue';
    } else if (metaKey) intent = controls.queueEnabled ? 'queue' : 'newline';
    else if (controls.primary === 'send' && controls.primaryEnabled) intent = 'send';
    else if (controls.primary === 'queue' && controls.primaryEnabled) intent = 'queue';
    if (intent === 'newline' || intent === 'ignore') { if (intent === 'ignore' && !event.shiftKey) event.preventDefault(); return; }
    event.preventDefault();
    send(intent === 'queue' ? 'follow_up' : 'send_prompt');
  }); byId('model-select').addEventListener('change', (event) => { const option = event.target.selectedOptions[0]; if (option && option.value) post({ type: 'select_model', modelId: option.value }); });
  const thinkingSelect = byId('thinking-select');
  if (thinkingSelect) thinkingSelect.addEventListener('change', (event) => { const option = event.target.selectedOptions[0]; if (option && option.value) post({ type: 'select_thinking_level', level: option.value }); });
  const reviewReq = byId('review-request');
  if (reviewReq) reviewReq.addEventListener('click', () => {
    const first = [...uiControls.values()][0];
    if (first && first.dangerous && first.cancel) { first.cancel.focus(); return; }
    const card = document.querySelector('#ui-requests .ui-card');
    if (card && typeof card.focus === 'function') { card.setAttribute('tabindex', '-1'); card.focus(); }
  });
  const taskSearch = byId('task-search');
  let searchTimer = 0;
  let searchComposing = false;
  const postSearch = () => { post({ type: 'search', query: taskSearch ? taskSearch.value : '', scope: (state.search && state.search.scope) || 'all' }); };
  if (taskSearch) {
    taskSearch.addEventListener('compositionstart', () => { searchComposing = true; });
    taskSearch.addEventListener('compositionend', () => {
      searchComposing = false;
      syncSearching();
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(postSearch, 150);
    });
    taskSearch.addEventListener('input', () => {
      syncSearching();
      if (searchComposing) return;
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(postSearch, 150);
    });
    taskSearch.addEventListener('focus', syncSearching);
    taskSearch.addEventListener('blur', () => window.setTimeout(syncSearching, 0));
    taskSearch.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.isComposing) return;
      event.preventDefault();
      const search = state.search || {};
      if (search.noMatch || search.updating || !(search.hits && search.hits.length)) return;
      const first = search.hits[0];
      if (first) activateSearchHit(first.action, first.id);
    });
  }
  const settingsSearch = byId('settings-search');
  if (settingsSearch) settingsSearch.addEventListener('input', (event) => { settingsQuery = event.target.value || ''; renderCatalog(); });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const more = byId('more-menu');
    if (taskActionsOpen || (more && !more.hidden)) { closeTaskActions(); event.preventDefault(); return; }
    const sessionMenu = byId('session-row-menu');
    if (sessionMenu && !sessionMenu.hidden) { sessionMenu.hidden = true; event.preventDefault(); return; }
    if (settingsOpen()) { event.preventDefault(); closeSettings(); return; }
    const mention = byId('mention-menu');
    if (mention && !mention.hidden) { mention.hidden = true; event.preventDefault(); return; }
    const search = byId('task-search');
    if (search && (document.activeElement === search || (state.search && state.search.query))) { search.value = ''; post({ type: 'search', query: '' }); search.focus(); event.preventDefault(); }
  });
  let lastSessionId = state.session && state.session.id;
  function closeTransientMenus() {
    closeTaskActions();
    ['destination-menu', 'branch-menu', 'mention-menu', 'session-row-menu'].forEach((id) => { const menu = byId(id); if (menu) menu.hidden = true; });
  }
  window.addEventListener('message', (event) => { const message = event.data || {}; if (message.type === 'snapshot' || message.type === 'state') { const next = message.state || {}; const nextId = next.session && next.session.id; if (nextId !== lastSessionId) closeTransientMenus(); lastSessionId = nextId; Object.assign(state, next); render(); } else if (message.type === 'prefill') { const input = byId('composer-input'); input.value = message.text || ''; state.draft = input.value; input.focus(); } else if (message.type === 'error') { state.lastError = message.text || 'Caret host error'; state.connection = message.status || 'unknown'; renderStatus(); } else if (message.type === 'focus_composer') byId('composer-input').focus(); else if (message.type === 'focus_search') { const search = byId('task-search'); if (search) { search.focus(); search.select(); } } else if (message.type === 'focus_task') { const heading = byId('task-title'); if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus(); } } else if (message.type === 'open_settings') openSettings(message.section || 'Devices/connections'); });
  render(); post({ type: 'viewport', width: window.innerWidth, height: window.innerHeight }); post({ type: 'refresh' });
})();
`;

function htmlAttribute(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function createTaskWebviewHtml(webview: WebviewLike, nonce: string): string {
	const safeNonce = htmlAttribute(nonce);
	const safeCspSource = htmlAttribute(webview.cspSource);
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${safeCspSource} data:; style-src ${safeCspSource} 'nonce-${safeNonce}'; script-src 'nonce-${safeNonce}';">
<title>Caret</title>
<style nonce="${safeNonce}">${TASK_WEBVIEW_CSS}</style>
</head>
<body>
<div class="shell" id="shell">
  <aside class="sidebar nav" id="sidebar" aria-label="Chats">
    <button type="button" class="nav-row current" data-action="new_task"><svg class="nav-icon" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 9.6a1.5 1.5 0 0 1-1.5 1.5H5.6L2.6 13.6V3.7a1.5 1.5 0 0 1 1.5-1.5h7.9a1.5 1.5 0 0 1 1.5 1.5Z"/></svg><span class="nav-label">New task</span></button>
    <label class="nav-row search-row"><svg class="nav-icon" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="4.2"/><path d="m10.3 10.3 3.1 3.1"/></svg><input id="task-search" type="search" aria-label="Search All, Tasks, Files, Actions, Settings" placeholder="Search" autocomplete="off"></label>
    <div class="scope-chips" id="search-scopes" role="tablist" aria-label="Search scopes">
      <button type="button" data-action="search_scope" data-scope="all" aria-pressed="true">All</button>
      <button type="button" data-action="search_scope" data-scope="tasks">Tasks</button>
      <button type="button" data-action="search_scope" data-scope="files">Files</button>
      <button type="button" data-action="search_scope" data-scope="actions">Actions</button>
      <button type="button" data-action="search_scope" data-scope="settings">Settings</button>
    </div>
    <div id="search-updating" class="search-empty" hidden>Updating</div>
    <div id="search-hits" class="search-hits" hidden></div>
    <div id="search-empty" class="search-empty" hidden>
      <div>ไม่พบผลลัพธ์</div>
      <p id="search-indexed" hidden></p>
      <button type="button" data-action="clear_search">Clear filters</button>
      <button type="button" data-action="create_draft">Create draft from query</button>
    </div>
    <button type="button" class="nav-row" disabled title="Automations need a host that advertises schedules. Caret does not invent cloud runs."><svg class="nav-icon" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M8 4.6V8l2.4 1.5"/></svg><span class="nav-label">Automations</span></button>
    <button type="button" class="nav-row" data-action="show_settings"><svg class="nav-icon" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5.2h6.4M11.4 5.2h2.6M2 10.8h2.6M7.6 10.8h6.4"/><circle cx="10" cy="5.2" r="1.6"/><circle cx="6" cy="10.8" r="1.6"/></svg><span class="nav-label">Customize</span></button>
    <div class="nav-heading"><button type="button" class="nav-heading-label" data-action="show_projects">Projects</button><button type="button" class="icon-quiet" data-action="open_folder" aria-label="Open folder">+</button></div>
    <button type="button" class="nav-row" data-action="open_folder"><svg class="nav-icon" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4.4A1.6 1.6 0 0 1 3.6 2.8h2.6l1.3 1.7h4.9a1.6 1.6 0 0 1 1.6 1.6v5.5a1.6 1.6 0 0 1-1.6 1.6H3.6A1.6 1.6 0 0 1 2 11.6Z"/><path d="M8 7.2v3.2M6.4 8.8h3.2"/></svg><span class="nav-label">Open folder</span></button>
    <div id="projects" class="list" role="list"></div>
    <div id="recents" class="list" role="list"></div>
    <div class="nav-heading">Repositories</div>
    <div id="pinned" class="list" role="list"></div>
    <div id="task-filters" class="sidebar-filters"></div>
    <p id="filter-empty" class="empty" hidden></p>
    <div id="sessions" class="list" role="list"></div>
    <div id="session-row-menu" class="more-menu plus-menu" hidden></div>
    <div class="sidebar-foot nav-foot">
      <button type="button" class="nav-row" data-action="show_settings"><svg class="nav-icon" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="2.1"/><path d="M8 1.9v1.6M8 12.5v1.6M2.4 8h1.6M12 8h1.6M4.1 4.1l1.1 1.1M10.8 10.8l1.1 1.1M11.9 4.1l-1.1 1.1M5.2 10.8l-1.1 1.1"/></svg><span class="nav-label">Settings</span></button>
    </div>
  </aside>
  <div class="sidebar-scrim" id="sidebar-scrim" data-action="toggle_sidebar"></div>
  <div class="sash sidebar-sash" id="sidebar-sash" role="separator" aria-orientation="vertical" aria-label="Resize sidebar" tabindex="0"></div>
  <main class="main is-empty" id="main" aria-label="Task">
    <div class="top-ide">
      <span id="connection" class="connection offline" role="status">Offline</span>
      <span id="run-status" class="run" hidden></span>
      <button type="button" class="ide-btn" id="mode-ide" data-action="set_mode" data-mode="ide" aria-pressed="false">IDE</button>
      <button type="button" id="mode-agents" data-action="set_mode" data-mode="agents" aria-pressed="true" hidden>Agents</button>
    </div>
    <div id="split-host" class="split-host">
    <div id="live-pane" class="split-pane active">
    <div class="thread">
      <div class="topbar">
        <button type="button" class="ghost" id="route-back" data-action="route_back" disabled>Back</button>
        <button type="button" class="ghost" id="route-forward" data-action="route_forward" disabled>Forward</button>
        <button type="button" class="ide-btn" id="projects-drawer" data-action="toggle_sidebar" hidden>Projects</button>
        <div class="title-stack"><h1 id="task-title" class="task-title" tabindex="-1">New task</h1><div id="task-project" class="task-project">Choose a project</div></div>
        <span class="spacer"></span>
        <span id="approval-attention" class="attention" hidden></span>
        <nav class="work-links" aria-label="Task resources">
          <button type="button" data-action="open_work_panel" data-tab="changes">Changes</button>
          <button type="button" data-action="open_work_panel" data-tab="browser">Browser</button>
          <button type="button" data-action="open_work_panel" data-tab="terminal">Terminal</button>
          <button type="button" data-action="native" data-native-action="files">Files</button>
          <button type="button" data-action="task_actions" aria-label="Task actions" aria-haspopup="menu" aria-expanded="false">More</button>
        </nav>
        <div id="more-menu" class="more-menu plus-menu" hidden role="menu" aria-label="Task actions"></div>
      </div>
      <div id="pane-strip" class="pane-strip" hidden></div>
      <div id="a11y-live" class="sr-only" aria-live="polite"></div>
      <div id="transcript-find-bar" class="find-bar" hidden>
        <input id="transcript-find" type="search" aria-label="Find in transcript" placeholder="Find in transcript" autocomplete="off">
        <span id="transcript-find-count" class="shortcut"></span>
        <button type="button" id="transcript-find-prev" class="ghost">Previous</button>
        <button type="button" id="transcript-find-next" class="ghost">Next</button>
      </div>
      <div id="reconnect-banner" class="reconnect-banner" role="status"></div>
      <button type="button" id="review-request" class="ghost" hidden>Review request</button>
      <p id="space-note" hidden></p>
      <div id="plan-strip" class="plan-strip" hidden></div>
      <div id="transcript-wrap" class="transcript-wrap"><section id="transcript" class="transcript" role="log" aria-live="polite" aria-label="Task transcript"></section><button id="jump-latest" class="jump-latest primary" type="button" data-action="jump_latest">Jump to latest</button><div id="ui-requests" class="ui-requests" aria-live="polite"></div></div>
      <div id="queue-list" class="queue-list" hidden></div>
    </div>
    <div class="home-stage" id="home"></div>
    <div class="composer">
      <div class="composer-box">
        <div class="target-pills" id="composer-pills">
          <button type="button" class="pill" id="pill-folder" data-action="open_folder">Folder</button>
          <button type="button" class="pill" id="pill-branch" title="No Git branch until the folder has a repository.">Branch</button>
          <button type="button" class="pill" id="pill-env" title="Run on This Mac. Cloud and relay destinations are not advertised.">This Mac</button>
        </div>
        <textarea id="composer-input" rows="3" aria-label="Message Caret" placeholder="Plan, Build, / for skills, @ for context"></textarea>
        <div id="mention-menu" class="mention-menu" hidden></div>
        <div id="attachment-chips" class="chip-row"></div>
        <div class="composer-bar">
          <button type="button" class="plus" data-action="toggle_plus" aria-label="Add" aria-expanded="false">+</button>
          <select id="model-select" class="model-select" aria-label="Model" disabled><option>Model</option></select>
          <select id="thinking-select" class="thinking-select" aria-label="Thinking level" disabled title="OMP has not advertised thinking levels for this model."><option>Thinking</option></select>
          <span class="spacer"></span>
          <span id="shortcut-hint" class="shortcut" hidden>Enter send · Shift+Enter newline</span>
          <button id="restore-sent" class="ghost" type="button" data-action="restore_sent_draft" hidden>Restore sent draft</button>
          <button id="steer" class="ghost" type="button" data-action="steer" hidden>Steer</button>
          <button id="follow-up" class="ghost" type="button" data-action="follow_up" hidden>Queue</button>
          <button id="stop" class="danger" type="button" data-action="stop" hidden>Stop</button>
          <button id="send" class="send-round" type="button" aria-label="Choose a model" title="Choose a model" disabled>↑</button>
        </div>
        <div id="plus-menu" class="plus-menu" hidden>
          <button type="button" data-action="prefill" data-text="Plan a new idea: ">Plan</button>
          <button type="button" data-action="prefill" data-text="Debug this issue: ">Debug</button>
          <button type="button" data-action="prefill" data-text="">Multitask</button>
          <button type="button" data-action="prefill" data-text="">Ask</button>
          <button type="button" data-action="native" data-native-action="files">Files</button>
          <button type="button" data-action="pick_attachments">Attach</button>
          <button type="button" data-action="get_models">Model</button>
          <button type="button" data-action="show_settings" data-section="Tools/MCP">MCP</button>
        </div>
      </div>
      <div class="mode-pills">
        <button type="button" class="pill" data-action="prefill" data-text="Plan a new idea for this repo. ">Plan New Idea</button>
        <button type="button" class="pill" data-action="prefill" data-text="">Multitask</button>
        <button type="button" class="pill" disabled title="Cloud is not a Caret runtime.">Run in Cloud</button>
      </div>
      <div id="destination-menu" class="destination-menu" hidden></div>
      <div id="worktree-receipt" class="worktree-receipt" hidden></div>
      <div id="branch-menu" class="destination-menu" hidden></div>
      <div class="ideas">
        <button type="button" data-action="prefill" data-text="Build from a design. Turn a frame into a working UI in this repo. "><svg class="nav-icon" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.2 9.4 6.1 13.3 7.5 9.4 8.9 8 12.8 6.6 8.9 2.7 7.5 6.6 6.1Z"/></svg><span class="idea-title">Build from a design</span><span class="idea-copy">Turn a frame into a working UI in this repo</span></button>
        <button type="button" data-action="prefill" data-text="Deploy my prototype. Put it on a live link anyone can open. "><svg class="nav-icon" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.2c2.6 1.4 3.4 3.9 3.4 6.2L8 11.4 4.6 8.4C4.6 6.1 5.4 3.6 8 2.2Z"/><path d="m6.3 11.7-1.4 2.2 2.5-.7"/></svg><span class="idea-title">Deploy my prototype</span><span class="idea-copy">Put it on a live link anyone can open</span></button>
        <button type="button" data-action="prefill" data-text="Start with a plan. Align on implementation before writing code. "><svg class="nav-icon" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5.6 4.4h8M5.6 8h8M5.6 11.6h8"/><circle cx="3" cy="4.4" r="0.9"/><circle cx="3" cy="8" r="0.9"/><circle cx="3" cy="11.6" r="0.9"/></svg><span class="idea-title">Start with a plan</span><span class="idea-copy">Align on implementation before writing code</span></button>
        <button type="button" data-action="prefill" data-text="Debug an issue. Find root causes and fix tricky bugs. "><svg class="nav-icon" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="9" r="3.3"/><path d="M8 5.7V4M4.7 6.9 3.2 5.7M4.7 11.1l-1.5 1.2M11.3 6.9l1.5-1.2M11.3 11.1l1.5 1.2M4.7 9H3M13 9h-1.7"/></svg><span class="idea-title">Debug an issue</span><span class="idea-copy">Find root causes and fix tricky bugs</span></button>
      </div>
      <div id="composer-target" class="composer-target" hidden>Folder · This Mac · draft stays on this device</div>
      <div id="status-line" class="status-line" role="status"></div>
    </div>
    </div>
    </div>
  </main>
  <div class="sash" id="work-sash" role="separator" aria-orientation="vertical" aria-label="Resize work panel" tabindex="0"></div>
  <aside class="resources" id="work" aria-label="Work panel">
    <div class="resource-head"><strong>Work</strong><span class="spacer"></span><button type="button" data-action="back_to_task" hidden>Back to task</button><button type="button" data-action="pop_to_ide">Open in IDE</button><button type="button" data-action="dock_panel">Dock bottom</button><button type="button" data-action="close_work_panel">Hide panel</button></div>
    <div id="resource-tabs" class="resource-tabs" role="tablist" aria-label="Work panel"></div>
    <div class="resource-body" id="work-page"></div>
    <div hidden>
      <div id="login-providers"></div>
      <div id="slash-commands"></div>
      <div id="presentations"></div>
      <div id="settings-sections"></div>
      <div id="capability-catalog"></div>
    </div>
  </aside>
</div>
<div class="settings-route" id="projects-route" hidden>
  <div class="projects-route-head">
    <button type="button" data-action="route_back">Back</button>
    <strong>Projects</strong>
  </div>
  <div class="projects-route-page" id="projects-route-page"></div>
</div>
<div class="settings-route" id="settings-route" hidden>
  <div class="settings-top">
    <button type="button" data-action="close_settings">Back</button>
    <strong>Settings</strong>
    <input id="settings-search" class="settings-search" type="search" aria-label="Search settings" placeholder="Search settings" autocomplete="off">
  </div>
  <div class="settings-body">
    <label class="sr-only" for="settings-section-select">Settings category</label>
    <select id="settings-section-select" class="settings-section-select" aria-label="Settings category"></select>
    <nav class="settings-nav" id="settings-nav" aria-label="Settings categories"></nav>
    <div class="settings-page" id="settings-page"></div>
  </div>
</div>
<div class="route-error" id="route-error" hidden>
  <div class="route-error-card">
    <h2 id="route-error-title">This task is gone</h2>
    <p id="route-error-body">This task is missing. Caret will not open a different task.</p>
    <button type="button" id="route-error-primary" data-action="route_error_action" data-route-action="projects">Projects</button>
  </div>
</div>
<script nonce="${safeNonce}">${TASK_WEBVIEW_SCRIPT}</script>
</body>
</html>`;
}
