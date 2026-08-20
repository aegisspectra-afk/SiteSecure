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
};

export type WorkspaceOut = {
  id: string;
  name: string;
  status: string;
  timezone: string | null;
  vat_percent: number | null;
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
  line_net?: number;
  item_type?: string;
  catalog_snapshot?: Record<string, unknown>;
};

export type QuotePatchBody = {
  customer_id?: string | null;
  site_id?: string | null;
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
  sort_order?: number;
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
  display_name: string;
  email?: string | null;
  phone?: string | null;
};

export type SiteOut = {
  id: string;
  customer_id: string;
  name: string;
  address?: Record<string, unknown>;
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
  company: { name?: string | null };
  customer: { display_name?: string | null; email?: string | null; phone?: string | null } | null;
  site: { name?: string | null; address?: Record<string, unknown> } | null;
  items: QuoteItemOut[];
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
  status: string;
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
    createWorkspace: (body: { name: string; plan_key?: string }) =>
      request<WorkspaceOut>("/api/v1/workspaces", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    patchWorkspace: (
      workspaceId: string,
      body: { timezone?: string; vat_percent?: number; name?: string },
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
      opts: { q?: string; status?: string; limit?: number; cursor?: string | null } = {},
    ) => {
      const params = new URLSearchParams({ limit: String(opts.limit ?? 50) });
      if (opts.q?.trim()) params.set("q", opts.q.trim());
      if (opts.status?.trim()) params.set("status", opts.status.trim());
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
    reviseQuote: (workspaceId: string, quoteId: string) =>
      request<QuoteOut>(`/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/revise`, { method: "POST" }),
    shareQuote: (workspaceId: string, quoteId: string) =>
      request<{ public_url: string; public_token: string }>(
        `/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/share`,
        { method: "POST" },
      ),
    listCustomers: (workspaceId: string, opts: { q?: string; limit?: number } = {}) => {
      const params = new URLSearchParams({ limit: String(opts.limit ?? 50) });
      if (opts.q?.trim()) params.set("q", opts.q.trim());
      return request<{ items: CustomerOut[] }>(`/api/v1/workspaces/${workspaceId}/customers?${params}`);
    },
    getCustomer: (workspaceId: string, customerId: string) =>
      request<CustomerOut>(`/api/v1/workspaces/${workspaceId}/customers/${customerId}`),
    createCustomer: (workspaceId: string, body: { display_name: string; email?: string; phone?: string }) =>
      request<CustomerOut>(`/api/v1/workspaces/${workspaceId}/customers`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    listSites: (workspaceId: string, opts: { customer_id?: string; q?: string; limit?: number } = {}) => {
      const params = new URLSearchParams({ limit: String(opts.limit ?? 50) });
      if (opts.customer_id) params.set("customer_id", opts.customer_id);
      if (opts.q?.trim()) params.set("q", opts.q.trim());
      return request<{ items: SiteOut[] }>(`/api/v1/workspaces/${workspaceId}/sites?${params}`);
    },
    createSite: (
      workspaceId: string,
      body: { customer_id: string; name: string; address?: { line?: string } },
    ) =>
      request<SiteOut>(`/api/v1/workspaces/${workspaceId}/sites`, {
        method: "POST",
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
    startJob: (workspaceId: string, jobId: string) =>
      request<JobOut>(`/api/v1/workspaces/${workspaceId}/jobs/${jobId}/start`, { method: "POST" }),
    completeJob: (workspaceId: string, jobId: string) =>
      request<JobOut>(`/api/v1/workspaces/${workspaceId}/jobs/${jobId}/complete`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
