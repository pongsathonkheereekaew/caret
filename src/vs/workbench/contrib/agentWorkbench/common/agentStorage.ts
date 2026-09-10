/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Caret contributors. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Storage keys (workbench StorageService scope). Secrets never land here —
// pairing tokens stay in globalState until the keychain migration.
export const CARET_ENDPOINTS_STORAGE_KEY = 'caret.endpoints';
export const CARET_ACTIVE_ENDPOINT_STORAGE_KEY = 'caret.activeEndpoint';
export const CARET_COMPOSER_DRAFT_PREFIX = 'caret.composerDraft.';
export const CARET_SIDEBAR_WIDTH_KEY = 'caret.sidebarWidth';

// Active workbench shell + last preserved shell-switch snapshot (roadmap
// Phase B). WORKSPACE scope (files/tabs are workspace-bound), MACHINE
// target (local-first: never roam via Settings Sync).
export const CARET_SHELL_STORAGE_KEY = 'caret.shell';
export const CARET_SHELL_STATE_STORAGE_KEY = 'caret.shellState';
