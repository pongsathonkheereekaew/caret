/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Caret contributors. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../base/common/event.js';
import { IContextKey, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { WorkbenchShell } from '../common/agentTypes.js';
import { WorkbenchShellContext } from '../common/agentContextKeys.js';
import { CARET_SHELL_STATE_STORAGE_KEY, CARET_SHELL_STORAGE_KEY } from '../common/agentStorage.js';
import { EMPTY_SHELL_STATE, IShellState, mergeShellState, restoreShellState } from './agentShellState.js';
import { IAgentWorkbenchModeService } from './agentWorkbenchMode.js';

// First mode-service implementation: shell flag + preserved snapshot +
// context key. Presentation-only — there is no Agents layout yet (no
// reference atlas), so switching records state, persists it, and fires the
// event; future UI applies getLastShellState() instead of reading live.
// Turn/approval state still lives in the extension composer (no native
// source), so this service never touches those keys.
export class AgentWorkbenchModeService extends Disposable implements IAgentWorkbenchModeService {
	declare readonly _serviceBrand: undefined;

	private _shell: WorkbenchShell;
	private _lastState: IShellState;
	private readonly _onDidChangeShell = this._register(new Emitter<WorkbenchShell>());
	readonly onDidChangeShell = this._onDidChangeShell.event;
	private readonly _shellContextKey: IContextKey<string>;

	constructor(
		@IContextKeyService contextKeyService: IContextKeyService,
		@IStorageService private readonly _storageService: IStorageService,
	) {
		super();
		const persistedShell = this._storageService.get(CARET_SHELL_STORAGE_KEY, StorageScope.WORKSPACE);
		this._shell = persistedShell === WorkbenchShell.Agents ? WorkbenchShell.Agents : WorkbenchShell.Ide;
		this._lastState = restoreShellState(readStoredState(this._storageService));
		this._shellContextKey = WorkbenchShellContext.bindTo(contextKeyService);
		this._shellContextKey.set(this._shell);
	}

	get shell(): WorkbenchShell {
		return this._shell;
	}

	getLastShellState(): IShellState {
		return this._lastState;
	}

	async openAgentsWindow(options?: { sessionId?: string; preserveIdeState?: boolean; state?: Partial<IShellState> }): Promise<void> {
		const base = options?.preserveIdeState === false ? EMPTY_SHELL_STATE : this._lastState;
		this._lastState = mergeShellState(base, {
			...options?.state,
			...(options?.sessionId !== undefined ? { activeSessionId: options.sessionId } : {}),
		});
		this.switchTo(WorkbenchShell.Agents);
	}

	async openIde(options?: { sessionId?: string; file?: string; state?: Partial<IShellState> }): Promise<void> {
		this._lastState = mergeShellState(this._lastState, {
			...options?.state,
			...(options?.sessionId !== undefined ? { activeSessionId: options.sessionId } : {}),
			...(options?.file !== undefined ? { activeFile: options.file } : {}),
		});
		this.switchTo(WorkbenchShell.Ide);
	}

	private switchTo(shell: WorkbenchShell): void {
		this._storageService.store(CARET_SHELL_STATE_STORAGE_KEY, JSON.stringify(this._lastState), StorageScope.WORKSPACE, StorageTarget.MACHINE);
		if (shell === this._shell) {
			return;
		}
		this._shell = shell;
		this._storageService.store(CARET_SHELL_STORAGE_KEY, shell, StorageScope.WORKSPACE, StorageTarget.MACHINE);
		this._shellContextKey.set(shell);
		this._onDidChangeShell.fire(shell);
	}
}

function readStoredState(storageService: IStorageService): unknown {
	const raw = storageService.get(CARET_SHELL_STATE_STORAGE_KEY, StorageScope.WORKSPACE);
	if (!raw) {
		return undefined;
	}
	try {
		return JSON.parse(raw) as unknown;
	} catch {
		return undefined;
	}
}
