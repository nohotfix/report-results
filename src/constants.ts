// The default NoHotfix ingest host. Single source of truth for the api-url default.
//
// ⚠️ GO-LIVE GATE (065 / finding U1): this is the *intended* production host but was flagged
// unconfirmed in 056's plan (`api.nohotfix.com` vs the `*.ondigitalocean.app` default). Confirm it
// against the real production ingest host BEFORE the first public `v1` publish — it is a one-line
// change here. Example apps point at `http://localhost:3001` explicitly, so they never rely on this.
export const DEFAULT_API_BASE_URL = "https://api.nohotfix.com";

// Bounded retry for transient failures (network / 5xx / 429).
export const MAX_ATTEMPTS = 3;
export const BASE_BACKOFF_MS = 500;
