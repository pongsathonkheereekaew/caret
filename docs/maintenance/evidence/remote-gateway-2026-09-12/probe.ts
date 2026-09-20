import * as Net from "node:net";
import { serveRemote } from "./apps/caret-daemon/src/remote.ts";

type Message = Record<string, unknown>;

const fail = (message: string): never => {
  throw new Error(message);
};

const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) fail(message);
};

const withTimeout = async <T>(promise: Promise<T>, label: string, ms = 3_000): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

class Lines {
  private buffer = "";
  private readonly queue: Message[] = [];
  private readonly waiters: Array<(message: Message) => void> = [];

  constructor(readonly socket: Net.Socket) {
    socket.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString("utf8");
      const lines = this.buffer.split("\n");
      this.buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const message = JSON.parse(trimmed) as Message;
        const waiter = this.waiters.shift();
        if (waiter) waiter(message);
        else this.queue.push(message);
      }
    });
  }

  next(): Promise<Message> {
    const message = this.queue.shift();
    if (message) return Promise.resolve(message);
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  async nextMatching(predicate: (message: Message) => boolean): Promise<Message> {
    const skipped: Message[] = [];
    for (;;) {
      const message = await this.next();
      if (predicate(message)) {
        this.queue.unshift(...skipped);
        return message;
      }
      skipped.push(message);
    }
  }

  send(envelope: unknown): void {
    this.socket.write(`${JSON.stringify(envelope)}\n`);
  }

  sendRaw(text: string): void {
    this.socket.write(text);
  }

  close(): void {
    this.socket.destroy();
  }
}

const connect = (port: number): Promise<Lines> =>
  new Promise((resolve, reject) => {
    const socket = Net.connect(port, "127.0.0.1", () => resolve(new Lines(socket)));
    socket.once("error", reject);
  });

let duplicateInvocations = 0;
let releaseDuplicate!: () => void;
const duplicateGate = new Promise<void>((resolve) => {
  releaseDuplicate = resolve;
});
let bothDuplicateHandlersStarted!: () => void;
const duplicateHandlersStarted = new Promise<void>((resolve) => {
  bothDuplicateHandlersStarted = resolve;
});

const gateway = await serveRemote(
  (notify) => ({
    "probe.block": () => {
      duplicateInvocations += 1;
      if (duplicateInvocations === 2) bothDuplicateHandlersStarted();
      return duplicateGate.then(() => ({ completed: true }));
    },
    "probe.emit": () => {
      notify({ event: "probe.broadcast", marker: "sent" });
      return Promise.resolve({ emitted: true });
    },
  }),
  async (effect: unknown) => await effect,
  { host: "127.0.0.1", port: 0, token: "probe-token" },
);

const clients: Lines[] = [];
try {
  // (1) A duplicate id is checked before in-flight work is recorded, so two
  // lines sent before the first handler resolves execute the fixture twice.
  const duplicateClient = await connect(gateway.port);
  clients.push(duplicateClient);
  const duplicateEnvelope = {
    id: "duplicate-id",
    method: "probe.block",
    params: {},
    auth: gateway.token,
  };
  duplicateClient.sendRaw(`${JSON.stringify(duplicateEnvelope)}\n${JSON.stringify(duplicateEnvelope)}\n`);
  await withTimeout(duplicateHandlersStarted, "both duplicate handlers");
  assert(duplicateInvocations === 2, `expected 2 duplicate invocations, got ${duplicateInvocations}`);
  releaseDuplicate();
  const duplicateResponses = await withTimeout(Promise.all([duplicateClient.next(), duplicateClient.next()]), "duplicate responses");
  assert(duplicateResponses.length === 2, `expected 2 duplicate responses, got ${duplicateResponses.length}`);
  assert(duplicateResponses.every((response) => response.id === "duplicate-id" && response.ok === true), "duplicate responses were not successful");
  console.log(`duplicate_same_id: invocations=${duplicateInvocations} responses=${duplicateResponses.length} assertion=PASS`);

  // (2) A socket that never sends an authenticated request still receives a
  // broadcast emitted by an authenticated client because it is in sockets.
  const unauthenticated = await connect(gateway.port);
  const emitter = await connect(gateway.port);
  clients.push(unauthenticated, emitter);
  const eventPromise = unauthenticated.next();
  emitter.send({ id: "emit-1", method: "probe.emit", params: {}, auth: gateway.token });
  const event = await withTimeout(eventPromise, "unauthenticated broadcast");
  assert(event.event === "probe.broadcast" && event.marker === "sent", `unexpected unauthenticated event: ${JSON.stringify(event)}`);
  const emitResponse = await withTimeout(emitter.nextMatching((message) => message.id === "emit-1"), "emit response");
  assert(emitResponse.id === "emit-1" && emitResponse.ok === true, `unexpected emit response: ${JSON.stringify(emitResponse)}`);
  console.log(`unauthenticated_socket_broadcast: event=${JSON.stringify(event)} assertion=PASS`);

  // (3) Revoke rotates the token but does not remove or mark existing sockets;
  // the previously authenticated socket receives a later event without
  // sending another request.
  const revokedSocket = await connect(gateway.port);
  const freshTokenClient = await connect(gateway.port);
  clients.push(revokedSocket, freshTokenClient);
  const staleToken = gateway.token;
  revokedSocket.send({ id: "revoke-1", method: "pairing.revoke", params: {}, auth: staleToken });
  const revokeResponse = await withTimeout(revokedSocket.next(), "revoke response");
  assert(revokeResponse.id === "revoke-1" && revokeResponse.ok === true, `unexpected revoke response: ${JSON.stringify(revokeResponse)}`);
  const freshToken = (revokeResponse.result as { token?: unknown } | undefined)?.token;
  assert(typeof freshToken === "string" && freshToken.length > 0, `missing fresh token: ${JSON.stringify(revokeResponse)}`);
  const revokedEventPromise = revokedSocket.next();
  freshTokenClient.send({ id: "emit-2", method: "probe.emit", params: {}, auth: freshToken });
  const revokedEvent = await withTimeout(revokedEventPromise, "event on revoked existing socket");
  assert(revokedEvent.event === "probe.broadcast" && revokedEvent.marker === "sent", `unexpected revoked socket event: ${JSON.stringify(revokedEvent)}`);
  const freshEmitResponse = await withTimeout(freshTokenClient.nextMatching((message) => message.id === "emit-2"), "fresh-token emit response");
  assert(freshEmitResponse.id === "emit-2" && freshEmitResponse.ok === true, `unexpected fresh emit response: ${JSON.stringify(freshEmitResponse)}`);
  revokedSocket.send({ id: "stale-check", method: "probe.emit", params: {}, auth: staleToken });
  const staleRequestResponse = await withTimeout(revokedSocket.nextMatching((message) => message.id === "stale-check"), "stale-token request response");
  assert(staleRequestResponse.ok === false && staleRequestResponse.error === "unauthorized", `unexpected stale-token response: ${JSON.stringify(staleRequestResponse)}`);
  console.log(`revoked_existing_socket_broadcast: stale_token_rotated=${freshToken !== staleToken} event=${JSON.stringify(revokedEvent)} stale_request=${staleRequestResponse.error} assertion=PASS`);
} finally {
  for (const client of clients) client.close();
  await gateway.close();
}
