# Private Beta — Daily Backup Operator Checklist

Operator-run (not automatic). Org is on Free plan; durability relies on the logical vault.

## Every Beta day (before technicians work)

1. Check status:
   ```bash
   python apps/api/scripts/durability/logical_backup.py --status
   ```
2. If `last_backup_ok` is false **or** backup age > ~24h → run backup:
   ```bash
   python apps/api/scripts/durability/logical_backup.py
   ```
3. Confirm exit code 0 and `LAST_STATUS.json`:
   - `last_backup_ok: true`
   - `storage_object_count` > 0 when Storage has objects
   - `error_count: 0`
4. Confirm vault epoch folder has `MANIFEST.json` + `db/` + `storage/`
5. Retention: keep last **7** successful epochs; delete older only after confirm

## Weekly

- Spot-check one QA document/photo restore using scoped restore (see `Docs/RECOVERY_RUNBOOK.md`)
- Run `storage_reconcile.py` and review new `OBJECT_MISSING` (should stay at known historical set)

## Escalation

- Backup failure → treat as P1 ops incident before inviting more field activity
- Do not claim automated backups while this checklist is the control
