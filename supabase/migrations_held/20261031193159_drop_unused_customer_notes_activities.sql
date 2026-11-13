-- SITE SECURE: drop unused CRM note/activity tables.
-- Evidence: no API router, no web client, no live query — only 0010 schema + backup list.
-- Quote.customer_notes column is unrelated and stays.
--
-- LOCAL: applied after COUNT(*) = 0 on both tables.
-- CLOUD PRECONDITION (stage E): before applying in cloud, COUNT rows on
-- customer_notes and customer_activities and take a backup. Rollback SQL
-- restores TABLE STRUCTURE only — it does not restore dropped row data.

DROP TABLE IF EXISTS public.customer_activities;
DROP TABLE IF EXISTS public.customer_notes;
DROP TYPE IF EXISTS public.activity_type;
