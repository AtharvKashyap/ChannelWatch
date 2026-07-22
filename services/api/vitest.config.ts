import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Integration tests connect to Postgres and can take longer than the 5s
    // default (migrate + seed + query). Pure unit tests are unaffected.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
