import { describe, expect, it, vi } from "vitest";

import { DEFAULT_API_BASE_URL } from "../constants.js";
import { ConfigError, resolveConfig } from "../inputs.js";

function inputsFrom(map: Record<string, string>): (name: string) => string {
  return (name) => map[name] ?? "";
}

const base = { token: "nhfci_secret", junit: "results.xml", environment: "production" };

describe("resolveConfig", () => {
  it("auto-detects commit from GITHUB_SHA when no commit input is given", () => {
    const cfg = resolveConfig(inputsFrom(base), { GITHUB_SHA: "abc1234" }, () => {});
    expect(cfg.commit).toBe("abc1234");
  });

  it("prefers an explicit commit input over GITHUB_SHA", () => {
    const cfg = resolveConfig(inputsFrom({ ...base, commit: "deadbee" }), { GITHUB_SHA: "abc1234" }, () => {});
    expect(cfg.commit).toBe("deadbee");
  });

  it("throws when environment is missing (never silently defaulted)", () => {
    expect(() => resolveConfig(inputsFrom({ token: "t", junit: "r.xml" }), { GITHUB_SHA: "abc1234" }, () => {})).toThrow(ConfigError);
  });

  it("throws when token or junit is missing", () => {
    expect(() => resolveConfig(inputsFrom({ junit: "r.xml", environment: "p" }), { GITHUB_SHA: "x" }, () => {})).toThrow(/token/);
    expect(() => resolveConfig(inputsFrom({ token: "t", environment: "p" }), { GITHUB_SHA: "x" }, () => {})).toThrow(/junit/);
  });

  it("throws when the commit cannot be determined", () => {
    expect(() => resolveConfig(inputsFrom(base), {}, () => {})).toThrow(/commit/);
  });

  it("rejects an unsupported auth mode (only token in v1)", () => {
    expect(() => resolveConfig(inputsFrom({ ...base, auth: "oidc" }), { GITHUB_SHA: "x" }, () => {})).toThrow(/auth/i);
  });

  it("defaults api-url to the single source-of-truth constant and strips a trailing slash on override", () => {
    expect(resolveConfig(inputsFrom(base), { GITHUB_SHA: "x" }, () => {}).apiUrl).toBe(DEFAULT_API_BASE_URL);
    const overridden = resolveConfig(inputsFrom({ ...base, "api-url": "http://localhost:3001/" }), { GITHUB_SHA: "x" }, () => {});
    expect(overridden.apiUrl).toBe("http://localhost:3001");
  });

  it("parses fail-on-error and masks the token as a secret", () => {
    const setSecret = vi.fn();
    const cfg = resolveConfig(inputsFrom({ ...base, "fail-on-error": "true" }), { GITHUB_SHA: "x" }, setSecret);
    expect(cfg.failOnError).toBe(true);
    expect(setSecret).toHaveBeenCalledWith("nhfci_secret");
  });
});
