# AGENTS.md

This repository is a client-side PDF toolkit built with Vite, React, TypeScript, `pdf-lib`, `pdfjs-dist`, and Web Workers.

## Project expectations

- Keep processing client-side. Do not add server-side PDF processing unless explicitly requested.
- Prefer fixing misleading behavior over preserving broken demos. If a tool cannot work with the current library stack, mark it unavailable instead of faking success.
- Preserve existing UI patterns unless there is a clear reliability or usability problem.
- Use existing worker-backed paths before adding new bespoke processing logic.
- Validate with `npm run build` after meaningful code changes.

## Tool status guidance

- Implemented tools should produce real output files, not placeholder blobs.
- Password-based encrypt/decrypt features are currently limited by the installed client-side PDF stack. Do not claim they work unless the underlying implementation truly exists.
- Planned tools should stay visibly marked as planned instead of appearing available.

## Editing guidance

- Prefer small, targeted fixes over broad rewrites.
- Keep files ASCII unless the file already requires otherwise.
- Avoid introducing new dependencies unless they materially improve correctness.

## Agent notes

- Codex reads this file directly.
- Other agent-specific instruction files in the repo should defer to this file as the canonical source of truth.
