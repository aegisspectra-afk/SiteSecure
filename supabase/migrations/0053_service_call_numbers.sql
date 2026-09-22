-- Human-readable service call numbers (SR-00001) so Service Call ↔ Field Job is visible.

ALTER TABLE public.service_calls
  ADD COLUMN IF NOT EXISTS number text;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id, workspace_id
    FROM public.service_calls
    WHERE number IS NULL OR number = ''
    ORDER BY created_at ASC
  LOOP
    UPDATE public.service_calls
    SET number = 'SR-' || lpad(public.next_code(r.workspace_id, 'service_call')::text, 5, '0')
    WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.service_calls
  ALTER COLUMN number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS service_calls_workspace_number_uidx
  ON public.service_calls (workspace_id, number);

CREATE OR REPLACE FUNCTION public.service_calls_set_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    NEW.number := 'SR-' || lpad(public.next_code(NEW.workspace_id, 'service_call')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS service_calls_set_number ON public.service_calls;
CREATE TRIGGER service_calls_set_number
  BEFORE INSERT ON public.service_calls
  FOR EACH ROW EXECUTE FUNCTION public.service_calls_set_number();
