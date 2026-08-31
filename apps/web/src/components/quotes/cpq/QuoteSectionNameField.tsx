import { Input } from "@site-secure/ui";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { he } from "../../../i18n/he";

const PERSIST_DEBOUNCE_MS = 450;

export const QuoteSectionNameField = memo(function QuoteSectionNameField({
  sectionId,
  name,
  canEdit,
  onPersist,
}: {
  sectionId: string;
  name: string;
  canEdit: boolean;
  onPersist: (sectionId: string, name: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(name);
  const [persistError, setPersistError] = useState<string | null>(null);
  const focused = useRef(false);
  const dirty = useRef(false);
  const draftRef = useRef(draft);
  const persistTimer = useRef<number | null>(null);
  const persistInFlight = useRef(false);
  const persistQueued = useRef(false);
  const persistGen = useRef(0);
  const mountedSectionId = useRef(sectionId);

  draftRef.current = draft;

  useEffect(() => {
    if (sectionId !== mountedSectionId.current) {
      mountedSectionId.current = sectionId;
      dirty.current = false;
      focused.current = false;
      setDraft(name);
      setPersistError(null);
      return;
    }
    if (focused.current || dirty.current) return;
    setDraft(name);
  }, [sectionId, name]);

  const flushPersist = useCallback(async () => {
    if (persistTimer.current != null) {
      window.clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    if (!dirty.current) return;

    const nextName = draftRef.current.trim();
    if (nextName === name.trim()) {
      dirty.current = false;
      return;
    }

    if (persistInFlight.current) {
      persistQueued.current = true;
      return;
    }

    const gen = ++persistGen.current;
    const snapshot = draftRef.current;
    persistInFlight.current = true;
    setPersistError(null);
    try {
      await onPersist(sectionId, nextName);
      if (gen !== persistGen.current) return;
      if (draftRef.current === snapshot) {
        dirty.current = false;
      }
    } catch (err) {
      if (gen === persistGen.current) {
        setPersistError(err instanceof Error ? err.message : he.quotesError);
      }
    } finally {
      persistInFlight.current = false;
      if (persistQueued.current) {
        persistQueued.current = false;
        void flushPersist();
      }
    }
  }, [name, onPersist, sectionId]);

  const schedulePersist = useCallback(() => {
    if (persistTimer.current != null) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      persistTimer.current = null;
      void flushPersist();
    }, PERSIST_DEBOUNCE_MS);
  }, [flushPersist]);

  useEffect(() => {
    return () => {
      if (persistTimer.current != null) window.clearTimeout(persistTimer.current);
    };
  }, []);

  if (!canEdit) {
    return <h3 className="text-base font-semibold">{name || he.cpqSectionUntitled}</h3>;
  }

  return (
    <div className="min-w-0 flex-1">
      <Input
        id={`section-name-${sectionId}`}
        label={he.cpqAddSection}
        className="max-w-sm font-medium"
        value={draft}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
          void flushPersist();
        }}
        onChange={(e) => {
          dirty.current = true;
          setDraft(e.target.value);
          schedulePersist();
        }}
      />
      {persistError ? (
        <p className="mt-1 text-xs text-danger" role="alert">
          {persistError}
        </p>
      ) : null}
    </div>
  );
});
