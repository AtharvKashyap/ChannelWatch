import { z } from "zod";
import {
  EntityTypeSchema,
  RelationshipTypeSchema,
  RelationshipStatusSchema,
  ControlLevelSchema,
  SourceTypeSchema,
  SourceTierSchema,
  SOURCE_TYPE_TIERS,
} from "./enums.js";
import { YoutubeChannelId } from "./schemas.js";

/**
 * ResearchRecord: the seed-phase research file format. One YAML file per channel
 * in `data/research/`, authored by hand, reviewed in a PR, then imported into the
 * database by `services/api/scripts/import-research.ts`.
 *
 * This is the trust-critical publication boundary, so the schema enforces the
 * evidence rules that keep unsupported ownership claims out of the database:
 *
 *  - a source's declared `tier` MUST agree with the §7.1/§14.1 SourceType→tier
 *    map (`SOURCE_TYPE_TIERS`) — no manually inflating a source's tier;
 *  - every relationship MUST be backed by at least one supporting source;
 *  - a PUBLISHED (status ACTIVE) relationship may NOT be supported by any Tier 4
 *    source — Tier 4 is "leads only" (§7.1) and never backs a published edge;
 *  - slug/index references (relationship subject/object, source `supports`,
 *    claim subject/object) MUST resolve.
 *
 * The PE-label rule (§14.3 `canPublishPeLabel`) is enforced separately by the
 * importer, which owns the `@channelwatch/scoring` dependency; keeping it out of
 * this schema avoids a schemas→scoring dependency cycle. Classification is NEVER
 * part of this record: the importer COMPUTES it from the imported relationships
 * via `@channelwatch/graph`.
 */

/** A local slug referencing an entity declared in the same record, or the literal "channel". */
const RefTarget = z.string().min(1);

/**
 * A full ISO calendar date, `YYYY-MM-DD`. The date-typed record fields
 * (relationship `effective_from`/`effective_to`, claim `effective_date`) map to
 * Postgres `DATE` columns, which reject partial dates like `2018-09` or `2011`.
 * Enforcing the full-date shape at the schema boundary turns those into a clear
 * validation error instead of an opaque database import failure (pilot gap): a
 * date known only to the month/year must be omitted, never truncated.
 */
const FullDate = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "must be a full ISO date in YYYY-MM-DD form (partial dates like 2018-09 are not allowed; omit the field if the exact day is unknown)",
  );

/** The six §14.2 confidence multipliers; all required so `scoreClaimConfidence` never receives a hole. */
export const ConfidenceFactorsSchema = z.object({
  sourceQuality: z.number().min(0).max(1),
  directness: z.number().min(0).max(1),
  entityMatch: z.number().min(0).max(1),
  recencyFactor: z.number().min(0).max(1),
  corroborationFactor: z.number().min(0).max(1),
  contradictionPenalty: z.number().min(0).max(1),
});
export type ConfidenceFactorsInput = z.infer<typeof ConfidenceFactorsSchema>;

const ResearchEntity = z.object({
  slug: z.string().min(1),
  canonical_name: z.string().min(1),
  entity_type: EntityTypeSchema,
  legal_name: z.string().min(1).optional(),
  jurisdiction: z.string().min(1).optional(),
  website: z.string().min(1).optional(),
  aliases: z.array(z.string().min(1)).optional(),
});
export type ResearchEntity = z.infer<typeof ResearchEntity>;

const ResearchRelationship = z.object({
  subject: RefTarget,
  type: RelationshipTypeSchema,
  object: RefTarget,
  ownership_percentage: z.number().min(0).max(100).optional(),
  control_level: ControlLevelSchema.optional(),
  effective_from: FullDate.optional(),
  effective_to: FullDate.optional(),
  confidence: z.number().min(0).max(1),
  status: RelationshipStatusSchema,
});
export type ResearchRelationship = z.infer<typeof ResearchRelationship>;

/** A support link: references a relationship or a claim in the same record by index. */
const SupportRef = z.union([
  z.object({ relationship: z.number().int().nonnegative() }).strict(),
  z.object({ claim: z.number().int().nonnegative() }).strict(),
]);
export type SupportRef = z.infer<typeof SupportRef>;

const ResearchSource = z.object({
  ref: z.string().min(1),
  url: z.url(),
  title: z.string().min(1),
  publisher: z.string().min(1).optional(),
  published_at: z.string().min(1).optional(),
  source_type: SourceTypeSchema,
  tier: SourceTierSchema,
  archive_url: z.url().optional(),
  excerpt: z.string().max(500, "excerpt must be 500 characters or fewer"),
  supports: z.array(SupportRef),
});
export type ResearchSource = z.infer<typeof ResearchSource>;

const ResearchClaim = z.object({
  predicate: z.string().min(1),
  subject: RefTarget,
  object: RefTarget,
  effective_date: FullDate.optional(),
  confidence_factors: ConfidenceFactorsSchema.optional(),
});
export type ResearchClaim = z.infer<typeof ResearchClaim>;

const ResearchReview = z.object({
  researched_by: z.string().min(1),
  reviewed_by: z.string().min(1).optional(),
  notes: z.string().optional(),
  last_reviewed_at: z.string().min(1),
});
export type ResearchReview = z.infer<typeof ResearchReview>;

const CHANNEL_REF = "channel";

/**
 * ResearchRecord — the full record with all cross-field evidence refinements
 * except the PE-label rule (enforced by the importer; see the module doc).
 */
export const ResearchRecord = z
  .object({
    // Fictional example records set `fixture: true`; the importer only processes
    // them when invoked with `--include-fixtures`, keeping them out of real data.
    fixture: z.boolean().optional(),
    channel: z.object({
      youtube_channel_id: YoutubeChannelId,
      display_name: z.string().min(1),
      handle: z.string().min(1).optional(),
    }),
    entities: z.array(ResearchEntity),
    relationships: z.array(ResearchRelationship),
    sources: z.array(ResearchSource),
    claims: z.array(ResearchClaim).optional(),
    review: ResearchReview,
  })
  .superRefine((record, ctx) => {
    const slugs = new Set<string>();
    record.entities.forEach((entity, i) => {
      if (slugs.has(entity.slug)) {
        ctx.addIssue({
          code: "custom",
          message: `duplicate entity slug "${entity.slug}"`,
          path: ["entities", i, "slug"],
        });
      }
      slugs.add(entity.slug);
    });

    const resolves = (ref: string): boolean => ref === CHANNEL_REF || slugs.has(ref);

    // Source refs must be unique (they are the source natural key within a file).
    const refs = new Set<string>();
    record.sources.forEach((source, i) => {
      if (refs.has(source.ref)) {
        ctx.addIssue({
          code: "custom",
          message: `duplicate source ref "${source.ref}"`,
          path: ["sources", i, "ref"],
        });
      }
      refs.add(source.ref);

      // A source's declared tier must agree with the taxonomy tier for its type.
      const expectedTier = SOURCE_TYPE_TIERS[source.source_type];
      if (source.tier !== expectedTier) {
        ctx.addIssue({
          code: "custom",
          message: `source "${source.ref}" declares tier ${source.tier} but source_type ${source.source_type} is Tier ${expectedTier}`,
          path: ["sources", i, "tier"],
        });
      }
    });

    // Relationship endpoints must resolve to "channel" or a declared entity slug.
    record.relationships.forEach((rel, i) => {
      if (!resolves(rel.subject)) {
        ctx.addIssue({
          code: "custom",
          message: `relationship subject "${rel.subject}" is not "channel" or a declared entity slug`,
          path: ["relationships", i, "subject"],
        });
      }
      if (!resolves(rel.object)) {
        ctx.addIssue({
          code: "custom",
          message: `relationship object "${rel.object}" is not "channel" or a declared entity slug`,
          path: ["relationships", i, "object"],
        });
      }
    });

    // Claim endpoints must resolve too.
    (record.claims ?? []).forEach((claim, i) => {
      if (!resolves(claim.subject)) {
        ctx.addIssue({
          code: "custom",
          message: `claim subject "${claim.subject}" is not "channel" or a declared entity slug`,
          path: ["claims", i, "subject"],
        });
      }
      if (!resolves(claim.object)) {
        ctx.addIssue({
          code: "custom",
          message: `claim object "${claim.object}" is not "channel" or a declared entity slug`,
          path: ["claims", i, "object"],
        });
      }
    });

    // Every `supports` index must be in range. Track, per relationship index, the
    // supporting source tiers so we can enforce the support and Tier-4 rules.
    const supportTiersByRel = new Map<number, number[]>();
    record.sources.forEach((source, si) => {
      source.supports.forEach((support, spi) => {
        if ("relationship" in support) {
          if (support.relationship >= record.relationships.length) {
            ctx.addIssue({
              code: "custom",
              message: `source "${source.ref}" supports relationship index ${support.relationship}, which does not exist`,
              path: ["sources", si, "supports", spi, "relationship"],
            });
            return;
          }
          const tiers = supportTiersByRel.get(support.relationship) ?? [];
          tiers.push(source.tier);
          supportTiersByRel.set(support.relationship, tiers);
        } else {
          const claimCount = record.claims?.length ?? 0;
          if (support.claim >= claimCount) {
            ctx.addIssue({
              code: "custom",
              message: `source "${source.ref}" supports claim index ${support.claim}, which does not exist`,
              path: ["sources", si, "supports", spi, "claim"],
            });
          }
        }
      });
    });

    // Every relationship needs >=1 supporting source; a PUBLISHED (ACTIVE) edge
    // may not be backed by a Tier 4 source (Tier 4 is leads-only, §7.1).
    record.relationships.forEach((rel, i) => {
      const tiers = supportTiersByRel.get(i) ?? [];
      if (tiers.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: `relationship ${i} (${rel.subject} ${rel.type} ${rel.object}) has no supporting source`,
          path: ["relationships", i],
        });
        return;
      }
      if (rel.status === "ACTIVE" && tiers.some((t) => t === 4)) {
        ctx.addIssue({
          code: "custom",
          message: `relationship ${i} (${rel.subject} ${rel.type} ${rel.object}) is published (ACTIVE) but supported by a Tier 4 source; Tier 4 is leads-only and cannot back a published relationship`,
          path: ["relationships", i],
        });
      }
    });
  });
export type ResearchRecord = z.infer<typeof ResearchRecord>;
