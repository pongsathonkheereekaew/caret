/**
 * Node host transport for a Caret relay.  This is deliberately a separate
 * entrypoint: importing the browser client never imports `ws` or Node APIs.
 */

import { WebSocket as NodeWebSocket } from "ws";
import {
	createDaemonChannel,
	type KeyPair,
	type EncryptedChannel,
	type Transport,
} from "./e2ee.ts";
import { CaretRelayHost, type CaretRelayRequestHandler } from "./host.ts";
import { buildRelayWebSocketUrl } from "./protocol.ts";
import { createSocketTransport, subscribeSocket, type CaretRelaySocket, type CaretRelayWebSocketFactory } from "./transport.ts";

export interface CaretRelayServerOptions {
	endpoint: string;
	useTls: boolean;
	serverId: string;
	daemonKeyPair: KeyPair;
	handler: CaretRelayRequestHandler;
	authorize: (token: string) => boolean;
	createWebSocket?: CaretRelayWebSocketFactory;
	maxRequestIds?: number;
	maxPendingRequests?: number;
	maxConnections?: number;
	maxActiveHandlers?: number;
	handshakeTimeoutMs?: number;
	requestTimeoutMs?: number;
	/** Reconnect the control socket after a relay outage. Defaults to true. */
	autoReconnect?: boolean;
	minReconnectDelayMs?: number;
	maxReconnectDelayMs?: number;
	onError?: (error: Error) => void;
	onConnectionState?: (state: "stopped" | "connecting" | "open" | "reconnecting") => void;
}

interface DataConnection {
	socket: CaretRelaySocket;
	transport: Transport;
	channel?: EncryptedChannel;
	host?: CaretRelayHost;
	closed: boolean;
	handshakeTimer?: ReturnType<typeof setTimeout>;
}

type ControlMessage =
	| { type: "sync"; connectionIds: string[] }
	| { type: "connected"; connectionId: string }
	| { type: "disconnected"; connectionId: string }
	| { type: "ping" }
	| { type: "pong" };

const DEFAULT_RECONNECT_MIN_MS = 1_000;
const DEFAULT_RECONNECT_MAX_MS = 30_000;

function asError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error));
}

function defaultWebSocket(url: string): CaretRelaySocket {
	return new NodeWebSocket(url, { handshakeTimeout: 10_000, perMessageDeflate: false }) as unknown as CaretRelaySocket;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeText(value: unknown): string {
	// Browser-style EventTarget listeners (also exposed by recent `ws` releases)
	// receive a MessageEvent object, while the Node `on("message")` API passes
	// the frame directly.  Normalize both forms before parsing control traffic.
	if (isRecord(value) && "data" in value) return decodeText(value.data);
	if (typeof value === "string") return value;
	if (value instanceof ArrayBuffer) return new TextDecoder("utf-8", { fatal: true }).decode(value);
	if (value instanceof Uint8Array) return new TextDecoder("utf-8", { fatal: true }).decode(value);
	return String(value);
}

function parseControl(value: unknown): ControlMessage | null {
	try {
		const parsed: unknown = JSON.parse(decodeText(value));
		if (!isRecord(parsed) || typeof parsed.type !== "string") return null;
		if (parsed.type === "ping") return { type: "ping" };
		if (parsed.type === "pong") return { type: "pong" };
		if (parsed.type === "sync" && Array.isArray(parsed.connectionIds)) {
			const connectionIds = parsed.connectionIds.filter((id): id is string => typeof id === "string" && id.length > 0);
			if (connectionIds.length !== parsed.connectionIds.length) return null;
			return { type: "sync", connectionIds };
		}
		if ((parsed.type === "connected" || parsed.type === "disconnected") && typeof parsed.connectionId === "string" && parsed.connectionId.length > 0) {
			return { type: parsed.type, connectionId: parsed.connectionId };
		}
		return null;
	} catch {
		return null;
	}
}

export class CaretRelayServer {
	readonly #options: CaretRelayServerOptions;
	readonly #factory: CaretRelayWebSocketFactory;
	readonly #data = new Map<string, DataConnection>();
	#control: CaretRelaySocket | null = null;
	#started = false;
	#stopped = true;
	#connecting: Promise<void> | null = null;
	#reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	#reconnectAttempt = 0;
	#activeHandlers = 0;

	constructor(options: CaretRelayServerOptions) {
		if (!options || typeof options !== "object") throw new TypeError("relay server options are required");
		if (typeof options.handler !== "function") throw new TypeError("handler is required");
		if (!options.daemonKeyPair) throw new TypeError("daemonKeyPair is required");
		this.#options = options;
		this.#factory = options.createWebSocket ?? defaultWebSocket;
		for (const value of [options.maxConnections ?? 16, options.maxActiveHandlers ?? 64, options.handshakeTimeoutMs ?? 10_000]) if (!Number.isSafeInteger(value) || value < 1) throw new RangeError("Invalid relay admission limits");
		const min = options.minReconnectDelayMs ?? DEFAULT_RECONNECT_MIN_MS;
		const max = options.maxReconnectDelayMs ?? DEFAULT_RECONNECT_MAX_MS;
		if (!Number.isSafeInteger(min) || min < 1 || !Number.isSafeInteger(max) || max < min) throw new RangeError("reconnect delay bounds are invalid");
	}

	get started(): boolean {
		return this.#started && !this.#stopped;
	}

	get connectionCount(): number {
		return this.#data.size;
	}

	async start(): Promise<void> {
		if (this.#connecting) return this.#connecting;
		if (this.started) return;
		this.#stopped = false;
		this.#started = true;
		this.#setState("connecting");
		return this.#beginConnectControl();
	}

	async stop(): Promise<void> {
		this.#stopped = true;
		this.#started = false;
		if (this.#reconnectTimer) {
			clearTimeout(this.#reconnectTimer);
			this.#reconnectTimer = null;
		}
		const control = this.#control;
		this.#control = null;
		try { control?.close(1000, "Normal closure"); } catch { /* already closed */ }
		const data = [...this.#data.values()];
		this.#data.clear();
		for (const connection of data) {
			connection.closed = true;
			if (connection.handshakeTimer) clearTimeout(connection.handshakeTimer);
			connection.host?.dispose();
			try { connection.socket.close(1000, "Normal closure"); } catch { /* already closed */ }
		}
		this.#setState("stopped");
	}

	async #connectControl(): Promise<void> {
		if (this.#stopped) return;
		const url = buildRelayWebSocketUrl({ endpoint: this.#options.endpoint, useTls: this.#options.useTls, serverId: this.#options.serverId, role: "server" });
		let socket: CaretRelaySocket;
		try {
			socket = this.#factory(url);
		} catch (error) {
			this.#emitError(asError(error));
			throw error;
		}
		this.#control = socket;
		return new Promise<void>((resolve, reject) => {
			let opened = false;
			let settled = false;
			const settleOpen = () => { if (!settled) { settled = true; opened = true; this.#reconnectAttempt = 0; this.#setState("open"); resolve(); } };
			const fail = (error: Error) => {
				if (this.#control === socket) this.#control = null;
				if (!settled) { settled = true; reject(error); }
			};
			subscribeSocket(socket, "open", settleOpen);
			subscribeSocket(socket, "error", (error) => {
				this.#emitError(asError(error));
				if (!opened) fail(asError(error));
			});
			subscribeSocket(socket, "close", (code?: unknown, reason?: unknown) => {
				if (this.#control === socket) this.#control = null;
				if (!opened) fail(new Error(`relay control closed before open (${String(code ?? 1006)}): ${String(reason ?? "")}`));
				else if (!this.#stopped) {
					this.#setState("reconnecting");
					this.#scheduleReconnect();
				}
			});
			subscribeSocket(socket, "message", (data: unknown) => {
				const raw = Array.isArray(data) ? data[0] : data;
				const message = parseControl(raw);
				if (!message) return;
				if (message.type === "ping") {
					try { socket.send(JSON.stringify({ type: "pong" })); } catch (error) { this.#emitError(asError(error)); }
				} else if (message.type === "sync") {
					for (const id of message.connectionIds) this.#ensureDataSocket(id);
				} else if (message.type === "connected") {
					this.#ensureDataSocket(message.connectionId);
				} else if (message.type === "disconnected") {
					this.#closeDataSocket(message.connectionId);
				}
			});
			if (socket.readyState === 1) settleOpen();
		});
	}

	/** Run one control connection attempt and only clear the in-flight guard
	 * before scheduling a retry. Scheduling from inside #connectControl while
	 * #connecting still points at the rejected promise suppresses the retry. */
	#beginConnectControl(): Promise<void> {
		if (this.#connecting) return this.#connecting;
		const operation = this.#connectControl().finally(() => {
			if (this.#connecting !== operation) return;
			this.#connecting = null;
			if (!this.#stopped && !this.started) return;
			if (!this.#stopped && this.#control === null) this.#scheduleReconnect();
		});
		this.#connecting = operation;
		return operation;
	}

	#scheduleReconnect(): void {
		if (this.#stopped || this.#options.autoReconnect === false || this.#reconnectTimer || this.#connecting) return;
		this.#reconnectAttempt += 1;
		const min = this.#options.minReconnectDelayMs ?? DEFAULT_RECONNECT_MIN_MS;
		const max = this.#options.maxReconnectDelayMs ?? DEFAULT_RECONNECT_MAX_MS;
		const delay = Math.min(max, min * 2 ** Math.min(this.#reconnectAttempt - 1, 10));
		this.#reconnectTimer = setTimeout(() => {
			this.#reconnectTimer = null;
			if (this.#stopped) return;
			this.#setState("reconnecting");
			void this.#beginConnectControl().catch((error) => this.#emitError(asError(error)));
		}, delay);
		if (typeof this.#reconnectTimer === "object" && this.#reconnectTimer !== null && "unref" in this.#reconnectTimer) {
			const unref = (this.#reconnectTimer as { unref?: unknown }).unref;
			if (typeof unref === "function") unref.call(this.#reconnectTimer);
		}
	}

	#ensureDataSocket(connectionId: string): void {
		if (this.#stopped || !connectionId || connectionId.length > 256 || this.#data.has(connectionId) || this.#data.size >= (this.#options.maxConnections ?? 16)) return;
		const url = buildRelayWebSocketUrl({ endpoint: this.#options.endpoint, useTls: this.#options.useTls, serverId: this.#options.serverId, role: "server", connectionId });
		let socket: CaretRelaySocket;
		try { socket = this.#factory(url); } catch (error) { this.#emitError(asError(error)); return; }
		const transport = createSocketTransport(socket);
		const connection: DataConnection = { socket, transport, closed: false };
		this.#data.set(connectionId, connection);
		connection.handshakeTimer = setTimeout(() => this.#closeDataSocket(connectionId, connection), this.#options.handshakeTimeoutMs ?? 10_000);
		let host: CaretRelayHost | undefined;
		const earlyFrames: Array<string | ArrayBuffer> = [];
		const channelPromise = createDaemonChannel(transport, this.#options.daemonKeyPair, {
			onmessage: (data) => host ? host.receive(data) : earlyFrames.push(data),
			onerror: (error) => this.#emitError(error),
			onclose: () => this.#closeDataSocket(connectionId, connection),
		});
		void channelPromise.then((channel) => {
			if (connection.closed || this.#stopped) { channel.close(); return; }
			if (connection.handshakeTimer) clearTimeout(connection.handshakeTimer);
			connection.channel = channel;
			host = connection.host = new CaretRelayHost({ channel, handler: async (request, context) => {
				if (this.#activeHandlers >= (this.#options.maxActiveHandlers ?? 64)) return { status: 429, body: { error: "Host request capacity reached" } };
				this.#activeHandlers++;
				try { return await this.#options.handler(request, context); } finally { this.#activeHandlers--; }
			}, authorize: this.#options.authorize, maxRequestIds: this.#options.maxRequestIds, maxPendingRequests: this.#options.maxPendingRequests, requestTimeoutMs: this.#options.requestTimeoutMs, onError: (error) => this.#emitError(error) });
			for (const frame of earlyFrames.splice(0)) host.receive(frame);
		}).catch((error) => {
			this.#emitError(asError(error));
			this.#closeDataSocket(connectionId, connection);
		});
		subscribeSocket(socket, "close", () => this.#closeDataSocket(connectionId, connection));
		subscribeSocket(socket, "error", (error) => this.#emitError(asError(error)));
	}

	#closeDataSocket(connectionId: string, expected?: DataConnection): void {
		const connection = this.#data.get(connectionId);
		if (!connection || (expected && expected !== connection)) return;
		this.#data.delete(connectionId);
		connection.closed = true;
			if (connection.handshakeTimer) clearTimeout(connection.handshakeTimer);
		connection.host?.dispose();
		try { connection.socket.close(1001, "Relay connection closed"); } catch { /* already closed */ }
	}

	#setState(state: "stopped" | "connecting" | "open" | "reconnecting"): void {
		try { this.#options.onConnectionState?.(state); } catch { /* observational callback */ }
	}

	#emitError(error: Error): void {
		try { this.#options.onError?.(error); } catch { /* diagnostics must not break transport */ }
	}
}
