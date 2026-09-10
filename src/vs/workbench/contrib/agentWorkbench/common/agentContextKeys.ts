/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Caret contributors. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';

// Shell/turn/approval context keys. Declared here, bound where a real source
// exists — never faked. No native service exposes turn or approval state yet
// (the extension composer owns both over its webview today), and the mode
// service (browser/agentWorkbenchMode.ts) has an interface but no
// implementation yet, so all three keys stay declared-but-unset. Bind each
// with `<Key>.bindTo(contextKeyService)` when its source lands.

/** Active workbench shell (ide | agents). Future source: IAgentWorkbenchModeService.shell. */
export const WorkbenchShellContext = new RawContextKey<string>('caretWorkbenchShell', 'ide');

/** True while any agent turn runs. Future source: turn service — no native turn state yet. */
export const AgentTurnRunningContext = new RawContextKey<boolean>('caretAgentTurnRunning', false);

/** True when the approval queue is non-empty. Future source: approval service — no native approval state yet. */
export const AgentApprovalPendingContext = new RawContextKey<boolean>('caretAgentApprovalPending', false);
