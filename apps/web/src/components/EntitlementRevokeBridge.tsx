import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import {
  isFeatureNotIncludedError,
  shouldReturnToPlatformHome,
} from "../lib/entitlement-revoke";
import { setFeatureNotIncludedHandler } from "../lib/query-client";
import { useSession } from "../lib/session";

const DEBOUNCE_MS = 2500;

/**
 * Registers a global React Query error handler for FEATURE_NOT_INCLUDED:
 * refresh session + platform-home; navigate to /platform only if the current product is gone.
 */
export function EntitlementRevokeBridge() {
  const { refresh } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pathnameRef = useRef(pathname);
  const lastHandledAt = useRef(0);
  const inFlight = useRef(false);

  pathnameRef.current = pathname;

  useEffect(() => {
    setFeatureNotIncludedHandler(async (error) => {
      if (!isFeatureNotIncludedError(error)) return;
      const now = Date.now();
      if (inFlight.current || now - lastHandledAt.current < DEBOUNCE_MS) return;
      inFlight.current = true;
      lastHandledAt.current = now;
      try {
        const path = pathnameRef.current;
        const next = await refresh();
        await queryClient.invalidateQueries({ queryKey: ["platform-home"] });
        const features = next?.memberships[0]?.features;
        if (shouldReturnToPlatformHome(path, features)) {
          await navigate({ to: "/platform" });
        }
      } finally {
        inFlight.current = false;
      }
    });
    return () => setFeatureNotIncludedHandler(null);
  }, [navigate, queryClient, refresh]);

  return null;
}
