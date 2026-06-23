import { describe, expect, it } from "vitest";

// The ci_key is carried in the test NAME as a [nhf:<ci_key>] token — the universal binding the
// NoHotfix JUnit on-ramp extracts. The titles align to the 064 example seed so they light up the demo.

describe("checkout", () => {
  it("completes end to end [nhf:checkout.smoke]", () => {
    expect(1 + 1).toBe(2);
  });
});

describe("auth", () => {
  it("expires an idle session [nhf:auth.session.expiry]", () => {
    expect("ok").toBe("ok");
  });
});
