/** Endpoint E2EE entrypoint adapted from Paseo @getpaseo/relay@0.8.0. */

export { createClientChannel, createDaemonChannel, EncryptedChannel } from "./encrypted-channel.ts";
export type { Transport, TransportMessage, EncryptedChannelEvents } from "./encrypted-channel.ts";

export {
	generateKeyPair,
	exportPublicKey,
	importPublicKey,
	exportSecretKey,
	importSecretKey,
	deriveSharedKey,
	encrypt,
	decrypt,
} from "./crypto.ts";
export type { KeyPair, SharedKey } from "./crypto.ts";
