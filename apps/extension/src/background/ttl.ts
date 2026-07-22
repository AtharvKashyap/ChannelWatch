import { CACHE_TTLS, type ChannelLookupPayload } from "@channelwatch/schemas";

/**
 * Outcome of an attempted lookup, prior to caching. `error` covers network
 * failures, timeouts, non-2xx responses, and responses that fail schema
 * validation — anything that isn't a trustworthy payload from the API.
 */
export type LookupOutcome = { kind: "error" } | { kind: "success"; payload: ChannelLookupPayload };

/**
 * Selects the local-cache TTL for a lookup outcome (SPEC §18.6):
 *
 *   Confirmed record:          7 days  (confidence_label === "CONFIRMED")
 *   Disputed record:           1 hour  (payload.disputed)
 *   Recently changed record:   6 hours (OWNERSHIP_CHANGED_RECENTLY warning)
 *   Unknown channel:           24 hours (unresearched, or researched but none
 *                               of the above apply)
 *   API error:                 10 minutes
 *
 * A researched record can match more than one condition at once (e.g. a
 * CONFIRMED record that is also under active dispute). When that happens we
 * take the SHORTEST matching TTL rather than a fixed priority order: the more
 * volatile state should always win, since re-checking sooner is always safe
 * and never loses correctness.
 */
export function selectTtlMs(outcome: LookupOutcome): number {
  if (outcome.kind === "error") return CACHE_TTLS.apiError;

  const { payload } = outcome;
  if (!payload.researched) return CACHE_TTLS.unknown;

  const candidates: number[] = [];
  if (payload.disputed) candidates.push(CACHE_TTLS.disputed);
  if (payload.warnings.includes("OWNERSHIP_CHANGED_RECENTLY")) {
    candidates.push(CACHE_TTLS.recentlyChanged);
  }
  if (payload.classification.confidence_label === "CONFIRMED") {
    candidates.push(CACHE_TTLS.confirmed);
  }

  return candidates.length > 0 ? Math.min(...candidates) : CACHE_TTLS.unknown;
}
