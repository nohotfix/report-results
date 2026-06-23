// jest-junit writes the test name into the JUnit <testcase name>, so the [nhf:<ci_key>] token in the
// title is what the NoHotfix on-ramp extracts.

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
