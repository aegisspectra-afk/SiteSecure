-- Q4: quote archive columns + block hard/soft delete of non-draft quotes.
BEGIN;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS quotes_workspace_archived_at_idx
  ON public.quotes (workspace_id, archived_at)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.quotes.archived_at IS 'Q4: soft-archive timestamp; excluded from main list and dashboard';
COMMENT ON COLUMN public.quotes.archived_by IS 'Q4: profile id that archived the quote';

-- Money-lockdown left authenticated with column-level SELECT only; new cols need SELECT
-- so list/dashboard filters (archived_at=is.null) and RETURNING work. Writes stay service-role.
GRANT SELECT (archived_at, archived_by) ON public.quotes TO authenticated;

-- Block DELETE and soft-delete (deleted_at stamp) unless status is draft.
CREATE OR REPLACE FUNCTION public.quotes_enforce_delete_policy()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IS DISTINCT FROM 'draft'::public.quote_status THEN
      RAISE EXCEPTION 'quotes_delete_blocked: only draft quotes may be deleted (status=%)', OLD.status
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  -- Soft-delete path used by the API (UPDATE deleted_at).
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    IF OLD.status IS DISTINCT FROM 'draft'::public.quote_status THEN
      RAISE EXCEPTION 'quotes_delete_blocked: only draft quotes may be deleted (status=%)', OLD.status
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotes_enforce_delete_policy ON public.quotes;
CREATE TRIGGER quotes_enforce_delete_policy
  BEFORE DELETE OR UPDATE OF deleted_at ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.quotes_enforce_delete_policy();

COMMIT;
