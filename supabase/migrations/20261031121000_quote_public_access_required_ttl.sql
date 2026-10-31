-- SITE SECURE: every public quote link must have expires_at.
-- sent/viewed rows without TTL get now()+30 days so live links are not cut off.
-- Local apply only.

UPDATE public.quote_public_access AS a
SET expires_at = now() + interval '30 days'
FROM public.quotes AS q
WHERE a.quote_id = q.id
  AND a.expires_at IS NULL
  AND q.status IN ('sent', 'viewed');

COMMENT ON COLUMN public.quote_public_access.expires_at IS
  'Required at mint. Historical sent/viewed nulls were backfilled to now()+30d.';
