# GATE 10 — Backup & Restore Drill Report

**Date (UTC):** 2026-09-11  
**Verdict:** **GATE 10 BACKUP & RESTORE FAIL — PRIVATE BETA BLOCKED**

---

## Candidate

| Item | Value |
|---|---|
| Tag | `beta-0.1.4` (immutable; **unchanged**) |
| Commit | `88c976e92e1257e9b60e7316bb09c8c38b7b7544` |
| APP_VERSION | `0.1.4-beta` |

## Backup Architecture

### Database

| Item | Finding |
|---|---|
| Supabase project | SiteSecureV1 `rhxqqudlngimhplvndmz` (ap-northeast-1), ACTIVE_HEALTHY |
| Org / plan | Site Secure (`gsljuscbmpqxhrvwnyls`) — **Free** |
| PostgreSQL | 17.6 |
| Migrations | Present through remote `20260911073049` (`auth_contract_technician_scope`) |
| Automated daily backups | **Not available** on Free (Supabase: Pro/Team/Enterprise only; Free must self-dump) |
| PITR | **Not available** (paid add-on) |
| Restore to new project | **Not available** (paid + physical backups) |
| Supabase Branching | Available via MCP but **schema-only** — production data does **not** copy |
| Off-site logical dump | **Not found** in this environment; CLI not logged in; no `DATABASE_URL`/DB password in app env; no Docker/psql locally |

### Supabase Auth

- Auth lives in `auth` schema; user count observed: **130** (`auth.users`).
- Platform DB restore / project clone (Pro+) includes Auth user data (hashed passwords).
- Sessions/JWTs: treat as **not** surviving disaster recovery unless proven.
- Free-plan drill could not restore Auth to an isolated target.

### Storage

- Buckets: `branding`, `documents`, `exports`, `photos`, `signatures` (all private).
- Platform DB backups **exclude** Storage binaries (metadata only) — official Supabase caveat.
- Live observation: `documents` rows with path **60**; matching `storage.objects` **16**; **44** metadata rows missing objects → existing evidence integrity risk even before backup.

## QA Recovery Dataset

**Not created.** Gate safety rule: if an isolated restore cannot be performed safely, **STOP**. Creating disposable tenants without a restore target would only mutate Beta without proving recovery.

## Recovery Manifest

**Not generated** (blocked on restore capability). Baseline live counts for context only:

| Metric | Count |
|---|---|
| workspaces | 514 |
| workspace_memberships | 692 |
| profiles | 130 |
| auth.users | 130 |
| documents (metadata) | 60 |
| storage.objects | 17 |
| beta_participants | 1 |
| profiles.is_platform_admin=true | 1 |
| founding_technician badges | 4 |

## Backup

| Item | Result |
|---|---|
| Method | **None executed** — no Pro daily backup list/API restore; no CLI dump |
| Timestamp | N/A |
| Artifact | N/A |

## Restore

| Item | Result |
|---|---|
| Target | **None** — isolated restore blocked |
| Duration | N/A |
| Safety | Correctly refused in-place restore over live Beta |

**Blockers preventing isolated restore in this drill:**

1. Org plan = Free → no automated backups / no restore-to-new-project.  
2. No database password / Management API token / Docker / local Postgres for CLI dump→restore.  
3. Branching cannot substitute for a data restore.

## Database Integrity

**FAIL** — restore not performed; cannot verify.

## Relationship Integrity

**FAIL** — restore not performed; cannot verify.

## Auth Recovery

**Exact behavior (documented, not proven by restore):**

- On Free without off-site dump: **no proven Auth recovery path**.  
- On Pro “Restore to a New Project”: Auth users + hashes expected in clone; app keys/settings must be reconfigured; expect **re-login**.  
- Memberships/roles live in `public` and restore with DB when dumps/clones include them.

## Authorization After Restore

**FAIL / NOT RUN** — no restored target for Owner/Technician/cross-workspace smoke.

## Storage Recovery

**STORAGE RECOVERY GAP (P0)**

- Even with future Pro DB restore, binaries are not included.  
- No off-site Storage backup process is documented/operational today.  
- Live metadata/object mismatch (44 docs without objects) shows binaries are already fragile.

## PDF Recovery

**Architecture (code):** Quote PDFs are **generated artifacts** via `render_quote_pdf` (not the primary durable store). After a successful DB restore, business content should be regenerable from Quote/line data.

**Drill result:** **NOT PROVEN** (no restored Quote state).

## Catalog

**NOT RUN** (no restore). Requirement remains: tenant-owned products only; no global seed products on empty workspaces.

## CCTV

**NOT RUN** (no restore). Recommendation should be re-runnable from restored catalog/system data when restore exists.

## Beta / Badges

**Live model only:** `beta_participants` table exists; `founding_technician` is `profiles.recognition_badges` (recognition only). Restore survival **not proven**.

## Platform Admin

**Live model:** `profiles.is_platform_admin` (1 admin). Restore elevation check **not run**.

## Restored Application Smoke

**NOT RUN** — no isolated API/Web against a restored env (correctly avoided pointing Beta URL at anything unsafe).

## RPO

**Current realistic:** **Unbounded / unknown** for Free without a verified recurring off-site dump. Worst case = total loss of DB since project creation if the project is destroyed and no dump exists. Free projects can also pause; 90-day restore window then applies to pause/resume, which is **not** a substitute for disaster recovery of accidental deletes.

## RTO

**Current realistic:** **Cannot estimate from a successful drill** — no restore completed. After Pro + restore-to-new-project + Storage procedure, expect **hours** (restore time + Storage + Auth/RBAC/app smoke), not minutes.

## Recovery Runbook

- Path: `Docs/RECOVERY_RUNBOOK.md`  
- Summary: detect → contain → choose recovery point → isolated target → DB restore → Storage verify → Auth → RBAC → app smoke → traffic switch only after approval. No secrets included.

## Defects

| Sev | Defect |
|---|---|
| **P0** | Free plan: no automated DB backups; Beta customer data has no proven recoverable backup |
| **P0** | Isolated restore drill could not be executed safely with available tooling/credentials |
| **P0** | **STORAGE RECOVERY GAP** — no Storage binary backup/restore procedure; DB restore alone insufficient for photos/docs |
| **P1** | Live `documents` metadata vs `storage.objects` mismatch (44 paths without objects) |
| **P2** | No scheduled CLI dump / off-site retention even as Free-tier mitigation |
| **P3** | Existing `beta_gate_backup_drill.py` is checklist-only; does not perform restore |

## Git

Confirmed: `beta-0.1.4` → `88c976e92e1257e9b60e7316bb09c8c38b7b7544` **unchanged**. No `beta-0.1.5` created. No candidate code/schema fix applied (would be a later candidate if required).

## Unlock criteria for re-run Gate 10

1. Upgrade org to **Pro** (enables daily backups + restore-to-new-project), **or** provide DB password + install dump/restore tooling and prove off-site dump→isolated restore.  
2. Implement and test **Storage** off-site backup (document + photo minimum).  
3. Create disposable QA workspaces A/B + recovery manifest.  
4. Restore to isolated project; complete integrity, Authz, Storage, PDF regen, catalog, CCTV, badges, platform admin, and isolated app smokes.  
5. Fill observed RPO/RTO from that drill.

---

## Final verdict

**GATE 10 BACKUP & RESTORE FAIL — PRIVATE BETA BLOCKED**
