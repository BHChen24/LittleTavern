# Contracts: TUI Chat Skeleton

These are the interfaces this feature exposes to users and to other tools.

## Command line

| Invocation | Behaviour | Exit code |
|---|---|---|
| `littletavern` | Starts the full-screen TUI | 0 on normal quit |
| `littletavern --version` | Prints `LittleTavern <version>` to stdout and exits without starting the TUI | 0 |
| `littletavern --help` | Prints usage (the two lines above, plus the environment variables below) | 0 |

Environment variables:

| Variable | Effect |
|---|---|
| `OPENROUTER_API_KEY` | Key used ahead of any saved key. Blank counts as unset |
| `LITTLETAVERN_HOME` | Puts the config, data and log directories under this path (used by tests) |

Root scripts:

| Script | Effect |
|---|---|
| `pnpm dev` | Builds the project, then runs the CLI with `node --env-file-if-exists=.env` |
| `pnpm test` | Default suite: no network, no `.env`, simulated model only |
| `pnpm test:live` | Owner-only: loads `.env` and runs `*.live.test.ts`; skips when no key is set |

## In-app commands

| Input | Effect |
|---|---|
| `/help` | Overlay listing the commands and key bindings |
| `/model` | Opens the model picker |
| `/key` | Opens the key prompt to replace the active key |
| `/forget-key` | Removes the saved key; the next request requires a key |
| `/quit` or Ctrl+C | Quits and restores the terminal |
| Esc while streaming | Interrupts the reply and keeps the partial text |
| Enter | Sends the message (blank input is ignored) |

## Usage ledger file (for future monitoring tools)

- Path: `<dataDir>/usage.jsonl` (see data-model.md, AppPaths).
- Format: UTF-8 JSON Lines. One `UsageRecord` per line (see data-model.md), append-only.
- Every record has `"v": 1`. Readers must ignore unknown fields so the format can grow.
- Never contains the API key.

## Saved key file

- Path: `<configDir>/credentials.json`. Mode `0600`, directory mode `0700`.
- Shape: `{ "openrouter": "<key>" }`. Only written after an explicit "save".
