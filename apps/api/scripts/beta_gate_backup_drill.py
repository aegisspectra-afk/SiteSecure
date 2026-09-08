"""Beta Gate — Backup / Restore Drill helper.

This does NOT delete production data. It prints a verified checklist and can create
a disposable QA snapshot row count report for a given workspace.

Usage:
  set SS_SUPABASE via MCP/SQL separately for restore drill.
  python apps/api/scripts/beta_gate_backup_drill.py
"""

from __future__ import annotations

DRILL = """
BACKUP / RESTORE DRILL (Private Beta)

1. Create disposable QA workspace (name contains BETA-QA-RESTORE).
2. Seed: 1 Customer, 1 Site, 1 Quote (draft), 3 Products, 1 Job assignment.
3. Record counts:
   SELECT 'customers' t, count(*) FROM customers WHERE workspace_id = :ws
   UNION ALL SELECT 'sites', count(*) FROM sites WHERE workspace_id = :ws
   UNION ALL SELECT 'quotes', count(*) FROM quotes WHERE workspace_id = :ws AND deleted_at IS NULL
   UNION ALL SELECT 'products', count(*) FROM products WHERE workspace_id = :ws;
4. Trigger / confirm Supabase PITR or nightly backup exists for project.
5. In a SAFE fork/branch (never production destroy):
   - Soft-delete or suspend QA workspace
   - Restore from backup/PITR to a scratch project OR restore table dump
6. Re-run counts and compare entity IDs for Customer/Site/Quote/Product.
7. Document PASS/FAIL with timestamp + backup id in Docs/BETA_GATE.md

Never run destructive restore against the live production project used by technicians.
"""

if __name__ == "__main__":
    print(DRILL)
