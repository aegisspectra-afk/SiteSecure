SITE SECURE V2 authorization catalog.

`catalog.json` is the source of grants, plans, feature entitlements, resource limits, seat buckets, and assignable invite roles.

Used by:

- Postgres seed (migrations `0008`)
- FastAPI `authorize()` and seat-limit checks
- Web/mobile UX hiding (not security)

TypeScript helpers: `@site-secure/authz` (`defaultPlanKey`, `assignableInviteRoles`, `seatUsage`, …).

If catalog.json and SQL grants disagree, update both in the same change. SQL already applied in production requires a new migration. Do not hardcode plan caps in components.
