# Quickstart: validating 001-tui-chat

## Automated (night run and every commit)

```bash
pnpm install
pnpm build && pnpm lint && pnpm test
node packages/tui/dist/cli.js --version   # prints "LittleTavern 0.1.0"
```

Expected: all three commands pass, and `pnpm test` covers what spec.md lists under "Acceptance
Testing → Automated". No network access and no `.env` are needed.

## Opt-in real provider (owner only)

```bash
echo 'OPENROUTER_API_KEY=sk-or-...' > .env    # git-ignored
pnpm test:live
```

Expected: one short reply from `openai/gpt-4o-mini` and one new ledger record with a non-null
cost. The test is skipped when no key is set.

## Manual session (owner, about five minutes)

1. Without `.env` and without `OPENROUTER_API_KEY`, and with any saved key forgotten, run
   `LITTLETAVERN_HOME=$(mktemp -d) pnpm dev`. The key prompt appears.
2. Paste the key and check it is masked. Submit, read the path shown, choose "save".
3. Check the header shows "LittleTavern 0.1.0" and the status bar shows the model, `key: saved`,
   and zero usage.
4. Send `Introduce yourself in two sentences.` The reply streams in.
5. Send a long request and press Esc halfway. The partial text stays, marked as interrupted.
6. Run `/model`, type `gpt-4o`, pick `openai/gpt-4o-mini`, and send another message.
7. Compare the status bar totals with `<LITTLETAVERN_HOME>/data/usage.jsonl`.
8. Resize the terminal and send a message in Chinese. Check that the layout holds.
9. Quit with `/quit`. The terminal is back to normal. Relaunch: no key prompt, and the same model
   is active.
10. Run `ls -l <LITTLETAVERN_HOME>/config/credentials.json`: the mode is `-rw-------`.
    Run `grep -r "sk-or" <LITTLETAVERN_HOME>/data <LITTLETAVERN_HOME>/log`: nothing is found.
