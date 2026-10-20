# Implementation Report: Chat Safeguards

## Summary

Failed replies now show a short action-oriented notice, the diagnostic log path, and a manual
retry count in character chats when retrying can help. Partial failed text is marked
`(incomplete, not saved)`. The structured log records the provider message, model, error kind,
and time with secrets removed. The innkeeper asks the user to send again and shows no count.

Requests default to a 4096 output-token cap. Once known spending reaches the default $1 run
threshold, send and regenerate ask before proceeding. Continue adds one configured allowance;
Stop preserves the input. The home screen and pre-chat setup show the limits and settings path.
Cut-off replies are saved normally, and cut-off and unknown-price notes appear once per run.

`/prev` swaps the latest regenerated pair in character chats. Each swap appends the selected
reply through pi's session manager, so the shown choice survives reopening and is used in the
next request. The restore slot itself is limited to this run and clears on a new send,
regenerate start, or chat switch. Failed regenerates leave it empty.

The first chat layout asks for the player's name when no name or usable persona exists.
Enter saves the cleaned name; Esc leaves settings unchanged and uses Traveler. Persona names
retain precedence. Optional sampling settings are validated independently and sent through
pi's existing request options. `/trace` reports the configured values under `Requested:`.

## Tasks completed and not completed

T001-T017 are complete. No implementation task or behavior question remains. Owner visual
acceptance and release actions remain manual follow-up work.

Completed implementation checkpoints:

| Phase | Commit | Validation |
|---|---|---|
| 1: settings and request plumbing | `c67a8b7` | Build, lint, 388 tests passed |
| 2-3: failures and spending | `8917257` | Build, lint, 405 tests passed |
| 4: previous reply | `3855407` | Build, lint, 411 tests passed |
| 5: player name | `a4b6ed9` | Build, lint, 419 tests passed |
| 6: request trace | `39ab54a` | Build, lint, 424 tests passed |
| 7: happy path and docs | `f5c52e9` | Build, lint, 426 tests passed |

## Test results

The polish checkpoint passed:

```text
pnpm build && pnpm lint && pnpm test
Checked 139 files. No fixes applied.
Test Files 64 passed (64)
Tests 426 passed (426)
```

| Area | Evidence |
|---|---|
| T-a | Defaults, disabled limits, all generation fields, independent rejection/warnings, valid sibling values, unrelated settings preserved |
| T-b | Faux response factory sees configured `maxTokens`, `temperature`, and sampling keys; omitted values remain absent |
| T-c | Length outcome remains completed, carries `cutOff`, and is saved in a character chat |
| T-d | Swap/swap-back, latest pair after successive regenerates, failure clears the slot, send clears it, restored choice persists after reopen, interrupted replacement can be swapped |
| T-e | All six failure kinds and log fields, secret redaction, empty and partial failures, preserved typed draft, retry increment/reset, failed regenerate retained original on disk, innkeeper variant |
| T-f | Spend check for sends, regenerates, innkeeper; Stop preserves input and sends nothing; Continue adds one cap; disabled limits; reminder visibility; cut-off and unknown-price notes once |
| T-g | Transcript swaps and chat-switch invalidation, innkeeper explanation, actual terminal Enter dispatch for `/prev` and `/new` during streaming |
| T-h | Default and typed name, Esc/restart, blank refusal, controls removed, saved-name and valid-persona bypass, missing/invalid-persona prompt, greeting name precedence |
| T-i | Requested cap and every configured sampling key, zero temperature, model-maximum wording and model defaults; engine stores request options on last trace |
| T-j | Larger reply cap reduces history budget; disabled cap preserves the existing reserve |
| T-k | Fresh name setup, synthetic card greeting, send/regenerate/prev, restored reply and Mira in the next faux request, requested settings visible in trace |
| Startup plumbing | Production session gets mapped settings without sending a real request; invalid-field notice appears once; live edits do not change startup request settings |
| Existing regression suite | Returning-user app fixtures now save Traveler so existing picker, key, editor, persona, ledger, and readiness tests exercise their original flows |

The scan for `"User"` in non-test source produced no matches. Its exit code 1 means no matches,
not a failed build or test run.

### External acceptance

The required offline acceptance suite passed **19 checks, 0 failures**:

```bash
bash ../acceptance/run-v1-acceptance.sh --auto-only --repo "$PWD"
```

Record: `../acceptance/results/v1-acceptance-20261020-172157.md`. It used a fresh temporary
app home and no API key or network. External cards and lorebooks stayed outside this repository;
committed test fixtures are synthetic.

## Deferred tests

No planned automated test was deferred for complexity. Owner visual acceptance of the notices,
picker, and name prompt remains pending. A real provider error is an optional owner observation
if one occurs; no real provider request, real editor, local LLM, or GPU was launched.

## Deviations from spec or plan

- Phase 2 passed its checks, but gitleaks flagged a generated test literal. The finding was
  reported, and the owner explicitly approved replacing it with the existing `synthetic-key`
  placeholder. The scan then passed. Phases 2 and 3 share a commit because that checkpoint
  commit was blocked. Hooks and `.gitleaksignore` were unchanged.
- pi's faux provider overwrites usage with estimated tokens and zero costs, even for a priced
  model. Spend tests inject synthetic reported costs through a finish callback registered
  before the app listener. This stays in the test harness and adds no production test API.
- Character-chat assembly uses the session's startup cap to keep its reserve aligned with
  actual request options if settings are edited during a run. Standalone assembly/dry-run
  reads the supplied settings file. Other routine details are in [questions.md](./questions.md).

The implementation did not edit the constitution, current spec, plan, research, data model,
message contract, checklist, or quickstart. The previous feature's command contract changed
under T014. The earlier [analysis.md](./analysis.md) remains a historical design review; this
implementation follows the subsequently updated design artifacts.

## Open questions

None. The secret-scan question was answered by the owner and resolved with a passing scan.

## Demo notes for the owner

Use a temporary home and follow [quickstart.md](./quickstart.md). Check the initial limits line,
name setup, character greeting, regenerate/prev swaps, and persistence of the selected reply.
With a short output cap and a small spend threshold, check the cut-off notice, Stop preserving
input, and Continue. Set a valid temperature plus an invalid topP to check the startup warning
and `Requested:` trace line. Check `/prev` while streaming using the real Enter key.

Release 0.1.1 is an owner action after review and merge. Bump `packages/tui/package.json` on a
feature branch and merge through a pull request with passing CI. Tag `v0.1.1` and push the tag;
the existing workflow stages the package on npm. Approve the staged version with 2FA on npmjs.com
or through `npm stage list littletavern` and `npm stage approve <stage-id>`, following
[010's release guide](../010-release/quickstart.md). No push, tag, publication, or PR operation
was performed during this implementation.

## Development tool and token usage

See [development-usage.md](./development-usage.md) and the individual tool-call records in the
conversation. Total platform-reported development token usage: **unknown**; no estimate is
substituted. No `.env` or real user home/settings were read or used.

Dependencies were installed from the existing lockfile without adding dependencies. Scoped
sandbox escalations allowed the install, required feature-branch commits with normal hooks,
and the external acceptance result write. Secret scanning, lint, and commit-message hooks ran.

## Convergence

T016 assessed the current implementation against all 17 functional requirements, 6 success
criteria, 30 acceptance scenarios, 11 edge cases, research decisions R1-R11, all 17 tasks, and
the constitution's 7 core principles plus applicable technology, workflow, and testing constraints.

Outcome: **converged**, with zero missing, partial, contradicting, or unrequested findings.
The convergence pass left `tasks.md` byte-for-byte unchanged; its before/after SHA256 was
`d8b153caac5f2b8755bb458e8591e48c927bf9e5ae106c5c3f322cd9866aae4c`. No empty convergence
phase was appended. Task completion markers were updated afterwards by the implement workflow.

No `.specify/extensions.yml` exists, so implementation and convergence hooks were skipped.

## What the owner should check manually

- Follow all five manual quickstart steps with a temporary app home.
- Inspect notices, borders, focus, wrapping, and the spend picker at normal and narrow widths,
  with and without NO_COLOR.
- Confirm name setup appears before API-key setup and that Esc asks again next start.
- Confirm the selected `/prev` reply survives a restart, while the in-memory restore slot does
  not; confirm `/prev` and `/new` show the wait message while a reply streams.
- Observe GitHub CI and complete the staged 0.1.1 release after review and merge.
