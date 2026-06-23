import { describe, expect, it, vi } from "vitest";

import { isRetriable, kindForStatus } from "../errors.js";
import { submitFile, type SubmitArgs } from "../submit.js";

// Make retry backoff instant (vitest hoists vi.mock above the imports at runtime).
vi.mock("node:timers/promises", () => ({ setTimeout: () => Promise.resolve() }));

const args: SubmitArgs = {
  apiUrl: "https://api.test",
  commit: "abc1234",
  environment: "production",
  token: "nhfci_secret",
  idempotencyKey: "nhf-key",
  fileBytes: new TextEncoder().encode("<testsuites/>"),
  file: "results.xml",
};

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

describe("error classification", () => {
  it("maps statuses to kinds and marks the right ones retriable", () => {
    expect(kindForStatus(401)).toBe("auth");
    expect(kindForStatus(403)).toBe("auth");
    expect(kindForStatus(400)).toBe("malformed");
    expect(kindForStatus(429)).toBe("rate_limited");
    expect(kindForStatus(503)).toBe("server");
    expect(isRetriable("server")).toBe(true);
    expect(isRetriable("rate_limited")).toBe(true);
    expect(isRetriable("network")).toBe(true);
    expect(isRetriable("auth")).toBe(false);
    expect(isRetriable("malformed")).toBe(false);
  });
});

describe("submitFile", () => {
  it("returns the disposition on 200", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { commit: "abc1234", environment: "production", accepted: 1, ignored: [], appliedToLibrary: 1, appliedToOpenRuns: 0 }));
    const res = await submitFile(args, fetchImpl as unknown as typeof fetch);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.disposition.accepted).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry an auth failure and reports it as an operational error", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { error: "INTEG_TOKEN_INVALID" }));
    const res = await submitFile(args, fetchImpl as unknown as typeof fetch);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.kind).toBe("auth");
    expect(fetchImpl).toHaveBeenCalledTimes(1); // no retry
  });

  it("retries a transient 503 then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, "busy"))
      .mockResolvedValueOnce(jsonResponse(200, { commit: "abc1234", environment: "production", accepted: 2, ignored: [], appliedToLibrary: 2, appliedToOpenRuns: 0 }));
    const res = await submitFile(args, fetchImpl as unknown as typeof fetch);
    expect(res.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("retries a network throw up to the attempt cap then returns a network error", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    const res = await submitFile(args, fetchImpl as unknown as typeof fetch);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.kind).toBe("network");
    expect(fetchImpl).toHaveBeenCalledTimes(3); // MAX_ATTEMPTS
  });

  it("the token is never placed in the URL (only the Authorization header)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { commit: "abc1234", environment: "production", accepted: 0, ignored: [], appliedToLibrary: 0, appliedToOpenRuns: 0 }));
    await submitFile(args, fetchImpl as unknown as typeof fetch);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain("nhfci_secret");
    expect((init.headers as Record<string, string>)["authorization"]).toBe("Bearer nhfci_secret");
  });
});
