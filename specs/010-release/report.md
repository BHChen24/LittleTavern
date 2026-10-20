# Implementation Report: Release v0.1

## Summary

LittleTavern can now be built as one standalone npm package. esbuild combines the three internal
workspace packages into `dist/cli.js`; runtime libraries remain ordinary dependencies, and pi
versions remain exactly `1.3.0`. The generated package has the app version, npm command, Node
minimum and project metadata specified in the release contract.

The first interactive start creates the import folders, copies the original CC0 Alice and
Wonderland examples without overwriting user files, imports the shipped originals, and attaches
Wonderland to Alice. Settings record completion. Missing packaged examples leave the marker
unset; a settings-write failure produces a notice and permits an idempotent retry. Other setup
failures record the marker, and folder-creation failures use the app's existing single notice.
CLI subcommands do not seed examples.

The app's `/import` browser cannot navigate above its configured root. Arguments are refused
with the specified guidance, file completion is removed, and selections are checked against the
real import root, including file and directory links. The CLI still accepts explicit paths.
Both paths reject non-regular files and files over 20 × 1024 × 1024 bytes before reading contents.
The empty-library message and previous command contract reflect the new behavior.

CI runs build, lint and tests on Node 22.19.0, 24 and 26, plus a single full-history secret scan
and a package/install check. A version-tag release waits for checks and the history scan, verifies
the package/tag, runs the install smoke test, then publishes to npm with provenance and creates
a GitHub release. The release permissions and npm token are scoped to that publication job/step.
No workflow was pushed or triggered, and nothing was tagged or published during implementation.

The README now leads with npm installation, explains the ready-to-play examples, documents the
Node policy, and moves source installation into Development. AGENTS documents release commands.

## Tasks completed and not completed

**T001-T019 are complete.** T019 was appended by convergence to fix the quickstart's local tarball
path. All original phases were completed and committed after their required checks. This report
and the final markers form the final checkpoint commit. No application task remains unchecked.

Owner manual acceptance and execution of the configured GitHub workflows remain pending, as
specified by the plan. First publication and repository/account setup are owner actions.

## Test results

Every implementation phase passed `pnpm build && pnpm lint && pnpm test` before its commit.
Final validation passed after the convergence correction:

```text
pnpm build && pnpm lint && pnpm test
Checked 134 files. No fixes applied.
Test Files  61 passed (61)
     Tests  342 passed (342)
```

| Area | Evidence |
|------|----------|
| Settings | Boolean marker round trip, absent/default behavior, invalid values dropped independently |
| T-a | Directory, FIFO, sparse file one byte over the limit, valid card import; FIFO is skipped on Windows |
| T-b/T-c | Root navigation, nested parent navigation, file and directory symlinks outside the root refused by selection validation, app arguments refused, no command argument hint or completion |
| App/CLI imports | Normal browser selection works; oversized app and explicit CLI imports fail with the shared message |
| T-d | Empty selected home creates folders; copies/imports/attachment/marker; three restarts preserve deletion of both source copy and library items; same-named malformed/wrong-kind user content preserved and not imported; existing Alice deduplicated; upgrade settings retained; folder creation failure; marker write failure and repair/retry; missing source files; import failure notice |
| T-e | Development-layout examples locator |
| T-f | Exact allowlist accepted independent of order; extra/missing files fail and are named |
| T-g | The justified shipped-content happy path adds Alice/Wonderland and sends Cheshire Cat lore through pi's faux provider with a matching included trace entry |
| T-j | Parameterised subcommand checks leave examples unseeded; CLI interactive integration tests use generated examples and a mocked terminal launch, including notice forwarding after a marker-write failure |
| Workflow structure | Both files parse with the existing yaml dependency; three Node matrix entries and publication dependencies verified |
| Gitleaks installer | The workflow's download/checksum/install commands ran in temporary directories; the Linux archive checksum passed and the binary reported 8.30.1 |
| History scan | Full local history scan at Phase 6: 116 commits, no findings |

The Node 22/24 jobs and the workflows themselves have not executed on GitHub. Local checks ran
on Node 26.7.0; the other matrix results must be observed after the owner pushes.

### Release package check

The final package check included a correct version tag:

```text
pnpm release:check --tag v0.1.0
Package contents verified:
package/examples/LICENSE
package/LICENSE
package/dist/cli.js
package/examples/characters/alice.json
package/package.json
package/examples/lorebooks/wonderland.json
package/examples/README.md
package/README.md
gitleaks: scanned 166794 bytes; no leaks found
Release package v0.1.0 passed contents and secret checks.
```

The tarball is `release/littletavern-0.1.0.tgz`, with eight files, about 45.5 kB packed and
166.8 kB unpacked. The generated `release/` directory is ignored by git.

The negative tag check also passed: `node scripts/check-release.mjs --tag v9.9.9` exited 1 with
`Tag v9.9.9 does not match app version v0.1.0`.

### Installed-package smoke test

Installation into a fresh temporary npm prefix and `LITTLETAVERN_HOME` passed. npm installed
135 runtime dependency packages; the installed command then produced:

```text
LittleTavern 0.1.0
Imported "Alice" — Character card V3 (JSON)
Characters (1)
Lorebooks (0)
```

This smoke test explicitly imports Alice only. The interactive automatic attachment is covered
by T-g and startup integration tests, with visual acceptance left to the owner.

The first smoke attempt failed because npm treated the unprefixed `release/...tgz` as GitHub
shorthand. Using `./release/...tgz` fixed it. Both workflows and quickstart now use the verified
local path. The package check also needed a sandbox escalation because `tar` subprocess execution
was blocked; the successful check ran the same release command without changing its behavior.

### External acceptance

The existing offline acceptance suite passed **19 checks, 0 failures** against this checkout:

```bash
bash ../acceptance/run-v1-acceptance.sh --auto-only --repo "$PWD"
```

Record: `../acceptance/results/v1-acceptance-20261020-104839.md`. It identifies this checkout's
built CLI and branch `010-release` at the pre-final-validation commit `1e667f4`.
External sample resources stayed outside the repository and were imported only into temporary data.

## Deferred tests

- Live GitHub push/PR/tag execution, actual npm publication/provenance and GitHub release creation
  are pending owner action. The workflow files and their installer were checked locally.
- Owner interactive installation/play, terminal presentation and the under-five-minute onboarding
  outcome remain manual acceptance checks. No real provider or real editor was launched.
- A listed file replaced before import is not a separate test, as explicitly assessed in the
  plan: the shared checks execute at import time; T-a covers those checks.

No planned automated unit or faux-provider test was deferred. The local install smoke test ran
successfully rather than being deferred for network access.

## Deviations from spec or plan

- Added `allowBuilds.esbuild: false` because pnpm 11 requires an explicit decision for the newly
  blocked script. The packaged esbuild binary works without it; no install script was enabled.
- Corrected the npm tarball path spelling with an explicit `./` prefix. Convergence T019 records
  the corresponding validation-guide correction.
- Implemented the latest explicit clarification/FR-011's once-per-run history scan. US3's older
  narrative still says per version; no design artifact was silently rewritten to hide that wording.

Implementation details are recorded in [questions.md](./questions.md). No constitution, spec,
plan, research, data model or checklist markers were changed during implementation. The prior
006 command contract was updated by its explicit task; quickstart was corrected under T019.

## Open questions

No unanswered behavior questions. The owner must confirm the configured Node matrix succeeds
before claiming those lines for a published release, as required by the feature's support policy.

## Demo notes for the owner

Use the corrected install smoke commands in [quickstart.md](./quickstart.md), then launch the
installed command with a second fresh temporary home. Press Enter, add a key with `/apikey`, choose
a model with `/model`, and select Alice with `/characters`. Wonderland should already be attached.
Ask about the Cheshire Cat and open `/trace` to see the included entry and other decisions.

After quitting, delete `alice.json` from that home's import `characters/` folder and restart
three times: it must stay absent. Alice remains in the library until the library item is deleted;
that is distinct from whether the source copy was restored.

## Development tool and token usage

See [development-usage.md](./development-usage.md). Platform-reported total development tokens:
**unknown**; no run total is exposed. Tool purposes and outcomes, including failed sandbox/cache
attempts and the corrected smoke path, are recorded. No `.env`, real credentials, local model,
GPU, real editor or real user home/settings were read or used. Network access was limited to
package installation and public release/documentation verification.

## Convergence

T017 assessed 15 functional requirements, 4 build-related success criteria, 17 user-story
acceptance scenarios, 9 edge cases, research decisions R1-R8, all 18 original tasks, and the
7 constitution principles plus applicable technology/testing constraints.

Initial outcome: **tasks_appended**, with one MEDIUM `partial` finding: the quickstart's local
package path was not reproducible with npm. Other gap types and severities were zero. T019 was
appended under Phase 9 without rewriting prior tasks, then completed under implementation.
The corrected guide now matches the successful install command. No remaining actionable
application gap was found; administrative reporting and task closure are completed here.

The pre/post convergence and pre/post implementation hook checks found no
`.specify/extensions.yml`; hooks were skipped.

## What the owner should check manually

- Install the built tarball in a clean location and launch with an empty selected home. Confirm
  Alice/Wonderland are ready, with no manual import or attachment.
- Configure key/model, chat with Alice and inspect `/trace`; verify the onboarding time target.
- Confirm deleting the example source copy remains effective across three restarts.
- Verify `/import` stays rooted, arguments show guidance, outside links are refused, and explicit
  shell imports still work.
- Push a branch and inspect build/lint/test results on Node 22.19.0, 24 and 26, the full-history
  scan and the package/install check.

## Owner checklist: first release

These actions remain outside implementation and were not executed:

1. Review/merge `010-release` into `main` and push it.
2. Make the repository public.
3. Enable GitHub secret scanning and push protection.
4. Confirm every configured Node line passes CI. If a tested line fails, narrow engines and the
   README before publication, following the feature's support policy.
5. Prepare the npm account/token and add the repository secret `NPM_TOKEN` as described in quickstart.
6. Push the version tag matching the app, currently `v0.1.0`. Observe package verification,
   npm publication with provenance and the GitHub release attachment.
7. On a clean machine, install with `npm install -g littletavern` and follow the README.
