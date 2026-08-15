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

export type QuoteOut = {
  id: string;
  workspace_id: string;
  number: string;
  status: string;
  customer_id: string | null;
  site_id: string | null;
  owner_user_id: string | null;
  currency?: string;
  vat_percent?: number | null;
  total_gross?: number | null;
  subtotal_net?: number | null;
  vat_amount?: number | null;
  valid_until?: string | null;
  customer_notes?: string | null;
  internal_notes?: string | null;
  updated_at?: string;
  created_at?: string;
  items?: QuoteItemOut[];
};

export type QuoteItemOut = {
  id: string;
  quote_id: string;
  description: string;
  qty: number;
  unit_price: number;
  discount?: number;
  line_net?: number;
  item_type?: string;
};

export type QuotePage = {
  items: QuoteOut[];
  next_cursor: string | null;
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

export type WorkspaceUsageMeter = {
  key: string;
  label_he: string;
  current: number;
  limit: number;
  unlimited: boolean;
  unit: string;
  at_limit: boolean;
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
    listQuotes: (workspaceId: string) =>
      request<QuotePage>(`/api/v1/workspaces/${workspaceId}/quotes?limit=50`),
    createQuote: (workspaceId: string, body: { customer_notes?: string; valid_until?: string } = {}) =>
      request<QuoteOut>(`/api/v1/workspaces/${workspaceId}/quotes`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    getQuote: (workspaceId: string, quoteId: string) =>
      request<QuoteOut>(`/api/v1/workspaces/${workspaceId}/quotes/${quoteId}`),
    addQuoteItem: (
      workspaceId: string,
      quoteId: string,
      body: { description: string; qty: number; unit_price: number; item_type?: string },
    ) =>
      request<QuoteOut>(`/api/v1/workspaces/${workspaceId}/quotes/${quoteId}/items`, {
        method: "POST",
        body: JSON.stringify({ item_type: "custom", ...body }),
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
