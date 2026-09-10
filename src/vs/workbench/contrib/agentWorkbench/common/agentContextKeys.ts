/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Caret contributors. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';

// Shell/turn/approval context keys. Declared here, bound where a real source
// exists — never faked. The shell key is bound by AgentWorkbenchModeService;
// turn and approval have no native source yet (the extension composer owns
// both over its webview today), so those two stay declared-but-unset until
// their service lands.

/** Active workbench shell (ide | agents). Bound by AgentWorkbenchModeService. */
export const WorkbenchShellContext = new RawContextKey<string>('caretWorkbenchShell', 'ide');

/** True while any agent turn runs. Future source: turn service — no native turn state yet. */
export const AgentTurnRunningContext = new RawContextKey<boolean>('caretAgentTurnRunning', false);

/** True when the approval queue is non-empty. Future source: approval service — no native approval state yet. */
export const AgentApprovalPendingContext = new RawContextKey<boolean>('caretAgentApprovalPending', false);
