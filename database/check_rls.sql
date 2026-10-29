-- ============================================================================
-- database/check_rls.sql
-- Read-only RLS audit queries for the public schema.
--
-- Run these in the Supabase SQL Editor (or psql). They do not change anything.
-- "RLS enabled but no policies" is NOT the same as "protected": for a normal
-- authenticated/anon role it means every row is denied. Tables with RLS
-- disabled are the dangerous ones because table grants apply to every row.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Every public table with its RLS flags and policy count.
--    relrowsecurity      = RLS is enabled
--    relforcerowsecurity = RLS is forced even for the table owner
--    policy_count        = number of policies attached to the table
--
--    Ordered with unprotected tables first:
--      1) RLS disabled
--      2) RLS enabled but not forced
--      3) RLS enabled + forced
--    Within each group, tables with fewer policies sort first.
-- ----------------------------------------------------------------------------
SELECT
    c.relname                                        AS table_name,
    c.relrowsecurity                                 AS rls_enabled,
    c.relforcerowsecurity                            AS rls_forced,
    count(p.policyname)                              AS policy_count,
    CASE
        WHEN NOT c.relrowsecurity
            THEN 'UNPROTECTED: RLS disabled'
        WHEN count(p.policyname) = 0
            THEN 'LOCKED DOWN: RLS enabled, no policies (deny all)'
        WHEN NOT c.relforcerowsecurity
            THEN 'PARTIAL: RLS enabled, not forced'
        ELSE 'OK: RLS enabled and forced'
    END                                              AS rls_status
FROM pg_class c
JOIN pg_namespace n
  ON n.oid = c.relnamespace
LEFT JOIN pg_policies p
  ON p.schemaname = n.nspname
 AND p.tablename = c.relname
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')       -- ordinary and partitioned tables
GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity
ORDER BY
    c.relrowsecurity ASC,
    c.relforcerowsecurity ASC,
    policy_count ASC,
    c.relname ASC;


-- ----------------------------------------------------------------------------
-- 2. Strict check: public tables with RLS completely disabled.
--    Any row returned here is directly reachable by any role that has table
--    grants (for example anon/authenticated through the Supabase API).
--    A zero-row result is the required state.
-- ----------------------------------------------------------------------------
SELECT
    c.relname       AS table_name,
    c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n
  ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND c.relrowsecurity = false
ORDER BY c.relname;


-- ----------------------------------------------------------------------------
-- 3. Public tables with RLS enabled but no policies.
--    This is fail-closed for non-bypass roles: with zero policies they can see
--    and modify no rows. It usually means a table was forgotten during policy
--    authoring, or a policy drop left the table locked down.
-- ----------------------------------------------------------------------------
SELECT
    c.relname             AS table_name,
    c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n
  ON n.oid = c.relnamespace
LEFT JOIN pg_policies p
  ON p.schemaname = n.nspname
 AND p.tablename = c.relname
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND c.relrowsecurity = true
GROUP BY c.relname, c.relforcerowsecurity
HAVING count(p.policyname) = 0
ORDER BY c.relname;


-- ----------------------------------------------------------------------------
-- 4. Full policy inventory for auditing.
--    roles       = roles the policy applies to (PUBLIC / anon / authenticated ...)
--    cmd         = ALL, SELECT, INSERT, UPDATE or DELETE
--    permissive  = PERMISSIVE policies are OR'ed together; RESTRICTIVE are AND'ed
--    qual        = USING expression (row visibility / which rows may be affected)
--    with_check  = WITH CHECK expression (rows allowed to be written)
--    NULL qual/with_check means the command is unrestricted by that clause.
-- ----------------------------------------------------------------------------
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
