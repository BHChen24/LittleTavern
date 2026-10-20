# Implementation questions: 002-card-import

## Resolved: branch workflow mismatch

The owner explicitly authorized synchronizing the constitution and staying on 002-card-import.
Constitution 3.0.0 now follows feature branches stacked linearly and prohibits commits to main
or switching, merging or rebasing during feature work. No branch was switched. The previous
2.0.0 main-branch clause was stale. All checkpoint commits retain build/lint/test requirements.

## Parsing details

Node 26 does not include line/column in every JSON.parse error. T005 explicitly requires
passing through its message, so the implementation preserves that message without inventing
locations. The diagnostic test uses malformed JSON for which Node reports a location.
An embedded unnamed lorebook uses its character's name as the normalization fallback; standalone
lorebooks use the source file's base name. Non-object entries get a warning and are omitted
from the normalized list while remaining intact in raw. PNG chunk bounds errors are reported
as damaged PNG; CRC, zTXt and iTXt handling remain out of scope.

## Library commands without a key

T015 requires importing without an API key, but 001 focuses a masked key prompt at launch.
The prompt now hands the three library commands back to app.submit without accepting them
as credentials, then gives focus to the editor for further commands. A normal chat message
without a key opens the key prompt again. This is the minimal wiring needed to make T015
reachable through actual terminal input; there is no new screen or file browser.
