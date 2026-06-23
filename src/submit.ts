import { setTimeout as sleep } from "node:timers/promises";

import { BASE_BACKOFF_MS, MAX_ATTEMPTS } from "./constants.js";
import { isRetriable, kindForStatus, type OperationalError } from "./errors.js";

/** One ignored result in the honest disposition. */
export interface IgnoredResult {
  ciKey: string;
  reason: string;
}

/** The 056 endpoint's honest disposition (response shape — owned by the server, unchanged here). */
export interface Disposition {
  commit: string;
  environment: string;
  accepted: number;
  ignored: IgnoredResult[];
  appliedToLibrary: number;
  appliedToOpenRuns: number;
}

export type SubmitResult = { ok: true; disposition: Disposition; file: string } | { ok: false; error: OperationalError };

export interface SubmitArgs {
  apiUrl: string;
  commit: string;
  environment: string;
  token: string;
  idempotencyKey: string;
  fileBytes: Uint8Array;
  file: string;
}

type FetchFn = typeof fetch;

/**
 * POST one JUnit file (raw XML body) to the existing 056 ingest endpoint. Reuses the server-side JUnit
 * parse + `[nhf:ci_key]` extraction — no client-side parsing. Retries transient failures (network / 5xx
 * / 429) with backoff that honors Retry-After. Never throws — returns a discriminated result.
 */
export async function submitFile(args: SubmitArgs, fetchImpl: FetchFn = fetch): Promise<SubmitResult> {
  const url = `${args.apiUrl}/api/ci/results?commit=${encodeURIComponent(args.commit)}&environment=${encodeURIComponent(args.environment)}`;

  let lastError: OperationalError = { kind: "network", message: "request was not attempted", file: args.file };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${args.token}`,
          "content-type": "application/xml",
          "idempotency-key": args.idempotencyKey,
        },
        body: args.fileBytes,
      });
    } catch (err) {
      lastError = { kind: "network", message: `network error contacting NoHotfix: ${errMessage(err)}`, file: args.file };
      if (attempt < MAX_ATTEMPTS) await backoff(attempt, null);
      continue;
    }

    if (res.ok) {
      try {
        const disposition = (await res.json()) as Disposition;
        return { ok: true, disposition, file: args.file };
      } catch (err) {
        // A 2xx with an unreadable body is a contract surprise — treat as malformed (not retriable).
        return { ok: false, error: { kind: "malformed", message: `could not parse the NoHotfix response: ${errMessage(err)}`, file: args.file } };
      }
    }

    const kind = kindForStatus(res.status);
    lastError = { kind, message: `NoHotfix returned ${res.status} ${res.statusText || ""}`.trim() + ` for ${args.file}`, file: args.file };
    if (attempt < MAX_ATTEMPTS && isRetriable(kind)) {
      await backoff(attempt, res.headers.get("retry-after"));
      continue;
    }
    return { ok: false, error: lastError };
  }

  return { ok: false, error: lastError };
}

async function backoff(attempt: number, retryAfter: string | null): Promise<void> {
  const headerMs = retryAfter ? Number(retryAfter) * 1000 : NaN;
  const delay = Number.isFinite(headerMs) && headerMs > 0 ? headerMs : BASE_BACKOFF_MS * 2 ** (attempt - 1);
  await sleep(delay);
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
