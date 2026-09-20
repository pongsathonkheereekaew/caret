/*
 * Cedia's language model provider.
 *
 * The workbench refuses a request it cannot attach a language model to: the
 * extension host builds the `vscode.ChatRequest` it hands a participant or a
 * session request handler and throws `Language model unavailable` when the
 * extension that owns the request has no models of its own
 * (`extHostChatAgents2.getModelForRequest` -> `getDefaultLanguageModel`). That
 * was Copilot Chat's job upstream, so this fork has to own it: Cedia declares
 * the models OMP advertises as its own vendor.
 *
 * The catalogue is a read-only projection of the host's `get_available_models`
 * (the same source the composer picker reads). Generation is not proxied here —
 * OMP runs the turn inside the session it belongs to (`chat-sessions.ts`), and a
 * request that reaches this provider fails honestly instead of becoming a second
 * model path with its own transcript.
 */

import * as vscode from "vscode";
import { CEDIA_OMP_MODEL_VENDOR, ompModelRows, providerStatusIconId, rolesByModelSelector, type OmpAdvertisedModel, type OmpModelRoles } from "./chat-sessions-map.ts";

/** What the provider needs to list models: the host catalogue and roles, read live. */
export interface CediaLanguageModelOptions {
	readonly catalog: (token: { readonly isCancellationRequested: boolean }) => Promise<readonly OmpAdvertisedModel[]>;
	/**
	 * The configured model roles. These render as each row's `detail`, which the
	 * workbench draws beside the model name — this is the only field of a model
	 * row the picker shows next to the name, so a role has to travel here and not
	 * in the option-group item's `description`, which is tooltip-only.
	 */
	readonly roles?: () => Promise<OmpModelRoles>;
	readonly log: (message: string) => void;
}

/**
 * Register the OMP catalogue as `cedia-omp` models. Returns a disposable that
 * unregisters the vendor; hosts without the proposed API get a no-op so the
 * rest of the extension still activates.
 */
/** The mark the workbench picker draws for one of our models (see `providerStatusIconId`). */
function providerStatusIcon(provider: string | undefined): vscode.ThemeIcon | undefined {
	const id = providerStatusIconId(provider);
	return id ? new vscode.ThemeIcon(id) : undefined;
}

export function registerCediaLanguageModels(options: CediaLanguageModelOptions): vscode.Disposable {
	const lm = vscode.lm as Partial<typeof vscode.lm> | undefined;
	if (!lm?.registerLanguageModelChatProvider) {
		options.log("This host does not expose the language model provider API; Cedia session sends stay unavailable.");
		return { dispose() { /* nothing was registered */ } };
	}

	// The workbench only reads a vendor's models when the provider announces
	// itself, and `registerLanguageModelProvider` does not resolve on its own, so
	// the first announcement is what puts the OMP catalogue in the model picker.
	const onDidChangeLanguageModelChatInformation = new vscode.EventEmitter<void>();
	const provider = {
		onDidChangeLanguageModelChatInformation: onDidChangeLanguageModelChatInformation.event,
		async provideLanguageModelChatInformation(
			_options: unknown,
			token: vscode.CancellationToken,
		): Promise<vscode.LanguageModelChatInformation[]> {
			let models: readonly OmpAdvertisedModel[] = [];
			let roles: OmpModelRoles = { cycleOrder: [], roles: [] };
			try {
				models = await options.catalog(token);
				if (options.roles) roles = await options.roles();
			} catch (error) {
				// Honest-empty: the workbench keeps its disabled state instead of
				// listing models OMP never advertised.
				options.log(`Cedia could not list OMP models for the language model provider: ${error instanceof Error ? error.message : String(error)}`);
			}
			options.log(`Cedia language models: ${models.length} advertised by OMP.`);
			const rolesBySelector = rolesByModelSelector(roles);
			// One identity per row: a model id more than one provider advertises is claimed by the
			// first row and named by its selector afterwards, so neither provider's row is dropped.
			const rows = ompModelRows(models);
			options.log(`Cedia language models: ${rows.length} rows after collapsing OMP's duplicate ids.`);
			// Which providers the catalogue actually uses, so the picker's grouping and its marks can be
			// checked against reality instead of guessed (and a provider without a mark is visible here).
			const providerCounts = new Map<string, number>();
			for (const row of rows) {
				const provider = row.model.provider ?? "(none)";
				providerCounts.set(provider, (providerCounts.get(provider) ?? 0) + 1);
			}
			const providerList = [...providerCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
			options.log(`Cedia language models: ${providerList.length} provider(s): ${providerList.map(([provider, count]) => `${provider}(${count})`).join(", ")}`);
			return rows.map(row => {
			const model = row.model;
			// The roles this model holds, e.g. "Fast · Advisor". Rendered beside the
			// name so "which model does which job" is visible where models are picked.
			const roleLabel = model.provider ? rolesBySelector.get(`${model.provider}/${model.id}`)?.join(" · ") : undefined;
			return {
				id: row.id,
				name: row.label,
				// The provider travels in `detail`, which is the one free-form line the workbench draws
				// beside a model's name and hands to every picker; the roles follow it when OMP has any.
				// Cedia's own Agents-window picker groups and badges rows by this, because the API has no
				// other field that can carry "which provider runs this" (see
				// `desktop/.../modelPicker/cediaModelPicker.ts`).
				detail: [roleLabel, model.provider].filter(Boolean).join(" · ") || undefined,
				// OMP ids are the family: two providers can advertise the same short
				// name, and the picker groups by family.
				family: row.id,
				version: "1.0",
				// OMP's own advertised window. 0 is the neutral unknown the rest of
				// Cedia uses, so a model that reports no sizes shows none instead of a
				// made-up limit; when it does report them the picker's "Max context"
				// row and the composer's context meter become real numbers.
				maxInputTokens: model.contextWindow ?? 0,
				maxOutputTokens: model.maxOutputTokens ?? 0,
				tooltip: [model.reason, roleLabel ? `Roles: ${roleLabel}` : undefined]
					.filter(Boolean)
					.join(" · ") || undefined,
				isUserSelectable: true,
				// The provider's mark, drawn by the picker's rows and by the composer trigger.
				statusIcon: providerStatusIcon(model.provider),
				capabilities: { imageInput: false, toolCalling: true },
			};
			});
		},
		async provideLanguageModelChatResponse(): Promise<void> {
			throw new Error("Cedia does not proxy model generation: OMP runs the turn inside its own Cedia session.");
		},
		/**
		 * The workbench asks this only for its own display/accounting; OMP counts
		 * every token of the real turn and reports the usage itself. A rough
		 * character-based estimate is returned instead of a number that would look
		 * more precise than it is.
		 */
		async provideTokenCount(_model: unknown, text: unknown): Promise<number> {
			const value = typeof text === "string" ? text : "";
			return Math.ceil(value.length / 4);
		},
	};

	/**
	 * Register the vendor, retrying while the workbench has not declared it yet.
	 *
	 * The vendor descriptor is declared by Cedia's workbench bridge when the window restores, and the
	 * extension is activated as soon as the window asks for the `cedia.omp` session type, so the two
	 * can cross: measured 2026-09-18, a run lost the race, `registerLanguageModelProvider` threw
	 * `Chat model provider uses UNKNOWN vendor cedia-omp`, this catch gave up for the life of the
	 * window, and the Agents window then had no model to attach - the composer drew nothing at all.
	 * The declaration lands within a tick or two, so waiting a moment is the honest fix; only a
	 * registration that still fails after the wait is reported as a failure.
	 */
	const RETRY_DELAYS_MS = [0, 120, 250, 500, 900, 1500];
	let disposed = false;
	let registration: vscode.Disposable | undefined;
	let attempt = 0;

	const attemptRegistration = () => {
		if (disposed || registration) return;
		try {
			registration = lm.registerLanguageModelChatProvider!(CEDIA_OMP_MODEL_VENDOR, provider as vscode.LanguageModelChatProvider);
			onDidChangeLanguageModelChatInformation.fire();
			if (attempt > 0) {
				options.log(`Cedia language models: the vendor was not declared yet; registered on attempt ${attempt + 1}.`);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			attempt += 1;
			if (message.includes("UNKNOWN vendor") && attempt < RETRY_DELAYS_MS.length) {
				setTimeout(attemptRegistration, RETRY_DELAYS_MS[attempt]);
				return;
			}
			options.log(`Cedia could not register its language models: ${message}`);
			onDidChangeLanguageModelChatInformation.dispose();
		}
	};

	attemptRegistration();
	return {
		dispose() {
			disposed = true;
			registration?.dispose();
			onDidChangeLanguageModelChatInformation.dispose();
		},
	};
}
