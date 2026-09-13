import {
  CaretRelayClient,
  validateCaretRelayPairingOffer,
  type CaretRelayClientOptions,
  type CaretRelayJson,
  type CaretRelayPairingOffer,
  type CaretRelaySocket,
  type CaretRelayWebSocketFactory,
} from "../../../../packages/relay/src/index.ts";
import type { ClientTransport, TransportMethod } from "./transport.ts";

/** Options for wiring the real encrypted relay client into the mobile API seam. */
export interface MobileRelayTransportOptions {
  readonly offer: CaretRelayPairingOffer;
  /** Supply a platform WebSocket implementation in tests or custom runtimes. */
  readonly createWebSocket?: CaretRelayWebSocketFactory;
  readonly connectionId?: string;
  readonly requestTimeoutMs?: number;
  readonly handshakeTimeoutMs?: number;
  readonly onStateChange?: CaretRelayClientOptions["onStateChange"];
  readonly onError?: CaretRelayClientOptions["onError"];
}

export interface MobileRelayTransport {
  readonly client: CaretRelayClient;
  readonly transport: ClientTransport;
}

function defaultWebSocketFactory(url: string): CaretRelaySocket {
  const Socket = (globalThis as typeof globalThis & { WebSocket?: new (url: string) => unknown }).WebSocket;
  if (!Socket) throw new Error("WebSocket is unavailable; inject a platform WebSocket factory");
  return new Socket(url) as CaretRelaySocket;
}

/**
 * Adapt the endpoint-owned E2EE relay into the host API transport used by the
 * app. The client opens the channel lazily and never replays an unknown request.
 */
export function createMobileRelayTransport(options: MobileRelayTransportOptions): MobileRelayTransport {
  const offer = validateCaretRelayPairingOffer(options.offer);
  const relayOptions: CaretRelayClientOptions = {
    offer,
    createWebSocket: options.createWebSocket ?? defaultWebSocketFactory,
    ...(options.connectionId ? { connectionId: options.connectionId } : {}),
    ...(options.requestTimeoutMs ? { requestTimeoutMs: options.requestTimeoutMs } : {}),
    ...(options.handshakeTimeoutMs ? { handshakeTimeoutMs: options.handshakeTimeoutMs } : {}),
    ...(options.onStateChange ? { onStateChange: options.onStateChange } : {}),
    ...(options.onError ? { onError: options.onError } : {}),
  };
  const client = new CaretRelayClient(relayOptions);
  const transport: ClientTransport = {
    request: async (method: TransportMethod | string, path: string, body?: unknown) => {
      if (client.state !== "open") await client.connect();
      return client.request({
        method,
        path,
        ...(body === undefined ? {} : { body: body as CaretRelayJson }),
      });
    },
  };
  return { client, transport };
}
