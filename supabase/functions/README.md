# SITE SECURE V2 — Edge Functions

Business logic lives in FastAPI (`apps/api`).

Add an Edge Function only when the edge is the right place (Auth hooks, provider webhooks that must terminate at Supabase). Document the reason in the function README.
