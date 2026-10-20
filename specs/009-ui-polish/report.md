# Implementation Report: UI Polish

## Summary

LittleTavern now uses pi's alternate screen, with the transcript in a primary ScrollView and
fixed input and status components. Mouse capture is on by default and can be disabled with
`"mouse": false` in settings. Selection copies on release through an engine adapter over
pi coding-agent's cross-platform clipboard operation; pi displays copy failures.

The home screen gains original ASCII artwork with a plain-title fallback. Live and resumed
messages use one MessageView: equally bold speaker labels in green or magenta, a coloured
left bar on each body line, immediate text below the label, and a blank line between messages.
Quoted dialogue uses yellow, actions remain italic, and message width is capped at 100 columns.
Controls and secrets are removed before styling. Errors have a bold `Error:` prefix and red
styling; ordinary notices retain their separate style.

A pi Loader names the character or Assistant while waiting for text. It is removed on the first
non-empty text delta, completion, error, Esc and quit. Empty input shows the specified hint for
plain chat, character chat or a missing key. The top status shows character, valid active persona,
model and key source; the bottom shows tokens, cache and cost. With no key, the model is hidden.
Adding a saved or session key opens the model picker with the current model selected; Esc keeps it.
Environment keys do not open a picker on startup.

Ctrl+O round-trips the current input through VISUAL/EDITOR using the existing launcher. The
terminal stops and restarts around the editor. A failed editor preserves the input and reports
the failure. Temporary message files are private and removed after the operation.

`NO_COLOR` removes colours while preserving bold, italic and dim attributes in a terminal.

## Tasks completed and not completed

T001-T015 are complete. T012 was completed by evaluating and recording its explicitly permitted
light/dark deferral. T013's full gate and offline acceptance passed. T014 convergence, including
an additional owner-requested pass, found no actionable gaps and appended no tasks. T015 is this
report and the final phase commit. Owner manual acceptance remains pending.

## Test results

Every implementation phase passed `pnpm build && pnpm lint && pnpm test` before its commit.
The final automated gate passed:

```text
pnpm build && pnpm lint && pnpm test
Checked 121 files. No fixes applied.
Test Files  55 passed (55)
     Tests  304 passed (304)
```

| Area | Coverage |
|---|---|
| T-a | Straight, curly and CJK quotes; unclosed quotes stop at paragraph boundaries; narration and Markdown remain intact; sanitization precedes styling |
| T-b | Both speaker labels are bold; the bar appears on every body line; no blank line follows the label; width is capped and reflows at narrower widths |
| T-c | Logo and plain-title fallback, existing home content and key/import hints |
| T-d | All three placeholders, Editor borders and cursor marker, narrow width and disappearance while typing |
| T-e | Separate top/bottom content, compact fallback, no model without a key, persona display and omission |
| T-f | Failed command and provider error prefixes; ordinary notices retain their own style |
| T-g | Real faux-provider delayed reply; indicator before text, gone at first text delta, completion, error and Esc |
| T-h | Session and saved keys open the picker; current-model preselection; cancellation and existing key handling |
| T-i1 | NO_COLOR removes colours and keeps bold, italic and dim in a TTY |
| T-i2 | Rendered NO_COLOR messages, labels, bars, error prefix and status; bold and italic remain without colour codes |
| T-k | Home, messages and status fit 30 columns; full-screen rendering does not throw at 8 rows |
| Clipboard | Injected copy operation returns success or a readable error; no real clipboard is touched |
| Ctrl+O | Fake VISUAL round-trip, terminal stop/restart, temporary-file cleanup, focus restoration and failed-editor input preservation |
| Regression | All existing suites pass, with app document inspection and status/key expectations aligned to the specified presentation changes |

The external offline acceptance run passed **19 checks, 0 failures**:

```bash
bash ../acceptance/run-v1-acceptance.sh --auto-only --repo "$PWD"
```

Its record identifies this checkout, branch `009-ui-polish`, commit `f93db2a`, and this checkout's
`packages/tui/dist/cli.js` command:
`../acceptance/results/v1-acceptance-20261020-050410.md`.

No `.env`, real API key, live provider, local model, GPU or real editor was used. App tests use
temporary homes. The external acceptance script uses external sample resources without committing
them. No dependency or lockfile changes were made, and installation scripts stayed disabled.

## Deferred tests

No planned automated tests were deferred. T-j is manual by design: terminal emulation for wheel,
selection/copy and restoration is not duplicated from pi. Owner verification is still pending.

## Deviations from spec or plan

Automatic light/dark palette selection (T012) is deferred as explicitly allowed. It requires
asynchronous terminal colour queries, palette state and invalidation of already rendered
components, beyond the cheap optional refinement requested by the plan. The specified dark
ANSI palette and colour-only NO_COLOR support are implemented.

Implementation details are recorded in [questions.md](./questions.md). The simulated reply
adapter now accepts asynchronous factories because the planned delayed-response tests need them;
pi's faux provider already supports that mechanism.

## Open questions

No unanswered behaviour questions. Automatic light/dark support remains deferred, not an
unresolved implementation choice.

## Demo notes for the owner

Launch the app, press Enter, add a key with `/apikey`, then cancel or select in the model picker.
Use `/characters` and `/persona`, send a message containing quoted speech and an action, and
try Ctrl+O to compose a longer message. Scroll or search a longer conversation with PgUp/PgDn,
Ctrl+Home/Ctrl+End and Ctrl+Shift+F. See [quickstart.md](./quickstart.md) for the complete workflow.

## Development tool and token usage

See [development-usage.md](./development-usage.md). Platform-reported total development tokens:
**unknown**; no run total is exposed in this session.

## Convergence

Assessment covers 10 functional requirements, 4 success criteria, 20 numbered user-story
acceptance scenarios, 5 edge cases, research decisions R1-R7, all 15 tasks, the 7 constitution
principles and applicable technology/testing constraints. The owner-only visual and terminal
checks remain manual.

**Outcome: converged.** Both the implementation's T014 assessment and the additional
owner-requested convergence pass found zero actionable gaps. Counts by gap type (missing,
partial, contradicts, unrequested) and severity are all zero. No convergence task was appended.
The convergence passes themselves did not alter existing tasks; the implementation workflow
marks the original T013-T015 complete as part of finalizing the phase.

Evidence includes the live/resumed MessageView path, sanitized dialogue pipeline, every waiting
cleanup path, current-model preselection, persona refresh, split fixed layout and injected
clipboard adapter test. The existing full suite and external acceptance checks pass.

No `.specify/extensions.yml` exists; implementation and convergence hooks were skipped.

## What the owner should check manually

- Start after existing shell output: the home screen is clean and shows the logo when it fits.
- Wheel and keyboard scrolling move only the transcript. The input and both status components
  remain fixed. Search works using the documented keys.
- Drag to select, release to copy, and paste elsewhere. Confirm a useful error when the platform
  cannot copy. With `"mouse": false`, confirm the terminal's own selection works.
- Inspect equal-weight speaker labels, colour differences, left bars, dialogue, action italics,
  error styling and message spacing in the owner's terminal.
- Resize while streaming and while scrolled away from the latest message. Confirm reflow and
  usable scrolling. Shrink below 40 columns and 10 rows, on home and in chat, and enlarge again.
- Quit with Ctrl+C and `/quit`, and exercise an error exit: previous shell content, cursor and
  terminal input settings must be restored.
- Run with `NO_COLOR=1`: labels stay bold and actions italic; bars and error prefixes remain clear.
- Try Ctrl+O with a real editor on the owner's OS and confirm input and terminal restoration.
