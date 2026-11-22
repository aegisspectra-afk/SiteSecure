-- Rollback is informational only: PostgreSQL cannot remove enum values safely in-place.
-- To undo locally: restore from backup or recreate the enum without 'awaiting_dispatch'.

SELECT 1;