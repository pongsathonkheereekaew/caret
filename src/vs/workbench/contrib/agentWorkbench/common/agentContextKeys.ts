/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Caret contributors. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';

/** Active workbench shell (ide | agents). */
export const WorkbenchShellContext = new RawContextKey<string>('caretWorkbenchShell', 'ide');

/** True while any agent turn runs (status bar, menus, keybindings). */
export const AgentTurnRunningContext = new RawContextKey<boolean>('caretAgentTurnRunning', false);

/** True when the approval queue is non-empty. */
export const AgentApprovalPendingContext = new RawContextKey<boolean>('caretAgentApprovalPending', false);
