import * as core from "@actions/core";

import type { OperationalError } from "./errors.js";
import type { Disposition, IgnoredResult, SubmitResult } from "./submit.js";

export interface AggregatedDisposition {
  accepted: number;
  ignored: IgnoredResult[];
  appliedToLibrary: number;
  appliedToOpenRuns: number;
  files: { file: string; disposition: Disposition }[];
  errors: OperationalError[];
}

/** Union all per-file dispositions (sum applied counts, concat ignored) + collect operational errors. */
export function aggregate(results: SubmitResult[]): AggregatedDisposition {
  const agg: AggregatedDisposition = { accepted: 0, ignored: [], appliedToLibrary: 0, appliedToOpenRuns: 0, files: [], errors: [] };
  for (const r of results) {
    if (r.ok) {
      agg.accepted += r.disposition.accepted;
      agg.appliedToLibrary += r.disposition.appliedToLibrary;
      agg.appliedToOpenRuns += r.disposition.appliedToOpenRuns;
      agg.ignored.push(...r.disposition.ignored);
      agg.files.push({ file: r.file, disposition: r.disposition });
    } else {
      agg.errors.push(r.error);
    }
  }
  return agg;
}

/** Render the GitHub step-summary markdown. Pure (returns the string) so it is unit-testable. */
export function renderSummary(agg: AggregatedDisposition, ctx: { commit: string; environment: string }): string {
  const lines: string[] = [];
  lines.push("## NoHotfix — reported CI results");
  lines.push("");
  lines.push(`Commit \`${ctx.commit}\` · environment \`${ctx.environment}\``);
  lines.push("");
  lines.push(`- **Accepted:** ${agg.accepted}`);
  lines.push(`- **Applied to library:** ${agg.appliedToLibrary}`);
  lines.push(`- **Applied to open runs:** ${agg.appliedToOpenRuns}`);
  lines.push(`- **Ignored:** ${agg.ignored.length}`);

  if (agg.ignored.length > 0) {
    lines.push("");
    lines.push("<details><summary>Ignored results</summary>");
    lines.push("");
    lines.push("| ci_key | reason |");
    lines.push("| --- | --- |");
    for (const ig of agg.ignored) lines.push(`| \`${ig.ciKey}\` | ${ig.reason} |`);
    lines.push("");
    lines.push("</details>");
  }

  if (agg.accepted === 0 && agg.errors.length === 0) {
    lines.push("");
    lines.push("> No results matched a known test for this commit + environment. Nothing was applied (this is not a failure).");
  }

  if (agg.errors.length > 0) {
    lines.push("");
    lines.push("### Submission problems");
    for (const e of agg.errors) lines.push(`- \`${e.kind}\`: ${e.message}`);
  }

  lines.push("");
  lines.push("_NoHotfix records what your CI reported; it does not run or verify your tests._");
  return lines.join("\n");
}

/** Write the step summary (best-effort) and set the Action outputs. */
export async function publishDisposition(agg: AggregatedDisposition, ctx: { commit: string; environment: string }): Promise<void> {
  const md = renderSummary(agg, ctx);
  core.info(md);
  try {
    await core.summary.addRaw(md).write();
  } catch {
    // Summary file unavailable (e.g. local act runner) — the info log above is the fallback.
  }
  core.setOutput("accepted", agg.accepted);
  core.setOutput("ignored", agg.ignored.length);
  core.setOutput("applied-to-library", agg.appliedToLibrary);
  core.setOutput("applied-to-open-runs", agg.appliedToOpenRuns);
  core.setOutput(
    "disposition-json",
    JSON.stringify({
      commit: ctx.commit,
      environment: ctx.environment,
      accepted: agg.accepted,
      ignored: agg.ignored,
      appliedToLibrary: agg.appliedToLibrary,
      appliedToOpenRuns: agg.appliedToOpenRuns,
    }),
  );
}
