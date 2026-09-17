/*
 * Caret's language model provider.
 *
 * The workbench refuses a request it cannot attach a language model to: the
 * extension host builds the `vscode.ChatRequest` it hands a participant or a
 * session request handler and throws `Language model unavailable` when the
 * extension that owns the request has no models of its own
 * (`extHostChatAgents2.getModelForRequest` -> `getDefaultLanguageModel`). That
 * was Copilot Chat's job upstream, so this fork has to own it: Caret declares
 * the models OMP advertises as its own vendor.
 *
 * The catalogue is a read-only projection of the host's `get_available_models`
 * (the same source the composer picker reads). Generation is not proxied here —
 * OMP runs the turn inside the session it belongs to (`chat-sessions.ts`), and a
 * request that reaches this provider fails honestly instead of becoming a second
 * model path with its own transcript.
 */

import * as vscode from "vscode";
import { CARET_OMP_MODEL_VENDOR, rolesByModelSelector, type OmpAdvertisedModel, type OmpModelRoles } from "./chat-sessions-map.ts";

/** What the provider needs to list models: the host catalogue and roles, read live. */
export interface CaretLanguageModelOptions {
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
 * Register the OMP catalogue as `caret-omp` models. Returns a disposable that
 * unregisters the vendor; hosts without the proposed API get a no-op so the
 * rest of the extension still activates.
 */
export function registerCaretLanguageModels(options: CaretLanguageModelOptions): vscode.Disposable {
	const lm = vscode.lm as Partial<typeof vscode.lm> | undefined;
	if (!lm?.registerLanguageModelChatProvider) {
		options.log("This host does not expose the language model provider API; Caret session sends stay unavailable.");
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
				options.log(`Caret could not list OMP models for the language model provider: ${error instanceof Error ? error.message : String(error)}`);
			}
			options.log(`Caret language models: ${models.length} advertised by OMP.`);
			const rolesBySelector = rolesByModelSelector(roles);
			return models.map(model => {
			// The roles this model holds, e.g. "Fast · Advisor". Rendered beside the
			// name so "which model does which job" is visible where models are picked.
			const roleLabel = model.provider ? rolesBySelector.get(`${model.provider}/${model.id}`)?.join(" · ") : undefined;
			return {
				id: model.id,
				name: model.label,
				detail: roleLabel,
				// OMP ids are the family: two providers can advertise the same short
				// name, and the picker groups by family.
				family: model.id,
				version: "1.0",
				// OMP's own advertised window. 0 is the neutral unknown the rest of
				// Caret uses, so a model that reports no sizes shows none instead of a
				// made-up limit; when it does report them the picker's "Max context"
				// row and the composer's context meter become real numbers.
				maxInputTokens: model.contextWindow ?? 0,
				maxOutputTokens: model.maxOutputTokens ?? 0,
				tooltip: [model.reason, roleLabel ? `Roles: ${roleLabel}` : undefined]
					.filter(Boolean)
					.join(" · ") || undefined,
				isUserSelectable: true,
				capabilities: { imageInput: false, toolCalling: true },
			};
			});
		},
		async provideLanguageModelChatResponse(): Promise<void> {
			throw new Error("Caret does not proxy model generation: OMP runs the turn inside its own Caret session.");
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

	try {
		const registration = lm.registerLanguageModelChatProvider(CARET_OMP_MODEL_VENDOR, provider as vscode.LanguageModelChatProvider);
		onDidChangeLanguageModelChatInformation.fire();
		return {
			dispose() {
				registration.dispose();
				onDidChangeLanguageModelChatInformation.dispose();
			},
		};
	} catch (error) {
		options.log(`Caret could not register its language models: ${error instanceof Error ? error.message : String(error)}`);
		onDidChangeLanguageModelChatInformation.dispose();
		return { dispose() { /* nothing was registered */ } };
	}
}
