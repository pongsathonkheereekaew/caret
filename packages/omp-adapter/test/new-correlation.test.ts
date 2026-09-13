import { afterEach, expect, it } from "bun:test";
import { fileURLToPath } from "node:url";
import { OmpRpcClient } from "../src/client.ts";

const fixture = fileURLToPath(new URL("./fixtures/fake-omp-launcher", import.meta.url));
const fixtureNode = process.env.CARET_FIXTURE_NODE ?? process.execPath;
const clients: OmpRpcClient[] = [];

afterEach(async () => {
	for (const client of clients.splice(0)) await client.close();
});

it("binds the generated request id before enqueue and does not dispatch when the binder throws", async () => {
	const client = await OmpRpcClient.start({
		executable: fixture,
		env: { CARET_NODE: fixtureNode, CARET_FAKE_OMP_MODE: "backpressure" },
		readyTimeoutMs: 2_000,
		requestTimeoutMs: 2_000,
	});
	clients.push(client);

	await expect(client.request("get_state", {}, { onRequestId: () => { throw new Error("durable claim failed"); } }))
		.rejects.toThrow("durable claim failed");

	// The fixture reports every received command on this response.  Only the
	// successful request should appear; the callback failure must leave no
	// pending write or child-side effect behind.
	const response = await client.request("get_state", {});
	const receivedTypes = (response.data as { receivedTypes: string[] }).receivedTypes;
	expect(receivedTypes).toEqual(["negotiate_protocol", "get_state"]);
});
