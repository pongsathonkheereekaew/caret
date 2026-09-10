/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Caret contributors. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action2, MenuId } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { localize2 } from '../../../../nls.js';
import { OPEN_AGENTS_WINDOW_COMMAND_ID, OPEN_IDE_COMMAND_ID } from '../common/agentCommands.js';

// Scaffold actions: the Agents shell layout lands with the reference
// atlas (roadmap Phase B). Until then these commands exist, are
// discoverable, and say exactly that — no fake window.
export class OpenAgentsWindowAction extends Action2 {
	constructor() {
		super({
			id: OPEN_AGENTS_WINDOW_COMMAND_ID,
			title: localize2('caret.openAgentsWindow', 'Caret: Open Agents Window'),
			menu: { id: MenuId.CommandPalette },
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		accessor.get(INotificationService).info('Agents Window shell arrives with the reference atlas (roadmap Phase B).');
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
		accessor.get(INotificationService).info('You are already in the Caret IDE.');
	}
}
