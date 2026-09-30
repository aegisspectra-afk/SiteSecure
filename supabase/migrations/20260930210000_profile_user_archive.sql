-- ADMIN-USER-ARCHIVE-1: reversible platform user soft-archive (NOT cold archive).
-- Source of truth: profiles.archived_at IS NULL ⇒ active; NOT NULL ⇒ archived.
-- Auth identity, memberships, and history are preserved.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archive_reason text;

COMMENT ON COLUMN public.profiles.archived_at IS
  'Platform soft-archive timestamp. NULL = active; set = cannot use SITE SECURE until restored.';
COMMENT ON COLUMN public.profiles.archived_by IS
  'Platform admin who archived the user (profiles.id).';
COMMENT ON COLUMN public.profiles.archive_reason IS
  'Optional operator note for soft-archive (not a cold-archive batch).';

CREATE INDEX IF NOT EXISTS profiles_archived_at_idx
  ON public.profiles (archived_at)
  WHERE archived_at IS NOT NULL;
