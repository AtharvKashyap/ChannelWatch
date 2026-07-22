export * from "./weights.js";
export * from "./confidence.js";
export * from "./publication.js";
export * from "./explanations.js";

// Re-exported from @channelwatch/schemas: the single source of truth for
// deriving a ConfidenceLabel from a numeric score (SPEC §14.3). Do not
// reimplement here.
export { confidenceLabelFromScore } from "@channelwatch/schemas";
