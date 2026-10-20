# Implementation Notes and Questions: Release v0.1

## Implementation details

- T001: esbuild 0.28.2 runs without its install script (`node node_modules/esbuild/bin/esbuild
  --version`). pnpm 11 nevertheless fails installs for an unreviewed blocked build. Explicit
  `allowBuilds.esbuild: false` records the denial and lets installs complete; no script is enabled.
- The latest clarification and FR-011 define one history scan per workflow run. US3's older
  narrative still says per version; implementation follows the explicit clarification and FR-011.
- T007/T008: the browser bounds lexical navigation to the import root; the app validates the
  real selected file, including selections through directory links, as specified by T-b/T-c.
  Parent navigation cannot leave the configured root.
- T011/T019: npm interpreted `release/littletavern-0.1.0.tgz` as GitHub shorthand instead
  of a local tarball. The smoke test, workflows and corrected quickstart use
  `./release/littletavern-*.tgz`. This is a path spelling correction, with no distribution
  behavior change. T019 was appended by convergence to authorize the quickstart correction.
- T003: attachments and the marker are saved together in one settings patch. A failed settings
  write leaves library imports available and retries the same idempotent operations next start.

- T020: startup copies the provided setup notices, prepends any import-folder failure, and
  renders the collected text once. Combining the existing messages retains both reasons without
  changing the data helper's marker/retry behavior or other startup warnings.

## Open behavior questions

None. All behavior follows the revised feature artifacts and their explicit clarifications.
