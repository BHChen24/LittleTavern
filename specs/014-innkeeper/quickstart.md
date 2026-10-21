# Quickstart: validating 014-innkeeper

## Automated (implementer)

```bash
pnpm build && pnpm lint && pnpm test
bash ../acceptance/run-v1-acceptance.sh --auto-only --repo "$PWD"
```

## Manual (owner)

Use a temporary home, a key and a model with tool support (all allowed models qualify):

```bash
pnpm build
H=$(mktemp -d); LITTLETAVERN_HOME=$H node packages/tui/dist/cli.js
```

1. `/innkeeper`, ask "How do I add my own character?": a muted `Innkeeper read the house rules`
   line, then an answer naming the import folder and `/import` or `/characters`.
2. Ask in another language (for example Chinese) which model is in use: a `checked the
   settings` line, and an answer in that language with the model id.
3. Ask "Cap replies at 1000 tokens and make it a bit more creative": the change lines
   (`limits.replyTokens: 4096 → 1000`, `generation.temperature: default → …`) and the Yes/No
   picker. Choose Yes: the saved notice names a file in `$H/config/backups/`. `/characters` →
   Alice, send a message, `/trace`: `Requested: max 1000 output tokens · temperature …`.
4. Ask for the same change again and choose No: nothing changes; the innkeeper says you declined.
5. Ask "Set top P to 2": no picker; the innkeeper explains the range.
6. Ask "Change my model to GPT" and "Call me Mira": no picker; it names `/model` and `/persona`.
7. Ask "I'd like to talk to Alice": `Start a new chat with Alice?` → Yes: the Alice chat opens
   after the innkeeper finishes. `/innkeeper`: the earlier conversation is back, with its muted
   lines.
8. Ask "Let's continue my last chat with Alice": the continue question with a date; Yes resumes
   it.
9. Put `"limits": { "toolRounds": 1 }` in `$H/config/settings.json`, restart, and ask something
   that needs two lookups: the round-limit notice.
10. Break `settings.json` (for example a trailing comma), ask for a change: the innkeeper reports
    the file is not valid JSON; the file is unchanged.
