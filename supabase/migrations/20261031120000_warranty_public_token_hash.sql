-- SITE SECURE: store warranty public_token as SHA-256 only.
-- Local apply only. Do not run on cloud without an explicit release.

ALTER TABLE public.warranties
  ADD COLUMN IF NOT EXISTS public_token_hash text;

UPDATE public.warranties
SET public_token_hash = encode(
  extensions.digest(convert_to(public_token, 'UTF8'), 'sha256'),
  'hex'
)
WHERE public_token_hash IS NULL
  AND public_token IS NOT NULL;

ALTER TABLE public.warranties DROP CONSTRAINT IF EXISTS warranties_public_token_key;
ALTER TABLE public.warranties ALTER COLUMN public_token DROP DEFAULT;
ALTER TABLE public.warranties DROP COLUMN public_token;
ALTER TABLE public.warranties RENAME COLUMN public_token_hash TO public_token;
ALTER TABLE public.warranties ALTER COLUMN public_token SET NOT NULL;
ALTER TABLE public.warranties ADD CONSTRAINT warranties_public_token_key UNIQUE (public_token);

CREATE OR REPLACE FUNCTION public.warranties_set_public_token_hash()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  NEW.public_token := encode(
    digest(convert_to(encode(gen_random_bytes(32), 'hex'), 'UTF8'), 'sha256'),
    'hex'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS warranties_set_public_token_hash ON public.warranties;
CREATE TRIGGER warranties_set_public_token_hash
  BEFORE INSERT ON public.warranties
  FOR EACH ROW
  EXECUTE FUNCTION public.warranties_set_public_token_hash();

COMMENT ON COLUMN public.warranties.public_token IS
  'SHA-256 hex of a one-time random value. Plaintext is never stored or returned.';
