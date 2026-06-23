// Operational errors are NoHotfix-side / transport problems — distinct from an "honest disposition"
// (unknown/stale ci_key, empty report, partial suite), which is a NORMAL outcome and never an error.
// Only operational errors can fail the step, and only when `fail-on-error: true` (see main.ts).
export type OperationalErrorKind =
  | "auth" // 401 / 403 — bad/revoked token
  | "malformed" // 400 — the endpoint rejected the body
  | "rate_limited" // 429 after retries exhausted
  | "server" // persistent 5xx after retries
  | "network" // fetch threw / no response
  | "no_file"; // the junit glob matched nothing

export interface OperationalError {
  kind: OperationalErrorKind;
  message: string;
  /** The file this error relates to, when applicable. */
  file?: string;
}

export function isRetriable(kind: OperationalErrorKind): boolean {
  return kind === "network" || kind === "server" || kind === "rate_limited";
}

/** Map an HTTP status to an operational error kind (used when the response is not 2xx). */
export function kindForStatus(status: number): OperationalErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limited";
  if (status === 400) return "malformed";
  if (status >= 500) return "server";
  // Any other non-2xx is treated as malformed (the request was understood but rejected).
  return "malformed";
}
