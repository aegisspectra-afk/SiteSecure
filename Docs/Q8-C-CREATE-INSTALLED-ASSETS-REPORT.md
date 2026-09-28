# Q8-C CREATE INSTALLED ASSETS REPORT

**Date:** 2026-09-28  
**Status:** Complete. Stopped. No Network/IPAM / Service↔Asset / SiteDossier redesign.

---

## 1. Files changed

| File | Role |
|---|---|
| `apps/api/app/installed_assets_from_planned.py` | Category map, race-safe codes, qty expansion, idempotent create |
| `apps/api/app/routers/ops_modules.py` | Preview + create endpoints; planned-items enrichment (`assets_created` / `assets_remaining`) |
| `packages/api-client/src/index.ts` | Types + `previewCreateInstalledAssets` / `createInstalledAssets` |
| `apps/web/src/components/projects/CreateInstalledAssetsConfirm.tsx` | One-shot confirm modal |
| `apps/web/src/components/projects/ProjectPlannedScope.tsx` | Action + progress + result banner |
| `apps/web/src/components/projects/ProjectWorkspace.tsx` | Wire permissioned action + mutations |
| `apps/web/src/i18n/he.ts` | Hebrew copy |
| `apps/api/tests/test_create_installed_assets_q8c.py` | Focused Q8-C tests |
| `apps/web/tests/project-workspace.test.tsx` | UI action / confirm / authz visibility |

**Not touched:** quote snapshots, pricing, revisions, project scope import, warranty schema, service calls, Network/IPAM, Topology, AssetType engine, equipment status enum.

---

## 2. Endpoint

```
GET  /api/v1/workspaces/{ws}/projects/{project_id}/create-installed-assets/preview
POST /api/v1/workspaces/{ws}/projects/{project_id}/create-installed-assets
```

Also enriched:

```
GET /api/v1/workspaces/{ws}/projects/{project_id}/planned-items
→ assets_created, assets_remaining
```

Server owns eligibility, qty reconciliation, code generation, idempotency, and inserts (no frontend N×POST loop).

---

## 3. Eligibility rules

- `projects.view` (project visible in workspace)
- `systems.edit` on project `site_id`
- Project must have a `site_id`
- Site must belong to same workspace
- Only `project_planned_items` with `scope_kind=equipment` and `qty > 0`
- Labor / other skipped
- Optional / notes already excluded upstream by Q8-B import (unchanged)

---

## 4. Qty expansion behavior

Each planned equipment row with qty N expands into up to N individual `equipment` rows.

Example: `4 × Camera` → `CAM-001` … `CAM-004`.

---

## 5. Asset code generator

Site-local sequential codes:

| category | prefix |
|---|---|
| camera | CAM |
| nvr | NVR |
| dvr | DVR |
| switch | SW |
| panel | PNL |
| reader | RDR |
| lock | LCK |
| pir | PIR |
| power | PWR |
| cable | CBL |
| sim | SIM |
| other | EQ |

Format: `PREFIX-001`. Uniqueness: `UNIQUE(site_id, asset_code)`.

Mechanism: load existing prefix codes → propose next → insert → on unique violation (`23505` / conflict) reserve failed code and retry with next candidate (in-memory reserved set + unique constraint).

Same prefix on different sites is independent (verified in tests).

---

## 6. Category mapping

Deterministic text map from planned `sku/name/description/section/item_type/manufacturer/model` → `equipment_category`. Unknown physical hardware → `other`. Does not fail conversion for richer commercial taxonomy. Labor never mapped.

---

## 7. Field mapping

| equipment field | source |
|---|---|
| workspace_id | project workspace |
| site_id | project site |
| project_id | project id |
| project_planned_item_id | planned item id |
| product_id | planned product_id (nullable) |
| asset_code | generated |
| name | planned name/description (+ `(i/n)` when qty>1) |
| category | mapped |
| status | `installed` |
| manufacturer / model | planned snapshot if present |
| serial / ip / mac | null |
| installed_at | not set |
| system_id | not set |

---

## 8. Idempotency behavior

Count existing rows by `equipment.project_planned_item_id`.  
Create only `max(0, qty − existing)`.

Fully materialized → response message `הציוד כבר נוצר`, `requested=0`, `created=0`.

---

## 9. Partial retry behavior

Result shape always includes:

- `requested`
- `created`
- `already_existing`
- `failed`
- `fully_materialized`
- `lines[]` / `equipment_ids[]`

Retry after partial success only creates missing instances (no full re-expand).

---

## 10. Authz/RLS

- Reuses `systems.edit` + project visibility (`projects.view`)
- No new `assets.create` permission
- Inserts go through existing `equipment` table → existing site-scoped equipment RLS
- Cross-workspace site / planned provenance rejected

---

## 11. Project UI

- Controlled action **צור ציוד מותקן** on planned-scope section only when `systems.edit` + site + remaining equipment qty
- One confirmation modal with summary (equipment only; labor note)
- Success banner: **נוצרו N פריטי ציוד** + link to site
- Compact progress per equipment line: `N מתוכנן · M נוצר`

---

## 12. SiteDossier result

No redesign. Created rows are normal `equipment` list items; SiteDossier already shows `asset_code`, name, manufacturer/model, status, serial when present (INF-1).

---

## 13. Warranty compatibility

No auto-warranties. Created rows are valid `equipment` targets for `warranties.installed_equipment_id`. WarrantyStudio already loads site equipment via `listEquipment` — same list that returns the new Assets.

---

## 14. Live proof example

Workspace `50339413-11c7-4903-820c-7541fbd2a476`  
Project `b28fabc2-f782-4d98-80c7-a3a39d64795e` (“Q8-B scope proof2”)  
Site `0e854579-7656-45bc-8c91-08bd2e46489d`

| Step | Result |
|---|---|
| Preview | `total_to_create=4`, line Camera remaining 4 (labor excluded) |
| POST create | `requested=4`, `created=4`, codes `CAM-001`…`CAM-004`, status `installed` |
| Retry | `requested=0`, `created=0`, `already_existing=4`, message `הציוד כבר נוצר` |
| List equipment | 4 rows with provenance `project_planned_item_id`, null serial/ip/mac |

---

## 15. Focused tests

**API** (`test_create_installed_assets_q8c.py` + INF-1 + Q8-B): **40 passed** covering qty expand, labor skip, optional upstream, idempotent retry, partial 2/4, category map, site-local codes, cross-site prefix, collision retry, provenance, authz deny, cross-workspace reject, warranty list shape, progress counts.

**Web** (`project-workspace.test.tsx`): **17 passed** including action visibility, confirm+create, hide without `systems.edit`.

**Broader regressions** (warranty/equipment/project/q8/quote filters): **77 passed**.

---

## 16. Typecheck

`npm run web:typecheck` — pass.

---

## 17. Build

`npm run web:build` — pass.

---

## 18. Remaining gaps

- No DB advisory lock; race safety is unique-index + retry (sufficient for current volume)
- Category map is keyword-based (may classify ambiguous SKUs as `other`)
- Disposable live-proof owner membership left in QA workspace (non-destructive; can prune later)
- No automatic “open SiteDossier equipment tab” deep-link (link goes to site)

---

## 19. Readiness for Infrastructure Phase 1A / Network Phase 1B

**Q8-C is ready to close.** Installed Assets can now be materialized from Project planned equipment with provenance and site-local codes.

**Next (not started):**
- Infrastructure Phase 1A — richer Asset enrichment / site infra surfaces as planned
- Network Phase 1B — Network/IPAM (explicitly out of scope here)

**STOP.**
