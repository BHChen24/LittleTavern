# Implementation report: 002-card-import

## Summary

Implemented card/lorebook parsing and a local import-only library on 002-card-import.
Accepted inputs include V2/V3 JSON, V2/V3 PNG with V3 preference, embedded lorebooks,
standalone world-info and card-format lorebooks. Originals are stored byte for byte;
raw JSON and entry sources remain untouched. Normalized fields, warnings and preserved
unused field names support later features without executing extensions or substituting macros.

The library uses content-derived identifiers, duplicate detection, temporary-folder writes
and rename, listing, exact/unique-prefix lookup, and shared import/list/details formatters
for CLI subcommands and in-app commands. Library commands can be entered from the key
prompt without providing credentials; chatting still requires a key.

## Tasks completed and not completed

T001–T020 are complete and checked. All nine external samples passed. The owner's
clarification of detection priority is implemented, documented and covered by regressions.
The convergence checkpoint completes the four-format synthetic import assertions and
records the representative SC-005 measurement below.

## Test results

Commands (the pnpm option uses existing dependencies without automatic installation):

```sh
pnpm --config.verify-deps-before-run=false build
pnpm --config.verify-deps-before-run=false lint
LITTLETAVERN_TEST_CARDS=/home/dev0/projects/LittleTavernProject/test-cards pnpm --config.verify-deps-before-run=false test
```

Final output tail:

```text
$ tsc -b
$ biome check .
Checked 63 files in 30ms. No fixes applied.
$ vitest run
Test Files  21 passed (21)
     Tests  118 passed (118)
```

Nine of those tests use local external samples; all matched the format labels, names
and entry counts in research R7. They skip when the sample directory is absent.
No external sample content was added to the repository. Tests do not load .env or run
live providers, local language models or GPU work. No dependency was added.

Coverage includes PNG text decoding and damaged bounds; content detection, BOM and newer
3.x markers; rejected inputs leaving the existing library unchanged; normalization for
both entry shapes, defaults, warnings and numeric ordering; byte-identical originals and
recursive raw-key preservation; duplicates and same-name distinct items; large text and
300 embedded entries without truncation; list/get/prefix ambiguity and deleted items;
shared display formats and display-only truncation; CLI exit codes and key-prompt command
handoff. The original 001 tests also remain green.

A supplemental smoke check of the compiled runCli passed import/list/show, unique prefix,
duplicate handling, original-byte equality and help output with an empty API-key environment.
Importing the small synthetic card took about 1.6 ms in that run (a measurement, not a
portable performance guarantee). An initial subprocess smoke harness was blocked by sandbox
EPERM and was replaced with in-process invocation, as the test plan recommends.

No coverage percentage threshold is defined by this feature.

### Convergence verification (T019–T020)

Four parameterized synthetic import tests now assert the exact format label, item name,
normalized character name and embedded entry count for V3 JSON, V2 JSON, dual-chunk PNG
and V2-only PNG. The V2 payload has a distinct name and one entry; V3 has another name and
two entries, so choosing the wrong payload in a dual-chunk PNG fails the assertions.
The targeted library suite passed all 24 tests; the full suite passed all 118 tests above.

SC-005 was checked with a generated V3 JSON card of **782,360 bytes**, containing all shared
character fields, an extension and **200 embedded lorebook entries**. Its description repeats
`Synthetic scene {{user}}. ` 25,000 times; each entry repeats
`Synthetic lore {{char}} and {{user}}. ` 15 times. The source was written before timing.
One fresh `importFile` into a temporary library under `/tmp` took **18.427 ms**, below
the **1,000 ms** criterion. Timing includes the source read, detection, normalization,
hashing, original/item writes and final rename; fixture construction and cleanup are excluded.
The result was checked for a fresh successful import and all 200 normalized entries.

Runtime: **Node v26.7.0, Linux x64, WSL2 kernel
6.18.33.2-microsoft-standard-WSL2**. This is a local measurement on that runtime and temporary
filesystem. No benchmark framework, dependency or permanent timing regression test was added.

## Deferred tests

No planned automated test was deferred. T-h (in-app import/list/show appearance) is manual
by plan: both surfaces use the tested formatter. Terminal layout, command feel and output
readability remain owner checks. No real-provider test was run or needed.

## Deviations from spec or plan

- The owner authorized synchronizing the stale main-branch clause with the feature-branch
  workflow. Constitution 3.0.0 now matches AGENTS.md and 002's task rules. Every commit stayed
  on 002-card-import; no switch, merge or rebase was performed.
- Only the engine public barrel changes, to re-export data's API as T008/T011 require.
  Engine behavior and pi adapters are unchanged.
- To make library commands reachable without a key, KeyPrompt can hand those commands to
  app.submit and return focus to the editor. This avoids interpreting a library command as
  an API key; a normal chat attempt opens the key prompt again.
- Embedded unnamed lorebooks use the character name as their fallback; standalone books use
  the source file base name. Non-object entries produce a warning and are omitted only from
  the normalized view, remaining intact in raw.
- Node JSON.parse does not always supply a line/column. Its message is passed through verbatim
  as T005 requires. No repair or guessed source location is added.
- The owner authorized relaxing R2's V1 heuristic. Named lorebooks can share description
  fields with V1 cards, so the old priority misclassified valid FR-002 inputs. Both entries
  shapes now take precedence over V1 detection after explicit spec handling. R2 records this
  reason, and detection/import regressions cover both shapes and explicit-spec priority.
- The convergence implementation used the existing `002-card-import` branch in the isolated
  worktree `/tmp/littletavern-002-convergence-20261019`, because the original worktree was
  already on `003-prompt-assembly`. No branch switch, merge or rebase was performed. Existing
  dependencies were linked for local checks without installation; the local-sample directory
  was passed explicitly through `LITTLETAVERN_TEST_CARDS`.

## Open questions

See [questions.md](./questions.md). Both the branch workflow and detection-priority questions
are resolved with owner authorization. No unresolved question blocks this feature.

## Development tool and token usage

See [development-usage.md](./development-usage.md). The conversation tool transcript records
each invocation and outcome. Platform-reported total development tokens: **unknown**.
No token counts are estimated, and output-size estimates are not development usage.

## What the owner should check manually

Follow [quickstart.md](./quickstart.md): import the external samples into a temporary home,
confirm seven characters and two lorebooks, inspect fields and unused extensions, repeat
an import, and compare original bytes. In the TUI, check /import, /library and /show both
with a configured key and from the initial no-key prompt. Check that normal chat remains
blocked until a key is provided. Editing, export and in-app deletion remain out of scope.

## Extension hooks

No .specify/extensions.yml file was present; no implementation or constitution hooks applied.

## Completion checks

All 18 tasks are marked complete. No added dependency, provider call, local model or GPU work
was required. The default test configuration still disables environment-file loading; live
tests were not run. Source originals and external samples remain separate from committed code.
Final convergence review follows the implementation checkpoint.
