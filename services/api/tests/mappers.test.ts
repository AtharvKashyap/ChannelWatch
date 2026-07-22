import { describe, it, expect } from "vitest";
import {
  rowToEntity,
  rowToRelationship,
  rowToSource,
  rowToClaim,
  type EntityRow,
  type RelationshipRow,
  type SourceRow,
  type ClaimRow,
} from "../src/db/mappers.js";

/**
 * Pure mapper unit tests — no database. They pin the row→domain translation:
 * §16 column names/driver representations in, `@channelwatch/schemas` shapes out.
 */

const entityRow: EntityRow = {
  id: "11111111-1111-5111-8111-111111111111",
  entityType: "PRIVATE_EQUITY_FIRM",
  canonicalName: "Example Capital Partners",
  legalName: "Example Capital Partners, L.P.",
  jurisdiction: null,
  registryIdentifier: null,
  website: null,
  description: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

function relRow(overrides: Partial<RelationshipRow> = {}): RelationshipRow {
  return {
    id: "22222222-2222-5222-8222-222222222222",
    subjectEntityId: "aaaa1111-1111-5111-8111-111111111111",
    subjectChannelId: null,
    relationshipType: "OWNS",
    objectEntityId: null,
    objectChannelId: "cccc1111-1111-5111-8111-111111111111",
    ownershipPercentage: null,
    controlLevel: "CONTROLLING",
    effectiveFrom: "2025-03-12",
    effectiveTo: null,
    confidence: "0.93",
    status: "ACTIVE",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("rowToEntity", () => {
  it("maps canonical_name -> name and entity_type -> type", () => {
    const e = rowToEntity(entityRow);
    expect(e).toEqual({
      id: entityRow.id,
      name: "Example Capital Partners",
      type: "PRIVATE_EQUITY_FIRM",
    });
  });

  it("rejects an unknown entity type at the boundary", () => {
    expect(() => rowToEntity({ ...entityRow, entityType: "BANK" })).toThrow();
  });
});

describe("rowToRelationship", () => {
  it("collapses subject entity + object channel to from/to and coerces numeric confidence", () => {
    const r = rowToRelationship(relRow());
    expect(r.from_entity_id).toBe("aaaa1111-1111-5111-8111-111111111111");
    expect(r.to_entity_id).toBe("cccc1111-1111-5111-8111-111111111111");
    expect(r.confidence).toBeCloseTo(0.93, 10);
    expect(r.control_level).toBe("CONTROLLING");
    expect(r.status).toBe("ACTIVE");
    expect(r.effective_from).toBe("2025-03-12");
  });

  it("defaults null control_level/status to UNKNOWN/ACTIVE", () => {
    const r = rowToRelationship(relRow({ controlLevel: null, status: null }));
    expect(r.control_level).toBe("UNKNOWN");
    expect(r.status).toBe("ACTIVE");
  });

  it("uses channel id as the subject endpoint when subject is a channel", () => {
    const r = rowToRelationship(
      relRow({
        subjectEntityId: null,
        subjectChannelId: "dddd1111-1111-5111-8111-111111111111",
        objectEntityId: "eeee1111-1111-5111-8111-111111111111",
        objectChannelId: null,
        relationshipType: "HOSTED_BY",
      }),
    );
    expect(r.from_entity_id).toBe("dddd1111-1111-5111-8111-111111111111");
    expect(r.to_entity_id).toBe("eeee1111-1111-5111-8111-111111111111");
  });

  it("throws when neither object endpoint is set", () => {
    expect(() =>
      rowToRelationship(relRow({ objectEntityId: null, objectChannelId: null })),
    ).toThrow(/object endpoint/);
  });

  it("coerces a null confidence to 0", () => {
    expect(rowToRelationship(relRow({ confidence: null })).confidence).toBe(0);
  });
});

describe("rowToSource", () => {
  it("maps source_tier/status and nullable archive fields", () => {
    const row: SourceRow = {
      id: "33333333-3333-5333-8333-333333333333",
      url: "https://example.com/press",
      title: "Example Media Acquires Example Channel",
      publisher: "Example Media",
      author: null,
      publishedAt: new Date("2025-03-12T00:00:00Z"),
      retrievedAt: new Date("2025-03-13T00:00:00Z"),
      sourceTier: 1,
      sourceType: "OFFICIAL_ACQUISITION_ANNOUNCEMENT",
      archiveUrl: null,
      contentHash: null,
      status: "ACTIVE",
    };
    const s = rowToSource(row);
    expect(s.tier).toBe(1);
    expect(s.status).toBe("ACTIVE");
    expect(s.retrieved_at).toBe("2025-03-13T00:00:00.000Z");
  });
});

describe("rowToClaim", () => {
  it("maps the §16 subject/predicate/object columns", () => {
    const row: ClaimRow = {
      id: "44444444-4444-5444-8444-444444444444",
      subjectType: "CHANNEL",
      subjectId: "cccc1111-1111-5111-8111-111111111111",
      predicate: "OWNED_BY",
      objectType: "ENTITY",
      objectId: "aaaa1111-1111-5111-8111-111111111111",
      literalValue: null,
      confidence: "0.93",
      claimStatus: "PUBLISHED",
      effectiveDate: "2025-03-12",
      expirationDate: null,
      reviewNotes: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    };
    const c = rowToClaim(row);
    expect(c.subject_type).toBe("CHANNEL");
    expect(c.predicate).toBe("OWNED_BY");
    expect(c.object_id).toBe("aaaa1111-1111-5111-8111-111111111111");
    expect(c.confidence).toBeCloseTo(0.93, 10);
    expect(c.claim_status).toBe("PUBLISHED");
  });

  it("rejects an invalid claim_status at the boundary", () => {
    expect(() =>
      rowToClaim({
        id: "44444444-4444-5444-8444-444444444444",
        subjectType: "CHANNEL",
        subjectId: "cccc1111-1111-5111-8111-111111111111",
        predicate: "OWNED_BY",
        objectType: null,
        objectId: null,
        literalValue: null,
        confidence: null,
        claimStatus: "APPROVED",
        effectiveDate: null,
        expirationDate: null,
        reviewNotes: null,
        createdAt: null,
        updatedAt: null,
      }),
    ).toThrow();
  });
});
