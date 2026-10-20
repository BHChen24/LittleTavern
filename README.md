# LittleTavern

A terminal app for character-card roleplay. It imports character cards and lorebooks, lets you
set a persona, and runs the chat in a full-screen TUI. It can also show what was sent to the model
in the last request and why each lorebook entry was or was not included.

It is in the same family as [SillyTavern](https://github.com/SillyTavern/SillyTavern), but it is
its own application, not a port. SillyTavern is a design reference: LittleTavern takes the ideas
and implements them independently. It is built on the [pi](https://github.com/earendil-works/pi)
agent framework (`pi-ai`, `pi-agent-core`, `pi-tui`).

> **Status:** v0.1, an early version. Expect rough edges.

## Features

- Character Card V2 and V3 (JSON or PNG) and SillyTavern lorebooks. Fields the app does not use
  are kept in the stored card.
- `/trace` lists the parts of the last request (instructions, persona, character, lore, history)
  with estimated tokens, and why each lorebook entry was or was not included.
  `littletavern dry-run` shows the next request without sending it.
- Personas are Markdown files; you can switch between them at any time.
- New characters can be written from a Markdown template in `$EDITOR` and are saved as V3 cards.
- Full-screen TUI with mouse scrolling, copy-on-select, transcript search, saved chats and
  regenerate.
- The status bar shows the session's tokens, cache hits and cost.

## Requirements

- Node.js 22.19 or newer (tested on 22, 24 and 26)
- An [OpenRouter](https://openrouter.ai/) API key. Models from the OpenAI and Gemini families are
  supported. For trying LittleTavern out, a Gemini model is recommended: it currently follows
  character cards most reliably.

## Install

```bash
npm install -g littletavern
```

`littletavern` is now available in any directory. Remove it with
`npm uninstall -g littletavern`.

npm may print warnings during the install: that `node-domexception` is deprecated, and that
`@google/genai` and `protobufjs` have install scripts that were not run. Both come from
dependencies of pi's Google provider. LittleTavern does not need those scripts, so you can
ignore the warnings and do not need `--allow-scripts`.

## Quick start

1. Run `littletavern` and press Enter. On the first interactive start, Alice and the Wonderland
   lorebook are added to your library, with Wonderland already attached to Alice. When no player
   name or active persona is set, the app asks what characters should call you. Enter saves
   `Traveler` or your edited name; Esc uses `Traveler` for this run and asks again next start.
   A persona's name takes precedence.
2. `/apikey` adds your OpenRouter key. You choose whether it is kept for this session only or
   saved to a file only you can read.
3. `/model` chooses a model.
4. `/characters` starts a chat with Alice, another character, or creates a new one. `/persona`
   sets who you are.
5. To add your own content, put character cards in `~/.littletavern/characters/` and lorebooks in
   `~/.littletavern/lorebooks/`, then use `/import` to browse the import folders. For other
   locations, run `littletavern import <file>` in a shell.

Type `/` at any time to see the commands, with completion.

## Commands

| Command | What it does |
|---|---|
| `/characters` | Choose a character and start a chat, or create a new one |
| `/new` | Start a new chat with the current character |
| `/sessions` | Resume a saved chat |
| `/regenerate` | Regenerate the last reply (also Ctrl+R) |
| `/prev` | Bring back the reply that the last regenerate replaced; use again to swap back |
| `/trace` | Show why the last request looked the way it did |
| `/lorebooks` | Choose, attach or import lorebooks for the current character |
| `/persona` | Choose, create or edit who you are in the story |
| `/import` | Import a card or lorebook from the import folders |
| `/library`, `/show` | List the library, or pick an item to inspect |
| `/innkeeper` | Talk to the innkeeper (a chat without a character) |
| `/model` | Choose a model |
| `/apikey` | Add, replace or forget your OpenRouter key |
| `/help` | Show commands and key bindings |
| `/quit` | Quit |

| Key | What it does |
|---|---|
| Enter | Send |
| Esc | Interrupt a reply; close a picker |
| Ctrl+R | Regenerate the last reply |
| Ctrl+O | Write the current message in `$EDITOR` |
| PgUp / PgDn, mouse wheel | Scroll the transcript |
| Ctrl+Shift+F | Search the transcript |
| Ctrl+C | Quit |

`/prev` keeps the latest replaced reply for this run only, in character chats. Sending a new
message, starting another regenerate, switching chats or quitting clears that slot. A successful
regenerate fills it with the reply it replaced. The shown reply is saved and used in later requests.

If a reply fails, the notice tells you how to retry or fix the cause and where to find the
technical details in the diagnostic log. In character chats, retry with Ctrl+R or `/regenerate`;
retryable failure notices count manual retries. Partial failed replies are marked incomplete
and are neither saved nor sent with later requests. There are no automatic retries.

## Limits and generation settings

By default, each request asks for at most **4096 output tokens**, including reasoning tokens,
and the app asks before starting another request once this run has spent **$1**. A request already
in progress finishes and may cross the threshold. `Continue` adds another cap's worth to this
run's allowance; `Stop` keeps your message in the input. Unknown model prices cannot be checked
against the spending limit. A reply cut off at the token limit is saved normally.

The home screen and setup notice show the limits and the path to `settings.json` until a chat
starts. Edit that file to change the limits and sampling parameters, then **restart the app**:

```json
{
  "limits": { "replyTokens": 4096, "runSpendUsd": 1 },
  "generation": {
    "temperature": 1.1,
    "topP": 0.9,
    "topK": 40,
    "minP": 0.05,
    "repetitionPenalty": 1.05
  }
}
```

| Setting | Accepted values |
|---|---|
| `limits.replyTokens` | Whole number at least 0; 0 removes the app's reply cap |
| `limits.runSpendUsd` | Number at least 0, in USD; 0 turns off the spending limit |
| `generation.temperature` | 0 to 2 |
| `generation.topP`, `generation.minP` | 0 to 1 |
| `generation.topK` | Whole number at least 1 |
| `generation.repetitionPenalty` | Number greater than 0 |

Unset sampling parameters use model defaults. Invalid fields produce a startup notice;
invalid limits use their defaults and other valid fields still apply. `/trace` shows the values
LittleTavern requested under `Requested:`. pi may lower the output cap to fit remaining context;
with no app cap it uses the model's maximum. A model may ignore sampling parameters.

## Command line

```text
littletavern                         Start the app
littletavern import <file…>          Import cards or lorebooks
littletavern list                    List the library
littletavern show <id>               Inspect an item (a unique prefix is enough)
littletavern create <file.md>        Create and import a character from Markdown
littletavern dry-run <character-id> [--message <text>] [--session <id-or-path>] [--json]
                                     Show the next request and its lore trace; sends nothing
```

## Supported formats

| Kind | Accepted |
|---|---|
| Character cards | V3 JSON (`chara_card_v3`), V2 JSON (`chara_card_v2`), PNG with a `ccv3` or `chara` text chunk (`ccv3` wins when both exist) |
| Lorebooks | The lorebook embedded in a card (`data.character_book`), and standalone SillyTavern world-info JSON |

Not supported yet, with a clear error: V1 cards, CharX, BYAF, YAML cards, and PNGs without card
data.

## Where things are stored

| What | Where (Linux defaults) |
|---|---|
| Import folders and personas | `~/.littletavern/{characters,lorebooks,personas}` |
| Settings and a saved key | `~/.config/littletavern/` (`settings.json`, `credentials.json`) |
| Library and chat sessions | `~/.local/share/littletavern/` |

macOS and Windows use their platform's usual folders. Set `LITTLETAVERN_HOME` to keep everything
in one directory instead.

## Your API key

- By default the key is used **for the current session only** and is never written to disk.
- It is saved only when you choose to, to `credentials.json` with permissions only you can read.
- `OPENROUTER_API_KEY` in the environment overrides a saved key.
- The key is removed from anything the app displays or logs.

## Development

### Install from source

This needs [pnpm](https://pnpm.io/):

```bash
git clone https://github.com/BHChen24/LittleTavern.git
cd LittleTavern
pnpm install
pnpm build
cd packages/tui && pnpm link --global
```

Remove the source-linked command with `pnpm remove --global @littletavern/tui`.

### Checks

```bash
pnpm install       # also installs the git hooks
pnpm build         # TypeScript build, which is also the type check
pnpm lint          # Biome
pnpm test          # Vitest; uses a simulated model, never a real key
```

Git hooks (husky) run [gitleaks](https://github.com/gitleaks/gitleaks) and the lint before each
commit, check that commit messages follow the conventional format in English, and run the build
and tests before each push. Install gitleaks before committing.

### How this project is built

LittleTavern is developed spec-first with [Spec Kit](https://github.com/github/spec-kit). Each
feature has a specification, a plan, a task list and an implementation report under
[`specs/`](specs/), all governed by the project
[constitution](.specify/memory/constitution.md). Design and specifications are worked out by the
owner with Claude; implementation is done by Codex following [`AGENTS.md`](AGENTS.md). The
constitution also requires each feature to record the development tokens it used.

## License

[MIT](LICENSE). Character cards and lorebooks you import keep their own licenses.
