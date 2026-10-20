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

- pi's faux helper leaves costs at zero even for a priced model. The app harness therefore injects a
  synthetic reported cost in a session finish callback registered before the app listener, so
  spend-cap tests exercise nonzero costs without adding production fixture APIs.
- Esc on the spend picker follows its normal cancellation behavior and chooses Stop.

- The phase 2 checkpoint passed, but its commit was blocked by the reported secret-scan false
  positive. Phases 2 and 3 shared commit `8917257` after the approved fixture fix and both validations.

## Open behavior questions

None. The phase 2 gitleaks false positive was reported to the owner, who authorized replacing
its generated test literal with the existing `synthetic-key` placeholder and rerunning the scan.
The ignore rules and hooks remain unchanged.
