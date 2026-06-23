import { readFile } from "node:fs/promises";

import * as core from "@actions/core";
import * as glob from "@actions/glob";

import { aggregate, publishDisposition } from "./disposition.js";
import { ConfigError, resolveConfig } from "./inputs.js";
import { deriveIdempotencyKey } from "./idempotency.js";
import { submitFile, type SubmitResult } from "./submit.js";

export async function run(): Promise<void> {
  let failOnError = false;
  try {
    const cfg = resolveConfig((name) => core.getInput(name), process.env);
    failOnError = cfg.failOnError;

    // Expand the glob (also matches a single literal path).
    const globber = await glob.create(cfg.junit, { matchDirectories: false });
    const files = await globber.glob();

    if (files.length === 0) {
      // Operational, not an honest disposition — route through the fail-on-error gate.
      return gate(failOnError, `no JUnit file matched '${cfg.junit}'.`);
    }

    const results: SubmitResult[] = [];
    for (const [index, file] of files.entries()) {
      const fileBytes = await readFile(file);
      const idempotencyKey = deriveIdempotencyKey({
        commit: cfg.commit,
        environment: cfg.environment,
        fileBytes,
        fileIndex: index,
        override: cfg.idempotencyKeyOverride,
      });
      results.push(await submitFile({ apiUrl: cfg.apiUrl, commit: cfg.commit, environment: cfg.environment, token: cfg.token, idempotencyKey, fileBytes, file }));
    }

    const agg = aggregate(results);
    await publishDisposition(agg, { commit: cfg.commit, environment: cfg.environment });

    // Honest dispositions (unknown ci_key, empty, partial) NEVER fail the step. Only operational
    // errors do, and only when fail-on-error is set.
    if (agg.errors.length > 0) {
      const summary = agg.errors.map((e) => `${e.kind}: ${e.message}`).join("; ");
      return gate(failOnError, `some submissions failed — ${summary}`);
    }
  } catch (err) {
    if (err instanceof ConfigError) {
      // Misconfiguration is always surfaced; honor the gate for consistency.
      return gate(failOnError, err.message);
    }
    // Unexpected internal error — gate it too (never hard-crash a customer's job by default).
    return gate(failOnError, `unexpected error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Warn by default; fail the step only when fail-on-error is enabled. */
function gate(failOnError: boolean, message: string): void {
  if (failOnError) core.setFailed(`NoHotfix report-results: ${message}`);
  else core.warning(`NoHotfix report-results: ${message} (not failing the job; set fail-on-error: true to change this)`);
}

void run();
