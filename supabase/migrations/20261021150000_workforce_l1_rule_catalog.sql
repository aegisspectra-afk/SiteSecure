-- Workforce L1: versioned labor-rule catalog, permits, employment profiles.
-- Local apply only. Does not enforce legal blocks on shift save (that is L2).
-- Does not enable G1, import employees, or touch CRM/SSP/Fleet site tables.
-- Platform catalog rows have workspace_id IS NULL. Tenant overlays set workspace_id.

-- ── Packs (platform reference) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workforce_rule_packs (
  pack_code text PRIMARY KEY,
  name_he text NOT NULL,
  description_he text,
  pack_kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workforce_rule_packs_kind_chk CHECK (
    pack_kind IN (
      'legal',
      'permit',
      'collective_agreement',
      'employment_contract',
      'employer_policy',
      'operational'
    )
  )
);

COMMENT ON TABLE public.workforce_rule_packs IS
  'Named rule packs. Platform reference data. Enabling a pack in a workspace does not enforce shift blocks in L1.';

-- ── Versioned rules (platform catalog + tenant overlays) ────────────────────
CREATE TABLE IF NOT EXISTS public.workforce_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces (id) ON DELETE CASCADE,
  pack_code text NOT NULL REFERENCES public.workforce_rule_packs (pack_code) ON DELETE RESTRICT,
  rule_code text NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  name_he text NOT NULL,
  description_he text,
  rule_type text NOT NULL,
  verification_status text NOT NULL,
  severity text NOT NULL,
  source_kind text NOT NULL,
  source_citation text NOT NULL,
  source_section text,
  source_url text,
  reviewed_on date NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  superseded_by uuid REFERENCES public.workforce_rules (id) ON DELETE SET NULL,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  cannot_be_relaxed boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workforce_rules_type_chk CHECK (
    rule_type IN (
      'legal',
      'permit',
      'collective_agreement',
      'employment_contract',
      'employer_policy',
      'operational'
    )
  ),
  CONSTRAINT workforce_rules_status_chk CHECK (
    verification_status IN ('draft', 'verified', 'expired', 'superseded')
  ),
  CONSTRAINT workforce_rules_severity_chk CHECK (
    severity IN ('blocking', 'warning', 'informational')
  ),
  CONSTRAINT workforce_rules_source_kind_chk CHECK (
    source_kind IN ('statute', 'yalkut', 'extension_order', 'contract', 'policy', 'research_note')
  ),
  CONSTRAINT workforce_rules_range_chk CHECK (
    effective_to IS NULL OR effective_to > effective_from
  ),
  CONSTRAINT workforce_rules_code_chk CHECK (rule_code ~ '^[A-Z][A-Z0-9_]{2,80}$'),
  CONSTRAINT workforce_rules_relax_chk CHECK (
    cannot_be_relaxed
    OR NOT (
      rule_type IN ('legal', 'permit')
      AND verification_status = 'verified'
    )
  ),
  CONSTRAINT workforce_rules_tenant_legal_chk CHECK (
    workspace_id IS NULL
    OR rule_type NOT IN ('legal', 'permit')
    OR verification_status <> 'verified'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS workforce_rules_platform_version_uidx
  ON public.workforce_rules (rule_code, version)
  WHERE workspace_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS workforce_rules_tenant_version_uidx
  ON public.workforce_rules (workspace_id, rule_code, version)
  WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS workforce_rules_workspace_code_idx
  ON public.workforce_rules (workspace_id, rule_code, effective_from DESC);

CREATE INDEX IF NOT EXISTS workforce_rules_pack_idx
  ON public.workforce_rules (pack_code, rule_code);

COMMENT ON TABLE public.workforce_rules IS
  'Versioned scheduling rules. NULL workspace_id = platform catalog. Never rewrite a version in place; close it and insert a new version. Draft/expired/superseded are not active legal blocks.';

-- ── Workspace pack enablement (library, not enforcement) ────────────────────
CREATE TABLE IF NOT EXISTS public.workforce_workspace_packs (
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  pack_code text NOT NULL REFERENCES public.workforce_rule_packs (pack_code) ON DELETE RESTRICT,
  is_enabled boolean NOT NULL DEFAULT false,
  notes text,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, pack_code)
);

COMMENT ON TABLE public.workforce_workspace_packs IS
  'Which packs a workspace has attached. is_enabled does not turn on L2 assignment blocking.';

-- ── Legal instruments (tenant permits / agreements) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.workforce_legal_instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  instrument_kind text NOT NULL,
  code text NOT NULL,
  title_he text NOT NULL,
  citation text NOT NULL,
  source_url text,
  verification_status text NOT NULL DEFAULT 'draft',
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workforce_instruments_kind_chk CHECK (
    instrument_kind IN ('permit', 'extension_order', 'collective_agreement', 'employment_contract')
  ),
  CONSTRAINT workforce_instruments_status_chk CHECK (
    verification_status IN ('draft', 'verified', 'expired', 'superseded')
  ),
  CONSTRAINT workforce_instruments_range_chk CHECK (
    effective_to IS NULL OR effective_to > effective_from
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS workforce_instruments_code_version_uidx
  ON public.workforce_legal_instruments (workspace_id, code, effective_from);

CREATE INDEX IF NOT EXISTS workforce_instruments_workspace_idx
  ON public.workforce_legal_instruments (workspace_id, effective_from DESC);

COMMENT ON TABLE public.workforce_legal_instruments IS
  'Workspace-attached permits and agreements. Expire by setting effective_to. Do not delete history.';

-- ── Employment profile (operational facts, not religion) ────────────────────
CREATE TABLE IF NOT EXISTS public.workforce_employment_profiles (
  employee_id uuid PRIMARY KEY REFERENCES public.workforce_employees (id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  rest_weekday smallint,
  hours_law_covered boolean NOT NULL DEFAULT true,
  sector_pack_code text REFERENCES public.workforce_rule_packs (pack_code) ON DELETE SET NULL,
  weekly_pattern text,
  shortened_weekday smallint,
  is_minor boolean NOT NULL DEFAULT false,
  night_work_restricted boolean NOT NULL DEFAULT false,
  notes text,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workforce_profiles_rest_chk CHECK (rest_weekday IS NULL OR rest_weekday BETWEEN 0 AND 6),
  CONSTRAINT workforce_profiles_short_chk CHECK (shortened_weekday IS NULL OR shortened_weekday BETWEEN 0 AND 6),
  CONSTRAINT workforce_profiles_pattern_chk CHECK (
    weekly_pattern IS NULL OR weekly_pattern IN ('five_day', 'six_day')
  )
);

CREATE INDEX IF NOT EXISTS workforce_profiles_workspace_idx
  ON public.workforce_employment_profiles (workspace_id);

COMMENT ON TABLE public.workforce_employment_profiles IS
  'Per-employee scheduling facts. rest_weekday is 0=Sunday … 6=Saturday. Do not store religion.';
COMMENT ON COLUMN public.workforce_employment_profiles.hours_law_covered IS
  'Default true. Set false only for a documented Hours Law s.30 exclusion; disputes go to the Labor Court.';

-- ── Active legal-block helper (L2 will call this; L1 does not wire it to shifts)
CREATE OR REPLACE FUNCTION public.workforce_rule_is_active_legal_block(
  p_rule_type text,
  p_verification_status text,
  p_severity text,
  p_effective_from timestamptz,
  p_effective_to timestamptz,
  p_at timestamptz
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    p_verification_status = 'verified'
    AND p_rule_type IN ('legal', 'permit')
    AND p_severity = 'blocking'
    AND p_effective_from <= p_at
    AND (p_effective_to IS NULL OR p_effective_to > p_at);
$$;

COMMENT ON FUNCTION public.workforce_rule_is_active_legal_block(text, text, text, timestamptz, timestamptz, timestamptz) IS
  'True only for verified in-force legal/permit blocking rules. Draft, expired, and superseded never qualify.';

-- ── Immutable version body ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.workforce_rules_prevent_inplace_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
      OR NEW.pack_code IS DISTINCT FROM OLD.pack_code
      OR NEW.rule_code IS DISTINCT FROM OLD.rule_code
      OR NEW.version IS DISTINCT FROM OLD.version
      OR NEW.name_he IS DISTINCT FROM OLD.name_he
      OR NEW.description_he IS DISTINCT FROM OLD.description_he
      OR NEW.rule_type IS DISTINCT FROM OLD.rule_type
      OR NEW.severity IS DISTINCT FROM OLD.severity
      OR NEW.source_kind IS DISTINCT FROM OLD.source_kind
      OR NEW.source_citation IS DISTINCT FROM OLD.source_citation
      OR NEW.source_section IS DISTINCT FROM OLD.source_section
      OR NEW.source_url IS DISTINCT FROM OLD.source_url
      OR NEW.reviewed_on IS DISTINCT FROM OLD.reviewed_on
      OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
      OR NEW.scope IS DISTINCT FROM OLD.scope
      OR NEW.parameters IS DISTINCT FROM OLD.parameters
      OR NEW.cannot_be_relaxed IS DISTINCT FROM OLD.cannot_be_relaxed
    THEN
      RAISE EXCEPTION 'WORKFORCE_RULE_VERSION_IMMUTABLE'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF OLD.workspace_id IS NOT NULL
      AND NEW.verification_status = 'verified'
      AND OLD.verification_status IS DISTINCT FROM 'verified'
      AND NEW.rule_type IN ('legal', 'permit')
    THEN
      RAISE EXCEPTION 'WORKFORCE_TENANT_CANNOT_VERIFY_LEGAL'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workforce_rules_immutable ON public.workforce_rules;
CREATE TRIGGER workforce_rules_immutable
  BEFORE UPDATE ON public.workforce_rules
  FOR EACH ROW EXECUTE FUNCTION public.workforce_rules_prevent_inplace_rewrite();

DROP TRIGGER IF EXISTS workforce_rules_set_updated_at ON public.workforce_rules;
CREATE TRIGGER workforce_rules_set_updated_at
  BEFORE UPDATE ON public.workforce_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS workforce_rules_lock_workspace ON public.workforce_rules;
CREATE TRIGGER workforce_rules_lock_workspace
  BEFORE UPDATE ON public.workforce_rules
  FOR EACH ROW EXECUTE FUNCTION public.workforce_lock_workspace_id();

DROP TRIGGER IF EXISTS workforce_workspace_packs_set_updated_at ON public.workforce_workspace_packs;
CREATE TRIGGER workforce_workspace_packs_set_updated_at
  BEFORE UPDATE ON public.workforce_workspace_packs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS workforce_workspace_packs_lock_workspace ON public.workforce_workspace_packs;
CREATE TRIGGER workforce_workspace_packs_lock_workspace
  BEFORE UPDATE ON public.workforce_workspace_packs
  FOR EACH ROW EXECUTE FUNCTION public.workforce_lock_workspace_id();

CREATE OR REPLACE FUNCTION public.workforce_instruments_prevent_inplace_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
      OR NEW.instrument_kind IS DISTINCT FROM OLD.instrument_kind
      OR NEW.code IS DISTINCT FROM OLD.code
      OR NEW.citation IS DISTINCT FROM OLD.citation
      OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
      OR NEW.parameters IS DISTINCT FROM OLD.parameters
    THEN
      RAISE EXCEPTION 'WORKFORCE_INSTRUMENT_IMMUTABLE'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workforce_instruments_immutable ON public.workforce_legal_instruments;
CREATE TRIGGER workforce_instruments_immutable
  BEFORE UPDATE ON public.workforce_legal_instruments
  FOR EACH ROW EXECUTE FUNCTION public.workforce_instruments_prevent_inplace_rewrite();
DROP TRIGGER IF EXISTS workforce_instruments_set_updated_at ON public.workforce_legal_instruments;
CREATE TRIGGER workforce_instruments_set_updated_at
  BEFORE UPDATE ON public.workforce_legal_instruments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS workforce_instruments_lock_workspace ON public.workforce_legal_instruments;
CREATE TRIGGER workforce_instruments_lock_workspace
  BEFORE UPDATE ON public.workforce_legal_instruments
  FOR EACH ROW EXECUTE FUNCTION public.workforce_lock_workspace_id();

DROP TRIGGER IF EXISTS workforce_profiles_set_updated_at ON public.workforce_employment_profiles;
CREATE TRIGGER workforce_profiles_set_updated_at
  BEFORE UPDATE ON public.workforce_employment_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS workforce_profiles_lock_workspace ON public.workforce_employment_profiles;
CREATE TRIGGER workforce_profiles_lock_workspace
  BEFORE UPDATE ON public.workforce_employment_profiles
  FOR EACH ROW EXECUTE FUNCTION public.workforce_lock_workspace_id();

-- ── Seed packs ──────────────────────────────────────────────────────────────
INSERT INTO public.workforce_rule_packs (pack_code, name_he, description_he, pack_kind)
VALUES
  ('israel_hours_base', 'חוק שעות עבודה ומנוחה — בסיס', 'סעיפי חוק מאומתים. אינם מופעלים על שיבוץ ב-L1.', 'legal'),
  ('israel_ot_permit_2018', 'היתר כללי לשעות נוספות 2018', 'י"פ 7732. היתר, לא תיקון לחוק.', 'permit'),
  ('israel_week_42_2018', 'צו הרחבה — שבוע 42 שעות', 'י"פ 7732, תחילה 1.4.2018.', 'collective_agreement'),
  ('security_extension_2022', 'צו הרחבה שמירה ואבטחה 2022', 'י"פ 10412. חלון מנוחה ענפי. לא מחליף היתר סעיף 12.', 'collective_agreement'),
  ('emergency_ot_2026', 'היתרי חירום שעות נוספות 2026', 'פקעו במרץ 2026. נשמרים להיסטוריה בלבד.', 'permit'),
  ('unverified_research', 'פריטי מחקר שטרם אומתו', 'טיוטות. לא חסימה משפטית.', 'operational')
ON CONFLICT (pack_code) DO NOTHING;

-- ── Seed platform catalog (workspace_id NULL). Status is honest, not copied from a report blindly.
INSERT INTO public.workforce_rules (
  workspace_id, pack_code, rule_code, version, name_he, description_he,
  rule_type, verification_status, severity, source_kind, source_citation, source_section, source_url,
  reviewed_on, effective_from, effective_to, scope, parameters, cannot_be_relaxed
) VALUES
(
  NULL, 'israel_hours_base', 'REST_BETWEEN_DAYS', 1,
  'מנוחה בין ימי עבודה',
  'בין יום עבודה למשנהו תחול הפסקה של שמונה שעות לפחות. L1 אינו חוסם שיבוץ.',
  'legal', 'verified', 'blocking', 'statute',
  'חוק שעות עבודה ומנוחה, התשי"א-1951', 'סעיף 21',
  'https://he.wikisource.org/wiki/%D7%97%D7%95%D7%A7_%D7%A9%D7%A2%D7%95%D7%AA_%D7%A2%D7%91%D7%95%D7%93%D7%94_%D7%95%D7%9E%D7%A0%D7%95%D7%97%D7%94',
  DATE '2026-10-21', TIMESTAMPTZ '1951-09-28 00:00:00+03', NULL,
  '{"hours_law_covered": true}'::jsonb,
  '{"min_rest_hours": 8}'::jsonb,
  true
),
(
  NULL, 'israel_hours_base', 'DAY_HOURS_BASE', 1,
  'יום עבודה רגיל',
  'יום עבודה לא יעלה על שמונה שעות. בעבודת לילה, ביום שלפני מנוחה שבועית וביום שלפני חג שהעובד אינו עובד בו — שבע שעות. תקרת השיבוץ היא היתר השעות הנוספות החל, לא סעיף 2 לבדו.',
  'legal', 'verified', 'informational', 'statute',
  'חוק שעות עבודה ומנוחה, התשי"א-1951', 'סעיף 2',
  'https://he.wikisource.org/wiki/%D7%97%D7%95%D7%A7_%D7%A9%D7%A2%D7%95%D7%AA_%D7%A2%D7%91%D7%95%D7%93%D7%94_%D7%95%D7%9E%D7%A0%D7%95%D7%97%D7%94',
  DATE '2026-10-21', TIMESTAMPTZ '1951-09-28 00:00:00+03', NULL,
  '{"hours_law_covered": true}'::jsonb,
  '{"regular_day_hours": 8, "night_or_pre_rest_day_hours": 7}'::jsonb,
  true
),
(
  NULL, 'israel_hours_base', 'WEEK_HOURS_STATUTE', 1,
  'שבוע עבודה בחוק',
  'החוק עדיין קובע 45 שעות. התקרה החיה במשק היא צו ההרחבה ל-42 שעות, לא סעיף 3.',
  'legal', 'verified', 'informational', 'statute',
  'חוק שעות עבודה ומנוחה, התשי"א-1951', 'סעיף 3',
  'https://he.wikisource.org/wiki/%D7%97%D7%95%D7%A7_%D7%A9%D7%A2%D7%95%D7%AA_%D7%A2%D7%91%D7%95%D7%93%D7%94_%D7%95%D7%9E%D7%A0%D7%95%D7%97%D7%94',
  DATE '2026-10-21', TIMESTAMPTZ '1951-09-28 00:00:00+03', NULL,
  '{"hours_law_covered": true}'::jsonb,
  '{"weekly_hours": 45}'::jsonb,
  true
),
(
  NULL, 'israel_hours_base', 'OT_FORBIDDEN', 1,
  'איסור שעות נוספות בלי היתר',
  'העסקה בשעות נוספות אסורה אם אינה מותרת לפי סעיף 10 או הותרה לפי סעיף 11. שמירה היא עילת היתר לפי סעיף 11(3).',
  'legal', 'verified', 'blocking', 'statute',
  'חוק שעות עבודה ומנוחה, התשי"א-1951', 'סעיפים 6, 10, 11',
  'https://he.wikisource.org/wiki/%D7%97%D7%95%D7%A7_%D7%A9%D7%A2%D7%95%D7%AA_%D7%A2%D7%91%D7%95%D7%93%D7%94_%D7%95%D7%9E%D7%A0%D7%95%D7%97%D7%94',
  DATE '2026-10-21', TIMESTAMPTZ '1951-09-28 00:00:00+03', NULL,
  '{"hours_law_covered": true}'::jsonb,
  '{"requires_in_force_permit": true}'::jsonb,
  true
),
(
  NULL, 'israel_hours_base', 'WEEKLY_REST_36', 1,
  'מנוחה שבועית 36 שעות',
  'לפחות 36 שעות רצופות. ליהודי כוללת את השבת. למי שאינו יהודי: שבת או ראשון או שישי לפי המקובל עליו. שומרים rest_weekday, לא דת.',
  'legal', 'verified', 'blocking', 'statute',
  'חוק שעות עבודה ומנוחה, התשי"א-1951', 'סעיף 7',
  'https://he.wikisource.org/wiki/%D7%97%D7%95%D7%A7_%D7%A9%D7%A2%D7%95%D7%AA_%D7%A2%D7%91%D7%95%D7%93%D7%94_%D7%95%D7%9E%D7%A0%D7%95%D7%97%D7%94',
  DATE '2026-10-21', TIMESTAMPTZ '1951-09-28 00:00:00+03', NULL,
  '{"hours_law_covered": true}'::jsonb,
  '{"min_weekly_rest_hours": 36}'::jsonb,
  true
),
(
  NULL, 'israel_hours_base', 'WEEKLY_REST_BAN', 1,
  'איסור העסקה במנוחה השבועית',
  'העסקה במנוחה השבועית אסורה אם לא הותרה לפי סעיף 12. אישור מנהל במסך אינו היתר.',
  'legal', 'verified', 'blocking', 'statute',
  'חוק שעות עבודה ומנוחה, התשי"א-1951', 'סעיפים 9, 12',
  'https://he.wikisource.org/wiki/%D7%97%D7%95%D7%A7_%D7%A9%D7%A2%D7%95%D7%AA_%D7%A2%D7%91%D7%95%D7%93%D7%94_%D7%95%D7%9E%D7%A0%D7%95%D7%97%D7%94',
  DATE '2026-10-21', TIMESTAMPTZ '1951-09-28 00:00:00+03', NULL,
  '{"hours_law_covered": true}'::jsonb,
  '{"requires_section_12_permit": true}'::jsonb,
  true
),
(
  NULL, 'israel_hours_base', 'BREAKS_IN_DAY', 1,
  'הפסקות ביום עבודה',
  'ביום של שש שעות ומעלה: הפסקה של 45 דקות ובה הפסקה רצופה של 30 דקות. ביום שלפני מנוחה שבועית או חג: 30 דקות. L1 לא בודק דקות הפסקה במשמרת.',
  'legal', 'verified', 'warning', 'statute',
  'חוק שעות עבודה ומנוחה, התשי"א-1951', 'סעיף 20',
  'https://he.wikisource.org/wiki/%D7%97%D7%95%D7%A7_%D7%A9%D7%A2%D7%95%D7%AA_%D7%A2%D7%91%D7%95%D7%93%D7%94_%D7%95%D7%9E%D7%A0%D7%95%D7%97%D7%94',
  DATE '2026-10-21', TIMESTAMPTZ '1951-09-28 00:00:00+03', NULL,
  '{"hours_law_covered": true}'::jsonb,
  '{"break_after_hours": 6, "break_minutes": 45, "consecutive_minutes": 30, "pre_rest_break_minutes": 30}'::jsonb,
  true
),
(
  NULL, 'israel_hours_base', 'NIGHT_DEFINITION', 1,
  'הגדרת עבודת לילה',
  'עבודה ששתי שעות ממנה לפחות הן בין 22:00 ל-06:00.',
  'legal', 'verified', 'informational', 'statute',
  'חוק שעות עבודה ומנוחה, התשי"א-1951', 'סעיף 1',
  'https://he.wikisource.org/wiki/%D7%97%D7%95%D7%A7_%D7%A9%D7%A2%D7%95%D7%AA_%D7%A2%D7%91%D7%95%D7%93%D7%94_%D7%95%D7%9E%D7%A0%D7%95%D7%97%D7%94',
  DATE '2026-10-21', TIMESTAMPTZ '1951-09-28 00:00:00+03', NULL,
  '{"hours_law_covered": true}'::jsonb,
  '{"night_start_local": "22:00", "night_end_local": "06:00", "min_hours_in_window": 2}'::jsonb,
  true
),
(
  NULL, 'israel_hours_base', 'NIGHT_WEEK_ROTATION', 1,
  'עבודת לילה במפעל משמרות',
  'במפעל שעובדים בו במשמרות לא יועסק עובד בעבודת לילה יותר משבוע אחד בתוך שבועיים. תחולת "מפעל משמרות" על שמירה מבוזרת דורשת ייעוץ משפטי; לכן החומרה היא אזהרה ולא חסימה.',
  'legal', 'verified', 'warning', 'statute',
  'חוק שעות עבודה ומנוחה, התשי"א-1951 (תיקון תשע"ח-2)', 'סעיפים 22, 23',
  'https://he.wikisource.org/wiki/%D7%97%D7%95%D7%A7_%D7%A9%D7%A2%D7%95%D7%AA_%D7%A2%D7%91%D7%95%D7%93%D7%94_%D7%95%D7%9E%D7%A0%D7%95%D7%97%D7%94',
  DATE '2026-10-21', TIMESTAMPTZ '2018-03-19 00:00:00+02', NULL,
  '{"hours_law_covered": true, "requires": "shift_plant", "interpretation": true}'::jsonb,
  '{"max_night_weeks_in": 1, "window_weeks": 2}'::jsonb,
  true
),
(
  NULL, 'israel_hours_base', 'LAW_EXCLUSIONS', 1,
  'חריגי תחולת החוק',
  'החוק אינו חל בין השאר על שוטרים, שב"ס, תפקידי הנהלה או אמון אישי, ועבודה ללא פיקוח על שעות. ברירת המחדל בפרופיל היא שהחוק חל. מחלוקת — בית הדין לעבודה.',
  'legal', 'verified', 'informational', 'statute',
  'חוק שעות עבודה ומנוחה, התשי"א-1951', 'סעיף 30',
  'https://he.wikisource.org/wiki/%D7%97%D7%95%D7%A7_%D7%A9%D7%A2%D7%95%D7%AA_%D7%A2%D7%91%D7%95%D7%93%D7%94_%D7%95%D7%9E%D7%A0%D7%95%D7%97%D7%94',
  DATE '2026-10-21', TIMESTAMPTZ '1951-09-28 00:00:00+03', NULL,
  '{"default_covered": true}'::jsonb,
  '{"exclusion_flag": "hours_law_covered"}'::jsonb,
  true
),
(
  NULL, 'israel_ot_permit_2018', 'OT_PERMIT_2018', 1,
  'היתר כללי לשעות נוספות 2018',
  'יום כולל נוספות עד 12 שעות. עד 16 שעות נוספות לשבוע. שבוע לילה לפי סעיפים 22 או 23 עד 58 שעות כולל נוספות. ביטל את היתרי 1973 ו-1989 בלבד.',
  'permit', 'verified', 'blocking', 'yalkut',
  'ילקוט הפרסומים 7732, עמ'' 6284, 19 במרץ 2018', 'סעיפים 1–2 להיתר; סעיף 15 לחוק',
  'https://www.hilan.co.il/%D7%9E%D7%A8%D7%9B%D7%96-%D7%99%D7%93%D7%A2/%D7%97%D7%A7%D7%99%D7%A7%D7%94/%D7%93%D7%99%D7%A0%D7%99-%D7%A2%D7%91%D7%95%D7%93%D7%94/%D7%97%D7%95%D7%A7-%D7%A9%D7%A2%D7%95%D7%AA-%D7%A2%D7%91%D7%95%D7%93%D7%94-%D7%95%D7%9E%D7%A0%D7%95%D7%97%D7%94/%D7%94%D7%95%D7%93%D7%A2%D7%94-%D7%A2%D7%9C-%D7%9E%D7%AA%D7%9F-%D7%94%D7%99%D7%AA%D7%A8-%D7%9B%D7%9C%D7%9C%D7%99-%D7%9C%D7%94%D7%A2%D7%A1%D7%A7%D7%AA-%D7%A2%D7%95%D7%91%D7%93%D7%99%D7%9D-%D7%91%D7%A9%D7%A2%D7%95%D7%AA-%D7%A0%D7%95%D7%A1%D7%A4%D7%95%D7%AA/',
  DATE '2026-10-21', TIMESTAMPTZ '2018-03-19 00:00:00+02', NULL,
  '{"hours_law_covered": true}'::jsonb,
  '{"max_day_hours_including_ot": 12, "max_weekly_ot_hours": 16, "max_night_week_hours_including_ot": 58}'::jsonb,
  true
),
(
  NULL, 'israel_week_42_2018', 'WEEK_HOURS_42', 1,
  'שבוע עבודה 42 שעות',
  'צו הרחבה לקיצור השבוע ל-42 שעות ללא הפחתת שכר, באמצעות יום מקוצר. במקומות משמרות המעסיק קובע את שעות המשמרת. אינו תיקון לסעיף 3.',
  'collective_agreement', 'verified', 'warning', 'extension_order',
  'צו הרחבה בדבר קיצור שבוע העבודה במשק, י"פ 7732, 19.3.2018; הסכם 7019/2017', 'סעיף 2 לצו',
  'https://www.osh.org.il/heb/news/news,3132/',
  DATE '2026-10-21', TIMESTAMPTZ '2018-04-01 00:00:00+03', NULL,
  '{"hours_law_covered": true}'::jsonb,
  '{"weekly_hours": 42, "shortened_day_reduction_hours": 1}'::jsonb,
  false
),
(
  NULL, 'security_extension_2022', 'SECURITY_REST_WINDOW', 1,
  'חלון מנוחה שבועית בענף השמירה',
  '36 שעות בין שישי 16:00 לראשון 04:00. עבודה בחלון מזכה בגמול מנוחה שבועית. הצו אינו היתר לפי סעיף 12.',
  'collective_agreement', 'verified', 'warning', 'extension_order',
  'צו הרחבה בענף השמירה והאבטחה, י"פ 10412, 7.4.2022', 'סעיפים 9–10 להסכם שהורחב',
  'https://www.chamber.org.il/media/166226/%D7%99%D7%9C%D7%A7%D7%95%D7%98-%D7%94%D7%A4%D7%A8%D7%A1%D7%95%D7%9E%D7%99%D7%9D-10412.pdf',
  DATE '2026-10-21', TIMESTAMPTZ '2022-09-01 00:00:00+03', NULL,
  '{"sector": "security_guarding", "requires_pack_enabled": true}'::jsonb,
  '{"window_start_weekday": 5, "window_start_local": "16:00", "window_end_weekday": 0, "window_end_local": "04:00", "min_weekly_rest_hours": 36}'::jsonb,
  false
),
(
  NULL, 'emergency_ot_2026', 'EMERGENCY_OT_2026', 1,
  'היתר חירום כללי לשעות נוספות (פקע)',
  'עד 67 שעות לשבוע כולל נוספות, 90 שעות נוספות לחודש, 14 שעות ליום בהסכמה. פקע. אין להחיל כהיתר חי.',
  'permit', 'expired', 'informational', 'yalkut',
  'היתר כללי להעסקת עובדים בשעות נוספות (הוראת שעה), י"פ 14318, 2.3.2026; הארכות תעשייה עד 19.3.2026', 'סעיף 11(1א) לחוק',
  'https://www.gov.il/BlobFolder/news/extra-hours-war/he/workers-rights_extra-hours-11684.pdf',
  DATE '2026-10-21', TIMESTAMPTZ '2026-03-02 00:00:00+02', TIMESTAMPTZ '2026-03-19 23:59:59+02',
  '{"emergency": true}'::jsonb,
  '{"max_week_hours_including_ot": 67, "max_monthly_ot_hours": 90, "max_day_hours_including_ot": 14}'::jsonb,
  false
),
(
  NULL, 'emergency_ot_2026', 'EMERGENCY_OT_GUARDING_2026', 1,
  'תיקון היתר שמירה בשעת חירום (פקע)',
  'תיקון היתר שמירה בהוראת שעה, י"פ 14318. תוקף עד 12.3.2026 או תום ההכרזה, לפי המוקדם. פקע.',
  'permit', 'expired', 'informational', 'yalkut',
  'הודעה על תיקון היתר כללי להעסקת עובדים בשמירה בשעות נוספות (הוראת שעה), י"פ 14318, 2.3.2026', 'תוקף',
  'https://aci.org.il/wp-content/uploads/2026/03/%D7%99%D7%9C%D7%A7%D7%95%D7%98-%D7%94%D7%A4%D7%A8%D7%A1%D7%95%D7%9E%D7%99%D7%9D-14318-1.pdf',
  DATE '2026-10-21', TIMESTAMPTZ '2026-03-02 00:00:00+02', TIMESTAMPTZ '2026-03-12 23:59:59+02',
  '{"emergency": true, "sector": "security_guarding"}'::jsonb,
  '{}'::jsonb,
  false
),
(
  NULL, 'unverified_research', 'GUARDING_OT_1951', 1,
  'היתר שמירה היסטורי — לא אומת כחי',
  'נזכר בנייר משרדי מ-2019 כהיתר העבדה בשמירה במנוחה ובשעות נוספות. מחקר L0 לא השיג ילקוט חי. אין לקבע 14 שעות או 40 שעות נוספות.',
  'permit', 'draft', 'informational', 'research_note',
  'נייר משרד העבודה "גמישות בשעות העבודה" (משני, 2019) — לא ילקוט חי', 'אזכור היתר שמירה תשי"א',
  'https://www.gov.il/BlobFolder/legalinfo/rest-flexibility/he/workers-rights_rest-flexibility.pdf',
  DATE '2026-10-21', TIMESTAMPTZ '1951-09-28 00:00:00+03', NULL,
  '{"unverified": true, "do_not_enforce": true}'::jsonb,
  '{"numbers_withheld": true}'::jsonb,
  false
),
(
  NULL, 'unverified_research', 'HOLIDAY_WORK_BAN', 1,
  'איסור עבודה בחג — לא מאומת כאיסור שיבוץ כללי',
  'סעיף 2(ב) מקצר את היום שלפני חג שהעובד אינו עובד בו. איסור שיבוץ בחג אינו נובע מחוק השעות כמו שבת. דורש לוח חגים ומעסיק.',
  'operational', 'draft', 'informational', 'research_note',
  'חוק שעות עבודה ומנוחה סעיף 2(ב) — אינו איסור חג כללי', 'סעיף 2(ב)',
  'https://he.wikisource.org/wiki/%D7%97%D7%95%D7%A7_%D7%A9%D7%A2%D7%95%D7%AA_%D7%A2%D7%91%D7%95%D7%93%D7%94_%D7%95%D7%9E%D7%A0%D7%95%D7%97%D7%94',
  DATE '2026-10-21', TIMESTAMPTZ '1951-09-28 00:00:00+03', NULL,
  '{"unverified_as_scheduling_ban": true}'::jsonb,
  '{}'::jsonb,
  false
),
(
  NULL, 'unverified_research', 'CONSECUTIVE_NIGHT_CAP', 1,
  'רצף משמרות לילה מספרי',
  'לא נמצא בחוק מספר רצף לילות מחוץ לכלל שבוע-בתוך-שבועיים בסעיף 22. מדיניות מעסיק בלבד עד שיצורף מקור.',
  'employer_policy', 'draft', 'informational', 'research_note',
  'לא אומת ממקור רשמי', NULL, NULL,
  DATE '2026-10-21', TIMESTAMPTZ '2026-10-21 00:00:00+03', NULL,
  '{"unverified": true}'::jsonb,
  '{}'::jsonb,
  false
)
ON CONFLICT (rule_code, version) WHERE workspace_id IS NULL DO NOTHING;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.workforce_rule_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_rule_packs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_workspace_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_workspace_packs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_legal_instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_legal_instruments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_employment_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_employment_profiles FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.workforce_can_read_rule_catalog()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_memberships m
    WHERE m.user_id = auth.uid()
      AND m.status = 'active'
      AND public.auth_feature(m.workspace_id, 'workforce')
      AND (
        public.auth_has_workspace_grant(m.workspace_id, 'workforce.schedules.view')
        OR public.auth_has_workspace_grant(m.workspace_id, 'workforce.settings.manage')
        OR public.auth_has_workspace_grant(m.workspace_id, 'workforce.audit.view')
      )
  );
$$;

DROP POLICY IF EXISTS workforce_rule_packs_select ON public.workforce_rule_packs;
CREATE POLICY workforce_rule_packs_select ON public.workforce_rule_packs
  FOR SELECT TO authenticated
  USING (public.workforce_can_read_rule_catalog());

DROP POLICY IF EXISTS workforce_rules_select ON public.workforce_rules;
CREATE POLICY workforce_rules_select ON public.workforce_rules
  FOR SELECT TO authenticated
  USING (
    (
      workspace_id IS NULL
      AND public.workforce_can_read_rule_catalog()
    )
    OR (
      workspace_id IS NOT NULL
      AND public.auth_is_member(workspace_id)
      AND public.auth_feature(workspace_id, 'workforce')
      AND (
        public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.view')
        OR public.auth_has_workspace_grant(workspace_id, 'workforce.settings.manage')
        OR public.auth_has_workspace_grant(workspace_id, 'workforce.audit.view')
      )
    )
  );

DROP POLICY IF EXISTS workforce_rules_insert ON public.workforce_rules;
CREATE POLICY workforce_rules_insert ON public.workforce_rules
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.settings.manage')
    AND (
      rule_type NOT IN ('legal', 'permit')
      OR verification_status <> 'verified'
    )
  );

DROP POLICY IF EXISTS workforce_rules_update ON public.workforce_rules;
CREATE POLICY workforce_rules_update ON public.workforce_rules
  FOR UPDATE TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.settings.manage')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.settings.manage')
  );

DROP POLICY IF EXISTS workforce_workspace_packs_select ON public.workforce_workspace_packs;
CREATE POLICY workforce_workspace_packs_select ON public.workforce_workspace_packs
  FOR SELECT TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND (
      public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.view')
      OR public.auth_has_workspace_grant(workspace_id, 'workforce.settings.manage')
      OR public.auth_has_workspace_grant(workspace_id, 'workforce.audit.view')
    )
  );
DROP POLICY IF EXISTS workforce_workspace_packs_insert ON public.workforce_workspace_packs;
CREATE POLICY workforce_workspace_packs_insert ON public.workforce_workspace_packs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.settings.manage')
  );
DROP POLICY IF EXISTS workforce_workspace_packs_update ON public.workforce_workspace_packs;
CREATE POLICY workforce_workspace_packs_update ON public.workforce_workspace_packs
  FOR UPDATE TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.settings.manage')
  )
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.settings.manage')
  );

DROP POLICY IF EXISTS workforce_instruments_select ON public.workforce_legal_instruments;
CREATE POLICY workforce_instruments_select ON public.workforce_legal_instruments
  FOR SELECT TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND (
      public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.view')
      OR public.auth_has_workspace_grant(workspace_id, 'workforce.settings.manage')
      OR public.auth_has_workspace_grant(workspace_id, 'workforce.audit.view')
    )
  );
DROP POLICY IF EXISTS workforce_instruments_insert ON public.workforce_legal_instruments;
CREATE POLICY workforce_instruments_insert ON public.workforce_legal_instruments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.settings.manage')
  );
DROP POLICY IF EXISTS workforce_instruments_update ON public.workforce_legal_instruments;
CREATE POLICY workforce_instruments_update ON public.workforce_legal_instruments
  FOR UPDATE TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.settings.manage')
  )
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.settings.manage')
  );

DROP POLICY IF EXISTS workforce_profiles_select ON public.workforce_employment_profiles;
CREATE POLICY workforce_profiles_select ON public.workforce_employment_profiles
  FOR SELECT TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND (
      public.auth_has_workspace_grant(workspace_id, 'workforce.employees.view')
      OR public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.view')
      OR public.auth_has_workspace_grant(workspace_id, 'workforce.settings.manage')
    )
  );
DROP POLICY IF EXISTS workforce_profiles_insert ON public.workforce_employment_profiles;
CREATE POLICY workforce_profiles_insert ON public.workforce_employment_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND (
      public.auth_has_workspace_grant(workspace_id, 'workforce.employees.manage')
      OR public.auth_has_workspace_grant(workspace_id, 'workforce.settings.manage')
    )
  );
DROP POLICY IF EXISTS workforce_profiles_update ON public.workforce_employment_profiles;
CREATE POLICY workforce_profiles_update ON public.workforce_employment_profiles
  FOR UPDATE TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND (
      public.auth_has_workspace_grant(workspace_id, 'workforce.employees.manage')
      OR public.auth_has_workspace_grant(workspace_id, 'workforce.settings.manage')
    )
  )
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND (
      public.auth_has_workspace_grant(workspace_id, 'workforce.employees.manage')
      OR public.auth_has_workspace_grant(workspace_id, 'workforce.settings.manage')
    )
  );

GRANT SELECT ON TABLE public.workforce_rule_packs TO authenticated;
GRANT SELECT ON TABLE public.workforce_rules TO authenticated;
GRANT INSERT, UPDATE ON TABLE public.workforce_rules TO authenticated;
REVOKE DELETE ON TABLE public.workforce_rules FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.workforce_workspace_packs TO authenticated;
REVOKE DELETE ON TABLE public.workforce_workspace_packs FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.workforce_legal_instruments TO authenticated;
REVOKE DELETE ON TABLE public.workforce_legal_instruments FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workforce_employment_profiles TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workforce_rule_packs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workforce_rules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workforce_workspace_packs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workforce_legal_instruments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workforce_employment_profiles TO service_role;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.workforce_employees FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.workforce_memberships FROM authenticated;
GRANT SELECT ON TABLE public.workforce_employees TO authenticated;
GRANT SELECT ON TABLE public.workforce_memberships TO authenticated;
