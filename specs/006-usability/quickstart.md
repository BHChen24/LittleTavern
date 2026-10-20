# Quickstart: validating 006-usability

## Automated

```bash
pnpm build && pnpm lint && pnpm test
bash ../acceptance/run-v1-acceptance.sh --auto-only    # v1 checks still pass (SC-005)
```

## Manual (owner)

1. Run `littletavern`. The home screen shows the name, "Press Enter to start", "Type / for
   commands" and "No API key yet — use /apikey". Press Enter.
2. Type `/`. Every command is listed with a description. Type `/cha` and press Tab to complete
   `/chat`. Type a space: the characters are suggested.
3. Copy a card into `~/.littletavern/characters/`. Run `/import`, open `characters/`, pick the
   card and check the import report.
4. Send "hello" without a key. The notice points to `/apikey`, and "hello" is still in the input.
5. Run `/apikey`, choose OpenRouter and paste the key. "Use for this session only" is
   preselected; confirm it. Send "hello", which works. Quit and relaunch: the home screen says
   there is no key again.
6. Type `/key`: it says it was replaced by `/apikey`.
7. Look at a chat with a few messages: the status bar is on the last line, and the "You:",
   character-name and notice styles are distinct.
