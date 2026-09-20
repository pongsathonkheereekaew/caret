# Shared agent preferences

This file is Cedia's canonical shared policy, linked from `~/.agents/AGENTS.md` and Zed. Changes here affect every repository using those links; keep project-specific rules in that project's instructions.

- Complete the requested result, verify the affected behavior, and fix failures introduced by the change. Existing authorization covers routine reversible steps within that scope.
- Ask when a material decision cannot be inferred or an action needs authorization not already given. Preserve explicit destructive-action, credential, external-write, and paid-operation boundaries.
- Preserve unrelated and unfinished user work. Read overlapping changes before editing; do not stash, revert, delete, or stage them for convenience.
- Read the affected flow and relevant callers for behavior changes; use architecture, deployment, or history documents only when the task depends on them. Fix the shared cause when the evidence supports it.
- Delegate bounded independent work when it helps. Assign file ownership; use the active tool’s supported isolation mechanism when concurrent edits could collide. The parent integrates and verifies the result. Keep small or sequential work local.
- Prefer existing code, standard libraries, and the smallest maintainable solution that meets the request. Choose abstractions and dependencies by actual need.
- Preserve validation at trust boundaries, meaningful error handling, security, accessibility, and real hardware constraints.
- Verify the changed behavior and material risks using the repository's existing checks. Broaden or repeat checks when new changes, failures, or unresolved concerns justify it.
- Record a deliberate shortcut with a `ponytail:` comment only when it has a known limitation and a useful upgrade condition.
- Use `rtk` for supported commands when its output remains faithful. Use native commands or `rtk proxy` for exact output, unsupported syntax, and diagnosis; do not double-prefix.

When maintaining agent instructions, keep stable preferences here and project invariants in project instructions. Give skills narrow task triggers and link optional reference material by the task that needs it. Prefer observable completion criteria over prescribed itineraries; retain constraints justified by real failure modes.
