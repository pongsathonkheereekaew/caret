/**
 * Public protocol types for the Caret OMP adapter.
 *
 * The command names below are intentionally copied as a small, dependency-free
 * contract from OMP v18.1.18:
 * `packages/coding-agent/src/modes/rpc/rpc-types.ts:28-93`
 * at commit `00085d4e7dfdcfbf302c122fa2682b410a0f43d1` (2026-09-12).
 *
 * We do not import OMP's private package types.  Keeping this boundary local
 * means Caret can run on Node and can detect protocol drift at startup.
 */

/** OMP RPC transport version selected by the adapter after negotiation. */
export const OMP_RPC_PROTOCOL_VERSION = 2 as const;

/**
 * The OMP release the adapter contract was last written and run against.
 *
 * It is a floor, not a pin. Caret follows OMP: every later release is accepted (see
 * {@link isSupportedOmpVersion}), and what a runtime can actually do is read from its own
 * `ready` frame instead of guessed from its version string. The Caret bridges are
 * capability-gated there - `caretUiVersion`, `caretTerminalVersion`, `caretModelRolesVersion`,
 * the editor and native bridges - so a runtime without them, such as a stock OMP, degrades
 * honestly instead of failing. The contract suites (`scripts/omp-smoke.ts`,
 * `scripts/omp-ui-smoke.ts`, `scripts/omp-g1-smoke.ts`) are the acceptance test for any release
 * newer than this one, and a Caret build packages a runtime it contract-tested when it was
 * built.
 */
export const OMP_BASELINE_VERSION = "18.1.18" as const;

/**
 * Whether a runtime that reports `version` is one Caret may drive: the baseline, or anything
 * newer - including a newer minor and a newer major.
 *
 * The baseline is the release the contract was written against, so anything older is refused by
 * name: it was never tested. Anything newer is accepted because a version string cannot tell
 * Caret what a runtime does, while the `ready` frame can, and that is what the adapter asks:
 * the protocol versions the runtime speaks and the Caret bridges it carries. A user who updates
 * OMP past the number Caret was tested at should get a working window whose features are the
 * ones their runtime advertises, not a composer that fails before the first prompt; a release
 * that really did change the envelope is caught by the contract suites and by the adapter's
 * request-level checks, not by refusing its number. Malformed output is refused as well: the
 * version string is the only thing Caret knows about the binary before it spawns it.
 */
export function isSupportedOmpVersion(version: string): boolean {
	const match = /^omp\/(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
	if (!match) {
		return false;
	}
	const [major, minor, patch] = [Number(match[1]), Number(match[2]), Number(match[3])];
	const [baseMajor, baseMinor, basePatch] = OMP_BASELINE_VERSION.split(".").map(Number) as [number, number, number];
	if (major !== baseMajor) {
		return major > baseMajor;
	}
	if (minor !== baseMinor) {
		return minor > baseMinor;
	}
	return patch >= basePatch;
}

/** Maximum UTF-8 bytes in one physical JSONL frame, including its newline. */
export const MAX_RPC_FRAME_BYTES = 1024 * 1024;

/** Maximum UTF-8 bytes in one logical frame after protocol-v2 reassembly. */
export const MAX_RPC_REASSEMBLED_BYTES = 64 * 1024 * 1024;

/**
 * Canonical OMP RPC command identifiers (42 entries).
 *
 * Keep this tuple in source order so a diff against the pinned OMP source is
 * straightforward and so consumers can expose a deterministic capability
 * manifest.
 */
export const RPC_COMMAND_TYPES = [
	"negotiate_protocol",
	"prompt",
	"steer",
	"follow_up",
	"abort",
	"abort_and_prompt",
	"new_session",
	"get_state",
	"set_fast_mode",
	"get_available_commands",
	"set_todos",
	"set_host_tools",
	"set_host_uri_schemes",
	"set_subagent_subscription",
	"get_subagents",
	"get_subagent_messages",
	"set_model",
	"cycle_model",
	"get_available_models",
	"set_thinking_level",
	"cycle_thinking_level",
	"set_steering_mode",
	"set_follow_up_mode",
	"set_interrupt_mode",
	"compact",
	"set_auto_compaction",
	"set_auto_retry",
	"abort_retry",
	"bash",
	"abort_bash",
	"get_session_stats",
	"export_html",
	"switch_session",
	"branch",
	"get_branch_messages",
	"get_last_assistant_text",
	"set_session_name",
	"handoff",
	"get_messages",
	"get_messages_page",
	"get_login_providers",
	"login",
] as const;

export type RpcCommandType = (typeof RPC_COMMAND_TYPES)[number];

/** Opt-in commands of Caret's separately pinned OMP UI patch, never stock OMP claims. */
export const CARET_UI_COMMAND_TYPES = [
	"caret_terminal_negotiate",
	"caret_terminal_input",
	"caret_terminal_resize",
	"caret_get_model_roles",
	"caret_set_model_role",
] as const;
export type CaretUiCommandType = typeof CARET_UI_COMMAND_TYPES[number];

/** A JSON object accepted as the body of an RPC command. */
export type RpcPayload = Record<string, unknown>;

type EmptyPayload = Record<string, never>;

/**
 * Command payloads mirror the stable fields in OMP's `RpcCommand` union.  The
 * nested model/session/tool values intentionally remain dependency-free JSON
 * shapes; OMP owns their detailed schemas.
 */
export interface RpcCommandPayloadMap {
	negotiate_protocol: { protocolVersion: number };
	prompt: { message: string; images?: unknown[]; streamingBehavior?: "steer" | "followUp" };
	steer: { message: string; images?: unknown[] };
	follow_up: { message: string; images?: unknown[] };
	abort: EmptyPayload;
	abort_and_prompt: { message: string; images?: unknown[] };
	new_session: { parentSession?: string };
	get_state: EmptyPayload;
	set_fast_mode: { enabled: boolean };
	get_available_commands: EmptyPayload;
	set_todos: { phases: unknown[] };
	set_host_tools: { tools: RpcHostToolDefinition[] };
	set_host_uri_schemes: { schemes: RpcHostUriSchemeDefinition[] };
	set_subagent_subscription: { level: RpcSubagentSubscriptionLevel };
	get_subagents: EmptyPayload;
	get_subagent_messages: { subagentId?: string; sessionFile?: string; fromByte?: number };
	set_model: { provider: string; modelId: string };
	cycle_model: EmptyPayload;
	get_available_models: EmptyPayload;
	set_thinking_level: { level: string };
	cycle_thinking_level: EmptyPayload;
	set_steering_mode: { mode: "all" | "one-at-a-time" };
	set_follow_up_mode: { mode: "all" | "one-at-a-time" };
	set_interrupt_mode: { mode: "immediate" | "wait" };
	compact: { customInstructions?: string };
	set_auto_compaction: { enabled: boolean };
	set_auto_retry: { enabled: boolean };
	abort_retry: EmptyPayload;
	bash: { command: string };
	abort_bash: EmptyPayload;
	get_session_stats: EmptyPayload;
	export_html: { outputPath?: string };
	switch_session: { sessionPath: string };
	branch: { entryId: string };
	get_branch_messages: EmptyPayload;
	get_last_assistant_text: EmptyPayload;
	set_session_name: { name: string };
	handoff: { customInstructions?: string };
	get_messages: EmptyPayload;
	get_messages_page: { cursor?: string; limit?: number };
	get_login_providers: EmptyPayload;
	login: { providerId: string };
}

export type RpcCommandPayload<C extends RpcCommandType> = RpcCommandPayloadMap[C];

/** A command frame as written to OMP stdin. */
export type RpcCommandFrame<C extends RpcCommandType = RpcCommandType> = {
	id: string;
	type: C;
} & RpcPayload;

/** OMP's successful response/ACK frame. */
export interface RpcSuccessResponse<C extends RpcCommandType = RpcCommandType> {
	id?: string;
	type: "response";
	command: C;
	success: true;
	data?: unknown;
	[key: string]: unknown;
}

/** OMP's failed response/ACK frame. */
export interface RpcFailureResponse {
	id?: string;
	type: "response";
	command: string;
	success: false;
	error: string;
	code?: string;
	[key: string]: unknown;
}

export type RpcResponse<C extends RpcCommandType = RpcCommandType> =
	| RpcSuccessResponse<C>
	| RpcFailureResponse;

/** The value returned by `request`; terminal agent events arrive separately. */
export type RpcAck<C extends RpcCommandType = RpcCommandType> = RpcSuccessResponse<C>;

export interface RpcReadyFrame {
	type: "ready";
	protocolVersion: 1;
	supportedProtocolVersions: readonly number[];
	maxFrameBytes: number;
	maxReassembledFrameBytes: number;
	[key: string]: unknown;
}

export interface RpcChunkFrame {
	type: "rpc_chunk";
	chunkId: string;
	index: number;
	count: number;
	byteLength: number;
	data: string;
	[key: string]: unknown;
}

export interface RpcExtensionUIResponseValue {
	type: "extension_ui_response";
	id: string;
	value: string;
}

export interface RpcExtensionUIResponseConfirm {
	type: "extension_ui_response";
	id: string;
	confirmed: boolean;
}

export interface RpcExtensionUIResponseCancelled {
	type: "extension_ui_response";
	id: string;
	cancelled: true;
	timedOut?: boolean;
}

export type RpcExtensionUIResponse =
	| RpcExtensionUIResponseValue
	| RpcExtensionUIResponseConfirm
	| RpcExtensionUIResponseCancelled;

export interface RpcHostToolUpdate {
	type: "host_tool_update";
	id: string;
	partialResult: unknown;
}

export interface RpcHostToolResult {
	type: "host_tool_result";
	id: string;
	result: unknown;
	isError?: boolean;
}

export interface RpcHostUriResult {
	type: "host_uri_result";
	id: string;
	content?: string;
	contentType?: "text/markdown" | "application/json" | "text/plain";
	notes?: string[];
	immutable?: boolean;
	isError?: boolean;
	error?: string;
}

export type RpcClientSideFrame =
	| RpcExtensionUIResponse
	| RpcHostToolUpdate
	| RpcHostToolResult
	| RpcHostUriResult;

export interface RpcHostToolDefinition {
	name: string;
	label?: string;
	description: string;
	parameters: Record<string, unknown>;
	hidden?: boolean;
	loadMode?: "discoverable" | "eager";
}

export interface RpcHostUriSchemeDefinition {
	scheme: string;
	description?: string;
	writable?: boolean;
	immutable?: boolean;
}

export type RpcSubagentSubscriptionLevel = "off" | "progress" | "events";

/** Every decoded JSON object emitted by OMP, including unknown future frames. */
export type OmpFrame = Record<string, unknown>;

export type OmpFrameListener = (frame: OmpFrame) => void;

export interface OmpRpcClientStartOptions {
	/** OMP executable or an absolute path selected by the caller (default `omp`). */
	executable?: string;
	/** Extra OMP CLI arguments appended after the enforced `--mode rpc-ui`. */
	args?: readonly string[];
	cwd?: string;
	/** Complete child environment when supplied; otherwise inherits process.env. */
	env?: NodeJS.ProcessEnv;
	/** Maximum time waiting for OMP's supported `ready` frame. */
	readyTimeoutMs?: number;
	/** Default time waiting for a command ACK. */
	requestTimeoutMs?: number;
	/** Grace period before SIGTERM and then SIGKILL during close. */
	shutdownGraceMs?: number;
	/** Tail size retained from stderr for diagnostics. */
	stderrLimitBytes?: number;
	/** Receives startup frames before `start` resolves. */
	onFrame?: OmpFrameListener;
}

export interface OmpRequestOptions {
	timeoutMs?: number;
	/** Called synchronously before enqueueing; lets a durable host bind the wire ID. Throwing prevents dispatch. */
	onRequestId?: (id: string) => void;
}
