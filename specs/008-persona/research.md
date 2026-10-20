# Research: Personas

Verified on 2026-10-20 against branch `007-integrated` and the SillyTavern notes
(`../sillytavern-analysis/analysis/03-prompt-assembly.md`, the default `prompt_order`).

## R1. Position follows SillyTavern's default order

SillyTavern's default preset orders the prompt as
`main → worldInfoBefore → personaDescription → charDescription → …`. In LittleTavern's 003
pipeline (`packages/engine/src/assembly/assemble.ts`), this means adding one `addSystemPart`
call, with source `"persona"`, between `lore-before` (line ~49) and `description` (line ~50). The
`TracePart` source union in `assembly/types.ts` gains `"persona"`.

## R2. The assembly input carries the persona

`AssemblyInput` gains `persona?: { name: string; description: string }`. The rules:

- when `persona` is set, `names.user` is `persona.name`;
- otherwise `names.user` is `input.userName ?? DEFAULT_USER_NAME`, which is unchanged;
- the persona part is added only when the description is non-blank.

The assembly stays pure. 004's `assembleForCharacter` reads the active persona and passes it in,
and so does `greetingFor`, so that `{{user}}` in greetings uses the persona name.

## R3. Reusing 007's parser and editor flow

- **Parser**: extract the `##` section splitting from `parseCharacterTemplate`
  (`packages/data/src/cards/template.ts`) into an exported
  `parseMarkdownSections(text) → Map<lowercased heading, text>`. Both the character template and
  personas use it. This is a small refactor, and 007's tests must stay green.
- **Editor**: 007's `openInEditor`, and its `tui.stop()`/`tui.start()` pattern in `app.ts`, are
  reused for New and Edit. A new persona starts as a draft in `<importRoot>/drafts/` and is moved
  into `personas/` once it parses, which is the same draft-safety rule as 007.

## R4. Storage and listing

- **Paths**: `paths.ts` gains `importPersonasDir = join(importRoot, "personas")`, and
  `ensureImportFolders` creates it.
- **Listing**: `listPersonas(paths)` reads every `*.md` file and returns
  `{ file, name, description } | { file, error }`, sorted by name.
- **Active persona**: `readActivePersona(paths)` resolves `settings.persona`. A missing file or a
  parse error returns `null` and a notice (FR-008).
