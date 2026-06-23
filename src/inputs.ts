import * as core from "@actions/core";

import { DEFAULT_API_BASE_URL } from "./constants.js";

export interface ResolvedConfig {
  token: string;
  junit: string;
  environment: string;
  commit: string;
  apiUrl: string;
  /** Explicit override; when absent the key is content-addressed per file (see idempotency.ts). */
  idempotencyKeyOverride: string | undefined;
  failOnError: boolean;
}

/** Thrown for a misconfiguration the user must fix (missing required input, unsupported auth). */
export class ConfigError extends Error {}

/**
 * Resolve + validate the Action inputs against the workflow environment. Reads from a provided
 * `env`/`getInput` pair so it is unit-testable without the real Actions runtime.
 */
export function resolveConfig(
  getInput: (name: string) => string,
  env: NodeJS.ProcessEnv,
  setSecret: (value: string) => void = core.setSecret,
): ResolvedConfig {
  const token = getInput("token").trim();
  if (!token) throw new ConfigError("`token` is required — store your NoHotfix CI token as a secret and pass it as `token`.");
  setSecret(token);

  const junit = getInput("junit").trim();
  if (!junit) throw new ConfigError("`junit` is required — pass the path or glob to your JUnit report(s).");

  // Environment is half the exact-match key; never default it silently (a wrong env could mask a stale result).
  const environment = getInput("environment").trim();
  if (!environment) throw new ConfigError("`environment` is required (e.g. 'production') — it is part of the exact-match key and is never defaulted.");

  const commit = (getInput("commit").trim() || env.GITHUB_SHA || "").trim();
  if (!commit) {
    throw new ConfigError("Could not determine the commit. Pass `commit:` explicitly (outside GitHub Actions GITHUB_SHA is unset; for PRs pass github.event.pull_request.head.sha).");
  }

  const auth = (getInput("auth").trim() || "token").toLowerCase();
  if (auth !== "token") {
    throw new ConfigError(`Unsupported auth mode '${auth}'. Only 'token' is supported in this version (OIDC is a future option).`);
  }

  const apiUrl = stripTrailingSlash(getInput("api-url").trim() || DEFAULT_API_BASE_URL);
  const idempotencyKeyOverride = getInput("idempotency-key").trim() || undefined;
  const failOnError = parseBool(getInput("fail-on-error"));

  return { token, junit, environment, commit, apiUrl, idempotencyKeyOverride, failOnError };
}

function parseBool(raw: string): boolean {
  return raw.trim().toLowerCase() === "true";
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
