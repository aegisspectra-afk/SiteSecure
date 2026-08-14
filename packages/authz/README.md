SITE SECURE V2 authorization catalog.

`catalog.json` is the source of grants for:

- Postgres seed (migrations `0008`)
- FastAPI `authorize()` (Phase 3+)
- Web/mobile UX hiding (not security)

If catalog.json and SQL grants disagree, update both in the same change. SQL already applied in production requires a new migration.
