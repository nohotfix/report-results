# CI fixtures — `nohotfix/report-results` cross-runner examples

Minimal example apps proving the **single universal JUnit path** works against each runner's real output — and the copy-paste reference customers learn from. Each app: a trivial test whose **name carries a `[nhf:<ci_key>]` token**, a JUnit reporter, and a sample workflow that reports via the Action.

> **Standalone on purpose.** These are NOT pnpm-workspace members — each pulls a heavy test runner (Playwright/Cypress download browsers), so installing them into the monorepo would bloat everyone's install. Run one on demand: `cd apps/ci-fixtures/<runner> && npm install && npm test`.

## ci_keys used

Aligned to the 064 activation example seed so reporting lights up the demo:

- `auth.session.expiry` (the seeded automated test)
- `checkout.smoke`, `login.e2e` (generic examples)

## Validate one against a local NoHotfix (the T024 dogfood)

1. Start the API + app (`pnpm dev`) and seed the example org (`pnpm db:seed`).
2. Mint a CI token in Settings → Integrations; export it: `export NOHOTFIX_INGEST_TOKEN=...`.
3. `cd apps/ci-fixtures/<runner> && npm install && npm test` (emits `results.xml`).
4. Report it (mirrors what the Action does) against your local API:
   ```sh
   curl -sS -X POST "http://localhost:3001/api/ci/results?commit=$(git rev-parse HEAD)&environment=production" \
     -H "Authorization: Bearer $NOHOTFIX_INGEST_TOKEN" \
     -H "Content-Type: application/xml" \
     --data-binary @results.xml
   ```
   (In real CI you'd use the Action; this curl is the local-dev equivalent so you don't need to publish the Action first.)
5. Confirm the test's "last run" + Recent CI results timeline + readiness column updated in the app, bound to that commit + `production`.

The `.github/workflow.yml` in each folder is the real customer-facing snippet using `uses: nohotfix/report-results@v1`.
