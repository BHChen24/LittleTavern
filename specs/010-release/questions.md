# Implementation Notes and Questions: Release v0.1

## Implementation details

- T001: esbuild 0.28.2 runs without its install script (`node node_modules/esbuild/bin/esbuild
  --version`). pnpm 11 nevertheless fails installs for an unreviewed blocked build. Explicit
  `allowBuilds.esbuild: false` records the denial and lets installs complete; no script is enabled.
- The latest clarification and FR-011 define one history scan per workflow run. US3's older
  narrative still says per version; implementation follows the explicit clarification and FR-011.

## Open behavior questions

None through Phase 4.

- T007/T008: the browser bounds lexical navigation to the import root; the app validates the
  real selected file, including selections through directory links, as specified by T-b/T-c.
  Parent navigation cannot leave the configured root.

- T011: npm interpreted `release/littletavern-0.1.0.tgz` as a GitHub shorthand instead
  of a local tarball. The smoke test and workflows use `./release/littletavern-*.tgz`;
  this is a path spelling correction, with no distribution behavior change.
