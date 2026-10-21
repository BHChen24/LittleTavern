# Implementation Report: Chat Editing

## Summary

`/undo` takes back the last player message and its reply, returning the player's text to the
input. It also handles failed sends with no reply and repeated undo back to the greeting or
an empty history for cards without greetings.

`/edit` opens a searchable message picker, newest first, excluding the greeting. Selecting a
message loads its full text into the input and displays save/cancel instructions. A saved
player edit resends from that point after the existing setup and spend checks. A saved
character edit replaces the reply without a request. Both drop later messages from the
active branch while preserving the earlier session records.

Esc cancels without writing. Empty edits remain pending. Autocomplete is disabled during
editing, so slash prefixes stay literal and Esc always cancels; completion returns after
save or cancel. Unchanged character submissions are no-ops, preserving later messages,
interrupted markers and the previous-reply slot, as the updated spec requires.

The transcript, subsequent request and reopened session follow the edited/undone branch.
Paid requests remain in the ledger and run totals. Undo and character edits preserve the
last-request trace. Commands refuse outside character chats and during streaming.

## Tasks completed and not completed

T001–T013 are complete. No implementation task or behavior question remains. Owner visual
acceptance remains manual follow-up work.

| Phase | Commit | Validation |
|---|---|---|
| 1: history entry IDs | `bc80019` | Build/lint, 427 tests passed |
| 2: undo | `26df3d7` | Build/lint, 436 tests passed |
| 3: editing | `959739c` | Build/lint, 455 tests passed |
| 4: command limits | `dd427db` | Build/lint, 461 tests passed |
| 5: restart happy path and docs | `b3cc649` | Build/lint, 462 tests passed |

The early private-helper lint warning disappeared when the planned edit methods began using
the helper in phase 3. Later checkpoints have no lint warnings.

## Test results

The final phase 6 checkpoint passed:

```text
pnpm build && pnpm lint && pnpm test
Checked 140 files. No fixes applied.
Test Files 65 passed (65)
Tests 462 passed (462)
```

| Area | Evidence |
|---|---|
| T-a | Stored messages have distinct entry IDs; greeting has none; IDs match reopened history |
| T-b | Full/reply-less/repeated undo, greeting-only refusal, no-greeting session-info copy, reopen and send again, previous-reply slot cleared, regenerate after undo, streaming refusal |
| T-c | Resend turn 2 of 3, edited text in the request with dropped turns absent, invalid/wrong-role/old-branch IDs refused, failed edited message retained and retried, reopen and all original file bytes retained |
| T-d | Character edit drops later turns without sending, subsequent request uses the edited reply, interrupted mark removed, invalid IDs refused, trace retained, regenerate replaces the edit and `/prev` restores it |
| T-e | Undo restores input, re-renders history, explains empty/no-chat/innkeeper states and refuses streaming |
| T-f | Picker order, speaker labels, full-text search including later lines, greeting absent, full text loaded, no-message/no-chat/innkeeper states |
| T-g | Banner, Enter saves both roles, unchanged player resend, unchanged character no-op including later messages/interruption/restore slot, blank refusal, literal `/un` through real editor input, Tab suppressed, completion restored after save/Esc, Esc preserves file bytes, Ctrl+R blocked, spend Stop/Continue, actual Ctrl+R retry after failed edit |
| T-h | Synthetic Alice chat, two sends, undo and correction, edit the first reply, quit, create a new app on the same temporary home, resume through `/sessions`, compare the rendered transcript and history |
| US3 | Both commands refuse character/innkeeper streaming through both `submit()` and actual terminal Enter; undo and both saved edit roles clear `/prev` after a regenerate |
| Usage/persistence | App tests preserve the paid usage ledger and displayed cost on undo/character edit; player resend adds a request. Engine tests verify complete original session bytes remain as a prefix after undo and either edit |

### External acceptance

The required offline suite passed **19 checks, 0 failures**:

```bash
bash ../acceptance/run-v1-acceptance.sh --auto-only --repo "$PWD"
```

Record: `../acceptance/results/v1-acceptance-20261020-214617.md`. It uses a temporary app home,
no API key and no network. External sample cards remain outside the repository; committed
tests generate synthetic fixtures.

## Deferred tests

No planned automated test was deferred for complexity. As specified in the plan, actual
Ctrl+C in a real terminal during an edit and the appearance of the picker/banner remain
owner manual checks. Automated tests verify that unsaved editing and Esc leave the saved
file's bytes unchanged.

## Deviations from spec or plan

No behavioral deviation. The implementation follows the updated artifacts that resolved
the historical analysis findings. Routine implementation details are recorded in
[questions.md](./questions.md).

The first attempted targeted test could not resolve an unbuilt workspace dependency; building
the workspace resolved it. Required checkpoint failures during development were corrected
before commits. Normal gitleaks, lint and commit-message hooks ran on each checkpoint.

No constitution, current spec, plan, research, data model, message contract, checklist or
quickstart was edited. The shared 006 command contract was updated under T010. No dependency
was added. No reference tree was modified.

## Open questions

None.

## Demo notes for the owner

Follow [quickstart.md](./quickstart.md) with a temporary app home. Undo a turn and correct it,
edit an earlier player message and then a character reply, and resume through `/sessions`
after restarting. Observe the banner and picker at normal and narrow terminal widths.
An unchanged character edit intentionally keeps the current branch untouched.

## Development tool and token usage

See [development-usage.md](./development-usage.md) and the individual tool invocations in the
conversation. Total platform-reported development token usage: **unknown**. No estimate is
substituted. No `.env`, real app home/settings, real provider, real editor, local LLM or GPU
was used.

Scoped sandbox escalations allow the task-required feature-branch commits in the worktree's
external Git metadata and the offline acceptance result write. Hooks were not bypassed.
No push, tag, publication or pull-request operation was performed.

## Convergence

T012 checked all 13 functional requirements, 4 success criteria, 17 acceptance scenarios,
12 edge cases, research decisions R1–R6, the 13 tasks, and all 7 core constitution principles
plus applicable stack, testing and workflow constraints.

Outcome: **converged**, with zero missing, partial, contradicting or unrequested findings.
The convergence assessment left `tasks.md` byte-for-byte unchanged; its before/after SHA256
was `4602eebf02357563e12096496c4765cc7d6eade2953a8fcf7bcdd28c32068230`. No empty
convergence phase was appended. The implement workflow updated completion markers afterward.

No `.specify/extensions.yml` exists, so implementation and convergence hooks were skipped.

## What the owner should check manually

- Follow all nine manual quickstart steps with a temporary app home.
- Check picker order/search, focus, long/multi-line text and the banner at normal/narrow widths.
- Check that repeated undo reaches the greeting, and a further undo explains there is nothing
  to undo.
- Check Enter resends player edits, saves character edits without a request, and Esc cancels.
- Check literal `/un` and Tab produce no completion during editing; `/` completes again afterward.
- Check restart/resume after edits and Ctrl+R regeneration of the edited reply.
- Check the streaming wait notice and the innkeeper explanations for both commands.
- Change a draft during `/edit`, quit with Ctrl+C and resume: the saved chat is unchanged.
