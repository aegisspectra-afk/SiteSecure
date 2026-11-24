import { isHostedBrowser, isSpaApiUrl, requireProductionApiUrl } from "./public-api-url";

function publicApiBase(): string {
  const fromEnv = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").trim().replace(/\/$/, "");
  if (import.meta.env.DEV) return "";
  const hosted = isHostedBrowser();
  const url = requireProductionApiUrl(fromEnv, hosted);
  if (!url || isSpaApiUrl(url)) return "";
  return url;
}

async function publicPost<T>(path: string, body: unknown): Promise<T> {
  const base = publicApiBase();
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(data.error?.message ?? "הבקשה נכשלה");
  }
  return data;
}

export type BetaSignupInput = {
  full_name: string;
  phone: string;
  technician_count: string;
  business_name?: string;
  trade_focus?: string;
  source?: string;
};

export function submitBetaSignup(body: BetaSignupInput) {
  return publicPost<{ ok: boolean; id?: string }>("/api/v1/public/beta-signups", body);
}

export type PublicStorageInput = {
  camera_count: number;
  resolution_mp: number;
  retention_days: number;
  recording_mode: "continuous" | "scheduled" | "motion";
  recording_hours_per_day?: number;
  motion_duty_cycle?: number;
  codec?: string;
};

export type PublicStorageResult = {
  storage: { status?: string; required_tb?: number; bitrate_mbps?: number };
  recorder: { status?: string; channels?: number | null };
  hdd: { status?: string; recommended_tb_per_drive?: number; drive_count?: number; total_capacity_tb?: number };
  input: PublicStorageInput;
};

export function calculatePublicCctvStorage(body: PublicStorageInput) {
  return publicPost<PublicStorageResult>("/api/v1/public/tools/cctv-storage/calculate", body);
}