# Data Model: Release v0.1

## Settings: `examplesAdded`

| Field | Type | Meaning |
|---|---|---|
| `examplesAdded` | `boolean`, optional | `true` once the first-start examples step has run, whether it succeeded or not. Absent means it has not run. Validated as a boolean like `mouse`. |

**State transitions**:

```text
absent ──(interactive start, example files present)──▶ true   (success or failure)
absent ──(interactive start, example files missing)──▶ absent (nothing done)
true   ──(any start)──▶ true                                   (never repeats)
```

Deleting the examples, or the library items, never changes the marker.

## Examples

| File (in the repository and the package) | Kind | Copied to |
|---|---|---|
| `examples/characters/alice.json` | Character Card V3 | `<importRoot>/characters/alice.json` |
| `examples/lorebooks/wonderland.json` | SillyTavern world-info lorebook (10 entries) | `<importRoot>/lorebooks/wonderland.json` |
| `examples/README.md` | How to try them | not copied |
| `examples/LICENSE` | CC0 1.0 legal code | not copied |

After the step: both are library items, and
`settings.lorebookAttachments[<Alice's id>]` contains Wonderland's id.

## Release package

| Attribute | Rule |
|---|---|
| Name | `littletavern` |
| Version | equals `packages/tui/package.json` `version`; a release tag must be `v<version>` |
| Contents | exactly the allowlist in [contracts/release-package.md](./contracts/release-package.md) |
| Dependencies | the third-party `dependencies` of `data`, `engine` and `tui`, with their declared ranges |
| Node.js | `engines.node` `>=22.19.0`, narrowed only by the owner if CI fails on a version |

## Import limits

| Rule | Value | Applies to |
|---|---|---|
| Regular files only | directories, devices, pipes and sockets are refused | app and CLI |
| Maximum size | `MAX_IMPORT_BYTES` = 20 × 1024 × 1024 bytes | app and CLI |
| Inside the import root | the real path must be inside the real import root | app only |
