# Implementation Notes: The Innkeeper

## Implementation details

- T001 writes the updated settings to a temporary sibling and renames it after writing, so a
  write failure preserves the original file. Backups use exclusive creation and collision
  suffixes as specified.
- T002 snapshots the configured round limit at the start of a run. Changes to `toolRounds`
  apply to the next innkeeper message, as required by the data model.
- T007 strips terminal controls in the engine's tool adapter using the same rules as the TUI.
  Keeping this small local helper avoids importing UI code into the engine.
- Unsupported setting keys return the rule text `a supported setting`; normal model calls
  are rejected earlier by the tool schema's explicit setting-key list.
- Usage tests replace faux's zero reported costs with deterministic synthetic usage inside
  the test harness. Production code has no additional test API.
- The previous `analysis.md` is a historical review. The updated design artifacts resolve its
  five findings and are the source of truth for implementation.
- Ignore configuration already covers Node build output, dependencies, logs, temporary files
  and secrets. The root and workspace packages are private; the release builder creates a
  separate package with an explicit `files` allowlist. No additional ignore file is needed.

## Open behavior questions

None.
