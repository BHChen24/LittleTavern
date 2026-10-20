# Implementation questions: 006-usability

## Manual launch command (T011)

T011 requests `pnpm dev`, but that script loads `.env`. The run rules prohibit reading or using
that file. Conservative resolution: run the same built CLI directly, with `LITTLETAVERN_HOME`
pointing to a temporary folder and `OPENROUTER_API_KEY` removed. No script or environment file
is changed.
