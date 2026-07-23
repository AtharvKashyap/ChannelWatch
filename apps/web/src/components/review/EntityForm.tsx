"use client";

import { useState } from "react";
import {
  ENTITY_TYPES,
  REVIEW_CONSOLE_COPY as C,
  type EntityCreateRequest,
  type EntityRecord,
  type EntityType,
} from "@channelwatch/schemas";

/**
 * Create/edit form for an entity (§19.5 entity CRUD). Presentational: it manages
 * its own field state and raises `onSubmit` with a create/update body. When
 * `initial` is supplied it edits that entity; otherwise it creates. Copy comes
 * from the reviewed module (CLAUDE.md rule 2).
 */
export interface EntityFormProps {
  initial?: EntityRecord | null;
  busy?: boolean;
  onSubmit: (body: EntityCreateRequest) => void;
}

export function EntityForm({ initial, busy = false, onSubmit }: EntityFormProps) {
  const [entityType, setEntityType] = useState<EntityType>(
    (initial?.entity_type as EntityType) ?? "COMPANY",
  );
  const [canonicalName, setCanonicalName] = useState(initial?.canonical_name ?? "");
  const [legalName, setLegalName] = useState(initial?.legal_name ?? "");
  const [jurisdiction, setJurisdiction] = useState(initial?.jurisdiction ?? "");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

  return (
    <form
      className="cw-entity-form"
      aria-label={initial ? C.entityEditHeading : C.entityCreateHeading}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          entity_type: entityType,
          canonical_name: canonicalName.trim(),
          legal_name: legalName.trim() || null,
          jurisdiction: jurisdiction.trim() || null,
          website: website.trim() || null,
          description: description.trim() || null,
        });
      }}
    >
      <h3>{initial ? C.entityEditHeading : C.entityCreateHeading}</h3>
      <label>
        {C.entityTypeLabel}
        <select value={entityType} onChange={(e) => setEntityType(e.target.value as EntityType)}>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label>
        {C.entityCanonicalNameLabel}
        <input
          className="cw-entity-name"
          value={canonicalName}
          required
          onChange={(e) => setCanonicalName(e.target.value)}
        />
      </label>
      <label>
        {C.entityLegalNameLabel}
        <input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
      </label>
      <label>
        {C.entityJurisdictionLabel}
        <input value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} />
      </label>
      <label>
        {C.entityWebsiteLabel}
        <input value={website} onChange={(e) => setWebsite(e.target.value)} />
      </label>
      <label>
        {C.entityDescriptionLabel}
        <textarea value={description} rows={3} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <button
        type="submit"
        className="cw-entity-save"
        disabled={busy || canonicalName.trim() === ""}
      >
        {busy ? C.entitySaving : C.entitySave}
      </button>
    </form>
  );
}
