"use client";

import { REVIEW_CONSOLE_COPY as C, type EntityRecord } from "@channelwatch/schemas";

/**
 * List of entities with an edit affordance (§19.5 entity CRUD). Presentational:
 * raises `onEdit` with the chosen entity and `onNew` to start a create. Copy
 * comes from the reviewed module (CLAUDE.md rule 2).
 */
export interface EntityListProps {
  entities: EntityRecord[];
  onEdit: (entity: EntityRecord) => void;
  onNew: () => void;
}

export function EntityList({ entities, onEdit, onNew }: EntityListProps) {
  return (
    <section className="cw-entities" aria-label={C.entitiesHeading}>
      <h2>{C.entitiesHeading}</h2>
      <button type="button" className="cw-entity-new" onClick={onNew}>
        {C.entityNewButton}
      </button>
      {entities.length === 0 ? (
        <p className="cw-empty">{C.entitiesEmpty}</p>
      ) : (
        <table className="cw-entity-table">
          <thead>
            <tr>
              <th>{C.entityCanonicalNameLabel}</th>
              <th>{C.entityTypeLabel}</th>
              <th>{C.entityJurisdictionLabel}</th>
              <th>{C.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {entities.map((entity) => (
              <tr key={entity.id} className="cw-entity-row">
                <td className="cw-entity-cell-name">{entity.canonical_name}</td>
                <td>{entity.entity_type}</td>
                <td>{entity.jurisdiction ?? "—"}</td>
                <td>
                  <button type="button" className="cw-entity-edit" onClick={() => onEdit(entity)}>
                    {C.entityEdit}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
