---
description: "Task list for 008-persona"
---

# Tasks: Personas

**Input**: Design documents from `specs/008-persona/`

**Prerequisites**: plan.md, spec.md, research.md, contracts/persona.md, quickstart.md

**Tests**: from spec "Acceptance Testing" and plan.md's Test Plan (T-a to T-g).

**Read before starting**:

- `contracts/persona.md`: the file format, the settings key, the command and the prompt order.
- `research.md`, R1–R4.
- 007's `template.ts`, `create-character.ts`, `editor-launch.ts`, and the `/new-character` code in
  `app.ts`. They are the pattern to reuse.

## Rules for this run (unattended)

- **Stay on branch `008-persona`.** Never commit to `main`, and never switch, merge or rebase
  branches.
- **Do not stop to ask, but do not invent behaviour.** Two kinds of question:
  - an *implementation detail* (naming, structure, which pi call to use): choose the simplest
    option that satisfies the spec, and note it in `specs/008-persona/questions.md`;
  - *behaviour the spec, plan or contracts do not define*: do not decide it. Leave the affected
    task unchecked, record the question in `questions.md` for the owner, and continue with the
    other tasks.
- **Tests that are too complex**: record them under "Deferred tests" in the report.
- **Never**:
  - read, print or use `.env`;
  - run `pnpm test:live`;
  - add a dependency;
  - touch the real `~/.littletavern`;
  - launch a real editor in tests.
- **English only** (constitution 3.1.0).
- **Constitution V**: record tool calls and total tokens (or "unknown") in
  `specs/008-persona/development-usage.md`.
- **After each phase**: run `pnpm build && pnpm lint && pnpm test`, then commit with an English
  conventional message and mark the finished tasks `[X]` in the same commit.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Foundational

- [ ] T001 Extract `parseMarkdownSections(text)` from `parseCharacterTemplate` in `packages/data/src/cards/template.ts` per research R3. It returns an **ordered list** `{ title, key, body }[]`, where `title` is the original heading text, `key` is lowercased and trimmed, and duplicates are kept, so that 007's duplicate and unknown-section messages keep the original spelling. Export it, make `parseCharacterTemplate` use it, and add one direct test. All 007 tests must stay green, unchanged (T-a)
- [ ] T002 [P] Add `importPersonasDir` to `AppPaths` in `packages/data/src/paths.ts`, and make `ensureImportFolders` create it. Extend `paths.test.ts`
- [ ] T003 [P] Add `persona?: string | null` to `Settings` in `packages/data/src/settings.ts`. It is validated as a non-empty string, and a merging write can clear it with `null`. Extend `settings.test.ts`

**Checkpoint**: checks pass. Commit.

---

## Phase 2: User Story 1 - Write a persona once (P1)

- [ ] T004 [US1] Create `packages/data/src/personas.ts` with:
  - `PERSONA_TEMPLATE`, the exact text in `contracts/persona.md`;
  - `parsePersona(text)`;
  - `listPersonas(paths)` (research R4);
  - `readActivePersona(paths)`;
  - `createPersonaFromDraft(paths, draftPath)`. It treats an unchanged template as cancelled and
    keeps the draft on error. On success it moves the persona to `personas/<safe name>.md`, using
    007's `safeCardFileName` rules with an `.md` extension, and returns the file name.

  Export these through the engine barrel. Write tests T-b, T-c and T-d in `personas.test.ts`.

**Checkpoint**: checks pass. Commit.

---

## Phase 3: User Story 3 - The persona in the assembly and the trace (P2, done before US2 because US2 depends on it)

- [ ] T005 [US3] In `packages/engine/src/assembly/types.ts`, `assemble.ts` **and `lore.ts`**, apply research R1 and R2:
  - `AssemblyInput.persona?`;
  - the `"persona"` TracePart source;
  - the part placed between `lore-before` and `description`, with macros replaced;
  - `{{user}}` is the persona name **everywhere**: compute the names once (a shared helper) and use them in `assemble.ts` and in `lore.ts:107`, which today reads `input.userName` on its own. This affects lore keys, scanned messages and entry content.

  Write tests T-e, T-e2 and the SC-003 regression check: deep-equal output without a persona, compared with a fixture assembled the same way before this change.

- [ ] T006 [US3] In `packages/engine/src/character-chat.ts`, make `assembleForCharacter` and `greetingFor` read `readActivePersona(paths)` and pass it in. Surface its notice through the existing `notices` channel (one-time in `CharacterChat`). Write tests T-f, including a `dryRun` that shows the `persona` part, and **the happy path T-h**: a simulated `CharacterChat` with an active persona sends a message, and the request the simulated model receives contains the persona description in the right place, `{{user}}` resolved to the persona name, and a `persona` part in `lastTrace`

**Checkpoint**: checks pass. Commit.

---

## Phase 4: User Story 2 - Choose who I am (P1)

- [ ] T007 [US2] Add `/persona` to `COMMANDS` in `packages/tui/src/commands.ts`, with the description "Choose who you are in the story". Update `commands.test.ts` and the command row in 006's `contracts/commands.md`
- [ ] T008 [US2] In `packages/tui/src/app.ts`, open a `ListPicker` from `/persona`.
  - **Entries**: one per persona, with `● ` before the active one. Invalid persona files are shown with their error and cannot be selected.
  - **Actions**:
    - "New persona": a draft from `PERSONA_TEMPLATE` in **`<importRoot>/drafts/personas/`**, a sub-folder, so that `/new-character`, which lists only `.md` files directly in `drafts/`, never offers persona drafts (regression test T-i), opened with `openInEditor` and the `tui.stop`/`tui.start` pattern from `/new-character`, then `createPersonaFromDraft`, which activates the new persona on success;
    - "Edit active persona": opens that file directly;
    - "No persona": sets `persona: null`.
  - **Selecting a persona**: writes `persona` to settings, shows a notice ("You are now <name>"), and applies from the next request.

  Try test T-g in `app-persona.test.ts` with a fake `VISUAL`.

**Checkpoint**: checks pass. Commit.

---

## Phase 5: Polish

- [ ] T009 Run `pnpm build && pnpm lint && pnpm test`, then `bash ../acceptance/run-v1-acceptance.sh --auto-only --repo "$PWD"`, so that the acceptance run uses **this checkout's built CLI** and not an installed command. Check that the record it writes names this branch and commit. Fix any failures
- [ ] T010 Run `speckit-converge` on this feature and complete any appended tasks
- [ ] T011 Write `specs/008-persona/report.md` with the same sections as the earlier reports. Commit

## Dependencies & Execution Order

Phase 1 → 2 → 3 → 4 → 5. **Parallel**: T002 and T003.
