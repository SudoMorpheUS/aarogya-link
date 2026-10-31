"""One round trip for the JSON a chart or dashboard needs.

The previous timeline issued a separate Supabase query for every visit's
doctor, hospital, diagnoses, prescriptions and lab tests. Those round trips
dominated page load. This statement returns the same shape in one query.
"""

CHART_SQL = """
SELECT json_build_object(
    'patient', (
        SELECT json_build_object(
            'patient_id', p.patient_id,
            'full_name', p.full_name,
            'date_of_birth', to_char(p.date_of_birth, 'YYYY-MM-DD'),
            'gender', p.gender,
            'blood_group', p.blood_group,
            'contact_number', p.contact_number,
            'email', p.email
        )
        FROM patient p
        WHERE p.patient_id = :pid
    ),
    'timeline', COALESCE((
        SELECT json_agg(item ORDER BY sort_date DESC)
        FROM (
            SELECT
                v.visit_date AS sort_date,
                json_build_object(
                    'visit_id', v.visit_id,
                    'visit_date', to_char(v.visit_date, 'YYYY-MM-DD"T"HH24:MI:SS'),
                    'visit_type', v.visit_type,
                    'chief_complaint', v.chief_complaint,
                    'doctor', json_build_object(
                        'doctor_id', d.doctor_id,
                        'full_name', d.full_name,
                        'specialization', d.specialization
                    ),
                    'hospital', json_build_object(
                        'hospital_id', h.hospital_id,
                        'hospital_name', h.hospital_name,
                        'address', h.address
                    ),
                    'diagnoses', COALESCE((
                        SELECT json_agg(json_build_object(
                            'diagnosis_id', di.diagnosis_id,
                            'disease_code', di.disease_code,
                            'description', di.description,
                            'diagnosed_date', to_char(di.diagnosed_date, 'YYYY-MM-DD')
                        ) ORDER BY di.diagnosis_id)
                        FROM diagnosis di
                        WHERE di.visit_id = v.visit_id
                    ), '[]'::json),
                    'prescriptions', COALESCE((
                        SELECT json_agg(json_build_object(
                            'prescription_id', rx.prescription_id,
                            'medicine_name', rx.medicine_name,
                            'dosage', rx.dosage,
                            'frequency', rx.frequency,
                            'duration', rx.duration
                        ) ORDER BY rx.prescription_id)
                        FROM prescription rx
                        WHERE rx.visit_id = v.visit_id
                    ), '[]'::json),
                    'lab_tests', COALESCE((
                        SELECT json_agg(json_build_object(
                            'lab_test_id', lt.lab_test_id,
                            'test_name', lt.test_name,
                            'result', lt.result,
                            'unit', lt.unit,
                            'test_date', to_char(lt.test_date, 'YYYY-MM-DD')
                        ) ORDER BY lt.test_date DESC, lt.lab_test_id)
                        FROM lab_test lt
                        WHERE lt.visit_id = v.visit_id
                    ), '[]'::json)
                ) AS item
            FROM visit v
            JOIN doctor d ON d.doctor_id = v.doctor_id
            JOIN hospital h ON h.hospital_id = v.hospital_id
            WHERE v.patient_id = :pid
        ) visits
    ), '[]'::json),
    'labs', COALESCE((
        SELECT json_agg(json_build_object(
            'lab_test_id', lt.lab_test_id,
            'visit_id', lt.visit_id,
            'test_name', lt.test_name,
            'result', lt.result,
            'unit', lt.unit,
            'test_date', to_char(lt.test_date, 'YYYY-MM-DD'),
            'hospital_name', h.hospital_name,
            'hospital_id', h.hospital_id
        ) ORDER BY lt.test_date DESC, lt.lab_test_id DESC)
        FROM lab_test lt
        JOIN visit v ON v.visit_id = lt.visit_id
        JOIN hospital h ON h.hospital_id = v.hospital_id
        WHERE v.patient_id = :pid
    ), '[]'::json),
    'prescriptions', COALESCE((
        SELECT json_agg(row_to_json(rx))
        FROM (
            SELECT
                pr.prescription_id,
                pr.visit_id,
                pr.medicine_name,
                pr.dosage,
                pr.frequency,
                pr.duration,
                to_char(v.visit_date, 'YYYY-MM-DD"T"HH24:MI:SS') AS visit_date,
                d.full_name AS doctor_name,
                h.hospital_name
            FROM prescription pr
            JOIN visit v ON v.visit_id = pr.visit_id
            JOIN doctor d ON d.doctor_id = v.doctor_id
            JOIN hospital h ON h.hospital_id = v.hospital_id
            WHERE v.patient_id = :pid
            ORDER BY v.visit_date DESC, pr.prescription_id DESC
            LIMIT 20
        ) rx
    ), '[]'::json),
    'consents', COALESCE((
        SELECT json_agg(json_build_object(
            'consent_id', c.consent_id,
            'patient_id', c.patient_id,
            'hospital_id', c.hospital_id,
            'hospital_name', h.hospital_name,
            'doctor_id', c.doctor_id,
            'doctor_name', d.full_name,
            'start_date', to_char(c.start_date, 'YYYY-MM-DD'),
            'end_date', to_char(c.end_date, 'YYYY-MM-DD'),
            'status', c.status
        ) ORDER BY c.start_date DESC, c.consent_id DESC)
        FROM consent c
        LEFT JOIN hospital h ON h.hospital_id = c.hospital_id
        LEFT JOIN doctor d ON d.doctor_id = c.doctor_id
        WHERE c.patient_id = :pid
    ), '[]'::json),
    'access_events', (
        SELECT COUNT(*)
        FROM audit_log a
        WHERE a.patient_id = :pid
          AND a.action IN ('READ', 'EMERGENCY_READ', 'DENIED')
    )
)
"""
