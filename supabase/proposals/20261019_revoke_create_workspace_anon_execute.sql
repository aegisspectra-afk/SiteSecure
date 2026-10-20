-- PROPOSAL ONLY — do not apply without separate approval.
-- Staging verification found anon EXECUTE on public.create_workspace(text, text)
-- while repo migrations only REVOKE FROM PUBLIC + GRANT TO authenticated.
--
-- Likely source: Supabase platform default privileges on functions (same pattern
-- documented for system_design_apply_owned / auth helpers). Not introduced by
-- repo GRANT statements. CREATE OR REPLACE preserves existing ACLs.
--
-- Impact: anon JWT can invoke the RPC; function still raises UNAUTHENTICATED
-- when auth.uid() is null. Defense in depth prefers no EXECUTE for anon.
--
-- Dependencies: none known for anon callers. API and web use authenticated.
-- service_role EXECUTE (also wider than repo) is out of scope for this proposal.

REVOKE EXECUTE ON FUNCTION public.create_workspace(text, text) FROM anon;

-- Do not REVOKE authenticated.
-- Do not ALTER OWNER.
-- Do not GRANT additional roles.
