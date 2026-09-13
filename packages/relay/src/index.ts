/** Browser-safe Caret relay public entrypoint. */

export { CaretRelayClient } from "./client.ts";
export type {
	CaretRelayClientOptions,
	CaretRelayClientResponse,
	CaretRelayClientState,
	CaretRelayRequestInput,
} from "./client.ts";
export {
	CaretRelayCapacityError,
	CaretRelayConnectionError,
	CaretRelayDisconnectedError,
	CaretRelayRequestTimeoutError,
} from "./client.ts";

export { CaretRelayHost } from "./host.ts";
export type { CaretRelayHostOptions, CaretRelayRequestHandler } from "./host.ts";

export {
	CARET_RELAY_PROTOCOL_VERSION,
	PASEO_RELAY_PROTOCOL_VERSION,
	DEFAULT_RELAY_MAX_PENDING_REQUESTS,
	DEFAULT_RELAY_MAX_REQUEST_IDS,
	DEFAULT_RELAY_REQUEST_TIMEOUT_MS,
	MAX_RELAY_PAYLOAD_BYTES,
	buildRelayWebSocketUrl,
	createCaretRelayPairingOffer,
	createCaretRelayRequest,
	createCaretRelayResponse,
	fingerprintCaretRelayRequest,
	parseCaretRelayMessage,
	serializeCaretRelayMessage,
	stableJson,
	validateCaretRelayPairingOffer,
} from "./protocol.ts";
export type {
	CaretRelayHandlerRequest,
	CaretRelayHandlerResponse,
	CaretRelayJson,
	CaretRelayMessage,
	CaretRelayPairingOffer,
	CaretRelayRequest,
	CaretRelayResponse,
	CreateCaretRelayPairingOfferInput,
} from "./protocol.ts";
export { CaretRelayOfferError, CaretRelayProtocolError } from "./protocol.ts";

export {
	createClientChannel,
	createDaemonChannel,
	EncryptedChannel,
	generateKeyPair,
	exportPublicKey,
	importPublicKey,
	exportSecretKey,
	importSecretKey,
	deriveSharedKey,
	encrypt,
	decrypt,
} from "./e2ee.ts";
export type { EncryptedChannelEvents, Transport, TransportMessage, KeyPair, SharedKey } from "./e2ee.ts";

export type {
	CaretRelaySocket,
	CaretRelaySocketMessage,
	CaretRelayTransport,
	CaretRelayWebSocketFactory,
} from "./transport.ts";
