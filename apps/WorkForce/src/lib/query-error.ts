import { ApiClientError } from "@site-secure/api-client";
import { he } from "../i18n/he";

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (
    error instanceof ApiClientError &&
    (error.status === 401 || error.status === 403 || error.status === 404 || error.status === 503)
  ) {
    return false;
  }
  return failureCount < 1;
}

export function queryErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  if ("code" in error && typeof error.code === "string" && error.code.trim()) return error.code;
  return null;
}

export function isWorkforceSchemaUnavailable(error: unknown): boolean {
  if (queryErrorCode(error) === "WORKFORCE_SCHEMA_UNAVAILABLE") return true;
  return error instanceof ApiClientError && error.status === 503 && error.code === "WORKFORCE_SCHEMA_UNAVAILABLE";
}

export function queryErrorDescription(error: unknown): string {
  if (!error || typeof error !== "object") return he.loadErrorHint;
  const message = "message" in error ? String(error.message ?? "").trim() : "";
  if (error instanceof ApiClientError && message) return message;
  if ("status" in error && "code" in error && message) return message;
  return he.loadErrorHint;
}
