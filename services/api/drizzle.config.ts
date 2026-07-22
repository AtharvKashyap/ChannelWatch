import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit configuration. Reads DATABASE_URL from the environment (see
 * .env.example — postgres://channelwatch:channelwatch@localhost:5432/channelwatch).
 * Migrations are generated into ./migrations and committed to the repository.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://channelwatch:channelwatch@localhost:5432/channelwatch",
  },
  strict: true,
  verbose: true,
});
