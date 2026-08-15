import { createApiClient, type ApiClient, type SessionResponse } from "@site-secure/api-client";
import { type User } from "@supabase/supabase-js";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { isHostedBrowser, isSpaApiUrl, requireProductionApiUrl } from "./public-api-url";
import { supabase } from "./supabase";

function apiClientConfig(): { baseUrl: string; sameOriginProxy: boolean } {
  const fromEnv = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").trim().replace(/\/$/, "");
  if (import.meta.env.DEV) {
    return { baseUrl: "", sameOriginProxy: true };
  }
  const hosted = isHostedBrowser();
  const url = requireProductionApiUrl(fromEnv, hosted);
  if (!url || isSpaApiUrl(url)) {
    return { baseUrl: "", sameOriginProxy: false };
  }
  return { baseUrl: url, sameOriginProxy: false };
}

const apiConfig = apiClientConfig();

type SessionState = {
  loading: boolean;
  user: User | null;
  session: SessionResponse | null;
  error: string | null;
  api: ApiClient;
  refresh: () => Promise<SessionResponse | null>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: apiConfig.baseUrl,
        sameOriginProxy: apiConfig.sameOriginProxy,
        getAccessToken: async () => {
          if (tokenRef.current) return tokenRef.current;
          const { data } = await supabase.auth.getSession();
          return data.session?.access_token ?? null;
        },
      }),
    [],
  );

  const hydrate = useCallback(
    async (nextUser: User | null): Promise<SessionResponse | null> => {
      setUser(nextUser);
      if (!nextUser) {
        tokenRef.current = null;
        setSession(null);
        setError(null);
        setLoading(false);
        return null;
      }
      try {
        const hydrated = await api.getSession();
        setSession(hydrated);
        setError(null);
        return hydrated;
      } catch (err) {
        setSession(null);
        setError(err instanceof Error ? err.message : "שגיאה");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  const refresh = useCallback(async (): Promise<SessionResponse | null> => {
    const { data } = await supabase.auth.getSession();
    tokenRef.current = data.session?.access_token ?? null;
    return hydrate(data.session?.user ?? null);
  }, [hydrate]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, authSession) => {
      tokenRef.current = authSession?.access_token ?? null;
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "SIGNED_OUT") {
        void hydrate(authSession?.user ?? null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [hydrate]);

  const value: SessionState = {
    loading,
    user,
    session,
    error,
    api,
    refresh,
    signOut: async () => {
      tokenRef.current = null;
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setError(null);
    },
  };

  return createElement(SessionContext.Provider, { value }, children);
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
