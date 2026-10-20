# Quickstart: validating 005-lore-inspector

## Automated

```bash
pnpm build && pnpm lint && pnpm test
```

## Manual demo run-through (owner, about three minutes, no key needed for steps 1–3)

```bash
export LITTLETAVERN_HOME=$(mktemp -d)
node packages/tui/dist/cli.js import ../test-cards/dsh-tavern/lighthouse-card.json
node packages/tui/dist/cli.js list                       # note the id
node packages/tui/dist/cli.js dry-run <id>               # greeting only
node packages/tui/dist/cli.js dry-run <id> --message "<a sentence with one of the card's keywords>"
node packages/tui/dist/cli.js dry-run <id> --message "hello" --json | head -40
```

1. The greeting-only dry run shows only constant entries as fired. Everything else is listed under
   "no keyword in the last 2 messages".
2. With the keyword message, that entry moves to "Lore fired" with ``keyword `…` in message 2``.
3. Set `"loreBudget": 50` in `settings.json` and dry-run again. Entries move to "over budget".
4. With a real key, start a character chat (`/characters`), send the keyword message, and open
   `/trace`. It matches step 2. Scroll, then press Esc.
