-- Chart load indexes, and an append-only hash chain on audit_log.
-- Safe to re-run. Apply in the Supabase SQL editor after the schema and RLS scripts.

CREATE INDEX IF NOT EXISTS idx_diagnosis_visit ON diagnosis(visit_id);
CREATE INDEX IF NOT EXISTS idx_prescription_visit ON prescription(visit_id);
CREATE INDEX IF NOT EXISTS idx_lab_test_visit ON lab_test(visit_id);
CREATE INDEX IF NOT EXISTS idx_visit_patient_date ON visit(patient_id, visit_date DESC);

ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS prev_hash TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS entry_hash TEXT;

DROP TRIGGER IF EXISTS tr_audit_immutable ON audit_log;

DO $$
DECLARE
    rec RECORD;
    prev TEXT;
    payload TEXT;
BEGIN
    SELECT entry_hash INTO prev
    FROM audit_log
    WHERE entry_hash IS NOT NULL
    ORDER BY log_id DESC
    LIMIT 1;
    prev := COALESCE(prev, 'GENESIS');

    FOR rec IN
        SELECT log_id, patient_id, doctor_id, action, action_time, details
        FROM audit_log
        WHERE entry_hash IS NULL
        ORDER BY log_id
    LOOP
        payload := concat_ws(
            '|',
            rec.log_id::text,
            rec.patient_id,
            COALESCE(rec.doctor_id, ''),
            rec.action,
            COALESCE(rec.action_time::text, ''),
            COALESCE(rec.details, ''),
            prev
        );
        UPDATE audit_log
        SET prev_hash = prev,
            entry_hash = encode(sha256(convert_to(payload, 'UTF8')), 'hex')
        WHERE log_id = rec.log_id;
        prev := encode(sha256(convert_to(payload, 'UTF8')), 'hex');
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION trg_audit_seal() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    prev TEXT;
    payload TEXT;
BEGIN
    PERFORM pg_advisory_xact_lock(871234);
    SELECT entry_hash INTO prev
    FROM audit_log
    ORDER BY log_id DESC
    LIMIT 1;
    NEW.prev_hash := COALESCE(prev, 'GENESIS');
    payload := concat_ws(
        '|',
        COALESCE(NEW.patient_id, ''),
        COALESCE(NEW.doctor_id, ''),
        COALESCE(NEW.action, ''),
        COALESCE(NEW.action_time::text, ''),
        COALESCE(NEW.details, ''),
        NEW.prev_hash
    );
    NEW.entry_hash := encode(sha256(convert_to(payload, 'UTF8')), 'hex');
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trg_audit_immutable() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only';
END;
$$;

DROP TRIGGER IF EXISTS tr_audit_seal ON audit_log;
CREATE TRIGGER tr_audit_seal
BEFORE INSERT ON audit_log
FOR EACH ROW EXECUTE FUNCTION trg_audit_seal();

CREATE TRIGGER tr_audit_immutable
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION trg_audit_immutable();
