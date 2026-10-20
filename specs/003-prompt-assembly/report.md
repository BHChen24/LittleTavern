# Implementation report: 003-prompt-assembly

## Summary

Implemented the pure, synchronous prompt-assembly API on `003-prompt-assembly`. It takes a
002 character, optional standalone lorebooks, history, user name, settings and model window,
and returns system text, chronological fitted history, post-history instructions and a
structured decision trace. The input is never mutated.

The pipeline replaces only char/user macros, activates lore by constants or case-insensitive
primary-keyword substrings, applies the lore budget in descending insertion order, places
survivors before/after the character definition in ascending order, and fits history newest
first. Token estimates count each CJK script character as one token and other characters
at one per four, rounded up. Every lore entry has a reason in the trace, including exclusions.
Ignored-feature notes follow research R5 and read the original entry source.

`ModelInfo.contextWindow` is mapped from pi's model metadata. The field was verified in the
read-only reference clone at v1.3.0 (`packages/ai/src/types.ts`, Model). No pi imports, I/O or
provider conversion were added to the assembly implementation. Chat integration is 004;
trace presentation is 005.

## Tasks completed and not completed

T001–T016 are complete and marked [X]. Each of the seven phases passed build, lint and the
full test suite before its checkpoint commit. All work stayed on `003-prompt-assembly`;
there was no branch switch, merge or rebase.

## Test results

Commands from the repository root, using existing installed dependencies:

```sh
pnpm --config.verify-deps-before-run=false build
pnpm --config.verify-deps-before-run=false lint
pnpm --config.verify-deps-before-run=false test
```

Final output:

```text
$ tsc -b
$ biome check .
Checked 76 files in 34ms. No fixes applied.
$ vitest run
Test Files  27 passed (27)
     Tests  171 passed (171)
```

The 57 new tests cover:

- CJK/Latin/mixed token estimates, Unicode code points, macro case/whitespace variants,
  unknown macros, and literal replacement without recursively expanding names.
- Card part order, blank-part omission, default/card main instructions, all text macro
  substitution, chronological roles, post-history instructions and deterministic results.
- Newest-first history fitting, stop at the first non-fitting message, latest-message
  retention, empty history, overflow notes and reply/system/post-history reservations.
- Embedded-before-standalone source order; disabled/constant/keyless precedence; newest
  message and first-key matching; CJK substrings; configured/zero scan depth; macro keywords;
  independent entries sharing a key; placement precedence and stable insertion-order ties.
- Raw-source notes for secondary keys, regex keys, probability, unsupported numeric placement,
  per-entry scan depth, case sensitivity and whole-word matching. These features are noted
  rather than applied; regex-looking keys match as literal text.
- Descending budget admission, stop after overflow, constant entries competing, costs after
  macro replacement, CJK costs, the 4000 default, explicit/zero budgets and source-order trace.
- Every entry exactly once, history counts summing to the input length, included lore costs
  within budget, structured-only trace data, labelled estimates and frozen-input purity.

Seven local-only assembly tests import every external character sample through 002 and
assemble with `chat("你好", "……")`; all passed. The trace counts match 2, 2, 1, 6, 0, 0 and
4 entries respectively. Seraphina's four imported entries all resolve to `before`.
The existing nine import sample tests also passed. Sample content remains outside the
repository; temporary libraries are removed after each test.

A separate run with `LITTLETAVERN_TEST_CARDS` pointing at a missing temporary path skipped
all seven assembly sample tests as intended. A built-engine API smoke check passed its
public exports, assembly, trace, macros, defaults and determinism assertions. It did no
provider I/O. No real provider, local LLM or GPU work was run; tests never load .env.

All 15 functional requirements and 21 acceptance scenarios are covered by the component and
assembly tests. SC-001–SC-003 are covered by those tests; SC-004 by the local samples;
SC-005 is supported by explicit structured reasons and ignored-feature notes. There is no
line-coverage percentage threshold in this feature.

## Deferred tests

None. All T-a–T-h tests assessed in the plan were lightweight enough to implement. No manual
UI verification is planned for 003, which exposes no UI. The happy path is exercised through
the pure API and import-to-assembly tests; sending an assembled request belongs to 004.

## Deviations from spec or plan

- Input properties with documented defaults are optional in TypeScript. Explicitly undefined
  optional settings also use the defaults; a test caught and fixed spread-based default
  values being overwritten by undefined.
- The output follows the plan/data-model/API contract's `system`, `history`, `afterHistory`
  representation. Provider message conversion remains 004's responsibility.
- Total tokens use the joined system text, kept messages and post-history instructions.
  Individual parts round independently, so their sum can differ because of rounding and
  separators. History fitting uses that same joined-system estimate.
- If the system already exceeds available space with empty history, the trace also reports
  the context-window overflow. The request is not silently repaired.
- Seraphina's fixed greeting conversation need not activate lore. The local test checks
  placement for all four imported entries directly and checks any included trace placements,
  avoiding a vacuous placement assertion. Excluded entries need not have a placement field.

## Open questions

See [questions.md](./questions.md) for conservative interpretations recorded under the run
rules. No unresolved issue blocks this implementation. The existing plan's constitution
version reference predates 3.0.0; this run followed the current constitution without editing
the design artifacts.

## Development tool and token usage

See [development-usage.md](./development-usage.md). The conversation tool transcript records
each invocation, purpose and outcome. Platform-reported total development tokens: **unknown**.
No count is estimated. No dependency was added or installed; no .env was read, printed or used.

## What the owner should check manually

None required by 003. Inspect the structured output through the exported engine API, or
through 004 and 005 when those features consume it.

## Extension hooks

No `.specify/extensions.yml` was present at initialization or the mandatory post-execution
check, so no implementation hooks applied.
