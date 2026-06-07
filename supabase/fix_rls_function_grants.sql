-- ============================================================
-- Restore RLS helper EXECUTE for authenticated role
-- Run if Rate Master / app_config saves fail after fix_linter_security.sql
-- (Symptom: "Cloud sync failed", console shows row-level security / 42501)
-- ============================================================

GRANT EXECUTE ON FUNCTION public.is_org_member(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(text) TO authenticated;

SELECT 'RLS helper grants restored for authenticated.' AS status;
