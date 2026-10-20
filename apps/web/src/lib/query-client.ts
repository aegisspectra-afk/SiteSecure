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

/** Shared client so session/workspace switches can clear caches safely. */
export const queryClient = new QueryClient({
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
