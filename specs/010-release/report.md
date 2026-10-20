# Implementation Report: Release v0.1

Status: implementation in progress; packaging phase validated.

## Validation evidence

- Phase 5: build, lint and 342 tests passed across 61 test files.
- `pnpm release:check`: passed after rerunning outside the subprocess sandbox.

```text
Package contents verified:
package/examples/LICENSE
package/LICENSE
package/dist/cli.js
package/examples/characters/alice.json
package/package.json
package/examples/lorebooks/wonderland.json
package/examples/README.md
package/README.md
gitleaks: scanned 166484 bytes; no leaks found
Release package v0.1.0 passed contents and secret checks.
```

- Bad tag check: `node scripts/check-release.mjs --tag v9.9.9` exited 1 and printed
  `Tag v9.9.9 does not match app version v0.1.0`.
- Install smoke: passed using a fresh temporary npm prefix, cache and `LITTLETAVERN_HOME`.
  The command reported `LittleTavern 0.1.0`, imported Alice, and listed one character.
  npm installed 135 runtime dependency packages. No publication occurred.
- The supplied smoke command needed `./release/...tgz` rather than `release/...tgz` to make
  npm treat the argument as a local file. The original unprefixed command failed as GitHub shorthand.

## Deferred tests

- Real GitHub workflow execution and the owner's interactive checks remain pending.

## Remaining work

Phases 6–8 (CI/release workflows, release README and final validation/convergence).
