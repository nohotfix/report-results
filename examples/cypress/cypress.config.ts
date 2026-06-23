import { defineConfig } from "cypress";

// Cypress runs on Mocha; mocha-junit-reporter writes the test title into <testcase name>, so the
// [nhf:<ci_key>] token in the title is what the NoHotfix on-ramp extracts.
export default defineConfig({
  reporter: "mocha-junit-reporter",
  reporterOptions: {
    mochaFile: "results.xml",
    toConsole: false,
  },
  e2e: {
    supportFile: false,
    specPattern: "e2e/**/*.cy.ts",
  },
});
