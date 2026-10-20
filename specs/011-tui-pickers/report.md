# Implementation Report: Pickers Instead of Ids

## Summary

The implemented commands use pickers instead of typed ids. `/show` searches all library items
and prints the selected item's details. `/lorebooks` lists embedded, attached, unattached and
missing books, toggles attachments, and imports and attaches lorebooks through the existing
rooted file browser. `/chat`, `/attach` and `/detach` are removed from dispatch, completion and
help. The shell subcommands keep their existing behavior.

`/new` follows the planned implementation: it starts a new chat with the current character,
clears an innkeeper conversation, explains how to choose a mode, or refuses to act while a reply
is streaming. Previous chats containing user messages remain saved and resumable. Greeting-only
chat preservation is not complete; Q1 requires a design decision.

Every application `showOverlay` call now goes through `showPanel` and the shared Frame component.
Frames use the editor's border style, handle wide characters and ANSI text, retain child focus
and input handling, and remain visible without color. Tall help panels can still lose their
bottom border after terminal composition; Q2 requires an overflow policy.

README and the authorized 006 command contract match the new commands. CI runs on pull requests
and pushes to `main`, avoiding duplicate branch-push runs. No dependency or data format changed.

## Tasks completed and not completed

**The feature is partially implemented, not delivered as complete.**

- Complete: T001–T008, T010–T015 and T017 (15 tasks).
- Incomplete: T009, T016, T018 and T019 (4 tasks).
- T009 follows its explicit code plan, but cannot meet FR-007's unconditional preservation
  requirement with pi's current deferred persistence. It stays unchecked for Q1.
- T016 ran convergence and appended T018–T019. It stays unchecked because its instruction also
  requires completing those tasks, which depend on owner decisions.
- T018 and T019 record the two remaining design-dependent gaps.

Completed phases were committed after build, lint and tests passed. The Phase 5 commit includes
its tested implementation and explicitly leaves T009 open. Checklist markers were not changed.

## Test results

The final source checkpoint passed:

```text
pnpm build && pnpm lint && pnpm test
Checked 137 files. No fixes applied.
Test Files  63 passed (63)
     Tests  381 passed (381)
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
| Overlay integration | Help has a narrow-width frame before composition and Esc restores editor focus; existing picker, key, model and trace interactions pass through Frame |
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

The required offline acceptance command passed **19 checks, 0 failures**:

```bash
bash ../acceptance/run-v1-acceptance.sh --auto-only --repo "$PWD"
```

Record: `../acceptance/results/v1-acceptance-20261020-155506.md`. External card/lorebook resources
stayed outside the repository and were imported only into temporary data. This checks existing
CLI import/list/show/dry-run behavior without a key or network; it does not resolve Q1 or Q2.

## Deferred tests

No planned automated unit or faux-provider test was deferred for complexity. Tests for the
selected resolutions to Q1 and Q2 remain pending design, as T018–T019 specify. The existing
symlink test is skipped on Windows because link creation requires additional privileges there.

Owner visual acceptance at normal width and about 60 columns, with and without NO_COLOR, remains
pending. No real provider, local LLM, GPU or real editor was launched.

## Deviations from spec or plan

- The planned call to `startChat(item)` does not preserve a greeting-only previous chat. Research
  R6's claim that starting a chat immediately creates its session file is false for the pinned
  pi version. Storage behavior was not redesigned; T009 remains incomplete.
- Wrapping all child lines does not keep every border visible when the panel exceeds terminal
  height. A 60x24 help check produced 32 rows and no bottom border in actual terminal writes.
  No unplanned clipping or scrolling behavior was added.
- Removed the unused command context and completion helpers after the final id-taking command
  was removed. The character-creation hint now directs users to `/characters`.

The constitution, current spec, plan, research, data model, contract, quickstart and requirement
checklist were not edited. The previous feature's command contract was updated by explicit T014.
The historical `analysis.md` is preserved; this report describes the later implementation state.

## Open questions

See [questions.md](./questions.md):

- **Q1 / T018**: Should chats containing only their greeting be persisted? If so, specify the
  engine storage change; otherwise qualify the preservation requirement.
- **Q2 / T019**: How should panels taller than the terminal preserve their border and readable
  content: scrolling, clipping or another specified policy?

These are behavior decisions for the owner/design side. The implementer has completed the
independent work and has not chosen those policies.

## Demo notes for the owner

Use the temporary-home steps in [quickstart.md](./quickstart.md). Try `/show` with a name filter;
select Alice through `/characters`; toggle Wonderland in `/lorebooks`; import a lorebook there;
send a message, then use `/new` and resume the previous exchange through `/sessions`.

For Q1, select a character and immediately use `/new` before sending anything: the earlier
greeting-only chat is absent from `/sessions`. For Q2, open `/help` in a 60x24 terminal and
inspect the missing bottom border. These are known remaining gaps, not acceptance passes.

Release 0.1.1 is an owner action after merge, using staged npm publishing. This run did not push,
open a pull request, tag or publish anything.

## Development tool and token usage

See [development-usage.md](./development-usage.md) and the conversation's individual tool-call
records. Total platform-reported development token usage: **unknown**; no estimate is substituted.
No `.env` or real user home/settings were read or used. All generated test data used temporary
homes. The external acceptance run required a scoped sandbox escalation to write its result;
phase commits required escalation because `.git` is read-only in the default sandbox. Normal
hooks ran gitleaks and lint for every commit; no hook was bypassed.

## Convergence

T016 assessed 11 functional requirements, 5 buildable success criteria, 23 user-story acceptance
scenarios, 9 edge cases, decisions R1–R8, all 17 original tasks and all 7 constitution principles
plus applicable technology/workflow/testing constraints.

Outcome: **tasks_appended**, with two `partial` findings: F1 HIGH for greeting-only chat
preservation (FR-007 / SC-003 / US3/AC1), and F2 MEDIUM for tall-panel border clipping
(FR-008 / US4/AC1). No `missing`, `contradicts`, `unrequested` or constitution-violation findings
were identified. Appended T018–T019 under Phase 9 without rewriting any original task.

Both tasks require owner decisions recorded in questions.md. There is no claim of convergence.
No `.specify/extensions.yml` exists; implementation and convergence hooks are skipped.

## What the owner should check manually

- Resolve Q1 and Q2 on the design side, then rerun implementation for the unchecked tasks.
- Follow all seven manual quickstart steps using a temporary home.
- Check each overlay's border, title, focus and Esc behavior at normal width and about 60 columns,
  with and without NO_COLOR. Include long character names and narrow help.
- Confirm search/details, lorebook states and import-and-attach messages, new chat greeting,
  preserved/resumable conversations and innkeeper reset.
- Observe CI on pull requests and `main` after pushing. Release 0.1.1 only after merge and review.
