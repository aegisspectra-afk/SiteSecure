-- Rollback 20261031120000_warranty_public_token_hash.sql
-- LOCAL ONLY. IRREVERSIBLE for plaintext: hashed tokens cannot be recovered.
-- This only removes the insert trigger/function so new rows are not re-hashed.
-- Existing public_token values stay SHA-256 hex.

DROP TRIGGER IF EXISTS warranties_set_public_token_hash ON public.warranties;
DROP FUNCTION IF EXISTS public.warranties_set_public_token_hash();

DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20261031120000';
