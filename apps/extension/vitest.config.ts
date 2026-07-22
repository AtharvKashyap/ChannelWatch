import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    environment: "node",
    setupFiles: ["tests/setup/react-act.ts"],
    // Content-script + UI code touches the DOM; run those suites under jsdom
    // while the background/settings suites stay on the lighter node environment.
    environmentMatchGlobs: [
      ["tests/content/**", "jsdom"],
      ["tests/ui/**", "jsdom"],
    ],
  },
});
