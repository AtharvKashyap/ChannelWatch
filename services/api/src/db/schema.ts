import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  integer,
  date,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

/**
 * CHANNELWATCH database schema (SPEC §16). Column names and types follow the
 * §16 DDL verbatim; the `reviewers` table is added for review provenance.
 *
 * ENUM-VALUED COLUMNS ARE PLAIN TEXT ON PURPOSE. This schema declares no
 * Postgres ENUM types. Every enum-valued column (entity_type, relationship_type,
 * control_level, research_status, published_classification, claim_status,
 * source_type, evidence status, reviewer role, …) is TEXT, and its allowed
 * values are validated at the application boundary via `@channelwatch/schemas`
 * (the Zod enums are the single source of truth). This keeps the SPEC enum lists
 * in one place and lets them evolve without a database migration.
 *
 * UUID primary keys use `defaultRandom()`; timestamps are `timestamptz`;
 * percentages and confidences are `numeric` (surfaced as strings by the driver
 * and coerced in the mappers).
 */

export const channels = pgTable(
  "channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    youtubeChannelId: text("youtube_channel_id").notNull(),
    handle: text("handle"),
    displayName: text("display_name").notNull(),
    description: text("description"),
    channelUrl: text("channel_url"),
    countryCode: text("country_code"),
    thumbnailUrl: text("thumbnail_url"),
    subscriberRange: text("subscriber_range"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    researchStatus: text("research_status"),
    publishedClassification: text("published_classification"),
    classificationConfidence: numeric("classification_confidence"),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex("channels_youtube_channel_id_key").on(t.youtubeChannelId)],
);

export const entities = pgTable("entities", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: text("entity_type").notNull(),
  canonicalName: text("canonical_name").notNull(),
  legalName: text("legal_name"),
  jurisdiction: text("jurisdiction"),
  registryIdentifier: text("registry_identifier"),
  website: text("website"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const entityAliases = pgTable("entity_aliases", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id").references(() => entities.id),
  alias: text("alias").notNull(),
  aliasType: text("alias_type"),
  sourceId: uuid("source_id"),
});

export const relationships = pgTable(
  "relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectEntityId: uuid("subject_entity_id").references(() => entities.id),
    subjectChannelId: uuid("subject_channel_id").references(() => channels.id),
    relationshipType: text("relationship_type").notNull(),
    objectEntityId: uuid("object_entity_id").references(() => entities.id),
    objectChannelId: uuid("object_channel_id").references(() => channels.id),
    ownershipPercentage: numeric("ownership_percentage"),
    controlLevel: text("control_level"),
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    confidence: numeric("confidence"),
    status: text("status"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("relationships_subject_channel_id_idx").on(t.subjectChannelId),
    index("relationships_object_entity_id_idx").on(t.objectEntityId),
  ],
);

export const sources = pgTable("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").notNull(),
  title: text("title"),
  publisher: text("publisher"),
  author: text("author"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  retrievedAt: timestamp("retrieved_at", { withTimezone: true }),
  sourceTier: integer("source_tier"),
  sourceType: text("source_type"),
  archiveUrl: text("archive_url"),
  contentHash: text("content_hash"),
  status: text("status"),
});

export const claims = pgTable(
  "claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectType: text("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    predicate: text("predicate").notNull(),
    objectType: text("object_type"),
    objectId: uuid("object_id"),
    literalValue: jsonb("literal_value"),
    confidence: numeric("confidence"),
    claimStatus: text("claim_status"),
    effectiveDate: date("effective_date"),
    expirationDate: date("expiration_date"),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("claims_subject_id_idx").on(t.subjectId)],
);

export const claimSources = pgTable(
  "claim_sources",
  {
    claimId: uuid("claim_id")
      .notNull()
      .references(() => claims.id),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id),
    supportType: text("support_type"),
    quotedExcerpt: text("quoted_excerpt"),
    locator: text("locator"),
  },
  (t) => [primaryKey({ columns: [t.claimId, t.sourceId] })],
);

export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  claimId: uuid("claim_id").references(() => claims.id),
  reviewerId: uuid("reviewer_id"),
  decision: text("decision"),
  reasoning: text("reasoning"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export const correctionRequests = pgTable("correction_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  channelId: uuid("channel_id"),
  claimId: uuid("claim_id"),
  submitterName: text("submitter_name"),
  submitterEmail: text("submitter_email"),
  submitterRelationship: text("submitter_relationship"),
  explanation: text("explanation"),
  status: text("status"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolution: text("resolution"),
});

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    objectType: text("object_type").notNull(),
    objectId: uuid("object_id"),
    beforeState: jsonb("before_state"),
    afterState: jsonb("after_state"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("audit_events_object_id_idx").on(t.objectId)],
);

/**
 * Reviewers (not in the §16 DDL, added here). Review provenance: `reviews` and
 * `audit_events` reference a reviewer id. `role` is enum-valued TEXT validated
 * at the boundary.
 */
export const reviewers = pgTable("reviewers", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  role: text("role"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
