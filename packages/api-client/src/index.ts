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
    const err = json as ApiErrorBody;
    throw new ApiClientError(
      res.status,
      err.error?.code ?? "BUSINESS_RULE",
      err.error?.message ?? API_UNAVAILABLE_HE,
      err.error?.details ?? {},
    );
  }
  return json as T;
}

export type SessionMembership = {
  workspace_id: string;
  workspace_name: string;
  workspace_status: string;
  role_key: string;
  technician_code: string | null;
  program_type: string | null;
  plan_key: string;
  features: string[];
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
  } | null;
  memberships: SessionMembership[];
  has_workspace: boolean;
  is_platform_admin?: boolean;
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

export type AdminUser = {
  id: string;
  email: string | null;
  full_name: string;
  is_platform_admin: boolean;
  created_at: string;
  memberships: {
    workspace_id: string;
    workspace_name?: string | null;
    role_key: string;
    is_beta?: boolean;
  }[];
};

export type AdminSummary = {
  organizations: number;
  beta_organizations: number;
  users: number;
  feedback_open: number;
  feedback_total: number;
};

export type DashboardItem = {
  entity_type: string;
  entity_id: string;
  number: string;
  title_he: string;
  customer_name: string | null;
  site_name: string | null;
  scheduled_for: string | null;
  severity: "now" | "next" | "info";
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
  customer_name: string | null;
  total_gross: number | null;
  updated_at: string;
};

export type DashboardResponse = {
  home_variant: "ops" | "sales" | "today" | "observe";
  generated_at: string;
  attention: AttentionGroup[];
  today: { label_he: string; items: DashboardItem[] };
  activity: { entity_type: string; entity_id: string; title_he: string; occurred_at: string }[];
  summary: DashboardSummary;
  recent_quotes: RecentQuote[];
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
  valid_until?: string | null;
  customer_notes?: string | null;
  internal_notes?: string | null;
  version?: number;
  sent_at?: string | null;
  viewed_at?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  public_url?: string | null;
  public_token?: string | null;
  validation?: { can_send: boolean; gaps: QuoteGap[] };
  updated_at?: string;
  created_at?: string;
  items?: QuoteItemOut[];
  sections?: QuoteSection[];
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
};

export type QuotePackage = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  is_active?: boolean;
};

export type QuoteVersionMeta = {
  id: string;
  version: number;
  created_at?: string;
  created_by?: string | null;
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
};

export type CatalogCategory = {
  id: string;
  key: string;
  name_he: string;
  sort_order?: number;
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
  assigned_to?: string | null;
  created_at: string;
  updated_at: string;
};

export type ServiceCallOut = {
  id: string;
  workspace_id: string;
  status: string;
  priority: string;
  customer_id: string;
  site_id: string;
  title: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
};

export type WarrantyOut = {
  id: string;
  workspace_id: string;
  number: string;
  type: string;
  status: string;
  customer_id: string;
  site_id: string;
  starts_on: string;
  ends_on: string;
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
  can_approve: boolean;
  can_reject: boolean;
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
  subtotal_net: number;
  vat_amount: number;
  total_gross: number;
  company: { name?: string | null; logo_url?: string | null; brand_name?: string | null };
  customer: { display_name?: string | null; email?: string | null; phone?: string | null } | null;
  site: { name?: string | null; address?: Record<string, unknown> } | null;
  items: QuoteItemOut[];
  sections?: Array<{ id: string; name?: string | null; sort_order?: number }>;
  issued_at?: string | null;
  sent_at?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
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
  status: string;
  created_at: string | null;
};

export type InviteOut = {
  id: string;
  email: string;
  role_key: string;
  expires_at: string;
  token: string | null;
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

export type JobOut = {
  id: string;
  workspace_id: string;
  number: string;
  title: string;
  kind?: string;
  status: string;
  project_id?: string | null;
  service_call_id?: string | null;
  customer_id?: string;
  site_id?: string;
  scheduled_for?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  completion_notes?: string | null;
  created_at?: string;
  updated_at?: string;
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
  created_at: string;
  updated_at: string;
};

export type GlobalSearchHit = {
  entity_type: "customer" | "site" | "lead" | "quote" | "project" | "service" | "equipment";
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
    headers.set("Content-Type", "application/json");
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
      opts: { q?: string; status?: string; customer_id?: string; lead_id?: string; limit?: number; cursor?: string | null } = {},
    ) => {
      const params = new URLSearchParams({ limit: String(opts.limit ?? 50) });
      if (opts.q?.trim()) params.set("q", opts.q.trim());
      if (opts.status?.trim()) params.set("status", opts.status.trim());
      if (opts.customer_id) params.set("customer_id", opts.customer_id);
      if (opts.lead_id) params.set("lead_id", opts.lead_id);
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
      request<{ public_url: string; public_token: string }>(
        `/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/share`,
        { method: "POST" },
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
      request<{ items: QuoteVersionMeta[]; current_version: number }>(
        `/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/versions`,
      ),
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
      body: { entity_type: string; entity_id: string; kind?: string; mime_type?: string; original_filename?: string },
    ) =>
      request<{
        document_id: string;
        storage_path: string;
        storage_bucket: string;
        upload_url: string;
        expires_in: number;
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
    createProjectFromQuote: (workspaceId: string, body: { source_quote_id: string }) =>
      request<ProjectOut>(`/api/v1/workspaces/${workspaceId}/projects/from-quote`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    patchProject: (workspaceId: string, projectId: string, body: Partial<{ name: string; status: string }>) =>
      request<ProjectOut>(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    listServiceCalls: (workspaceId: string, opts: { q?: string; status?: string; limit?: number } = {}) => {
      const params = new URLSearchParams({ limit: String(opts.limit ?? 50) });
      if (opts.q?.trim()) params.set("q", opts.q.trim());
      if (opts.status) params.set("status", opts.status);
      return request<{ items: ServiceCallOut[] }>(
        `/api/v1/workspaces/${workspaceId}/service-calls?${params}`,
      );
    },
    createServiceCall: (
      workspaceId: string,
      body: { title: string; customer_id: string; site_id: string; priority?: string; description?: string },
    ) =>
      request<ServiceCallOut>(`/api/v1/workspaces/${workspaceId}/service-calls`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    patchServiceCall: (
      workspaceId: string,
      callId: string,
      body: Partial<{ title: string; status: string; priority: string; description: string }>,
    ) =>
      request<ServiceCallOut>(`/api/v1/workspaces/${workspaceId}/service-calls/${callId}`, {
        method: "PATCH",
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
    createWarranty: (
      workspaceId: string,
      body: { customer_id: string; site_id: string; type?: string; starts_on: string; ends_on: string },
    ) =>
      request<WarrantyOut>(`/api/v1/workspaces/${workspaceId}/warranties`, {
        method: "POST",
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
    createEquipment: (
      workspaceId: string,
      body: {
        site_id: string;
        name: string;
        category?: string;
        status?: string;
        system_id?: string;
        manufacturer?: string;
        model?: string;
        serial?: string;
        ip?: string;
        location_note?: string;
      },
    ) =>
      request<EquipmentOut>(`/api/v1/workspaces/${workspaceId}/equipment`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    listJobs: (
      workspaceId: string,
      opts: { q?: string; status?: string; site_id?: string; limit?: number } = {},
    ) => {
      const params = new URLSearchParams({ limit: String(opts.limit ?? 50) });
      if (opts.q?.trim()) params.set("q", opts.q.trim());
      if (opts.status) params.set("status", opts.status);
      if (opts.site_id) params.set("site_id", opts.site_id);
      return request<{ items: JobOut[] }>(`/api/v1/workspaces/${workspaceId}/jobs?${params}`);
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
        project_id?: string;
      },
    ) =>
      request<JobOut>(`/api/v1/workspaces/${workspaceId}/jobs`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
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
      },
    ) =>
      request<CatalogProduct>(`/api/v1/workspaces/${workspaceId}/catalog/products/${productId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    listCatalogCategories: (workspaceId: string) =>
      request<{ items: CatalogCategory[] }>(`/api/v1/workspaces/${workspaceId}/catalog/categories`),
    listQuoteTemplates: (workspaceId: string) =>
      request<{ items: QuoteTemplate[] }>(`/api/v1/workspaces/${workspaceId}/catalog/templates`),
    getPublicQuote: (token: string) =>
      request<PublicQuote>(`/api/v1/public/quotes/${encodeURIComponent(token)}`),
    approvePublicQuote: (token: string, body: { name?: string } = {}) =>
      request<PublicQuote>(`/api/v1/public/quotes/${encodeURIComponent(token)}/approve`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    rejectPublicQuote: (token: string, body: { reason?: string } = {}) =>
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
      body: { role_key?: string; status?: "active" | "disabled" },
    ) =>
      request<MemberOut>(`/api/v1/workspaces/${workspaceId}/members/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    createInvitation: (workspaceId: string, body: { email: string; role_key?: string }) =>
      request<InviteOut>(`/api/v1/workspaces/${workspaceId}/invitations`, {
        method: "POST",
        body: JSON.stringify(body),
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
    adminOrganizations: () => request<AdminOrganization[]>("/api/v1/admin/organizations"),
    adminPatchOrganization: (workspaceId: string, body: { is_beta?: boolean; beta_program?: string }) =>
      request<AdminOrganization>(`/api/v1/admin/organizations/${workspaceId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    adminUsers: () => request<AdminUser[]>("/api/v1/admin/users"),
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
