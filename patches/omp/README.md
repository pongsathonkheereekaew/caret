# Caret OMP runtime patch

Baseline: OMP 18.1.18, revision in `manifest.json`, original MIT notice retained in `docs/upstream-notices/omp-LICENSE.txt`.

The consolidated patch keeps the OMP harness and native tools in OMP. It adds opt-in virtual TUI transport and a structured native permission ClientBridge. Stock behavior remains selected when the corresponding environment flags are absent.

Run `bun scripts/prepare-omp-runtime.ts` to verify/apply the patch and prepare `dist/omp/omp`. This is a development launcher using the pinned source checkout, Bun, and the installed version-specific native addon; it is not a signed standalone release binary. The command fails if the pin or patch hash differs or local source cannot accept/recognize the patch. It does not replace the globally installed OMP binary.

`CARET_OMP_PATH=<absolute dist/omp/omp>` selects this runtime for a new Caret host process. `CARET_RPC_VIRTUAL_UI=1` enables virtual TUI negotiation; `CARET_RPC_NATIVE_BRIDGE=1` enables the permission bridge. Existing host processes keep their current runtime until stopped and restarted deliberately.

The permission bridge preserves OMP's explicit auto-approve settings and typed permission outcomes. It currently supplies the permission capability only. Native dirty-buffer read/write/edit parity, TUI-only command integration, and full core conformance remain separate acceptance work; this patch alone does not certify them.
