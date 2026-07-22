import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "node:url";

/**
 * Apply committed SQL migrations from ./migrations. Uses a dedicated
 * single-connection client (max: 1) as drizzle-kit recommends for migrations,
 * and closes it on completion.
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set (see .env.example).");
  }
  const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder });
    console.log("migrations applied");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
