# NoHotfix — Report results

Report your automated test results to [NoHotfix](https://nohotfix.com) in **one CI step**. No npm install, no change to your test code beyond one annotation per test.

> NoHotfix records what your CI reported; it does not run or verify your tests.

## Quick start

```yaml
- name: Run tests
  run: npx playwright test --reporter=junit   # any runner that emits JUnit XML

- name: Report results to NoHotfix
  if: always()                                  # report passes AND failures
  uses: nohotfix/report-results@v1
  with:
    token: ${{ secrets.NOHOTFIX_INGEST_TOKEN }}
    junit: results.xml
    environment: production
```

That's it. The commit is auto-detected (`GITHUB_SHA`), the disposition prints in the job's **step summary**, an unknown test key never fails your build, and a matrix/sharded build just adds the same step to each shard.

## Setup (one time)

1. In NoHotfix → **Settings → Integrations**, create a CI token (shown once). Add it as a repository secret, e.g. `NOHOTFIX_INGEST_TOKEN`.
2. Give each automated test its NoHotfix **`ci_key`** by putting `[nhf:<ci_key>]` in the test name:
   ```ts
   test("checkout completes [nhf:checkout.smoke]", async () => { /* … */ });
   ```
3. Make your runner emit JUnit XML (built-in for Playwright/Vitest; `jest-junit` for Jest; a JUnit reporter for Cypress).

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `token` | ✅ | — | NoHotfix CI ingest token (store as a secret). |
| `junit` | ✅ | — | Path or glob to the JUnit report(s). Globs + multiple files supported. |
| `environment` | ✅ | — | Environment label (part of the exact-match key, e.g. `production`). Never defaulted. |
| `commit` | | `GITHUB_SHA` | Release-candidate commit. For PR builds pass `${{ github.event.pull_request.head.sha }}`. |
| `api-url` | | NoHotfix production | Override for staging / self-hosted. |
| `idempotency-key` | | content-addressed | Per-file content hash — safe for matrix shards and retries. Override only if you have a reason. |
| `fail-on-error` | | `false` | Fail the step on operational errors (auth/network/malformed/no-file). An unknown `ci_key` is **never** an error. |
| `auth` | | `token` | Only `token` is supported today (OIDC is a future option). |

## Outputs

`accepted`, `ignored`, `applied-to-library`, `applied-to-open-runs`, and `disposition-json` (the full aggregated disposition).

## Behavior

- **Sharded / matrix builds** — add the same step to each job; results union for the one commit with no manual report-merging.
- **Resilient by default** — an unknown/stale `ci_key`, an empty report, or a partial suite is reported honestly but **never fails your job**. Operational errors (bad token, unreachable API) are warnings unless you set `fail-on-error: true`.
- **Idempotent** — re-running a workflow does not double-apply or corrupt state.
- **Exact-match** — results bind to the exact `commit` + `environment`; a result for a different commit/environment never satisfies a release gate.

## The `environment` label

`environment` names **which deployment target** your test run is about (`production`, `staging`, …). It is half of how NoHotfix matches a result — results match on **`(ci_key, commit, environment)`**, all exact — so it scopes the release gate: results reported against `staging` never satisfy a `production` release gate (no stale or cross-environment greens).

**Where it comes from:** in NoHotfix you define environments under **Settings → Environments**, and a **run** is given one of them when it's started. The string you pass here must **exactly match that run's environment** (case-sensitive) for the results to feed that run's Go/No-Go gate. A run with no environment set is never matched.

```yaml
with:
  environment: production   # must equal the run's environment, character-for-character
```

Two cases worth distinguishing:

- **Test "last run" + Recent CI results timeline + readiness** — the environment is simply recorded with the result; it shows up there regardless.
- **A run's Go/No-Go gate** — requires the exact `environment` (and commit) of an in-progress run.

Tip: standardize on one spelling (e.g. always `production`) so your CI step and your runs never drift. There is no default — you must set it, precisely so a result can't silently satisfy the wrong environment's gate.

## Pull requests

On `pull_request`, `GITHUB_SHA` is the ephemeral merge commit. If you label runs by the PR head, pass it explicitly:

```yaml
with:
  commit: ${{ github.event.pull_request.head.sha }}
```

## Pointing at a non-production instance

```yaml
with:
  api-url: http://localhost:3001   # or your staging host
```

## Development & releasing (maintainers)

This repository is the **source of truth** for the Action.

```sh
npm install
npm run typecheck && npm run lint && npm test
npm run build      # bundles src/main.ts -> dist/index.js via @vercel/ncc
```

- **`dist/` is not committed to `main`** — it is built and attached to each release tag (build-on-release). `main` holds source only; customers reference published tags (`@v1`), never `@main`.
- **CI** (`.github/workflows/ci.yml`) runs typecheck + lint + tests + a build, plus a self-test that proves the Action stays green against an unreachable API.

### Cutting a release

A release is **human-initiated**; the workflow does the mechanical part — no manual `dist` commit, no cross-repo steps:

```sh
gh release create v1.1.0 --generate-notes
```

`.github/workflows/release.yml` (on a published release) builds `dist/`, attaches it to the release tag, and moves the major tag (`v1`) to it. It runs inside this repo with the built-in `GITHUB_TOKEN`.

