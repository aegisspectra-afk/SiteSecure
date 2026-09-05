/**
 * Task 13C — client types for server SystemRecommendation (consumed by Task 13D UI).
 * Source of truth: POST /api/v1/workspaces/{id}/cctv/recommend
 */

export type ResolutionStatus = "RESOLVED" | "PARTIAL" | "UNRESOLVED" | "MANUAL_REVIEW";
export type ResolutionConfidence = "STRUCTURED" | "PARTIAL" | "TEXT_ASSISTED" | "UNRESOLVED";

export type ReasonCode = { code: string; params?: Record<string, unknown> };

export type RecommendationProductSummary = {
  id: string;
  sku?: string | null;
  name?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  category_key?: string | null;
  unit?: string | null;
  list_price?: number | null;
  attributes?: Record<string, unknown>;
};

export type RecommendationCandidate = {
  product: RecommendationProductSummary;
  confidence: ResolutionConfidence;
  compatibility?: Record<string, string>;
  reason_codes?: ReasonCode[];
};

export type RecommendationComponent = {
  role: string;
  label: string;
  quantity: number;
  technical_requirements: Record<string, unknown>;
  selected_product?: RecommendationProductSummary | null;
  selected_confidence?: ResolutionConfidence | null;
  selected_compatibility?: Record<string, string> | null;
  candidates: RecommendationCandidate[];
  resolution_status: ResolutionStatus;
  reason_codes: ReasonCode[];
  optional: boolean;
  editable: boolean;
  blocking: boolean;
};

export type SystemRecommendation = {
  system_type: "cctv";
  engine_version: number;
  input: Record<string, unknown>;
  engineering: Record<string, unknown>;
  components: RecommendationComponent[];
  warnings: ReasonCode[];
  assumptions: ReasonCode[];
  unresolved: ReasonCode[];
  blocking: boolean;
  status: "OK" | "BLOCKED" | "INVALID_INPUT";
  catalog_stats?: {
    products_examined?: number;
    by_family?: Record<string, number>;
    fetch?: { categories?: number; fetched?: number };
    query_strategy?: string;
  };
};
