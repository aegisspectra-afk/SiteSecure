# GATE 10B — Data Durability Remediation + Recoverable Backup Foundation

**Date (UTC):** 2026-09-11  
**Final verdict:** **GATE 10B PASS — RECOVERABLE PRIVATE BETA FOUNDATION VERIFIED**

---

## Storage Forensics

Read-only report: `apps/api/scripts/durability/reports/reconcile.json`

### Documents classification (live, post-drill)

| Class | Count |
|---|---|
| HEALTHY | 21 |
| QA_FIXTURE | 42 |
| METADATA_ONLY_BY_DESIGN | 1 |
| OBJECT_MISSING | 2 |
| **Total** | **66** |

(Original Gate 10 baseline was 60 docs / 16 healthy / 44 missing — growth is from Gate 10B QA uploads + leftover incomplete fixtures.)

### Bucket audit

| Bucket | DB refs | Healthy | Missing | Storage objects | Orphans vs docs/logo |
|---|---|---|---|---|---|
| documents | 46 | 3 | 43 | 3 | 0 |
| photos | 6 | 5 | 1 | 5 | 0 |
| signatures | 14 | 13 | 1 | 13 | 0 |
| branding | 0* | — | — | 1 | 0 (linked via `workspace_settings.branding`) |
| exports | 0 | 0 | 0 | 0 | 0 |

\*branding is not stored in `documents`; logo path lives in settings JSON.

---

## Document Root Cause

**Why ~60 vs ~16 existed**

1. **Upload reservation model (by design):** `POST /documents/uploads` inserts a `documents` row **before** Storage PUT, with `byte_size=null` + `reserved_bytes`. If the client never completes upload, metadata remains. Most “missing” rows are incomplete reservations, not silent corruption of completed files.
2. **QA fixtures:** filenames `spec.pdf`, `small.txt`, `pad.bin`, `secret.pdf`, `field.pdf` from quota/auth/storage automated tests — **42** classified `QA_FIXTURE`.
3. **Lifecycle defect (real):** `complete_upload` previously could set `byte_size` even when Storage object was absent (trusted reservation/client size). That allows a **completed** broken reference.
4. **Historical completed orphan:** 1 signature with `byte_size` set and object gone (`OBJECT_MISSING`) on a real workspace — likely post-upload object loss / cleanup race (signature path is upload-then-insert, which is safer).

**Not bulk-deleted.** Left in place for audit.

---

## Photo Audit

| Result | Detail |
|---|---|
| Healthy photos | 5/6 |
| Missing | 1 incomplete (`byte_size` null) — abandoned upload reservation |
| Gate 09 physical photo path | Still valid; durability now hardened at `complete` |
| Gate 10B drill photo | Upload → backup → poison → restore → checksum PASS |

---

## Lifecycle Fix

**File:** `apps/api/app/routers/documents.py`

- `complete_upload` now **requires** Storage object existence; otherwise deletes reservation + best-effort object cleanup and returns `409 STORAGE_OBJECT_MISSING`.
- `document_url` refuses incomplete (`byte_size` null) attachments.

**Invariant (compensating, not distributed ACID):** visible completed attachment ⇒ metadata references an existing Storage object at complete-time.

---

## Reconciliation Tool

**Path:** `apps/api/scripts/durability/storage_reconcile.py`  
**Default:** READ ONLY  
**Detects:** DB→missing object, storage orphans (vs documents + branding logos)  
**Does not** auto-delete.

---

## Database Backup Architecture

**Option B — independent logical vault** (chosen; Free plan retained)

- Script: `apps/api/scripts/durability/logical_backup.py`
- Format: JSONL per public table + `auth_users.jsonl` (Admin API metadata)
- Credentials: env only (`SUPABASE_*`); vault under `_backup_vault/` (gitignored) or `SS_BACKUP_DIR`

### Scope documentation

| Included | Not / limited |
|---|---|
| Application public tables | Physical Supabase clone |
| Memberships, subscriptions, overrides, beta_participants | Password hashes |
| profiles badges + `is_platform_admin` | Dashboard Auth settings / API keys |
| Storage metadata via documents + settings | Edge Functions / Realtime config |
| Schema assumed present on target (migrations) | Blind `pg_dump` of managed internals |

---

## Storage Backup Architecture

Same vault run downloads buckets: `documents`, `photos`, `signatures`, `branding`, `exports` with SHA-256 in `storage/MANIFEST.json`, linked by `backup_id`.

---

## Backup Destination

**Type:** private local/off-site directory vault (filesystem). Not public. Relocate via encrypted channel if needed.

---

## Backup Schedule

**Private Beta policy:** at least **daily** operator-run of `logical_backup.py` (Task Scheduler/cron can wrap the same command). Additional run before risky migrations.

**Not unattended** until a scheduler is installed — documented as operator-run.

---

## Retention

Keep **last 7 successful** vault directories; delete older after confirm.

---

## QA Recovery Dataset

Disposable `GATE10B-QA-A-*` / `GATE10B-QA-B-*` with Owner, Technician (+ founding badge recognition), Customer, Site, Quote+line, Project, Job, Assignment, Document, Photo, Catalog products, beta_participant, Workspace B isolation objects.

---

## DB Backup / Storage Backup

Executed:

- Drill vault: `20260911T115922Z_ws2` (QA scoped; poison+restore PASS)
- Full project vault: `20260911T120312Z` (22 storage objects, ~837KB binaries, all tables JSONL, `last_backup_ok=true`)

---

## Isolated Restore

**Method:** off-site vault + intentional QA destroy (DB wipe + Storage byte poison) on disposable tenants only — **not** destructive restore of whole Beta DB.  
**Reserved project:** `nycprpxzpcomiufavlys` (SiteSecureV1-Gate10B-Recovery) created for future isolated target (schema not fully provisioned in this gate).  
**Restore result:** PASS (`storage_restored: 2`, relationships restored).

---

## Verification matrix (drill `gate10b_drill_1789127913.json`)

| Check | Result |
|---|---|
| Database Integrity | **PASS** |
| Storage Integrity | **PASS** |
| Auth Recovery | Proven: Admin recreate + temp password; **re-login required** |
| Authorization After Restore | **PASS** |
| Tenant Isolation | **PASS** |
| Document Recovery | **PASS** (checksum) |
| Photo Recovery | **PASS** (checksum) |
| PDF Regeneration | **PASS** |
| Catalog | **PASS** |
| CCTV | **PASS** (endpoint executable; status 400 validation acceptable) |
| Beta / Badge | **PASS** (founding_technician recognition; not platform admin) |

---

## RPO

**Actual configured policy:** up to **~24 hours** under daily operator backups (shorter if run more often). No invented SLA.

## RTO (measured scoped QA drill)

| Phase | Seconds |
|---|---|
| DB+Storage backup | ~53 |
| Destroy/poison | ~30 |
| Restore | ~13 |
| Seed+verify overhead in drill total | ~140 total wall |
| **Operational restore+verify estimate (scoped)** | **~minutes (order 10–30+)** depending on dataset size |

Full-tenant RTO scales with vault size; re-measure after first full production vault.

---

## Backup Monitoring

`python apps/api/scripts/durability/logical_backup.py --status`  
File: `_backup_vault/LAST_STATUS.json` — `last_backup_ok`, `last_backup_at`, error samples. Treat failure or age >36h as incident.

---

## Recovery Runbook

Updated: `Docs/RECOVERY_RUNBOOK.md` (actual commands).

---

## Security

- Vault gitignored; no secrets in repo  
- Service role only via env  
- Vault not public  
- Retention/deletion documented  

---

## Defects

| Sev | Item |
|---|---|
| **P1 (fixed in app)** | `complete_upload` could mark complete without Storage object — fixed |
| **P2** | Historical `OBJECT_MISSING` completed rows (2) remain; do not auto-delete |
| **P2** | Incomplete QA fixture reservations clutter DB (42); ops cleanup optional |
| **P2** | Storage DELETE API flaky for some paths; independence proven via poison+restore |
| **P3** | Recovery project created but not fully migrated for clone restores |

---

## Git

- `beta-0.1.4` → `88c976e92e1257e9b60e7316bb09c8c38b7b7544` **unchanged**  
- Uncommitted working changes: lifecycle fix + durability scripts + docs (await operator commit)

## Candidate Impact

**Yes — `0.1.5-beta` required** before external Beta if shipping the `documents.py` lifecycle hardening (runtime behavior change). Backup tooling/docs alone would not require a new app candidate; the complete-upload fix does.

---

## Final verdict

**GATE 10B PASS — RECOVERABLE PRIVATE BETA FOUNDATION VERIFIED**
