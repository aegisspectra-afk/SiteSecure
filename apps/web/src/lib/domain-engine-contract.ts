/**
 * C1 — thin engine envelope CCTV already satisfies.
 * Does not change cctv_sizing / cctv_recommend / Apply / pricing.recalculate.
 */
import type { SystemRecommendation } from "@site-secure/api-client";

export const ENGINE_STAGES = [
  "requirements",
  "validate",
  "calculate",
  "roles",
  "catalog_resolve",
  "review",
  "apply",
  "pricing",
] as const;

export type EngineStage = (typeof ENGINE_STAGES)[number];

export type EngineEnvelope = {
  engine_type: string;
  engine_version: number;
  input: Record<string, unknown>;
  engineering: Record<string, unknown>;
  components: SystemRecommendation["components"];
  warnings: SystemRecommendation["warnings"];
  blocking: boolean;
  status: SystemRecommendation["status"];
};

export function toEngineEnvelope(rec: SystemRecommendation): EngineEnvelope {
  return {
    engine_type: rec.system_type,
    engine_version: rec.engine_version,
    input: rec.input ?? {},
    engineering: rec.engineering ?? {},
    components: rec.components ?? [],
    warnings: rec.warnings ?? [],
    blocking: Boolean(rec.blocking),
    status: rec.status,
  };
}

export function cctvUsesAuthoritativeModules(): {
  sizing: "cctv_sizing";
  recommend: "cctv_recommend";
  apply: "quote_items";
  pricing: "pricing.recalculate";
} {
  return {
    sizing: "cctv_sizing",
    recommend: "cctv_recommend",
    apply: "quote_items",
    pricing: "pricing.recalculate",
  };
}
