import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";
import type { Json } from "../../../../packages/protocol/src/index.ts";
import { CaretApi, loginProvidersFromCommand } from "../core/api.ts";
import type { ArtifactReceipt } from "../core/artifacts.ts";
import type { ClientTransport } from "../core/transport.ts";
import type { Command, CommandRequest } from "../../../../packages/protocol/src/index.ts";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

describe("mobile host API", () => {
  test("hydrates bounded frame references before exposing an event page", async () => {
    const frame = { type: "tool_execution_end", output: "x".repeat(50_000) };
    const encoded = JSON.stringify(frame);
    const reference = { type: "caret_frame_reference", sequence: 7, length: encoded.length, sha256: sha256(encoded) };
    const requests: string[] = [];
    const transport: ClientTransport = {
      request: async (_method, path) => {
        requests.push(path);
        if (path.includes("/events?") && !path.includes("/frame")) return { status: 200, body: { events: [{ sessionId: "s1", incarnation: "inc-1", sequence: 7, timestamp: "2026-09-12T00:00:00.000Z", frame: reference }], cursor: 7, hasMore: false } };
        const offset = Number(new URL(`http://caret.local${path}`).searchParams.get("offset"));
        return { status: 200, body: { sequence: 7, offset, text: encoded.slice(offset, offset + 24_000), length: encoded.length, sha256: reference.sha256 } };
      },
    };
    const api = new CaretApi({ transport, digestSha256: async value => sha256(value) });
    const page = await api.getEvents("s1", 0, 200);
    expect(page.events[0]?.frame).toEqual(frame as Json);
    expect(requests.filter(path => path.includes("/frame")).length).toBe(3);
  });

  test("rejects a frame whose reconstructed text fails the pinned hash", async () => {
    const encoded = JSON.stringify({ type: "large", value: "x".repeat(50_000) });
    const reference = { type: "caret_frame_reference", sequence: 2, length: encoded.length, sha256: "a".repeat(64) };
    const transport: ClientTransport = {
      request: async (_method, path) => path.includes("/frame")
        ? (() => { const offset = Number(new URL(`http://caret.local${path}`).searchParams.get("offset")); return { status: 200, body: { sequence: 2, offset, text: encoded.slice(offset, offset + 24_000), length: encoded.length, sha256: reference.sha256 } }; })()
        : { status: 200, body: { events: [{ sessionId: "s1", incarnation: "inc-1", sequence: 2, timestamp: "2026-09-12T00:00:00.000Z", frame: reference }], cursor: 2, hasMore: false } },
    };
    const api = new CaretApi({ transport, digestSha256: async value => sha256(value) });
    await expect(api.getEvents("s1")).rejects.toThrow("failed integrity verification");
  });

  test("hydrates generic command responses behind the relay response reference", async () => {
    const command = { sessionId: "s1", commandId: "c1", deviceId: "iphone-1", incarnation: "inc-1", kind: "prompt", payload: {}, status: "completed", result: { output: "x".repeat(50_000) }, createdAt: "2026-09-12T00:00:00.000Z", updatedAt: "2026-09-12T00:00:00.000Z" };
    const encoded = JSON.stringify(command);
    const reference = { sha256: sha256(encoded), length: encoded.length };
    const transport: ClientTransport = {
      request: async (_method, path, body) => {
        if (path === "/v1/sessions/s1/commands") {
          void body;
          return { status: 200, body: { caretResponseReference: reference } };
        }
        const offset = Number(new URL(`http://caret.local${path}`).searchParams.get("offset"));
        return { status: 200, body: { sha256: reference.sha256, length: reference.length, offset, text: encoded.slice(offset, offset + 24_000) } };
      },
    };
    const api = new CaretApi({ transport, digestSha256: async value => sha256(value) });
    const request: CommandRequest = { commandId: "c1", incarnation: "inc-1", command: "prompt", payload: { message: "hello" } };
    await expect(api.sendCommand("s1", request)).resolves.toMatchObject({ commandId: "c1", result: { output: "x".repeat(50_000) } });
  });

  test("lists, captures, and reads artifacts through the same encrypted transport", async () => {
    const bytes = new TextEncoder().encode("artifact bytes");
    const receipt: ArtifactReceipt = { sha256: sha256(String.fromCharCode(...bytes)), name: "demo.txt", size: bytes.byteLength, sourcePath: "dist/demo.txt", sessionId: "s1", sourceHashes: [], createdAt: "2026-09-13T00:00:00.000Z" };
    const paths: string[] = [];
    const transport: ClientTransport = {
      request: async (method, path, body) => {
        paths.push(`${method} ${path}`);
        if (method === "GET" && path === "/v1/sessions/s1/artifacts") return { status: 200, body: [receipt] };
        if (method === "POST" && path === "/v1/sessions/s1/artifacts") return { status: 200, body: receipt };
        return { status: 200, body: { receipt, offset: 0, data: "YXJ0aWZhY3QgYnl0ZXM=", complete: true } };
      },
    };
    const api = new CaretApi({ transport });
    await expect(api.listArtifacts("s1")).resolves.toHaveLength(1);
    await expect(api.captureArtifact("s1", "dist/demo.txt", ["src/demo.ts"])).resolves.toMatchObject({ sessionId: "s1" });
    await expect(api.readArtifact("s1", receipt.sha256)).resolves.toMatchObject({ offset: 0, complete: true });
    expect(paths).toEqual([
      "GET /v1/sessions/s1/artifacts",
      "POST /v1/sessions/s1/artifacts",
      `GET /v1/sessions/s1/artifacts/${receipt.sha256}?offset=0`,
    ]);
  });

  test("does not expose an artifact chunk from another task", async () => {
    const receipt: ArtifactReceipt = { sha256: "a".repeat(64), name: "demo.bin", size: 1, sourcePath: "demo.bin", sessionId: "s2", sourceHashes: [], createdAt: "2026-09-13T00:00:00.000Z" };
    const api = new CaretApi({ transport: { request: async () => ({ status: 200, body: { receipt, offset: 0, data: "AA==", complete: true } }) } });
    await expect(api.readArtifact("s1", receipt.sha256)).rejects.toThrow("different task");
  });

  test("reads login providers from the command envelope without opening a URL", () => {
    const command = {
      sessionId: "s1",
      commandId: "cmd-1",
      deviceId: "phone",
      incarnation: "inc-1",
      kind: "get_login_providers",
      payload: {},
      payloadHash: "hash",
      status: "completed",
      createdAt: "now",
      updatedAt: "now",
      result: { data: { providers: [{ id: "openai", name: "OpenAI", authenticated: true }, { name: "No id" }] } },
    } as unknown as Command;
    expect(loginProvidersFromCommand(command)).toEqual([
      { id: "openai", name: "OpenAI", available: true, authenticated: true },
    ]);
  });
});
