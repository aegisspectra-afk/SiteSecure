-- Rollback 20261031121000_quote_public_access_required_ttl.sql
-- LOCAL ONLY. Previous NULL expires_at values cannot be restored.
-- This only removes the migration marker. Application mint still writes TTL.

COMMENT ON COLUMN public.quote_public_access.expires_at IS NULL;

DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20261031121000';
