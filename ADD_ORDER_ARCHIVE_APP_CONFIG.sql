-- Shared admin setting: days after delivery before orders move to History (UI).
-- Stored in existing app_config table (same pattern as global_target_period).
-- Safe to re-run.

-- Example row (optional seed — app defaults to 3 days if missing):
-- INSERT INTO app_config (id, "clientId", "apiKey", updated_at)
-- VALUES (
--   'order_archive_retention',
--   '{"retentionDays":3}',
--   '{"retentionDays":3}',
--   NOW()
-- )
-- ON CONFLICT (id) DO NOTHING;

SELECT id, "clientId", updated_at
FROM app_config
WHERE id = 'order_archive_retention';
