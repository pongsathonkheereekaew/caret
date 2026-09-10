/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Caret contributors. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerAction2 } from '../../../../platform/actions/common/actions.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { OpenAgentsWindowAction, OpenIdeAction } from '../browser/agentWorkbenchActions.js';
import { IAgentWorkbenchModeService } from '../browser/agentWorkbenchMode.js';
import { AgentWorkbenchModeService } from '../browser/agentWorkbenchModeService.js';

registerSingleton(IAgentWorkbenchModeService, AgentWorkbenchModeService, InstantiationType.Delayed);
 registerAction2(OpenAgentsWindowAction);
 registerAction2(OpenIdeAction);
