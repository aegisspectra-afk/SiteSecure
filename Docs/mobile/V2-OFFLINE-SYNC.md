# V2 Offline Sync

**Status:** Field reliability architecture for `apps/mobile`  
**API:** `POST /api/v1/sync`  
**Principle:** Never silently overwrite conflicting data.

Technicians work in basements, rooftops, industrial sites, and weak-coverage areas. Critical workflows must continue.

---

## 1. Shape

```
Mobile UI
  → Local SQLite (cache + outbox)
  → Sync worker (connectivity + retry)
  → FastAPI /api/v1/sync
  → PostgreSQL (RLS + business rules)
  → Ack / conflict / error
  → Local apply
```

Web is online-first. Quote autosave retries are **not** this protocol.

---

## 2. What is available offline

Cached (assigned only):

- Jobs for the current user (today + open window, e.g. 7 days)
- Customers / sites / systems / equipment for those jobs
- Checklist templates already attached to the job
- Draft notes, completion fields
- Queued photos, documents, signatures (local files)

Not cached by default: full catalog, other technicians’ jobs, billing, unassigned CRM.

---

## 3. Local schema (logical)

**Entities:** `cached_records (entity_type, id, workspace_id, json, updated_at_server, updated_at_local)`  
**Outbox:** `outbox (id, idempotency_key, op, entity_type, entity_id, payload, attachments, status, attempts, last_error, created_at)`  
**Conflicts:** `conflicts (id, entity_type, entity_id, local_payload, server_payload, detected_at)`  
**Files:** `file_queue (id, local_uri, document_id, status)`

`status` on outbox: `pending`, `inflight`, `failed`, `done`.

---

## 4. Idempotency

Every mutation gets a UUID `idempotency_key` at creation time on device (survives retries).

Server stores keys per workspace. Replays return the original result.  
This is how we do not duplicate jobs, notes, or completions.

---

## 5. Sync protocol

### Pull

`POST /sync/pull`

```json
{
  "workspace_id": "...",
  "device_id": "...",
  "cursors": { "jobs": "<ts>", "sites": "<ts>" }
}
```

Response: changed records the user may see (RLS + assigned), deleted ids, new cursors.

### Push

`POST /sync/push`

```json
{
  "workspace_id": "...",
  "mutations": [
    {
      "idempotency_key": "...",
      "op": "job.complete",
      "entity_type": "job",
      "entity_id": "...",
      "base_updated_at": "2026-08-14T08:00:00Z",
      "payload": {}
    }
  ]
}
```

Each mutation result: `applied` | `conflict` | `rejected` (authz/validation) | `retry`.

Files upload **before** the mutation that references them, or the mutation stays `pending` until `document.complete` succeeds.

---

## 6. Conflict detection

Compare `base_updated_at` (the server `updated_at` the device last saw) to current server `updated_at`.

If different → `conflict`. Do not apply.

**Do not last-write-win.**

---

## 7. Conflict resolution (product)

| Domain | Policy |
|--------|--------|
| Job checklist item checks | Merge by item id (union of completed items; never uncheck remotely completed without prompt) |
| Job completion | If server already `completed`, reject local complete; show “כבר נסגר” |
| Notes | Append-only: local note is a new row, not an edit of the same text blob when possible |
| Equipment create | Apply if serial not duplicate; else conflict |
| Customer phone edit | Prompt: keep mine / keep server / edit |
| Photos | Always add; never replace another photo |

Unresolved conflicts sit in a **Conflicts** screen on the job (and a badge on Today). Managers are not auto-notified unless `SYNC_FAILED` after N attempts.

---

## 8. Retry

- Exponential backoff with jitter
- Cap attempts; then `failed` + `SYNC_FAILED` notification to the user
- Network errors: retry. 401: re-auth. 403: fail permanently for that op. 409 conflict: stop and surface. 5xx: retry.

---

## 9. Ordering

Per entity, apply outbox FIFO.  
Do not complete a job before its photo uploads if completion requires photos (business rule).  
Independent entities (two jobs) may upload in parallel.

---

## 10. Security

- Pull only returns authorized rows (same as GET)
- Push runs `authorize()` per mutation
- Device cannot expand assignment scope by writing `workspace_id`
- Cache encrypted/sandbox; wipe on logout

---

## 11. Tests

1. Complete job offline twice (retry) → one completion  
2. Complete job offline while manager already completed → conflict, no overwrite  
3. Photo + complete with flaky network → no orphan completion without photo when required  
4. Workspace switch → empty cache  
5. User A never receives User B jobs in pull
