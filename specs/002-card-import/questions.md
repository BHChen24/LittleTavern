# Implementation questions: 002-card-import

## Resolved: branch workflow mismatch

The owner explicitly authorized synchronizing the constitution and staying on 002-card-import.
Constitution 3.0.0 now follows feature branches stacked linearly and prohibits commits to main
or switching, merging or rebasing during feature work. No branch was switched. The previous
2.0.0 main-branch clause was stale. All checkpoint commits retain build/lint/test requirements.
