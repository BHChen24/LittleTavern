# Implementation report: 007-character-creator

## Summary

`/new-character` opens the contracted Markdown template in `$VISUAL`, `$EDITOR`, or the platform default. The terminal resumes after the editor exits. Existing drafts appear in a picker with a choice to continue or start a new character.

The parser keeps field text and macros, removes explanatory comments, and builds a V3 JSON card with LittleTavern creation metadata and optional embedded lore. Cards are saved under the import root and imported through the existing `importFile` path. Failures keep the draft; a successful import removes it. An unchanged template is cancelled and kept.

`littletavern create <file.md>` provides the same creation path for scripts and always retains the supplied source file. Reports show the character name, id, creation provenance and warnings.

## Tasks completed and not completed

T001–T015 are complete. T012–T015 were appended by convergence. No tasks or planned tests were deferred.

## Test results

Every phase checkpoint passed `pnpm build && pnpm lint && pnpm test` before its commit. Final results:

```text
pnpm build && pnpm lint && pnpm test
Checked 99 files. No fixes applied.
Test Files  40 passed (40)
     Tests  237 passed (237)
```

| Area | Coverage |
|---|---|
| T-a | Exact contracted template; every field; explanation removal; CJK, macros, long text and inner whitespace; required name; duplicate, missing and unknown sections; lore metadata and inert-entry warning |
| T-b / T-c | V3 mapping and provenance; safe Unicode filenames, emoji fallback, length and uniqueness |
| T-d | Normal import and original-byte preservation; identical file re-import; unique output names; keep-source option; unchanged, invalid and unreadable drafts; card-write and import failures |
| T-e | Fake VISUAL with arguments and a spaced draft path; EDITOR fallback; missing program; nonzero exit |
| T-f | CLI creation, report and warnings; source retention; missing name and invalid argument count |
| T-g / T014 | Fake VISUAL app creation through the focused no-key prompt; no accepted API key or saved credentials; terminal stop/restart; library listing; continuation picker; retained draft; successful continuation; greeting in chat |
| T-h | Created embedded lore with always-on and keyword entries; dry-run trace equals a faux-provider chat trace; greeting macro expansion and simulated reply |
| Convergence | Whitespace-only fields and lore content, including CRLF and end-of-file; source-language enforcement excluding tests and synthetic fixtures; repeated unknown sections with identical or mixed-case headings; duplicate known sections still rejected |

A separate smoke check called the compiled CLI handler in a temporary `LITTLETAVERN_HOME`: create, source retention, library listing, JSON lore dry-run, identical re-import, and exit code 1 for a missing name all passed. The temporary home was removed. Spawning a nested CLI process was blocked by sandbox EPERM, so this check called the compiled handler directly and asserted its return codes.

No real editor, local model, GPU, live provider or `.env` was used. No dependencies were added. The real `~/.littletavern` was not accessed.

## Deferred tests

None. T-g reused the existing terminal and overlay test pattern with a small harness, below the task's approximate 60-line harness limit.

## Deviations from spec or plan

- This checkout contains 006's design artifacts but lacks its implementation. Added only the two import path fields needed by 007, using 006 research R2: default `~/.littletavern`, or `<LITTLETAVERN_HOME>/import` with an override. Added a minimal `COMMANDS` table for the creator and consumed it in existing app help. The rest of 006, including the home screen and autocomplete, remains outside this run.
- Duplicate known section headings produce an error and preserve the draft, avoiding silent replacement of field content. Unknown sections are ignored with a warning for each occurrence, including repeated or mixed-case headings.
- Safe filenames trim boundary hyphens before applying the empty-name fallback. The helper accepts and returns filenames with `.json`.
- The pinned pi 1.3.0 source uses asynchronous `spawn`, whereas research R1 explicitly calls for `spawnSync`. This implementation follows R1. Windows real-editor behavior remains for manual verification because pi documents a Windows console-input concern with synchronous spawning.
- The language guard allows Latin script, common punctuation/symbols and combining marks; it rejects other scripts in application source while allowing non-Latin test data. It checks scripts rather than attempting natural-language identification.

The no-key prompt forwards `/new-character` through the existing `app.ts` command handoff, which already runs local creation before the API-key guard. No application handler change was needed. The regression uses the focused prompt instead of calling `submit()` directly.

## Open questions

Implementation ambiguities and conservative choices are recorded in [questions.md](./questions.md). No unanswered question blocks the implemented scope. The incomplete 006 baseline is recorded above for the owner's review.

## Demo notes for the owner

Run `/new-character`, fill in Name and First message, and save. Use the displayed `/chat <id>` hint. Add a `###` lore entry with `Keys: tea` and another with `Always on: yes` to try the lore trace.

For scripting, run `littletavern create /path/to/character.md`. The source remains in place, and the generated card is under the characters import folder.

## Development tool and token usage

See [development-usage.md](./development-usage.md). Platform-reported total development tokens: **unknown**; no total is exposed by the platform in this session.

## Convergence

Checked 8 functional requirements, 3 buildable success criteria, 15 acceptance scenarios, 6 edge cases, research decisions R1–R3, seven constitution principles and the Language constraint. SC-001's three-minute owner workflow remains a manual usability check.

| Task | Finding | Resolution |
|---|---|---|
| T012 | Partial, medium: a final whitespace-only field was not emptied as R2 requires | Added blank-only handling and regressions for fields, lore and CRLF |
| T013 | Missing, medium: constitution's automated source-language check was absent | Added the guard without a dependency |
| T014 | Partial, high: the no-key prompt treated `/new-character` as a key | Forwarded the command through the existing app handoff; tested creation via the focused prompt with a fake editor, no key and no credentials file |
| T015 | Contradicts, medium: repeated unknown sections caused a duplicate error | Ignored unknown sections before checking duplicates; tested identical and mixed-case headings while preserving known-section rejection |

Re-check after implementation and the full gate: converged, with no remaining implementation findings. No `.specify/extensions.yml` exists, so implement and converge extension hooks are skipped.

## What the owner should check manually

Follow [quickstart.md](./quickstart.md) using the existing chat entry screen in this checkout:

1. Start without a key, run `/new-character` from the key prompt, and create with a real editor. Check terminal restoration, the report and greeting. Chat generation still requires a key.
2. Trigger a lore keyword and inspect `/trace`.
3. Close an unchanged template and confirm cancellation.
4. Save without a name and reopen the retained draft through the picker.
5. Check the generated V3 JSON card in the characters import folder.
6. If running on Windows, verify the chosen editor receives console input correctly.
