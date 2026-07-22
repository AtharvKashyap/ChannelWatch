import { eq } from "drizzle-orm";
import type { Database } from "./client.js";

/**
 * Change-detected single-row upsert, shared by every write path (the
 * research-record importer and the §35 seed). Extracted from the importer so the
 * two paths use ONE definition of "did this row actually change?" — the property
 * the audit trail depends on: a row is only INSERTed/UPDATEd (and only then does
 * it emit an `audit_events` row) when its content differs from what is stored.
 * Re-running an unchanged write is a true no-op: zero writes, zero new audits.
 */

/**
 * A drizzle executor: either the top-level db or an open transaction handle. A
 * write path runs inside a single transaction, so the helper accepts whichever
 * is in scope.
 */
export type Executor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export type SyncResult = "inserted" | "updated" | "unchanged";

/** Normalize a value for change comparison: null/undefined collapse; Dates compare by epoch ms. */
export function normalizeForCompare(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.getTime();
  return value;
}

/**
 * Change-detected upsert of a single row keyed by its deterministic `id`.
 * Returns whether the row was inserted, updated, or left untouched, and the
 * before/after states for the audit trail. Only the columns in `desired` (minus
 * `id`) are compared and written.
 */
export async function syncRow(
  db: Executor,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any,
  id: string,
  desired: Record<string, unknown>,
): Promise<{ result: SyncResult; before: unknown; after: unknown }> {
  const [existing] = await db.select().from(table).where(eq(table.id, id));
  if (!existing) {
    await db.insert(table).values({ id, ...desired });
    return { result: "inserted", before: null, after: { id, ...desired } };
  }
  const changed = Object.keys(desired).some(
    (k) => normalizeForCompare(existing[k]) !== normalizeForCompare(desired[k]),
  );
  if (!changed) return { result: "unchanged", before: existing, after: existing };
  await db.update(table).set(desired).where(eq(table.id, id));
  return { result: "updated", before: existing, after: { ...existing, ...desired } };
}
