/** WebSocket contracts shared by the browser/RN client and the Node host. */

export interface CaretRelaySocket {
	readonly readyState?: number;
	/** Browser and ws both accept text and bytes. */
	send(data: string | ArrayBuffer | Uint8Array): void | Promise<void>;
	close(code?: number, reason?: string): void;
	terminate?: () => void;
	addEventListener?: (event: string, listener: (event: unknown) => void) => void;
	removeEventListener?: (event: string, listener: (event: unknown) => void) => void;
	on?: (event: string, listener: (...args: unknown[]) => void) => void;
	off?: (event: string, listener: (...args: unknown[]) => void) => void;
	onopen?: (() => void) | null;
	onmessage?: ((event: unknown) => void) | null;
	onclose?: ((event: unknown) => void) | null;
	onerror?: ((event: unknown) => void) | null;
	binaryType?: string;
}

export type CaretRelayWebSocketFactory = (url: string) => CaretRelaySocket;

export interface CaretRelaySocketMessage {
	data: string | ArrayBuffer | Uint8Array;
	isBinary: boolean;
}

export interface CaretRelayTransport {
	send(data: string | ArrayBuffer): void | Promise<void>;
	close(code?: number, reason?: string): void;
	onmessage: ((message: CaretRelaySocketMessage) => void) | null;
	onclose: ((code: number, reason: string) => void) | null;
	onerror: ((error: Error) => void) | null;
}

function asError(value: unknown): Error {
	return value instanceof Error ? value : new Error(String(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function toArrayBuffer(value: ArrayBuffer | Uint8Array): ArrayBuffer {
	if (value instanceof ArrayBuffer) return value;
	const copy = new Uint8Array(value.byteLength);
	copy.set(value);
	return copy.buffer;
}

async function normalizeMessageData(value: unknown): Promise<{ data: string | ArrayBuffer; isBinary: boolean }> {
	if (typeof value === "string") return { data: value, isBinary: false };
	if (value instanceof ArrayBuffer) return { data: value, isBinary: true };
	if (value instanceof Uint8Array) return { data: toArrayBuffer(value), isBinary: true };
	if (isRecord(value) && typeof value.arrayBuffer === "function") {
		const buffer = await (value.arrayBuffer as () => Promise<ArrayBuffer>)();
		return { data: buffer, isBinary: true };
	}
	throw new Error("Unsupported WebSocket message payload");
}

function closeFields(value: unknown): { code: number; reason: string } {
	if (!isRecord(value)) return { code: 1006, reason: "" };
	const code = typeof value.code === "number" ? value.code : 1006;
	const reason = typeof value.reason === "string" ? value.reason : "";
	return { code, reason };
}

function eventData(value: unknown): unknown {
	if (isRecord(value) && "data" in value) return value.data;
	return value;
}

/** Attach a browser/RN or Node `ws` socket to the endpoint transport shape. */
export function createSocketTransport(socket: CaretRelaySocket): CaretRelayTransport {
	try {
		socket.binaryType = "arraybuffer";
	} catch {
		// React Native sockets may not expose binaryType.
	}
	const transport: CaretRelayTransport = {
		send(data) {
			const payload: string | ArrayBuffer = typeof data === "string" ? data : toArrayBuffer(data);
			try {
				return socket.send(payload);
			} catch (error) {
				return Promise.reject(asError(error));
			}
		},
		close(code, reason) {
			socket.close(code, reason);
		},
		onmessage: null,
		onclose: null,
		onerror: null,
	};

	const onOpen = () => undefined;
	const onMessage = (raw: unknown, isBinary?: unknown) => {
		const data = eventData(raw);
		void normalizeMessageData(data).then((message) => {
			if (typeof isBinary === "boolean") message.isBinary = isBinary;
			transport.onmessage?.(message);
		}).catch((error) => transport.onerror?.(asError(error)));
	};
	const onClose = (raw: unknown, reason?: unknown) => {
		if (typeof raw === "number") {
			transport.onclose?.(raw, typeof reason === "string" ? reason : String(reason ?? ""));
			return;
		}
		const fields = closeFields(raw);
		transport.onclose?.(fields.code, fields.reason);
	};
	const onError = (raw: unknown) => transport.onerror?.(asError(raw));

	if (typeof socket.addEventListener === "function") {
		socket.addEventListener("open", onOpen as (event: unknown) => void);
		socket.addEventListener("message", onMessage as (event: unknown) => void);
		socket.addEventListener("close", onClose as (event: unknown) => void);
		socket.addEventListener("error", onError as (event: unknown) => void);
	} else if (typeof socket.on === "function") {
		socket.on("open", onOpen);
		socket.on("message", onMessage);
		socket.on("close", onClose);
		socket.on("error", onError);
	} else {
		socket.onopen = onOpen;
		socket.onmessage = onMessage;
		socket.onclose = onClose;
		socket.onerror = onError;
	}

	return transport;
}

/** Subscribe to a socket event without importing a browser or Node runtime. */
export function subscribeSocket(
	socket: CaretRelaySocket,
	event: "open" | "message" | "close" | "error",
	listener: (...args: unknown[]) => void,
): () => void {
	if (typeof socket.addEventListener === "function") {
		const callback = listener as (event: unknown) => void;
		socket.addEventListener(event, callback);
		return () => socket.removeEventListener?.(event, callback);
	}
	if (typeof socket.on === "function") {
		socket.on(event, listener);
		return () => socket.off?.(event, listener);
	}
	const key = `on${event}` as "onopen" | "onmessage" | "onclose" | "onerror";
	const target = socket as unknown as Record<string, unknown>;
	const previous = target[key];
	target[key] = listener;
	return () => {
		if (target[key] === listener) {
			target[key] = previous;
		}
	};
}
