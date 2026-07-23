import type { Database } from "./client.js";
import { deriveForChannel } from "./queries.js";
import { syncRow } from "./sync-row.js";
import { auditEvents, channels } from "./schema.js";

/**
 * The SINGLE WRITER of the cached `channels.published_classification` column.
 *
 * `published_classification` is a denormalized cache of the graph-derived label
 * (docs/data-model.md). To keep it explainable and consistent, exactly ONE code
 * path may write it: this whole-graph recompute. Every other path — the
 * research-record importer, the reviewer console's claim approvals — mutates the
 * underlying data and then calls THIS function, rather than writing the column
 * directly. (Formerly defined in `scripts/import-research.ts`; extracted here so
 * both the importer and the authed reviewer routes can invoke the same writer.)
 *
 * It re-derives every channel's classification exactly as the public API does
 * (via `deriveForChannel`) and writes the result back, mirroring the API
 * assembler's degraded-fallback rule: the whole-graph live derivation is
 * authoritative UNLESS it is degraded (no ownership evidence, or an
 * OWNERSHIP_UNCLEAR caused by a sub-graph row that had to be skipped), in which
 * case the existing cached label is left in place as the honest fallback.
 * Change-detected: an unchanged channel is not rewritten and emits no audit.
 */

export const RECOMPUTE_ACTION = "RECOMPUTE_CLASSIFICATION";

export interface RecomputeSummary {
  channelId: string;
  youtubeChannelId: string;
  classification: string;
  classificationConfidence: number;
  /** True when the cached column was actually rewritten (produced an audit row). */
  changed: boolean;
}

export async function recomputeClassifications(db: Database): Promise<RecomputeSummary[]> {
  const channelRows = await db.select().from(channels);
  const summaries: RecomputeSummary[] = [];
  for (const channel of channelRows) {
    const { result, skipped } = await deriveForChannel(db, channel);
    const noEvidence = result.explanationCodes.includes("NO_OWNERSHIP_EVIDENCE");
    const degraded = noEvidence || (skipped > 0 && result.classification === "OWNERSHIP_UNCLEAR");
    if (degraded) {
      summaries.push({
        channelId: channel.id,
        youtubeChannelId: channel.youtubeChannelId,
        classification: channel.publishedClassification ?? result.classification,
        classificationConfidence: channel.classificationConfidence
          ? Number(channel.classificationConfidence)
          : result.confidence,
        changed: false,
      });
      continue;
    }

    const synced = await syncRow(db, channels, channel.id, {
      publishedClassification: result.classification,
      classificationConfidence: String(result.confidence),
    });
    if (synced.result !== "unchanged") {
      await db.insert(auditEvents).values({
        actorId: null,
        action: RECOMPUTE_ACTION,
        objectType: "channel",
        objectId: channel.id,
        beforeState: (synced.before ?? null) as object | null,
        afterState: (synced.after ?? null) as object | null,
      });
    }
    summaries.push({
      channelId: channel.id,
      youtubeChannelId: channel.youtubeChannelId,
      classification: result.classification,
      classificationConfidence: result.confidence,
      changed: synced.result !== "unchanged",
    });
  }
  return summaries;
}
