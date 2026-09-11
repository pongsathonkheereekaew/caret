/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Caret contributors. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action2, MenuId } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { localize2 } from '../../../../nls.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { IAgentWorkbenchModeService } from './agentWorkbenchMode.js';
import { OPEN_AGENTS_WINDOW_COMMAND_ID, OPEN_IDE_COMMAND_ID } from '../common/agentCommands.js';

const CARET_AGENTS_VIEW_ID = 'caretComposer';

// Opens the existing Caret Agents sidepane (extension webview). Native
// Agents-window geometry still waits on the reference atlas — this command
// must not invent a fake layout.
export class OpenAgentsWindowAction extends Action2 {
	constructor() {
		super({
			id: OPEN_AGENTS_WINDOW_COMMAND_ID,
			title: localize2('caret.openAgentsWindow', 'Caret: Open Agents Window'),
			menu: { id: MenuId.CommandPalette },
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(IAgentWorkbenchModeService).openAgentsWindow();
		const view = await accessor.get(IViewsService).openView(CARET_AGENTS_VIEW_ID, true);
		if (!view) {
			accessor.get(INotificationService).info('Caret Agents view is not registered yet — click the Caret activity-bar icon.');
		}
	}
}

export class OpenIdeAction extends Action2 {
	constructor() {
		super({
			id: OPEN_IDE_COMMAND_ID,
			title: localize2('caret.openIde', 'Caret: Open IDE'),
			menu: { id: MenuId.CommandPalette },
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(IAgentWorkbenchModeService).openIde();
		accessor.get(INotificationService).info('You are already in the Caret IDE.');
	}
}
