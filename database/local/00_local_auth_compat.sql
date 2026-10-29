-- ============================================================================
-- database/local/00_local_auth_compat.sql
--
-- Minimal Supabase Auth compatibility layer for the local PostgreSQL container.
-- It lets database/rls_policies.sql run unchanged on a plain postgres:17 image:
--   * creates the anon / authenticated / service_role roles used by policies;
--   * creates the auth schema and auth.jwt()/auth.uid()/auth.email() helpers
--     (they read the standard `request.jwt.claims` setting);
--   * creates public.auth_user for self-hosted password authentication.
--
-- The FastAPI backend connects as the postgres superuser, so it bypasses RLS.
-- Only the backend reads password hashes.
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN BYPASSRLS;
    END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $fn$
    SELECT COALESCE(
        NULLIF(current_setting('request.jwt.claims', true), ''),
        '{}'
    )::jsonb;
$fn$;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $fn$
    SELECT NULLIF(auth.jwt() ->> 'sub', '')::uuid;
$fn$;

CREATE OR REPLACE FUNCTION auth.email()
RETURNS text
LANGUAGE sql
STABLE
AS $fn$
    SELECT COALESCE(auth.jwt() ->> 'email', '');
$fn$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $fn$
    SELECT COALESCE(auth.jwt() ->> 'role', 'anon');
$fn$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.email() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Self-hosted credentials. The backend (postgres superuser) is the only
-- reader; the Supabase-style API roles get no access.
CREATE TABLE IF NOT EXISTS public.auth_user (
    email         VARCHAR(100) PRIMARY KEY,
    password_hash TEXT         NOT NULL,
    role          VARCHAR(10)  NOT NULL CHECK (role IN ('admin', 'doctor', 'patient')),
    user_id       VARCHAR(20),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE public.auth_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_user FORCE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.auth_user FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.auth_user TO service_role;

DROP POLICY IF EXISTS auth_user_service_role_all ON public.auth_user;
CREATE POLICY auth_user_service_role_all
    ON public.auth_user
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
