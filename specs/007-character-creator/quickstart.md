# Quickstart: validating 007-character-creator

## Automated

```bash
pnpm build && pnpm lint && pnpm test
```

## Manual (owner)

1. Run `littletavern`, press Enter, then run `/new-character`. Your editor opens the template.
2. Fill in Name, Description and First message, plus one Lorebook entry with `Keys: tea`. Save and close.
3. The report shows the new character and suggests `/chat <id>`. Run it: the greeting is your First message.
4. Send a message containing "tea", then run `/trace`: the entry fired.
5. Check `~/.littletavern/characters/`: the new `.json` card is there.
6. Run `/new-character` and close the editor without changes: it says "Cancelled".
7. Run `/new-character`, write a description but no name, and save. It reports the missing name. Run `/new-character` again: you are offered to continue the draft.
