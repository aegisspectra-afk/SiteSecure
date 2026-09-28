# INF-1D ASSET LIFECYCLE REPORT

**Date:** 2026-09-28  
**Status:** Complete. Stopped. No Monitoring / Discovery / Credentials.

---

## 1. Files changed

| Area | Files |
|---|---|
| Migrations | `20260928110328_asset_lifecycle_inf1d_enum.sql`, `20260928110329_asset_lifecycle_inf1d_service_docs.sql` |
| API | `documents.py` (equipment site scope), `ops_modules.py` (service `equipment_id`), `systems.py` (audit emit + lifecycle activity), `connections.py` (audit emit) |
| Client | `packages/api-client/src/index.ts`, `packages/types/src/database.ts` |
| UI | `AssetDocumentsSection.tsx`, `AssetLifecycleSections.tsx`, `AssetDetail.tsx`, `he.ts` |
| Tests | `test_asset_lifecycle_inf1d.py`, `site-asset-lifecycle-inf1d.test.tsx` (+ INF-1A/B/C mocks) |
| QA | `Docs/inf1d-asset-lifecycle-qa/*` |

---

## 2. Existing document model audited

Reusable `public.documents` polymorphic attachments:

- `entity_type` / `entity_id`, `kind`, `original_filename`, `created_by`, `created_at`
- Upload pipeline already live (intent → storage PUT → complete → signed URL)
- Site docs already on Site dossier Documents tab

**Gap closed:** enum lacked `equipment` → added.

---

## 3. Asset documents integration

Asset detail **מסמכים**:

- Lists `entity_type=equipment` docs
- Upload photo/file via existing pipeline (`documents.upload`)
- Open via signed URL
- Empty / upload states honest

---

## 4. Site documents integration

Existing Site **מסמכים** tab unchanged — site-only docs (`entity_type=site`). No second store; Asset docs stay on equipment entity.

---

## 5. Service model change

Additive nullable FK:

`service_calls.equipment_id → equipment.id ON DELETE SET NULL`

API:

- create/patch accept `equipment_id` (+ optional `system_id`)
- same-site validation
- list filters: `equipment_id`, `site_id`

No Service module redesign.

---

## 6. Asset service history

Asset section **היסטוריית שירות** from `listServiceCalls({ equipment_id })`:

- date, title, status, number
- no invented technician fields

QA: `CAM-001 — No video signal` / `SR-00001`.

---

## 7. Warranty integration

No model change. Asset warranty section now shows:

- status, number/link, type, start, end  
Empty state preserved.

---

## 8. Existing Activity model audited

| Store | Usable for Asset UI? |
|---|---|
| `audit_logs` + `write_audit` | Emit yes; SELECT RLS = privileged + `audit` feature |
| Dashboard activity | Quote/job only |
| `site_timeline_events` | No `equipment` event type; Site dossier does not read it |

---

## 9. Activity events implemented/deferred

**Implemented**

- Emit via existing `write_audit`: `equipment.created`, `equipment.updated` (status/serial/ip/mac/name/asset_code diffs), `connection.created|updated|deleted`
- Asset **פעילות** via `GET .../equipment/{id}/lifecycle-activity`: derived timeline from asset created + docs + service + connections + warranties; best-effort audit rows when RLS allows

**Deferred / blocker**

- Full keystroke-free event feed for all `systems.view` roles cannot rely solely on `audit_logs` SELECT (privileged-only). No second audit subsystem created.

---

## 10. Asset detail final structure

Progressive `<details>`:

1. General (open)  
2. Location (open)  
3. Network (open)  
4. Connections (collapsed)  
5. Lifecycle provenance (collapsed)  
6. Warranty (collapsed)  
7. Documents (collapsed)  
8. Service History (collapsed)  
9. Activity (collapsed)

---

## 11. Site dossier changes

No new decorative tabs. Existing Documents / Service / History remain the Site surfaces. Topology/Network untouched.

---

## 12. Authz/RLS

Reuse: `systems.*`, `documents.*`, `service.*`, `warranties.*`, site visibility.

Documents SELECT policy extended for `equipment` via `auth_site_visible(equipment.site_id)`. Upload resolves equipment → site for assigned scope.

---

## 13. Migration

Split additive migrations (enum must commit before policy use):

1. `document_entity_type += equipment`  
2. `service_calls.equipment_id` + indexes + documents SELECT recreate  

Applied on production Supabase.

---

## 14. Legacy compatibility

Assets with no docs/service/warranty/activity show empty states. Existing site docs, IPAM, connections, warranties unchanged.

---

## 15–19. Viewport results

| Size | Result |
|---|---|
| 1440 | Lifecycle sections usable; shell OK |
| 1032 | Docs/service/activity readable |
| 768 | Collapsible sections; bottom nav clear |
| 390 | Compact warranty/docs/service/activity; no overflow |
| 360 | Same; Bottom Nav clearance preserved |

Screenshots: `Docs/inf1d-asset-lifecycle-qa/`.

---

## 20. Dark / Light

Content surface light; dark shell/sidebar/bottom nav. Section contrast OK.

---

## 21. RTL

Hebrew RTL shell verified. LTR isolation on codes, filenames, timestamps.

---

## 22. Focused tests

| Suite | Result |
|---|---|
| `test_asset_lifecycle_inf1d.py` | pass |
| `test_connections_inf1c.py` | pass |
| `test_ipam_inf1b.py` | pass |
| `test_warranties.py` | pass |
| `test_equipment_asset_inf1.py` | pass |
| `site-asset-lifecycle-inf1d.test.tsx` | pass |
| INF-1A / INF-1B / INF-1C / SiteDossier web | pass |

---

## 23. Typecheck

`npm run web:typecheck` — pass.

---

## 24. Build

`npm run web:build` — pass.

---

## 25. Remaining lifecycle gaps

- Asset document category taxonomy beyond `kind` (datasheet/manual/…) not modeled
- Service UI create form does not yet expose Asset picker (API supports `equipment_id`; QA linked via DB/API)
- Privileged-only raw audit_logs not shown to all technicians
- No technician name on service rows (not in payload)
- No auto warranty generation

---

## 26. Infrastructure Foundation completion status

**INF-1A → INF-1D complete for Asset foundation:**

Asset identity/experience · Network/IPAM · Connections/Topology · Lifecycle (docs/service/warranty/activity)

Ready for later Monitoring / Discovery / Credentials as separate tracks.

**STOP. Do not start Monitoring / Discovery / Credentials.**
