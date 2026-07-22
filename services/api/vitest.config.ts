import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Integration tests connect to Postgres and can take longer than the 5s
    // default (migrate + seed + query). Pure unit tests are unaffected.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Run test FILES sequentially, not in parallel workers. The two DB-gated
    // integration files (seed + research importer) write to the SAME database
    // and share the §35 example entities (example-channel.yaml reuses the
    // seed's canonical names → same deterministic ids). Both are now
    // change-detecting writers, so interleaving their runs would let them
    // ping-pong those shared rows and produce nondeterministic audit counts.
    // Serializing the files keeps each file's writes atomic w.r.t. the other;
    // the unit-test files are tiny, so the cost is negligible.
    fileParallelism: false,
  },
});
