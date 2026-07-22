import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Integration tests connect to Postgres and can take longer than the 5s
    // default (migrate + seed + query). Pure unit tests are unaffected.
    testTimeout: 30_000,
    hookTimeout: 30_000,
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
