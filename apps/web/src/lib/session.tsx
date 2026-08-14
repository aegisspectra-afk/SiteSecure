import { createApiClient, type ApiClient, type SessionResponse } from "@site-secure/api-client";
import { type User } from "@supabase/supabase-js";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isHostedBrowser, requireProductionApiUrl } from "./public-api-url";
import { supabase } from "./supabase";

function apiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
  if (import.meta.env.PROD) return requireProductionApiUrl(fromEnv, isHostedBrowser());
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://localhost:8000";
}

const apiBase = apiBaseUrl();

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

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: apiBase.replace(/\/$/, ""),
        getAccessToken: async () => {
          const { data } = await supabase.auth.getSession();
          return data.session?.access_token ?? null;
        },
      }),
    [],
  );

  const refresh = useCallback(async (): Promise<SessionResponse | null> => {
    const { data } = await supabase.auth.getSession();
    const nextUser = data.session?.user ?? null;
    setUser(nextUser);
    if (!nextUser) {
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
  }, [api]);

  useEffect(() => {
    void refresh();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION") return;
      void refresh();
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  const value: SessionState = {
    loading,
    user,
    session,
    error,
    api,
    refresh,
    signOut: async () => {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
    },
  };

  return createElement(SessionContext.Provider, { value }, children);
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
