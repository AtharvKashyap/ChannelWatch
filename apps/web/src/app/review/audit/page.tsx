"use client";

import { useCallback, useEffect, useState } from "react";
import { type AuditEventItem } from "@channelwatch/schemas";
import { AuditTable } from "../../../components/review/index.js";
import { fetchAudit } from "../../../lib/review-client.js";
import { ReviewShell } from "../ReviewShell.js";

const PAGE_SIZE = 25;

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEventItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [subjectDraft, setSubjectDraft] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");

  const load = useCallback(async (subject: string, off: number) => {
    const result = await fetchAudit({
      subjectId: subject || undefined,
      limit: PAGE_SIZE,
      offset: off,
    });
    if (result.ok) {
      setEvents(result.data.events);
      setTotal(result.data.count);
    }
  }, []);

  useEffect(() => {
    void load(subjectFilter, offset);
  }, [load, subjectFilter, offset]);

  return (
    <ReviewShell active="audit">
      <AuditTable
        events={events}
        subjectFilter={subjectDraft}
        onSubjectFilterChange={setSubjectDraft}
        onApplyFilter={() => {
          setOffset(0);
          setSubjectFilter(subjectDraft.trim());
        }}
        canPrev={offset > 0}
        canNext={offset + PAGE_SIZE < total}
        onPrev={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
        onNext={() => setOffset((o) => o + PAGE_SIZE)}
      />
    </ReviewShell>
  );
}
