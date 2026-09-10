# Synara layout evidence — adopted shell metrics (2026-09-10)

Source: `apps/web/src` (routes + `ui/sidebar.tsx`), measured from shipped
code, not screenshots. Used as the structural reference until the Cursor
3.19 atlas lands (user-approved).

## Adopted values (with sources)

| Token | Value | Source |
|---|---|---|
| sidebar default width | 256px (`16rem`) | `ui/sidebar.tsx:26 SIDEBAR_WIDTH` |
| sidebar min width | 256px default / 208px thread (`13*16`) | `sidebar.tsx:29`, `_chat.tsx:60` |
| main content min width | 640px (`40*16`) | `_chat.tsx:61` |
| resize rule | accept only if content keeps 640px | `THREAD_SIDEBAR_RESIZABLE` |
| width persistence | storage key per sidebar | `chat_thread_sidebar_width` |
| collapse | toggle + editor-view auto-close | `_chat.tsx:566-567` |

`--agent-sidebar-width` set to 256px accordingly (was provisional 208).

## Route IA adopted as Agents-shell map

`_chat.index` (home) · `_chat.$threadId` (session) · automations ·
kanban · plugins · pull-requests · settings · studio → maps to
blueprint §2 AgentsWorkbench children (home/session/secondary).

## Bounds

Tailwind-scale spacing/radii not lifted (our 4px base + radius scale
already converge); Lexical composer + TanStack virtual lists noted for
the React-panel fallback only. No pixels claimed — these are layout
contracts, not visual parity.
