# Quickstart: validating 002-card-import

## Automated

```bash
pnpm build && pnpm lint && pnpm test
```

Expected: the synthetic-fixture tests pass. The real-sample test (research R7) also runs when
`../test-cards/` exists, and is skipped otherwise.

## Manual (owner, about three minutes)

```bash
export LITTLETAVERN_HOME=$(mktemp -d)
node packages/tui/dist/cli.js import ../test-cards/dsh-tavern/*.json ../test-cards/sillytavern/*
node packages/tui/dist/cli.js list
node packages/tui/dist/cli.js show <an id from the list>
node packages/tui/dist/cli.js import ../test-cards/sillytavern/default_Seraphina.png   # already imported
```

Expected:

1. Nine items import, with the labels and counts in research R7. The two `阿芙拉` V3 cards are
   different files, so both are imported.
2. `list` shows 7 characters and 2 lorebooks.
3. `show` on the lighthouse card lists `extensions.regex_scripts` and `extensions.tavern_helper`
   under "Preserved, not used".
4. Re-importing Seraphina reports "Already imported".
5. In the app (`pnpm dev`), `/library` and `/show <id>` print the same lines as the CLI.
6. `ls $LITTLETAVERN_HOME/data/library/characters/*/` shows `original.*` and `item.json` in each
   folder, and `cmp` of an original against its source file reports no difference.
