# Caret workspace instructions

This folder is the git checkout. Run repository commands here. The document map is [docs/README.md](docs/README.md).

- For current product scope, use the [September 13 handoff](docs/maintenance/CARET-HANDOFF-2026-09-13.th.md): Aetheria workflow on OMP, execution on the Mac, continuity from iPhone.
- For task workspace and review-loop rules, use the [workspace workflow](docs/maintenance/CARET-WORKSPACE-WORKFLOW-2026-09-13.th.md): Mac workspaces like Conductor, phone continuity and proof like Amp, OMP as the only harness.
- For implementation planning, use the [implementation direction](docs/maintenance/CARET-IMPLEMENTATION-DIRECTION-2026-09-12.th.md). Dated assessments live in [docs/archive/](docs/archive/README.md). Distinguish proposals from implemented behavior.
- For screen and interaction work, use the [UI interaction spec](docs/maintenance/CARET-UI-INTERACTION-SPEC-2026-09-13.th.md) with [detailed design](docs/maintenance/CARET-UI-DETAILED-DESIGN-2026-09-13.th.md).
- Layout is one repo: `apps/{host,macos,ios}` and `packages/{protocol,omp-adapter,relay}`. Those folders are module boundaries, not remotes. Leave `desktop/`, `upstream/`, `dist/`, and packaged apps where they are.
- For retained parity identifiers, use [docs/archive/2026-09-09/agent.md](docs/archive/2026-09-09/agent.md) and `backlog/`. That baseline does not expand a bounded task into the entire backlog, and it does not declare old acceptance gates passed.
- Use OMP as the sole agent execution and transcript owner. Caret owns the application host/transport; Code-OSS supplies the Mac IDE and Codex is the primary UI/UX reference.
- Preserve one execution/session owner and provider authentication boundaries. Relay deployment, signing, devices, and paid services require the applicable existing authorization or missing user input at that step.
- Complete the requested slice with evidence from its actual revision and runtime. Report implemented, verified, and externally blocked work separately; resolve routine local failures within scope.
- For complex work use `astra-orchestrator`: root owns architecture/integration, Luna agents own bounded exploration/implementation/tests, Astra reviews. Keep file ownership separate between workers. Verify the changed behavior and run `node scripts/ci-validate.mjs` before reporting completion.
- G0 tests use isolated fixtures without provider calls.
