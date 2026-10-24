# GLOSSARY — SITE SECURE

Terms as used in **this codebase** (not aspirational product marketing).

| Term | Meaning in code |
|------|-----------------|
| Workspace | Tenant organization (`workspaces` table). Primary isolation key `workspace_id`. |
| Tenant | Same as workspace in V2 schema (not a separate table named tenants). |
| User / Profile | Supabase Auth user; app profile in `profiles`. |
| Membership | `workspace_memberships` row linking user↔workspace with `role_key`. |
| Role | Catalog/system role key: owner, administrator, manager, sales, technician, viewer (+ legacy founding_technician references). |
| Permission | Fine-grained action string e.g. `quotes.edit` (`packages/authz/catalog.json`). |
| Feature | Plan-gated module flag e.g. `quotes`, `inventory` (catalog `features` + DB plan_features). |
| Capability | V3 registry concept (`capabilities` / `plan_capabilities` migrations) — parallel to features. |
| Entitlement | Effective set of features/limits for a workspace from RPC + overrides + subscription status. |
| Plan | `solo` / `business` / `enterprise` keys (UI labels Free/Pro/Enterprise). |
| Subscription | `subscriptions` row; status influences authorize. |
| Authorize | Server decision function combining role grants + entitlements + scope. |
| Scope | Data visibility: all / owned / assigned / team. |
| Quote | Commercial offer entity; CPQ builder edits lines/sections/packages. |
| Quote version | Snapshot/versioning for revisions & public links. |
| System design | Durable CCTV/system design attached to quotes (`system_designs`). |
| Catalog / Product | Sellable items in `products` / categories; import pipeline exists. |
| Package | Reusable quote package (`quote_packages`). |
| Customer | CRM account (`customers`). |
| Lead | Pre-sales opportunity (`leads`). |
| Site | Physical location dossier (`sites`). |
| Asset / Equipment | Installed/tracked device (`equipment`). |
| IPAM | Site VLANs/networks/IP addresses (router currently unwired). |
| Project | Delivery project; may pin source quote version. |
| Job / Field job | Field work unit with lifecycle transitions. |
| Service call | After-sales service ticket (`service_calls`). |
| Warranty | Warranty record (`warranties`). |
| Document | Stored file metadata + Storage object. |
| Platform admin | User with `profiles.is_platform_admin`; `/admin` console. |
| Customer portal | External customer access model (tables + unwired API + FE routes). |
| Public quote | Tokenized customer-facing quote page (`/q/...`). |
| Seat buckets | Operator vs field seat quotas in catalog. |
| RTL | Right-to-left Hebrew UI default for app chrome. |
