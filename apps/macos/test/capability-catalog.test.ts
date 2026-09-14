import { describe, expect, it } from "bun:test";
import {
	ompSettingsCatalog,
	SETTINGS_SECTIONS,
	type CatalogEntry,
} from "../src/capability-catalog.ts";

function byId(entries: readonly CatalogEntry[], id: string): CatalogEntry {
	const found = entries.find((entry) => entry.id === id);
	if (!found) {
		throw new Error(`missing catalog entry ${id}`);
	}
	return found;
}

describe("SETTINGS_SECTIONS", () => {
	it("lists product settings in declared order", () => {
		expect([...SETTINGS_SECTIONS]).toEqual([
			"Appearance",
			"Agents/OMP",
			"Models/providers",
			"Tools/MCP",
			"Skills/rules/hooks/commands",
			"Workspace/editor",
			"Browser/artifacts",
			"Devices/connections",
			"Notifications",
			"Privacy/security",
			"About/updates/licenses",
		]);
	});
});

describe("ompSettingsCatalog", () => {
	it("defaults voice, cloud, automations, and browser to unsupported without inventing a backend", () => {
		const catalog = ompSettingsCatalog({});
		for (const id of ["voice", "cloud", "automations", "browser"]) {
			const entry = byId(catalog, id);
			expect(entry.status).toBe("unsupported");
			expect(entry.reason).toBe("Caret does not invent the backend");
		}
		expect(catalog.some((entry) => entry.status === "available" && ["voice", "cloud", "automations", "browser"].includes(entry.id))).toBe(false);
	});

	it("never marks gated capabilities available unless input says so", () => {
		const catalog = ompSettingsCatalog({
			voice: false,
			cloud: { available: false },
			automations: { status: "unsupported" },
			browserBridge: undefined,
		});
		expect(byId(catalog, "voice").status).toBe("unsupported");
		expect(byId(catalog, "cloud").status).toBe("unsupported");
		expect(byId(catalog, "automations").status).toBe("unsupported");
		expect(byId(catalog, "browser").status).toBe("unsupported");
	});

	it("marks gated capabilities available only when advertised", () => {
		const catalog = ompSettingsCatalog({
			browserBridge: true,
			voice: { available: true },
			cloud: { status: "available" },
			automations: { status: "available", reason: "Host advertised automations" },
		});
		expect(byId(catalog, "browser").status).toBe("available");
		expect(byId(catalog, "voice").status).toBe("available");
		expect(byId(catalog, "cloud").status).toBe("available");
		expect(byId(catalog, "automations").status).toBe("available");
		expect(byId(catalog, "automations").reason).toBe("Host advertised automations");
	});

	it("marks advertised models available", () => {
		const catalog = ompSettingsCatalog({
			models: [{ id: "gpt-5", label: "GPT-5", provider: "openai" }],
		});
		const model = byId(catalog, "model:gpt-5");
		expect(model.label).toBe("GPT-5");
		expect(model.status).toBe("available");
		expect(model.owner).toBe("omp");
	});

	it("marks models needs_auth when the provider is not authenticated", () => {
		const catalog = ompSettingsCatalog({
			models: [{ id: "claude", label: "Claude", provider: "anthropic" }],
			loginProviders: [{ id: "anthropic", name: "Anthropic", authenticated: false }],
		});
		expect(byId(catalog, "model:claude").status).toBe("needs_auth");
		expect(byId(catalog, "provider:anthropic").status).toBe("needs_auth");
		expect(byId(catalog, "provider:anthropic").reason).toContain("not authenticated");
	});

	it("keeps blocked_external entries visible instead of hiding them", () => {
		const catalog = ompSettingsCatalog({
			models: [{ id: "remote-gpu", status: "blocked_external", reason: "Physical device required" }],
			loginProviders: [{ id: "relay", name: "Relay", status: "blocked_external", reason: "Relay not authorized" }],
			cloud: { status: "blocked_external", reason: "Paid cloud host unavailable" },
		});
		expect(byId(catalog, "model:remote-gpu").status).toBe("blocked_external");
		expect(byId(catalog, "provider:relay").status).toBe("blocked_external");
		expect(byId(catalog, "cloud").status).toBe("blocked_external");
		expect(catalog.filter((entry) => entry.status === "blocked_external")).toHaveLength(3);
	});

	it("does not add a silent billed fallback entry", () => {
		const catalog = ompSettingsCatalog({
			models: [{ id: "local-only", label: "Local" }],
		});
		expect(catalog.some((entry) => /billed|fallback/i.test(entry.id) || /billed fallback/i.test(entry.label))).toBe(false);
		expect(byId(catalog, "cloud").status).toBe("unsupported");
	});

	it("surfaces error status when advertised", () => {
		const catalog = ompSettingsCatalog({
			browserBridge: { status: "error", reason: "Bridge handshake failed" },
		});
		expect(byId(catalog, "browser").status).toBe("error");
		expect(byId(catalog, "browser").reason).toBe("Bridge handshake failed");
	});
});

describe("omp-sign-in entry", () => {
	it("reports available when every advertised provider is signed in", () => {
		const catalog = ompSettingsCatalog({
			loginProviders: [
				{ id: "cursor", name: "Cursor", authenticated: true },
				{ id: "openrouter", name: "OpenRouter", authenticated: true },
			],
		});
		const entry = byId(catalog, "omp-sign-in");
		expect(entry.status).toBe("available");
		expect(entry.reason).toContain("2");
	});

	it("reports needs_auth naming the pending providers with the /login path", () => {
		const catalog = ompSettingsCatalog({
			loginProviders: [
				{ id: "cursor", name: "Cursor", authenticated: true },
				{ id: "anthropic", name: "Anthropic", authenticated: false },
			],
		});
		const entry = byId(catalog, "omp-sign-in");
		expect(entry.status).toBe("needs_auth");
		expect(entry.reason).toContain("Anthropic");
		expect(entry.reason).toContain("/login");
	});

	it("stays honest with no providers advertised", () => {
		const entry = byId(ompSettingsCatalog({}), "omp-sign-in");
		expect(entry.status).toBe("needs_auth");
		expect(entry.reason).toContain("/login");
	});
});
