/**
 * Caret's host side of the OMP rpc-ui tool/URI bridge.
 *
 * OMP owns the agent loop and sends `host_tool_call` / `host_uri_request`
 * frames when it needs an embedding host to do work.  This module deliberately
 * contains no filesystem, process, network, or approval implementation.  All
 * effects are supplied by a registration and every request passes through the
 * required authorization callback first.
 */

import type {
	RpcHostToolDefinition,
	RpcHostToolResult,
	RpcHostToolUpdate,
	RpcHostUriResult,
	RpcHostUriSchemeDefinition,
} from "./types.ts";

type RecordValue = Record<string, unknown>;

/** Inbound frame emitted by OMP when a registered tool should run. */
export interface OmpHostToolCallRequest extends RecordValue {
	type: "host_tool_call";
	id: string;
	toolCallId: string;
	toolName: string;
	arguments: RecordValue;
}

/** Inbound frame emitted by OMP to abort a pending host-tool call. */
export interface OmpHostToolCancelRequest extends RecordValue {
	type: "host_tool_cancel";
	id: string;
	targetId: string;
}

/** Inbound frame emitted by OMP for a host URI read or write. */
export interface OmpHostUriRequest extends RecordValue {
	type: "host_uri_request";
	id: string;
	operation: "read" | "write";
	url: string;
	content?: string;
}

/** Inbound frame emitted by OMP to abort a pending URI request. */
export interface OmpHostUriCancelRequest extends RecordValue {
	type: "host_uri_cancel";
	id: string;
	targetId: string;
}

export type OmpHostInboundFrame =
	| OmpHostToolCallRequest
	| OmpHostToolCancelRequest
	| OmpHostUriRequest
	| OmpHostUriCancelRequest;

export type OmpHostOutboundFrame = RpcHostToolUpdate | RpcHostToolResult | RpcHostUriResult;

/** Request object supplied to authorization and handlers. It is frozen deeply at runtime. */
export type ImmutableOmpHostRequest = Readonly<RecordValue>;

export interface OmpHostInvocationContext {
	readonly request: ImmutableOmpHostRequest;
	readonly signal: AbortSignal;
}

export interface OmpHostToolContext extends OmpHostInvocationContext {
	/**
	 * Send one partial OMP tool result. The returned promise settles after the
	 * injected send callback settles. Updates issued after cancellation,
	 * disposal, or completion are ignored.
	 */
	readonly update: (partialResult: unknown) => Promise<void>;
}

export type OmpHostToolHandler = (
	request: ImmutableOmpHostRequest,
	context: OmpHostToolContext,
) => unknown | Promise<unknown>;

export interface OmpHostUriContext extends OmpHostInvocationContext {}

export interface OmpHostUriReadResult {
	content: string;
	contentType?: "text/markdown" | "application/json" | "text/plain";
	notes?: string[];
	immutable?: boolean;
}

export type OmpHostUriReadHandler = (
	request: ImmutableOmpHostRequest,
	context: OmpHostUriContext,
) => OmpHostUriReadResult | string | Promise<OmpHostUriReadResult | string>;

export type OmpHostUriWriteHandler = (
	request: ImmutableOmpHostRequest,
	context: OmpHostUriContext,
) => unknown | Promise<unknown>;

export interface OmpHostToolRegistration {
	definition: RpcHostToolDefinition;
	handler: OmpHostToolHandler;
}

export interface OmpHostUriRegistration {
	definition: RpcHostUriSchemeDefinition;
	read?: OmpHostUriReadHandler;
	write?: OmpHostUriWriteHandler;
}

export type OmpHostAuthorizationRequest =
	| ImmutableOmpHostRequest
	| (ImmutableOmpHostRequest & { readonly type: "host_tool_call" })
	| (ImmutableOmpHostRequest & { readonly type: "host_uri_request" });

/** Authorization is intentionally mandatory; returning false fails closed. */
export type OmpHostAuthorize = (
	request: OmpHostAuthorizationRequest,
	signal: AbortSignal,
) => boolean | Promise<boolean>;

export type OmpHostSend = (frame: OmpHostOutboundFrame) => void | Promise<void>;

export interface OmpHostErrorContext {
	readonly phase:
		| "protocol"
		| "authorization"
		| "handler"
		| "send"
		| "cancel"
		| "capacity"
		| "disposed";
	readonly id?: string;
	readonly operation?: "tool" | "uri";
	readonly frame?: unknown;
}

export type OmpHostErrorHandler = (error: Error, context: OmpHostErrorContext) => void;

export interface OmpHostDispatcherOptions {
	send: OmpHostSend;
	authorize: OmpHostAuthorize;
	/** Maximum number of request IDs retained for this bridge incarnation. */
	maxRequestIds?: number;
	/** Authorization plus handler deadline. Defaults to 30 seconds. */
	requestTimeoutMs?: number;
	onError?: OmpHostErrorHandler;
}

type ToolEntry = {
	definition: RpcHostToolDefinition;
	handler: OmpHostToolHandler;
};

type UriEntry = {
	definition: RpcHostUriSchemeDefinition;
	read?: OmpHostUriReadHandler;
	write?: OmpHostUriWriteHandler;
};

type ActiveInvocation = {
	id: string;
	operation: "tool" | "uri";
	controller: AbortController;
	timer: ReturnType<typeof setTimeout>;
	deadline: number;
	cancelled: boolean;
	completed: boolean;
	timedOut: boolean;
	outputFailed: boolean;
	outputChain: Promise<void>;
	done: Promise<void>;
	resolveDone: () => void;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_REQUEST_IDS = 4_096;
const RESERVED_URI_SCHEMES = new Set(["security"]);
const URI_CONTENT_TYPES = new Set(["text/markdown", "application/json", "text/plain"]);

function isRecord(value: unknown): value is RecordValue {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error));
}

function nonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.length > 0;
}

/**
 * Clone and recursively freeze JSON-like values. OMP frames are JSON, so this
 * avoids exposing the caller's mutable object while preserving every wire
 * field (including fields added by a newer OMP version).
 */
function cloneFrozen<T>(value: T, seen = new WeakMap<object, unknown>()): T {
	if (typeof value !== "object" || value === null) return value;
	if (seen.has(value)) return seen.get(value) as T;
	if (Array.isArray(value)) {
		const copy: unknown[] = [];
		seen.set(value, copy);
		for (const item of value) copy.push(cloneFrozen(item, seen));
		return Object.freeze(copy) as T;
	}
	const copy: RecordValue = {};
	seen.set(value, copy);
	for (const [key, item] of Object.entries(value)) {
		// Assignment to `__proto__` invokes Object.prototype's setter. Define an
		// own data property instead so every JSON field survives unchanged.
		Object.defineProperty(copy, key, {
			value: cloneFrozen(item, seen),
			enumerable: true,
			configurable: true,
			writable: true,
		});
	}
	return Object.freeze(copy) as T;
}

function validateToolDefinition(definition: RpcHostToolDefinition): RpcHostToolDefinition {
	if (!isRecord(definition)) throw new TypeError("Host tool definition must be an object");
	const name = typeof definition.name === "string" ? definition.name.trim() : "";
	if (!name) throw new TypeError("Host tool definition must provide a non-empty name");
	const description = typeof definition.description === "string" ? definition.description.trim() : "";
	if (!description) throw new TypeError(`Host tool \"${name}\" must provide a non-empty description`);
	if (!isRecord(definition.parameters))
		throw new TypeError(`Host tool \"${name}\" must provide a JSON Schema object`);
	if (definition.label !== undefined && typeof definition.label !== "string")
		throw new TypeError(`Host tool \"${name}\" label must be a string`);
	if (definition.hidden !== undefined && typeof definition.hidden !== "boolean")
		throw new TypeError(`Host tool \"${name}\" hidden must be boolean`);
	if (definition.loadMode !== undefined && definition.loadMode !== "discoverable" && definition.loadMode !== "eager")
		throw new TypeError(`Host tool \"${name}\" loadMode is invalid`);
	return cloneFrozen({
		...definition,
		name,
		label: typeof definition.label === "string" && definition.label.trim() ? definition.label.trim() : name,
		description,
		hidden: definition.hidden === true,
		loadMode: definition.loadMode ?? "discoverable",
	});
}

function normalizeUriScheme(value: unknown): string {
	const scheme = typeof value === "string" ? value.trim().toLowerCase() : "";
	if (!scheme) throw new TypeError("Host URI scheme must be a non-empty string");
	if (!/^[a-z][a-z0-9+.-]*$/.test(scheme)) throw new TypeError(`Host URI scheme contains invalid characters: ${scheme}`);
	if (RESERVED_URI_SCHEMES.has(scheme)) throw new TypeError(`Host URI scheme is reserved by OMP: ${scheme}://`);
	return scheme;
}

function validateUriDefinition(definition: RpcHostUriSchemeDefinition): RpcHostUriSchemeDefinition {
	if (!isRecord(definition)) throw new TypeError("Host URI scheme definition must be an object");
	const scheme = normalizeUriScheme(definition.scheme);
	if (definition.description !== undefined && typeof definition.description !== "string")
		throw new TypeError(`Host URI scheme \"${scheme}\" description must be a string`);
	if (definition.writable !== undefined && typeof definition.writable !== "boolean")
		throw new TypeError(`Host URI scheme \"${scheme}\" writable must be boolean`);
	if (definition.immutable !== undefined && typeof definition.immutable !== "boolean")
		throw new TypeError(`Host URI scheme \"${scheme}\" immutable must be boolean`);
	return cloneFrozen({
		...definition,
		scheme,
		description: typeof definition.description === "string" ? definition.description : undefined,
		writable: definition.writable === true,
		immutable: definition.immutable === true,
	});
}

function isToolCall(value: unknown): value is OmpHostToolCallRequest {
	return (
		isRecord(value) &&
		value.type === "host_tool_call" &&
		nonEmptyString(value.id) &&
		nonEmptyString(value.toolCallId) &&
		nonEmptyString(value.toolName) &&
		isRecord(value.arguments)
	);
}

function isToolCancel(value: unknown): value is OmpHostToolCancelRequest {
	return isRecord(value) && value.type === "host_tool_cancel" && nonEmptyString(value.id) && nonEmptyString(value.targetId);
}

function isUriRequest(value: unknown): value is OmpHostUriRequest {
	if (!isRecord(value) || value.type !== "host_uri_request" || !nonEmptyString(value.id) || !nonEmptyString(value.url)) return false;
	if (value.operation !== "read" && value.operation !== "write") return false;
	if (value.operation === "write") return typeof value.content === "string";
	return value.content === undefined;
}

function isUriCancel(value: unknown): value is OmpHostUriCancelRequest {
	return isRecord(value) && value.type === "host_uri_cancel" && nonEmptyString(value.id) && nonEmptyString(value.targetId);
}

function isKnownHostType(value: unknown): value is { type: string } {
	return isRecord(value) && typeof value.type === "string" && value.type.startsWith("host_");
}

function frameId(value: unknown): string | undefined {
	return isRecord(value) && typeof value.id === "string" && value.id.length > 0 ? value.id : undefined;
}

function uriScheme(url: string): string | undefined {
	const match = /^([a-z][a-z0-9+.-]*):/i.exec(url);
	return match?.[1]?.toLowerCase();
}

function toolErrorResult(message: string): RecordValue {
	return { content: [{ type: "text", text: message }], details: {} };
}

/**
 * OMP's host-tool result validator requires an AgentToolResult-like object
 * whose `content` is an array. Keep the adapter dependency-free while still
 * rejecting malformed handler output before it reaches the wire. Strings use
 * the same convenient normalization as OMP's own RpcClient.
 */
function normalizeToolResult(value: unknown): RecordValue {
	if (typeof value === "string") return { content: [{ type: "text", text: value }] };
	if (!isRecord(value) || !Array.isArray(value.content))
		throw new TypeError("Host tool handler must return a string or an object with a content array");
	for (const block of value.content) {
		if (!isRecord(block) || typeof block.type !== "string")
			throw new TypeError("Host tool result content must contain typed content blocks");
	}
	return cloneFrozen(value);
}

/** Raised when an inbound host bridge frame violates the OMP wire contract. */
export class OmpHostProtocolError extends Error {
	readonly name = "OmpHostProtocolError";
}

/** Raised when the bounded request-id ledger cannot accept another id. */
export class OmpHostCapacityError extends Error {
	readonly name = "OmpHostCapacityError";
}

/** Raised when an operation arrives after disposal. */
export class OmpHostDisposedError extends Error {
	readonly name = "OmpHostDisposedError";
}

/**
 * Dispatches OMP's host-tool and host-URI requests to explicitly registered
 * host handlers. It is a protocol bridge, not a universal OMP policy engine or
 * an operating-system sandbox.
 */
export class OmpHostDispatcher {
	readonly #send: OmpHostSend;
	readonly #authorize: OmpHostAuthorize;
	readonly #onError?: OmpHostErrorHandler;
	readonly #maxRequestIds: number;
	readonly #requestTimeoutMs: number;
	readonly #sendTimeoutMs: number;
	#tools = new Map<string, ToolEntry>();
	#uriSchemes = new Map<string, UriEntry>();
	#seenIds = new Set<string>();
	#active = new Map<string, ActiveInvocation>();
	#disposed = false;

	constructor(options: OmpHostDispatcherOptions) {
		if (!options || typeof options.send !== "function") throw new TypeError("OMP host dispatcher requires a send callback");
		if (typeof options.authorize !== "function") throw new TypeError("OMP host dispatcher requires an authorize callback");
		this.#send = options.send;
		this.#authorize = options.authorize;
		this.#onError = options.onError;
		const maxRequestIds = options.maxRequestIds ?? DEFAULT_MAX_REQUEST_IDS;
		if (!Number.isSafeInteger(maxRequestIds) || maxRequestIds <= 0)
			throw new TypeError("maxRequestIds must be a positive safe integer");
		this.#maxRequestIds = maxRequestIds;
		const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
		if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0)
			throw new TypeError("requestTimeoutMs must be a positive finite number");
		if (requestTimeoutMs > 2_147_483_647)
			throw new TypeError("requestTimeoutMs must not exceed 2^31-1 milliseconds");
		this.#requestTimeoutMs = requestTimeoutMs;
		this.#sendTimeoutMs = Math.min(requestTimeoutMs, 1_000);
	}

	get disposed(): boolean {
		return this.#disposed;
	}

	get pendingCount(): number {
		return this.#active.size;
	}

	/** Return the frozen definitions that the caller can pass to set_host_tools. */
	getToolDefinitions(): RpcHostToolDefinition[] {
		return [...this.#tools.values()].map(entry => cloneFrozen(entry.definition));
	}

	/** Return frozen schemes that the caller can pass to set_host_uri_schemes. */
	getUriSchemeDefinitions(): RpcHostUriSchemeDefinition[] {
		return [...this.#uriSchemes.values()].map(entry => cloneFrozen(entry.definition));
	}

	registerTool(registration: OmpHostToolRegistration): void {
		this.#assertOpen();
		const { definition, handler } = this.#normalizeToolRegistration(registration);
		if (this.#tools.has(definition.name)) throw new TypeError(`Host tool \"${definition.name}\" is already registered`);
		this.#tools.set(definition.name, { definition, handler });
	}

	registerUriScheme(registration: OmpHostUriRegistration): void {
		this.#assertOpen();
		const { definition, read, write } = this.#normalizeUriRegistration(registration);
		if (this.#uriSchemes.has(definition.scheme))
			throw new TypeError(`Host URI scheme \"${definition.scheme}\" is already registered`);
		this.#uriSchemes.set(definition.scheme, { definition, read, write });
	}

	/**
	 * Validate and dispatch one frame. The returned promise never rejects for a
	 * frame error or handler error; diagnostics go through onError and OMP gets a
	 * typed error result when the request id is usable.
	 */
	async handle(frame: unknown): Promise<boolean> {
		try {
			return await this.#handle(frame);
		} catch (error) {
			this.#report(toError(error), { phase: "protocol", id: frameId(frame), frame });
			return false;
		}
	}

	/** Abort active work and reject all future effects. Idempotent. */
	dispose(): void {
		if (this.#disposed) return;
		this.#disposed = true;
		for (const active of this.#active.values()) {
			active.cancelled = true;
			clearTimeout(active.timer);
			active.controller.abort(new OmpHostDisposedError("OMP host dispatcher disposed"));
			active.resolveDone();
		}
		this.#active.clear();
		this.#tools.clear();
		this.#uriSchemes.clear();
	}

	#normalizeToolRegistration(
		registration: OmpHostToolRegistration,
	): ToolEntry {
		if (!isRecord(registration)) throw new TypeError("Host tool registration must be an object");
		const rawDefinition = isRecord(registration.definition)
			? registration.definition
			: registration;
		const handler = registration.handler;
		if (typeof handler !== "function") throw new TypeError("Host tool registration requires a handler");
		return {
			definition: validateToolDefinition(rawDefinition as unknown as RpcHostToolDefinition),
			handler: handler as OmpHostToolHandler,
		};
	}

	#normalizeUriRegistration(registration: OmpHostUriRegistration): UriEntry {
		if (!isRecord(registration)) throw new TypeError("Host URI registration must be an object");
		const rawDefinition = isRecord(registration.definition)
			? registration.definition
			: registration;
		const read = registration.read;
		const write = registration.write;
		if (read !== undefined && typeof read !== "function") throw new TypeError("Host URI read handler must be a function");
		if (write !== undefined && typeof write !== "function") throw new TypeError("Host URI write handler must be a function");
		return {
			definition: validateUriDefinition(rawDefinition as unknown as RpcHostUriSchemeDefinition),
			read: read as OmpHostUriReadHandler | undefined,
			write: write as OmpHostUriWriteHandler | undefined,
		};
	}

	async #handle(frame: unknown): Promise<boolean> {
		if (this.#disposed) {
			this.#report(new OmpHostDisposedError("OMP host dispatcher is disposed"), {
				phase: "disposed",
				id: frameId(frame),
				frame,
			});
			return false;
		}
		if (isToolCall(frame)) return this.#handleToolCall(cloneFrozen(frame));
		if (isUriRequest(frame)) return this.#handleUriRequest(cloneFrozen(frame));
		if (isToolCancel(frame)) return this.#handleCancel(cloneFrozen(frame), "tool");
		if (isUriCancel(frame)) return this.#handleCancel(cloneFrozen(frame), "uri");

		const id = frameId(frame);
		const error = new OmpHostProtocolError(
			isKnownHostType(frame) ? `Malformed OMP host frame of type ${frame.type}` : "Unknown OMP host frame",
		);
		this.#report(error, { phase: "protocol", id, frame });
		if (isRecord(frame) && frame.type === "host_tool_call" && id) {
			// Reserve malformed request IDs as well. Otherwise a malformed duplicate
			// could race a valid frame with the same id and produce two effects.
			if (!this.#reserveId(id, "tool", frame)) return false;
			await this.#safeSend({ type: "host_tool_result", id, result: toolErrorResult(error.message), isError: true }, {
				phase: "send",
				operation: "tool",
				id,
				frame,
			});
		} else if (isRecord(frame) && frame.type === "host_uri_request" && id) {
			if (!this.#reserveId(id, "uri", frame)) return false;
			await this.#safeSend({ type: "host_uri_result", id, isError: true, error: error.message }, {
				phase: "send",
				operation: "uri",
				id,
				frame,
			});
		}
		return false;
	}

	async #handleToolCall(request: OmpHostToolCallRequest): Promise<boolean> {
		const id = request.id;
		if (!this.#reserveId(id, "tool", request)) return false;
		const entry = this.#tools.get(request.toolName);
		if (!entry) {
			await this.#sendToolError(id, `Host tool \"${request.toolName}\" is not registered`, request);
			return false;
		}
		const active = this.#startActive(id, "tool", request);
		void this.#runTool(active, request, entry).catch(error => {
			this.#report(toError(error), { phase: "handler", operation: "tool", id, frame: request });
			if (this.#isLive(active)) void this.#finishToolError(active, toError(error).message, request);
			else active.resolveDone();
		});
		await active.done;
		return true;
	}

	async #handleUriRequest(request: OmpHostUriRequest): Promise<boolean> {
		const id = request.id;
		if (!this.#reserveId(id, "uri", request)) return false;
		const scheme = uriScheme(request.url);
		const entry = scheme ? this.#uriSchemes.get(scheme) : undefined;
		if (!scheme || !entry) {
			await this.#sendUriError(id, `Host URI scheme \"${scheme ?? ""}\" is not registered`, request);
			return false;
		}
		if (request.operation === "write" && entry.definition.writable !== true) {
			await this.#sendUriError(id, `Host URI scheme \"${scheme}\" is not writable`, request);
			return false;
		}
		if (request.operation === "read" && !entry.read) {
			await this.#sendUriError(id, `Host URI scheme \"${scheme}\" has no read handler`, request);
			return false;
		}
		if (request.operation === "write" && !entry.write) {
			await this.#sendUriError(id, `Host URI scheme \"${scheme}\" has no write handler`, request);
			return false;
		}
		const active = this.#startActive(id, "uri", request);
		void this.#runUri(active, request, entry).catch(error => {
			this.#report(toError(error), { phase: "handler", operation: "uri", id, frame: request });
			if (this.#isLive(active)) void this.#finishUriError(active, toError(error).message, request);
			else active.resolveDone();
		});
		await active.done;
		return true;
	}

	async #handleCancel(
		request: OmpHostToolCancelRequest | OmpHostUriCancelRequest,
		operation: "tool" | "uri",
	): Promise<boolean> {
		const active = this.#active.get(request.targetId);
		if (!active || active.operation !== operation) {
			this.#report(new OmpHostProtocolError(`Stale ${operation} cancellation for ${request.targetId}`), {
				phase: "cancel",
				operation,
				id: request.targetId,
				frame: request,
			});
			return false;
		}
		active.cancelled = true;
		clearTimeout(active.timer);
		active.controller.abort(new Error(`${operation} request ${request.targetId} was cancelled`));
		this.#active.delete(request.targetId);
		active.resolveDone();
		return true;
	}

	#reserveId(id: string, operation: "tool" | "uri", frame: unknown): boolean {
		if (this.#seenIds.has(id)) {
			this.#report(new OmpHostProtocolError(`Duplicate ${operation} request id ${id}`), {
				phase: "protocol",
				operation,
				id,
				frame,
			});
			return false;
		}
		if (this.#seenIds.size >= this.#maxRequestIds) {
			const error = new OmpHostCapacityError(
				`OMP host request-id capacity ${this.#maxRequestIds} reached; start a new bridge incarnation`,
			);
			this.#report(error, { phase: "capacity", operation, id, frame });
			void this.#sendErrorForFrame(frame, error, operation, id);
			return false;
		}
		this.#seenIds.add(id);
		return true;
	}

	#startActive(id: string, operation: "tool" | "uri", frame: unknown): ActiveInvocation {
		const controller = new AbortController();
		let resolveDone!: () => void;
		const active: ActiveInvocation = {
			id,
			operation,
			controller,
			timer: setTimeout(() => this.#timeout(active, frame), this.#requestTimeoutMs),
			deadline: performance.now() + this.#requestTimeoutMs,
			cancelled: false,
			completed: false,
			timedOut: false,
			outputFailed: false,
			outputChain: Promise.resolve(),
			done: new Promise<void>(resolve => { resolveDone = resolve; }),
			resolveDone: () => resolveDone(),
		};
		active.timer.unref?.();
		this.#active.set(id, active);
		return active;
	}

	async #runTool(active: ActiveInvocation, request: OmpHostToolCallRequest, entry: ToolEntry): Promise<void> {
		const context: OmpHostToolContext = {
			request,
			signal: active.controller.signal,
			update: partialResult => this.#queueUpdate(active, partialResult, request),
		};
		let allowed: boolean;
		try {
			allowed = await this.#authorize(request, active.controller.signal);
		} catch (error) {
			this.#report(toError(error), { phase: "authorization", operation: "tool", id: active.id, frame: request });
			if (this.#isLive(active)) await this.#finishToolError(active, `Host tool \"${request.toolName}\" authorization failed`, request);
			return;
		}
		if (this.#expireIfDue(active, request)) return;
		if (!this.#isLive(active)) return;
		if (allowed !== true) {
			await this.#finishToolError(active, `Host tool \"${request.toolName}\" was denied by host authorization`, request);
			return;
		}
		let result: unknown;
		try {
			result = await entry.handler(request, context);
		} catch (error) {
			if (!this.#isLive(active)) return;
			const normalized = toError(error);
			this.#report(normalized, { phase: "handler", operation: "tool", id: active.id, frame: request });
			await this.#finishToolError(active, normalized.message, request);
			return;
		}
		if (this.#expireIfDue(active, request)) return;
		if (!this.#isLive(active)) return;
		await this.#finish(active, {
			type: "host_tool_result",
			id: active.id,
			result: normalizeToolResult(result),
		});
	}

	async #runUri(active: ActiveInvocation, request: OmpHostUriRequest, entry: UriEntry): Promise<void> {
		const context: OmpHostUriContext = { request, signal: active.controller.signal };
		let allowed: boolean;
		try {
			allowed = await this.#authorize(request, active.controller.signal);
		} catch (error) {
			this.#report(toError(error), { phase: "authorization", operation: "uri", id: active.id, frame: request });
			if (this.#isLive(active)) await this.#finishUriError(active, "Host URI authorization failed", request);
			return;
		}
		if (this.#expireIfDue(active, request)) return;
		if (!this.#isLive(active)) return;
		if (allowed !== true) {
			await this.#finishUriError(active, "Host URI request was denied by host authorization", request);
			return;
		}
		try {
			if (request.operation === "read") {
				const raw = await entry.read!(request, context);
				if (this.#expireIfDue(active, request)) return;
				if (!this.#isLive(active)) return;
				const normalized = this.#normalizeReadResult(raw);
				await this.#finish(active, { type: "host_uri_result", id: active.id, ...normalized });
				return;
			}
			await entry.write!(request, context);
		} catch (error) {
			if (!this.#isLive(active)) return;
			const normalized = toError(error);
			this.#report(normalized, { phase: "handler", operation: "uri", id: active.id, frame: request });
			await this.#finishUriError(active, normalized.message, request);
			return;
		}
		if (this.#expireIfDue(active, request)) return;
		if (!this.#isLive(active)) return;
		await this.#finish(active, { type: "host_uri_result", id: active.id });
	}

	#normalizeReadResult(value: OmpHostUriReadResult | string): OmpHostUriReadResult {
		if (typeof value === "string") return { content: value };
		if (!isRecord(value) || typeof value.content !== "string")
			throw new TypeError("Host URI read handler must return a string or { content: string }");
		if (value.contentType !== undefined && !URI_CONTENT_TYPES.has(value.contentType as string))
			throw new TypeError(`Host URI read handler returned invalid contentType: ${String(value.contentType)}`);
		if (value.notes !== undefined && (!Array.isArray(value.notes) || value.notes.some(item => typeof item !== "string")))
			throw new TypeError("Host URI read handler notes must be an array of strings");
		if (value.immutable !== undefined && typeof value.immutable !== "boolean")
			throw new TypeError("Host URI read handler immutable must be boolean");
		return cloneFrozen({
			content: value.content,
			contentType: value.contentType as OmpHostUriReadResult["contentType"],
			notes: value.notes ? [...value.notes] : undefined,
			immutable: value.immutable,
		});
	}

	#queueUpdate(active: ActiveInvocation, partialResult: unknown, frame: unknown): Promise<void> {
		if (this.#expireIfDue(active, frame)) return Promise.resolve();
		if (!this.#isLive(active)) return Promise.resolve();
		let normalized: RecordValue;
		try {
			normalized = normalizeToolResult(partialResult);
		} catch (error) {
			this.#report(toError(error), { phase: "handler", operation: "tool", id: active.id, frame });
			return Promise.resolve();
		}
		const output: RpcHostToolUpdate = { type: "host_tool_update", id: active.id, partialResult: normalized };
		const queued = active.outputChain.then(() => {
			if (active.cancelled || active.timedOut || active.outputFailed || this.#disposed) return;
			return this.#safeSend(output, {
				phase: "send",
				operation: "tool",
				id: active.id,
				frame,
			}, active.deadline).then(ok => {
				if (!ok) active.outputFailed = true;
			});
		});
		active.outputChain = queued.catch(() => {});
		return queued;
	}

	async #finishToolError(active: ActiveInvocation, message: string, frame: unknown): Promise<void> {
		await this.#finish(active, {
			type: "host_tool_result",
			id: active.id,
			result: toolErrorResult(message),
			isError: true,
		}, frame);
	}

	async #finishUriError(active: ActiveInvocation, message: string, frame: unknown): Promise<void> {
		await this.#finish(active, { type: "host_uri_result", id: active.id, isError: true, error: message }, frame);
	}

	async #finish(active: ActiveInvocation, output: OmpHostOutboundFrame, frame: unknown = output): Promise<void> {
		if (!this.#isLive(active)) return;
		active.completed = true;
		clearTimeout(active.timer);
		const queued = active.outputChain.then(() => {
			if (active.cancelled || active.outputFailed || this.#disposed) return;
			return this.#safeSend(output, {
				phase: "send",
				operation: active.operation,
				id: active.id,
				frame,
			}, active.deadline).then(ok => {
				if (!ok) active.outputFailed = true;
			});
		});
		active.outputChain = queued.catch(() => {});
		await queued;
		this.#active.delete(active.id);
		active.resolveDone();
	}

	#timeout(active: ActiveInvocation, frame: unknown): void {
		if (!this.#isLive(active)) return;
		active.completed = true;
		clearTimeout(active.timer);
		this.#active.delete(active.id);
		active.controller.abort(new Error(`${active.operation} request ${active.id} timed out`));
		active.timedOut = true;
		const output: OmpHostOutboundFrame =
			active.operation === "tool"
				? {
						type: "host_tool_result",
						id: active.id,
						result: toolErrorResult(`${active.operation} request ${active.id} timed out`),
						isError: true,
				  }
				: { type: "host_uri_result", id: active.id, isError: true, error: `${active.operation} request ${active.id} timed out` };
		// Timeout output must not wait behind a potentially stuck update writer.
		// Existing queued updates observe timedOut and are dropped; this terminal
		// diagnostic gets its own bounded send attempt.
		void this.#safeSend(output, { phase: "send", operation: active.operation, id: active.id, frame })
			.finally(() => active.resolveDone())
			.catch(() => {});
	}

	#expireIfDue(active: ActiveInvocation, frame: unknown): boolean {
		if (!this.#isLive(active)) return true;
		if (performance.now() < active.deadline) return false;
		this.#timeout(active, frame);
		return true;
	}

	#isLive(active: ActiveInvocation): boolean {
		return !this.#disposed && !active.cancelled && !active.completed && this.#active.get(active.id) === active;
	}

	async #sendToolError(id: string, message: string, frame: unknown): Promise<void> {
		await this.#safeSend({ type: "host_tool_result", id, result: toolErrorResult(message), isError: true }, {
			phase: "send",
			operation: "tool",
			id,
			frame,
		});
	}

	async #sendUriError(id: string, message: string, frame: unknown): Promise<void> {
		await this.#safeSend({ type: "host_uri_result", id, isError: true, error: message }, {
			phase: "send",
			operation: "uri",
			id,
			frame,
		});
	}

	async #sendErrorForFrame(frame: unknown, error: Error, operation: "tool" | "uri", id: string): Promise<void> {
		if (operation === "tool") await this.#sendToolError(id, error.message, frame);
		else await this.#sendUriError(id, error.message, frame);
	}

	async #safeSend(frame: OmpHostOutboundFrame, context: OmpHostErrorContext, deadline?: number): Promise<boolean> {
		const expired = (): boolean => {
			if (deadline === undefined || performance.now() < deadline) return false;
			this.#report(new Error("Host bridge output deadline elapsed"), { ...context, phase: "send" });
			return true;
		};
		if (expired()) return false;
		let returned: void | Promise<void>;
		try {
			returned = this.#send(frame);
		} catch (error) {
			this.#report(toError(error), { ...context, phase: "send" });
			return false;
		}
		if (returned === undefined) return !expired();

		// Observe the callback's rejection even if its promise outlives the
		// bounded wait below. This keeps a stuck or late writer from producing an
		// unhandled rejection in the host process.
		const sendDone = Promise.resolve(returned).then(
			() => ({ kind: "done" as const, error: undefined }),
			error => ({ kind: "done" as const, error: toError(error) }),
		);
		let timer: ReturnType<typeof setTimeout> | undefined;
		const remainingMs = deadline === undefined
			? this.#sendTimeoutMs
			: Math.max(0, Math.min(this.#sendTimeoutMs, deadline - performance.now()));
		const timeout = new Promise<{ kind: "timeout" }>(resolve => {
			timer = setTimeout(() => resolve({ kind: "timeout" }), remainingMs);
		});
		const outcome = await Promise.race([sendDone, timeout]);
		if (timer) clearTimeout(timer);
		if (outcome.kind === "timeout") {
			this.#report(new Error(`Host bridge send timed out after ${remainingMs} ms`), {
				...context,
				phase: "send",
			});
			void sendDone.then(result => {
				if (result.error) this.#report(result.error, { ...context, phase: "send" });
			});
			return false;
		}
		if (outcome.error) {
			this.#report(outcome.error, { ...context, phase: "send" });
			return false;
		}
		return !expired();
	}

	#report(error: Error, context: OmpHostErrorContext): void {
		try {
			this.#onError?.(error, context);
		} catch {
			// Diagnostics must never become an unhandled rejection or tear down the bridge.
		}
	}

	#assertOpen(): void {
		if (this.#disposed) throw new OmpHostDisposedError("OMP host dispatcher is disposed");
	}
}

export type {
	RpcHostToolDefinition,
	RpcHostUriSchemeDefinition,
	RpcHostToolResult,
	RpcHostToolUpdate,
	RpcHostUriResult,
};
