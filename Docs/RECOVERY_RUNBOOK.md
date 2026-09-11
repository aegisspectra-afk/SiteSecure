# SITE SECURE — Recovery Runbook (Private Beta)

**Proven path (Gate 10B):** independent **logical vault** (JSONL DB export + Storage binaries + manifests).  
**Not used for Beta yet:** Supabase Pro daily backups / restore-to-new-project (org currently Free).  
**Candidate tag:** `beta-0.1.4` remains immutable; upload lifecycle hardening may ship as `0.1.5-beta`.

**Active Beta project (never destroy for drills):** `rhxqqudlngimhplvndmz`  
**Reserved empty recovery project (schema not fully provisioned):** `nycprpxzpcomiufavlys` (`SiteSecureV1-Gate10B-Recovery`)  
**Vault location (local/off-site):** `$SS_BACKUP_DIR` or `<repo>/_backup_vault/` (gitignored)

No secrets in this document.

---

## Prerequisites

1. Python 3.12+ with `httpx`, `python-dotenv`
2. Env vars (secret manager / local `.env`, never Git):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY` (for app smoke / user login tests)
   - optional `SS_BACKUP_DIR` (default `_backup_vault`)
   - optional `API_URL` for app smoke (e.g. `http://127.0.0.1:8010`)
3. Disk space for Storage binaries
4. Operator access only — vault contains customer/business data

---

## Backup (repeatable)

```bash
# Full application logical backup (all workspaces)
python apps/api/scripts/durability/logical_backup.py

# Workspace-scoped (QA / single-tenant)
python apps/api/scripts/durability/logical_backup.py --workspace-id <UUID>

# Operator visibility
python apps/api/scripts/durability/logical_backup.py --status
```

**Exit code:** nonzero on failure.  
**Artifacts per run:** `_backup_vault/<backup_id>/MANIFEST.json`, `db/*.jsonl`, `storage/<bucket>/…`, `storage/MANIFEST.json`  
**Status file:** `_backup_vault/LAST_STATUS.json` (`last_backup_at`, `last_backup_ok`, error samples)

### What is included

| Area | Included | Notes |
|---|---|---|
| public app tables | Yes (JSONL) | See `logical_backup.TABLES` |
| auth.users | Metadata only | id/email/app_metadata — **not** password hashes |
| memberships / roles / RLS schema | Memberships + role keys yes; policies live in DB migrations | Restore assumes target schema already applied |
| beta_participants / badges / platform admin | Yes (profiles flags/badges) | |
| Storage binaries | Yes (documents, photos, signatures, branding, exports) | Checksums in manifest |
| Storage metadata rows | Via documents + branding settings | |

### Auth recovery strategy (proven)

1. Restore creates/updates Auth users via Admin API with an operator-supplied temporary password (`--qa-password` in restore tool).  
2. Existing JWTs/sessions are **not** assumed to survive — users re-authenticate.  
3. For real customers after DR: set temp passwords **or** send password-reset emails; memberships/profiles come from JSONL.

### What this is NOT

- Not a physical Supabase project clone  
- Not a substitute for Pro “Restore to a New Project”  
- Dashboard Auth settings / API keys / Edge Functions are out of scope  

---

## Private Beta operational schedule

| Item | Policy |
|---|---|
| Cadence | **At least once daily** before technician field days; additionally before risky migrations |
| How | Operator runs `logical_backup.py` (Task Scheduler / cron can wrap the same command) |
| Retention | Keep **last 7 successful** vault directories; delete older after confirm |
| RPO | Up to ~24h if daily; shorter if run more often |
| Monitoring | `logical_backup.py --status` + inspect `LAST_STATUS.json`; treat `last_backup_ok=false` or age > 36h as incident |

Until a scheduler is installed, backups are **operator-run** (not unattended automation).

---

## Incident recovery steps

### 1. Detect
Missing data, failed logins, broken photos/docs, bad migration.

### 2. Contain
Pause writers if needed; note UTC time of first symptom; do **not** wipe Beta blindly.

### 3. Select recovery point
Choose vault `backup_id` with `MANIFEST.json.ok=true` and matching Storage manifest.

### 4. Isolated target
Preferred: restore into a **scratch** Supabase project with migrations applied, **or** restore disposable QA workspaces only.  
**Never** full-wipe `rhxqqudlngimhplvndmz` without written approval.

### 5–6. Restore DB + Storage

```bash
python apps/api/scripts/durability/logical_restore.py \
  --backup-id <BACKUP_ID> \
  --workspace-id <WS_A> \
  --workspace-id <WS_B> \
  --qa-password '<TEMP_PASSWORD>'
```

Record start/finish/duration from script JSON output.

### 7. Auth
Confirm login with temp password / reset flow; profiles + memberships present.

### 8. Tenant / RBAC checks
- Owner A accesses A only  
- Technician A: assigned jobs/sites/docs; deny Quotes / catalog commercial / roles / Security Center  
- A cannot read B  

### 9. Application smoke
Owner: Login → Dashboard → Customer → Site → Quote → Document  
Technician: Login → Today → Job → Site → Photo  
Verify document/photo bytes (checksum / open URL).  
Regenerate Quote PDF; run CCTV recommend against restored catalog.

### 10. Traffic switch
Only after product-owner approval. Keep prior vault. Do not delete the failed environment until smoke PASS.

---

## Storage reconciliation (read-only)

```bash
python apps/api/scripts/durability/storage_reconcile.py \
  --json-out apps/api/scripts/durability/reports/reconcile.json
```

Detects DB→missing object and orphan objects. **Does not delete.**  
Destructive repair requires explicit operator action outside this tool.

---

## Upload lifecycle (application)

Canonical complete path:

1. `POST .../documents/uploads` → reservation row (`byte_size` null)  
2. Client PUT to signed Storage URL  
3. `POST .../documents/{id}/complete` → **requires Storage object**; else cleanup + `STORAGE_OBJECT_MISSING`

Incomplete reservations may remain as `METADATA_ONLY_BY_DESIGN` until cleaned by ops.

---

## Gate 10B drill (disposable QA)

```bash
set API_URL=http://127.0.0.1:8010
python apps/api/scripts/durability/gate10b_drill.py
```

Creates `GATE10B-QA-*` tenants, backs up, poisons Storage + wipes QA DB, restores from vault, verifies files/RBAC/PDF.

---

## Security

- Vault is local/private path; not public  
- Never commit `_backup_vault/` or service-role keys  
- Transport to remote off-site copy: use encrypted channel (SFTP/HTTPS) if relocating vault  
- Retention deletion is operator-controlled  

---

## Measured drill timings (example Gate 10B run)

See latest `apps/api/scripts/durability/reports/gate10b_drill_*.json` → `timings`  
(seed / backup / destroy / restore / total). Use restore+verify as current RTO estimate for scoped QA recovery.
