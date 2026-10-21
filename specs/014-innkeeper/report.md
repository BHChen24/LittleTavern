# Implementation Report: The Innkeeper

## Summary

`/innkeeper` is now a tool-using guide with its own in-memory conversation. It can read safe
settings, list characters and personas, look up built-in help, propose settings changes, and
offer to start or resume a character chat. Returning to it restores the conversation and
muted tool lines; `/new` clears it.

Settings changes validate before confirmation. Yes creates an exclusive byte-for-byte backup
of the existing file, preserves unrelated and unknown fields, saves the changes, and updates
the active request settings. No, Esc, or abort leaves settings untouched. Sampling and lore
settings can be removed to restore defaults. Mouse changes apply after restart.

Chat opening asks first and switches only after the innkeeper's usage is recorded. Tool rounds
are capped per message, and every assistant request contributes its token and cost fields to
the turn's usage, status bar, run spending, and ledger. Character requests retain their own
assembled context and have no tools. Public engine interfaces expose only LittleTavern types.

## Tasks completed and not completed

T001–T014 are complete. No implementation task or behavior question remains. The owner's
real-model and visual acceptance checks remain manual.

| Phase | Commit | Validation |
|---|---|---|
| 1: settings and session | `3d7e26f` | Build, lint, 480 tests passed |
| 2: read-only tools and history | `517be4c` | Build, lint, 483 tests passed |
| 3: confirmed settings changes | `9b979c2` | Build, lint, 493 tests passed |
| 4: new and resumed character chats | `1f161ca` | Build, lint, 505 tests passed |
| 5: limits and usage accounting | `f43146f` | Build, lint, 508 tests passed |
| 6: happy path and documentation | `d4fe465` | Build, lint, 509 tests passed |

Phase 7 records final verification, convergence, and this report in the final feature-branch
commit. No push, tag, publication, or pull-request operation was performed.

## Test results

Final required checks passed:

```text
pnpm build && pnpm lint && pnpm test
Checked 143 files. No fixes applied.
Test Files 67 passed (67)
Tests 509 passed (509)
```

| Planned group | Evidence |
|---|---|
| T-a | Every allowed setting, invalid values, removal rules, unsupported keys, non-finite changes, and valid/invalid/default tool-round settings |
| T-b | Exact original bytes in backups, nested sibling and unknown-field preservation, optional removal, same-millisecond backup collisions, missing file, malformed and non-object JSON |
| T-c | Safe settings from active limits/generation and current lore, credentials/environment exclusion, help, character and active-persona lists, invalid/declined/accepted changes, backup-path callback, malformed/write errors, character resolution and newest matching saved chat |
| T-d | Real internal tools driven by faux tool calls, final answer receives the result, ordered history, listeners, separate character context, next-request options, per-message cap, next-message round-limit changes, accepted open ends without another request, exact sum of every token and cost field |
| T-e | Ordered muted lines and replay, Yes/No/Esc, old/new values, abort during confirmation, backup notice, live cap and sampling removal, hand-edit preservation, spend allowance, mouse restart notice, new/resumed chat opening after usage recording, unknown/ambiguous/unsaved names, malformed arguments, round-limit notice, status/ledger accounting, provider-failure retry hint, `/new` |
| T-f | Fresh temporary home with a synthetic Alice: help lookup, confirmed 1000-token cap, exact backup, approved chat opening, then a character request with `maxTokens: 1000` |
| Regression suite | Existing character-chat and 013 editing tests pass; two existing TUI assertions were updated for the required innkeeper wording |

### External acceptance

The required offline acceptance suite passed **19 checks, 0 failures**:

```bash
bash ../acceptance/run-v1-acceptance.sh --auto-only --repo "$PWD"
```

Record: `../acceptance/results/v1-acceptance-20261020-225857.md`. It used a fresh temporary
application home, no API key, and no network. Third-party sample cards stayed outside the
repository. Committed test fixtures are generated synthetic data.

## Deferred tests

No planned automated test was deferred for complexity. Real-model tool selection, language,
tone, and UI appearance remain the owner's manual checks from [quickstart.md](./quickstart.md).
No real provider request, real editor, local LLM, or GPU was launched.

## Deviations from spec or plan

No product behavior deviation was needed. The current design artifacts include the design
owner's resolutions of the five findings in the historical [analysis.md](./analysis.md).
Implementation follows those updated artifacts; the historical analysis was left unchanged.

Routine implementation choices are recorded in [questions.md](./questions.md): settings use a
temporary sibling and rename to preserve the original on write failure; round limits are
snapshotted per message; terminal controls are stripped inside the tool adapter without an
engine-to-TUI dependency.

Pi's faux provider reports zero costs. Usage-summation tests supply deterministic reported
usage at the adapter event boundary, and app spend tests supply synthetic reported costs before
the app's finish listener. These changes stay in tests and add no production test API.

The constitution, current spec, plan, research, data model, message contract, checklist, and
quickstart were not edited. Task markers were updated after successful checkpoints. The prior
006 command contract changed under T011. No dependency or ignore configuration change was needed.

## Open questions

None.

## Demo notes for the owner

Use a temporary home and follow [quickstart.md](./quickstart.md). Ask how to import a character,
then request a reply cap and sampling change. Check the old/new lines, Yes/No picker, backup
path, and requested options in a later character chat's `/trace`.

Try new and resumed Alice chats, return to `/innkeeper`, and check the conversation and muted
tool lines. Test decline and Esc, invalid top P, guidance for model/persona changes, the mouse
restart notice, a one-round cap, and a malformed settings file.

## Development tool and token usage

See [development-usage.md](./development-usage.md) and the individual invocation records in the
conversation. Total platform-reported development token usage: **unknown**. No estimate is
substituted.

No `.env` or real application home/settings were read or used. Dependencies were already
installed, and none were added. Pi facts were checked against the read-only `../pi` clone at
`v1.3.0`. Scoped escalations permitted feature-branch commits through normal hooks and the
external acceptance result write. All commit secret scans passed; no hook was bypassed.

## Convergence

T013 applied `speckit-converge` to the present implementation. The review checked all 14
functional requirements, 5 success criteria, 22 acceptance scenarios, 12 edge cases, research
decisions R1–R10, the six planned test groups, and the 14 tasks. It checked the seven
constitution principles and applicable technology, licensing, safety, and workflow constraints.

Outcome: **converged**. No missing, partial, contradicting, or unrequested implementation
finding remained. No additional task or empty convergence phase was appended.

The task file was byte-for-byte unchanged during convergence. Its before/after SHA256 was
`cf7ce32ecaa465625075fdcbd64615ed47271fe260e14b90dd990f667cee72cf`.
The final implementation workflow updates T012–T014 markers afterward.

No `.specify/extensions.yml` exists; pre/post implementation and convergence hooks were skipped.

## What the owner should check manually

- Real-model tool use and answers grounded in help/settings results.
- Tavern-keeper tone and answers in the player's language.
- Muted tool lines, confirmation layout, and Yes/No/Esc behavior in a real terminal.
- Saved settings and backup paths, live request changes, and mouse behavior after restart.
- New/resumed character chat opening and innkeeper conversation replay.
- Round-limit and malformed-file notices.
