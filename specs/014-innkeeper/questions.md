# Implementation Notes: The Innkeeper

## Implementation details

- T001 writes the updated settings to a temporary sibling and renames it after writing, so a
  write failure preserves the original file. Backups use exclusive creation and collision
  suffixes as specified.
- T002 snapshots the configured round limit at the start of a run. Changes to `toolRounds`
  apply to the next innkeeper message, as required by the data model.
- The previous `analysis.md` is a historical review. The updated design artifacts resolve its
  five findings and are the source of truth for implementation.
- Ignore configuration already covers Node build output, dependencies, logs, temporary files
  and secrets. The root and workspace packages are private; the release builder creates a
  separate package with an explicit `files` allowlist. No additional ignore file is needed.

## Open behavior questions

None.
