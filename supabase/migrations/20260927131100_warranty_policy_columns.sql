ALTER TABLE public.warranties
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS policy jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.warranties
  ALTER COLUMN site_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.warranties_set_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    NEW.number := 'WAR-' || lpad(public.next_code(NEW.workspace_id, 'warranty')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;
