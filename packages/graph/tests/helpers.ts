import type { Entity, Relationship } from "@channelwatch/schemas";

/**
 * Test factories. Relationships are built as fully-parsed schema objects
 * (status defaults to ACTIVE unless overridden), so the graph functions receive
 * exactly the `Relationship` shape the rest of the system produces.
 */

export function rel(overrides: Partial<Relationship> & Pick<Relationship, "type">): Relationship {
  return {
    from_entity_id: "from",
    to_entity_id: "to",
    effective_from: null,
    effective_to: null,
    ownership_percentage: null,
    control_level: "UNKNOWN",
    confidence: 0.9,
    source_ids: [],
    status: "ACTIVE",
    ...overrides,
  };
}

export function entity(id: string, type: Entity["type"], name = id): Entity {
  return { id, name, type };
}

/** ISO date string offset from a base date by whole months. */
export function monthsBefore(base: Date, months: number): string {
  const d = new Date(base);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString();
}
