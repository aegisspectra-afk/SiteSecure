# API REFERENCE — SITE SECURE

**Generated from static decorator scan of** `apps/api/app/routers/*.py` **on 2026-10-02.**

**Total endpoints found:** 204

**Mounted in** `main.py`**:** 176

**Present but NOT mounted:** 28

OpenAPI at runtime: `/api/openapi.json` (when API running) — **NOT fetched live in this audit.**

Auth: most workspace routes require Bearer JWT + membership; health and public quote token routes are exceptions. Exact dependencies are per-handler.

## Endpoint table

| Wired | Method | Path | Source |
|-------|--------|------|--------|
| yes | GET | `/api/v1/admin/summary` | `apps/api/app/routers/admin.py:137` |
| yes | GET | `/api/v1/admin/organizations` | `apps/api/app/routers/admin.py:441` |
| yes | PATCH | `/api/v1/admin/organizations/{workspace_id}` | `apps/api/app/routers/admin.py:475` |
| yes | GET | `/api/v1/admin/users` | `apps/api/app/routers/admin.py:518` |
| yes | POST | `/api/v1/admin/users/{user_id}/archive` | `apps/api/app/routers/admin.py:614` |
| yes | POST | `/api/v1/admin/users/{user_id}/restore` | `apps/api/app/routers/admin.py:632` |
| yes | PATCH | `/api/v1/admin/users/{user_id}/badges` | `apps/api/app/routers/admin.py:648` |
| yes | GET | `/api/v1/admin/beta/participants` | `apps/api/app/routers/admin.py:704` |
| yes | PATCH | `/api/v1/admin/users/{user_id}/beta` | `apps/api/app/routers/admin.py:771` |
| yes | GET | `/api/v1/admin/audit` | `apps/api/app/routers/admin.py:875` |
| yes | GET | `/api/v1/admin/feedback` | `apps/api/app/routers/admin.py:957` |
| yes | PATCH | `/api/v1/admin/feedback/{report_id}` | `apps/api/app/routers/admin.py:977` |
| yes | GET | `/api/v1/admin/feature-flags` | `apps/api/app/routers/admin.py:998` |
| yes | PATCH | `/api/v1/admin/feature-flags/{flag_id}` | `apps/api/app/routers/admin.py:1012` |
| yes | POST | `/api/v1/admin/organizations` | `apps/api/app/routers/admin.py:1094` |
| yes | GET | `/api/v1/admin/memberships` | `apps/api/app/routers/admin.py:1157` |
| yes | GET | `/api/v1/admin/invitations` | `apps/api/app/routers/admin.py:1192` |
| yes | POST | `/api/v1/admin/invitations` | `apps/api/app/routers/admin.py:1219` |
| yes | POST | `/api/v1/admin/invitations/{invitation_id}/revoke` | `apps/api/app/routers/admin.py:1325` |
| yes | POST | `/api/v1/admin/invitations/{invitation_id}/reissue` | `apps/api/app/routers/admin.py:1367` |
| yes | GET | `/api/v1/admin/archive` | `apps/api/app/routers/admin.py:1410` |
| yes | GET | `/api/v1/admin/archive/profiles/{profile_id}` | `apps/api/app/routers/admin.py:1525` |
| yes | POST | `/api/v1/admin/archive/profiles/{profile_id}/restore` | `apps/api/app/routers/admin.py:1567` |
| yes | GET | `/api/v1/auth/session` | `apps/api/app/routers/auth.py:57` |
| yes | PATCH | `/api/v1/me` | `apps/api/app/routers/auth.py:157` |
| yes | GET | `/api/v1/authz/catalog` | `apps/api/app/routers/auth.py:180` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/catalog/categories` | `apps/api/app/routers/catalog.py:226` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/catalog/products` | `apps/api/app/routers/catalog.py:253` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/catalog/products/{product_id}` | `apps/api/app/routers/catalog.py:313` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/catalog/products` | `apps/api/app/routers/catalog.py:336` |
| yes | PATCH | `/api/v1/workspaces/{workspace_id}/catalog/products/{product_id}` | `apps/api/app/routers/catalog.py:384` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/catalog/ensure-defaults` | `apps/api/app/routers/catalog.py:459` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/catalog/products/bulk-pricing` | `apps/api/app/routers/catalog.py:478` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/catalog/templates` | `apps/api/app/routers/catalog.py:561` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/catalog/import/targets` | `apps/api/app/routers/catalog_import.py:170` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/catalog/import/template` | `apps/api/app/routers/catalog_import.py:188` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/catalog/import/parse` | `apps/api/app/routers/catalog_import.py:206` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/catalog/import/preview` | `apps/api/app/routers/catalog_import.py:249` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/catalog/import/commit` | `apps/api/app/routers/catalog_import.py:292` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/cctv/recommend` | `apps/api/app/routers/cctv.py:118` |
| NO | GET | `/api/v1/workspaces/{workspace_id}/sites/{site_id}/asset-connections` | `apps/api/app/routers/connections.py:149` |
| NO | GET | `/api/v1/workspaces/{workspace_id}/equipment/{equipment_id}/asset-connections` | `apps/api/app/routers/connections.py:179` |
| NO | GET | `/api/v1/workspaces/{workspace_id}/sites/{site_id}/topology` | `apps/api/app/routers/connections.py:220` |
| NO | POST | `/api/v1/workspaces/{workspace_id}/asset-connections` | `apps/api/app/routers/connections.py:292` |
| NO | PATCH | `/api/v1/workspaces/{workspace_id}/asset-connections/{connection_id}` | `apps/api/app/routers/connections.py:349` |
| NO | DELETE | `/api/v1/workspaces/{workspace_id}/asset-connections/{connection_id}` | `apps/api/app/routers/connections.py:401` |
| NO | GET | `/api/v1/workspaces/{workspace_id}/customers/{customer_id}/portal` | `apps/api/app/routers/customer_portal.py:209` |
| NO | POST | `/api/v1/workspaces/{workspace_id}/customers/{customer_id}/portal` | `apps/api/app/routers/customer_portal.py:234` |
| NO | POST | `/api/v1/workspaces/{workspace_id}/customers/{customer_id}/portal/{access_id}/link` | `apps/api/app/routers/customer_portal.py:290` |
| NO | POST | `/api/v1/workspaces/{workspace_id}/customers/{customer_id}/portal/{access_id}/resend` | `apps/api/app/routers/customer_portal.py:312` |
| NO | POST | `/api/v1/workspaces/{workspace_id}/customers/{customer_id}/portal/{access_id}/revoke` | `apps/api/app/routers/customer_portal.py:367` |
| NO | GET | `/api/v1/portal/invites/peek` | `apps/api/app/routers/customer_portal.py:410` |
| NO | POST | `/api/v1/portal/invites/accept` | `apps/api/app/routers/customer_portal.py:446` |
| NO | GET | `/api/v1/portal/session` | `apps/api/app/routers/customer_portal.py:461` |
| NO | GET | `/api/v1/portal/access/{access_id}` | `apps/api/app/routers/customer_portal.py:492` |
| NO | POST | `/api/v1/portal/access/{access_id}/documents/{document_id}/url` | `apps/api/app/routers/customer_portal.py:504` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/customers` | `apps/api/app/routers/customers.py:113` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/customers` | `apps/api/app/routers/customers.py:153` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/customers/{customer_id}` | `apps/api/app/routers/customers.py:179` |
| yes | PATCH | `/api/v1/workspaces/{workspace_id}/customers/{customer_id}` | `apps/api/app/routers/customers.py:202` |
| yes | DELETE | `/api/v1/workspaces/{workspace_id}/customers/{customer_id}` | `apps/api/app/routers/customers.py:227` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/customers/{customer_id}/contacts` | `apps/api/app/routers/customers.py:254` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/customers/{customer_id}/contacts` | `apps/api/app/routers/customers.py:283` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/dashboard` | `apps/api/app/routers/dashboard.py:150` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/documents` | `apps/api/app/routers/documents.py:92` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/documents/uploads` | `apps/api/app/routers/documents.py:127` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/documents/{document_id}/complete` | `apps/api/app/routers/documents.py:179` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/documents/{document_id}/url` | `apps/api/app/routers/documents.py:283` |
| yes | GET | `/api/v1/feedback` | `apps/api/app/routers/feedback.py:60` |
| yes | POST | `/api/v1/feedback` | `apps/api/app/routers/feedback.py:79` |
| yes | GET | `/api/v1/feature-flags` | `apps/api/app/routers/feedback.py:118` |
| yes | GET | `/health` | `apps/api/app/routers/health.py:6` |
| yes | GET | `/api/v1/health` | `apps/api/app/routers/health.py:11` |
| NO | GET | `/api/v1/workspaces/{workspace_id}/sites/{site_id}/network-overview` | `apps/api/app/routers/ipam.py:203` |
| NO | GET | `/api/v1/workspaces/{workspace_id}/sites/{site_id}/vlans` | `apps/api/app/routers/ipam.py:265` |
| NO | POST | `/api/v1/workspaces/{workspace_id}/vlans` | `apps/api/app/routers/ipam.py:290` |
| NO | PATCH | `/api/v1/workspaces/{workspace_id}/vlans/{vlan_id}` | `apps/api/app/routers/ipam.py:313` |
| NO | GET | `/api/v1/workspaces/{workspace_id}/sites/{site_id}/networks` | `apps/api/app/routers/ipam.py:343` |
| NO | POST | `/api/v1/workspaces/{workspace_id}/networks` | `apps/api/app/routers/ipam.py:393` |
| NO | PATCH | `/api/v1/workspaces/{workspace_id}/networks/{network_id}` | `apps/api/app/routers/ipam.py:431` |
| NO | GET | `/api/v1/workspaces/{workspace_id}/sites/{site_id}/ip-addresses` | `apps/api/app/routers/ipam.py:542` |
| NO | GET | `/api/v1/workspaces/{workspace_id}/equipment/{equipment_id}/ip-addresses` | `apps/api/app/routers/ipam.py:591` |
| NO | POST | `/api/v1/workspaces/{workspace_id}/ip-addresses` | `apps/api/app/routers/ipam.py:631` |
| NO | PATCH | `/api/v1/workspaces/{workspace_id}/ip-addresses/{ip_id}` | `apps/api/app/routers/ipam.py:675` |
| NO | DELETE | `/api/v1/workspaces/{workspace_id}/ip-addresses/{ip_id}` | `apps/api/app/routers/ipam.py:740` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/jobs` | `apps/api/app/routers/jobs.py:249` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/jobs` | `apps/api/app/routers/jobs.py:314` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/jobs/{job_id}` | `apps/api/app/routers/jobs.py:383` |
| yes | PATCH | `/api/v1/workspaces/{workspace_id}/jobs/{job_id}` | `apps/api/app/routers/jobs.py:397` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/jobs/{job_id}/en-route` | `apps/api/app/routers/jobs.py:420` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/jobs/{job_id}/arrived` | `apps/api/app/routers/jobs.py:444` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/jobs/{job_id}/start` | `apps/api/app/routers/jobs.py:474` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/jobs/{job_id}/complete` | `apps/api/app/routers/jobs.py:503` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/jobs/{job_id}/assign` | `apps/api/app/routers/jobs.py:573` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/jobs/{job_id}/checklist` | `apps/api/app/routers/jobs.py:673` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/jobs/{job_id}/checklist` | `apps/api/app/routers/jobs.py:696` |
| yes | PATCH | `/api/v1/workspaces/{workspace_id}/jobs/{job_id}/checklist/{item_id}` | `apps/api/app/routers/jobs.py:720` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/leads` | `apps/api/app/routers/ops_modules.py:104` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/leads` | `apps/api/app/routers/ops_modules.py:151` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/leads/{lead_id}` | `apps/api/app/routers/ops_modules.py:169` |
| yes | PATCH | `/api/v1/workspaces/{workspace_id}/leads/{lead_id}` | `apps/api/app/routers/ops_modules.py:186` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/projects` | `apps/api/app/routers/ops_modules.py:330` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/projects` | `apps/api/app/routers/ops_modules.py:371` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/projects/from-quote` | `apps/api/app/routers/ops_modules.py:412` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/projects/{project_id}` | `apps/api/app/routers/ops_modules.py:475` |
| yes | PATCH | `/api/v1/workspaces/{workspace_id}/projects/{project_id}` | `apps/api/app/routers/ops_modules.py:496` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/service-calls` | `apps/api/app/routers/ops_modules.py:589` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/service-calls` | `apps/api/app/routers/ops_modules.py:624` |
| yes | PATCH | `/api/v1/workspaces/{workspace_id}/service-calls/{call_id}` | `apps/api/app/routers/ops_modules.py:652` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/service-calls/{call_id}` | `apps/api/app/routers/ops_modules.py:688` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/service-calls/{call_id}/create-job` | `apps/api/app/routers/ops_modules.py:735` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/warranties` | `apps/api/app/routers/ops_modules.py:843` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/warranties` | `apps/api/app/routers/ops_modules.py:877` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/tasks` | `apps/api/app/routers/ops_modules.py:935` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/tasks` | `apps/api/app/routers/ops_modules.py:969` |
| yes | PATCH | `/api/v1/workspaces/{workspace_id}/tasks/{task_id}` | `apps/api/app/routers/ops_modules.py:986` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/knowledge` | `apps/api/app/routers/ops_modules.py:1030` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/knowledge` | `apps/api/app/routers/ops_modules.py:1061` |
| yes | PATCH | `/api/v1/workspaces/{workspace_id}/knowledge/{article_id}` | `apps/api/app/routers/ops_modules.py:1074` |
| yes | GET | `/api/v1/public/quotes/{token}` | `apps/api/app/routers/public_quotes.py:226` |
| yes | GET | `/api/v1/public/quotes/{token}/pdf` | `apps/api/app/routers/public_quotes.py:234` |
| yes | POST | `/api/v1/public/quotes/{token}/approve` | `apps/api/app/routers/public_quotes.py:256` |
| yes | POST | `/api/v1/public/quotes/{token}/reject` | `apps/api/app/routers/public_quotes.py:348` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/sections` | `apps/api/app/routers/quote_cpq.py:162` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/sections` | `apps/api/app/routers/quote_cpq.py:175` |
| yes | PATCH | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/sections/{section_id}` | `apps/api/app/routers/quote_cpq.py:208` |
| yes | DELETE | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/sections/{section_id}` | `apps/api/app/routers/quote_cpq.py:241` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/sections/{section_id}/duplicate` | `apps/api/app/routers/quote_cpq.py:278` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/catalog/packages` | `apps/api/app/routers/quote_cpq.py:350` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/catalog/packages` | `apps/api/app/routers/quote_cpq.py:372` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/apply-package` | `apps/api/app/routers/quote_cpq.py:416` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/save-as-package` | `apps/api/app/routers/quote_cpq.py:492` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/save-as-template` | `apps/api/app/routers/quote_cpq.py:530` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/margin-override` | `apps/api/app/routers/quote_cpq.py:607` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/versions` | `apps/api/app/routers/quote_cpq.py:652` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/versions/compare` | `apps/api/app/routers/quote_cpq.py:676` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/events` | `apps/api/app/routers/quote_cpq.py:757` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/events` | `apps/api/app/routers/quote_cpq.py:793` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/document` | `apps/api/app/routers/quote_cpq.py:819` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/pdf` | `apps/api/app/routers/quote_cpq.py:834` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/quotes` | `apps/api/app/routers/quotes.py:1031` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/quotes` | `apps/api/app/routers/quotes.py:1146` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}` | `apps/api/app/routers/quotes.py:1197` |
| yes | PATCH | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}` | `apps/api/app/routers/quotes.py:1212` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/items` | `apps/api/app/routers/quotes.py:1247` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/apply-template` | `apps/api/app/routers/quotes.py:1273` |
| yes | PATCH | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/items/{item_id}` | `apps/api/app/routers/quotes.py:1366` |
| yes | DELETE | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/items/{item_id}` | `apps/api/app/routers/quotes.py:1451` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/recalculate` | `apps/api/app/routers/quotes.py:1482` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/send` | `apps/api/app/routers/quotes.py:1497` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/revise` | `apps/api/app/routers/quotes.py:1590` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/share` | `apps/api/app/routers/quotes.py:1657` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/revoke-link` | `apps/api/app/routers/quotes.py:1731` |
| yes | DELETE | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}` | `apps/api/app/routers/quotes.py:1763` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/duplicate` | `apps/api/app/routers/quotes.py:1809` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/preview` | `apps/api/app/routers/quotes.py:1892` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/search` | `apps/api/app/routers/search.py:52` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/sites` | `apps/api/app/routers/sites.py:82` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/sites` | `apps/api/app/routers/sites.py:125` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/sites/{site_id}` | `apps/api/app/routers/sites.py:160` |
| yes | PATCH | `/api/v1/workspaces/{workspace_id}/sites/{site_id}` | `apps/api/app/routers/sites.py:179` |
| yes | DELETE | `/api/v1/workspaces/{workspace_id}/sites/{site_id}` | `apps/api/app/routers/sites.py:219` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/system-designs` | `apps/api/app/routers/system_designs.py:298` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/system-designs` | `apps/api/app/routers/system_designs.py:327` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/system-designs/{design_id}` | `apps/api/app/routers/system_designs.py:369` |
| yes | PATCH | `/api/v1/workspaces/{workspace_id}/system-designs/{design_id}` | `apps/api/app/routers/system_designs.py:384` |
| yes | DELETE | `/api/v1/workspaces/{workspace_id}/system-designs/{design_id}` | `apps/api/app/routers/system_designs.py:477` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/system-designs/{design_id}/apply` | `apps/api/app/routers/system_designs.py:503` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/systems` | `apps/api/app/routers/systems.py:145` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/systems` | `apps/api/app/routers/systems.py:170` |
| yes | PATCH | `/api/v1/workspaces/{workspace_id}/systems/{system_id}` | `apps/api/app/routers/systems.py:197` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/equipment` | `apps/api/app/routers/systems.py:230` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/equipment` | `apps/api/app/routers/systems.py:255` |
| yes | PATCH | `/api/v1/workspaces/{workspace_id}/equipment/{equipment_id}` | `apps/api/app/routers/systems.py:282` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/members` | `apps/api/app/routers/team.py:120` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/usage` | `apps/api/app/routers/team.py:165` |
| yes | PATCH | `/api/v1/workspaces/{workspace_id}/members/{member_id}` | `apps/api/app/routers/team.py:217` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/audit` | `apps/api/app/routers/team.py:324` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/security` | `apps/api/app/routers/team.py:357` |
| yes | POST | `/api/v1/telemetry/client-error` | `apps/api/app/routers/telemetry.py:27` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/settings` | `apps/api/app/routers/workspace_settings.py:82` |
| yes | PATCH | `/api/v1/workspaces/{workspace_id}/settings` | `apps/api/app/routers/workspace_settings.py:102` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/company-profile` | `apps/api/app/routers/workspace_settings.py:208` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/company-profile/logo-upload` | `apps/api/app/routers/workspace_settings.py:238` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/company-profile/logo-complete` | `apps/api/app/routers/workspace_settings.py:279` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/company-profile/document-preview` | `apps/api/app/routers/workspace_settings.py:333` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/roles` | `apps/api/app/routers/workspace_settings.py:470` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/roles` | `apps/api/app/routers/workspace_settings.py:487` |
| yes | PATCH | `/api/v1/workspaces/{workspace_id}/roles/{role_id}` | `apps/api/app/routers/workspace_settings.py:534` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/pdf-templates` | `apps/api/app/routers/workspace_settings.py:628` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/pdf-templates` | `apps/api/app/routers/workspace_settings.py:646` |
| yes | PATCH | `/api/v1/workspaces/{workspace_id}/pdf-templates/{template_id}` | `apps/api/app/routers/workspace_settings.py:679` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/pdf-templates/{template_id}/duplicate` | `apps/api/app/routers/workspace_settings.py:731` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/pdf-templates/{template_id}/preview` | `apps/api/app/routers/workspace_settings.py:771` |
| yes | POST | `/api/v1/workspaces` | `apps/api/app/routers/workspaces.py:160` |
| yes | GET | `/api/v1/workspaces/{workspace_id}` | `apps/api/app/routers/workspaces.py:205` |
| yes | PATCH | `/api/v1/workspaces/{workspace_id}` | `apps/api/app/routers/workspaces.py:219` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/invitations` | `apps/api/app/routers/workspaces.py:244` |
| yes | GET | `/api/v1/workspaces/{workspace_id}/invitations` | `apps/api/app/routers/workspaces.py:329` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/invitations/{invitation_id}/revoke` | `apps/api/app/routers/workspaces.py:350` |
| yes | POST | `/api/v1/workspaces/{workspace_id}/invitations/{invitation_id}/reissue` | `apps/api/app/routers/workspaces.py:399` |
| yes | GET | `/api/v1/invitations/public-peek` | `apps/api/app/routers/workspaces.py:468` |
| yes | GET | `/api/v1/invitations/peek` | `apps/api/app/routers/workspaces.py:496` |
| yes | POST | `/api/v1/invitations/accept` | `apps/api/app/routers/workspaces.py:538` |

## Unwired modules (AUDIT-001)

- `connections` — asset topology
- `customer_portal` — portal admin + accept/session
- `ipam` — VLANs/networks/IPs

Unit tests may call router functions directly; that does **not** prove HTTP mount.

### Verification status

Wired=yes → IMPLEMENTED — NOT FULLY VERIFIED (runtime). Wired=NO → BACKEND ONLY / NOT MOUNTED.