# Implementation report: 008-persona

## Summary

`/persona` lists Markdown personas with the active choice marked and filenames to distinguish
duplicate names. New and Edit use the existing external-editor flow. New personas activate
after creation, selection persists across launches, and No persona restores the existing user
name fallback. Invalid files remain visible but cannot be selected.

Personas live in `<importRoot>/personas/`; drafts live in `drafts/personas/` so they never appear
as character drafts. Successful creation preserves the original bytes and chooses a unique safe
Markdown filename. Cancellation and errors retain drafts and show their paths.

The active name replaces `{{user}}` in greetings, all prompt parts, lore keys, scanned messages
and lore content. A nonblank description appears between before-lore and character description.
The trace and dry run include a `persona` part with estimated tokens. Missing or invalid active
files fall back with a named notice, emitted once per CharacterChat. Name-only personas add no
description part.

## Tasks completed and not completed

T001–T011 are complete. Convergence found no remaining work and appended no tasks. No planned
tests have been deferred.

## Test results

Each implementation phase passed `pnpm build && pnpm lint && pnpm test` before its commit.
The final automated gate passed:

```text
pnpm build && pnpm lint && pnpm test
Checked 111 files. No fixes applied.
Test Files  49 passed (49)
     Tests  284 passed (284)
```

| Area | Coverage |
|---|---|
| T-a | Ordered section extraction, duplicate preservation and original heading spelling; all existing 007 parser tests unchanged |
| T-b | Exact contracted persona template, required name, duplicate known headings, comment removal, inner whitespace, macros, Unicode content and empty descriptions |
| T-c | Fresh directory listings, name sorting, same-name files, invalid files, ignored non-Markdown files and directories, absent folder |
| T-d | No selection, null selection, active file, missing or invalid active file and fallback notices |
| T-e / T-e2 | Prompt position, estimated tokens, macro replacement, lore keyword and scanned-message expansion, blank descriptions, immutable input and captured no-persona regression output |
| T-f / T-h | Active-persona greetings, hand-edited names, faux-provider chat request, equal chat/dry-run traces, fallback names and one-time notices for missing and invalid files |
| T-g | Fake VISUAL creation, terminal stop/restart, activation, relaunch persistence, direct file editing, greeting, clearing, duplicate-name filenames, invalid activation rejection and fresh hand edits |
| T-i | Failed persona drafts stay under `drafts/personas/` and are absent from the character continuation picker |
| Paths / settings / creation | Explicit-home persona paths, startup folders, settings validation and merging null clears; original-byte preservation, unique filenames, unchanged and invalid drafts, missing drafts and write failures |

The external offline acceptance run passed **19 checks, 0 failures** using:

```bash
bash ../acceptance/run-v1-acceptance.sh --auto-only --repo "$PWD"
```

Its record identifies this checkout, branch `008-persona`, commit `30fa67d`, and the checkout's
`packages/tui/dist/cli.js` command:
`../acceptance/results/v1-acceptance-20261020-042720.md`.

No `.env`, real API key, live provider, local model, GPU or real editor was used. Application
tests use temporary homes. No dependencies were added.

## Deferred tests

None. T-g reused the existing terminal/overlay pattern with a small fake-editor harness.
Visual behavior and the two-minute owner workflow remain manual acceptance checks.

## Deviations from spec or plan

None affecting behavior. Implementation details are recorded in [questions.md](./questions.md).
The existing safe filename helper accepts an optional extension, retaining `.json` for existing
callers. Persona moves use exclusive copying followed by draft removal to avoid replacing an
existing persona and to retain the authored bytes.

## Open questions

No unanswered behavior questions.

## Demo notes for the owner

Run `/persona`, choose New persona, fill in Name and Description, and close the editor. Create a
second persona and select it. A new chat greeting uses the selected name. Send a message and
open `/trace` to see the persona part. Choose No persona to return to the settings fallback.

For a command-line preview, run `littletavern dry-run <character-id>` after selecting a persona.

## Development tool and token usage

See [development-usage.md](./development-usage.md). Platform-reported total development tokens:
**unknown**; no total is exposed in this session.

## Convergence

Converged with no findings: missing 0, partial 0, contradicts 0, unrequested 0. The assessment
covered 8 functional requirements, 2 buildable success criteria,
13 user-story acceptance scenarios, 6 edge cases, research decisions R1–R4, all tasks, the 7
constitution principles and the applicable technology and testing constraints. SC-001's timed
owner workflow remains a manual usability check.

The convergence assessment made no writes to tasks.md. The implementation workflow then marked
T010 and T011 complete. No `.specify/extensions.yml` exists; implementation and convergence
hooks were skipped.

## What the owner should check manually

Follow [quickstart.md](./quickstart.md): create two personas with a real editor, switch between
them, inspect `/trace`, relaunch and verify the selection persists. Confirm an empty description
changes only the name. Check terminal restoration after the editor closes on the owner's OS.
