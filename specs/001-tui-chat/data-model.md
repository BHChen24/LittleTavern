# Data Model: TUI Chat Skeleton

These are the shapes owned by LittleTavern. pi types never appear in the public API of `data`
or `engine`.

## AppPaths (`data`)

| Field | Meaning |
|---|---|
| `configDir`, `dataDir`, `logDir` | From env-paths, or under `LITTLETAVERN_HOME` when that is set |
| `credentialsFile` | `<configDir>/credentials.json` |
| `settingsFile` | `<configDir>/settings.json` |
| `usageLedgerFile` | `<dataDir>/usage.jsonl` |
| `logFile` | `<logDir>/littletavern.log` |

## SavedCredentials (`data`): `credentials.json`

```json
{ "openrouter": "sk-or-..." }
```

- Written only after the user chooses "save". The file has mode `0600` and its directory `0700`.
- When read, a mode wider than `0600` produces a warning (a value returned with the result, not
  thrown). An unreadable or malformed file is an error that the UI reports.
- Forgetting the key removes the `openrouter` field and rewrites the file with mode `0600`.

## Settings (`data`): `settings.json`

```json
{ "model": "google/gemini-2.5-flash" }
```

A missing file, a missing field, or a model id no longer in the allowed list all fall back to
the default model. The UI reports the fallback when an id was present but is no longer allowed.

## ActiveKey (`engine`)

| Field | Type | Notes |
|---|---|---|
| `value` | string | Never logged or rendered in full |
| `source` | `"environment" \| "saved" \| "session"` | Shown in the status bar |
| `masked` | string | `••••` followed by the last four characters |

Blank keys (empty or whitespace only) count as absent at every source.

## ModelInfo (`engine`)

| Field | Type |
|---|---|
| `id` | string, e.g. `openai/gpt-4o-mini` |
| `name` | string |
| `family` | `"openai" \| "gemini"` |
| `price` | `{ inputPerMTok: number; outputPerMTok: number } \| null` |

## UsageRecord (`data`): one line in `usage.jsonl`

| Field | Type | Unknown represented as |
|---|---|---|
| `v` | `1` (record format version) | — |
| `timestamp` | ISO-8601 string (request start) | — |
| `sessionId` | string (UUID, one per app run) | — |
| `provider` | `"openrouter"` | — |
| `model` | string | — |
| `outcome` | `"completed" \| "interrupted" \| "error"` | — |
| `inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheWriteTokens` | number \| null | `null` |
| `reasoningTokens` | number \| null | `null` |
| `cost` | `{ total, input, output, cacheRead, cacheWrite }` in USD \| null | `null` |
| `durationMs` | number \| null | `null` |
| `error` | string, present only when `outcome` is `"error"`, already scrubbed of secrets | — |

Rules:

- Every request that reaches the provider produces exactly one record, appended as one line.
- A request blocked locally (no key, blank input) produces no record.
- Unknown is `null`, never `0` (research R6).

## SessionTotals (`engine`)

| Field | Type |
|---|---|
| `requests` | number |
| `inputTokens`, `outputTokens` | number (sum of known values) |
| `cost` | number (sum of known values) |
| `incomplete` | boolean: true when any record has a `null` cost or `null` tokens |

`sumUsage(records)` is a pure function. It is the only way totals are computed, and the status
bar and the tests both use it.

## Chat state machine (`tui`)

```text
needs-key ──key accepted──▶ ready ──send──▶ streaming ──done/error/Esc──▶ ready
    ▲                                                  │
    └──────────── provider rejects key (401/403) ◀─────┘
```

The model picker and the help overlay can be opened from `ready` only.
