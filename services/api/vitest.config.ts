import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Integration tests connect to Postgres and can take longer than the 5s
    // default. The DB-gated beforeAll hooks migrate + import the full research
    // dataset (244+ records, a whole-graph recompute over ~250 channels), which
    // runs ~20-30s and grows with the dataset — well past the 30s default in CI.
    // Pure unit tests are unaffected (they finish in milliseconds).
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Run test FILES sequentially, not in parallel workers. The DB-gated
    // integration files (seed, research importer, endpoints) all write to the
    // SAME database; serializing them keeps each file's writes atomic w.r.t. the
    // others and their row counts deterministic. (The seed and the §35 importer
    // fixture are now fully id-disjoint — the fixture uses "Fixture …" names, a
    // fixture-only reviewer, and fixture URLs — so they no longer contend for
    // shared rows; serialization is retained for general DB isolation.) The
    // unit-test files are tiny, so the cost is negligible.
    fileParallelism: false,
  },
});
