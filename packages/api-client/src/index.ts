export type ApiErrorBody = {
  error: { code: string; message: string; details?: Record<string, unknown> };
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const API_UNAVAILABLE_HE = "לא ניתן להתחבר לשרת. Onboarding דורש FastAPI זמין.";
export const ROUTE_NOT_FOUND_HE = "הנתיב לא נמצא בשרת (ייתכן שגרסת ה-API ישנה).";

/** Map FastAPI/Site Secure error JSON (or Starlette `{detail}`) into ApiClientError fields. */
export function apiErrorFromBody(
  status: number,
  body: unknown,
): { code: string; message: string; details: Record<string, unknown> } {
  const obj = (body && typeof body === "object" ? body : {}) as ApiErrorBody & {
    detail?: unknown;
  };
  if (obj.error?.code || obj.error?.message) {
    return {
      code: obj.error?.code ?? "BUSINESS_RULE",
      message: obj.error?.message ?? API_UNAVAILABLE_HE,
      details: obj.error?.details ?? {},
    };
  }
  // Unmatched routes / HTTPException from Starlette: {"detail":"Not Found"}
  if (typeof obj.detail === "string" && obj.detail.trim()) {
    if (status === 404) {
      return { code: "NOT_FOUND", message: ROUTE_NOT_FOUND_HE, details: { detail: obj.detail } };
    }
    return {
      code: status === 401 ? "UNAUTHENTICATED" : "BUSINESS_RULE",
      message: obj.detail,
      details: { detail: obj.detail },
    };
  }
  if (status === 404 || status === 405) {
    return { code: "API_UNAVAILABLE", message: API_UNAVAILABLE_HE, details: {} };
  }
  return { code: "BUSINESS_RULE", message: API_UNAVAILABLE_HE, details: {} };
}

export async function parseApiResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) {
    throw new ApiClientError(
      res.status,
      res.status === 405 || res.status === 404 ? "API_UNAVAILABLE" : "BUSINESS_RULE",
      API_UNAVAILABLE_HE,
    );
  }
  let json: T | ApiErrorBody;
  try {
    json = JSON.parse(text) as T | ApiErrorBody;
  } catch {
    throw new ApiClientError(res.status, "API_UNAVAILABLE", API_UNAVAILABLE_HE);
  }
  if (!res.ok) {
    const mapped = apiErrorFromBody(res.status, json);
    throw new ApiClientError(res.status, mapped.code, mapped.message, mapped.details);
  }
  return json as T;
}

export type SessionMembership = {
  workspace_id: string;
  workspace_name: string;
  workspace_status: string;
  role_key: string;
  workspace_role_key?: string | null;
  technician_code: string | null;
  program_type: string | null;
  plan_key: string;
  features: string[];
  permissions?: string[];
  is_beta?: boolean;
  beta_program?: string | null;
};

export type SessionResponse = {
  user_id: string;
  email: string | null;
  profile: {
    id: string;
    full_name: string;
    phone: string | null;
    locale: string;
    last_workspace_id: string | null;
    recognition_badges?: string[];
  } | null;
  memberships: SessionMembership[];
  has_workspace: boolean;
  is_platform_admin?: boolean;
  platform_role?: string | null;
};

export type WorkspaceOut = {
  id: string;
  name: string;
  status: string;
  timezone: string | null;
  vat_percent: number | null;
  business_type?: string | null;
  is_beta?: boolean;
  beta_program?: string | null;
  beta_enrolled_at?: string | null;
};

export type FeedbackReport = {
  id: string;
  ticket_id: string;
  workspace_id: string;
  report_type: "bug" | "feature" | "general";
  severity: string;
  status: string;
  title: string;
  body: string;
  page_url?: string | null;
  created_at: string;
  is_beta?: boolean;
  user_id?: string;
  user_agent?: string | null;
  viewport?: string | null;
  role_key?: string | null;
  plan_key?: string | null;
  screenshot_url?: string | null;
  internal_notes?: string | null;
  updated_at?: string;
};

export type FeatureFlag = {
  id: string;
  name: string;
  description?: string | null;
  enabled_for_beta: boolean;
  enabled_for_production: boolean;
  enabled?: boolean;
  updated_at?: string;
};

export type AdminOrganization = {
  id: string;
  name: string;
  status: string;
  is_beta: boolean;
  beta_program: string | null;
  beta_enrolled_at: string | null;
  created_at?: string;
  plan_key?: string | null;
  subscription_status?: string | null;
};

export type BetaParticipantStatus =
  | "invited"
  | "registered"
  | "activated"
  | "active"
  | "paused"
  | "exited";

export type BetaParticipant = {
  id: string;
  user_id: string;
  workspace_id: string;
  cohort: string | null;
  status: BetaParticipantStatus;
  invited_at?: string | null;
  registered_at?: string | null;
  activated_at?: string | null;
  joined_at?: string | null;
  paused_at?: string | null;
  exited_at?: string | null;
  internal_note?: string | null;
  created_at?: string;
  updated_at?: string;
  email?: string | null;
  full_name?: string | null;
  role_key?: string | null;
  workspace_name?: string | null;
  recognition_badges?: string[];
};

export type AdminUser = {
  id: string;
  email: string | null;
  full_name: string;
  is_platform_admin: boolean;
  platform_role?: string | null;
  recognition_badges?: string[];
  created_at: string;
  lifecycle_status?: "active" | "archived";
  archived_at?: string | null;
  archived_by?: string | null;
  archived_by_name?: string | null;
  archive_reason?: string | null;
  memberships: {
    workspace_id: string;
    workspace_name?: string | null;
    role_key: string;
    status?: string | null;
    is_beta?: boolean;
  }[];
  beta_participations?: BetaParticipant[];
};

export type AdminArchiveWorkspace = {
  id: string;
  name: string;
  archived_at: string;
  archive_batch: string;
  note?: string | null;
};

export type AdminArchiveProfile = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  recognition_badges?: unknown;
  is_platform_admin?: boolean | null;
  created_at?: string | null;
  archived_at: string;
  archive_batch: string;
  snapshot?: Record<string, unknown> | null;
};

export type AdminArchiveSoftUser = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  archived_at: string;
  archived_by?: string | null;
  archived_by_name?: string | null;
  archive_reason?: string | null;
  workspace_count?: number;
  important_roles?: string[];
  memberships?: AdminUser["memberships"];
  lifecycle_status?: "archived";
};

export type AdminArchiveResponse = {
  workspaces: AdminArchiveWorkspace[];
  profiles: AdminArchiveProfile[];
  soft_users?: AdminArchiveSoftUser[];
  counts: { workspaces: number; profiles: number; soft_users?: number };
};

export type AdminArchiveRestoreResult = {
  id: string;
  email: string;
  full_name: string;
  workspace_id: string;
  workspace_name?: string | null;
  role_key: string;
  recognition_badges?: string[];
  recovery_link?: string | null;
  message?: string;
};

export type AdminSummary = {
  organizations: number;
  beta_organizations: number;
  users: number;
  users_archived?: number;
  feedback_open: number;
  feedback_total: number;
  beta_participants_active?: number;
  beta_participants_total?: number;
  beta_workspaces_active?: number;
  founding_technicians?: number;
  invites_pending?: number;
  invites_expired?: number;
  invites_revoked?: number;
  invites_accepted?: number;
  invites_accepted_7d?: number;
  owner_invites_pending?: number;
  technician_invites_pending?: number;
  joined_7d?: number;
  funnel?: {
    beta_workspaces: number;
    owner_invites: number;
    owner_accepted: number;
    owner_pending: number;
  };
  attention?: AdminAttentionItem[];
  pending_invites?: AdminPendingInviteCard[];
  beta_workspaces?: AdminBetaWorkspaceCard[];
  open_feedback?: AdminFeedbackCard[];
  recent_activity?: AdminActivityItem[];
  system?: {
    api_ok: boolean;
    api_version?: string;
    app_env: string;
    backup_status: "unavailable" | "ok" | "failed";
    auth_status: "unknown" | "ok" | "degraded";
    web_status?: "unknown" | "ok";
    invite_flow_status?: "unknown" | "ok";
    quote_flow_status?: "unknown" | "ok";
  };
};

export type AdminAttentionItem = {
  id: string;
  kind: string;
  severity: "critical" | "high" | "medium" | "low" | string;
  title: string;
  detail?: string | null;
  href: string;
  created_at?: string | null;
};

export type AdminPendingInviteCard = {
  id: string;
  email: string;
  workspace_id: string;
  workspace_name?: string | null;
  role_key: string;
  status: AdminInviteStatus | string;
  created_at?: string | null;
  expires_at?: string | null;
  age_hours?: number;
};

export type AdminBetaWorkspaceCard = {
  id: string;
  name: string;
  status: string;
  created_at?: string | null;
  member_count: number;
  pending_invites: number;
  has_owner: boolean;
};

export type AdminFeedbackCard = {
  id: string;
  ticket_id?: string | null;
  title?: string | null;
  severity?: string | null;
  status?: string | null;
  workspace_id?: string | null;
  created_at?: string | null;
  is_beta?: boolean;
};

export type AdminActivityItem = {
  id: string;
  action?: string | null;
  created_at?: string | null;
  workspace_id?: string | null;
  actor_user_id?: string | null;
  summary?: string | null;
};

export type DashboardItem = {
  entity_type: string;
  entity_id: string;
  number: string;
  title_he: string;
  customer_name: string | null;
  site_name: string | null;
  site_id?: string | null;
  site_address?: string | null;
  customer_phone?: string | null;
  scheduled_for: string | null;
  scheduled_end?: string | null;
  status?: string | null;
  severity: "now" | "next" | "later" | "info";
  actions: string[];
  updated_at?: string | null;
};

export type AttentionGroup = {
  kind: string;
  label_he: string;
  count: number;
  items: DashboardItem[];
};

export type DashboardSummary = {
  quotes_draft: number;
  quotes_sent: number;
  quotes_viewed: number;
  quotes_approved: number;
  quotes_rejected: number;
  quotes_open: number;
  quotes_approved_value: number;
  quotes_open_value?: number;
  jobs_open: number;
  jobs_overdue: number;
  jobs_unassigned: number;
};

export type RecentQuote = {
  id: string;
  number: string;
  status: string;
  title?: string | null;
  customer_name: string | null;
  total_gross: number | null;
  updated_at: string;
};

export type BusinessChartSeries = {
  labels_he: string[];
  revenue: number[];
  quotes: number[];
};

export type BusinessChart = BusinessChartSeries & {
  daily?: BusinessChartSeries | null;
  revenue_change_percent?: number | null;
  quote_change?: number | null;
  conversion_change_percent?: number | null;
};

export type DashboardResponse = {
  home_variant: "ops" | "sales" | "today" | "observe";
  generated_at: string;
  attention: AttentionGroup[];
  today: { label_he: string; items: DashboardItem[] };
  activity: { entity_type: string; entity_id: string; title_he: string; occurred_at: string }[];
  summary: DashboardSummary;
  recent_quotes: RecentQuote[];
  business_chart?: BusinessChart | null;
};

export type QuoteGap = {
  field: string;
  code: string;
  message: string;
  severity?: "critical" | "warning" | "info";
  action?: "fix" | "review" | "ignore";
};

export type QuoteSection = {
  id: string;
  quote_id?: string;
  name: string;
  sort_order: number;
  discount_type?: string;
  discount_value?: number;
  collapsed?: boolean;
};

export type QuoteOut = {
  id: string;
  workspace_id: string;
  number: string;
  status: string;
  customer_id: string | null;
  customer_name?: string | null;
  site_id: string | null;
  site_name?: string | null;
  lead_id?: string | null;
  owner_user_id: string | null;
  title?: string | null;
  project_name?: string | null;
  project_address?: string | null;
  summary?: string | null;
  key_points?: string | null;
  warranty?: string | null;
  general_terms?: string | null;
  template_id?: string | null;
  payment_terms?: string | null;
  discount_type?: string | null;
  discount_value?: number | null;
  currency?: string;
  vat_percent?: number | null;
  total_gross?: number | null;
  subtotal_net?: number | null;
  vat_amount?: number | null;
  cost_total?: number | null;
  margin_amount?: number | null;
  margin_percent?: number | null;
  margin_status?: "healthy" | "warning" | "critical";
  margin_target?: number;
  margin_minimum?: number;
  margin_override_reason?: string | null;
  margin_override_at?: string | null;
  revise_reason?: string | null;
  lines_subtotal?: number | null;
  section_discount_amount?: number | null;
  quote_discount_amount?: number | null;
  optional_subtotal?: number | null;
  optional_vat_amount?: number | null;
  optional_total_gross?: number | null;
  optional_cost_total?: number | null;
  total_with_options_gross?: number | null;
  valid_until?: string | null;
  customer_notes?: string | null;
  internal_notes?: string | null;
  version?: number;
  sent_at?: string | null;
  viewed_at?: string | null;
  approved_at?: string | null;
  approved_name?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
  public_url?: string | null;
  public_token?: string | null;
  validation?: { can_send: boolean; gaps: QuoteGap[] };
  updated_at?: string;
  created_at?: string;
  items?: QuoteItemOut[];
  sections?: QuoteSection[];
  /** Present on some CPQ mutations (e.g. create section). */
  section?: QuoteSection;
};

export type QuoteItemOut = {
  id: string;
  quote_id: string;
  product_id?: string | null;
  description: string;
  name?: string | null;
  sku?: string | null;
  unit?: string | null;
  qty: number;
  unit_price: number;
  cost?: number;
  discount?: number;
  discount_type?: string;
  line_net?: number;
  item_type?: string;
  catalog_snapshot?: Record<string, unknown>;
  sort_order?: number;
  section_id?: string | null;
  package_instance_id?: string | null;
  package_id?: string | null;
  package_name?: string | null;
  is_optional?: boolean;
};

export type QuotePatchBody = {
  customer_id?: string | null;
  site_id?: string | null;
  lead_id?: string | null;
  title?: string | null;
  project_name?: string | null;
  project_address?: string | null;
  summary?: string | null;
  key_points?: string | null;
  warranty?: string | null;
  general_terms?: string | null;
  template_id?: string | null;
  vat_percent?: number | null;
  discount_type?: string | null;
  discount_value?: number | null;
  valid_until?: string | null;
  payment_terms?: string | null;
  customer_notes?: string | null;
  internal_notes?: string | null;
};

export type QuoteItemIn = {
  product_id?: string;
  item_type?: string;
  description?: string;
  sku?: string | null;
  name?: string | null;
  qty?: number;
  unit_price?: number;
  cost?: number;
  discount?: number;
  discount_type?: string;
  sort_order?: number;
  section_id?: string | null;
  package_instance_id?: string | null;
  package_id?: string | null;
  package_name?: string | null;
  is_optional?: boolean;
};

export type CatalogAttributeField = {
  key: string;
  label_he: string;
  type: "text" | "bool" | "number" | "enum" | string;
  integer?: boolean;
  minimum?: number;
  maximum?: number;
  max_length?: number;
  enum?: string[];
  enum_labels_he?: Record<string, string>;
  tristate?: boolean;
};

export type CatalogProduct = {
  id: string;
  name: string;
  sku: string;
  description?: string;
  unit: string;
  kind: string;
  list_price: number;
  selling_price?: number;
  cost?: number;
  vat_eligible?: boolean;
  tax?: boolean;
  active?: boolean;
  is_active?: boolean;
  item_type?: string;
  category_id?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  attributes?: Record<string, unknown>;
  category_key?: string | null;
  category_name?: string | null;
  category_path?: string | null;
  attribute_schema?: CatalogAttributeField[];
};

export type CatalogCategory = {
  id: string;
  key: string;
  name_he: string;
  sort_order?: number;
  parent_id?: string | null;
  parent_key?: string | null;
  path?: string | null;
  attribute_schema?: CatalogAttributeField[];
  children?: CatalogCategory[];
};

export type CatalogImportTargets = {
  fields: Array<{ key: string; label_he: string }>;
  duplicate_policies: string[];
  max_file_bytes: number;
  pricing_note_he: string;
  google_sheets_note_he: string;
  file_lifetime_he: string;
};

export type CatalogImportSheetMeta = {
  index: number;
  name: string;
  row_count: number;
  suggested_include: boolean;
  header_row: number | null;
  header_confidence: number;
  headers: Array<string | number | null>;
  suggested_map: Record<string, string>;
  suggested_category_key?: string | null;
  preview_rows: unknown[][];
};

export type CatalogImportParseResult = {
  session_id: string;
  filename: string;
  format: string;
  sheet_count: number;
  sheets: CatalogImportSheetMeta[];
  expires_in_seconds: number;
  pricing_note_he?: string;
};

export type CatalogImportSheetConfig = {
  sheet_index: number;
  include: boolean;
  header_row?: number | null;
  category_id?: string | null;
  manufacturer_default?: string | null;
  unit_default?: string;
  column_map: Record<string, string>;
};

export type CatalogImportPreviewIn = {
  session_id: string;
  duplicate_policy: "skip" | "update" | "new_only";
  sheets: CatalogImportSheetConfig[];
};

export type CatalogImportCommitIn = CatalogImportPreviewIn & { confirm: boolean };

export type CatalogImportPreviewResult = {
  summary: {
    detected: number;
    ready: number;
    warning: number;
    blocked: number;
    duplicates: number;
    will_create: number;
    will_update: number;
    will_skip: number;
  };
  sample_rows: Array<{
    sheet_name?: string;
    source_row?: number;
    status: string;
    warnings: string[];
    block_reasons: string[];
    is_duplicate?: boolean;
    duplicate_action?: string;
    original?: Record<string, unknown>;
    product?: CatalogProduct & { attributes?: Record<string, unknown> };
    provenance?: Record<string, string>;
  }>;
  readiness_estimate: CatalogImportReadiness;
  can_view_cost: boolean;
};

export type CatalogImportReadiness = {
  camera_structured: number;
  nvr_structured: number;
  hdd_structured: number;
  switch_structured: number;
  ready_for_core: boolean;
  incomplete_technical: number;
  missing_families: string[];
};

export type CatalogImportCommitResult = {
  imported: number;
  updated: number;
  skipped: number;
  failed: Array<{ sku?: string; source_row?: number; sheet_name?: string; reasons: string[] }>;
  failed_count: number;
  summary: CatalogImportPreviewResult["summary"];
  readiness: CatalogImportReadiness;
  message_he: string;
};

export type QuotePackage = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  is_active?: boolean;
  item_count?: number;
  /** Expanded package lines for picker preview (existing items only). */
  items_preview?: Array<{ description: string; qty: number }>;
};

/** Task 13C/13D — server CCTV recommendation (transient; not a Saved System). */
export type CctvRecommendIn = {
  camera_count: number;
  indoor_count?: number | null;
  outdoor_count?: number | null;
  /** SYSTEM-DESIGNER-1: ip | analog_hd | hybrid */
  cctv_technology?: string | null;
  ip_camera_count?: number | null;
  analog_camera_count?: number | null;
  analog_signal?: string | null;
  power_supply_requested?: boolean | null;
  resolution_mp?: number | null;
  environment?: string | null;
  form_factor?: string | null;
  retention_days?: number | null;
  recording_mode?: string | null;
  recording_hours_per_day?: number | null;
  motion_duty_cycle?: number | null;
  fps?: number | null;
  codec?: string | null;
  bitrate_mbps_override?: number | null;
  poe_required?: boolean | null;
  architecture_intent?: string | null;
  expansion_headroom?: number | null;
  cable_distance_meters?: number | null;
  remote_viewing?: boolean | null;
  ups_requested?: boolean | null;
  installation_requested?: boolean | null;
  commissioning_requested?: boolean | null;
  testing_requested?: boolean | null;
  camera_max_power_w?: number | null;
  manufacturer_preference?: string | null;
  storage_overhead?: number | null;
  poe_headroom?: number | null;
  allow_engineering_power_default?: boolean | null;
};

export type CctvReasonCode = { code: string; params?: Record<string, unknown> };

export type CctvRecommendationProduct = {
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

export type CctvRecommendationCandidate = {
  product: CctvRecommendationProduct;
  confidence: "STRUCTURED" | "PARTIAL" | "TEXT_ASSISTED" | "UNRESOLVED";
  compatibility?: Record<string, string>;
  reason_codes?: CctvReasonCode[];
};

export type CctvRecommendationComponent = {
  /** Stable DesignComponent identity (SYSTEM-DESIGNER-1). Prefer over role for selection/linkage. */
  component_key?: string | null;
  role: string;
  label: string;
  quantity: number;
  technical_requirements: Record<string, unknown>;
  selected_product?: CctvRecommendationProduct | null;
  selected_confidence?: CctvRecommendationCandidate["confidence"] | null;
  selected_compatibility?: Record<string, string> | null;
  candidates: CctvRecommendationCandidate[];
  resolution_status: "RESOLVED" | "PARTIAL" | "UNRESOLVED" | "MANUAL_REVIEW";
  reason_codes: CctvReasonCode[];
  optional: boolean;
  editable: boolean;
  blocking: boolean;
};

export type SystemRecommendation = {
  system_type: "cctv";
  engine_version: number;
  input: Record<string, unknown>;
  engineering: Record<string, unknown>;
  components: CctvRecommendationComponent[];
  warnings: CctvReasonCode[];
  assumptions: CctvReasonCode[];
  unresolved: CctvReasonCode[];
  blocking: boolean;
  status: "OK" | "BLOCKED" | "INVALID_INPUT";
  catalog_stats?: {
    products_examined?: number;
    by_family?: Record<string, number>;
    fetch?: { categories?: number; fetched?: number };
    query_strategy?: string;
  };
  catalog_readiness?: {
    empty_catalog?: boolean;
    camera_structured?: number;
    nvr_structured?: number;
    hdd_structured?: number;
    switch_structured?: number;
    ready_for_core?: boolean;
    missing_families?: string[];
  };
};

/** E2 Equipment Intent — design-side equipment definition (not a Product). */
export type EquipmentIntent = {
  manufacturer?: string;
  model_reference?: string;
  display_description?: string;
  selected_attributes?: Record<string, string | number | boolean | null>;
};

/** Durable System Design (R1 persistence / R2 CCTV hydration). */
export type SystemDesignComponent = {
  id: string;
  workspace_id: string;
  design_id: string;
  role_key: string;
  label: string;
  quantity: number;
  optional: boolean;
  blocking: boolean;
  removed: boolean;
  resolution_status?: string | null;
  technical_requirements?: Record<string, unknown>;
  candidates?: unknown[];
  engine_preferred_product_id?: string | null;
  user_selected_product_id?: string | null;
  selection_origin: "ENGINE_PREFERRED" | "USER_OVERRIDE" | "UNSELECTED";
  reason_codes?: unknown[];
  needs_review: boolean;
  /** E2 — durable Equipment Intent (no product_id / commercial money). */
  equipment_intent?: EquipmentIntent | null;
  quote_item_id?: string | null;
  applied_product_id?: string | null;
  applied_qty?: number | null;
  applied_output_fingerprint?: string | null;
  last_apply_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type SystemDesign = {
  id: string;
  workspace_id: string;
  quote_id: string;
  site_id?: string | null;
  engine_type: string;
  engine_version: number;
  lifecycle_status: "draft" | "calculated" | "applied";
  requirements: Record<string, unknown>;
  engineering_result?: Record<string, unknown> | null;
  recommendation_meta?: Record<string, unknown> | null;
  calculated_at?: string | null;
  last_applied_at?: string | null;
  current_apply_id?: string | null;
  apply_fingerprint?: string | null;
  revision: number;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  components: SystemDesignComponent[];
};

export type SystemDesignComponentIn = {
  id?: string | null;
  role_key: string;
  label?: string;
  quantity?: number;
  optional?: boolean;
  blocking?: boolean;
  removed?: boolean;
  resolution_status?: string | null;
  technical_requirements?: Record<string, unknown>;
  candidates?: unknown[];
  engine_preferred_product_id?: string | null;
  user_selected_product_id?: string | null;
  selection_origin?: "ENGINE_PREFERRED" | "USER_OVERRIDE" | "UNSELECTED";
  reason_codes?: unknown[];
  needs_review?: boolean;
  equipment_intent?: EquipmentIntent | null;
  quote_item_id?: string | null;
  applied_product_id?: string | null;
  applied_qty?: number | null;
  applied_output_fingerprint?: string | null;
  last_apply_id?: string | null;
};

export type SystemDesignCreateIn = {
  engine_type?: string;
  engine_version?: number;
  requirements?: Record<string, unknown>;
  site_id?: string | null;
};

export type SystemDesignPatchIn = {
  revision: number;
  requirements?: Record<string, unknown>;
  engineering_result?: Record<string, unknown> | null;
  recommendation_meta?: Record<string, unknown> | null;
  lifecycle_status?: "draft" | "calculated" | "applied";
  engine_version?: number;
  calculated_at?: string | null;
  site_id?: string | null;
  components?: SystemDesignComponentIn[];
  components_replace?: boolean;
};

export type SystemDesignApplyIn = {
  revision: number;
  confirmation_token?: string | null;
  section_name?: string | null;
};

export type SystemDesignApplyDiverged = {
  design_id: string;
  revision: number;
  confirmation_required: true;
  confirmation_token: string;
  confirmation_expires_at: string;
  diverged: Array<{
    component_id: string;
    role_key: string;
    kind: "CHANGED" | "MISSING" | "UNEXPECTED";
    applied: { product_id?: string | null; qty?: number | null; fingerprint?: string };
    current: {
      quote_item_id?: string;
      product_id?: string | null;
      qty?: number;
      fingerprint?: string;
    } | null;
  }>;
  proposed: Array<{
    component_id: string;
    role_key: string;
    product_id: string;
    qty: number;
    optional: boolean;
  }>;
  untouched_manual_item_count?: number;
};

export type SystemDesignApplyResult = {
  ok: boolean;
  apply_id: string;
  design: SystemDesign;
  quote: QuoteOut;
};

export type QuoteVersionMeta = {
  id: string;
  version: number;
  created_at?: string;
  created_by?: string | null;
  snapshot_status?: string | null;
  total_gross?: number | null;
};

export type QuoteRevisionCompare = {
  from_version: number;
  to_version: number;
  total_from?: number | null;
  total_to?: number | null;
  changes: Array<{
    key: string;
    change: "added" | "removed" | "modified";
    from?: unknown;
    to?: unknown;
  }>;
};

export type QuoteEvent = {
  id: string;
  event_type: string;
  actor_id?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
};

export type QuoteTemplate = {
  id: string;
  key: string;
  name_he: string;
  item_count?: number;
};

export type CustomerOut = {
  id: string;
  workspace_id?: string;
  display_name: string;
  type?: string;
  status?: string;
  legal_name?: string | null;
  tax_id?: string | null;
  email?: string | null;
  phone?: string | null;
  billing_address?: Record<string, unknown>;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CustomerContact = {
  id: string;
  customer_id: string;
  full_name: string;
  role_title?: string | null;
  email?: string | null;
  phone?: string | null;
  is_primary?: boolean;
};

export type SiteOut = {
  id: string;
  workspace_id?: string;
  customer_id: string;
  code?: string;
  name: string;
  address?: Record<string, unknown>;
  installation_status?: string;
  access_notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type DocumentOut = {
  id: string;
  workspace_id: string;
  entity_type: string;
  entity_id: string;
  kind: string;
  visibility?: "internal" | "customer" | null;
  storage_bucket?: string;
  mime_type?: string | null;
  byte_size?: number | null;
  original_filename?: string | null;
  created_at: string;
};

export type LeadRequirements = {
  camera_count?: number | null;
  location?: string | null;
  infrastructure?: string | null;
  recording?: boolean | null;
  remote_viewing?: boolean | null;
  system_type?: string | null;
  zone_count?: number | null;
  detectors?: string | null;
  magnets?: boolean | null;
  siren?: boolean | null;
  app?: boolean | null;
};

export type LeadOut = {
  id: string;
  workspace_id: string;
  title: string;
  status: string;
  source: string;
  priority?: string;
  service_type?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  next_action?: string | null;
  next_action_at?: string | null;
  estimated_value_cents?: number | null;
  requirements?: LeadRequirements | null;
  address_text?: string | null;
  property_notes?: string | null;
  customer_id?: string | null;
  site_id?: string | null;
  owner_user_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskOut = {
  id: string;
  workspace_id: string;
  type: string;
  status: string;
  title: string;
  due_at?: string | null;
  assignee_id?: string | null;
  customer_id?: string | null;
  site_id?: string | null;
  lead_id?: string | null;
  quote_id?: string | null;
  job_id?: string | null;
  notes?: string | null;
  time_window?: string | null;
  visit_status?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectOut = {
  id: string;
  workspace_id: string;
  name: string;
  status: string;
  customer_id: string;
  site_id?: string | null;
  source_quote_id?: string | null;
  /** Frozen quote.version at conversion; null on legacy projects. Does not follow revises. */
  source_quote_version?: number | null;
  assigned_to?: string | null;
  created_at: string;
  updated_at: string;
};

/** Q8-B planned execution scope — not Installed Assets. */
export type ProjectPlannedItemOut = {
  id: string;
  workspace_id: string;
  project_id: string;
  source_quote_id?: string | null;
  source_quote_version: number;
  source_quote_item_id?: string | null;
  section_id?: string | null;
  section_name?: string | null;
  item_type: string;
  scope_kind: "equipment" | "labor" | "other" | string;
  product_id?: string | null;
  sku?: string | null;
  name?: string | null;
  description: string;
  qty: number;
  unit?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  is_optional?: boolean;
  sort_order: number;
  created_at: string;
  /** Q8-C: count of equipment rows linked via project_planned_item_id */
  assets_created?: number;
  /** Remaining qty to materialize; null for non-equipment rows */
  assets_remaining?: number | null;
};

export type CreateInstalledAssetsLineOut = {
  planned_item_id: string;
  label: string;
  qty: number;
  existing: number;
  created_now?: number;
  remaining?: number;
  category: string;
};

export type CreateInstalledAssetsPreviewOut = {
  site_id?: string | null;
  eligible: boolean;
  fully_materialized: boolean;
  total_to_create: number;
  lines: CreateInstalledAssetsLineOut[];
  message?: string | null;
};

export type CreateInstalledAssetsResultOut = {
  requested: number;
  created: number;
  already_existing: number;
  failed: number;
  fully_materialized: boolean;
  equipment_ids: string[];
  lines: CreateInstalledAssetsLineOut[];
  message: string;
};

export type ServiceCallOut = {
  id: string;
  workspace_id: string;
  number?: string;
  status: string;
  priority: string;
  customer_id: string;
  site_id: string;
  system_id?: string | null;
  equipment_id?: string | null;
  title: string;
  description?: string | null;
  customer_name?: string | null;
  site_name?: string | null;
  created_at: string;
  updated_at: string;
  linked_jobs?: { id: string; number: string; title: string; status: string; scheduled_for?: string | null }[];
};

export type WarrantyOut = {
  id: string;
  workspace_id: string;
  number: string;
  title?: string | null;
  type: string;
  status: string;
  customer_id: string;
  site_id?: string | null;
  policy?: Record<string, unknown> | null;
  equipment_id?: string | null;
  customer_name?: string | null;
  site_name?: string | null;
  equipment_name?: string | null;
  equipment_manufacturer?: string | null;
  equipment_model?: string | null;
  equipment_serial?: string | null;
  starts_on: string;
  ends_on: string;
  document_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type KnowledgeOut = {
  id: string;
  workspace_id: string;
  category: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type PublicQuote = {
  id: string;
  number: string;
  version: number;
  status: string;
  superseded: boolean;
  historical?: boolean;
  can_approve?: boolean;
  can_reject?: boolean;
  title?: string | null;
  summary?: string | null;
  key_points?: string | null;
  project_name?: string | null;
  project_address?: string | null;
  valid_until?: string | null;
  payment_terms?: string | null;
  warranty?: string | null;
  general_terms?: string | null;
  customer_notes?: string | null;
  currency: string;
  vat_percent: number;
  discount_type?: string | null;
  discount_value?: number | null;
  lines_subtotal?: number | null;
  section_discount_amount?: number | null;
  quote_discount_amount?: number | null;
  subtotal_net: number;
  vat_amount: number;
  total_gross: number;
  optional_subtotal?: number | null;
  optional_vat_amount?: number | null;
  optional_total_gross?: number | null;
  total_with_options_gross?: number | null;
  company: {
    name?: string | null;
    legal_name?: string | null;
    logo_url?: string | null;
    brand_name?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: unknown;
    website?: string | null;
  };
  customer: {
    display_name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: Record<string, unknown>;
    address_line?: string | null;
  } | null;
  site: { name?: string | null; address?: Record<string, unknown> } | null;
  items: QuoteItemOut[];
  sections?: Array<{ id: string; name?: string | null; sort_order?: number }>;
  signature?: {
    mode?: string;
    required?: boolean;
    title?: string;
    consent_he?: string;
    consent_text?: string;
    fields?: string[];
    captured?: {
      signer_name?: string;
      signed_at?: string;
      quote_id?: string;
      quote_version?: number;
      document_id?: string;
      storage_bucket?: string;
      storage_path?: string;
      mime_type?: string;
      byte_size?: number;
      checksum?: string;
      image_data_url?: string;
    };
  };
  pdf_ready?: boolean;
  issued_at?: string | null;
  sent_at?: string | null;
  viewed_at?: string | null;
  approved_at?: string | null;
  approved_name?: string | null;
  rejected_at?: string | null;
  signature_captured?: boolean;
  /** Presentation hints from PDF template / workspace defaults (e.g. showVat). */
  pdf_template?: Record<string, unknown> | null;
};

export type QuoteListCounts = {
  draft: number;
  sent: number;
  viewed: number;
  approved: number;
  rejected: number;
  expired: number;
  cancelled: number;
  total: number;
  open_value: number;
};

export type QuotePage = {
  items: QuoteOut[];
  next_cursor: string | null;
  counts?: QuoteListCounts;
};

export type MemberOut = {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  role_key: string;
  workspace_role_key?: string | null;
  status: string;
  created_at: string | null;
};

export type WorkspaceSettingsOut = {
  workspace_id: string;
  branding: Record<string, unknown>;
  quotes: Record<string, unknown>;
  taxes: Record<string, unknown>;
  scheduling: Record<string, unknown>;
  notifications: Record<string, unknown>;
  localization: Record<string, unknown>;
};

export type WorkspaceRoleOut = {
  id: string;
  key: string;
  label_he: string;
  description: string;
  is_system: boolean;
  is_locked: boolean;
  base_role_key: string;
  grants: string[];
  users_count: number;
};

export type PdfDocumentTemplateOut = {
  id: string;
  name: string;
  doc_type: "quote" | "service" | "project";
  status: "active" | "draft" | "archived";
  is_default: boolean;
  config: Record<string, unknown>;
  updated_at?: string | null;
  created_at?: string | null;
};

export type InviteOut = {
  id: string;
  email: string;
  role_key: string;
  expires_at: string;
  token: string | null;
  status?: "pending" | "accepted" | "expired" | "revoked" | null;
  created_at?: string | null;
  accepted_at?: string | null;
  revoked_at?: string | null;
};

export type WorkspaceInvitation = {
  id: string;
  email: string;
  role_key: string;
  expires_at?: string | null;
  created_at?: string | null;
  accepted_at?: string | null;
  revoked_at?: string | null;
  status: "pending" | "accepted" | "expired" | "revoked";
  token?: string | null;
};

export type InvitePreviewStatus =
  | "valid"
  | "invalid"
  | "expired"
  | "already_accepted"
  | "revoked"
  | "wrong_account";

export type InvitePreview = {
  status: InvitePreviewStatus;
  workspace_id: string | null;
  workspace_name: string | null;
  role_key: string | null;
  email: string | null;
  expires_at: string | null;
};

export type AdminInviteStatus = "pending" | "accepted" | "expired" | "revoked";

export type AdminInvitation = {
  id: string;
  workspace_id: string;
  workspace_name?: string | null;
  email: string;
  role_key: string;
  created_at?: string;
  expires_at?: string;
  accepted_at?: string | null;
  revoked_at?: string | null;
  invited_by?: string | null;
  status: AdminInviteStatus;
  token?: string;
  invite_path?: string;
};

export type AdminMembership = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  workspace_id: string;
  workspace_name?: string | null;
  role_key: string;
  status?: string | null;
  created_at?: string | null;
};

export type InviteAcceptResult = {
  workspace_id: string;
  status: "success";
};

export type PortalAccessStatus = "not_enabled" | "invited" | "active" | "expired" | "revoked";

export type PortalAccess = {
  id: string;
  email: string;
  status: PortalAccessStatus;
  contact_id?: string | null;
  last_login_at?: string | null;
  expires_at?: string | null;
  token?: string;
};

export type PortalInvitePreview = {
  status: "valid" | "invalid" | "expired" | "consumed" | "revoked" | "wrong_account";
  email?: string | null;
  customer_name?: string | null;
  workspace_name?: string | null;
  expires_at?: string | null;
};

export type PortalGrant = {
  access_id: string;
  customer_id: string;
  customer_name: string;
  capabilities: string[];
};

export type PortalSession = {
  grants: PortalGrant[];
};

export type PortalHome = {
  access_id: string;
  customer_name: string;
  profile: { display_name: string; type: string; phone?: string | null; email: string };
  sites: Array<{ id: string; name: string; code: string; installation_status: string; address: Record<string, string> }>;
  installations: Array<{ id: string; number: string; title: string; status: string; completed_at?: string | null; site_id?: string | null }>;
  equipment: Array<{ id: string; site_id?: string | null; name: string; category: string; manufacturer?: string | null; model?: string | null; serial?: string | null; installed_at?: string | null; status: string }>;
  warranties: Array<{ id: string; number: string; type: string; status: string; starts_on?: string | null; ends_on?: string | null; site_id?: string | null }>;
  quotes: Array<{ id: string; number: string; status: string; total_gross?: number | null; sent_at?: string | null; valid_until?: string | null }>;
  service: Array<{ id: string; number?: string | null; title: string; status: string; created_at?: string | null; site_id?: string | null }>;
  documents: Array<{ id: string; filename: string; mime_type?: string | null; created_at?: string | null }>;
};

export type AuditItem = {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type SecuritySignal = {
  key: string;
  label_he: string;
  status: "healthy" | "not_in_plan" | "not_built";
  detail_he: string;
};

export type SecurityCenter = {
  workspace_id: string;
  role_key: string;
  plan_key: string;
  signals: SecuritySignal[];
};

export type UsageOccupant = {
  kind: "member" | "invite";
  role_key: string;
  email: string | null;
  label: string;
  status: "active" | "pending";
};

export type WorkspaceUsageMeter = {
  key: string;
  label_he: string;
  current: number;
  limit: number;
  unlimited: boolean;
  unit: string;
  at_limit: boolean;
  occupants?: UsageOccupant[];
  detail_he?: string | null;
};

export type WorkspaceUsage = {
  workspace_id: string;
  plan_key: string;
  active_members: number;
  pending_invites: number;
  meters: WorkspaceUsageMeter[];
};

export type AuthzCatalog = {
  roles: { key: string; label_he: string; label_en: string; default_scope: string }[];
  permissions: { key: string; group: string }[];
  grants: Record<string, string[]>;
  plans: { key: string; label_he: string; features: string[] }[];
};

export type JobAssigneeOut = {
  user_id: string;
  display_name?: string | null;
  assigned_at?: string | null;
  assigned_by?: string | null;
  assigned_by_name?: string | null;
};

export type JobOut = {
  id: string;
  workspace_id: string;
  number: string;
  title: string;
  kind?: string;
  status: string;
  priority?: string;
  project_id?: string | null;
  service_call_id?: string | null;
  customer_id?: string;
  site_id?: string;
  scheduled_for?: string | null;
  scheduled_end?: string | null;
  started_at?: string | null;
  arrived_at?: string | null;
  completed_at?: string | null;
  completion_notes?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  assignees?: JobAssigneeOut[];
  is_assigned?: boolean;
  customer_name?: string | null;
  site_name?: string | null;
  project_name?: string | null;
};

export type JobChecklistItem = {
  id: string;
  label_he: string;
  required?: boolean;
  completed?: boolean;
  completed_at?: string | null;
  sort_order?: number;
};

export type SystemOut = {
  id: string;
  workspace_id: string;
  site_id: string;
  type: string;
  name: string;
  status: string;
  manufacturer?: string | null;
  model?: string | null;
  panel_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type EquipmentOut = {
  id: string;
  workspace_id: string;
  site_id: string;
  system_id?: string | null;
  zone_id?: string | null;
  category: string;
  status: string;
  name: string;
  manufacturer?: string | null;
  model?: string | null;
  serial?: string | null;
  mac?: string | null;
  ip?: string | null;
  location_note?: string | null;
  installed_at?: string | null;
  product_id?: string | null;
  project_id?: string | null;
  project_planned_item_id?: string | null;
  asset_code?: string | null;
  created_at: string;
  updated_at: string;
};

export type AssetLifecycleActivityOut = {
  id: string;
  kind: string;
  at: string;
  title: string;
  detail?: string | null;
  metadata?: Record<string, unknown>;
  href?: { type: string; id: string } | null;
};

export type SiteVlanOut = {
  id: string;
  workspace_id: string;
  site_id: string;
  vlan_number: number;
  name: string;
  purpose?: string | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
};

export type SiteNetworkOut = {
  id: string;
  workspace_id: string;
  site_id: string;
  vlan_id?: string | null;
  name: string;
  cidr: string;
  gateway?: string | null;
  dhcp_enabled: boolean;
  dhcp_start?: string | null;
  dhcp_end?: string | null;
  dns_primary?: string | null;
  dns_secondary?: string | null;
  purpose?: string | null;
  notes?: string | null;
  ip_count?: number;
  assigned_count?: number;
  created_at: string;
  updated_at: string;
};

export type SiteIpAddressOut = {
  id: string;
  workspace_id: string;
  site_id: string;
  network_id: string;
  vlan_id?: string | null;
  equipment_id?: string | null;
  ip_address: string;
  hostname?: string | null;
  mac_address?: string | null;
  assignment_type: "static" | "dhcp" | "reserved" | string;
  status: "available" | "assigned" | "reserved" | string;
  notes?: string | null;
  equipment_name?: string | null;
  equipment_asset_code?: string | null;
  network_name?: string | null;
  network_cidr?: string | null;
  vlan_number?: number | null;
  vlan_name?: string | null;
  created_at: string;
  updated_at: string;
};

export type SiteNetworkOverviewOut = {
  networks: number;
  vlans: number;
  ips: number;
  assigned: number;
  available: number;
  reserved: number;
};

export type AssetConnectionOut = {
  id: string;
  workspace_id: string;
  site_id: string;
  source_equipment_id: string;
  target_equipment_id: string;
  connection_type: string;
  source_port?: string | null;
  target_port?: string | null;
  notes?: string | null;
  source_name?: string | null;
  source_asset_code?: string | null;
  source_category?: string | null;
  source_ip?: string | null;
  target_name?: string | null;
  target_asset_code?: string | null;
  target_category?: string | null;
  target_ip?: string | null;
  created_at: string;
  updated_at: string;
};

export type TopologyNodeOut = {
  id: string;
  site_id: string;
  name: string;
  asset_code?: string | null;
  category: string;
  status: string;
  ip?: string | null;
  primary_ip?: string | null;
  manufacturer?: string | null;
  model?: string | null;
};

export type SiteTopologyOut = {
  nodes: TopologyNodeOut[];
  edges: AssetConnectionOut[];
  directional: boolean;
};

export type GlobalSearchHit = {
  entity_type: "customer" | "site" | "lead" | "quote" | "project" | "service" | "equipment" | "warranty";
  id: string;
  title: string;
  subtitle?: string | null;
  href: string;
};

export type GlobalSearchResponse = {
  q: string;
  items: GlobalSearchHit[];
};

export function createApiClient(opts: {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  /** Local Vite only: fetch `/api/...` so the dev proxy can reach FastAPI. Never on Vercel. */
  sameOriginProxy?: boolean;
}) {
  const baseUrl = opts.baseUrl.replace(/\/$/, "");
  const sameOriginProxy = Boolean(opts.sameOriginProxy);

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!baseUrl && !sameOriginProxy) {
      throw new ApiClientError(503, "API_UNAVAILABLE", API_UNAVAILABLE_HE);
    }
    const token = await opts.getAccessToken();
    const headers = new Headers(init.headers);
    if (!(init.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const url = sameOriginProxy ? path : `${baseUrl}${path}`;
    let res: Response;
    try {
      res = await fetch(url, { ...init, headers });
    } catch {
      throw new ApiClientError(503, "API_UNAVAILABLE", API_UNAVAILABLE_HE);
    }
    return parseApiResponse<T>(res);
  }

  async function requestBlob(path: string, init: RequestInit = {}): Promise<{ blob: Blob; filename: string }> {
    if (!baseUrl && !sameOriginProxy) {
      throw new ApiClientError(503, "API_UNAVAILABLE", API_UNAVAILABLE_HE);
    }
    const token = await opts.getAccessToken();
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const url = sameOriginProxy ? path : `${baseUrl}${path}`;
    let res: Response;
    try {
      res = await fetch(url, { ...init, headers });
    } catch {
      throw new ApiClientError(503, "API_UNAVAILABLE", API_UNAVAILABLE_HE);
    }
    if (!res.ok) {
      let mapped = apiErrorFromBody(res.status, null);
      try {
        mapped = apiErrorFromBody(res.status, await res.json());
      } catch {
        /* binary / empty / HTML error body */
        if (res.status === 404 || res.status === 405) {
          mapped = { code: "API_UNAVAILABLE", message: API_UNAVAILABLE_HE, details: {} };
        }
      }
      throw new ApiClientError(res.status, mapped.code, mapped.message, mapped.details);
    }
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = /filename\*?=(?:UTF-8''|")?([^\";]+)"?/i.exec(disposition);
    const filename = decodeURIComponent((match?.[1] || "SITE-SECURE-QUOTE.pdf").replace(/"/g, ""));
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength < 5) {
      throw new ApiClientError(500, "PDF_INVALID", "קובץ ה-PDF שהתקבל אינו תקין");
    }
    const magic = new TextDecoder("latin1").decode(buffer.slice(0, 4));
    if (magic !== "%PDF") {
      throw new ApiClientError(500, "PDF_INVALID", "קובץ ה-PDF שהתקבל אינו תקין");
    }
    // Always re-wrap with application/pdf so Windows/Chrome treat it as a PDF.
    const blob = new Blob([buffer], { type: "application/pdf" });
    return { blob, filename: filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf` };
  }

  return {
    getSession: () => request<SessionResponse>("/api/v1/auth/session"),
    patchMe: (body: { full_name?: string; phone?: string; locale?: string }) =>
      request("/api/v1/me", { method: "PATCH", body: JSON.stringify(body) }),
    createWorkspace: (body: { name: string; plan_key?: string; business_type?: string }) =>
      request<WorkspaceOut>("/api/v1/workspaces", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    patchWorkspace: (
      workspaceId: string,
      body: { timezone?: string; vat_percent?: number; name?: string; business_type?: string },
    ) =>
      request<WorkspaceOut>(`/api/v1/workspaces/${workspaceId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    getWorkspace: (workspaceId: string) => request<WorkspaceOut>(`/api/v1/workspaces/${workspaceId}`),
    getDashboard: (workspaceId: string) =>
      request<DashboardResponse>(`/api/v1/workspaces/${workspaceId}/dashboard`),
    listQuotes: (
      workspaceId: string,
      opts: {
        q?: string;
        status?: string;
        exclude_status?: string;
        customer_id?: string;
        lead_id?: string;
        site_id?: string;
        limit?: number;
        cursor?: string | null;
      } = {},
    ) => {
      const params = new URLSearchParams({ limit: String(opts.limit ?? 50) });
      if (opts.q?.trim()) params.set("q", opts.q.trim());
      if (opts.status?.trim()) params.set("status", opts.status.trim());
      if (opts.exclude_status?.trim()) params.set("exclude_status", opts.exclude_status.trim());
      if (opts.customer_id) params.set("customer_id", opts.customer_id);
      if (opts.lead_id) params.set("lead_id", opts.lead_id);
      if (opts.site_id) params.set("site_id", opts.site_id);
      if (opts.cursor) params.set("cursor", opts.cursor);
      return request<QuotePage>(`/api/v1/workspaces/${workspaceId}/quotes?${params.toString()}`);
    },
    createQuote: (workspaceId: string, body: QuotePatchBody = {}) =>
      request<QuoteOut>(`/api/v1/workspaces/${workspaceId}/quotes`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    getQuote: (workspaceId: string, quoteId: string) =>
      request<QuoteOut>(`/api/v1/workspaces/${workspaceId}/quotes/${quoteId}`),
    getQuotePreview: (workspaceId: string, quoteId: string) =>
      request<PublicQuote>(`/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/preview`),
    patchQuote: (workspaceId: string, quoteId: string, body: QuotePatchBody) =>
      request<QuoteOut>(`/api/v1/workspaces/${workspaceId}/quotes/${quoteId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    addQuoteItem: (workspaceId: string, quoteId: string, body: QuoteItemIn) =>
      request<QuoteOut>(`/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/items`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    patchQuoteItem: (
      workspaceId: string,
      quoteId: string,
      itemId: string,
      body: Partial<QuoteItemIn> & { name?: string },
    ) =>
      request<QuoteOut>(`/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    deleteQuoteItem: (workspaceId: string, quoteId: string, itemId: string) =>
      request<QuoteOut>(`/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/items/${itemId}`, {
        method: "DELETE",
      }),
    sendQuote: (workspaceId: string, quoteId: string) =>
      request<QuoteOut>(`/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/send`, { method: "POST" }),
    deleteQuote: (workspaceId: string, quoteId: string) =>
      request<{ ok: true }>(`/api/v1/workspaces/${workspaceId}/quotes/${quoteId}`, { method: "DELETE" }),
    duplicateQuote: (workspaceId: string, quoteId: string) =>
      request<QuoteOut>(`/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/duplicate`, { method: "POST" }),
    applyQuoteTemplate: (workspaceId: string, quoteId: string, body: { template_id?: string } = {}) =>
      request<QuoteOut>(`/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/apply-template`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    reviseQuote: (workspaceId: string, quoteId: string, reason?: string) => {
      const params = reason?.trim() ? `?reason=${encodeURIComponent(reason.trim())}` : "";
      return request<QuoteOut>(
        `/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/revise${params}`,
        { method: "POST" },
      );
    },
    shareQuote: (workspaceId: string, quoteId: string) =>
      request<{
        public_url: string;
        public_token: string;
        status?: string;
        link_created?: boolean;
        auto_sent?: boolean;
      }>(`/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/share`, { method: "POST" }),
    downloadQuotePdf: (workspaceId: string, quoteId: string) =>
      requestBlob(`/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/pdf`),
    downloadPublicQuotePdf: (token: string) =>
      requestBlob(`/api/v1/public/quotes/${encodeURIComponent(token)}/pdf`),
    revokeQuoteLink: (workspaceId: string, quoteId: string) =>
      request<{ ok: true }>(`/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/revoke-link`, {
        method: "POST",
      }),
    recordQuoteEvent: (
      workspaceId: string,
      quoteId: string,
      body: {
        event_type: "preview_opened" | "pdf_generated" | "whatsapp_share_initiated" | "share_link_copied";
        metadata?: Record<string, unknown>;
      },
    ) =>
      request<{ ok: true; event_type: string }>(
        `/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/events`,
        { method: "POST", body: JSON.stringify(body) },
      ),
    createQuoteSection: (
      workspaceId: string,
      quoteId: string,
      body: { name?: string; sort_order?: number } = {},
    ) =>
      request<QuoteOut>(`/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/sections`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    patchQuoteSection: (
      workspaceId: string,
      quoteId: string,
      sectionId: string,
      body: Partial<{
        name: string;
        sort_order: number;
        discount_type: string;
        discount_value: number;
        collapsed: boolean;
      }>,
    ) =>
      request<QuoteOut>(
        `/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/sections/${sectionId}`,
        { method: "PATCH", body: JSON.stringify(body) },
      ),
    deleteQuoteSection: (workspaceId: string, quoteId: string, sectionId: string) =>
      request<QuoteOut>(
        `/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/sections/${sectionId}`,
        { method: "DELETE" },
      ),
    duplicateQuoteSection: (workspaceId: string, quoteId: string, sectionId: string) =>
      request<QuoteOut>(
        `/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/sections/${sectionId}/duplicate`,
        { method: "POST" },
      ),
    listQuotePackages: (workspaceId: string) =>
      request<{ items: QuotePackage[] }>(`/api/v1/workspaces/${workspaceId}/catalog/packages`),
    applyQuotePackage: (
      workspaceId: string,
      quoteId: string,
      body: { package_id: string; section_id?: string },
    ) =>
      request<QuoteOut>(`/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/apply-package`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    saveQuoteAsPackage: (
      workspaceId: string,
      quoteId: string,
      body: { name: string; description?: string; category?: string },
    ) =>
      request<QuotePackage>(`/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/save-as-package`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    saveQuoteAsTemplate: (
      workspaceId: string,
      quoteId: string,
      body: { name_he: string; key?: string; description?: string; category?: string; include_terms?: boolean },
    ) =>
      request<QuoteTemplate>(`/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/save-as-template`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    overrideQuoteMargin: (workspaceId: string, quoteId: string, reason: string) =>
      request<QuoteOut>(`/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/margin-override`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    listQuoteVersions: (workspaceId: string, quoteId: string) =>
      request<{
        items: QuoteVersionMeta[];
        current_version: number;
        current_status?: string | null;
      }>(`/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/versions`),
    getQuoteVersionDocument: (workspaceId: string, quoteId: string, version: number) =>
      request<PublicQuote>(
        `/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/versions/${version}/document`,
      ),
    downloadQuoteVersionPdf: (workspaceId: string, quoteId: string, version: number) =>
      requestBlob(`/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/versions/${version}/pdf`),
    compareQuoteVersions: (
      workspaceId: string,
      quoteId: string,
      fromVersion: number,
      toVersion?: number,
    ) => {
      const params = new URLSearchParams({ from_version: String(fromVersion) });
      if (toVersion != null) params.set("to_version", String(toVersion));
      return request<QuoteRevisionCompare>(
        `/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/versions/compare?${params}`,
      );
    },
    listQuoteEvents: (workspaceId: string, quoteId: string) =>
      request<{ items: QuoteEvent[] }>(
        `/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/events`,
      ),
    getQuoteDocument: (workspaceId: string, quoteId: string) =>
      request<PublicQuote>(`/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/document`),
    listCustomers: (workspaceId: string, opts: { q?: string; limit?: number; status?: string } = {}) => {
      const params = new URLSearchParams({ limit: String(opts.limit ?? 50) });
      if (opts.q?.trim()) params.set("q", opts.q.trim());
      if (opts.status) params.set("status", opts.status);
      return request<{ items: CustomerOut[]; next_cursor?: string | null }>(
        `/api/v1/workspaces/${workspaceId}/customers?${params}`,
      );
    },
    getCustomer: (workspaceId: string, customerId: string) =>
      request<CustomerOut>(`/api/v1/workspaces/${workspaceId}/customers/${customerId}`),
    createCustomer: (
      workspaceId: string,
      body: {
        display_name: string;
        type?: string;
        status?: string;
        email?: string;
        phone?: string;
        legal_name?: string;
        notes?: string;
        billing_address?: Record<string, unknown> | null;
      },
    ) =>
      request<CustomerOut>(`/api/v1/workspaces/${workspaceId}/customers`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    patchCustomer: (
      workspaceId: string,
      customerId: string,
      body: Partial<{
        display_name: string;
        type: string;
        status: string;
        email: string | null;
        phone: string | null;
        legal_name: string | null;
        notes: string | null;
        billing_address: Record<string, unknown> | null;
      }>,
    ) =>
      request<CustomerOut>(`/api/v1/workspaces/${workspaceId}/customers/${customerId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    deleteCustomer: (workspaceId: string, customerId: string) =>
      request<{ ok: true }>(`/api/v1/workspaces/${workspaceId}/customers/${customerId}`, {
        method: "DELETE",
      }),
    listCustomerContacts: (workspaceId: string, customerId: string) =>
      request<CustomerContact[]>(`/api/v1/workspaces/${workspaceId}/customers/${customerId}/contacts`),
    createCustomerContact: (
      workspaceId: string,
      customerId: string,
      body: { full_name: string; role_title?: string; email?: string; phone?: string; is_primary?: boolean },
    ) =>
      request<CustomerContact>(`/api/v1/workspaces/${workspaceId}/customers/${customerId}/contacts`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    listSites: (
      workspaceId: string,
      opts: { customer_id?: string; q?: string; limit?: number; status?: string } = {},
    ) => {
      const params = new URLSearchParams({ limit: String(opts.limit ?? 50) });
      if (opts.customer_id) params.set("customer_id", opts.customer_id);
      if (opts.q?.trim()) params.set("q", opts.q.trim());
      if (opts.status) params.set("status", opts.status);
      return request<{ items: SiteOut[]; next_cursor?: string | null }>(
        `/api/v1/workspaces/${workspaceId}/sites?${params}`,
      );
    },
    getSite: (workspaceId: string, siteId: string) =>
      request<SiteOut>(`/api/v1/workspaces/${workspaceId}/sites/${siteId}`),
    createSite: (
      workspaceId: string,
      body: {
        customer_id: string;
        name: string;
        address?: Record<string, unknown>;
        installation_status?: string;
        access_notes?: string;
      },
    ) =>
      request<SiteOut>(`/api/v1/workspaces/${workspaceId}/sites`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    patchSite: (
      workspaceId: string,
      siteId: string,
      body: Partial<{
        name: string;
        address: Record<string, unknown>;
        installation_status: string;
        access_notes: string | null;
      }>,
    ) =>
      request<SiteOut>(`/api/v1/workspaces/${workspaceId}/sites/${siteId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    deleteSite: (workspaceId: string, siteId: string) =>
      request<{ ok: true }>(`/api/v1/workspaces/${workspaceId}/sites/${siteId}`, { method: "DELETE" }),
    listDocuments: (
      workspaceId: string,
      opts: { entity_type?: string; entity_id?: string; limit?: number } = {},
    ) => {
      const params = new URLSearchParams({ limit: String(opts.limit ?? 50) });
      if (opts.entity_type) params.set("entity_type", opts.entity_type);
      if (opts.entity_id) params.set("entity_id", opts.entity_id);
      return request<{ items: DocumentOut[]; next_cursor?: string | null }>(
        `/api/v1/workspaces/${workspaceId}/documents?${params}`,
      );
    },
    createDocumentUpload: (
      workspaceId: string,
      body: {
        entity_type: string;
        entity_id: string;
        kind?: string;
        mime_type?: string;
        original_filename?: string;
        byte_size: number;
      },
    ) =>
      request<{
        document_id: string;
        storage_path: string;
        storage_bucket: string;
        upload_url: string;
        expires_in: number;
        reserved_bytes?: number;
      }>(`/api/v1/workspaces/${workspaceId}/documents/uploads`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    completeDocumentUpload: (
      workspaceId: string,
      documentId: string,
      body: { byte_size?: number; mime_type?: string } = {},
    ) =>
      request<{ id: string }>(`/api/v1/workspaces/${workspaceId}/documents/${documentId}/complete`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    getDocumentUrl: (workspaceId: string, documentId: string) =>
      request<{ url: string; expires_in: number }>(
        `/api/v1/workspaces/${workspaceId}/documents/${documentId}/url`,
      ),
    listLeads: (
      workspaceId: string,
      opts: {
        q?: string;
        status?: string;
        priority?: string;
        source?: string;
        customer_id?: string;
        site_id?: string;
        limit?: number;
      } = {},
    ) => {
      const params = new URLSearchParams({ limit: String(opts.limit ?? 50) });
      if (opts.q?.trim()) params.set("q", opts.q.trim());
      if (opts.status) params.set("status", opts.status);
      if (opts.priority) params.set("priority", opts.priority);
      if (opts.source) params.set("source", opts.source);
      if (opts.customer_id) params.set("customer_id", opts.customer_id);
      if (opts.site_id) params.set("site_id", opts.site_id);
      return request<{ items: LeadOut[] }>(`/api/v1/workspaces/${workspaceId}/leads?${params}`);
    },
    getLead: (workspaceId: string, leadId: string) =>
      request<LeadOut>(`/api/v1/workspaces/${workspaceId}/leads/${leadId}`),
    createLead: (workspaceId: string, body: Partial<LeadOut> & { title: string }) =>
      request<LeadOut>(`/api/v1/workspaces/${workspaceId}/leads`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    patchLead: (workspaceId: string, leadId: string, body: Partial<LeadOut>) =>
      request<LeadOut>(`/api/v1/workspaces/${workspaceId}/leads/${leadId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    listProjects: (
      workspaceId: string,
      opts: { q?: string; status?: string; customer_id?: string; source_quote_id?: string; limit?: number } = {},
    ) => {
      const params = new URLSearchParams({ limit: String(opts.limit ?? 50) });
      if (opts.q?.trim()) params.set("q", opts.q.trim());
      if (opts.status) params.set("status", opts.status);
      if (opts.customer_id) params.set("customer_id", opts.customer_id);
      if (opts.source_quote_id) params.set("source_quote_id", opts.source_quote_id);
      return request<{ items: ProjectOut[] }>(`/api/v1/workspaces/${workspaceId}/projects?${params}`);
    },
    getProject: (workspaceId: string, projectId: string) =>
      request<ProjectOut>(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`),
    createProject: (
      workspaceId: string,
      body: { name: string; customer_id: string; site_id?: string; status?: string; source_quote_id?: string },
    ) =>
      request<ProjectOut>(`/api/v1/workspaces/${workspaceId}/projects`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    createProjectFromQuote: (workspaceId: string, body: { source_quote_id: string; site_id?: string | null }) =>
      request<ProjectOut>(`/api/v1/workspaces/${workspaceId}/projects/from-quote`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    listProjectPlannedItems: (workspaceId: string, projectId: string) =>
      request<{ items: ProjectPlannedItemOut[] }>(
        `/api/v1/workspaces/${workspaceId}/projects/${projectId}/planned-items`,
      ),
    previewCreateInstalledAssets: (workspaceId: string, projectId: string) =>
      request<CreateInstalledAssetsPreviewOut>(
        `/api/v1/workspaces/${workspaceId}/projects/${projectId}/create-installed-assets/preview`,
      ),
    createInstalledAssets: (workspaceId: string, projectId: string) =>
      request<CreateInstalledAssetsResultOut>(
        `/api/v1/workspaces/${workspaceId}/projects/${projectId}/create-installed-assets`,
        { method: "POST", body: JSON.stringify({}) },
      ),
    patchProject: (workspaceId: string, projectId: string, body: Partial<{ name: string; status: string }>) =>
      request<ProjectOut>(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    listServiceCalls: (
      workspaceId: string,
      opts: { q?: string; status?: string; site_id?: string; equipment_id?: string; limit?: number } = {},
    ) => {
      const params = new URLSearchParams({ limit: String(opts.limit ?? 50) });
      if (opts.q?.trim()) params.set("q", opts.q.trim());
      if (opts.status) params.set("status", opts.status);
      if (opts.site_id) params.set("site_id", opts.site_id);
      if (opts.equipment_id) params.set("equipment_id", opts.equipment_id);
      return request<{ items: ServiceCallOut[] }>(
        `/api/v1/workspaces/${workspaceId}/service-calls?${params}`,
      );
    },
    getServiceCall: (workspaceId: string, callId: string) =>
      request<ServiceCallOut>(`/api/v1/workspaces/${workspaceId}/service-calls/${callId}`),
    createServiceCall: (
      workspaceId: string,
      body: {
        title: string;
        customer_id: string;
        site_id: string;
        priority?: string;
        description?: string;
        system_id?: string | null;
        equipment_id?: string | null;
      },
    ) =>
      request<ServiceCallOut>(`/api/v1/workspaces/${workspaceId}/service-calls`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    patchServiceCall: (
      workspaceId: string,
      callId: string,
      body: Partial<{
        title: string;
        status: string;
        priority: string;
        description: string;
        system_id: string | null;
        equipment_id: string | null;
      }>,
    ) =>
      request<ServiceCallOut>(`/api/v1/workspaces/${workspaceId}/service-calls/${callId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    createJobFromServiceCall: (
      workspaceId: string,
      callId: string,
      body: { scheduled_for?: string; scheduled_end?: string; title?: string } = {},
    ) =>
      request<JobOut>(`/api/v1/workspaces/${workspaceId}/service-calls/${callId}/create-job`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    listWarranties: (
      workspaceId: string,
      opts: { status?: string; site_id?: string; customer_id?: string; limit?: number } = {},
    ) => {
      const params = new URLSearchParams({ limit: String(opts.limit ?? 50) });
      if (opts.status) params.set("status", opts.status);
      if (opts.site_id) params.set("site_id", opts.site_id);
      if (opts.customer_id) params.set("customer_id", opts.customer_id);
      return request<{ items: WarrantyOut[] }>(`/api/v1/workspaces/${workspaceId}/warranties?${params}`);
    },
    getWarranty: (workspaceId: string, warrantyId: string) =>
      request<WarrantyOut>(`/api/v1/workspaces/${workspaceId}/warranties/${warrantyId}`),
    createWarranty: (
      workspaceId: string,
      body: {
        customer_id: string;
        site_id?: string | null;
        type?: string;
        starts_on: string;
        ends_on: string;
        equipment_id?: string | null;
        title?: string | null;
        status?: string | null;
        policy?: Record<string, unknown> | null;
      },
    ) =>
      request<WarrantyOut>(`/api/v1/workspaces/${workspaceId}/warranties`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    patchWarranty: (
      workspaceId: string,
      warrantyId: string,
      body: {
        status?: string;
        starts_on?: string;
        ends_on?: string;
        type?: string;
        equipment_id?: string | null;
        title?: string | null;
        policy?: Record<string, unknown> | null;
      },
    ) =>
      request<WarrantyOut>(`/api/v1/workspaces/${workspaceId}/warranties/${warrantyId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    globalSearch: (workspaceId: string, q: string, limit = 12) => {
      const params = new URLSearchParams({ q: q.trim(), limit: String(limit) });
      return request<GlobalSearchResponse>(`/api/v1/workspaces/${workspaceId}/search?${params}`);
    },
    listSystems: (workspaceId: string, siteId: string) =>
      request<{ items: SystemOut[] }>(
        `/api/v1/workspaces/${workspaceId}/systems?site_id=${encodeURIComponent(siteId)}`,
      ),
    createSystem: (
      workspaceId: string,
      body: {
        site_id: string;
        type?: string;
        name: string;
        status?: string;
        manufacturer?: string;
        model?: string;
      },
    ) =>
      request<SystemOut>(`/api/v1/workspaces/${workspaceId}/systems`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    listEquipment: (workspaceId: string, siteId: string) =>
      request<{ items: EquipmentOut[] }>(
        `/api/v1/workspaces/${workspaceId}/equipment?site_id=${encodeURIComponent(siteId)}`,
      ),
    getEquipment: (workspaceId: string, equipmentId: string) =>
      request<EquipmentOut>(`/api/v1/workspaces/${workspaceId}/equipment/${equipmentId}`),
    listEquipmentLifecycleActivity: (workspaceId: string, equipmentId: string) =>
      request<{ items: AssetLifecycleActivityOut[]; source: string }>(
        `/api/v1/workspaces/${workspaceId}/equipment/${equipmentId}/lifecycle-activity`,
      ),
    getSiteNetworkOverview: (workspaceId: string, siteId: string) =>
      request<SiteNetworkOverviewOut>(
        `/api/v1/workspaces/${workspaceId}/sites/${siteId}/network-overview`,
      ),
    listSiteVlans: (workspaceId: string, siteId: string) =>
      request<{ items: SiteVlanOut[] }>(
        `/api/v1/workspaces/${workspaceId}/sites/${siteId}/vlans`,
      ),
    createSiteVlan: (
      workspaceId: string,
      body: {
        site_id: string;
        vlan_number: number;
        name: string;
        purpose?: string | null;
        description?: string | null;
      },
    ) =>
      request<SiteVlanOut>(`/api/v1/workspaces/${workspaceId}/vlans`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    patchSiteVlan: (
      workspaceId: string,
      vlanId: string,
      body: Partial<{ vlan_number: number; name: string; purpose: string | null; description: string | null }>,
    ) =>
      request<SiteVlanOut>(`/api/v1/workspaces/${workspaceId}/vlans/${vlanId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    listSiteNetworks: (workspaceId: string, siteId: string) =>
      request<{ items: SiteNetworkOut[] }>(
        `/api/v1/workspaces/${workspaceId}/sites/${siteId}/networks`,
      ),
    createSiteNetwork: (
      workspaceId: string,
      body: {
        site_id: string;
        name: string;
        cidr: string;
        vlan_id?: string | null;
        gateway?: string | null;
        dhcp_enabled?: boolean;
        dhcp_start?: string | null;
        dhcp_end?: string | null;
        dns_primary?: string | null;
        dns_secondary?: string | null;
        purpose?: string | null;
        notes?: string | null;
      },
    ) =>
      request<SiteNetworkOut>(`/api/v1/workspaces/${workspaceId}/networks`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    patchSiteNetwork: (
      workspaceId: string,
      networkId: string,
      body: Partial<{
        name: string;
        cidr: string;
        vlan_id: string | null;
        gateway: string | null;
        dhcp_enabled: boolean;
        dhcp_start: string | null;
        dhcp_end: string | null;
        dns_primary: string | null;
        dns_secondary: string | null;
        purpose: string | null;
        notes: string | null;
      }>,
    ) =>
      request<SiteNetworkOut>(`/api/v1/workspaces/${workspaceId}/networks/${networkId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    listSiteIpAddresses: (
      workspaceId: string,
      siteId: string,
      opts: { network_id?: string; status?: string; q?: string } = {},
    ) => {
      const params = new URLSearchParams();
      if (opts.network_id) params.set("network_id", opts.network_id);
      if (opts.status) params.set("status", opts.status);
      if (opts.q?.trim()) params.set("q", opts.q.trim());
      const qs = params.toString();
      return request<{ items: SiteIpAddressOut[] }>(
        `/api/v1/workspaces/${workspaceId}/sites/${siteId}/ip-addresses${qs ? `?${qs}` : ""}`,
      );
    },
    listEquipmentIpAddresses: (workspaceId: string, equipmentId: string) =>
      request<{ items: SiteIpAddressOut[]; legacy_ip?: string | null; legacy_mac?: string | null }>(
        `/api/v1/workspaces/${workspaceId}/equipment/${equipmentId}/ip-addresses`,
      ),
    createSiteIpAddress: (
      workspaceId: string,
      body: {
        site_id: string;
        network_id: string;
        ip_address: string;
        vlan_id?: string | null;
        equipment_id?: string | null;
        hostname?: string | null;
        mac_address?: string | null;
        assignment_type?: string;
        status?: string | null;
        notes?: string | null;
      },
    ) =>
      request<SiteIpAddressOut>(`/api/v1/workspaces/${workspaceId}/ip-addresses`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    patchSiteIpAddress: (
      workspaceId: string,
      ipId: string,
      body: Partial<{
        network_id: string;
        ip_address: string;
        vlan_id: string | null;
        equipment_id: string | null;
        hostname: string | null;
        mac_address: string | null;
        assignment_type: string;
        status: string;
        notes: string | null;
        clear_equipment: boolean;
      }>,
    ) =>
      request<SiteIpAddressOut>(`/api/v1/workspaces/${workspaceId}/ip-addresses/${ipId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    deleteSiteIpAddress: (workspaceId: string, ipId: string) =>
      request<{ ok: boolean }>(`/api/v1/workspaces/${workspaceId}/ip-addresses/${ipId}`, {
        method: "DELETE",
      }),
    listSiteAssetConnections: (workspaceId: string, siteId: string) =>
      request<{ items: AssetConnectionOut[] }>(
        `/api/v1/workspaces/${workspaceId}/sites/${siteId}/asset-connections`,
      ),
    listEquipmentAssetConnections: (workspaceId: string, equipmentId: string) =>
      request<{ items: AssetConnectionOut[] }>(
        `/api/v1/workspaces/${workspaceId}/equipment/${equipmentId}/asset-connections`,
      ),
    getSiteTopology: (workspaceId: string, siteId: string) =>
      request<SiteTopologyOut>(`/api/v1/workspaces/${workspaceId}/sites/${siteId}/topology`),
    createAssetConnection: (
      workspaceId: string,
      body: {
        site_id: string;
        source_equipment_id: string;
        target_equipment_id: string;
        connection_type?: string;
        source_port?: string | null;
        target_port?: string | null;
        notes?: string | null;
      },
    ) =>
      request<AssetConnectionOut>(`/api/v1/workspaces/${workspaceId}/asset-connections`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    patchAssetConnection: (
      workspaceId: string,
      connectionId: string,
      body: Partial<{
        target_equipment_id: string;
        connection_type: string;
        source_port: string | null;
        target_port: string | null;
        notes: string | null;
      }>,
    ) =>
      request<AssetConnectionOut>(`/api/v1/workspaces/${workspaceId}/asset-connections/${connectionId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    deleteAssetConnection: (workspaceId: string, connectionId: string) =>
      request<{ ok: boolean }>(`/api/v1/workspaces/${workspaceId}/asset-connections/${connectionId}`, {
        method: "DELETE",
      }),
    createEquipment: (
      workspaceId: string,
      body: {
        site_id: string;
        name: string;
        category?: string;
        status?: string;
        system_id?: string;
        zone_id?: string | null;
        manufacturer?: string;
        model?: string;
        serial?: string;
        mac?: string | null;
        ip?: string;
        location_note?: string;
        installed_at?: string | null;
        product_id?: string | null;
        project_id?: string | null;
        project_planned_item_id?: string | null;
        asset_code?: string | null;
      },
    ) =>
      request<EquipmentOut>(`/api/v1/workspaces/${workspaceId}/equipment`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    patchEquipment: (
      workspaceId: string,
      equipmentId: string,
      body: Partial<{
        name: string;
        category: string;
        status: string;
        system_id: string | null;
        zone_id: string | null;
        manufacturer: string | null;
        model: string | null;
        serial: string | null;
        mac: string | null;
        ip: string | null;
        location_note: string | null;
        installed_at: string | null;
        product_id: string | null;
        project_id: string | null;
        project_planned_item_id: string | null;
        asset_code: string | null;
      }>,
    ) =>
      request<EquipmentOut>(`/api/v1/workspaces/${workspaceId}/equipment/${equipmentId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    listJobs: (
      workspaceId: string,
      opts: {
        q?: string;
        status?: string;
        site_id?: string;
        service_call_id?: string;
        project_id?: string;
        assignment?: "assigned" | "unassigned";
        include_assignees?: boolean;
        include_context?: boolean;
        limit?: number;
        cursor?: string;
      } = {},
    ) => {
      const params = new URLSearchParams({ limit: String(opts.limit ?? 50) });
      if (opts.q?.trim()) params.set("q", opts.q.trim());
      if (opts.status) params.set("status", opts.status);
      if (opts.site_id) params.set("site_id", opts.site_id);
      if (opts.service_call_id) params.set("service_call_id", opts.service_call_id);
      if (opts.project_id) params.set("project_id", opts.project_id);
      if (opts.assignment) params.set("assignment", opts.assignment);
      if (opts.include_assignees) params.set("include_assignees", "true");
      if (opts.include_context) params.set("include_context", "true");
      if (opts.cursor) params.set("cursor", opts.cursor);
      return request<{ items: JobOut[]; next_cursor?: string | null }>(
        `/api/v1/workspaces/${workspaceId}/jobs?${params}`,
      );
    },
    getJob: (workspaceId: string, jobId: string) =>
      request<JobOut>(`/api/v1/workspaces/${workspaceId}/jobs/${jobId}`),
    createJob: (
      workspaceId: string,
      body: {
        title: string;
        customer_id: string;
        site_id: string;
        kind?: string;
        scheduled_for?: string;
        scheduled_end?: string;
        project_id?: string;
        service_call_id?: string;
        priority?: string;
      },
    ) =>
      request<JobOut>(`/api/v1/workspaces/${workspaceId}/jobs`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    assignJob: (workspaceId: string, jobId: string, body: { user_id: string }) =>
      request<{
        job_id: string;
        user_id: string;
        assigned_at?: string | null;
        assigned_by?: string | null;
        assignees: JobAssigneeOut[];
        reassigned: boolean;
      }>(`/api/v1/workspaces/${workspaceId}/jobs/${jobId}/assign`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    enRouteJob: (workspaceId: string, jobId: string) =>
      request<JobOut>(`/api/v1/workspaces/${workspaceId}/jobs/${jobId}/en-route`, { method: "POST" }),
    arrivedJob: (workspaceId: string, jobId: string) =>
      request<JobOut>(`/api/v1/workspaces/${workspaceId}/jobs/${jobId}/arrived`, { method: "POST" }),
    startJob: (workspaceId: string, jobId: string) =>
      request<JobOut>(`/api/v1/workspaces/${workspaceId}/jobs/${jobId}/start`, { method: "POST" }),
    completeJob: (workspaceId: string, jobId: string, body: { completion_notes?: string } = {}) =>
      request<JobOut>(`/api/v1/workspaces/${workspaceId}/jobs/${jobId}/complete`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    listJobChecklist: (workspaceId: string, jobId: string) =>
      request<JobChecklistItem[]>(`/api/v1/workspaces/${workspaceId}/jobs/${jobId}/checklist`),
    patchJobChecklistItem: (
      workspaceId: string,
      jobId: string,
      itemId: string,
      body: { completed: boolean },
    ) =>
      request<JobChecklistItem>(`/api/v1/workspaces/${workspaceId}/jobs/${jobId}/checklist/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    listTasks: (
      workspaceId: string,
      opts: { status?: string; type?: string; lead_id?: string; limit?: number } = {},
    ) => {
      const params = new URLSearchParams({ limit: String(opts.limit ?? 50) });
      if (opts.status) params.set("status", opts.status);
      if (opts.type) params.set("type", opts.type);
      if (opts.lead_id) params.set("lead_id", opts.lead_id);
      return request<{ items: TaskOut[] }>(`/api/v1/workspaces/${workspaceId}/tasks?${params}`);
    },
    createTask: (workspaceId: string, body: Partial<TaskOut> & { title: string }) =>
      request<TaskOut>(`/api/v1/workspaces/${workspaceId}/tasks`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    patchTask: (workspaceId: string, taskId: string, body: Partial<TaskOut>) =>
      request<TaskOut>(`/api/v1/workspaces/${workspaceId}/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    listKnowledge: (workspaceId: string, opts: { q?: string; category?: string; limit?: number } = {}) => {
      const params = new URLSearchParams({ limit: String(opts.limit ?? 50) });
      if (opts.q?.trim()) params.set("q", opts.q.trim());
      if (opts.category) params.set("category", opts.category);
      return request<{ items: KnowledgeOut[] }>(`/api/v1/workspaces/${workspaceId}/knowledge?${params}`);
    },
    createKnowledge: (workspaceId: string, body: { title: string; body: string; category?: string }) =>
      request<KnowledgeOut>(`/api/v1/workspaces/${workspaceId}/knowledge`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    patchKnowledge: (
      workspaceId: string,
      articleId: string,
      body: Partial<{ title: string; body: string; category: string }>,
    ) =>
      request<KnowledgeOut>(`/api/v1/workspaces/${workspaceId}/knowledge/${articleId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    recommendCctv: (workspaceId: string, body: CctvRecommendIn) =>
      request<SystemRecommendation>(`/api/v1/workspaces/${workspaceId}/cctv/recommend`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    listSystemDesigns: (workspaceId: string, quoteId: string) =>
      request<{ items: SystemDesign[] }>(
        `/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/system-designs`,
      ),
    createSystemDesign: (workspaceId: string, quoteId: string, body: SystemDesignCreateIn) =>
      request<SystemDesign>(`/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/system-designs`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    getSystemDesign: (workspaceId: string, designId: string) =>
      request<SystemDesign>(`/api/v1/workspaces/${workspaceId}/system-designs/${designId}`),
    patchSystemDesign: (workspaceId: string, designId: string, body: SystemDesignPatchIn) =>
      request<SystemDesign>(`/api/v1/workspaces/${workspaceId}/system-designs/${designId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    deleteSystemDesign: (workspaceId: string, designId: string) =>
      request<{ ok: boolean }>(`/api/v1/workspaces/${workspaceId}/system-designs/${designId}`, {
        method: "DELETE",
      }),
    applySystemDesign: (workspaceId: string, designId: string, body: SystemDesignApplyIn) =>
      request<SystemDesignApplyResult>(
        `/api/v1/workspaces/${workspaceId}/system-designs/${designId}/apply`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      ),
    listCatalogProducts: (
      workspaceId: string,
      opts: { q?: string; kind?: string; category_id?: string; limit?: number; include_inactive?: boolean; active?: boolean } = {},
    ) => {
      const params = new URLSearchParams({ limit: String(opts.limit ?? 30) });
      if (opts.q?.trim()) params.set("q", opts.q.trim());
      if (opts.kind) params.set("kind", opts.kind);
      if (opts.category_id) params.set("category_id", opts.category_id);
      if (opts.include_inactive) params.set("include_inactive", "true");
      if (opts.active === false) params.set("active", "false");
      return request<{ items: CatalogProduct[] }>(
        `/api/v1/workspaces/${workspaceId}/catalog/products?${params}`,
      );
    },
    createCatalogProduct: (
      workspaceId: string,
      body: {
        name: string;
        sku?: string;
        kind?: string;
        list_price?: number;
        cost?: number;
        description?: string;
        unit?: string;
        category_id?: string;
        is_active?: boolean;
        manufacturer?: string | null;
        model?: string | null;
        attributes?: Record<string, unknown>;
      },
    ) =>
      request<CatalogProduct>(`/api/v1/workspaces/${workspaceId}/catalog/products`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    patchCatalogProduct: (
      workspaceId: string,
      productId: string,
      body: {
        name?: string;
        sku?: string;
        kind?: string;
        list_price?: number;
        cost?: number;
        description?: string;
        unit?: string;
        category_id?: string | null;
        is_active?: boolean;
        manufacturer?: string | null;
        model?: string | null;
        attributes?: Record<string, unknown>;
      },
    ) =>
      request<CatalogProduct>(`/api/v1/workspaces/${workspaceId}/catalog/products/${productId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    getCatalogProduct: (workspaceId: string, productId: string) =>
      request<CatalogProduct>(`/api/v1/workspaces/${workspaceId}/catalog/products/${productId}`),
    listCatalogCategories: (workspaceId: string) =>
      request<{ items: CatalogCategory[] }>(`/api/v1/workspaces/${workspaceId}/catalog/categories`),
    ensureCatalogDefaults: (workspaceId: string) =>
      request<{ ok: boolean; roots: number; leaves: number; categories: number }>(
        `/api/v1/workspaces/${workspaceId}/catalog/ensure-defaults`,
        { method: "POST", body: "{}" },
      ),
    bulkCatalogPricing: (
      workspaceId: string,
      body: {
        mode: "markup_percent" | "multiplier";
        value: number;
        only_missing_list_price?: boolean;
        category_id?: string | null;
        manufacturer?: string | null;
        dry_run?: boolean;
        limit?: number;
      },
    ) =>
      request<{
        dry_run: boolean;
        matched: number;
        will_update: number;
        updated: number;
        skipped: number;
        sample: Array<{
          id: string;
          sku: string | null;
          name: string | null;
          cost: number;
          list_price_before: number;
          list_price_after: number;
        }>;
        mode: string;
        value: number;
      }>(`/api/v1/workspaces/${workspaceId}/catalog/products/bulk-pricing`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    catalogImportTargets: (workspaceId: string) =>
      request<CatalogImportTargets>(`/api/v1/workspaces/${workspaceId}/catalog/import/targets`),
    catalogImportTemplate: (workspaceId: string) =>
      requestBlob(`/api/v1/workspaces/${workspaceId}/catalog/import/template`),
    catalogImportParse: (workspaceId: string, file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return request<CatalogImportParseResult>(`/api/v1/workspaces/${workspaceId}/catalog/import/parse`, {
        method: "POST",
        body: fd,
      });
    },
    catalogImportPreview: (workspaceId: string, body: CatalogImportPreviewIn) =>
      request<CatalogImportPreviewResult>(`/api/v1/workspaces/${workspaceId}/catalog/import/preview`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    catalogImportCommit: (workspaceId: string, body: CatalogImportCommitIn) =>
      request<CatalogImportCommitResult>(`/api/v1/workspaces/${workspaceId}/catalog/import/commit`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    listQuoteTemplates: (workspaceId: string) =>
      request<{ items: QuoteTemplate[] }>(`/api/v1/workspaces/${workspaceId}/catalog/templates`),
    getPublicQuote: (token: string) =>
      request<PublicQuote>(`/api/v1/public/quotes/${encodeURIComponent(token)}`),
    approvePublicQuote: (
      token: string,
      body: {
        name?: string;
        user_agent?: string;
        terms_accepted?: boolean;
        signature_data_url?: string;
      } = {},
    ) =>
      request<PublicQuote>(`/api/v1/public/quotes/${encodeURIComponent(token)}/approve`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    rejectPublicQuote: (token: string, body: { reason?: string; user_agent?: string } = {}) =>
      request<PublicQuote>(`/api/v1/public/quotes/${encodeURIComponent(token)}/reject`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    listMembers: (workspaceId: string) =>
      request<MemberOut[]>(`/api/v1/workspaces/${workspaceId}/members`),
    getUsage: (workspaceId: string) =>
      request<WorkspaceUsage>(`/api/v1/workspaces/${workspaceId}/usage`),
    patchMember: (
      workspaceId: string,
      memberId: string,
      body: { role_key?: string; workspace_role_key?: string; status?: "active" | "disabled" },
    ) =>
      request<MemberOut>(`/api/v1/workspaces/${workspaceId}/members/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    getWorkspaceSettings: (workspaceId: string) =>
      request<WorkspaceSettingsOut>(`/api/v1/workspaces/${workspaceId}/settings`),
    patchWorkspaceSettings: (
      workspaceId: string,
      body: Partial<
        Pick<
          WorkspaceSettingsOut,
          "branding" | "quotes" | "taxes" | "scheduling" | "notifications" | "localization"
        >
      >,
    ) =>
      request<WorkspaceSettingsOut>(`/api/v1/workspaces/${workspaceId}/settings`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    listWorkspaceRoles: (workspaceId: string) =>
      request<WorkspaceRoleOut[]>(`/api/v1/workspaces/${workspaceId}/roles`),
    createWorkspaceRole: (
      workspaceId: string,
      body: { label_he: string; description?: string; base_role_key?: string; grants?: string[] },
    ) =>
      request<WorkspaceRoleOut>(`/api/v1/workspaces/${workspaceId}/roles`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    patchWorkspaceRole: (
      workspaceId: string,
      roleId: string,
      body: { label_he?: string; description?: string; grants?: string[] },
    ) =>
      request<WorkspaceRoleOut>(`/api/v1/workspaces/${workspaceId}/roles/${roleId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    listPdfTemplates: (workspaceId: string) =>
      request<PdfDocumentTemplateOut[]>(`/api/v1/workspaces/${workspaceId}/pdf-templates`),
    createPdfTemplate: (
      workspaceId: string,
      body: {
        name: string;
        doc_type?: "quote" | "service" | "project";
        status?: "active" | "draft" | "archived";
        is_default?: boolean;
        config?: Record<string, unknown>;
      },
    ) =>
      request<PdfDocumentTemplateOut>(`/api/v1/workspaces/${workspaceId}/pdf-templates`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    patchPdfTemplate: (
      workspaceId: string,
      templateId: string,
      body: {
        name?: string;
        status?: "active" | "draft" | "archived";
        is_default?: boolean;
        config?: Record<string, unknown>;
      },
    ) =>
      request<PdfDocumentTemplateOut>(`/api/v1/workspaces/${workspaceId}/pdf-templates/${templateId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    duplicatePdfTemplate: (workspaceId: string, templateId: string) =>
      request<PdfDocumentTemplateOut>(
        `/api/v1/workspaces/${workspaceId}/pdf-templates/${templateId}/duplicate`,
        { method: "POST", body: "{}" },
      ),
    previewPdfTemplate: (
      workspaceId: string,
      templateId: string,
      body?: { name?: string; config?: Record<string, unknown> },
      inline = true,
      signal?: AbortSignal,
    ) => {
      const q = inline ? "?inline=true" : "?inline=false";
      return requestBlob(`/api/v1/workspaces/${workspaceId}/pdf-templates/${templateId}/preview${q}`, {
        method: "POST",
        body: JSON.stringify(body ?? {}),
        headers: { "Content-Type": "application/json" },
        signal,
      });
    },
    getCompanyProfile: (workspaceId: string) =>
      request<{ workspace_id: string; profile: Record<string, unknown>; missing_for_quote: string[] }>(
        `/api/v1/workspaces/${workspaceId}/company-profile`,
      ),
    createCompanyLogoUpload: (
      workspaceId: string,
      body: { original_filename?: string; mime_type: string; byte_size: number },
    ) =>
      request<{
        logo_asset_id: string;
        logo_bucket: string;
        logo_storage_path: string;
        upload_url: string;
        expires_in: number;
        mime_type: string;
        max_bytes: number;
      }>(`/api/v1/workspaces/${workspaceId}/company-profile/logo-upload`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    completeCompanyLogo: (
      workspaceId: string,
      body: {
        logo_asset_id: string;
        logo_storage_path: string;
        logo_bucket?: string;
        mime_type?: string;
      },
    ) =>
      request<{ workspace_id: string; profile: Record<string, unknown>; missing_for_quote: string[] }>(
        `/api/v1/workspaces/${workspaceId}/company-profile/logo-complete`,
        { method: "POST", body: JSON.stringify(body) },
      ),
    previewCompanyDocument: (workspaceId: string, documentType: "quote" | "tax_invoice" = "quote") => {
      const q = new URLSearchParams({ document_type: documentType, inline: "true" });
      return requestBlob(`/api/v1/workspaces/${workspaceId}/company-profile/document-preview?${q}`, {
        method: "POST",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      });
    },
    createInvitation: (workspaceId: string, body: { email: string; role_key?: string }) =>
      request<InviteOut>(`/api/v1/workspaces/${workspaceId}/invitations`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    listInvitations: (workspaceId: string) =>
      request<WorkspaceInvitation[]>(`/api/v1/workspaces/${workspaceId}/invitations`),
    revokeInvitation: (workspaceId: string, invitationId: string) =>
      request<WorkspaceInvitation>(`/api/v1/workspaces/${workspaceId}/invitations/${invitationId}/revoke`, {
        method: "POST",
      }),
    reissueInvitation: (workspaceId: string, invitationId: string) =>
      request<InviteOut>(`/api/v1/workspaces/${workspaceId}/invitations/${invitationId}/reissue`, {
        method: "POST",
      }),
    peekInvitation: (token: string) => {
      const params = new URLSearchParams({ token });
      return request<InvitePreview>(`/api/v1/invitations/peek?${params.toString()}`);
    },
    peekInvitationPublic: (token: string) => {
      const params = new URLSearchParams({ token });
      return request<InvitePreview>(`/api/v1/invitations/public-peek?${params.toString()}`);
    },
    acceptInvitation: (token: string) =>
      request<InviteAcceptResult>("/api/v1/invitations/accept", {
        method: "POST",
        body: JSON.stringify({ token }),
      }),
    listCustomerPortal: (workspaceId: string, customerId: string) =>
      request<{ access: PortalAccess[] }>(`/api/v1/workspaces/${workspaceId}/customers/${customerId}/portal`),
    enableCustomerPortal: (workspaceId: string, customerId: string, body: { email: string }) =>
      request<PortalAccess>(`/api/v1/workspaces/${workspaceId}/customers/${customerId}/portal`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    copyCustomerPortalLink: (workspaceId: string, customerId: string, accessId: string) =>
      request<PortalAccess>(`/api/v1/workspaces/${workspaceId}/customers/${customerId}/portal/${accessId}/link`, {
        method: "POST",
      }),
    resendCustomerPortal: (workspaceId: string, customerId: string, accessId: string) =>
      request<PortalAccess>(`/api/v1/workspaces/${workspaceId}/customers/${customerId}/portal/${accessId}/resend`, {
        method: "POST",
      }),
    revokeCustomerPortal: (workspaceId: string, customerId: string, accessId: string) =>
      request<PortalAccess>(`/api/v1/workspaces/${workspaceId}/customers/${customerId}/portal/${accessId}/revoke`, {
        method: "POST",
      }),
    peekPortalInvite: (token: string) => {
      const params = new URLSearchParams({ token });
      return request<PortalInvitePreview>(`/api/v1/portal/invites/peek?${params.toString()}`);
    },
    acceptPortalInvite: (token: string) =>
      request<{ access_id: string; status: string }>("/api/v1/portal/invites/accept", {
        method: "POST",
        body: JSON.stringify({ token }),
      }),
    getPortalSession: () => request<PortalSession>("/api/v1/portal/session"),
    getPortalHome: (accessId: string) => request<PortalHome>(`/api/v1/portal/access/${accessId}`),
    getPortalDocumentUrl: (accessId: string, documentId: string) =>
      request<{ url: string }>(`/api/v1/portal/access/${accessId}/documents/${documentId}/url`, {
        method: "POST",
      }),
    listAudit: (workspaceId: string) =>
      request<AuditItem[]>(`/api/v1/workspaces/${workspaceId}/audit`),
    getSecurityCenter: (workspaceId: string) =>
      request<SecurityCenter>(`/api/v1/workspaces/${workspaceId}/security`),
    getAuthzCatalog: () => request<AuthzCatalog>("/api/v1/authz/catalog"),
    listFeedback: (workspaceId?: string) => {
      const params = new URLSearchParams();
      if (workspaceId) params.set("workspace_id", workspaceId);
      const q = params.toString();
      return request<FeedbackReport[]>(`/api/v1/feedback${q ? `?${q}` : ""}`);
    },
    createFeedback: (body: {
      workspace_id: string;
      report_type: "bug" | "feature" | "general";
      title: string;
      body: string;
      severity?: string;
      page_url?: string;
      user_agent?: string;
      viewport?: string;
      screenshot_url?: string;
    }) =>
      request<FeedbackReport>("/api/v1/feedback", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    listFeatureFlags: (workspaceId?: string) => {
      const params = new URLSearchParams();
      if (workspaceId) params.set("workspace_id", workspaceId);
      const q = params.toString();
      return request<FeatureFlag[]>(`/api/v1/feature-flags${q ? `?${q}` : ""}`);
    },
    adminSummary: () => request<AdminSummary>("/api/v1/admin/summary"),
    adminArchive: (opts: { kind?: "workspaces" | "profiles" | "soft_users" | "all"; q?: string; batch?: string; limit?: number } = {}) => {
      const params = new URLSearchParams();
      if (opts.kind) params.set("kind", opts.kind);
      if (opts.q) params.set("q", opts.q);
      if (opts.batch) params.set("batch", opts.batch);
      if (opts.limit) params.set("limit", String(opts.limit));
      const q = params.toString();
      return request<AdminArchiveResponse>(`/api/v1/admin/archive${q ? `?${q}` : ""}`);
    },
    adminArchiveProfile: (profileId: string) =>
      request<AdminArchiveProfile>(`/api/v1/admin/archive/profiles/${profileId}`),
    adminRestoreArchiveProfile: (
      profileId: string,
      body: { workspace_id: string; role_key: "owner" | "manager" | "sales" | "technician" | "viewer" | "administrator" },
    ) =>
      request<AdminArchiveRestoreResult>(`/api/v1/admin/archive/profiles/${profileId}/restore`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    adminOrganizations: () => request<AdminOrganization[]>("/api/v1/admin/organizations"),
    adminCreateOrganization: (body: {
      name: string;
      plan_key?: string;
      is_beta?: boolean;
      beta_program?: string;
      internal_note?: string | null;
    }) =>
      request<AdminOrganization>("/api/v1/admin/organizations", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    adminPatchOrganization: (workspaceId: string, body: { is_beta?: boolean; beta_program?: string }) =>
      request<AdminOrganization>(`/api/v1/admin/organizations/${workspaceId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    adminMemberships: (opts: { workspace_id?: string; limit?: number } = {}) => {
      const params = new URLSearchParams();
      if (opts.workspace_id) params.set("workspace_id", opts.workspace_id);
      if (opts.limit) params.set("limit", String(opts.limit));
      const q = params.toString();
      return request<AdminMembership[]>(`/api/v1/admin/memberships${q ? `?${q}` : ""}`);
    },
    adminInvitations: (opts: { workspace_id?: string; status?: string; limit?: number } = {}) => {
      const params = new URLSearchParams();
      if (opts.workspace_id) params.set("workspace_id", opts.workspace_id);
      if (opts.status) params.set("status", opts.status);
      if (opts.limit) params.set("limit", String(opts.limit));
      const q = params.toString();
      return request<AdminInvitation[]>(`/api/v1/admin/invitations${q ? `?${q}` : ""}`);
    },
    adminCreateInvitation: (body: { workspace_id: string; email: string; role_key: string }) =>
      request<AdminInvitation>("/api/v1/admin/invitations", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    adminRevokeInvitation: (invitationId: string) =>
      request<AdminInvitation>(`/api/v1/admin/invitations/${invitationId}/revoke`, { method: "POST" }),
    adminReissueInvitation: (invitationId: string) =>
      request<AdminInvitation>(`/api/v1/admin/invitations/${invitationId}/reissue`, { method: "POST" }),
    adminUsers: (opts: { q?: string; status?: "all" | "active" | "archived" } = {}) => {
      const params = new URLSearchParams();
      if (opts.q) params.set("q", opts.q);
      if (opts.status) params.set("status", opts.status);
      const q = params.toString();
      return request<AdminUser[]>(`/api/v1/admin/users${q ? `?${q}` : ""}`);
    },
    adminArchiveUser: (userId: string, body: { reason?: string | null } = {}) =>
      request<AdminUser>(`/api/v1/admin/users/${userId}/archive`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    adminRestoreUser: (userId: string) =>
      request<AdminUser>(`/api/v1/admin/users/${userId}/restore`, {
        method: "POST",
      }),
    adminPatchUserBadges: (
      userId: string,
      body: { recognition_badges: string[]; reason?: string | null },
    ) =>
      request<AdminUser>(`/api/v1/admin/users/${userId}/badges`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    adminBetaParticipants: (
      opts: { status?: string; cohort?: string; badge?: string } = {},
    ) => {
      const params = new URLSearchParams();
      if (opts.status) params.set("status", opts.status);
      if (opts.cohort) params.set("cohort", opts.cohort);
      if (opts.badge) params.set("badge", opts.badge);
      const q = params.toString();
      return request<BetaParticipant[]>(`/api/v1/admin/beta/participants${q ? `?${q}` : ""}`);
    },
    adminPatchUserBeta: (
      userId: string,
      body: {
        workspace_id: string;
        status: BetaParticipantStatus;
        cohort?: string | null;
        internal_note?: string | null;
      },
    ) =>
      request<BetaParticipant>(`/api/v1/admin/users/${userId}/beta`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    adminAuditLogs: (opts: { limit?: number } = {}) => {
      const params = new URLSearchParams({ limit: String(opts.limit ?? 100) });
      return request<
        Array<{
          id: string;
          source?: string;
          workspace_id?: string | null;
          workspace_name?: string | null;
          actor_user_id?: string | null;
          actor_email?: string | null;
          target_user_id?: string | null;
          action: string;
          entity_type?: string | null;
          entity_id?: string | null;
          created_at: string;
          metadata?: Record<string, unknown>;
        }>
      >(`/api/v1/admin/audit?${params}`);
    },
    reportClientError: (body: {
      workspace_id?: string;
      message: string;
      stack?: string;
      page_url?: string;
      user_agent?: string;
      app_version?: string;
      kind?: string;
    }) =>
      request<{ ok: boolean }>(`/api/v1/telemetry/client-error`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    adminFeedback: (opts: { status?: string; report_type?: string } = {}) => {
      const params = new URLSearchParams();
      if (opts.status) params.set("status", opts.status);
      if (opts.report_type) params.set("report_type", opts.report_type);
      const q = params.toString();
      return request<FeedbackReport[]>(`/api/v1/admin/feedback${q ? `?${q}` : ""}`);
    },
    adminPatchFeedback: (
      id: string,
      body: { status?: string; internal_notes?: string; severity?: string },
    ) =>
      request<FeedbackReport>(`/api/v1/admin/feedback/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    adminFeatureFlags: () => request<FeatureFlag[]>("/api/v1/admin/feature-flags"),
    adminPatchFeatureFlag: (
      id: string,
      body: { enabled_for_beta?: boolean; enabled_for_production?: boolean; description?: string },
    ) =>
      request<FeatureFlag>(`/api/v1/admin/feature-flags/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
