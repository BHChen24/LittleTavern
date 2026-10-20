# Implementation report: 006-usability

## Summary

The chat editor suggests commands and their arguments from one command table, which also
produces `/help`. `/import` opens a filtered file browser when no path is supplied. Launching
shows a home screen; Enter opens the chat. API-key entry happens only through `/apikey`, with
session-only use selected by default. Messages sent without a key remain in the editor.

The chat transcript labels users, characters and notices, with the status bar after the editor.
An automated source-language check enforces the constitution's CJK-script restriction.

## Tasks completed and not completed

T001–T017 are complete. T015–T017 were appended by convergence and completed before the final
report, as required by T013. Every implementation phase was checked and committed separately;
the convergence correction commit precedes the final Phase 7 report commit.

## Test results

```text
pnpm build && pnpm lint && pnpm test
Checked 99 files. No fixes applied.
Test Files  41 passed (41)
     Tests  241 passed (241)

bash ../acceptance/run-v1-acceptance.sh --auto-only
19 passed, 0 failed
```

| Area | Verification |
|---|---|
| Paths | Override and default resolution, creation, preservation of existing files, failed creation notice |
| Commands | Contracted names and descriptions in help, fresh library reads, item kinds, name/id filters, attached-only detach, supported path completions |
| Editor | Real slash popup, narrowing, Tab completion, Esc preserving text, middle-of-message slash exclusion |
| Browser | Ordering, parent navigation, filtering, supported extensions, symlink folders, non-Latin filenames, missing directory errors, 250 files |
| Home | Content with/without a key and empty/nonempty library, Enter, Ctrl+C |
| API key | No automatic prompt, missing-key send/regenerate and Ctrl+R interception, masked input, session-only default, explicit save at 0600, forget visibility, environment rules, cancellation, rejected-key notice, legacy redirects |
| Persistence | Session-only key absent from all files under the isolated home after quit; existing ledger/log redaction tests retained |
| Layout | User/character/assistant labels, notice prefix, status last, exactly the editor's two borders |
| Language | Every package's non-test TypeScript source, excluding fixtures.ts, checked for the specified CJK scripts |

The external acceptance script hardcodes another checkout. Temporary PATH wrappers routed its
build and CLI commands to `LittleTavern-006` on `006-usability`; the script was not edited. Its
result file's branch metadata still names the hardcoded sibling checkout. The run record is
`../acceptance/results/v1-acceptance-20261020-014201.md`.

## Deferred tests

None of T-a through T-j were deferred. The real-editor test fit within the requested harness
limit. Live-provider calls were not run; all application tests use the simulated provider or
send no request. Final subjective visual acceptance remains with the owner.

## Deviations from spec or plan

- The requested `pnpm dev` smoke check was performed by launching the same built CLI directly:
  `pnpm dev` loads `.env`, which this run explicitly forbids reading or using.
- The external acceptance runner used temporary command wrappers to test this checkout rather
  than the sibling checkout it hardcodes. No external script was edited.
- Long save paths are repeated in wrapping explanatory text because pi's selection list clips
  long labels. The contracted choice labels and session-only default are retained.

## Open questions

No blocking questions. Conservative resolutions are recorded in [questions.md](./questions.md).

## Manual terminal observations

Ran the built CLI in an isolated PTY with a temporary `LITTLETAVERN_HOME` and no environment
key. Used a synthetic Mira card. The home screen showed the description, Enter and slash hints,
missing-key status and both drop folders. Enter focused the chat editor. Typing `/import` showed
its completion; the browser opened, filtering selected `characters/` then `mira.json`, and the
usual import notice appeared. `/chat <id>` showed `Mira:` and the greeting. Sending `hello`
showed the `·` missing-key notice, left `hello` in the editor, and sent nothing. The status bar
followed the editor's lower border; there was no extra separator or large blank area. Ctrl+C
exited with code 0. User/reply labels are also checked with the simulated provider in tests.

`pnpm dev` was not invoked because its script loads `.env`. The equivalent built CLI was
launched directly; see [questions.md](./questions.md). Final visual acceptance remains owner-side.

## Guided acceptance changes

The owner should update `../acceptance/run-v1-acceptance.sh`; this run did not edit it.

1. **Session 1, step 1 and its result question**: expect the home screen, version, description,
   Enter and slash hints, key status and empty-library import folders. Verify no key prompt
   opens. Press Enter to enter the chat. Check Ctrl+C from home in a separate launch.
2. **Before session 1, step 2**: send a message without a key. Verify the `/apikey` notice and
   preserved draft. Run `/apikey`, select the sole provider OpenRouter, then paste the key into
   the masked input.
3. **Session 1, step 3 and its result question**: expect "Use for this session only" first and
   preselected, plus the explicit Save choice and complete destination. Select Save deliberately
   if continuing the existing saved-key/restart checks. Add a separate session-only run: accept
   the default, quit, relaunch and verify no key is configured.
4. **Before authenticated chat in session 1**: add command-discovery checks: `/` shows command
   descriptions, `/cha` can be completed, and `/chat ` offers character names that insert ids.
5. **Add browser import checks**: put a sample under the displayed import characters folder;
   run `/import`, open the folder and select it. Check the normal report, unchanged source file,
   filtering, empty-folder hint, and Esc cancellation. Retain `/import <path>` coverage.
6. **Session 1, step 14**: also check `You:`, the character name or `Assistant:`, italic `·`
   notices, the last-line status bar, compact spacing and absence of an extra separator.
7. **Session 2, step 16**: expect the home screen with `API key: saved`, then Enter into chat;
   it must not ask for a key automatically. With session-only use it should instead show the
   missing-key status on restart.
8. **Session 2, step 19 and its result question**: replace `/forget-key` with `/apikey` →
   OpenRouter → Forget saved key. Expect a notice and updated key status, with no automatic key
   input. Check `/key` and `/forget-key` separately for replacement notices.
9. Retain the guided files-on-disk permission/leak checks after explicitly saving a synthetic or
   owner-supplied key. The 19 automated import/dry-run checks require no content changes.

## Convergence

Assessed 15 FRs, 5 SCs, 30 acceptance scenarios, 6 research/plan decisions, existing tasks and
7 constitution principles, including language, test isolation and usage accounting.

| Task | Finding | Resolution |
|---|---|---|
| T015 | HIGH partial: save destination clipped in narrow selection lists | Wrapping full destination text; active key source also shown in the action picker; regression test |
| T016 | MEDIUM partial: specified import edge cases lacked focused verification | Tests for 250-file filtering and an import-root file while explicit-path import still works |
| T017 | MEDIUM partial: lifecycle and shortcut coverage incomplete | Ctrl+R draft preservation and post-quit session-key leak scan |

Rechecked the resulting behavior: no remaining implementation gaps. No extension hooks were
registered (`.specify/extensions.yml` is absent).

## Demo notes for the owner

Use [quickstart.md](./quickstart.md) for the new flow. The default import root is
`~/.littletavern`; with `LITTLETAVERN_HOME`, it is `<LITTLETAVERN_HOME>/import`. A browser with
one card in `characters/` needs Down, Enter, Down, Enter after opening `/import` to import it.
Nothing is moved or deleted from the drop folders.

## Development tool and token usage

See [development-usage.md](./development-usage.md). Platform-reported total tokens: **unknown**.
No dependency was added, no live tests or local LLM ran, and `.env` was never read or used.

## What the owner should check manually

Follow the guided acceptance changes above, especially the feel of suggestions, keyboard
navigation, masked key entry/save choice, and layout at the owner's normal terminal size.
