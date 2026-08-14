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

export type DashboardResponse = {
  home_variant: "ops" | "sales" | "today" | "observe";
  generated_at: string;
  attention: AttentionGroup[];
  today: { label_he: string; items: DashboardItem[] };
  activity: { entity_type: string; entity_id: string; title_he: string; occurred_at: string }[];
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
}) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await opts.getAccessToken();
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${opts.baseUrl}${path}`, { ...init, headers });
    if (res.status === 204) return undefined as T;
    const json = (await res.json()) as T | ApiErrorBody;
    if (!res.ok) {
      const err = json as ApiErrorBody;
      throw new ApiClientError(
        res.status,
        err.error?.code ?? "BUSINESS_RULE",
        err.error?.message ?? "שגיאה",
        err.error?.details ?? {},
      );
    }
    return json as T;
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
    getDashboard: (workspaceId: string) =>
      request<DashboardResponse>(`/api/v1/workspaces/${workspaceId}/dashboard`),
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
