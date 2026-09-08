# SITE SECURE — Private Beta Gate

Version lock target: **beta-0.1.0** (`APP_VERSION=0.1.0-beta`)

## READY FOR PRIVATE BETA only if

- [ ] No open P0
- [ ] Production E2E PASS
- [ ] Tenant / RBAC PASS
- [ ] Backup restore PASS
- [ ] Mobile technician flow PASS
- [ ] Catalog import + pricing PASS
- [ ] PDF PASS
- [ ] Admin + feedback + audit work
- [ ] No `founding_technician` authorization ambiguity (Badge only)
- [ ] Tagged deploy with rollback (`beta-0.1.0`)

## Task order

1. Founding Technician Role Cleanup
2. Platform Admin V1
3. In-App Feedback + Error Visibility
4. Production E2E Gate
5. Security Gate
6. Backup / Restore Drill
7. Mobile Field QA
8. Real Catalog + Pricing Pilot
9. Beta Release / version lock

## Scripts

- `apps/api/scripts/beta_gate_security_checklist.py` — focused security probes
- `apps/api/scripts/beta_gate_backup_drill.py` — QA workspace snapshot drill notes + SQL checks
- `apps/api/scripts/beta_gate_e2e_checklist.md` — production E2E manual/automated matrix

## Founding Technician rule

- Role for permissions: `technician` only
- Recognition: `profiles.recognition_badges` includes `founding_technician`
- Invites must not offer `founding_technician` as a role
