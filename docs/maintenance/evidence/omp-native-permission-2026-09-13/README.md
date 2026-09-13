# Native permission probe

Run `bun run smoke:omp:permissions` after preparing the pinned patched OMP runtime. This starts a real OMP subprocess through CaretHost and a private loopback SSE model fixture, with an isolated settings/workspace directory and no provider credentials.

The probe verifies that native bash waits for the structured permission decision, an allow-once permits the fixture file effect, a reject-once prevents it, exact arguments are journaled, and stale answers are not dispatched. Four local model requests are expected. The script records the launcher and patch-manifest hashes; the launcher hash alone is not a standalone runtime binary attestation.

This evidence covers the OMP permission-gated bash path. It does not claim all tools are permission-gated, native edit dirty-buffer parity, mobile visual acceptance, or signed release readiness.
