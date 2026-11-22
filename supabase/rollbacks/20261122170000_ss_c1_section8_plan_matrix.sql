-- Rollback C1 §8 matrix seed (does not restore prior numeric limits).
DELETE FROM public.plan_capabilities
WHERE plan_key IN ('free', 'pro', 'business', 'enterprise')
  AND capability_key IN (
    'branding.custom_handover', 'comms.whatsapp', 'quotes.sales_tracking',
    'field.technicians', 'field.dispatch', 'jobs.checklist',
    'sites.dossier', 'service.reminders', 'quotes.profitability'
  );
-- Keep quotes.alternatives from prior C1 migration.
