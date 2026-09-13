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
	--caret-focus: var(--vscode-focusBorder, #6cb6ff);
	--caret-accent: var(--vscode-button-background, #0e639c);
	--caret-accent-text: var(--vscode-button-foreground, #fff);
	--caret-danger: var(--vscode-errorForeground, #f48771);
	--caret-warning: var(--vscode-editorWarning-foreground, #cca700);
	--caret-success: var(--vscode-testing-iconPassed, #73c991);
	--caret-radius: 8px;
	--caret-control-radius: 5px;
	--caret-gap: 10px;
}
* { box-sizing: border-box; }
html, body { height: 100%; }
body { margin: 0; min-width: 300px; background: var(--caret-bg); color: var(--caret-text); font: 13px/1.45 var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif); }
button, input, textarea, select { font: inherit; }
button { border: 1px solid transparent; border-radius: var(--caret-control-radius); background: transparent; color: inherit; cursor: pointer; min-height: 30px; padding: 5px 10px; }
button:hover:not(:disabled) { background: color-mix(in srgb, var(--caret-text) 9%, transparent); }
button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible { outline: 2px solid var(--caret-focus); outline-offset: 1px; }
button.primary { background: var(--caret-accent); color: var(--caret-accent-text); }
button.primary:hover:not(:disabled) { filter: brightness(1.12); }
button.ghost { color: var(--caret-muted); }
button.danger { color: var(--caret-danger); }
button:disabled { cursor: default; opacity: .55; }
input, textarea, select { border: 1px solid var(--caret-border); border-radius: var(--caret-control-radius); background: var(--caret-input); color: var(--caret-text); padding: 7px 9px; }
input::placeholder, textarea::placeholder { color: var(--caret-muted); }
.shell { display: grid; grid-template-columns: 240px minmax(360px, 1fr) 250px; height: 100vh; overflow: hidden; }
.sidebar, .resources { display: flex; min-width: 0; flex-direction: column; background: var(--caret-panel); border-color: var(--caret-border); }
.sidebar { border-right: 1px solid var(--caret-border); }
.resources { border-left: 1px solid var(--caret-border); }
.sidebar-head, .resource-head, .topbar { display: flex; align-items: center; gap: 8px; min-width: 0; min-height: 46px; padding: 9px 12px; border-bottom: 1px solid var(--caret-border); }
.brand { display: flex; align-items: center; gap: 7px; font-weight: 600; letter-spacing: .01em; }
.brand-mark { width: 20px; height: 20px; flex: 0 0 auto; color: var(--caret-text); }
.sidebar-head .spacer, .topbar .spacer, .resource-head .spacer { flex: 1; }
.icon-button { width: 30px; padding: 4px; }
.sidebar-search { padding: 10px 11px 7px; }
.sidebar-search input { width: 100%; }
.section-label { display: flex; align-items: center; padding: 10px 12px 4px; color: var(--caret-muted); font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
.list { overflow: auto; padding: 0 6px 10px; }
.project, .session { display: flex; align-items: center; gap: 7px; width: 100%; min-height: 38px; margin: 2px 0; padding: 6px 7px; border-radius: 6px; text-align: left; }
.project:hover, .session:hover, .project.selected, .session.selected { background: color-mix(in srgb, var(--caret-text) 10%, transparent); }
.project .name, .session .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.project .meta, .session .meta { display: block; color: var(--caret-muted); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.session .dot { flex: 0 0 auto; width: 7px; height: 7px; border-radius: 50%; background: var(--caret-muted); }
.session.running .dot { background: var(--caret-success); box-shadow: 0 0 0 3px color-mix(in srgb, var(--caret-success) 18%, transparent); }
.session.unknown .dot { background: var(--caret-warning); }
.main { display: flex; min-width: 0; flex-direction: column; background: var(--caret-bg); }
.topbar { border-bottom: 1px solid var(--caret-border); }
.task-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.connection { display: inline-flex; align-items: center; gap: 5px; color: var(--caret-muted); font-size: 11px; }
.connection::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.connection.running { color: var(--caret-success); }
.connection.unknown, .connection.connecting { color: var(--caret-warning); }
.connection.offline { color: var(--caret-danger); }
.transcript-wrap { position: relative; flex: 1; min-height: 0; overflow: auto; }
.transcript { max-width: 900px; margin: 0 auto; padding: 18px clamp(14px, 4vw, 46px) 20px; }
.empty { display: grid; min-height: 300px; place-items: center; color: var(--caret-muted); text-align: center; }
.empty strong { display: block; margin-bottom: 5px; color: var(--caret-text); font-size: 16px; }
.message { margin: 0 0 18px; }
.message-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 5px; color: var(--caret-muted); font-size: 11px; }
.message-head strong { color: var(--caret-text); font-size: 12px; }
.message-body { white-space: pre-wrap; overflow-wrap: anywhere; user-select: text; }
.message.user { padding: 10px 12px; border: 1px solid var(--caret-border); border-radius: var(--caret-radius); background: var(--caret-panel); }
.message.user .message-head { margin-bottom: 3px; }
.message.assistant .message-body { font-size: 14px; }
.message.system { color: var(--caret-muted); font-size: 12px; }
.tool-card { margin: 8px 0 12px; border: 1px solid var(--caret-border); border-radius: var(--caret-radius); background: color-mix(in srgb, var(--caret-panel) 65%, transparent); overflow: hidden; }
.tool-summary { display: flex; align-items: center; gap: 8px; width: 100%; padding: 9px 11px; text-align: left; }
.tool-summary .tool-name { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tool-summary .tool-state { color: var(--caret-muted); font-size: 11px; }
.tool-summary .tool-state.running { color: var(--caret-warning); }
.tool-summary .tool-state.completed { color: var(--caret-success); }
.tool-summary .tool-state.failed { color: var(--caret-danger); }
.tool-details { display: none; padding: 0 11px 11px; border-top: 1px solid var(--caret-border); }
.tool-card.expanded .tool-details { display: block; }
.tool-details pre { max-height: 190px; margin: 8px 0; padding: 8px; overflow: auto; border: 1px solid var(--caret-border); border-radius: 4px; background: var(--caret-input); color: var(--caret-text); font: 11px/1.45 var(--vscode-editor-font-family, ui-monospace, monospace); white-space: pre-wrap; overflow-wrap: anywhere; }
.tool-actions { display: flex; justify-content: flex-end; gap: 5px; }
.event-row { margin: 7px 0; padding: 7px 9px; border-left: 2px solid var(--caret-border); color: var(--caret-muted); font-size: 11px; }
.composer { padding: 9px clamp(12px, 4vw, 38px) 12px; border-top: 1px solid var(--caret-border); background: var(--caret-bg); }
.composer-box { max-width: 900px; margin: 0 auto; border: 1px solid var(--caret-border); border-radius: 10px; background: var(--caret-panel); box-shadow: 0 5px 22px rgb(0 0 0 / 12%); }
.composer textarea { display: block; width: 100%; min-height: 58px; max-height: 180px; resize: vertical; border: 0; border-radius: 10px 10px 0 0; background: transparent; }
.composer textarea:focus { outline: none; }
.composer-controls { display: flex; align-items: center; gap: 6px; padding: 5px 7px; border-top: 1px solid var(--caret-border); }
.composer-controls .spacer { flex: 1; }
.shortcut { color: var(--caret-muted); font-size: 10px; }
.model-select { max-width: 175px; min-height: 27px; padding: 3px 7px; border: 0; background: transparent; color: var(--caret-muted); font-size: 11px; }
.resources .resource-body { overflow: auto; padding: 10px; }
.resource-card { margin-bottom: 10px; padding: 10px; border: 1px solid var(--caret-border); border-radius: var(--caret-radius); background: var(--caret-panel); }
.resource-card h3 { margin: 0 0 8px; font-size: 12px; }
.resource-card p { margin: 0 0 9px; color: var(--caret-muted); font-size: 11px; }
.resource-action { display: flex; align-items: center; width: 100%; gap: 8px; margin: 3px 0; padding: 8px; border: 1px solid var(--caret-border); text-align: left; }
.resource-action .symbol { width: 20px; color: var(--caret-muted); text-align: center; }
.login-row { display: flex; align-items: center; gap: 8px; margin: 3px 0; }
.login-row .name { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.login-row .meta { color: var(--caret-muted); font-size: 11px; }
.presentations { display: grid; gap: 8px; margin-top: 8px; }
.status-line { min-height: 20px; max-width: 900px; margin: 0 auto; padding: 3px 2px 0; color: var(--caret-muted); font-size: 11px; }
.ui-requests { position: absolute; right: clamp(14px, 4vw, 46px); bottom: 15px; left: clamp(14px, 4vw, 46px); z-index: 2; display: grid; gap: 8px; max-width: 630px; margin: 0 auto; }
.ui-card { padding: 12px; border: 1px solid var(--caret-warning); border-radius: var(--caret-radius); background: var(--caret-panel-raised); box-shadow: 0 8px 25px rgb(0 0 0 / 25%); }
.ui-card h3 { margin: 0 0 5px; font-size: 13px; }
.ui-card p { margin: 0 0 9px; color: var(--caret-muted); white-space: pre-wrap; }
.ui-card textarea, .ui-card input, .ui-card select { width: 100%; margin: 0 0 9px; }
.ui-actions { display: flex; justify-content: flex-end; gap: 6px; }
.reconnect-banner { display: none; padding: 6px 12px; background: color-mix(in srgb, var(--caret-warning) 15%, transparent); color: var(--caret-warning); font-size: 11px; text-align: center; }
.reconnect-banner.visible { display: block; }
@media (max-width: 900px) { .shell { grid-template-columns: 210px minmax(320px, 1fr); } .resources { display: none; } }
@media (max-width: 360px) { .shell { grid-template-columns: 176px minmax(0, 1fr); } .sidebar-head { padding-inline: 8px; } .sidebar-head .brand > span:last-child { display: none; } .sidebar-head [data-action="new_task"] { flex: 0 0 30px; } }
@media (max-width: 620px) { .shell { display: block; } .sidebar { display: none; } .main { height: 100vh; } .shortcut { display: none; } .model-select { max-width: 125px; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; animation: none !important; } }
`;

export const TASK_WEBVIEW_SCRIPT = String.raw`
(() => {
  const vscode = acquireVsCodeApi();
  const root = document;
  const state = { connection: 'offline', projects: [], sessions: [], transcript: [], uiRequests: [], pendingCommands: {}, models: [], loginProviders: [], presentations: [], draft: '', session: null, project: null, cursor: 0, hasMoreEvents: false };
  let composing = false;
  let expandedTools = new Set();
  // OMP UI requests are polled snapshots. Keep each control/card keyed by its
  // token so a refresh does not recreate an active input, destroying its draft
  // or keyboard focus. Entries leave the map only when the host resolves them
  // (token disappears) or a new session incarnation is selected.
  let uiIncarnation = '';
  const uiControls = new Map();
  const byId = (id) => root.getElementById(id);
  const post = (message) => vscode.postMessage(message);
  const text = (node, value) => { node.textContent = value == null ? '' : String(value); return node; };
  const element = (tag, className, value) => { const node = root.createElement(tag); if (className) node.className = className; if (value !== undefined) text(node, value); return node; };
  const safeJson = (value) => { try { return JSON.stringify(value, null, 2); } catch (_) { return '[unserializable]'; } };
  const statusLabel = (value) => ({ offline: 'Offline', connecting: 'Connecting…', connected: 'Ready', running: 'Running', unknown: 'Outcome unknown' }[value] || 'Ready');
  function renderStatus() {
    const status = byId('connection');
    status.className = 'connection ' + (state.connection || 'offline');
    text(status, statusLabel(state.connection));
    const title = state.session && state.session.title ? state.session.title : (state.project && state.project.name ? state.project.name : 'New task');
    text(byId('task-title'), title);
    const banner = byId('reconnect-banner');
    banner.classList.toggle('visible', state.connection === 'offline' || state.connection === 'unknown');
    text(byId('status-line'), state.lastError || (state.connection === 'unknown' ? 'The last command may have run. Check command status before retrying.' : ''));
  }
  function renderProjects() {
    const box = byId('projects'); box.textContent = '';
    (state.projects || []).filter((project) => !project.archived).forEach((project) => {
      const button = element('button', 'project' + (state.project && state.project.id === project.id ? ' selected' : ''));
      button.type = 'button'; button.dataset.projectId = project.id;
      const mark = element('span', 'project-mark', project.pinned ? '★' : '·');
      const wrap = element('span'); wrap.appendChild(element('span', 'name', project.name || project.path)); wrap.appendChild(element('span', 'meta', project.path || ''));
      button.append(mark, wrap); box.appendChild(button);
    });
    if (!box.children.length) box.appendChild(element('div', 'section-label', 'No projects yet'));
  }
  function renderSessions() {
    const box = byId('sessions'); box.textContent = '';
    (state.sessions || []).filter((session) => !session.archived).forEach((session) => {
      const status = session.status || 'idle';
      const button = element('button', 'session ' + status + (state.session && state.session.id === session.id ? ' selected' : ''));
      button.type = 'button'; button.dataset.sessionId = session.id;
      button.appendChild(element('span', 'dot'));
      const wrap = element('span'); wrap.appendChild(element('span', 'name', session.title || 'Untitled task')); wrap.appendChild(element('span', 'meta', status)); button.appendChild(wrap); box.appendChild(button);
    });
    if (!box.children.length) box.appendChild(element('div', 'section-label', 'No tasks'));
  }
  function messageNode(entry) {
    if (entry.kind === 'tool') return toolNode(entry);
    if (entry.kind === 'event') { const row = element('div', 'event-row', entry.text || 'event'); row.dataset.messageId = entry.id; return row; }
    const row = element('article', 'message ' + (entry.role || 'assistant')); row.dataset.messageId = entry.id;
    const head = element('div', 'message-head'); head.appendChild(element('strong', '', entry.role === 'user' ? 'You' : entry.role === 'system' ? 'Caret' : 'Caret')); head.appendChild(element('span', '', entry.status === 'streaming' ? 'typing…' : ''));
    row.append(head, element('div', 'message-body', entry.text || ''));
    return row;
  }
  function toolNode(entry) {
    const card = element('article', 'tool-card' + (expandedTools.has(entry.id) ? ' expanded' : '')); card.dataset.messageId = entry.id;
    const summary = element('button', 'tool-summary'); summary.type = 'button'; summary.setAttribute('aria-expanded', expandedTools.has(entry.id) ? 'true' : 'false');
    summary.appendChild(element('span', 'tool-name', entry.toolName || 'Tool'));
    const status = entry.toolStatus || 'unknown'; summary.appendChild(element('span', 'tool-state ' + status, status)); summary.appendChild(element('span', '', expandedTools.has(entry.id) ? '⌃' : '⌄'));
    summary.addEventListener('click', () => { if (expandedTools.has(entry.id)) expandedTools.delete(entry.id); else expandedTools.add(entry.id); renderTranscript(); }); card.appendChild(summary);
    const details = element('div', 'tool-details');
    if (entry.args !== undefined) { details.appendChild(element('div', 'message-head', 'Arguments')); details.appendChild(element('pre', '', safeJson(entry.args))); }
    if (entry.output) { details.appendChild(element('div', 'message-head', 'Output')); details.appendChild(element('pre', '', entry.output)); }
    const actions = element('div', 'tool-actions'); const copy = element('button', 'ghost', 'Copy output'); copy.type = 'button'; copy.addEventListener('click', () => { const clipboard = navigator.clipboard; if (clipboard) void clipboard.writeText(entry.output || safeJson(entry.args) || '').then(() => { text(byId('status-line'), 'Copied tool output.'); }); }); actions.appendChild(copy); details.appendChild(actions); card.appendChild(details); return card;
  }
  function renderTranscript() {
    const box = byId('transcript'); box.textContent = '';
    const visible = (state.transcript || []).filter(entry => entry.kind !== 'event' || entry.status === 'failed');
    if (visible.length === 0) { const empty = element('div', 'empty'); const wrap = element('div'); wrap.appendChild(element('strong', '', 'Start a task in Caret')); wrap.appendChild(element('span', '', 'Choose a project and describe what you want to build.')); empty.appendChild(wrap); box.appendChild(empty); return; }
    visible.forEach((entry) => box.appendChild(messageNode(entry)));
    if (state.hasMoreEvents) { const load = element('button', 'ghost', 'Load more activity'); load.type = 'button'; load.addEventListener('click', () => post({ type: 'load_more' })); box.prepend(load); }
    const wrap = byId('transcript-wrap'); if (wrap && state.followLatest !== false) wrap.scrollTop = wrap.scrollHeight;
  }
  function buildUiCard(token, request) {
    const card = element('section', 'ui-card'); card.dataset.token = token; card.dataset.uiMethod = request.method || '';
    const heading = element('h3', '', request.title || 'Caret needs your input'); heading.dataset.uiHeading = 'true'; card.appendChild(heading);
    const message = element('p', '', request.message || ''); message.dataset.uiMessage = 'true'; if (request.method !== 'confirm') message.hidden = true; card.appendChild(message);
    let control;
    if (request.method === 'select') control = element('select');
    else if (request.method === 'editor') { control = element('textarea'); control.rows = 6; control.value = request.prefill || ''; }
    else if (request.method === 'input') { control = element('input'); control.type = 'text'; control.placeholder = request.placeholder || ''; }
    if (control) { control.dataset.uiControl = 'true'; card.appendChild(control); }
    const actions = element('div', 'ui-actions'); const cancel = element('button', 'ghost', 'Cancel'); cancel.type = 'button'; cancel.addEventListener('click', () => post({ type: 'ui_cancel', token })); actions.appendChild(cancel);
    const submit = element('button', 'primary', request.method === 'confirm' ? 'Allow' : 'Submit'); submit.type = 'button'; submit.addEventListener('click', () => { let value = true; if (request.method !== 'confirm' && control) value = control.value; post({ type: 'ui_answer', token, answer: value }); }); actions.appendChild(submit); card.appendChild(actions);
    const record = { card, control, method: request.method, prefill: request.prefill || '', userEdited: false };
    if (control) control.addEventListener('input', () => { record.userEdited = true; });
    return record;
  }
  function updateUiCard(record, item) {
    const request = item.request || {};
    const heading = record.card.querySelector('[data-ui-heading]'); if (heading) text(heading, request.title || 'Caret needs your input');
    const message = record.card.querySelector('[data-ui-message]'); if (message) { text(message, request.message || ''); message.hidden = request.method !== 'confirm'; }
    const control = record.control;
    if (!control) return;
    if (request.method === 'select') {
      const selected = control.value; control.textContent = '';
      (request.options || []).forEach((option) => { const node = element('option', '', option); node.value = option; control.appendChild(node); });
      if ((request.options || []).includes(selected)) control.value = selected;
    } else if (request.method === 'input') {
      control.placeholder = request.placeholder || '';
    } else if (request.method === 'editor' && !record.userEdited && document.activeElement !== control && record.prefill !== (request.prefill || '')) {
      control.value = request.prefill || ''; record.prefill = request.prefill || '';
    }
  }
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
  }
  function renderModels() { const select = byId('model-select'); const selected = state.selectedModel || ''; select.textContent = ''; if (!state.models || !state.models.length) { select.appendChild(element('option', '', 'Model')); select.disabled = true; return; } select.disabled = false; state.models.forEach((model) => { const option = element('option', '', model.label || model.id); option.value = model.id; option.disabled = model.available === false; if (model.id === selected) option.selected = true; select.appendChild(option); }); }
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
  function render() { renderStatus(); renderProjects(); renderSessions(); renderTranscript(); renderUiRequests(); renderModels(); renderLogin(); renderPresentations(); const draft = byId('composer-input'); if (draft && draft.value !== state.draft && document.activeElement !== draft) draft.value = state.draft || ''; }
  function send(kind) { const input = byId('composer-input'); const value = input.value; if (!value.trim()) return; post({ type: kind, text: value }); input.value = ''; state.draft = ''; }
  root.addEventListener('click', (event) => { const target = event.target.closest('[data-action]'); if (target) { const action = target.dataset.action; if (action === 'task_actions') post({type:'task_actions'}); else if (action === 'new_task') post({ type: 'new_task' }); else if (action === 'refresh') post({ type: 'refresh' }); else if (action === 'stop') post({ type: 'stop' }); else if (action === 'steer') send('steer'); else if (action === 'follow_up') send('follow_up'); else if (action === 'get_models') post({ type: 'get_models' }); else if (action === 'get_login_providers') post({ type: 'get_login_providers' }); else if (action === 'native') post({ type: 'native_action', action: target.dataset.nativeAction }); } const project = event.target.closest('[data-project-id]'); if (project) post({ type: 'select_project', projectId: project.dataset.projectId }); const session = event.target.closest('[data-session-id]'); if (session) post({ type: 'select_session', sessionId: session.dataset.sessionId }); });
  byId('send').addEventListener('click', () => send('send_prompt')); byId('composer-input').addEventListener('compositionstart', () => { composing = true; }); byId('composer-input').addEventListener('compositionend', () => { composing = false; }); byId('composer-input').addEventListener('input', (event) => { state.draft = event.target.value; }); byId('composer-input').addEventListener('keydown', (event) => { if (event.key !== 'Enter' || composing || event.isComposing) return; if (event.shiftKey) return; event.preventDefault(); send(event.metaKey || event.ctrlKey ? 'follow_up' : 'send_prompt'); }); byId('model-select').addEventListener('change', (event) => { const option = event.target.selectedOptions[0]; if (option && option.value) post({ type: 'select_model', modelId: option.value }); }); byId('task-search').addEventListener('input', (event) => post({ type: 'search', query: event.target.value }));
  window.addEventListener('message', (event) => { const message = event.data || {}; if (message.type === 'snapshot' || message.type === 'state') { Object.assign(state, message.state || {}); render(); } else if (message.type === 'prefill') { const input = byId('composer-input'); input.value = message.text || ''; state.draft = input.value; input.focus(); } else if (message.type === 'error') { state.lastError = message.text || 'Caret host error'; state.connection = message.status || 'unknown'; renderStatus(); } else if (message.type === 'focus_composer') byId('composer-input').focus(); });
  render(); post({ type: 'refresh' });
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
<div class="shell">
  <aside class="sidebar" aria-label="Caret projects and tasks">
    <div class="sidebar-head"><div class="brand"><svg class="brand-mark" aria-hidden="true" focusable="false" viewBox="0 0 256 256" fill="none"><g stroke="currentColor" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"><path d="M72 76 124 128 72 180"/><path d="M184 76v104"/></g></svg><span>Caret</span></div><span class="spacer"></span><button class="icon-button" type="button" data-action="new_task" aria-label="New task" title="New task">＋</button></div>
    <div class="sidebar-search"><input id="task-search" type="search" aria-label="Search tasks" placeholder="Search tasks" autocomplete="off"></div>
    <div class="section-label">Projects</div><div id="projects" class="list" role="list"></div>
    <div class="section-label">Tasks</div><div id="sessions" class="list" role="list"></div>
  </aside>
  <main class="main" aria-label="Caret task workspace">
    <div class="topbar"><button class="icon-button" type="button" data-action="task_actions" aria-label="Task actions" title="Task actions">☰</button><span id="task-title" class="task-title">New task</span><span class="spacer"></span><span id="connection" class="connection offline" role="status">Offline</span><button class="icon-button" type="button" data-action="refresh" aria-label="Reconnect" title="Reconnect">↻</button></div>
    <div id="reconnect-banner" class="reconnect-banner" role="status">Caret host is offline. Start the configured host to reconnect; no command will be replayed automatically.</div>
    <div id="transcript-wrap" class="transcript-wrap"><section id="transcript" class="transcript" role="log" aria-live="polite" aria-label="Task transcript"></section><div id="ui-requests" class="ui-requests" aria-live="assertive"></div></div>
    <div class="composer"><div class="composer-box"><textarea id="composer-input" rows="2" aria-label="Message Caret" placeholder="Ask Caret to work on this project…"></textarea><div class="composer-controls"><select id="model-select" class="model-select" aria-label="Model" disabled><option>Model</option></select><button class="ghost" type="button" data-action="get_models" aria-label="Refresh models" title="Refresh models">⌄</button><span class="spacer"></span><span class="shortcut">Enter send · Shift+Enter newline · ⌘Enter follow up</span><button id="steer" class="ghost" type="button" data-action="steer">Steer</button><button id="follow-up" class="ghost" type="button" data-action="follow_up">Follow up</button><button id="stop" class="danger" type="button" data-action="stop">Stop</button><button id="send" class="primary" type="button">Send</button></div></div><div id="status-line" class="status-line" role="status"></div></div>
  </main>
  <aside class="resources" aria-label="Native resources and actions"><div class="resource-head"><strong>Workspace</strong><span class="spacer"></span><button class="icon-button" type="button" data-action="refresh" aria-label="Refresh workspace" title="Refresh">↻</button></div><div class="resource-body"><section class="resource-card"><h3>Open in Caret</h3><p>Explore files, review edits, and run project commands.</p><button class="resource-action" type="button" data-action="native" data-native-action="files"><span class="symbol" aria-hidden="true">□</span><span>Files &amp; editor</span></button><button class="resource-action" type="button" data-action="native" data-native-action="diff"><span class="symbol" aria-hidden="true">±</span><span>Review changes</span></button><button class="resource-action" type="button" data-action="native" data-native-action="terminal"><span class="symbol" aria-hidden="true">›_</span><span>Open terminal</span></button></section><section class="resource-card"><h3>OMP login</h3><p>Providers come from the running OMP session. Caret lists them here and only opens a browser after you choose one.</p><div id="login-providers"></div><button class="resource-action" type="button" data-action="get_login_providers"><span class="symbol" aria-hidden="true">↻</span><span>Refresh providers</span></button><div id="presentations" class="presentations"></div></section><section class="resource-card"><h3>Settings</h3><p>Connect your iPhone and choose how Caret works.</p><button class="resource-action" type="button" data-action="native" data-native-action="settings"><span class="symbol" aria-hidden="true">⚙</span><span>Open Caret settings</span></button></section></div></aside>
</div>
<script nonce="${safeNonce}">${TASK_WEBVIEW_SCRIPT}</script>
</body>
</html>`;
}
