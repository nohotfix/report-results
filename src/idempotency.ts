import { createHash } from "node:crypto";

/**
 * Derive the Idempotency-Key for one file submission.
 *
 * Default = content-addressed: sha256(commit + "\0" + environment + "\0" + fileBytes). This is the
 * fix for analysis finding I1 — a run-id/job-based key COLLIDES across matrix legs (run_id, run_attempt
 * and GITHUB_JOB are identical for every leg of one matrix job), which would make the server replay the
 * first leg's disposition and silently DROP later legs' results. A content digest instead:
 *   - distinct shards run distinct test subsets → distinct bytes → distinct keys → results UNION;
 *   - a true retry (identical bytes) → identical key → the server dedupes (no double-apply);
 *   - a re-run with CHANGED results → different bytes → new key → fresh results apply (last-write-wins);
 *   - commit + environment in the key keep the same results submitted for a different commit/env distinct.
 *
 * When the caller provides an explicit override, we suffix the per-file index so a multi-file override
 * still distinguishes files.
 */
export function deriveIdempotencyKey(args: {
  commit: string;
  environment: string;
  fileBytes: Uint8Array;
  fileIndex: number;
  override: string | undefined;
}): string {
  if (args.override) return `${args.override}-${args.fileIndex}`;
  const hash = createHash("sha256");
  hash.update(args.commit);
  hash.update("\0");
  hash.update(args.environment);
  hash.update("\0");
  hash.update(args.fileBytes);
  return `nhf-${hash.digest("hex")}`;
}
