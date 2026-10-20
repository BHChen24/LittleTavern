# Quickstart: validating 011-tui-pickers

## Automated (implementer)

```bash
pnpm build && pnpm lint && pnpm test
bash ../acceptance/run-v1-acceptance.sh --auto-only --repo "$PWD"
grep -rn "/chat <\|/attach\|/detach\|/show <" packages/tui/src README.md specs/006-usability/contracts/commands.md \
  | grep -v "\.test\." | grep -v "removed by 011"
```

The last command must print nothing. The shell subcommand `littletavern show <id>` appears only
as `littletavern show <id>`, which this pattern does not match.

## Manual (owner)

Use a temporary home with the examples, and a key and a model:

```bash
pnpm build
LITTLETAVERN_HOME=$(mktemp -d) node packages/tui/dist/cli.js
```

1. `/show`: type `ali`, press Enter: Alice's details appear. `/show alice` shows the "opens a
   picker" message.
2. `/characters` → Alice. `/lorebooks`: the list shows Import, then Wonderland marked attached.
   Choose Wonderland: "Detached Wonderland." Open `/lorebooks` again: it is marked not attached.
   Choose it again: "Attached Wonderland."
3. Put any lorebook file in the import folders' `lorebooks/` folder. `/lorebooks` → `Import a
   lorebook…` → choose it: the import report and "Attached …" appear.
4. Send a message, then `/new`: only the greeting is shown. `/sessions` lists both chats.
5. `/innkeeper`, send something, `/new`: the conversation is cleared.
6. `/chat`, `/attach` and `/detach` are unknown commands.
7. Open each overlay (`/characters`, `/sessions`, `/persona`, `/model`, `/apikey`, `/import`,
   `/trace`, `/help`, `/show`, `/lorebooks`): each has a border. Repeat in a terminal about 60
   columns wide, and once with `NO_COLOR=1`.

## After merge (owner)

Release 0.1.1, the first staged npm release:

1. Bump `packages/tui/package.json` to `0.1.1` on a branch and merge it through a pull request.
2. Tag `v0.1.1` and push it.
3. Approve the staged version on npmjs.com.

These steps are in `specs/010-release/quickstart.md`, "Later releases".
