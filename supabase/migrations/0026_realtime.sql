-- Realtime only where it creates operational value.

ALTER TABLE public.jobs REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.quotes REPLICA IDENTITY FULL;
ALTER TABLE public.service_calls REPLICA IDENTITY FULL;
ALTER TABLE public.assignments REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_calls;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.assignments;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END;
$$;
