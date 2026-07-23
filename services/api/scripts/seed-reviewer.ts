import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { getDb, closeDb, type Database } from "../src/db/client.js";
import { auditEvents, reviewers } from "../src/db/schema.js";
import { reviewerId } from "../src/db/deterministic-ids.js";
import { hashPassword } from "../src/auth/passwords.js";

/**
 * Provision the FIRST reviewer account (there is no public signup). Env-driven
 * and idempotent: run
 *
 *   REVIEWER_EMAIL=you@example.com REVIEWER_PASSWORD='…' \
 *   REVIEWER_NAME='Your Name' REVIEWER_ROLE=REVIEWER \
 *   pnpm --filter @channelwatch/api db:seed-reviewer
 *
 * The reviewer id is derived deterministically from the email (the same scheme
 * the dataset seed uses), so re-running with the same email updates that one row
 * rather than creating duplicates. The password is stored ONLY as a scrypt
 * verifier (never plaintext). Provisioning is audited.
 */

export interface SeedReviewerInput {
  email: string;
  password: string;
  displayName?: string;
  role?: string;
}

export async function seedReviewer(
  db: Database,
  input: SeedReviewerInput,
): Promise<{ id: string; created: boolean }> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("REVIEWER_EMAIL is required.");
  if (!input.password || input.password.length < 12) {
    throw new Error("REVIEWER_PASSWORD is required and must be at least 12 characters.");
  }
  const id = reviewerId(email);
  const passwordHash = await hashPassword(input.password);
  const displayName = input.displayName ?? null;
  const role = input.role ?? "REVIEWER";

  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(reviewers).where(eq(reviewers.id, id));
    if (existing) {
      await tx
        .update(reviewers)
        .set({ email, displayName, role, passwordHash })
        .where(eq(reviewers.id, id));
      await tx.insert(auditEvents).values({
        actorId: id,
        action: "PROVISION_REVIEWER",
        objectType: "reviewer",
        objectId: id,
        beforeState: { email: existing.email, has_credential: Boolean(existing.passwordHash) },
        afterState: { email, has_credential: true, updated: true },
      });
      return { id, created: false };
    }
    await tx.insert(reviewers).values({ id, email, displayName, role, passwordHash });
    await tx.insert(auditEvents).values({
      actorId: id,
      action: "PROVISION_REVIEWER",
      objectType: "reviewer",
      objectId: id,
      beforeState: null,
      afterState: { email, has_credential: true, created: true },
    });
    return { id, created: true };
  });
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set (see .env.example).");
  const email = process.env.REVIEWER_EMAIL;
  const password = process.env.REVIEWER_PASSWORD;
  if (!email || !password) {
    throw new Error("Set REVIEWER_EMAIL and REVIEWER_PASSWORD in the environment.");
  }
  const result = await seedReviewer(getDb(), {
    email,
    password,
    displayName: process.env.REVIEWER_NAME,
    role: process.env.REVIEWER_ROLE,
  });
  console.log(
    `reviewer ${result.created ? "created" : "updated"}: ${email} (id ${result.id})`,
  );
  await closeDb();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
