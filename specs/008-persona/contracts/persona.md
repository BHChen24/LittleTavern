# Contract: Persona files and commands

## File format (`<importRoot>/personas/<file>.md`)

```markdown
<!-- LittleTavern persona. This is you in the story. Fill in the sections, save and close. -->

## Name
<!-- Your name in the story. Used for {{user}}. -->

## Description
<!-- Who you are: appearance, background, how others see you. Sent to the model. -->
```

- The file is parsed with the shared `##` section parser from 007: HTML comments are removed and
  blank lines at the edges are trimmed.
- Name is required.
- New personas are saved as `<safe name>.md`, using the same rules as 007's safe card file names,
  with `-2`, `-3`, … appended if needed.

## Settings

`settings.json` gains `"persona": "<file name>.md"`. The field is absent or `null` when there is no
persona. The existing `userName` stays as the fallback.

## Command

| Command | Effect |
|---|---|
| `/persona` | Opens the picker: every persona (with `● ` before the active one), then "New persona", "Edit active persona" (only when one is active) and "No persona" |

The command is added to the 006 `COMMANDS` table, so suggestions and help pick it up.

## Prompt order (FR-005)

1. main
2. lore-before
3. **persona**
4. description
5. personality
6. scenario
7. lore-after
8. examples
9. history
10. after-history

The trace part source is `"persona"`.

## Command line

`littletavern dry-run` uses the active persona exactly like a chat. There is no new CLI command.
