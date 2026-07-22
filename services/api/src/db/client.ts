import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

/**
 * Lazy Postgres connection. The pool (and the Drizzle instance wrapping it) are
 * created on first use, not at import time, so importing this module — or the
 * Hono app — never opens a socket. This is what lets the API be imported in
 * tests and CI where no database exists.
 */

export type Database = ReturnType<typeof drizzle<typeof schema>>;

let sql: ReturnType<typeof postgres> | undefined;
let db: Database | undefined;

function resolveUrl(url?: string): string {
  const resolved = url ?? process.env.DATABASE_URL;
  if (!resolved) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env or export DATABASE_URL " +
        "(postgres://channelwatch:channelwatch@localhost:5432/channelwatch).",
    );
  }
  return resolved;
}

/** Get the shared lazy Drizzle client, creating the pool on first call. */
export function getDb(url?: string): Database {
  if (!db) {
    sql = postgres(resolveUrl(url), { max: 10 });
    db = drizzle(sql, { schema });
  }
  return db;
}

/** Get the raw postgres-js client (used for health pings and migrations). */
export function getSql(url?: string): ReturnType<typeof postgres> {
  if (!sql) {
    sql = postgres(resolveUrl(url), { max: 10 });
    db = drizzle(sql, { schema });
  }
  return sql;
}

/** Close the pool if it was opened. Safe to call when nothing was created. */
export async function closeDb(): Promise<void> {
  if (sql) {
    await sql.end({ timeout: 5 });
    sql = undefined;
    db = undefined;
  }
}

export { schema };
