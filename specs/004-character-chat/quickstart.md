# Quickstart: validating 004-character-chat

## Automated

```bash
pnpm build && pnpm lint && pnpm test
```

## Manual (owner, about five minutes, real key)

```bash
export LITTLETAVERN_HOME=$(mktemp -d)
node packages/tui/dist/cli.js import ../test-cards/dsh-tavern/lighthouse-card.json ../test-cards/sillytavern/*
pnpm build && node --env-file-if-exists=.env packages/tui/dist/cli.js
```

1. Run `/characters`, type `灯塔`, and press Enter. The greeting appears and the status bar shows
   the character's name.
2. Send a message mentioning a lore keyword from the card. The reply is in character.
3. Press Ctrl+R. The last reply is replaced by a new one.
4. Run `/chat <Seraphina id>`, then `/attach <Eldoria id>`, then `/lorebooks`. Two lorebooks are
   listed.
5. Quit and relaunch. Run `/sessions`, select the lighthouse chat, and send another message. It
   continues with the regenerated reply and not the replaced one.
6. In `$LITTLETAVERN_HOME/data/sessions/`, the lighthouse session file contains both reply
   versions.
7. In `$LITTLETAVERN_HOME/data/usage.jsonl`, the character-chat records carry that session's id.
