# Implementation report: 001-tui-chat

## Summary

Implemented the TUI chat skeleton on main: LittleTavern 0.1.0 title and CLI flags,
streamed OpenRouter chat with in-memory multi-turn history, Esc interruption, readable
provider errors, key entry/save/session-only/forget flows, model filtering and remembered
selection, append-only request usage, and session token/cost totals. pi 1.3.0 owns the
agent loop, transport, model pricing and terminal widgets. Only the two planned engine
adapter modules import pi; no dependency was added.

The owner corrected constitution principle V: it concerns SDD development tool invocations
and total development tokens. Constitution 2.0.0 reflects that correction; it requires no
application context trace. Application token/cost accounting remains specified by FR-019–FR-023.

## Tasks completed and not completed

T001–T037 are complete and marked [X]. No implementation tasks remain.
The live test is written and deliberately unrun, as T033 requires.

## Test results

Commands run from the repository root:

```sh
pnpm --config.verify-deps-before-run=false build
pnpm --config.verify-deps-before-run=false lint
pnpm --config.verify-deps-before-run=false test
node packages/tui/dist/cli.js --version
```

The pnpm option disables automatic dependency installation during script execution. The
sandbox cannot write pnpm's external store. Existing installed dependencies were used;
no installation or new dependency was needed. The final configurations explicitly disable Vite environment-file loading with envDir: false.

Final output tail:

```text
$ tsc -b
$ biome check .
Checked 50 files in 22ms. No fixes applied.
$ vitest run
Test Files  15 passed (15)
     Tests  48 passed (48)
LittleTavern 0.1.0
```

Coverage includes key precedence and blank values; credential permissions, malformed and
unreadable files, forgetting; secret scrubbing in log messages/errors and ledger errors;
allowed model families and default; provider error classification; usage mapping and totals;
simulated streaming, second-turn history and interruption; exactly one record per request;
UI key entry through consent to a simulated reply; rejected-key transcript retention and
return to the prompt; quit waiting for the interrupted ledger record; settings round trip;
and fuzzy filtering, selection and cancellation. Default tests exclude all live tests.
No coverage percentage threshold was defined by the feature.

## Deferred tests

No additional automated tests were deferred. T-i fits within a 55-line test file.
The plan leaves rendering details, resizing, CJK width, picker feel and terminal restore
after a crash to owner verification. The live provider test is opt-in and was not run.
No local model, GPU task or real provider was used.

## Deviations from spec or plan

- The owner authorized replacing constitution V and synchronizing the plan's Constitution
  Check; the original trace blocker is resolved.
- The TUI obtains data helpers through the engine barrel, preserving existing workspace
  dependencies without adding a direct TUI dependency on data.
- Simulated replies additionally accept our own history callbacks and error fixtures for
  lightweight history and secret-redaction tests. No pi type crosses the public API.
- Explicit in-app key replacement overrides the previous key for this run. Launch-time
  environment precedence remains unchanged. This permits replacing a rejected environment key.
- Null reasoning tokens also mark totals incomplete, following the task/data-model rule that
  any unknown token field makes totals incomplete.
- Save failures use the entered key for this session with a visible notice. Usage write
  failures show a notice and retain totals equal to successfully written records.
- Convergence added T036 to keep the status bar to one line even in narrow terminals, and
  T037 to explicitly disable Vite environment-file loading in both test configurations.
  Earlier test configurations did not disable Vite's default environment-file loading,
  so the runner may have read .env before this correction. Tests supplied synthetic keys
  and used the simulated provider throughout; no real request was sent. Final resolved
  Vite configurations were checked to have envDir false without reading environment files.
- Phase 4's key-entry test extension initially used the wrong pi focus accessor and was
  committed before its failure was inspected. The accessor was fixed, all checks rerun,
  and that commit amended before proceeding.

## Open questions

See [questions.md](./questions.md) for the resolved clarification and recorded implementation
choices. No unresolved question blocks this feature.

## Development tool and token usage

See [development-usage.md](./development-usage.md). Each invocation and its result is recorded
in the conversation tool transcript. Total development tokens: **unknown**; the platform
interface does not provide that measurement. Tool output-size estimates are not token usage.

## What the owner should check manually

Follow [quickstart.md](./quickstart.md) manual steps 1–10: masked entry and save consent,
header/status, real streaming and Esc interruption, model selection, ledger totals,
resize/CJK rendering, quitting/relaunch persistence, file permissions and secret absence.
The separate opt-in live test may be run by the owner.

Quickstart's first step requires launching without .env loaded. Since pnpm dev intentionally
loads .env, use `env -u OPENROUTER_API_KEY LITTLETAVERN_HOME=<temporary-directory> node
packages/tui/dist/cli.js` for the no-key launch after building, while the owner's .env exists.

## Extension hooks

No .specify/extensions.yml file was present; no implementation or constitution hooks applied.

## Convergence

Reviewed 24 functional requirements, 23 user-story acceptance scenarios, the buildable
parts of SC-002–SC-007, 12 plan decisions and all 7 constitution principles. Initial
findings: two partial gaps (one LOW: status wrapping; one HIGH: Vite environment-file
loading). Both were appended as T036/T037 and completed. Final assessment: no remaining
buildable gaps; no missing, contradictory or unjustified additional application behavior.
Owner manual verification and the intentionally unrun live test remain as planned.

Supplemental checks confirmed one status line within widths 0, 1, 8, 24 and 80, and both
resolved Vite configurations have envDir false. A first one-off config inspection used
an invalid pnpm dependency path; resolving Vite relative to Vitest corrected the check.
