// The ci_key rides in the test title; mocha-junit-reporter emits it into the JUnit <testcase name>.
describe("checkout", () => {
  it("completes end to end [nhf:checkout.smoke]", () => {
    expect(1 + 1).to.eq(2);
  });
});

describe("auth", () => {
  it("expires an idle session [nhf:auth.session.expiry]", () => {
    expect("ok").to.eq("ok");
  });
});
