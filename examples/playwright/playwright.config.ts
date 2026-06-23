import { defineConfig } from "@playwright/test";

// Built-in JUnit reporter → results.xml. Playwright writes the test title into <testcase name>,
// so the [nhf:<ci_key>] token in the title is what the NoHotfix on-ramp extracts.
export default defineConfig({
  reporter: [["junit", { outputFile: "results.xml" }]],
});
