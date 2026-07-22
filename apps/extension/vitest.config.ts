import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Content-script code touches the DOM; run those suites under jsdom while
    // the background/settings suites stay on the lighter node environment.
    environmentMatchGlobs: [["tests/content/**", "jsdom"]],
  },
});
