import { describe, expect, it } from "vitest";

import { aggregate } from "../disposition.js";
import { deriveIdempotencyKey } from "../idempotency.js";
import type { Disposition, SubmitResult } from "../submit.js";

const disp = (over: Partial<Disposition>): Disposition => ({
  commit: "c1",
  environment: "production",
  accepted: 0,
  ignored: [],
  appliedToLibrary: 0,
  appliedToOpenRuns: 0,
  ...over,
});

describe("aggregate", () => {
  it("unions per-file dispositions (sum applied counts, concat ignored)", () => {
    const results: SubmitResult[] = [
      { ok: true, file: "a.xml", disposition: disp({ accepted: 3, appliedToLibrary: 3, appliedToOpenRuns: 1, ignored: [{ ciKey: "x", reason: "unknown_ci_key" }] }) },
      { ok: true, file: "b.xml", disposition: disp({ accepted: 2, appliedToLibrary: 2, appliedToOpenRuns: 2 }) },
    ];
    const agg = aggregate(results);
    expect(agg.accepted).toBe(5);
    expect(agg.appliedToLibrary).toBe(5);
    expect(agg.appliedToOpenRuns).toBe(3);
    expect(agg.ignored).toHaveLength(1);
    expect(agg.errors).toHaveLength(0); // an ignored ci_key is NOT an error → cannot fail the step
    expect(agg.files).toHaveLength(2);
  });

  it("collects operational errors separately from honest dispositions", () => {
    const results: SubmitResult[] = [
      { ok: true, file: "a.xml", disposition: disp({ accepted: 1, appliedToLibrary: 1 }) },
      { ok: false, error: { kind: "auth", message: "401" } },
    ];
    const agg = aggregate(results);
    expect(agg.accepted).toBe(1);
    expect(agg.errors).toHaveLength(1);
    expect(agg.errors[0]?.kind).toBe("auth");
  });
});

describe("deriveIdempotencyKey (content-addressed — finding I1)", () => {
  const bytesA = new TextEncoder().encode("<testsuites>A</testsuites>");
  const bytesB = new TextEncoder().encode("<testsuites>B</testsuites>");

  it("gives DISTINCT keys to distinct shard contents (matrix legs never collide)", () => {
    const k1 = deriveIdempotencyKey({ commit: "c", environment: "p", fileBytes: bytesA, fileIndex: 0, override: undefined });
    const k2 = deriveIdempotencyKey({ commit: "c", environment: "p", fileBytes: bytesB, fileIndex: 0, override: undefined });
    expect(k1).not.toBe(k2);
  });

  it("gives the SAME key to identical bytes+commit+env (a true retry dedupes)", () => {
    const k1 = deriveIdempotencyKey({ commit: "c", environment: "p", fileBytes: bytesA, fileIndex: 0, override: undefined });
    const k2 = deriveIdempotencyKey({ commit: "c", environment: "p", fileBytes: bytesA, fileIndex: 9, override: undefined });
    expect(k1).toBe(k2); // file index does not affect the content-addressed key
  });

  it("changes the key when the commit or environment differs", () => {
    const k1 = deriveIdempotencyKey({ commit: "c1", environment: "p", fileBytes: bytesA, fileIndex: 0, override: undefined });
    const k2 = deriveIdempotencyKey({ commit: "c2", environment: "p", fileBytes: bytesA, fileIndex: 0, override: undefined });
    const k3 = deriveIdempotencyKey({ commit: "c1", environment: "staging", fileBytes: bytesA, fileIndex: 0, override: undefined });
    expect(k1).not.toBe(k2);
    expect(k1).not.toBe(k3);
  });

  it("suffixes the per-file index when an explicit override is provided", () => {
    expect(deriveIdempotencyKey({ commit: "c", environment: "p", fileBytes: bytesA, fileIndex: 2, override: "my-key" })).toBe("my-key-2");
  });
});
