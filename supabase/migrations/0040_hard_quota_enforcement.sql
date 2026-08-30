-- Hard commercial quotas: customers, quotes, storage.
-- limit_value = 0 means UNLIMITED (never "zero allowed").
-- Soft-deleted customers/quotes (deleted_at IS NOT NULL) do not consume quota.
-- Quote revise is UPDATE-only (no new row) and does not consume quota.
-- Storage: pending uploads hold reserved_bytes until complete or 24h expiry.

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS reserved_bytes bigint NOT NULL DEFAULT 0
    CHECK (reserved_bytes >= 0);

-- Storage quotas are multi-GB; integer overflows above ~2GB.
DROP TRIGGER IF EXISTS documents_enforce_storage_quota ON public.documents;
ALTER TABLE public.documents
  ALTER COLUMN byte_size TYPE bigint USING byte_size::bigint;
ALTER TABLE public.documents
  ALTER COLUMN reserved_bytes TYPE bigint USING reserved_bytes::bigint;

CREATE OR REPLACE FUNCTION public._workspace_plan_limit(
  p_workspace_id uuid,
  p_limit_key text
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_limit integer;
BEGIN
  SELECT s.plan_key INTO v_plan
  FROM public.subscriptions s
  WHERE s.workspace_id = p_workspace_id;

  IF v_plan IS NULL THEN
    v_plan := 'solo';
  END IF;

  SELECT pl.limit_value INTO v_limit
  FROM public.plan_limits pl
  WHERE pl.plan_key = v_plan AND pl.limit_key = p_limit_key;

  RETURN COALESCE(v_limit, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public._workspace_storage_used_bytes(p_workspace_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN d.byte_size IS NOT NULL THEN d.byte_size::bigint
      WHEN d.created_at > now() - interval '24 hours' THEN d.reserved_bytes::bigint
      ELSE 0::bigint
    END
  ), 0::bigint)
  FROM public.documents d
  WHERE d.workspace_id = p_workspace_id;
$$;

CREATE OR REPLACE FUNCTION public.enforce_customer_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_current integer;
BEGIN
  -- Serialize quota decisions per workspace via subscription row.
  IF EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.workspace_id = NEW.workspace_id) THEN
    PERFORM 1 FROM public.subscriptions s WHERE s.workspace_id = NEW.workspace_id FOR UPDATE;
  ELSE
    PERFORM 1 FROM public.workspaces w WHERE w.id = NEW.workspace_id FOR UPDATE;
  END IF;

  v_limit := public._workspace_plan_limit(NEW.workspace_id, 'quota_clients');
  IF v_limit > 0 THEN
    SELECT count(*)::integer INTO v_current
    FROM public.customers c
    WHERE c.workspace_id = NEW.workspace_id
      AND c.deleted_at IS NULL;

    IF v_current >= v_limit THEN
      RAISE EXCEPTION 'PLAN_LIMIT_REACHED:customers:%:%', v_limit, v_current
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customers_enforce_quota ON public.customers;
CREATE TRIGGER customers_enforce_quota
  BEFORE INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_customer_quota();

CREATE OR REPLACE FUNCTION public.enforce_quote_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_current integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.workspace_id = NEW.workspace_id) THEN
    PERFORM 1 FROM public.subscriptions s WHERE s.workspace_id = NEW.workspace_id FOR UPDATE;
  ELSE
    PERFORM 1 FROM public.workspaces w WHERE w.id = NEW.workspace_id FOR UPDATE;
  END IF;

  v_limit := public._workspace_plan_limit(NEW.workspace_id, 'quota_quotes');
  IF v_limit > 0 THEN
    SELECT count(*)::integer INTO v_current
    FROM public.quotes q
    WHERE q.workspace_id = NEW.workspace_id
      AND q.deleted_at IS NULL;

    IF v_current >= v_limit THEN
      RAISE EXCEPTION 'PLAN_LIMIT_REACHED:quotes:%:%', v_limit, v_current
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotes_enforce_quota ON public.quotes;
CREATE TRIGGER quotes_enforce_quota
  BEFORE INSERT ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_quote_quota();

CREATE OR REPLACE FUNCTION public.enforce_document_storage_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit_gb integer;
  v_limit_bytes bigint;
  v_used bigint;
  v_add bigint := 0;
  v_old bigint := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.workspace_id = NEW.workspace_id) THEN
    PERFORM 1 FROM public.subscriptions s WHERE s.workspace_id = NEW.workspace_id FOR UPDATE;
  ELSE
    PERFORM 1 FROM public.workspaces w WHERE w.id = NEW.workspace_id FOR UPDATE;
  END IF;

  v_limit_gb := public._workspace_plan_limit(NEW.workspace_id, 'storage_gb');
  IF v_limit_gb <= 0 THEN
    RETURN NEW;
  END IF;
  v_limit_bytes := v_limit_gb::bigint * (1024::bigint ^ 3);

  IF TG_OP = 'INSERT' THEN
    IF NEW.byte_size IS NOT NULL THEN
      v_add := NEW.byte_size::bigint;
    ELSE
      v_add := NEW.reserved_bytes::bigint;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.byte_size IS NOT NULL THEN
      v_old := OLD.byte_size::bigint;
    ELSIF OLD.created_at > now() - interval '24 hours' THEN
      v_old := OLD.reserved_bytes::bigint;
    END IF;
    IF NEW.byte_size IS NOT NULL THEN
      v_add := NEW.byte_size::bigint;
    ELSIF NEW.created_at > now() - interval '24 hours' THEN
      v_add := NEW.reserved_bytes::bigint;
    END IF;
    -- Only charge the delta when growing usage.
    IF v_add <= v_old THEN
      RETURN NEW;
    END IF;
    v_add := v_add - v_old;
  END IF;

  IF v_add <= 0 THEN
    RETURN NEW;
  END IF;

  v_used := public._workspace_storage_used_bytes(NEW.workspace_id);
  -- On UPDATE the row still contributes v_old; subtract so we do not double-count.
  IF TG_OP = 'UPDATE' THEN
    v_used := v_used - v_old;
  END IF;

  IF v_used + v_add > v_limit_bytes THEN
    RAISE EXCEPTION 'PLAN_LIMIT_REACHED:storage:%:%', v_limit_bytes, v_used
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS documents_enforce_storage_quota ON public.documents;
CREATE TRIGGER documents_enforce_storage_quota
  BEFORE INSERT OR UPDATE OF byte_size, reserved_bytes ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_document_storage_quota();
