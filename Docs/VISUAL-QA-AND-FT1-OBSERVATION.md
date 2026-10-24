# Visual QA + FT #1 Observation

Date: 2026-09-30  
Mode: Visual QA (no redesign) → FT #1 stuck-point probe

---

## A. Visual QA (SETTINGS-3C)

**Scope:** Hub / Profile / General / Company / Team  
**Matrix:** 1440 · 1032 · 768 · 390 · 360 × dark/light × RTL  
**Artifacts:** `Docs/settings-3c-visual-qa/` (50 shots + `report.json`)

### Automated checks
- Overflow-x: **0**
- Broken responsive (rail vs select / hub aside): **0**
- Load errors: **0**
- Localhost links: **0**

### Manual review + surgical fix
| Finding | Severity | Action |
|---|---|---|
| Empty `full_name` duplicated email as name + email on Hub/Profile | visual honesty | Fixed: placeholder «הוסיפו שם מלא» + muted style |
| Team @390 sometimes screenshot mid-load | flake | QA wait strengthened; not a product blocker |
| Company / General / Hub mobile | ok | no CSS change |
| Bottom Nav | untouched | confirmed present |

No redesign. Only identity placeholder fix.

---

## B. FT #1 observation

**User:** `ft.product.e3588aa5@sitesecure.test` (technician + founding badge)  
**Empty:** `ft.empty.e3588aa5@sitesecure.test`  
**Artifacts:** `Docs/ft1-observation-qa/`

### Journey

| Step | Result |
|---|---|
| Landing → Today | PASS |
| Today with assigned work + CTA | PASS |
| Badge | PASS |
| Open FieldJob | PASS |
| Jobs list (field framing) | PASS |
| Settings hub (personal) | PASS |
| Settings authz (no workspace rows) | PASS |
| Profile page | PASS |
| Appearance | PASS |
| General denied | PASS |
| Quotes API 403 | PASS |
| Empty Today calm | PASS |

### Stuck points
**Blockers: 0 · Majors: 0**

Notes for real FT onboarding (not blockers):
1. Personal Settings is now reachable via `settings.view` (intended after 3C) — Appearance/Profile only; workspace surfaces correctly hidden.
2. If FT has empty profile name, they see placeholder until they edit Profile (same fix as Visual QA).
3. Field job / Today / Jobs / Feedback path did not stall in this controlled run.

### Product readiness
Settings remains **not a beta blocker**. FT #1 controlled golden path is clear enough to invite a real founding technician and watch live friction outside the scripted account.
