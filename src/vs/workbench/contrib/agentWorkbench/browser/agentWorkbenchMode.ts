/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Caret contributors. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { WorkbenchShell } from '../common/agentTypes.js';

/** Switches the IDE shell and the Agents shell over one session record.
 *  Shell switching is presentation-only: drafts, queue, scroll, review,
 *  and panel state must survive (shell-switch contract, roadmap Phase B).
 */
export interface IAgentWorkbenchModeService {
	readonly _serviceBrand: undefined;
	readonly shell: WorkbenchShell;
	readonly onDidChangeShell: Event<WorkbenchShell>;
	openAgentsWindow(options?: { sessionId?: string; preserveIdeState?: boolean }): Promise<void>;
	openIde(options?: { sessionId?: string; file?: string }): Promise<void>;
}
