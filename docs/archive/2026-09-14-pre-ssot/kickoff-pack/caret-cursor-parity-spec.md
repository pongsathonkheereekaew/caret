---
title: "Caret — Cursor-Style Dual-Window Product Specification"
subtitle: "Code-OSS fork with Oh My Pi (OMP) as the agent harness"
version: "2.0"
status: "Implementation-ready blueprint"
date: "2026-09-14"
target_product: "Caret"
reference_surfaces:
  - "Cursor Agents Window"
  - "Cursor classic IDE"
primary_runtime: "Oh My Pi (OMP)"
---

# Caret — Cursor-Style Dual-Window Product Specification

## 0. Executive decision

Caret should be built as **one desktop product with two coordinated windows**:

1. **Caret Agents Window** — an agent-first command center for creating, supervising, reviewing, and handing off many OMP tasks.
2. **Caret IDE Window** — the normal Code-OSS workbench, enhanced with Caret Agent, inline-edit, review, terminal, browser, and session controls.

The two windows must not be two unrelated applications. They must share one session service, one event log, one repository/worktree registry, and one set of OMP processes. Opening a task in the IDE must reveal the same task, transcript, approvals, queue, runtime, branch, and artifacts that are visible in the Agents Window.

The implementation boundary is:

```text
Caret owns:
- desktop windows and workbench integration
- UI, navigation, state projections, persistence, and visual parity
- repository/worktree lifecycle
- browser, terminal, diff, review, notification, and mobile-control surfaces
- runtime capability discovery and policy
- optional inline-completion service

OMP owns:
- agent loop
- model/provider selection and model-specific prompting
- tool reasoning
- subagents
- LSP/DAP-aware coding behavior
- memory and rules supported by OMP
- execution semantics

Caret must never become a second hidden harness competing with OMP.
```

## 1. Answer to the window question

Yes: the current Cursor desktop product exposes an **Agents Window** and a **classic IDE**, and they can be open at the same time. Caret should reproduce this product model.

### Required Caret commands

```text
Caret: Open Agents Window
Caret: Open IDE
Caret: Open Session in Agents Window
Caret: Open Session in IDE
Caret: Move Session to This Window
Caret: Reveal Active Session
```

### Required titlebar controls

**Agents Window**

- Back / forward navigation.
- Current project or repository indicator.
- `IDE ↗` button.
- More-actions menu.
- New task button.
- Window/layout controls.
- Caret account/status area where relevant.

**IDE Window**

- Normal Code-OSS titlebar and menus.
- Workspace title.
- Layout controls.
- `Agents Window ↗` button.
- Agent/session status icon.
- Notifications and settings.

## 2. Product goals

### 2.1 Primary goal

Deliver a Caret experience that has the same high-level completeness and interaction quality as Cursor while using OMP as the runtime:

- agent-first home;
- multi-session supervision;
- rich composer;
- typed execution timeline;
- local, worktree, SSH, self-hosted, and future cloud runtimes;
- browser and design workflows;
- changes, review, commit, and pull-request workflows;
- plan and debug workflows;
- rules, skills, MCP, hooks, subagents, and commands;
- full IDE integration;
- state-preserving movement between windows.

### 2.2 Non-goals

- Reimplementing OMP's agent loop.
- Parsing OMP's terminal UI or ANSI output as a protocol.
- Rebuilding Monaco, terminals, Git, file watching, or extension hosting.
- Shipping Cursor branding, logo assets, product name, or proprietary service endpoints.
- Pretending that OMP alone supplies low-latency Cursor-style Tab completion; Caret needs a separate completion-provider abstraction for that feature.
- Building cloud orchestration before the local vertical slice is reliable.

### 2.3 Product principles

1. **Native workbench first.** Use Code-OSS services and components; use webviews only for actual web content.
2. **One source of truth.** OMP is authoritative for agent execution; Caret's event store is authoritative for UI replay and window synchronization.
3. **Capability-driven UI.** Hide or disable controls based on runtime capabilities rather than assuming every OMP transport supports every function.
4. **Structured events, never terminal scraping.**
5. **Local-first, cloud-ready.**
6. **Worktree-by-default for parallel tasks.**
7. **Every polished state needs loading, disconnected, partial, failed, and recovery states.**
8. **Upstream-friendly fork.** Keep Caret changes isolated so Code-OSS updates remain manageable.
9. **Caret identity.** Match layout and workflow quality while using original branding, icons, strings, and assets.

## 3. Scope and parity tiers

### P0 — Local desktop parity

P0 is the first commercially usable Caret desktop:

- dual windows;
- shared sessions;
- local OMP launch/attach/resume;
- repository and branch selection;
- optional worktree creation;
- Agent Home;
- active session timeline;
- model/mode/effort controls backed by OMP capabilities;
- context attachments;
- queue and steering;
- approvals and questions;
- files, terminal, changes, diff, checkpoints;
- IDE agent sidepane;
- open file/diff/terminal from timeline;
- session search;
- rules/skills/MCP basic management;
- Caret branding and updater;
- visual regression suite.

### P1 — Advanced local workflows

- Plan Mode.
- Debug Mode.
- Agent Review.
- Browser preview and browser tools.
- Design Mode.
- OMP subagent visualization.
- hooks and plugin management.
- multi-repository tasks.
- no-repository scratch tasks.
- local automations.
- secure local mobile/PWA supervision.
- richer notifications and Needs You inbox.

### P2 — Distributed platform parity

- SSH runtime.
- Caret self-hosted worker.
- managed cloud worker.
- cloud/local handoff.
- remote worktree and environment management.
- scheduled/event-driven automations.
- integrations such as GitHub, GitLab, Slack, Linear, and webhooks.
- team policies, shared plugins, usage, billing, and admin controls.
- native mobile client if the PWA is insufficient.

## 4. Reference baseline

### 4.1 Frozen reference configuration

Before pixel-level implementation, record:

```yaml
cursor_build: exact stable version and commit/build identifier
capture_date: 2026-09-14
primary_os: macOS
secondary_os: Windows 11
tertiary_os: one Linux environment
theme: exact dark theme shown in references
zoom: 100 percent
display_scale: 2x for supplied screenshots
reference_images:
  - Screenshot 2569-09-14 at 21.33.09.png
  - Screenshot 2569-09-14 at 21.33.23.png
fixture_repository: deterministic Caret UI fixture
network_profiles:
  - online
  - offline
  - reconnecting
runtime_profiles:
  - local
  - worktree
  - ssh
  - self_hosted
  - unavailable
```

### 4.2 Measurements from the supplied Agent Window screenshot

The attached Agent Window image is `2048 × 1331` captured pixels. Treat the following as a sampling baseline, not final hardcoded values:

| Region | Approximate captured coordinate | Ratio |
|---|---:|---:|
| Left navigation divider | `x ≈ 320` | `15.6%` |
| Right utility-pane divider | `x ≈ 1587` | `77.5%` from left |
| Main titlebar divider | `y ≈ 47` | `3.5%` |
| Center work area | `x ≈ 320–1587` | `61.9%` |
| Right utility pane | `x ≈ 1587–2048` | `22.5%` |

At a 2× Retina capture these correspond roughly to half as many logical pixels. Use ratios and measured logical geometry from the actual app rather than dividing blindly.

### 4.3 Sample dark-theme colors

| Token | Sample |
|---|---|
| Agent center surface | `#141415` |
| Agent navigation surface | `#161719` |
| Agent composer surface | `#212121` |
| IDE workbench surface | `#181818` |
| IDE/titlebar surface | `#141414` |
| Subtle border family | `#252626` to `#29292B` |

Create semantic tokens and map them through the Code-OSS theme service:

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

### 4.4 Pixel-parity rule

The supplied screenshots cover only two empty/home states. They do not define all interactions. Build a frozen-state atlas of at least 100 screens before declaring parity.

## 5. Top-level architecture

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           Caret Electron Main                           │
│                                                                         │
│  Window lifecycle · native menus · deep links · updater · credentials  │
│                                                                         │
│   ┌────────────────────────┐       ┌─────────────────────────────────┐  │
│   │ Caret IDE BrowserWindow│       │ Caret Agents BrowserWindow     │  │
│   │ Code-OSS workbench     │       │ Code-OSS-based agent shell     │  │
│   └────────────┬───────────┘       └───────────────┬─────────────────┘  │
│                │ authenticated local IPC           │                    │
│                └───────────────────┬────────────────┘                    │
│                                    ▼                                     │
│                         Caret Agent Service                              │
│                     local daemon / utility process                      │
│                                                                         │
│  ┌────────────────┬─────────────────┬──────────────────┬──────────────┐ │
│  │ OMP Adapter    │ Event Store     │ Worktree/Git     │ Policy       │ │
│  │ + transports   │ + projections   │ + checkpoints    │ + approvals  │ │
│  └────────────────┴─────────────────┴──────────────────┴──────────────┘ │
│  ┌────────────────┬─────────────────┬──────────────────┬──────────────┐ │
│  │ PTY registry   │ Browser bridge  │ Artifact store   │ Notifications│ │
│  └────────────────┴─────────────────┴──────────────────┴──────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────┐
                    │ Oh My Pi runtime(s)             │
                    │ local / worktree / SSH / worker │
                    └─────────────────────────────────┘
```

### 5.1 Why the agent service is separate

A separate daemon or utility process gives Caret:

- one session source for multiple windows;
- survival across renderer reloads;
- reconnection and event replay;
- clean OMP process ownership;
- safe credential and approval boundaries;
- mobile/PWA access without embedding a web server in the renderer;
- easier support for remote runtimes;
- deterministic integration testing.

### 5.2 Local transport

Preferred transport between renderers and `caret-agentd`:

- Unix domain socket on macOS/Linux;
- named pipe on Windows;
- authenticated loopback WebSocket as fallback.

Main process generates a short-lived per-install secret and passes it to trusted windows through the preload bridge. Never expose an unauthenticated port.

### 5.3 Window implementation strategy

Do not build the entire Agents Window in one giant webview.

Use a Code-OSS workbench window configured for the Agents shell:

- native/custom titlebar;
- hidden activity bar unless needed;
- custom left sidebar view container;
- center area implemented as native `EditorPane` instances;
- native auxiliary sidebar for Changes, Browser, Terminal, and File;
- no normal status bar in the Agent Home reference state;
- native quick input, command palette, notifications, dialogs, context menus, keybindings, and accessibility tree.

The IDE Window remains close to upstream Code-OSS and receives Caret contributions rather than a parallel editor implementation.

## 6. OMP integration contract

### 6.1 Core rule

The UI must never import OMP internals directly. All OMP interaction goes through `AgentRuntimeAdapter`.

```ts
export interface AgentRuntimeAdapter {
  handshake(): Promise<RuntimeCapabilities>;

  listModels(): Promise<ModelDescriptor[]>;
  listModes(): Promise<ModeDescriptor[]>;
  listSessions(): Promise<RuntimeSessionSummary[]>;

  createSession(input: CreateSessionRequest): Promise<RuntimeSessionHandle>;
  attachSession(runtimeSessionId: string): Promise<RuntimeSessionHandle>;
  resumeSession(runtimeSessionId: string): Promise<void>;

  subscribe(
    runtimeSessionId: string,
    fromSequence: number | undefined,
    sink: (event: RuntimeEvent) => void
  ): Promise<Unsubscribe>;

  sendPrompt(
    runtimeSessionId: string,
    input: PromptRequest
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

  stop(runtimeSessionId: string): Promise<void>;
  pause?(runtimeSessionId: string): Promise<void>;
  cancelTool?(runtimeSessionId: string, toolCallId: string): Promise<void>;

  disposeSession?(runtimeSessionId: string): Promise<void>;
}
```

### 6.2 Transport priority

Implement transports behind the same adapter:

1. **Structured OMP bridge transport — preferred.** A small OMP-side plugin/bridge emits typed JSON events and accepts commands.
2. **ACP transport — required.** Use OMP's ACP integration for editor-aware operation and permissions.
3. **CLI JSON/RPC transport — fallback.** Only if OMP offers a stable machine-readable mode.
4. **Never:** parse TUI text, ANSI escape sequences, or screen contents.

### 6.3 Capability handshake

```ts
interface RuntimeCapabilities {
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

Every menu item must be capability-gated. A disabled item must explain why it is unavailable and which OMP/runtime version is required.

### 6.4 Session modes

Caret supports two local OMP execution modes:

**IDE-bound ACP session**

- Reads active editor context.
- Writes through the editor save path.
- Uses IDE terminal integration.
- Best when the user is actively coding in the IDE.

**Detached worker session**

- Runs from `caret-agentd`.
- Uses its worktree, own LSP/DAP/tool environment, and PTY.
- Continues when the IDE window closes.
- Best for the Agents Window and parallel/background work.

The same Caret session may be handed off between these modes only when the adapter confirms a safe boundary.

### 6.5 Model selection

Caret's model picker queries OMP. It must not maintain an independent hardcoded provider catalog.

```ts
interface ModelDescriptor {
  id: string;
  providerId: string;
  label: string;
  contextWindow?: number;
  supportsVision: boolean;
  supportsTools: boolean;
  supportedEfforts?: string[];
  availability: 'available' | 'authRequired' | 'unavailable' | 'rateLimited';
  unavailableReason?: string;
}
```

### 6.6 Versioning

- Define `caret.runtime.protocol` with semantic versions.
- Reject incompatible major versions with a clear repair action.
- Maintain a compatibility matrix in CI.
- Pin tested OMP versions in releases.
- Run adapter contract tests against the oldest and newest supported OMP versions.

## 7. Shared domain model and event protocol

### 7.1 Session state

```ts
type CaretSessionStatus =
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

interface CaretAgentSession {
  id: string;
  runtimeSessionId?: string;

  projectId?: string;
  workspaceId?: string;
  repositoryIds: string[];
  worktreeId?: string;

  title: string;
  status: CaretSessionStatus;

  runtimeId: string;
  modelId: string;
  modeId: string;
  effortId?: string;

  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;

  activePlanId?: string;
  activeReviewId?: string;
  activeBrowserSessionId?: string;
  activeTerminalIds: string[];

  queuedPromptIds: string[];
  lastAppliedEventSequence: number;
}
```

### 7.2 Event envelope

```ts
interface CaretEvent<TType extends string, TPayload> {
  id: string;                 // ULID or UUIDv7
  sessionId: string;
  sequence: number;           // monotonic per session
  type: TType;
  createdAt: number;
  source: 'user' | 'caret' | 'omp' | 'tool' | 'runtime';
  causationId?: string;
  correlationId?: string;
  payload: TPayload;
}
```

Delivery semantics:

- at-least-once transport;
- idempotent reducers;
- monotonic per-session sequence;
- snapshot + replay;
- reconnect from `lastSequence`;
- append first, project second;
- user commands receive explicit acknowledgment.

### 7.3 Required event families

```text
session.created
session.attached
session.statusChanged
session.titleChanged
session.runtimeChanged
session.completed
session.failed
session.cancelled

user.promptDrafted
user.promptSubmitted
user.promptQueued
user.promptReordered
user.promptEdited
user.promptDeleted
user.promptSteered

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
file.created
file.changed
file.renamed
file.deleted
file.diffAvailable
file.conflictDetected

terminal.created
terminal.commandStarted
terminal.output
terminal.commandCompleted
terminal.stopped

browser.created
browser.navigated
browser.action
browser.consoleEvent
browser.networkEvent
browser.screenshotCreated
browser.recordingCreated
browser.elementSelected

checkpoint.created
checkpoint.restoreStarted
checkpoint.restored
checkpoint.restoreFailed

question.requested
question.answered
question.invalidated

subagent.started
subagent.progress
subagent.completed
subagent.failed

plan.started
plan.questionRequested
plan.updated
plan.ready
plan.buildStarted

debug.hypothesisCreated
debug.instrumentationAdded
debug.reproductionRequested
debug.logsReceived
debug.rootCauseFound
debug.fixApplied
debug.cleanupCompleted

review.started
review.findingCreated
review.findingResolved
review.completed

runtime.connected
runtime.disconnected
runtime.reconnecting
runtime.capabilitiesChanged
```

### 7.4 Projections

Build separate read models for:

- navigation tree;
- session list;
- Needs You inbox;
- timeline;
- queue;
- tool state;
- changed files;
- completion summary;
- checkpoints;
- browser artifacts;
- terminal list;
- worktree status;
- review findings;
- plan document;
- runtime status;
- notification center;
- search index.

## 8. Agents Window product specification

## 8.1 Global layout

```text
AgentsWindow
├── NativeTitleBar
├── AgentNavigationSidebar
├── CenterSurface
│   ├── AgentHome
│   ├── Session
│   ├── Search
│   ├── Automations
│   ├── Customize
│   └── Settings
└── AuxiliarySurface
    ├── Changes
    ├── Browser
    ├── Terminal
    └── File
```

The center and auxiliary surfaces are resizable. Persist logical-pixel widths per monitor profile.

### 8.2 Left navigation sidebar

Match the hierarchy shown in the supplied screenshot:

```text
New Chat
Search
Automations
Customize

Projects
  + New Project
  project groups and agent runs

Repositories
  filter
  add/clone
  repository rows

flexible spacer

Getting Started
account/profile
settings
```

Required row states:

- default;
- hover;
- keyboard focus;
- selected;
- running;
- waiting;
- ready for review;
- completed;
- failed;
- unread;
- archived;
- disabled;
- context menu open;
- inline rename.

Required project/repository actions:

- add local folder;
- clone repository;
- create repository;
- connect remote;
- reveal in Finder/Explorer;
- open in IDE;
- new agent task;
- rename display name;
- pin/unpin;
- archive;
- remove from Caret without deleting files;
- delete worktree with confirmation;
- refresh status;
- manage trusted workspace.

### 8.3 Agent Home / New Chat

Reference layout:

- repository selector;
- branch/worktree selector;
- runtime selector (`This Mac`, worktree, SSH, self-hosted, cloud);
- centered composer;
- effort selector;
- voice button;
- prompt suggestions;
- quick toggles such as Plan, Multitask, and Run remotely;
- right-side quick access for Changes, Browser, Terminal, and File.

Required source states:

- current repo;
- another local repo;
- multiple repos;
- start from scratch;
- clone;
- new folder;
- existing worktree;
- no repository;
- missing folder;
- untrusted folder;
- authentication required;
- indexing;
- unsupported filesystem;
- permission denied.

Required runtime states:

- online;
- busy;
- sleeping;
- disconnected;
- reconnecting;
- unavailable;
- capability mismatch;
- version mismatch;
- auth required;
- worker upgrade required.

### 8.4 Composer

The composer is a stateful editor, not a textarea.

```text
AgentComposer
├── ContextChips
├── RichPromptEditor
├── InlineAutocomplete
├── Footer
│   ├── AddContext
│   ├── Mode
│   ├── Model
│   ├── Effort
│   ├── Runtime
│   ├── ContextUsage
│   ├── Voice
│   └── Send/Stop
└── Queue
```

Required behavior:

- auto-growing height;
- maximum height and internal scroll;
- Markdown-aware paste;
- code-aware paste;
- image paste and drag/drop;
- file/folder drag/drop;
- IME-safe composition;
- undo/redo;
- per-session draft persistence;
- recovery after renderer reload;
- stable caret during streaming updates;
- keyboard navigation;
- attachment progress/error/retry;
- context invalidation when branch/runtime changes;
- slash commands;
- `@` context mentions;
- voice transcription;
- empty prompt validation;
- oversized context warning.

#### `@` context groups

- files;
- folders;
- symbols;
- current selection;
- open editors;
- terminals;
- Git diff;
- branch/commit;
- previous sessions;
- browser page;
- browser element;
- rules;
- skills;
- MCP resources;
- documentation;
- images;
- recent context.

#### `/` command groups

- Plan;
- Debug;
- Agent Review;
- Goal;
- skills;
- custom commands;
- automations;
- worktree commands;
- model/runtime actions;
- user-defined workflows.

### 8.5 Queue and steering

Default Caret contract:

| State | Enter | Cmd/Ctrl+Enter | Tab |
|---|---|---|---|
| Idle | Send | Send | normal completion |
| Running | Queue | Steer at next safe boundary | queue/defer |
| Waiting for input | Submit answer | Submit immediately | navigate |
| Completed | Follow-up | Follow-up | normal completion |

Support:

- queue count;
- drag reordering;
- edit/delete queued prompts;
- send next now;
- clear queue;
- attachment preview;
- queue restoration;
- invalidation warnings;
- explicit hard interrupt separate from steering;
- stop active run with confirmation where destructive.

### 8.6 Active session

```text
ActiveSession
├── SessionHeader
├── VirtualizedTimeline
├── PendingQueue
└── ComposerDock
```

Session header:

- editable title;
- project/repository;
- branch/worktree;
- runtime and connection;
- model/mode/effort;
- elapsed time;
- context usage;
- Open in IDE;
- Review Changes;
- Create PR;
- Stop/Pause;
- overflow actions.

Timeline event renderers:

- user prompt;
- assistant narrative;
- thinking/working indicator where permitted;
- search/read/edit/file operation;
- terminal command;
- browser action/artifact;
- test/lint/build result;
- MCP call;
- subagent;
- approval;
- question;
- checkpoint;
- plan/debug/review events;
- error/retry;
- completion summary.

Do not render all activity as chat bubbles. Tool and artifact events are structured, compact, expandable blocks.

### 8.7 Tool block states

```ts
type ToolStatus =
  | 'queued'
  | 'running'
  | 'awaitingApproval'
  | 'succeeded'
  | 'failed'
  | 'cancelled';
```

Every block can show:

- icon and operation name;
- concise summary;
- target path/command/URL;
- elapsed time;
- live detail;
- expand/collapse;
- open related surface;
- retry;
- copy diagnostic;
- cancellation;
- approval controls where relevant.

### 8.8 Questions and approvals

Question types:

- single choice;
- multiple choice;
- free text;
- path/file picker;
- confirmation;
- secret request routed through secure UI.

Approval scopes:

- once;
- for this session;
- for this workspace;
- policy-managed/disabled.

Never expose raw credentials in transcript events.

### 8.9 Checkpoints

Checkpoint behavior:

- created automatically before significant mutation batches;
- optional manual checkpoint;
- preview changed files;
- restore with confirmation;
- restoration creates a new event/checkpoint;
- conversation remains;
- file restoration failure is recoverable;
- distinguish Caret checkpoints from Git commits.

### 8.10 Completion summary

Required sections:

- outcome;
- summary;
- files changed;
- additions/deletions;
- tests/lint/build;
- warnings and skipped validation;
- browser screenshots/recordings;
- unresolved questions;
- review findings;
- worktree/branch status;
- next actions.

Actions:

- review changes;
- open in IDE;
- continue;
- rerun validation;
- create commit;
- create PR;
- apply worktree to main;
- restore checkpoint;
- copy/export summary;
- archive.

### 8.11 Right auxiliary surface

The home-state cards shown in the screenshot become persistent surface tabs:

**Changes**

- changed-file tree;
- summary counts;
- stage/unstage/discard;
- unified/side-by-side diff;
- review status;
- commit/PR controls.

**Browser**

- page preview;
- address bar;
- back/forward/reload;
- device/viewport;
- console/network indicators;
- screenshot/recording;
- Design Mode.

**Terminal**

- terminal tabs;
- OMP command output;
- user shells;
- working-directory/runtime badge;
- open in IDE terminal.

**File**

- read-only or editable Monaco editor;
- breadcrumbs;
- symbol navigation;
- open in IDE;
- ask agent about selection.

At narrow widths, turn the auxiliary surface into a tab/drawer rather than squeezing the composer.

### 8.12 Search

Search over:

- titles;
- user messages;
- assistant summaries;
- tool summaries;
- file paths;
- branches/worktrees;
- review findings;
- artifacts.

Filters:

- project;
- repo;
- status;
- date;
- model;
- runtime;
- mode;
- changed file;
- local/remote;
- archived.

Use SQLite FTS5 or equivalent. Search results open the exact session and event anchor.

### 8.13 Automations

The UI should support:

- automation list;
- enabled/paused/failed states;
- create/edit/clone/delete;
- schedule and event triggers;
- repository scope: none/one/many;
- branch;
- runtime;
- model/mode;
- instructions;
- allowed tools/MCP;
- permissions;
- last/next run;
- run history;
- retry;
- manual run.

P1 may execute locally. P2 can add distributed/cloud workers and external triggers.

### 8.14 Customize

Caret Customize unifies:

- plugins;
- rules;
- skills;
- commands;
- subagents;
- hooks;
- MCP servers;
- model/runtime defaults.

Use Caret-native paths:

```text
~/.caret/
.caret/
AGENTS.md
```

Offer import compatibility for existing `.cursor`, Claude Code, Codex, and OMP-supported formats without making `.cursor` the Caret source of truth.

Each item needs:

- source and scope;
- enabled state;
- trust status;
- permissions;
- version;
- update state;
- diagnostics;
- reveal/edit;
- uninstall;
- runtime compatibility.

### 8.15 Settings

Suggested structure:

```text
General
Profile
Models & Providers
Agents
Inline Completion
Rules
Skills & Commands
Subagents
MCP & Integrations
Hooks & Plugins
Git & Pull Requests
Browser & Preview
Local Execution
SSH & Remote Machines
Self-Hosted Workers
Cloud Execution
Automations
Security & Privacy
Usage
Editor
Themes
Keyboard Shortcuts
Updates
About
```

## 9. IDE Window product specification

## 9.1 Preserve the Code-OSS workbench

Required regions:

- titlebar;
- activity bar;
- primary sidebar;
- editor groups;
- auxiliary sidebar;
- bottom panel;
- status bar.

Do not rebuild these regions.

### 9.2 Caret welcome screen

Replace all Microsoft/Cursor identity with Caret:

- Caret original logo;
- product name;
- plan/account state if applicable;
- Settings link;
- Open project;
- Clone repository;
- Connect via SSH;
- recent workspaces;
- recent agent tasks;
- Open Agents Window.

### 9.3 Agent auxiliary sidepane

Reuse the same timeline, tool blocks, queue, and composer components as the Agents Window with a compact layout.

Behavior:

- resizable;
- left or right placement where Code-OSS permits;
- persisted width;
- compact header;
- aggressive auto-collapse;
- composer docked at bottom;
- change count and review action;
- switch/open in Agents Window;
- no transcript reload during shell switch.

### 9.4 Inline Edit

Default shortcut: `Cmd/Ctrl+K`.

Flow:

1. Read current selection or cursor context.
2. Show inline prompt.
3. Create a one-shot OMP edit request or a dedicated lightweight runtime request.
4. Stream proposed edit into Monaco's inline diff.
5. Accept, reject, regenerate, or continue in Agent.
6. Preserve undo stack and selections.

The implementation must be adapter-backed; do not bypass policy or write directly from an untrusted model response.

### 9.5 Caret Tab / inline completion

Cursor-style predictive completion is a separate latency-sensitive product path. Define:

```ts
interface InlineCompletionProvider {
  provide(request: InlineCompletionRequest): Promise<InlineCompletionResult>;
  accept(id: string, acceptedRange: Range): Promise<void>;
  reject(id: string): Promise<void>;
}
```

P0 options:

- disable with a clear capability message;
- use an existing compatible completion provider;
- add a Caret-owned low-latency completion service.

Do not route each keystroke through a full OMP agent session.

Status bar:

```text
Caret Tab
Tab Stats
Agent Stats
Git/branch status
Runtime/session status
```

### 9.6 IDE context integration

Agent context sources:

- active file;
- selection;
- open editors;
- diagnostics;
- symbols;
- problems;
- Git diff;
- terminal output;
- debug state;
- test results;
- browser preview;
- workspace folder;
- extension-provided context.

### 9.7 Source Control and review

Add Caret commands to Source Control:

- Review Changes;
- Quick Review;
- Deep Review;
- Ask Agent to Fix Finding;
- Open in Agents Window;
- Create Agent Task from Selection;
- Create PR.

### 9.8 IDE/Agents handoff

When opening the same session in the other window, preserve:

- session and queue;
- timeline anchor;
- composer draft;
- expanded tool blocks;
- selected changed file;
- diff scroll position;
- active editor/file;
- cursor and selection;
- active terminal;
- browser URL;
- worktree;
- model/mode/runtime;
- pending approval/question.

Shell-specific layout is stored separately; session state is shared.

## 10. Changes, diff, review, and Git

### 10.1 Review surface

```text
ReviewSurface
├── Header
├── ChangedFilesTree
├── DiffToolbar
├── MonacoDiffEditor
├── FindingsOverlay
└── FooterActions
```

Changed-file states:

- modified;
- added;
- deleted;
- renamed;
- conflict;
- binary;
- generated;
- ignored;
- externally changed;
- superseded.

Diff controls:

- unified/side-by-side;
- ignore whitespace;
- collapse unchanged;
- next/previous file;
- next/previous finding;
- mark reviewed;
- revert hunk/file;
- copy patch;
- ask OMP about selection.

### 10.2 Agent Review

Review depth:

- Quick;
- Deep;
- custom runtime/model where supported.

Finding model:

```ts
interface ReviewFinding {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  explanation: string;
  fileUri: string;
  startLine: number;
  endLine: number;
  suggestedPatch?: string;
  status: 'open' | 'fixing' | 'resolved' | 'dismissed' | 'stale';
}
```

### 10.3 Worktrees

Each parallel session should default to an isolated Git worktree.

```ts
interface CaretWorktree {
  id: string;
  repositoryId: string;
  sessionId?: string;
  path: string;
  branch: string;
  baseRef: string;
  status: 'creating' | 'ready' | 'dirty' | 'conflict' | 'missing' | 'deleting';
  ahead: number;
  behind: number;
}
```

Lifecycle:

1. choose repo/base;
2. create branch/worktree;
3. run setup command;
4. launch OMP with worktree cwd;
5. monitor changes;
6. review;
7. commit/PR/apply;
8. retain or delete.

Never delete an unmerged dirty worktree without typed confirmation.

## 11. Plan Mode

State machine:

```text
researching
→ askingQuestions
→ drafting
→ readyForReview
→ editing
→ building
→ completed

Any state → failed / cancelled / superseded
```

UI:

- research progress;
- files/symbols/dependencies inspected;
- clarifying questions;
- editable Markdown plan;
- ordered tasks/checklist;
- files to change;
- architecture/data model;
- risks;
- validation and rollout;
- references;
- version history;
- Save to Workspace;
- Build.

The Build action records the exact plan revision and links every implementation event back to it.

## 12. Debug Mode

Workflow:

1. explore and form hypotheses;
2. choose instrumentation;
3. review instrumentation diff;
4. request reproduction;
5. collect logs;
6. analyze evidence;
7. propose root cause;
8. apply targeted fix;
9. verify;
10. remove instrumentation.

Required panels:

- hypotheses;
- active/rejected/confirmed status;
- instrumentation files;
- reproduction steps;
- live logs;
- evidence;
- root cause;
- proposed fix;
- verification;
- cleanup.

OMP already has strong debugger/LSP capabilities; the adapter should expose them as structured debug events rather than reducing Debug Mode to a normal prompt preset.

## 13. Browser and Design Mode

### 13.1 Browser architecture

Use a shared browser session controlled through a Caret browser bridge:

- Chromium/WebView/Playwright or CDP;
- one browser session ID per agent task;
- screenshot and recording artifact store;
- console/network logs written as indexed artifacts;
- allow OMP to call the same browser through an MCP/tool bridge;
- display OMP browser actions in the timeline.

### 13.2 Browser UI

- address bar;
- back/forward/reload;
- open externally;
- device/viewport;
- zoom;
- connection/dev-server state;
- console and network indicators;
- screenshots;
- recording;
- add page to context;
- Design Mode.

### 13.3 Design Mode

Support:

- hover outline;
- selected outline;
- multiple selections;
- numbered selection badges;
- element breadcrumb;
- component/tag badge;
- frozen screenshot;
- draw/undo/redo/clear;
- voice;
- add selection to composer;
- send immediately;
- hot reload and task queue.

Element context:

```ts
interface DesignElementContext {
  browserSessionId: string;
  url: string;
  xpath?: string;
  cssSelector?: string;
  tagName: string;
  componentName?: string;
  textPreview?: string;
  attributes: Record<string, string>;
  computedStyle: Record<string, string>;
  frameworkMetadata?: Record<string, unknown>;
  bounds: { x: number; y: number; width: number; height: number };
  screenshotArtifactId: string;
}
```

## 14. Subagents, plugins, rules, skills, hooks, and MCP

### 14.1 Subagents

Display subagents as child runs:

- name/role;
- prompt summary;
- model;
- worktree;
- current activity;
- progress;
- result;
- failure;
- open transcript;
- stop/cancel where supported.

Parent and child events retain correlation IDs.

### 14.2 Rules

Support:

- project rules;
- user rules;
- team rules later;
- `AGENTS.md`;
- Always / Agent Decides / Manual;
- path/glob scope;
- preview effective context;
- validation and diagnostics.

### 14.3 Skills and commands

- discover from standard directories;
- render description and source;
- invoke with `/`;
- show required tools/capabilities;
- trust scripts before execution;
- update/pin version;
- workspace/user scope.

### 14.4 Hooks

Hooks may observe, block, or modify runtime behavior. Caret must display:

- lifecycle event;
- script;
- scope;
- timeout;
- last result;
- stderr/log;
- enabled state;
- trust/permission;
- failure isolation.

### 14.5 MCP

MCP server management:

- stdio/HTTP transport;
- local/workspace/user scope;
- auth/OAuth;
- tool/resource list;
- enable/disable;
- per-tool approval;
- logs;
- crash/reconnect;
- security warning;
- environment-variable secret references.

MCP failures must not crash other servers or the session.

## 15. Automations and remote control

### 15.1 Local automation engine

P1 local implementation:

- cron and interval triggers;
- repository event triggers from local Git/file watcher;
- webhook through secure tunnel only;
- OMP task template;
- permission policy;
- run history;
- notification.

### 15.2 Mobile/PWA

The mobile UI is a supervision surface, not a mobile IDE:

- session list;
- Needs You;
- transcript;
- approvals/questions;
- send/queue/steer;
- stop/resume;
- diff summary;
- screenshots;
- PR review;
- notifications.

Default private access:

```text
Phone/PWA
   │
Tailscale or equivalent private network
   │
caret-agentd
```

No unauthenticated public endpoint.

### 15.3 Runtime registry

```ts
interface RuntimeDescriptor {
  id: string;
  kind: 'local' | 'worktree' | 'ssh' | 'selfHosted' | 'cloud';
  label: string;
  status: 'online' | 'busy' | 'sleeping' | 'offline' | 'error';
  capabilities: RuntimeCapabilities;
  lastUsedAt?: number;
}
```

## 16. Persistence

Use SQLite in `caret-agentd`.

Suggested tables:

```text
projects
repositories
workspaces
worktrees
runtimes
sessions
session_events
session_snapshots
prompts
tool_calls
questions
approvals
checkpoints
changed_files
reviews
review_findings
plans
browser_sessions
terminal_sessions
artifacts
automations
automation_runs
notifications
window_view_state
preferences
```

Use content-addressed storage for:

- screenshots;
- recordings;
- terminal logs;
- patches;
- checkpoint blobs;
- generated assets;
- large browser/network logs.

Use the OS keychain for:

- provider credentials;
- SSH credentials;
- OAuth tokens;
- tunnel secrets;
- signing/update secrets.

## 17. Security and trust

- renderer never receives raw long-lived secrets;
- preload exposes a narrow typed API;
- Electron context isolation enabled;
- no unrestricted Node access in renderer;
- all file operations scoped to trusted roots;
- workspace trust enforced;
- destructive commands require policy evaluation;
- approvals contain exact command/path/runtime;
- logs redact secrets;
- browser sessions isolated;
- MCP and hooks have explicit trust;
- remote worker identity visible;
- event/artifact access scoped to session and user;
- PWA sessions short-lived and revocable;
- audit log for approvals and remote actions.

## 18. Code-OSS integration plan

### 18.1 Suggested source layout

```text
src/vs/platform/caret/
├── common/
├── electron-main/
└── electron-sandbox/

src/vs/workbench/contrib/caret/
├── common/
│   ├── caretTypes.ts
│   ├── caretEvents.ts
│   ├── caretCommands.ts
│   ├── caretContextKeys.ts
│   └── caretConfiguration.ts
├── browser/
│   ├── agentsWindow/
│   ├── navigation/
│   ├── home/
│   ├── session/
│   ├── timeline/
│   ├── composer/
│   ├── changes/
│   ├── review/
│   ├── plan/
│   ├── debug/
│   ├── browser/
│   ├── customize/
│   ├── automations/
│   ├── settings/
│   └── media/
└── electron-sandbox/
    └── caret.contribution.ts

packages/
├── caret-protocol/
├── caret-agentd/
├── caret-omp-adapter/
├── caret-browser-bridge/
└── caret-test-fixtures/
```

### 18.2 Workbench services

```ts
ICaretWindowModeService
ICaretSessionService
ICaretRuntimeService
ICaretEventService
ICaretContextService
ICaretQueueService
ICaretCheckpointService
ICaretWorktreeService
ICaretReviewService
ICaretPlanService
ICaretDebugService
ICaretBrowserService
ICaretArtifactService
ICaretAutomationService
```

### 18.3 Reuse upstream services

- editor service;
- Monaco editor and diff editor;
- terminal service;
- source control;
- file service;
- workspace trust;
- quick input;
- commands;
- menus;
- context keys;
- storage;
- notifications;
- dialogs;
- themes;
- keybindings;
- list/tree widgets;
- accessibility;
- extension host.

### 18.4 Patch-isolation rules

- keep product features under Caret contributions;
- minimize changes to core workbench layout;
- add narrow integration seams rather than copying upstream files;
- maintain `docs/upstream-patch-ledger.md`;
- feature-flag unfinished features;
- rebase/merge Code-OSS upstream frequently;
- add integration tests for every core seam;
- keep Caret daemon/protocol packages independent of renderer code.

## 19. Branding and distribution

Replace:

- product name;
- icon/logo;
- bundle IDs;
- executable/CLI name;
- URI scheme;
- data/config directories;
- update endpoints;
- telemetry and crash endpoints;
- account/help/docs URLs;
- marketplace endpoints;
- signing/notarization identities;
- default welcome content.

Recommended identifiers:

```text
Product: Caret
CLI: caret
URI scheme: caret://
User data: ~/.caret
Project config: .caret/
Bundle ID: your chosen reverse-DNS identifier
```

Use original Caret icons and language. Functional and geometric parity is the target; do not ship Cursor logos or imply endorsement. Obtain legal review before a commercial release intentionally using a highly similar overall interface.

For extensions, do not assume the Microsoft Marketplace is available to a third-party distribution. Use Open VSX, a private registry, or a properly licensed source.

## 20. Visual design and interaction system

### 20.1 Starting measurements

These are provisional and must be measured against the frozen build:

| Token | Starting point |
|---|---:|
| Base spacing unit | 4 logical px |
| Primary UI text | 13 px |
| Metadata text | 11–12 px |
| Body line height | 19–20 px |
| Titlebar | 34–36 px on standard density |
| IDE activity bar | 46–48 px |
| Standard row | 28–32 px |
| Compact button | 28 px |
| Regular button | 32 px |
| Composer radius | 10–12 px |
| Standard control radius | 4–6 px |
| Fast transition | 100–140 ms |
| Pane transition | 160–220 ms |

### 20.2 Typography

- platform system font for UI;
- configured editor font for code;
- no copied proprietary font files;
- platform-specific weight calibration;
- localization-safe labels;
- text anti-aliasing mask in screenshot comparisons.

### 20.3 Icons

- Codicons for standard editor actions;
- original Caret icons for agent-specific actions;
- consistent 16/20 px optical boxes;
- baseline and stroke-weight tests;
- light/dark/high-contrast variants.

### 20.4 Responsive behavior

Breakpoints are behavior-based:

- wide: nav + center + auxiliary all visible;
- medium: collapsible nav, narrower timeline;
- narrow: one content surface plus drawer/tabs;
- never shrink composer below usable width;
- review prioritizes diff;
- small height keeps composer and approvals reachable.

## 21. Performance targets

| Interaction | Target |
|---|---:|
| Composer input response | one frame, normally under 16 ms |
| Menu open | under 100 ms perceived |
| Window/shell handoff | under 300 ms perceived after warm start |
| Timeline scroll | 60 fps under normal load |
| 10,000-event session | remains navigable |
| Renderer reload recovery | no lost queued prompts or draft |
| Streaming | no visible scroll jump when user is reading history |

Required techniques:

- virtualized timeline and navigation;
- batched deltas;
- stable keys;
- lazy Markdown/syntax/diff rendering;
- terminal truncation with full artifact;
- lazy screenshots/video;
- background indexing;
- memoized projections;
- no full transcript rerender per token.

## 22. Accessibility

Every interactive control requires:

- semantic role/name;
- keyboard action;
- visible focus;
- logical tab order;
- Escape behavior;
- focus restoration;
- screen-reader announcement;
- reduced motion;
- high contrast;
- disabled explanation.

Do not announce every streamed token. Announce significant transitions: start, approval, question, failure, review ready, complete, disconnect.

## 23. Testing and visual validation

### 23.1 Automated layers

- unit tests for reducers/state machines;
- adapter contract tests;
- event replay tests;
- IPC authorization tests;
- Code-OSS workbench integration tests;
- component tests;
- keyboard/focus tests;
- accessibility-tree tests;
- Electron end-to-end tests;
- screenshot tests;
- performance benchmarks;
- long-session soak tests;
- reconnect/replay tests;
- migration/update tests.

### 23.2 Golden-state atlas

At minimum:

- both home windows;
- all composer menus;
- active session;
- parallel tools;
- queue/steering;
- approval/question;
- terminal;
- checkpoint/restore;
- completion;
- IDE sidepane at several widths;
- inline edit;
- changes/diff/review;
- worktree;
- Plan;
- Debug;
- Browser;
- Design Mode;
- Search;
- Automations;
- Customize;
- Settings;
- auth/offline/rate limit;
- runtime disconnect;
- worktree/file conflict;
- long lists/transcripts;
- high contrast;
- Windows/macOS/Linux.

### 23.3 Visual thresholds

Starting thresholds:

- geometry: 1 logical pixel at 1×;
- geometry: 2 captured pixels at 2×;
- critical control changed pixels: under 0.15%;
- full-screen changed pixels: under 0.5%;
- structural metric plus raw pixel diff;
- text anti-aliasing mask;
- human approval for golden updates.

## 24. Implementation roadmap

Assumption: 4–6 experienced engineers, using AI coding assistance, focused first on local desktop.

### Phase 0 — Baseline and spike, 2 weeks

Deliver:

- frozen Cursor reference build;
- 100-state capture plan;
- exact Code-OSS baseline commit;
- Caret rebranding checklist;
- OMP event/API inventory;
- one-process OMP bridge spike;
- patch ledger;
- deterministic fixture repo.

Exit criterion:

> A script launches OMP, receives typed events, sends one prompt, receives one tool event, and stops cleanly without parsing terminal UI.

### Phase 1 — Protocol and daemon vertical slice, 3 weeks

Deliver:

- `caret-protocol`;
- `caret-agentd`;
- SQLite event log;
- adapter handshake;
- one local session;
- replay/reconnect;
- basic permission round trip.

Exit criterion:

> One OMP session survives renderer reload and can be controlled through the daemon.

### Phase 2 — Dual-window shell, 3 weeks

Deliver:

- Agents BrowserWindow;
- IDE titlebar button;
- shared session identity;
- Agent navigation shell;
- Agent Home shell;
- window state persistence;
- Caret branding.

Exit criterion:

> Both windows can be open simultaneously and show the same selected session without duplicate OMP processes.

### Phase 3 — Composer and active session, 4 weeks

Deliver:

- composer;
- model/mode/runtime menus;
- attachments;
- timeline;
- tool blocks;
- approvals/questions;
- queue/steering;
- completion summary;
- virtualization.

Exit criterion:

> A real feature can be completed through OMP from the Agents Window without using OMP's TUI.

### Phase 4 — IDE integration, 4 weeks

Deliver:

- compact Agent sidepane;
- file/symbol/selection context;
- open file/diff/terminal;
- inline edit;
- shared drafts and view state;
- Source Control actions.

Exit criterion:

> The same session can move between Agent and IDE windows with no state loss.

### Phase 5 — Git, worktrees, checkpoints, review, 4 weeks

Deliver:

- worktree manager;
- changes tree;
- Monaco diff;
- stage/discard/commit;
- checkpoints;
- Agent Review;
- PR adapter seams.

Exit criterion:

> Two OMP agents can work in parallel on the same repository without filesystem conflicts, and both results can be reviewed.

### Phase 6 — Browser, Plan, Debug, 5 weeks

Deliver:

- browser bridge;
- browser pane;
- Design Mode foundation;
- Plan Mode;
- Debug Mode;
- artifact viewer.

Exit criterion:

> OMP can inspect a running app, produce a screenshot-backed change, and complete a structured plan/debug workflow.

### Phase 7 — Customize, search, automation foundation, 4 weeks

Deliver:

- rules/skills/MCP/subagents/hooks UI;
- session FTS;
- Needs You inbox;
- local automation scheduler;
- notifications.

### Phase 8 — Hardening and parity calibration, 4–6 weeks

Deliver:

- 100+ golden states;
- macOS calibration;
- Windows/Linux calibration;
- a11y;
- performance;
- crash recovery;
- updater/signing;
- packaging/licensing review.

### Phase 9 — Distributed runtimes, separate program

Deliver incrementally:

- SSH;
- self-hosted worker;
- secure PWA/mobile;
- cloud worker;
- external triggers/integrations;
- team policy/admin.

## 25. First vertical slice

Do this before attempting visual completeness:

```text
1. Open a local repository in Caret.
2. Click New Chat in Agents Window.
3. Caret creates a worktree.
4. caret-agentd launches OMP in that worktree.
5. OMP handshake and model list arrive.
6. User sends a prompt.
7. Typed narrative/tool/file events stream into the timeline.
8. Approval request appears and is answered.
9. Changed file appears in Changes.
10. File opens in Monaco diff.
11. User opens the same session in IDE.
12. The IDE shows the same timeline and worktree.
13. User sends a follow-up.
14. OMP finishes and Caret shows completion summary.
15. App restarts and the session replays correctly.
```

Nothing else should block this slice.

## 26. Release milestones

### M0 — Architecture proven

- one session;
- typed events;
- daemon;
- restart recovery.

### M1 — Caret Local Alpha

- dual windows;
- local OMP;
- composer/timeline;
- file/terminal/diff;
- basic worktrees.

### M2 — Caret Local Beta

- queue/steer;
- checkpoints;
- review;
- Plan/Debug;
- browser;
- rules/skills/MCP;
- visual parity pass.

### M3 — Caret 1.0

- hardened local desktop;
- signed updates;
- macOS/Windows/Linux;
- accessibility;
- import/migration;
- reliable upstream update process.

### M4 — Caret Remote

- SSH/self-hosted;
- PWA/mobile supervision;
- local automations.

### M5 — Caret Cloud

- managed workers;
- cloud/local handoff;
- event triggers;
- team/admin services.

## 27. Definition of done

Caret desktop is not complete until:

### Windows and state

- [ ] Agents Window exists.
- [ ] IDE Window exists.
- [ ] Both can be open simultaneously.
- [ ] A session has one identity across both.
- [ ] No duplicate runtime starts during handoff.
- [ ] Drafts, queue, scroll anchors, selections, terminal, browser, and diff state restore.

### OMP integration

- [ ] No TUI scraping.
- [ ] Capability handshake works.
- [ ] Adapter contract tests run against supported OMP versions.
- [ ] Approvals/questions round-trip.
- [ ] Typed tool/file/terminal/subagent events render.
- [ ] Reconnect and replay are deterministic.

### Agent interface

- [ ] New Chat, Search, Automations, Customize, Projects, Repositories.
- [ ] Composer, `@`, `/`, files/images/voice.
- [ ] Model/mode/effort/runtime.
- [ ] Queue/steer/interrupt.
- [ ] Timeline and tool states.
- [ ] Checkpoints.
- [ ] Completion summary.
- [ ] Changes, Browser, Terminal, File.

### IDE

- [ ] Caret welcome page and branding.
- [ ] Agent sidepane.
- [ ] inline edit.
- [ ] completion provider interface.
- [ ] editor/terminal/SCM/debug/test context.
- [ ] Open Agents Window control.
- [ ] status indicators.

### Advanced

- [ ] worktrees;
- [ ] review;
- [ ] Plan;
- [ ] Debug;
- [ ] Browser;
- [ ] Design Mode;
- [ ] rules;
- [ ] skills;
- [ ] subagents;
- [ ] hooks;
- [ ] MCP.

### Quality

- [ ] 100+ golden states;
- [ ] long-session performance;
- [ ] keyboard-only flow;
- [ ] screen-reader flow;
- [ ] reduced motion;
- [ ] high contrast;
- [ ] offline/reconnect;
- [ ] runtime/version mismatch;
- [ ] conflict and recovery states;
- [ ] signed packages and update recovery.

## 28. Immediate repository tasks

1. Create `docs/caret/reference-build.md`.
2. Add `docs/caret/upstream-patch-ledger.md`.
3. Add `packages/caret-protocol`.
4. Define `RuntimeCapabilities` and event envelopes.
5. Build an OMP bridge spike.
6. Add `caret-agentd` with one session and SQLite replay.
7. Add `Caret: Open Agents Window`.
8. Add Agents Window shell with placeholder nav/center/auxiliary parts.
9. Wire the IDE `Agents Window ↗` titlebar command.
10. Prove the 15-step vertical slice.
11. Only then begin pixel calibration.

## 29. Source references used for this specification

Official/current references reviewed on 2026-09-14:

- Cursor Agents Window: https://cursor.com/docs/agent/agents-window
- Cursor Agent overview: https://cursor.com/docs/agent/overview
- Cursor Plan Mode: https://cursor.com/docs/agent/plan-mode
- Cursor Debug Mode: https://cursor.com/docs/agent/debug-mode
- Cursor Agent Review: https://cursor.com/docs/agent/agent-review
- Cursor Browser: https://cursor.com/docs/agent/tools/browser
- Cursor Design Mode: https://cursor.com/docs/agent/design-mode
- Cursor Worktrees: https://cursor.com/docs/configuration/worktrees
- Cursor Customize: https://cursor.com/docs/customize-cursor
- Cursor Plugins: https://cursor.com/docs/plugins
- Cursor Rules: https://cursor.com/docs/rules
- Cursor Skills: https://cursor.com/docs/skills
- Cursor Subagents: https://cursor.com/docs/subagents
- Cursor Hooks: https://cursor.com/docs/hooks
- Cursor MCP: https://cursor.com/docs/mcp
- Cursor Automations: https://cursor.com/docs/cloud-agent/automations
- Cursor Mobile: https://cursor.com/docs/cloud-agent/mobile
- OMP repository: https://github.com/can1357/oh-my-pi
- Code-OSS repository: https://github.com/microsoft/vscode
- Code-OSS MIT license: https://github.com/microsoft/vscode/blob/main/LICENSE.txt

This is an implementation specification, not legal advice.
