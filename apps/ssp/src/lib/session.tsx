import {
  ApiClientError,
  type ApiClient,
  type SessionResponse,
} from "@site-secure/api-client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createSspApi } from "./api";
import { hasFeature } from "./can";
import { hasPublicSupabaseConfig } from "./env";
import { getSupabase } from "./supabase";

type SessionContextValue = {
  loading: boolean;
  session: SessionResponse | null;
  error: string | null;
  errorCode: string | null;
  api: ApiClient;
  refresh: () => Promise<SessionResponse | null>;
  signIn: (email: string, password: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  signOut: () => Promise<void>;
  hasWorkspace: boolean;
  hasSsp: boolean;
  workspaceId: string | undefined;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function membershipHasSsp(session: SessionResponse | null): boolean {
  if (!session) return false;
  return hasFeature(session.memberships[0]?.features ?? [], "ssp");
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const hydrateGen = useRef(0);
  const api = useMemo(() => createSspApi(), []);

  const hydrate = useCallback(async (): Promise<SessionResponse | null> => {
    const gen = ++hydrateGen.current;
    const supabase = getSupabase();
    if (!supabase) {
      if (gen === hydrateGen.current) {
        setSession(null);
        setError(hasPublicSupabaseConfig() ? null : "NO_CONFIG");
        setErrorCode(hasPublicSupabaseConfig() ? null : "NO_CONFIG");
        setLoading(false);
      }
      return null;
    }
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) {
        if (gen === hydrateGen.current) {
          setSession(null);
          setError(null);
          setErrorCode(null);
        }
        return null;
      }
      const next = await api.getSession();
      if (gen === hydrateGen.current) {
        setSession(next);
        setError(null);
        setErrorCode(null);
      }
      return next;
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === "ACCOUNT_INACTIVE" || err.status === 401) {
          try {
            await getSupabase()?.auth.signOut({ scope: "local" });
          } catch {
            /* ignore */
          }
          if (gen === hydrateGen.current) {
            setSession(null);
            setError(err.message);
            setErrorCode(err.code);
          }
          return null;
        }
        if (gen === hydrateGen.current) {
          setError(err.message);
          setErrorCode(err.code);
          setSession(null);
        }
        return null;
      }
      if (gen === hydrateGen.current) {
        setError("שגיאה בטעינת הסשן");
        setErrorCode("UNKNOWN");
        setSession(null);
      }
      return null;
    } finally {
      if (gen === hydrateGen.current) setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void hydrate();
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void hydrate();
    });
    return () => sub.subscription.unsubscribe();
  }, [hydrate]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const supabase = getSupabase();
      if (!supabase) return { ok: false as const, message: "NO_CONFIG" };
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) return { ok: false as const, message: authError.message };
      const next = await hydrate();
      if (!next) return { ok: false as const, message: error || "SESSION_FAILED" };
      return { ok: true as const };
    },
    [error, hydrate],
  );

  const signOut = useCallback(async () => {
    hydrateGen.current += 1;
    setSession(null);
    setError(null);
    setErrorCode(null);
    await getSupabase()?.auth.signOut({ scope: "local" });
    setLoading(false);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      loading,
      session,
      error,
      errorCode,
      api,
      refresh: hydrate,
      signIn,
      signOut,
      hasWorkspace: Boolean(session?.has_workspace && session.memberships[0]?.workspace_id),
      hasSsp: membershipHasSsp(session),
      workspaceId: session?.memberships[0]?.workspace_id,
    }),
    [api, error, errorCode, hydrate, loading, session, signIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession requires SessionProvider");
  return ctx;
}
