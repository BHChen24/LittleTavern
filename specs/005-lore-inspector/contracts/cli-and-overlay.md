# Contracts: Lore Inspector

## Command line

```text
littletavern dry-run <character-id> [--message <text>] [--session <id-or-path>] [--json]
```

| Case | Output | Exit |
|---|---|---|
| Success, text output | Report lines (research R4), then `── Request ──`, then the assembled prompt: system text, each history message prefixed with its role, and the post-history text | 0 |
| Success, `--json` | One JSON document: `{ "prompt": AssembledPrompt, "trace": AssemblyTrace }` | 0 |
| Unknown or ambiguous character, unknown session, or missing character | One-line error | 1 |

The command never contacts a provider, never needs a key and never writes files. `--help` lists
it.

## In-app

| Input | Effect |
|---|---|
| `/trace` | In a character chat that has had a request: opens the trace overlay. Otherwise shows a notice (spec User Story 2, scenarios 4 and 5) |
| Up / Down / PgUp / PgDn / Home / End | Scroll the overlay |
| Esc | Close the overlay |

`/help` lists `/trace`.
