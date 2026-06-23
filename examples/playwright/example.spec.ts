import { expect, test } from "@playwright/test";

// Trivial, browserless assertions — enough to emit a real Playwright JUnit report. The ci_key rides
// in the test title. (A real suite would also use Playwright annotations; the title token is the
// universal path the Action relies on.)
test("checkout completes end to end [nhf:checkout.smoke]", () => {
  expect(1 + 1).toBe(2);
});

test("auth expires an idle session [nhf:auth.session.expiry]", () => {
  expect("ok").toBe("ok");
});
