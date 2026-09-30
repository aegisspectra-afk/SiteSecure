import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getPublicMessages } from "../../i18n/public-messages";
import type { PublicLocale, PublicMessages } from "../../i18n/public";
import {
  DEFAULT_PUBLIC_LOCALE,
  publicDir,
  readStoredPublicLocale,
  writeStoredPublicLocale,
} from "../../lib/public-locale";

type PublicLocaleContextValue = {
  locale: PublicLocale;
  dir: "rtl" | "ltr";
  t: PublicMessages;
  setLocale: (locale: PublicLocale) => void;
};

const PublicLocaleContext = createContext<PublicLocaleContextValue | null>(null);

export function PublicLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<PublicLocale>(() =>
    typeof window === "undefined" ? DEFAULT_PUBLIC_LOCALE : readStoredPublicLocale(),
  );

  const setLocale = useCallback((next: PublicLocale) => {
    setLocaleState(next);
    writeStoredPublicLocale(next);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    // Scope marketing dir on the document lang attribute for a11y; page shell owns dir.
    root.lang = locale === "he" ? "he" : "en";
  }, [locale]);

  const value = useMemo<PublicLocaleContextValue>(
    () => ({
      locale,
      dir: publicDir(locale),
      t: getPublicMessages(locale),
      setLocale,
    }),
    [locale, setLocale],
  );

  return <PublicLocaleContext.Provider value={value}>{children}</PublicLocaleContext.Provider>;
}

export function usePublicLocale(): PublicLocaleContextValue {
  const ctx = useContext(PublicLocaleContext);
  if (!ctx) {
    throw new Error("usePublicLocale requires PublicLocaleProvider");
  }
  return ctx;
}

/** Copy helper — same as usePublicLocale().t */
export function usePublicCopy(): PublicMessages {
  return usePublicLocale().t;
}
