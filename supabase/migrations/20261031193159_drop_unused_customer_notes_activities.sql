-- SITE SECURE: drop unused CRM note/activity tables.
-- Evidence: no API router, no web client, no live query — only 0010 schema + backup list.
-- Quote.customer_notes column is unrelated and stays.

DROP TABLE IF EXISTS public.customer_activities;
DROP TABLE IF EXISTS public.customer_notes;
DROP TYPE IF EXISTS public.activity_type;
