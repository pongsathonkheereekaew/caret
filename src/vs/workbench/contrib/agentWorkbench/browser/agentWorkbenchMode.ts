/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Caret contributors. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchShell } from '../common/agentTypes.js';
import { IShellState } from './agentShellState.js';

export const IAgentWorkbenchModeService = createDecorator<IAgentWorkbenchModeService>('agentWorkbenchModeService');

/** Switches the IDE shell and the Agents shell over one session record.
 *  Shell switching is presentation-only: drafts, queue, scroll, review,
 *  and panel state must survive (shell-switch contract, roadmap Phase B).
 *  Callers pass observed values via `state`; the service merges, persists,
 *  and re-exposes them — it never invents layout (no reference atlas yet).
 */
export interface IAgentWorkbenchModeService {
	readonly _serviceBrand: undefined;
	readonly shell: WorkbenchShell;
	readonly onDidChangeShell: Event<WorkbenchShell>;
	/** Last preserved snapshot (EMPTY when nothing captured yet). */
	getLastShellState(): IShellState;
	openAgentsWindow(options?: { sessionId?: string; preserveIdeState?: boolean; state?: Partial<IShellState> }): Promise<void>;
	openIde(options?: { sessionId?: string; file?: string; state?: Partial<IShellState> }): Promise<void>;
}
