-- ============================================================================
-- database/rls_policies.sql
--
-- Idempotent Row Level Security migration for the public schema.
--
-- HOW TO RUN
--   Paste the whole file into the Supabase SQL Editor while connected as the
--   `postgres` role, or run:
--       psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/rls_policies.sql
--
--   The migration runs in a single transaction. It is safe to re-run:
--     * helper functions use CREATE OR REPLACE;
--     * every existing policy on the ten application tables is dropped by a
--       DO block before the new policies are created;
--     * ENABLE/FORCE RLS and GRANT/REVOKE are idempotent.
--
-- SECURITY MODEL
--   * RLS is enabled AND forced on every application table. `authenticated`
--     is constrained by policies; `anon` loses table/sequence access.
--   * Helper functions are SECURITY DEFINER, owned by `postgres` (which has
--     BYPASSRLS) and have a fixed search_path. They are the only objects that
--     read the protected tables while evaluating policies. This prevents
--     recursive RLS evaluation (for example admin_user -> is_admin() ->
--     admin_user) and prevents search_path hijacking.
--   * `doctor` is not readable by patients because it contains email and
--     contact_number. Authenticated users read the safe, definer-owned
--     `v_doctor_directory` view instead.
--   * Doctors see patient/visit data only through an active consent (or a
--     consent for their hospital). Consent rows are visible hospital-wide.
--   * `audit_log` is append-only for normal users: only admin/doctor-owner
--     inserts exist, and no normal-user UPDATE/DELETE policy is created.
--   * service_role gets explicit permissive policies as a safety net even
--     though the role already has BYPASSRLS.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. SECURITY DEFINER helpers
--
-- These functions are owned by postgres and execute with owner privileges.
-- `SET search_path` stops a caller from shadowing public objects with objects
-- in a schema they control (pg_temp is deliberately last).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
    SELECT lower(auth.jwt() ->> 'email');
$fn$;

CREATE OR REPLACE FUNCTION public.current_patient_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
    SELECT p.patient_id
    FROM public.patient p
    WHERE lower(p.email) = public.current_user_email()
    LIMIT 1;
$fn$;

CREATE OR REPLACE FUNCTION public.current_doctor_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
    SELECT d.doctor_id
    FROM public.doctor d
    WHERE lower(d.email) = public.current_user_email()
    LIMIT 1;
$fn$;

CREATE OR REPLACE FUNCTION public.current_doctor_hospital_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
    SELECT d.hospital_id
    FROM public.doctor d
    WHERE d.doctor_id = public.current_doctor_id()
    LIMIT 1;
$fn$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
    SELECT EXISTS (
        SELECT 1
        FROM public.admin_user a
        WHERE lower(a.email) = public.current_user_email()
    );
$fn$;

-- Same consent semantics as the original function: an active, in-date consent
-- that names the doctor directly OR names the doctor's hospital.
CREATE OR REPLACE FUNCTION public.fn_has_consent(
    p_patient_id varchar,
    p_doctor_id varchar
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
    SELECT EXISTS (
        SELECT 1
        FROM public.consent c
        JOIN public.doctor d
          ON d.doctor_id = p_doctor_id
        WHERE c.patient_id = p_patient_id
          AND c.status = 'Active'
          AND c.start_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
          AND (c.end_date IS NULL
               OR c.end_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date)
          AND (c.doctor_id = p_doctor_id
               OR c.hospital_id = d.hospital_id)
    );
$fn$;

-- Make the owner explicit so SECURITY DEFINER always runs as the BYPASSRLS
-- postgres role. Revoke default PUBLIC execute rights and expose the helpers
-- only to the two Supabase API roles that need them.
ALTER FUNCTION public.current_user_email() OWNER TO postgres;
ALTER FUNCTION public.current_patient_id() OWNER TO postgres;
ALTER FUNCTION public.current_doctor_id() OWNER TO postgres;
ALTER FUNCTION public.current_doctor_hospital_id() OWNER TO postgres;
ALTER FUNCTION public.is_admin() OWNER TO postgres;
ALTER FUNCTION public.fn_has_consent(varchar, varchar) OWNER TO postgres;

REVOKE ALL PRIVILEGES ON FUNCTION public.current_user_email() FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON FUNCTION public.current_patient_id() FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON FUNCTION public.current_doctor_id() FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON FUNCTION public.current_doctor_hospital_id() FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON FUNCTION public.fn_has_consent(varchar, varchar) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.current_user_email() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_patient_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_doctor_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_doctor_hospital_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_has_consent(varchar, varchar) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Drop every existing policy on the ten application tables.
--
-- CREATE POLICY has no IF NOT EXISTS, so this makes the script re-runnable
-- while also removing stale/loose policies from earlier iterations.
-- ----------------------------------------------------------------------------
DO $do$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname
        FROM pg_catalog.pg_policies
        WHERE schemaname = 'public'
          AND tablename IN (
              'admin_user',
              'doctor',
              'hospital',
              'patient',
              'consent',
              'visit',
              'diagnosis',
              'prescription',
              'lab_test',
              'audit_log'
          )
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON %I.%I',
            pol.policyname,
            pol.schemaname,
            pol.tablename
        );
    END LOOP;
END;
$do$;

-- ----------------------------------------------------------------------------
-- 3. Strictly enable and force RLS on every application table.
-- FORCE means even the table owner is subject to policies; postgres still
-- bypasses via its BYPASSRLS attribute, which is what the helper functions
-- rely on.
-- ----------------------------------------------------------------------------

ALTER TABLE public.admin_user   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_user   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.doctor       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hospital     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital     FORCE ROW LEVEL SECURITY;
ALTER TABLE public.patient      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient      FORCE ROW LEVEL SECURITY;
ALTER TABLE public.consent      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent      FORCE ROW LEVEL SECURITY;
ALTER TABLE public.visit        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.diagnosis    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnosis    FORCE ROW LEVEL SECURITY;
ALTER TABLE public.prescription ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription FORCE ROW LEVEL SECURITY;
ALTER TABLE public.lab_test     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_test     FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log    FORCE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 4. Safe doctor directory and view hardening
-- ----------------------------------------------------------------------------

-- Deliberately NOT security_invoker: the view is owned by postgres and reads
-- the locked-down doctor/hospital tables with owner (BYPASSRLS) privileges.
-- It exposes only directory-safe columns, never doctor.email/contact_number.
CREATE OR REPLACE VIEW public.v_doctor_directory
WITH (security_invoker = false)
AS
SELECT
    d.doctor_id,
    d.hospital_id,
    d.full_name,
    d.specialization,
    d.license_number,
    h.hospital_name,
    h.address AS hospital_address
FROM public.doctor d
JOIN public.hospital h
  ON h.hospital_id = d.hospital_id;

ALTER VIEW public.v_doctor_directory OWNER TO postgres;
ALTER VIEW public.v_doctor_directory SET (security_invoker = false);

-- The duplicate-test view must respect the caller's RLS, not bypass it.
ALTER VIEW public.v_duplicate_lab_tests SET (security_invoker = true);

-- Remove anon access to every public table/view and sequence. Authenticated
-- grants are intentionally left in place; RLS constrains the rows.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- The directory view is read-only and authenticated-only.
REVOKE ALL PRIVILEGES ON TABLE public.v_doctor_directory FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.v_doctor_directory TO authenticated;

-- Keep the existing analytical view readable (RLS still applies because it is
-- security_invoker = true).
GRANT SELECT ON TABLE public.v_duplicate_lab_tests TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. Policies
-- ----------------------------------------------------------------------------

-- admin_user: an admin can read their own row; only admins may manage rows.
CREATE POLICY admin_user_self_select
    ON public.admin_user
    FOR SELECT
    TO authenticated
    USING (lower(email) = public.current_user_email());

CREATE POLICY admin_user_admin_all
    ON public.admin_user
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY admin_user_service_role_all
    ON public.admin_user
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- doctor: doctors may read/update only their own row; admins may manage all.
-- There is deliberately no patient SELECT policy on this table.
CREATE POLICY doctor_self_or_admin_select
    ON public.doctor
    FOR SELECT
    TO authenticated
    USING (
        doctor_id = public.current_doctor_id()
        OR public.is_admin()
    );

CREATE POLICY doctor_self_or_admin_update
    ON public.doctor
    FOR UPDATE
    TO authenticated
    USING (
        doctor_id = public.current_doctor_id()
        OR public.is_admin()
    )
    WITH CHECK (
        doctor_id = public.current_doctor_id()
        OR public.is_admin()
    );

CREATE POLICY doctor_admin_all
    ON public.doctor
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY doctor_service_role_all
    ON public.doctor
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- hospital: directory data is readable by any authenticated user; only admins
-- may modify it.
CREATE POLICY hospital_authenticated_select
    ON public.hospital
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY hospital_admin_all
    ON public.hospital
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY hospital_service_role_all
    ON public.hospital
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- patient: self, admin, or a doctor with active consent (direct or hospital).
CREATE POLICY patient_authorized_select
    ON public.patient
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR patient_id = public.current_patient_id()
        OR (
            public.current_doctor_id() IS NOT NULL
            AND public.fn_has_consent(patient_id, public.current_doctor_id())
        )
    );

CREATE POLICY patient_self_update
    ON public.patient
    FOR UPDATE
    TO authenticated
    USING (patient_id = public.current_patient_id())
    WITH CHECK (patient_id = public.current_patient_id());

CREATE POLICY patient_admin_all
    ON public.patient
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY patient_service_role_all
    ON public.patient
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- consent: patients fully manage their own consents. Doctors see consents
-- addressed to them directly OR to their hospital (hospital-wide visibility).
CREATE POLICY consent_patient_all
    ON public.consent
    FOR ALL
    TO authenticated
    USING (patient_id = public.current_patient_id())
    WITH CHECK (patient_id = public.current_patient_id());

CREATE POLICY consent_doctor_select
    ON public.consent
    FOR SELECT
    TO authenticated
    USING (
        doctor_id = public.current_doctor_id()
        OR hospital_id = public.current_doctor_hospital_id()
    );

CREATE POLICY consent_admin_all
    ON public.consent
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY consent_service_role_all
    ON public.consent
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- visit: self, admin, or a doctor with active consent for the patient.
CREATE POLICY visit_authorized_select
    ON public.visit
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR patient_id = public.current_patient_id()
        OR (
            public.current_doctor_id() IS NOT NULL
            AND public.fn_has_consent(patient_id, public.current_doctor_id())
        )
    );

CREATE POLICY visit_admin_all
    ON public.visit
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY visit_service_role_all
    ON public.visit
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- diagnosis, prescription and lab_test inherit visibility from their parent
-- visit. The EXISTS subquery repeats the same patient/consent rule as visit.
CREATE POLICY diagnosis_authorized_select
    ON public.diagnosis
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1
            FROM public.visit v
            WHERE v.visit_id = diagnosis.visit_id
              AND (
                  v.patient_id = public.current_patient_id()
                  OR (
                      public.current_doctor_id() IS NOT NULL
                      AND public.fn_has_consent(v.patient_id, public.current_doctor_id())
                  )
              )
        )
    );

CREATE POLICY diagnosis_admin_all
    ON public.diagnosis
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY diagnosis_service_role_all
    ON public.diagnosis
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY prescription_authorized_select
    ON public.prescription
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1
            FROM public.visit v
            WHERE v.visit_id = prescription.visit_id
              AND (
                  v.patient_id = public.current_patient_id()
                  OR (
                      public.current_doctor_id() IS NOT NULL
                      AND public.fn_has_consent(v.patient_id, public.current_doctor_id())
                  )
              )
        )
    );

CREATE POLICY prescription_admin_all
    ON public.prescription
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY prescription_service_role_all
    ON public.prescription
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY lab_test_authorized_select
    ON public.lab_test
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1
            FROM public.visit v
            WHERE v.visit_id = lab_test.visit_id
              AND (
                  v.patient_id = public.current_patient_id()
                  OR (
                      public.current_doctor_id() IS NOT NULL
                      AND public.fn_has_consent(v.patient_id, public.current_doctor_id())
                  )
              )
        )
    );

CREATE POLICY lab_test_admin_all
    ON public.lab_test
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY lab_test_service_role_all
    ON public.lab_test
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- audit_log: append-only for normal users. Patients see their own entries,
-- doctors see entries attributed to them. Doctors may insert only entries
-- attributed to themselves. No authenticated UPDATE/DELETE policy exists.
CREATE POLICY audit_log_authorized_select
    ON public.audit_log
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR patient_id = public.current_patient_id()
        OR doctor_id = public.current_doctor_id()
    );

CREATE POLICY audit_log_doctor_insert
    ON public.audit_log
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_admin()
        OR doctor_id = public.current_doctor_id()
    );

CREATE POLICY audit_log_admin_all
    ON public.audit_log
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY audit_log_service_role_all
    ON public.audit_log
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMIT;

-- ============================================================================
-- Re-run notes:
--   * Re-running the whole file is supported. The DO block removes every
--     policy by name from pg_policies, so renamed or obsolete policies cannot
--     survive, and CREATE POLICY never collides with an older version.
--   * If a helper function's existing return type differs from the definitions
--     above, Postgres will refuse CREATE OR REPLACE; drop that function first
--     (after this migration's policy drop) and re-run.
--   * Verify with database/check_rls.sql: rls_enabled and rls_forced should be
--     true for all ten tables, and policy_count should be non-zero.
-- ============================================================================
