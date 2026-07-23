"use client";

import { useCallback, useEffect, useState } from "react";
import {
  REVIEW_CONSOLE_COPY as C,
  type EntityCreateRequest,
  type EntityRecord,
} from "@channelwatch/schemas";
import { EntityForm, EntityList } from "../../../components/review/index.js";
import { createEntity, fetchEntities, updateEntity } from "../../../lib/review-client.js";
import { ReviewShell } from "../ReviewShell.js";

type Editing = { entity: EntityRecord | null } | null;

export default function EntitiesPage() {
  const [entities, setEntities] = useState<EntityRecord[]>([]);
  const [editing, setEditing] = useState<Editing>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    const result = await fetchEntities();
    if (result.ok) setEntities(result.data.entities);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onSubmit = async (body: EntityCreateRequest) => {
    if (!editing) return;
    setBusy(true);
    setError(false);
    const result = editing.entity
      ? await updateEntity(editing.entity.id, body)
      : await createEntity(body);
    setBusy(false);
    if (result.ok) {
      setEditing(null);
      await reload();
    } else {
      setError(true);
    }
  };

  return (
    <ReviewShell active="entities">
      {error ? (
        <p className="cw-error" role="alert">
          {C.actionError}
        </p>
      ) : null}
      {editing ? (
        <EntityForm initial={editing.entity} busy={busy} onSubmit={onSubmit} />
      ) : (
        <EntityList
          entities={entities}
          onEdit={(entity) => setEditing({ entity })}
          onNew={() => setEditing({ entity: null })}
        />
      )}
    </ReviewShell>
  );
}
