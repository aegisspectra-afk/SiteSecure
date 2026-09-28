# SaaS Phase 3 — Storage Quota

**Status:** PARTIAL foundation EXISTS · hardening NOT STARTED this pass

## Already exists

- Free 15 GiB / Pro 100 GiB / Enterprise unlimited(0) in catalogue  
- `documents.reserved_bytes` + `enforce_document_storage_quota` trigger  
- API `evaluate_storage_limit`  
- Usage meter `storage_gb` (bytes)

## Required before claiming complete

1. Inventory every upload path (documents, knowledge, avatars, PDF studio, site files, …)  
2. Prove no browser direct-to-Storage bypass  
3. Reservation expiry + reconciliation vs Storage metadata  
4. Document PDF/snapshot counting policy without breaking immutability  
5. Over-quota: readable existing files, block new uploads only  
6. Focused concurrency + delete reclaim tests

Do not rebuild accounting — extend `documents` reservation path.
