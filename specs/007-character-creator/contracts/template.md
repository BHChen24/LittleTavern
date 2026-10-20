# Contract: Character Template (Markdown)

This is the file the owner edits. HTML comments (`<!-- … -->`) are explanations and are removed
before parsing. `##` headings name the fields. Matching is case-insensitive, and leading and
trailing blank lines in each section are trimmed.

```markdown
<!-- LittleTavern character template. Fill in the sections, save and close the editor.
     Only "Name" is required. Delete a section's text to leave it empty. -->

## Name
<!-- The character's name. Used for {{char}}. -->

## Description
<!-- Who the character is: appearance, background, situation. -->

## Personality
<!-- How they think, speak and act. -->

## Scenario
<!-- Where and when the story starts. -->

## First message
<!-- The character's opening line. {{user}} and {{char}} are replaced. -->

## Example dialogue
<!-- Optional. Sample exchanges showing their voice. -->

## System prompt
<!-- Optional. Replaces the default instruction to the model. -->

## Lorebook
<!-- Optional. One "###" block per entry. Keys: comma-separated trigger words.
     "Always on: yes" makes the entry always included. The text below is the entry content.

### Example entry title
Keys: lighthouse, harbor
Always on: no
The lighthouse has been dark for ten years.
-->
```

## Mapping to the V3 card

| Section | V3 field |
|---|---|
| Name | `data.name` |
| Description | `data.description` |
| Personality | `data.personality` |
| Scenario | `data.scenario` |
| First message | `data.first_mes` |
| Example dialogue | `data.mes_example` |
| System prompt | `data.system_prompt` |
| Lorebook `###` blocks | `data.character_book.entries[]`: `{ keys, content, constant, enabled: true, insertion_order: <block index>, name: <title> }` |

The card also gets:

- `spec: "chara_card_v3"` and `spec_version: "3.0"`;
- `data.creator_notes: ""`, `data.tags: []`, `data.alternate_greetings: []`;
- `data.extensions.littletavern = { createdWith: "LittleTavern <version>", createdAt: <ISO> }`.

## Command line

`littletavern create <file.md>` turns a filled-in template into a card and imports it. It prints
the import report and exits with 1 on any error. The in-app command is `/new-character`.

## Files

| What | Where |
|---|---|
| Drafts | `<importRoot>/drafts/new-character-<timestamp>.md` |
| Created card | `<importRoot>/characters/<safe-name>.json`; `-2`, `-3`, … is appended if the name is taken |
