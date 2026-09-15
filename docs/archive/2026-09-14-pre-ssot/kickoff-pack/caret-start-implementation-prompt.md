# Caret Implementation Kickoff Prompt

You are the lead engineer responsible for beginning implementation of **Caret**, a Code-OSS fork that delivers a Cursor-style dual-window AI coding experience while using **Oh My Pi (OMP)** as the agent runtime and coding harness.

This is an **implementation task**, not an analysis-only or planning-only task.

Read the attached source-of-truth documents, inspect the repository, produce a concise execution plan, and then begin modifying the code immediately. Do not stop after writing a plan unless there is a genuine blocker that cannot be resolved through repository inspection, the attached documents, or available build and test tooling.

---

# 1. Attached source-of-truth documents

Read these files in this order:

1. `caret-cursor-parity-spec.md`
   - Primary product, architecture, interface, security, testing, and roadmap specification.
   - Treat this as the normative source of truth.

2. `caret-implementation-backlog.csv`
   - Detailed implementation items, dependencies, priorities, and acceptance criteria.
   - Use it to determine engineering order and avoid skipping prerequisite work.

3. `caret-ui-reference-baseline.json`
   - Initial layout geometry, panel ratios, screenshot dimensions, and sampled visual values.
   - These values are provisional reference measurements and must not be blindly hardcoded.

4. `caret-golden-state-manifest.template.json`
   - Template for screenshot regression, geometry validation, accessibility assertions, and state fixtures.

The attached specification defines the intended product behavior. The repository defines what is technically present today.

When a low-level implementation detail in the specification conflicts with repository reality:

1. Preserve the product intent.
2. Prefer the most upstream-friendly Code-OSS architecture.
3. Avoid broad invasive patches.
4. Document the deviation and its rationale.
5. Do not silently remove or reinterpret a requirement.

---

# 2. Product definition

Caret is one desktop product with two coordinated windows.

## 2.1 Caret Agents Window

The Agents Window is an agent-first command center for:

- starting tasks;
- supervising multiple OMP sessions;
- viewing structured execution timelines;
- responding to questions and approvals;
- reviewing changed files;
- opening browser previews;
- viewing terminal activity;
- managing repositories and worktrees;
- searching task history;
- using automations;
- managing rules, skills, commands, subagents, hooks, plugins, and MCP;
- handing a session into the IDE.

## 2.2 Caret IDE Window

The IDE Window is the normal Code-OSS workbench enhanced with Caret functionality:

- editor;
- Explorer;
- Search;
- Source Control;
- Run and Debug;
- Extensions;
- terminal;
- problems and output;
- Caret Agent auxiliary sidepane;
- inline edit;
- review actions;
- session controls;
- open/focus Agents Window;
- shared OMP task state.

## 2.3 Shared-session requirement

The two windows must not be implemented as unrelated applications.

They must share the same:

- Caret session ID;
- OMP runtime session;
- event stream;
- transcript;
- prompt queue;
- approvals;
- questions;
- selected repository;
- selected branch;
- worktree;
- model;
- mode;
- effort level;
- runtime;
- changed files;
- checkpoints;
- review findings;
- browser artifacts;
- terminal metadata;
- completion state.

Opening the same task in the second window must not:

- create another conversation;
- launch another OMP process;
- duplicate queued prompts;
- lose approvals;
- reset the transcript;
- switch to another worktree;
- lose the current execution state.

Window-specific presentation state may remain separate, including:

- panel widths;
- selected surface;
- focus;
- timeline scroll position;
- expanded tool blocks;
- active editor group;
- auxiliary-panel visibility.

---

# 3. Required high-level architecture

Implement toward this architecture:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                           Caret Electron Main                          │
│                                                                        │
│  Window lifecycle · menus · deep links · updater · credential access  │
│                                                                        │
│  ┌──────────────────────────┐     ┌─────────────────────────────────┐  │
│  │ Caret IDE BrowserWindow  │     │ Caret Agents BrowserWindow     │  │
│  │ Code-OSS workbench       │     │ Code-OSS-based agent shell     │  │
│  └─────────────┬────────────┘     └───────────────┬─────────────────┘  │
│                │ authenticated local IPC          │                    │
│                └──────────────────┬────────────────┘                    │
│                                   ▼                                     │
│                         caret-agentd                                    │
│                  daemon or utility-process service                      │
│                                                                        │
│  ┌────────────────────┬────────────────────┬────────────────────────┐  │
│  │ Session registry   │ Append-only events │ Derived projections    │  │
│  ├────────────────────┼────────────────────┼────────────────────────┤  │
│  │ OMP adapter        │ Process supervisor │ Capability registry    │  │
│  ├────────────────────┼────────────────────┼────────────────────────┤  │
│  │ Git/worktrees      │ Approval policy    │ Artifact registry      │  │
│  ├────────────────────┼────────────────────┼────────────────────────┤  │
│  │ PTY metadata       │ Browser bridge     │ Notification service   │  │
│  └────────────────────┴────────────────────┴────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
                  ┌─────────────────────────────────┐
                  │ Oh My Pi runtime sessions       │
                  │ local / worktree / remote later │
                  └─────────────────────────────────┘
```

The renderer must not own long-running OMP processes.

The session service must survive:

- renderer reload;
- window close and reopen;
- switching between windows;
- temporary client disconnection.

---

# 4. Non-negotiable engineering rules

## 4.1 OMP remains the harness

OMP owns:

- agent loop;
- model/provider orchestration already implemented by OMP;
- tool reasoning;
- subagent reasoning;
- OMP memory behavior;
- OMP rules and skills where supported;
- LSP/DAP-aware coding behavior;
- model-specific prompting;
- runtime execution semantics.

Caret must not secretly create a competing agent harness.

Caret owns:

- desktop UI;
- dual-window orchestration;
- event normalization;
- session persistence;
- Git/worktree lifecycle;
- policy and approvals;
- browser, terminal, diff, review, and artifact surfaces;
- window synchronization;
- visual and interaction parity;
- optional low-latency inline-completion provider abstraction.

## 4.2 Runtime adapter boundary

The UI and general application services must never import OMP internal types directly.

All runtime interaction must pass through a versioned adapter similar to:

```ts
export interface AgentRuntimeAdapter {
  handshake(): Promise<RuntimeCapabilities>;

  listModels(): Promise<ModelDescriptor[]>;
  listModes(): Promise<ModeDescriptor[]>;
  listSessions(): Promise<RuntimeSessionSummary[]>;

  createSession(
    request: CreateSessionRequest
  ): Promise<RuntimeSessionHandle>;

  attachSession(
    runtimeSessionId: string
  ): Promise<RuntimeSessionHandle>;

  resumeSession?(
    runtimeSessionId: string
  ): Promise<void>;

  subscribe(
    runtimeSessionId: string,
    fromSequence: number | undefined,
    sink: (event: RuntimeEvent) => void
  ): Promise<Unsubscribe>;

  sendPrompt(
    runtimeSessionId: string,
    request: PromptRequest
  ): Promise<PromptAck>;

  answerQuestion(
    runtimeSessionId: string,
    questionId: string,
    answer: unknown
  ): Promise<void>;

  decideApproval(
    runtimeSessionId: string,
    approvalId: string,
    decision: ApprovalDecision
  ): Promise<void>;

  stop(
    runtimeSessionId: string
  ): Promise<void>;

  pause?(
    runtimeSessionId: string
  ): Promise<void>;

  cancelTool?(
    runtimeSessionId: string,
    toolCallId: string
  ): Promise<void>;

  disposeSession?(
    runtimeSessionId: string
  ): Promise<void>;
}
```

## 4.3 No terminal-interface scraping

Never parse these as the primary machine protocol:

- OMP terminal UI;
- ANSI output;
- terminal screenshots;
- cursor positioning escape sequences;
- human-oriented CLI text;
- log strings whose format is not a documented protocol.

Preferred integration order:

1. Structured OMP bridge or plugin.
2. ACP transport.
3. Stable JSON/RPC or machine-readable CLI.
4. Deterministic fixture adapter for development until the real structured bridge exists.

If the current OMP version lacks a required structured capability:

1. Preserve the adapter contract.
2. Implement a realistic deterministic fixture adapter.
3. Add a real adapter skeleton.
4. Document the exact missing OMP-side events or commands.
5. Do not present fixture behavior as real OMP integration.

Create or update:

```text
docs/caret/omp-integration-gaps.md
```

## 4.4 Native Code-OSS integration

Use native Code-OSS workbench components and services wherever possible.

Reuse:

- Monaco editor;
- Monaco diff editor;
- editor service;
- file service;
- terminal service;
- source-control service;
- workspace trust;
- debug service;
- testing service;
- problems and diagnostics;
- command service;
- menu service;
- context keys;
- quick input;
- notifications;
- dialogs;
- list/tree widgets;
- themes;
- keybindings;
- storage;
- accessibility infrastructure.

Do not build the entire Agents Window as one giant webview.

Use an embedded browser/webview only for actual rendered web content or a justified browser-preview surface.

The Agents Window should be implemented as a Code-OSS-based workbench shell with:

- native titlebar integration;
- native navigation/list components;
- native center editor panes or equivalent workbench parts;
- native auxiliary side surface;
- native command and keyboard handling;
- native accessibility tree.

## 4.5 Upstream-friendly fork

Keep Caret code isolated.

Prefer locations such as:

```text
src/vs/platform/caret/
src/vs/workbench/contrib/caret/
packages/caret-protocol/
packages/caret-agentd/
packages/caret-omp-adapter/
packages/caret-test-fixtures/
```

Rules:

- avoid broad edits to upstream core files;
- create narrow integration seams;
- keep a patch ledger;
- do not copy entire upstream modules into Caret namespaces unless unavoidable;
- feature-flag unfinished functionality;
- add tests around every patched upstream seam;
- preserve a practical path for regular Code-OSS rebases.

Maintain:

```text
docs/caret/upstream-patch-ledger.md
```

## 4.6 Security

Required security properties:

- Electron context isolation enabled;
- no unrestricted Node APIs in renderers;
- narrow typed preload bridge;
- authenticated local IPC;
- no unauthenticated public TCP listener;
- raw long-lived credentials never sent to renderer;
- secrets stored in operating-system keychain;
- secrets excluded from event logs, SQLite, transcripts, and normal logs;
- file access scoped to trusted workspace roots;
- workspace trust enforced;
- dangerous operations pass through policy and approvals;
- remote runtime identity displayed clearly;
- browser sessions isolated;
- plugin, hook, and MCP trust explicit;
- approval and remote-action audit trail.

Preferred local transport:

- Unix domain socket on macOS/Linux;
- named pipe on Windows;
- authenticated loopback WebSocket only when repository constraints make it preferable.

## 4.7 Repository safety

Before editing:

1. Inspect `git status`.
2. Preserve all existing user changes.
3. Do not reset, revert, stash, or overwrite unrelated work.
4. Read repository contribution and build instructions.
5. Use the repository’s package manager and conventions.
6. Avoid unnecessary dependencies.
7. Do not create a disconnected demo app outside the real repository.
8. Do not weaken existing tests to make new code pass.
9. Do not claim a build or test succeeded unless it was actually run.

---

# 5. Current milestone

Implement the first architecture-proving vertical slice.

Do not attempt to complete the entire Caret specification in one implementation pass.

The milestone must prove this end-to-end path:

```text
1. Caret starts.
2. caret-agentd starts or is connected.
3. The IDE exposes “Caret: Open Agents Window”.
4. A dedicated Agents Window opens.
5. Both windows connect to the same session service.
6. A local Caret session is created through AgentRuntimeAdapter.
7. One OMP runtime session, or one fixture runtime session, is associated with it.
8. A prompt is sent.
9. Structured assistant and tool events stream into Caret.
10. Events are persisted.
11. A minimal native timeline displays them.
12. A minimal composer sends a follow-up.
13. Reloading a renderer does not lose the session.
14. Reopening the session replays stored events.
15. Opening it in the IDE uses the same Caret session ID.
16. No duplicate runtime process is launched.
17. A stop or failure state is correctly represented.
18. Tests cover protocol, replay, authentication, and duplicate-launch prevention.
```

Visual polish is secondary for this milestone.

However, the structural implementation must already use the intended regions so the UI does not need to be discarded later.

---

# 6. Required implementation sequence

Follow this order unless repository inspection proves that a small dependency inversion is necessary.

## Step 1 — Repository audit

Inspect:

- repository structure;
- exact Code-OSS baseline;
- package manager;
- build scripts;
- current product configuration;
- existing branding changes;
- Electron main-process architecture;
- BrowserWindow creation;
- workbench window types;
- utility-process or daemon patterns;
- IPC conventions;
- preload APIs;
- test infrastructure;
- storage choices;
- existing AI/chat/agent features;
- existing OMP integration;
- existing ACP integration;
- existing worktree support;
- existing commands or titlebar actions;
- current dirty files and user work.

Create or update:

```text
docs/caret/repository-audit.md
docs/caret/implementation-status.md
docs/caret/upstream-patch-ledger.md
```

The repository audit should include:

```text
- Code-OSS baseline
- Current Caret changes
- Existing relevant services
- Existing OMP/ACP integration
- Candidate extension points
- Files that should not be broadly modified
- Build/test commands
- Risks and unknowns
```

Keep the audit concise and factual. Do not spend the entire task writing documentation.

## Step 2 — Shared protocol

Create a shared protocol package or module appropriate to the repository architecture.

Implement and export at minimum:

```ts
RuntimeCapabilities
ModelDescriptor
ModeDescriptor
RuntimeDescriptor
RuntimeSessionSummary
RuntimeSessionHandle
CaretAgentSession
CaretSessionStatus
CaretEvent
RuntimeEvent
AgentRuntimeAdapter
CreateSessionRequest
PromptRequest
PromptAck
ApprovalDecision
QuestionAnswer
```

Protocol requirements:

- explicit protocol version;
- semantic compatibility strategy;
- JSON-serializable messages;
- runtime validation at IPC boundaries;
- no renderer-specific objects;
- no direct OMP-internal types;
- monotonic sequence number per session;
- globally unique event ID;
- event timestamp;
- source;
- optional causation ID;
- optional correlation ID;
- idempotent event application.

Use a generic event envelope similar to:

```ts
export interface CaretEvent<
  TType extends string = string,
  TPayload = unknown
> {
  id: string;
  sessionId: string;
  sequence: number;
  type: TType;
  createdAt: number;
  source: 'user' | 'caret' | 'omp' | 'tool' | 'runtime';
  causationId?: string;
  correlationId?: string;
  payload: TPayload;
}
```

Required event families for the first slice:

```text
session.created
session.attached
session.statusChanged
session.completed
session.failed
session.cancelled

user.promptSubmitted
user.promptQueued

assistant.messageStarted
assistant.messageDelta
assistant.messageCompleted
assistant.messageInterrupted

tool.started
tool.progress
tool.approvalRequested
tool.approvalDecided
tool.completed
tool.failed
tool.cancelled

file.read
file.changed
file.diffAvailable

question.requested
question.answered
question.invalidated

runtime.connected
runtime.disconnected
runtime.reconnecting
runtime.capabilitiesChanged

run.completed
run.failed
run.cancelled
```

Define a normalized session state:

```ts
export type CaretSessionStatus =
  | 'draft'
  | 'provisioning'
  | 'starting'
  | 'running'
  | 'waitingForUser'
  | 'waitingForApproval'
  | 'steering'
  | 'paused'
  | 'reviewing'
  | 'completed'
  | 'completedWithWarnings'
  | 'failed'
  | 'cancelled'
  | 'disconnected'
  | 'recovering';
```

## Step 3 — caret-agentd

Implement the initial local agent service.

For this milestone it must own:

- authenticated client connections;
- session registry;
- runtime-session mapping;
- adapter selection;
- process supervision;
- append-only event persistence;
- event subscription;
- event replay;
- derived session state;
- graceful shutdown;
- reconnect behavior;
- explicit errors;
- prevention of duplicate runtime launch.

Required operations:

```text
handshake
listSessions
getSession
createSession
attachSession
sendPrompt
answerQuestion
decideApproval
stopSession
subscribeEvents
replayEvents
```

Persistence:

- Prefer SQLite behind an abstraction.
- If a new native SQLite dependency is incompatible with the repository build, first inspect existing storage libraries.
- Use the safest repository-compatible durable option.
- Preserve an interface that can support SQLite.
- Document any temporary storage substitution.
- Do not silently reduce persistence to renderer-local state.

Suggested initial tables:

```text
sessions
session_events
session_snapshots
runtime_bindings
approvals
questions
preferences
window_view_state
```

Delivery behavior:

- append event before publishing projection;
- at-least-once transport;
- idempotent reducer;
- monotonic per-session sequence;
- snapshot plus incremental replay;
- reconnect from `lastSequence`;
- explicit acknowledgment for user commands.

## Step 4 — OMP adapter spike

Inspect the actual OMP and ACP capabilities available in the repository and installed environment.

Attempt the most structured integration first.

The real adapter should attempt to support:

- capability handshake;
- runtime version;
- protocol version;
- model listing;
- mode listing;
- session discovery;
- local session creation;
- session attach;
- prompt sending;
- assistant streaming;
- typed tool events;
- file events;
- approval requests;
- questions;
- stop;
- completion;
- failure;
- disconnect.

Add capability discovery similar to:

```ts
export interface RuntimeCapabilities {
  protocolVersion: string;
  runtimeVersion: string;

  sessions: {
    attach: boolean;
    resume: boolean;
    parallel: boolean;
    durableHistory: boolean;
  };

  prompts: {
    queue: boolean;
    steerAtBoundary: boolean;
    hardInterrupt: boolean;
    editQueued: boolean;
  };

  tools: {
    typedEvents: boolean;
    progressEvents: boolean;
    approvals: boolean;
    cancellable: boolean;
  };

  context: {
    files: boolean;
    folders: boolean;
    symbols: boolean;
    selection: boolean;
    terminal: boolean;
    browser: boolean;
    images: boolean;
    git: boolean;
  };

  coding: {
    lsp: boolean;
    dap: boolean;
    checkpoints: boolean;
    subagents: boolean;
    worktrees: boolean;
  };

  integrations: {
    mcp: boolean;
    skills: boolean;
    rules: boolean;
    hooks: boolean;
    memory: boolean;
  };
}
```

If real integration cannot be completed in this implementation pass, create:

```text
RealOmpAdapter
FixtureOmpAdapter
Adapter contract test suite
docs/caret/omp-integration-gaps.md
```

The fixture adapter must be deterministic and realistic.

It must support at least these scenarios:

### Successful run

```text
session created
assistant message started
assistant deltas
file-search or file-read tool started
tool progress
tool completed
file changed
assistant completion
run completed
```

### Approval run

```text
tool started
approval requested
user approves
tool resumes
tool completed
run completed
```

### Failure run

```text
tool started
tool failed
assistant explains failure
run failed
```

### Connection run

```text
runtime disconnects
client reconnects
events replay from last sequence
no duplicate visible events
```

The same production services and UI must work with both adapters.

Do not add fixture-specific logic to UI components.

## Step 5 — Dual-window shell

Add these commands:

```text
Caret: Open Agents Window
Caret: Open IDE
Caret: Open Session in Agents Window
Caret: Open Session in IDE
Caret: Reveal Active Session
```

Implement a dedicated Agents BrowserWindow.

The initial structural layout must be:

```text
AgentsWindow
├── TitleBar
├── AgentNavigationSidebar
├── CenterSurface
└── AuxiliarySurface
```

### TitleBar

Initial requirements:

- platform window controls;
- draggable areas;
- back/forward placeholders or functional navigation;
- current repository or project label;
- `IDE ↗` action;
- new-task action;
- overflow menu.

### AgentNavigationSidebar

Render at least:

```text
New Chat
Search
Automations
Customize

Projects
Repositories

Account/Settings area
```

For this milestone, Projects and Repositories may use minimal real data or deterministic fixtures, but the list and selection architecture must be real and extensible.

### CenterSurface

Implement:

- Agent Home;
- minimal source/repository summary;
- minimal runtime summary;
- minimal composer;
- minimal active-session view;
- native or workbench-integrated timeline.

### AuxiliarySurface

Add structural tabs or placeholders for:

```text
Changes
Browser
Terminal
File
```

Persist logical-pixel widths.

Do not optimize pixel parity yet, but honor the reference structure and use semantic Caret theme tokens.

## Step 6 — Minimal composer

Implement a stateful composer sufficient for the vertical slice.

Required now:

- multiline prompt;
- auto-growing or usable fixed minimum height;
- send;
- stop while running;
- per-session draft;
- disabled state when disconnected;
- model label or selector backed by capabilities;
- runtime label;
- error display;
- keyboard send behavior;
- follow-up prompt.

Architect it so later additions can support:

- `@` context;
- `/` commands;
- files;
- folders;
- images;
- voice;
- mode;
- effort;
- queue;
- steering;
- context usage.

Do not use a disposable plain-text component whose state model must be completely rewritten later.

## Step 7 — Minimal active-session timeline

Implement a virtualizable or virtualization-ready typed timeline.

Required renderers:

- user prompt;
- assistant streaming narrative;
- tool started/progress/completed;
- tool failed;
- approval request and decision;
- runtime disconnected;
- run completed;
- run failed.

Requirements:

- stable event keys;
- sequence ordering;
- duplicate-event suppression;
- streaming delta batching;
- preserved scroll anchor;
- auto-scroll only when user is near the bottom;
- replay after reload;
- compact structured tool blocks rather than generic chat bubbles.

## Step 8 — Shared session behavior

Both windows must use daemon-backed shared state.

Required behavior:

- create session from Agents Window;
- list the same session in IDE services;
- open the same session in IDE;
- do not start another runtime;
- events appear in both clients;
- session status appears in both;
- stop from either client updates both;
- renderer reload reconnects using last sequence;
- one client disconnect does not terminate the session;
- runtime/session mapping persists;
- duplicate create requests are idempotent where appropriate.

Implement explicit runtime binding:

```ts
interface RuntimeBinding {
  caretSessionId: string;
  runtimeAdapterId: string;
  runtimeSessionId: string;
  processId?: number;
  createdAt: number;
  status: 'starting' | 'attached' | 'stopped' | 'failed';
}
```

## Step 9 — IDE integration

For this milestone implement at least:

- `Caret: Open Agents Window`;
- session service client;
- minimal Caret Agent sidepane or session view contribution;
- open/focus same Caret session;
- shared timeline;
- minimal composer or follow-up control;
- session status indicator.

Use the same domain model and timeline component architecture as the Agents Window.

Do not duplicate business logic.

A full inline edit, completion provider, diff review, and deep context integration belong to later milestones, but create clean extension points for them.

## Step 10 — Tests

Add automated tests for all applicable layers.

### Protocol tests

- serialization;
- validation;
- incompatible version handling;
- event ID and sequence rules;
- unknown event behavior;
- malformed message rejection.

### Reducer and projection tests

- session status transitions;
- assistant delta accumulation;
- approval state;
- tool success/failure;
- runtime disconnect/reconnect;
- duplicate event idempotency;
- out-of-order event handling policy;
- replay produces deterministic state.

### Adapter contract tests

Every runtime adapter must pass the same contract.

Test:

- handshake;
- create;
- subscribe;
- send prompt;
- assistant stream;
- tool events;
- approval;
- stop;
- completion;
- failure;
- disconnect.

### Daemon tests

- authenticated client required;
- unauthorized client rejected;
- session creation;
- event append;
- replay;
- two clients share one session;
- duplicate runtime launch prevented;
- reconnect from sequence;
- graceful shutdown;
- runtime crash updates state.

### UI/state tests

- minimal timeline renders typed events;
- duplicate event not rendered twice;
- session list updates;
- approval action sends command;
- reload restores session;
- switching window preserves session identity.

### Smoke test

Where test infrastructure permits:

- start application;
- invoke `Caret: Open Agents Window`;
- verify dedicated window exists;
- verify both clients see one session.

If graphical launch is not available in the current environment:

1. Add the automated test to the repository where appropriate.
2. Document the exact manual command and expected behavior.
3. Do not claim the smoke test passed.

---

# 7. Visual and naming requirements for the first milestone

Use Caret identity everywhere.

Do not ship:

- Cursor logo;
- Cursor cube icon;
- Cursor name;
- copied proprietary graphics;
- claims of Cursor endorsement;
- Microsoft distribution identity that is inappropriate for the fork.

Recommended product identifiers:

```text
Product name: Caret
CLI: caret
URI scheme: caret://
User directory: ~/.caret
Project configuration: .caret/
```

Define Caret semantic theme tokens rather than scattering hardcoded colors:

```css
--caret-surface-base;
--caret-surface-sidebar;
--caret-surface-raised;
--caret-surface-hover;
--caret-surface-selected;
--caret-border-subtle;
--caret-border-strong;
--caret-text-primary;
--caret-text-secondary;
--caret-text-disabled;
--caret-focus-ring;
--caret-success;
--caret-warning;
--caret-error;
--caret-info;
--caret-diff-added;
--caret-diff-removed;
--caret-shadow;
```

Use `caret-ui-reference-baseline.json` as a starting point only.

Do not hardcode screenshot-capture pixels as logical layout values.

---

# 8. Explicitly deferred from the first milestone

Do not allow these to block the vertical slice:

- full pixel parity;
- production cloud runtime;
- SSH runtime;
- self-hosted worker;
- complete worktree lifecycle;
- full Git review;
- full Monaco diff surface;
- Plan Mode;
- Debug Mode;
- Browser and Design Mode;
- complete Rules/Skills/MCP UI;
- automations engine;
- mobile/PWA;
- team controls;
- billing;
- production inline completion;
- complete remote control;
- every error state from the final specification.

However:

- preserve extension points;
- do not make architectural decisions that prevent these features;
- record deferred items in `docs/caret/implementation-status.md`;
- do not mark the overall specification complete.

---

# 9. Initial acceptance criteria

Do not declare this milestone complete until all applicable criteria are met.

## 9.1 Repository and architecture

- [ ] Repository audit is complete.
- [ ] Existing user changes are preserved.
- [ ] Code-OSS baseline is recorded.
- [ ] Caret changes are isolated.
- [ ] Upstream patch ledger exists.
- [ ] UI does not depend directly on OMP internals.
- [ ] No terminal/TUI scraping exists.
- [ ] A versioned shared protocol exists.
- [ ] Agents Window is not one giant webview.
- [ ] Renderer does not own the OMP process.

## 9.2 Runtime and daemon

- [ ] `caret-agentd` or equivalent service exists.
- [ ] Local IPC requires authentication.
- [ ] At least one adapter passes the contract tests.
- [ ] Real versus fixture behavior is explicitly documented.
- [ ] A session can be created.
- [ ] A prompt can be sent.
- [ ] Structured events are received.
- [ ] Events are persisted.
- [ ] Events are replayed.
- [ ] Stop is represented.
- [ ] Failure is represented.
- [ ] Duplicate runtime launch is prevented.
- [ ] Renderer reload does not terminate the runtime.

## 9.3 Windows

- [ ] IDE exposes `Caret: Open Agents Window`.
- [ ] Dedicated Agents Window opens.
- [ ] Agents Window has titlebar, navigation, center, and auxiliary regions.
- [ ] Both windows connect to the same session service.
- [ ] The same session can open in both windows.
- [ ] Opening the session in both windows does not duplicate the runtime.
- [ ] Session status updates in both windows.

## 9.4 UI

- [ ] Minimal Agent Home exists.
- [ ] Minimal composer exists.
- [ ] Minimal typed timeline exists.
- [ ] Streaming assistant text works.
- [ ] Tool blocks render.
- [ ] Approval UI works against the adapter.
- [ ] Completed and failed states render.
- [ ] Replayed events render the same state.
- [ ] Basic keyboard and focus behavior works.

## 9.5 Persistence and correctness

- [ ] Renderer reload does not lose the session.
- [ ] Stored events reproduce deterministic derived state.
- [ ] Duplicate event delivery does not duplicate timeline rows.
- [ ] Credentials do not appear in persisted events.
- [ ] Session/runtime binding survives reconnect.
- [ ] One disconnected client does not stop the session.

## 9.6 Verification

- [ ] Relevant build passes.
- [ ] Type checking passes for touched code.
- [ ] Formatting passes.
- [ ] Linting passes for touched code.
- [ ] New unit tests pass.
- [ ] New integration tests pass.
- [ ] Existing unrelated tests were not weakened.
- [ ] Smoke test was run, or its environmental limitation is honestly stated.
- [ ] Documentation distinguishes implemented, fixture, blocked, and deferred behavior.

---

# 10. Working style

Follow these rules throughout the task.

1. Start by reading the attached specification and inspecting the repository.
2. Inspect before assuming.
3. Present a concise implementation plan before editing.
4. The plan must include:
   - repository findings;
   - modules to add;
   - existing files requiring narrow modifications;
   - dependencies;
   - risks;
   - verification commands.
5. Begin implementation immediately after the plan.
6. Do not wait for confirmation after presenting the plan.
7. Make small, coherent changes.
8. Run the narrowest relevant tests after each substantial layer.
9. Prefer reversible architectural decisions.
10. Avoid speculative broad refactors.
11. Do not spend the first pass on visual polish.
12. Do not create a separate toy frontend.
13. Do not duplicate business logic between windows.
14. Do not silently omit difficult requirements.
15. Ask a question only when a decision is genuinely blocking and cannot be resolved through:
    - repository inspection;
    - attached specification;
    - existing tests;
    - available documentation in the repository.
16. When several valid solutions exist, choose the most upstream-friendly one.
17. Document important deviations.
18. Keep exact truth about what is implemented.
19. Never claim real OMP integration when only the fixture adapter works.
20. Never claim a command or test passed unless it was actually run.

---

# 11. Required implementation-status document

Maintain:

```text
docs/caret/implementation-status.md
```

Use this structure:

```markdown
# Caret Implementation Status

## Current milestone

## Completed

## In progress

## Real OMP integration

## Fixture-only functionality

## Blocked

## Deferred

## Architecture decisions

## Deviations from specification

## Tests and verification

## Next recommended slice
```

Update it before finishing the task.

---

# 12. Required completion report

At the end of the implementation pass, provide a factual completion report.

## 12.1 Repository findings

Report:

- exact Code-OSS baseline;
- existing Caret modifications;
- existing OMP integration;
- existing ACP integration;
- important architectural constraints;
- dirty files that were preserved.

## 12.2 Implemented

Report:

- features completed;
- services created;
- protocol types created;
- commands created;
- windows created;
- tests added;
- major files added or modified.

## 12.3 Real versus fixture functionality

Use explicit sections:

```text
Real OMP functionality
Fixture adapter functionality
Incomplete real adapter methods
Unavailable or blocked OMP capabilities
```

Do not blur these categories.

## 12.4 Architecture decisions

List:

- IPC choice;
- persistence choice;
- adapter transport;
- window implementation;
- state synchronization;
- relevant deviations from the specification.

## 12.5 Verification

List every command actually run and its result.

Use this format:

```text
Command:
<exact command>

Result:
<passed / failed / partially completed>

Notes:
<relevant output or limitation>
```

Include where applicable:

- dependency installation;
- build;
- type check;
- lint;
- formatting;
- unit tests;
- integration tests;
- Electron tests;
- launch;
- manual smoke test.

## 12.6 Remaining gaps

List concrete remaining work.

Do not use vague statements such as “needs polish.”

Identify:

- exact missing capability;
- affected module;
- blocking dependency;
- proposed next action.

## 12.7 Recommended next slice

Provide one exact next implementation slice with:

- goal;
- scope;
- expected files;
- dependencies;
- acceptance criteria;
- verification commands.

The likely next slice after this milestone is:

```text
Repository/worktree registry
→ real changed-file projection
→ Changes auxiliary surface
→ Monaco diff
→ file-open handoff to IDE
→ checkpoint foundation
```

Adjust this only if repository findings justify a different dependency order.

---

# 13. Start instruction

Begin now.

First:

1. Read all attached Caret documents.
2. Inspect the repository and `git status`.
3. Identify the exact Code-OSS baseline and existing Caret/OMP integration.
4. Write the concise implementation plan.
5. Immediately implement the architecture-proving vertical slice.
6. Run relevant tests.
7. Update `docs/caret/implementation-status.md`.
8. Finish with the required factual completion report.

Do not stop after planning.
