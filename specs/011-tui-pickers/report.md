# Implementation Report: Pickers Instead of Ids

## Summary

The in-app commands use pickers instead of typed ids. `/show` searches all library items and
prints the selected item's details. `/lorebooks` lists embedded, attached, unattached and missing
books, toggles attachments, and imports and attaches lorebooks through the existing rooted file
browser. `/chat`, `/attach` and `/detach` are removed from dispatch, completion and help. Shell
subcommands keep their existing behavior.

`/new` starts a new chat with the current character, clears an innkeeper conversation, explains
how to choose a mode, or refuses to act while a reply is streaming. Previous chats containing
messages remain saved and resumable. Chats containing only their greeting are replaced without
being saved, following the owner's Q1 decision and the updated specification.

All application overlay calls use the shared Frame component. Borders handle wide characters
and ANSI text, retain child focus and input handling, and remain visible without color. Frame
reads the terminal height at render time, clips overflowing content and shows an ellipsis while
preserving both border rows. Help wraps its text with pi-tui, scrolls through TraceOverlay and
closes through its onClose callback. The separate helpOpen Esc path is removed.

README and the authorized 006 command contract match the commands. CI runs on pull requests and
pushes to `main`, avoiding duplicate branch-push runs. No dependency or stored data format changed.

## Tasks completed and not completed

**T001–T020 are complete.** There is no remaining application task or unresolved behavior question.
The resumed implementation follows the owner's decisions recorded in T018–T019:

- T009/T018: preserve conversations with messages; replace greeting-only chats without saving.
  No engine storage change was needed. Tests cover both cases and immediate session listing.
- T019: use scrollable help and height-limited frames. Tests cover clipping, the ellipsis,
  complete borders, changing height limits, scrolling and Esc restoration at 60x24.
- T020: align the manual quickstart with when each chat appears in `/sessions`.
- T016: review the final implementation and corrective task chains through convergence.

Phase checkpoints passed build, lint and tests before their commits. Owner visual acceptance and
observing CI on GitHub remain manual follow-up work, as specified by the plan.

## Test results

The final source checkpoint passed:

```text
pnpm build && pnpm lint && pnpm test
Checked 137 files. No fixes applied.
Test Files  63 passed (63)
     Tests  383 passed (383)
```

| Area | Evidence |
|---|---|
| Engine methods | Raw attached ids include missing entries and preserve stored order; clearing a conversation removes earlier messages from the next faux-provider request |
| T-a | Frame widths 80/40, ANSI and CJK alignment, focus/input/invalidation forwarding, long title wrapping and long entry truncation under NO_COLOR |
| T-b | Exact command list; picker commands have no id argument hint or completion |
| T-c | Both library kinds, search, selection and formatted details, Esc, trailing-text explanation and empty library |
| T-d | Entry order and states; attach/detach persistence; immutable embedded book; missing attachment removal; empty lorebook library with/without an embedded book; no-character guidance |
| T-e | Import and attach; already-imported lorebook without duplicates; character import without attachment; damaged and oversized files; outside-root symlink refusal |
| T-f | Fresh greeting/history, old file retained and resumed, resumed character selection, deleted character, innkeeper reset, no selected mode and streaming refusal in both modes |
| T-g | Removed commands with and without arguments give the normal unknown-command message |
| T-h | Picker attachment fires lore on the next faux-provider request; after `/new`, the request has the greeting and only the new user message |
| T-i | Existing import and shared file-validation regression tests pass |
| T-j | Parsed CI YAML with existing `yaml` dependency; asserted `push.branches` equals `["main"]` and `pull_request` is present |
| T018 | Previous chat with messages is listed immediately after `/new` and can be resumed; greeting-only old and new chats are absent from the session picker |
| T019 | Frame clipping retains top/bottom borders and an ellipsis, responds to height changes and handles a two-row limit; at 60x24, help fits, actual terminal writes contain both borders, paging/End/Home work and Esc restores editor focus |
| T020 | Quickstart step 4 now matches the session-listing sequence exercised by the picker tests |
| Command suggestions | Search of non-test TUI source, README and the active 006 command contract finds no obsolete in-app id command suggestions; the historical removal note is allowed |

T-j command, run from `packages/data`:

```bash
node --input-type=module -e 'import fs from "node:fs"; import assert from "node:assert/strict"; import {parse} from "yaml"; const workflow = parse(fs.readFileSync("../../.github/workflows/ci.yml", "utf8")); assert.deepEqual(workflow.on.push.branches, ["main"]); assert.ok(Object.hasOwn(workflow.on, "pull_request")); console.log("T-j passed: push.branches = [main]; pull_request present");'
```

Output:

```text
T-j passed: push.branches = [main]; pull_request present
```

### External acceptance

The required offline acceptance command passed **19 checks, 0 failures** against the completed
application fixes:

```bash
bash ../acceptance/run-v1-acceptance.sh --auto-only --repo "$PWD"
```

Record: `../acceptance/results/v1-acceptance-20261020-161116.md`. External card/lorebook resources
stayed outside the repository and were imported only into temporary data. The suite checks CLI
import/list/show/dry-run behavior without a key or network.

## Deferred tests

No planned automated unit or faux-provider test was deferred for complexity. The symlink test is
skipped on Windows because link creation requires additional privileges there.

Owner visual acceptance at normal width and about 60 columns, with and without NO_COLOR, remains
pending. GitHub CI behavior is locally verified by the workflow check; observing actual runs is
an owner follow-up. No real provider, local LLM, GPU or real editor was launched.

## Deviations from spec or plan

The two initial implementation gaps are resolved by the owner's updated design:

- Greeting-only chats follow pi's existing deferred persistence. The spec now explicitly limits
  preservation to chats with messages. No storage policy was added.
- Help reuses TraceOverlay after wrapping lines to its inner width; Frame clips other overflowing
  panels with an ellipsis. This follows research R1, the frame contract and T019.
- T020 corrects the manual validation guide to match the accepted greeting-only behavior.

The unused command context and completion helpers were removed after the final id-taking
command was removed. Character creation now directs users to `/characters`.

This implementation did not edit the constitution, current spec, plan, research, data model,
contract or requirement checklist. The owner updated design artifacts between implementation
runs. The previous feature's contract changed under T014; quickstart changed under T020.
Historical analysis and development records are retained; this report describes the final state.

## Open questions

None. [questions.md](./questions.md) retains the original observations, the owner's decisions and
how T018–T020 implement them.

## Demo notes for the owner

Use a temporary home as described in [quickstart.md](./quickstart.md). Try `/show` with a name
filter; select Alice through `/characters`; toggle Wonderland in `/lorebooks`; import a lorebook
there; send a message, then use `/new`. The previous conversation is immediately available in
`/sessions`. The new chat is listed after its first message; greeting-only chats are not saved.

Open `/help` in a 60x24 terminal, page through the text and use End/Home. The frame stays complete,
and Esc returns to the editor. Tall non-scrollable panels show an ellipsis within their border.

Release 0.1.1 is an owner action after merge, using staged npm publishing. This run did not push,
open a pull request, tag or publish anything.

## Development tool and token usage

See [development-usage.md](./development-usage.md) and the conversation's individual tool-call
records. Total platform-reported development token usage: **unknown**; no estimate is substituted.
No `.env` or real user home/settings were read or used. Generated test data used temporary homes.
The external acceptance run required a scoped sandbox escalation to write its result; commits
required escalation because `.git` is read-only in the default sandbox. Normal gitleaks and lint
hooks ran for each commit; no hook was bypassed.

## Convergence

The resumed review checks 11 functional requirements, 5 buildable success criteria, 25 user-story
acceptance scenarios, 9 edge cases, decisions R1–R8, all original and corrective tasks, and all
7 constitution principles plus applicable technology/workflow/testing constraints.

T018–T019 close the original HIGH and MEDIUM partial gaps under the owner's updated design. The
next review found one MEDIUM partial validation-guide gap and appended T020 under Phase 10.
After that correction, the final review has no remaining actionable findings. No empty
convergence section is appended when the result is clean.

No `.specify/extensions.yml` exists; implementation and convergence hooks are skipped.

## What the owner should check manually

- Follow all seven manual quickstart steps using a temporary home.
- Check each overlay's border, title, focus and Esc behavior at normal width and about 60 columns,
  with and without NO_COLOR. Include long character names and help scrolling at 24 rows.
- Confirm search/details, lorebook states and import-and-attach messages, fresh chat greeting,
  preserved/resumable conversations, greeting-only replacement and innkeeper reset.
- Observe CI on pull requests and `main` after pushing. Release 0.1.1 after merge and review.
