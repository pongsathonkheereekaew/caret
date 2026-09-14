import { describe, expect, it } from "bun:test";
import { SETTINGS_APPLY_SCOPE_REASON } from "../src/settings-revision.ts";
import { bindSettingsCatalogRows, type SettingsBoundRow } from "../src/settings-catalog-rows.ts";

const HOSTED_ACTION_REASON = "Action stays on the existing Refresh/Log in/Run controls.";

function byId(rows: readonly SettingsBoundRow[], id: string): SettingsBoundRow {
	const found = rows.find((row) => row.id === id);
	if (!found) throw new Error(`missing settings row ${id}`);
	return found;
}

describe("bindSettingsCatalogRows", () => {
	it("binds one Models/providers row per advertised model", () => {
		const rows = bindSettingsCatalogRows({
			section: "Models/providers",
			models: [
				{ id: "gpt-5", label: "GPT-5", provider: "openai" },
				{ id: "local", available: false },
				{ id: "anon" },
			],
			loginProviders: [{ id: "openai", name: "OpenAI", authenticated: true }],
		});
		expect(rows).toHaveLength(3);
		expect(byId(rows, "model:gpt-5")).toEqual({
			id: "model:gpt-5",
			section: "Models/providers",
			label: "GPT-5",
			value: "available · openai",
			source: "this Mac · OMP registry",
			scope: "global",
			writable: true,
		});
		expect(byId(rows, "model:local")).toMatchObject({
			label: "local",
			value: "unavailable",
			scope: "global",
			writable: true,
		});
		expect(byId(rows, "model:anon").value).toBe("available");
		expect(rows.some((row) => row.id.startsWith("provider:"))).toBe(false);
	});

	it("uses an explicit source when the host already fetched one", () => {
		const rows = bindSettingsCatalogRows({
			section: "Models/providers",
			source: "this Mac · OMP registry · revision 4",
			models: [{ id: "claude", label: "Claude", provider: "anthropic", available: true }],
		});
		expect(byId(rows, "model:claude").source).toBe("this Mac · OMP registry · revision 4");
	});

	it("binds Agents/OMP and Tools/MCP from login providers only", () => {
		const providers = [
			{ id: "openai", name: "OpenAI", authenticated: true },
			{ id: "anthropic", name: "Anthropic", authenticated: false },
			{ id: "relay", available: false },
		] as const;
		const agents = bindSettingsCatalogRows({
			section: "Agents/OMP",
			loginProviders: providers,
			models: [{ id: "gpt-5", provider: "openai" }],
		});
		const tools = bindSettingsCatalogRows({
			section: "Tools/MCP",
			loginProviders: providers,
		});
		expect(agents.map((row) => row.id)).toEqual(["provider:openai", "provider:anthropic", "provider:relay"]);
		expect(byId(agents, "provider:openai")).toMatchObject({
			section: "Agents/OMP",
			label: "OpenAI",
			value: "signed in",
			scope: "global",
			writable: false,
			reason: HOSTED_ACTION_REASON,
		});
		expect(byId(agents, "provider:anthropic").value).toBe("not signed in");
		expect(byId(agents, "provider:relay")).toMatchObject({
			label: "relay",
			value: "unavailable",
			writable: false,
			reason: HOSTED_ACTION_REASON,
		});
		expect(tools).toHaveLength(1);
		expect(byId(tools, "mcp:none")).toMatchObject({
			section: "Tools/MCP",
			label: "MCP servers",
			value: "none advertised",
			writable: false,
			reason: "OMP has not advertised MCP servers. Browse is not install.",
		});
		expect(tools.some((row) => row.id.startsWith("provider:"))).toBe(false);
		expect(agents.some((row) => row.id.startsWith("model:"))).toBe(false);
	});

	it("lists advertised MCP servers without treating login providers as servers", () => {
		const rows = bindSettingsCatalogRows({
			section: "Tools/MCP",
			loginProviders: [{ id: "openai", name: "OpenAI", authenticated: true }],
			mcpServers: [
				{ id: "filesystem", label: "Filesystem", status: "connected" },
				{ id: "browser" },
			],
		});
		expect(rows.map((row) => row.id)).toEqual(["mcp:filesystem", "mcp:browser"]);
		expect(byId(rows, "mcp:filesystem")).toMatchObject({
			section: "Tools/MCP",
			label: "Filesystem",
			value: "connected",
			writable: false,
			reason: "Browse is not install. Lifecycle stays on the host/OMP registry.",
		});
		expect(byId(rows, "mcp:browser")).toMatchObject({
			label: "browser",
			value: "advertised",
			writable: false,
			reason: "Browse is not install. Lifecycle stays on the host/OMP registry.",
		});
		expect(rows.some((row) => row.id.startsWith("provider:"))).toBe(false);
		expect(rows.some((row) => /cloud|marketplace|install/i.test(row.id) || /cloud|marketplace/i.test(row.label))).toBe(false);
	});

	it("binds Skills/rules/hooks/commands from slash commands only", () => {
		const rows = bindSettingsCatalogRows({
			section: "Skills/rules/hooks/commands",
			slashCommands: [
				{ name: "plan", description: "Enter plan mode" },
				{ name: "compact" },
			],
			models: [{ id: "gpt-5" }],
			loginProviders: [{ id: "openai", authenticated: true }],
		});
		expect(rows.map((row) => row.id)).toEqual([
			"slash:plan",
			"slash:compact",
			"skill:none",
			"hook:none",
			"automations",
		]);
		expect(byId(rows, "slash:plan")).toEqual({
			id: "slash:plan",
			section: "Skills/rules/hooks/commands",
			label: "/plan",
			value: "Enter plan mode",
			source: "this Mac · OMP registry",
			scope: "global",
			writable: false,
			reason: HOSTED_ACTION_REASON,
		});
		expect(byId(rows, "slash:compact").value).toBe("OMP slash command");
	});

	it("keeps empty skills, hooks, and automations honest", () => {
		const rows = bindSettingsCatalogRows({
			section: "Skills/rules/hooks/commands",
			slashCommands: [{ name: "plan" }],
		});
		expect(byId(rows, "skill:none")).toMatchObject({
			label: "Skills",
			value: "none advertised",
			writable: false,
		});
		expect(byId(rows, "hook:none")).toMatchObject({
			label: "Hooks",
			value: "none advertised",
			writable: false,
		});
		expect(byId(rows, "automations")).toMatchObject({
			label: "Automations",
			value: "unavailable",
			writable: false,
			reason: "Automations stay unavailable until advertised.",
		});
		expect(rows.some((row) => /cloud/i.test(row.id) || /cloud/i.test(row.label))).toBe(false);
	});

	it("lists advertised skills and hooks without inventing Cloud", () => {
		const rows = bindSettingsCatalogRows({
			section: "Skills/rules/hooks/commands",
			skills: [{ id: "review", label: "Review" }],
			hooks: [{ id: "pre-commit" }],
		});
		expect(byId(rows, "skill:review")).toMatchObject({
			label: "Review",
			value: "advertised",
		});
		expect(byId(rows, "hook:pre-commit")).toMatchObject({
			label: "pre-commit",
			value: "advertised",
		});
		expect(rows.some((row) => row.id === "skill:none" || row.id === "hook:none")).toBe(false);
		expect(byId(rows, "automations").value).toBe("unavailable");
		expect(rows.some((row) => /cloud/i.test(row.id) || /cloud/i.test(row.label))).toBe(false);
		expect(bindSettingsCatalogRows({ section: "Cloud" })).toEqual([]);
	});

	it("returns no rows for Appearance, unknown sections, or empty fetched lists", () => {
		expect(bindSettingsCatalogRows({
			section: "Appearance",
			models: [{ id: "gpt-5", provider: "openai" }],
			loginProviders: [{ id: "openai", authenticated: true }],
			slashCommands: [{ name: "plan" }],
		})).toEqual([]);
		expect(bindSettingsCatalogRows({ section: "Cloud" })).toEqual([]);
		expect(bindSettingsCatalogRows({ section: "not-a-section", models: [{ id: "gpt-5" }] })).toEqual([]);
		expect(bindSettingsCatalogRows({ section: "Models/providers" })).toEqual([]);
		expect(bindSettingsCatalogRows({ section: "Agents/OMP", loginProviders: [] })).toEqual([]);
		expect(bindSettingsCatalogRows({ section: "Workspace/editor" })).toEqual([]);
	});

	it("does not invent billed fallback, Cloud, voice, automations, or MCP marketplace rows", () => {
		const rows = bindSettingsCatalogRows({
			section: "Models/providers",
			models: [
				{ id: "local-only", label: "Local" },
				{ id: "billed-fallback", label: "Billed fallback" },
			],
		});
		expect(rows.map((row) => row.id)).toEqual(["model:local-only"]);
		expect(rows.some((row) => /billed|fallback/i.test(row.id) || /billed fallback/i.test(row.label))).toBe(false);
		expect(rows.some((row) => /cloud|voice|automation|marketplace/i.test(row.id) || /cloud|voice|automation|marketplace/i.test(row.label))).toBe(false);

		const tools = bindSettingsCatalogRows({
			section: "Tools/MCP",
			loginProviders: [{ id: "openai", name: "OpenAI", authenticated: false }],
		});
		expect(tools.map((row) => row.id)).toEqual(["mcp:none"]);
		expect(tools.some((row) => /marketplace|cloud|voice|automation/i.test(row.id))).toBe(false);
		expect(tools.some((row) => /cloud/i.test(row.label) || /cloud/i.test(row.value))).toBe(false);
	});

	it("keeps every bound row global and never advertises project or session writes", () => {
		const rows = [
			...bindSettingsCatalogRows({
				section: "Models/providers",
				models: [{ id: "gpt-5", provider: "openai" }],
			}),
			...bindSettingsCatalogRows({
				section: "Agents/OMP",
				loginProviders: [{ id: "openai", name: "OpenAI", authenticated: true }],
			}),
			...bindSettingsCatalogRows({
				section: "Skills/rules/hooks/commands",
				slashCommands: [{ name: "plan" }],
			}),
		];
		expect(rows.length).toBeGreaterThan(0);
		for (const row of rows) {
			expect(row.scope).toBe("global");
			expect(row.writable && (row.scope === "project" || row.scope === "session")).toBe(false);
		}
		expect(SETTINGS_APPLY_SCOPE_REASON).toBe("Project and session writes are not advertised.");
	});
});
