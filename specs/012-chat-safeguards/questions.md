# Implementation Notes and Questions

## Implementation details

- Request-setting warnings use the range strings given verbatim in T001. A malformed `limits`
  or `generation` section produces one warning that the section must be an object.
- Character-chat assembly uses the session's startup request cap, so editing limits during a
  run cannot change the context reserve independently of the transmitted cap. Standalone
  assembly and dry runs read request settings from their supplied paths.
- The source workspace packages are private. Publishing builds a separate release directory
  with an explicit file allowlist, so no source `.npmignore` is needed. Existing `.gitignore`
  already covers dependencies, build output, logs, secrets, and editor files. No other
  detected tool requires an ignore file.

## Open behavior questions

None at this checkpoint.
