# React for the Agents surface — evidence behind the §7 decision (2026-09-15)

The request: make Caret's agent UI React, the way the reference's is, and consider
Untitled UI React for the components. This note records what was measured, so §7 of
the plan is checkable rather than asserted.

## The reference really is React

From the installed app (Cursor 3.20.21, commit `f09fca384c`):

- `out/vs/workbench/react-runtime/` ships `react`, `react-dom` and the jsx
  runtimes (248 KB) next to `workbench.glass.main.js`.
- The Apps panel is a React component tree: `jsx`/`jsxs` calls, `Zu.Trigger`,
  an icon button with `aria-label:"Open new tab menu"`, and a fixed pane list
  `[{id:"changes",label:"Changes",icon:"git-pull-request",onClick:…}]` followed by
  `browser` / `terminal` / `file`.
- The agent surface is its own Electron window (`glass:!0`) running its own
  workbench bundle — see `../cursor-agent-window-architecture-2026-09-15/`.

## Our checkout has React, but not on a production path

| fact | value |
|---|---|
| `desktop/node_modules/react` | 18.3.1 |
| `desktop/node_modules/react-dom` | 18.3.1 |
| files importing react under `src/vs/sessions/**` | 0 |
| files importing react across `src/vs` | 2 — both `workbench/test/browser/componentFixtures/*` |
| react/tailwind/aria declared in base `package.json` | none |

So React is resolvable and bundleable today, but it is a transitive
(test-only) dependency. Making it a production dependency is a deliberate act:
it changes what the fork ships and what `ThirdPartyNotices` has to carry.

## Untitled UI React

Read from <https://www.untitledui.com/react/components> (2026-09-15): the page
describes itself as "free and open-source React components" and, in its own
structured data, "Built with React Aria v1.20 and styled with Tailwind CSS 4.3".
It also advertises a separate PRO tier. Two consequences follow, and §7.2 acts on
both:

1. Adopting it as-is imports a second design scale (Tailwind's spacing, radius and
   type steps) into a surface whose whole contract is that it matches the
   reference's measured scale — the thing `check:cursor-parity` guards (340 keys,
   0 mismatches today). Every component would have to be restyled onto
   `CARET_TOKENS` anyway, so what we would actually gain is React Aria's structure
   and accessibility, not the look.
2. Tailwind 4 in a workbench renderer means a global preflight competing with the
   workbench's own CSS. That has to be scoped before any component lands.

The reference does not use Untitled UI, so importing it wholesale would create
exactly the kind of divergence the parity gate exists to catch.

## What this does not decide

- Which component library, if any, ends up on the Caret-authored (non-parity)
  surfaces. §7.3 keeps that as R4, judged against the gate rather than up front.
- Whether React lands via the workbench bundle or a separate renderer. R1 uses the
  workbench bundle because that is where the pane already lives; if bundle cost or
  theming says otherwise, that is a §7 revision, not a silent change.
