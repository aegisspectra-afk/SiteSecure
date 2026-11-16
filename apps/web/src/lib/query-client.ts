import { ApiClientError } from "@site-secure/api-client";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { isFeatureNotIncludedError } from "./entitlement-revoke";

type FeatureNotIncludedHandler = (error: unknown) => void | Promise<void>;

let featureNotIncludedHandler: FeatureNotIncludedHandler | null = null;

/** Registered by EntitlementRevokeBridge (has access to session + router). */
export function setFeatureNotIncludedHandler(handler: FeatureNotIncludedHandler | null): void {
  featureNotIncludedHandler = handler;
}

function notifyFeatureNotIncluded(error: unknown): void {
  if (!isFeatureNotIncludedError(error)) return;
  void featureNotIncludedHandler?.(error);
}

/**
 * DEMO-3.5: a client error is the answer, not a glitch. "לא נמצא" (404), no permission (403),
 * validation (400/422) and the like show at once instead of after ~7s of retries.
 * Network failures and 5xx keep up to 3 retries; 408 / 429 are retried too.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiClientError && error.status >= 400 && error.status < 500) {
    if (error.status !== 408 && error.status !== 429) return false;
  }
  return failureCount < 3;
}

/** Shared client so session/workspace switches can clear caches safely. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: shouldRetryQuery },
  },
  queryCache: new QueryCache({
    onError: (error) => notifyFeatureNotIncluded(error),
  }),
  mutationCache: new MutationCache({
    onError: (error) => notifyFeatureNotIncluded(error),
  }),
});

/**
 * Cancel in-flight fetches then drop all cached queries.
 * Used on workspace switch / sign-out so late responses cannot repopulate tenant data.
 */
export async function clearWorkspaceScopedCaches(): Promise<void> {
  await queryClient.cancelQueries();
  queryClient.clear();
}
