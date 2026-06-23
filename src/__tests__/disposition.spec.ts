import { describe, expect, it, vi } from "vitest";

import { aggregate, publishDisposition, renderSummary } from "../disposition.js";
import type { SubmitResult } from "../submit.js";

const h = vi.hoisted(() => {
  const write = vi.fn(async () => {});
  return { setOutput: vi.fn(), info: vi.fn(), write, addRaw: vi.fn(() => ({ write })) };
});

vi.mock("@actions/core", () => ({ setOutput: h.setOutput, info: h.info, summary: { addRaw: h.addRaw } }));

const okResult = (over: Partial<{ accepted: number; appliedToLibrary: number; appliedToOpenRuns: number; ignored: { ciKey: string; reason: string }[] }>): SubmitResult => ({
  ok: true,
  file: "results.xml",
  disposition: { commit: "abc1234", environment: "production", accepted: 0, appliedToLibrary: 0, appliedToOpenRuns: 0, ignored: [], ...over },
});

describe("renderSummary", () => {
  it("shows counts, the ignored table, and the honest trust-boundary line", () => {
    const agg = aggregate([okResult({ accepted: 4, appliedToLibrary: 4, appliedToOpenRuns: 2, ignored: [{ ciKey: "checkout.stale", reason: "unknown_ci_key" }] })]);
    const md = renderSummary(agg, { commit: "abc1234", environment: "production" });
    expect(md).toContain("**Accepted:** 4");
    expect(md).toContain("**Applied to library:** 4");
    expect(md).toContain("`checkout.stale`");
    expect(md).toContain("does not run or verify your tests");
    expect(md).not.toMatch(/verified by NoHotfix/i);
  });

  it("notes 'nothing matched' (not a failure) when accepted is zero with no errors", () => {
    const md = renderSummary(aggregate([okResult({ accepted: 0 })]), { commit: "abc1234", environment: "production" });
    expect(md).toContain("No results matched");
    expect(md).toContain("not a failure");
  });
});

describe("publishDisposition", () => {
  it("sets outputs incl. a valid disposition-json", async () => {
    const agg = aggregate([okResult({ accepted: 7, appliedToLibrary: 7, appliedToOpenRuns: 3 })]);
    await publishDisposition(agg, { commit: "abc1234", environment: "production" });
    expect(h.setOutput).toHaveBeenCalledWith("accepted", 7);
    expect(h.setOutput).toHaveBeenCalledWith("applied-to-open-runs", 3);
    const jsonCall = h.setOutput.mock.calls.find((c) => c[0] === "disposition-json");
    expect(jsonCall).toBeDefined();
    const parsed = JSON.parse(jsonCall![1] as string);
    expect(parsed).toMatchObject({ commit: "abc1234", environment: "production", accepted: 7, appliedToOpenRuns: 3 });
    expect(h.write).toHaveBeenCalled();
  });
});
