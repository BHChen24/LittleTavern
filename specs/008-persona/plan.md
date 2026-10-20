# Implementation Plan: Personas

**Branch**: `008-persona` (stacked on `007-integrated`) | **Date**: 2026-10-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/008-persona/spec.md`

## Summary

Personas are Markdown files in `<importRoot>/personas/`, written and edited in `$EDITOR` through
007's flow. `/persona` picks the active one, and the choice is stored in settings. The 003
assembly takes an optional persona: its name becomes `{{user}}`, and its description becomes a
`persona` part between `lore-before` and `description`, which is SillyTavern's default order.
Without a persona, output is byte-identical to today.

## Technical Context

**Language/Version**: TypeScript 7, Node 26

**Primary Dependencies**: none new.

**Storage**: persona files under the import root; `settings.json` gains `persona`.

**Testing**: Vitest. Editor flows use a fake `VISUAL` script, as in 007.

**Project Type**: `data` (paths, parser extraction, persona listing), `engine` (assembly input and
order, `assembleForCharacter`, greeting) and `tui` (`/persona` picker).

**Constraints**:

- The assembly stays pure.
- Without a persona there is no change in output (SC-003).
- English-only template text (constitution 3.1.0).

**Scale/Scope**: about 3 new files and small edits to 6 existing ones.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

Checked against constitution 3.1.0.

| Principle | Status | How |
|---|---|---|
| I. Build on pi, own the context | Pass | The persona is a context part owned by our assembly |
| II. Wrap pi behind our types | Pass | No pi types are involved |
| III. Mechanism, not policy | Pass | Fixed position, literal text, fallbacks that are visible |
| IV. Lossless ecosystem data | Pass | Persona files are the owner's own Markdown and are never rewritten |
| V. SDD development usage accounting | Pass | Recorded in `specs/008-persona/development-usage.md` |
| VI. MVP first | Pass | Only the default position; no binding, no avatars |
| VII. Understandable over clever | Pass | Reuses 007's parser (extracted) and editor flow |
| Language (3.1.0) | Pass | The template is in English |
| Testing policy | Pass | See the Test Plan below |

## Project Structure

```text
packages/data/src/paths.ts                 # + importPersonasDir; ensureImportFolders creates it
packages/data/src/cards/template.ts        # extract parseMarkdownSections (R3); parseCharacterTemplate uses it
packages/data/src/personas.ts              # PERSONA_TEMPLATE, parsePersona, listPersonas, readActivePersona, createPersonaFromDraft
packages/data/src/settings.ts              # + persona?: string | null
packages/engine/src/assembly/types.ts      # AssemblyInput.persona; TracePart source "persona"
packages/engine/src/assembly/assemble.ts   # persona part and {{user}} (R1, R2)
packages/engine/src/character-chat.ts      # assembleForCharacter and greetingFor pass the active persona
packages/tui/src/commands.ts               # + /persona
packages/tui/src/app.ts                    # persona picker, New/Edit via openInEditor, one-time notices
```

## Test Plan (complexity-assessed)

| # | Test | Complexity | Decision |
|---|---|---|---|
| T-a | `parseMarkdownSections` extracted; all 007 template tests still pass | low | **existing tests** plus one direct test |
| T-b | `parsePersona`: name and description, explanations removed, missing name → error | low | **write** |
| T-c | `listPersonas`: sorted, invalid files reported, same-name files both listed | low | **write** |
| T-d | `readActivePersona`: none, valid, missing file → notice, invalid → notice | low | **write** |
| T-e | Assembly: the persona part sits between `lore-before` and `description`; `{{user}}` is the persona name; an empty description adds no part; without a persona the output deep-equals the old output (SC-003) | low | **write** |
| T-f | `assembleForCharacter` and `greetingFor` use the active persona; a dry run shows the `persona` part | low | **write** |
| T-g | `/persona` picker with a fake `VISUAL`: New creates a file, selecting it saves the setting, Edit reopens the file, "No persona" clears it | medium | **try**; defer if the harness needs more than about 60 lines |

## Complexity Tracking

No violations.
