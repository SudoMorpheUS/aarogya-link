import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import qn, nsdecls
import os

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=120, bottom=120, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'''
        <w:tcMar {nsdecls("w")}>
            <w:top w:w="{top}" w:type="dxa"/>
            <w:bottom w:w="{bottom}" w:type="dxa"/>
            <w:left w:w="{left}" w:type="dxa"/>
            <w:right w:w="{right}" w:type="dxa"/>
        </w:tcMar>
    ''')
    tcPr.append(tcMar)

def set_table_borders(table, color="D3D3D3", sz="4", val="single"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(f'''
        <w:tblBorders {nsdecls("w")}>
            <w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:left w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:right w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:insideV w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
        </w:tblBorders>
    ''')
    tblPr.append(borders)

def format_row(row, is_header=False, bg_color=None, font_size=Pt(9.5)):
    for cell in row.cells:
        if bg_color:
            set_cell_background(cell, bg_color)
        set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        for p in cell.paragraphs:
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.15
            for run in p.runs:
                run.font.name = "Times New Roman"
                run.font.size = font_size
                if is_header:
                    run.font.bold = True
                    run.font.color.rgb = RGBColor(0x11, 0x18, 0x27)
                else:
                    run.font.color.rgb = RGBColor(0x1F, 0x29, 0x37)

def add_heading_with_break(doc, text, level=1, page_break=True):
    p = doc.add_paragraph()
    if page_break:
        p.paragraph_format.page_break_before = True
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    run.font.name = "Times New Roman"
    run.font.bold = True
    if level == 1:
        run.font.size = Pt(15)
        run.font.color.rgb = RGBColor(0x0F, 0x24, 0x54) # Navy tone
    elif level == 2:
        run.font.size = Pt(13)
        run.font.color.rgb = RGBColor(0x11, 0x18, 0x27)
    else:
        run.font.size = Pt(11.5)
        run.font.color.rgb = RGBColor(0x1F, 0x29, 0x37)
    return p

def add_body_p(doc, text, bold_prefix=None, space_after=Pt(6)):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = space_after
    p.paragraph_format.line_spacing = 1.15
    if bold_prefix:
        r_pre = p.add_run(bold_prefix)
        r_pre.font.name = "Times New Roman"
        r_pre.font.size = Pt(11)
        r_pre.font.bold = True
        r_pre.font.color.rgb = RGBColor(0x11, 0x18, 0x27)
    run = p.add_run(text)
    run.font.name = "Times New Roman"
    run.font.size = Pt(11)
    run.font.color.rgb = RGBColor(0x2B, 0x2B, 0x2B)
    return p

def add_bullet_p(doc, bold_prefix, text):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.15
    if bold_prefix:
        r_pre = p.add_run(bold_prefix)
        r_pre.font.name = "Times New Roman"
        r_pre.font.size = Pt(10.5)
        r_pre.font.bold = True
        r_pre.font.color.rgb = RGBColor(0x11, 0x18, 0x27)
    run = p.add_run(text)
    run.font.name = "Times New Roman"
    run.font.size = Pt(10.5)
    run.font.color.rgb = RGBColor(0x2B, 0x2B, 0x2B)
    return p

def add_code_block(doc, code_text):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    cell.width = Inches(6.5)
    set_cell_background(cell, "F8F9FA")
    set_cell_margins(cell, top=120, bottom=120, left=160, right=160)
    set_table_borders(tbl, color="E2E8F0", sz="4", val="single")
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.1
    run = p.add_run(code_text.strip())
    run.font.name = "Consolas"
    run.font.size = Pt(9.0)
    run.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)
    
    # spacing paragraph after table
    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(0)
    p_after.paragraph_format.space_after = Pt(6)

def main():
    doc_path = "docs/AarogyaLink_DBMS_ProjectReport_Supabase.docx"
    doc = docx.Document(doc_path)
    body = doc._body._element
    
    # Update Table 0 (TOC)
    t0 = doc.tables[0]
    for row in t0.rows:
        text = row.cells[0].text.strip()
        if 'APPENDIX A' in text:
            row.cells[0].paragraphs[0].text = "APPENDIX A  COMPLETE DATA DEFINITION LANGUAGE"
        elif 'APPENDIX B' in text:
            row.cells[0].paragraphs[0].text = "APPENDIX B  FUNCTIONS AND TRIGGER"
        elif 'APPENDIX C' in text:
            row.cells[0].paragraphs[0].text = "APPENDIX C  DEMONSTRATION GUIDE AND TEAM CONTRIBUTIONS"

    # Update Table 1 (LOT)
    t1 = doc.tables[1]
    # Check rows for Table B.1, B.2, C.1
    rows_to_remove = []
    for idx, row in enumerate(t1.rows):
        text = row.cells[0].text.strip()
        if 'Table B.1' in text:
            row.cells[0].paragraphs[0].text = "Table C.1. Local and cloud service ports"
        elif 'Table B.2' in text:
            row.cells[0].paragraphs[0].text = "Table C.2. Team contributions"
        elif 'Table C.1' in text:
            rows_to_remove.append(row._tr)
            
    for tr in rows_to_remove:
        t1._tbl.remove(tr)

    # Find the start of APPENDIX A in body elements
    target_idx = None
    for idx, child in enumerate(body):
        if child.tag.endswith('p') and child.text and 'APPENDIX A' in child.text:
            target_idx = idx
            break
            
    print(f"Removing old appendices starting at child index {target_idx}...")
    # Find the sectPr element (which must stay at the very end of body)
    sectPr = body.xpath('w:sectPr')[-1]
    
    # Remove all children between target_idx and sectPr
    elements_to_remove = []
    found_start = False
    for child in list(body):
        if child is body[target_idx]:
            found_start = True
        if found_start and child is not sectPr:
            elements_to_remove.append(child)
            
    for elem in elements_to_remove:
        body.remove(elem)
        
    print(f"Removed {len(elements_to_remove)} old appendix elements.")

    # Now append new Appendices content to doc
    
    # =========================================================================
    # APPENDIX A: COMPLETE DATA DEFINITION LANGUAGE
    # =========================================================================
    add_heading_with_break(doc, "APPENDIX A", level=1, page_break=True)
    add_heading_with_break(doc, "COMPLETE DATA DEFINITION LANGUAGE", level=2, page_break=False)
    add_body_p(doc, "This appendix reproduces the complete schema definition script used to construct the authoritative relational database for AarogyaLink. In the hosted Supabase environment, the scripts are applied sequentially via the SQL Editor: init_migration_001.sql, initial_mock_data_load_fixed.sql, seed_demo_consents.sql, and rls_policies.sql. Table constraints, referential cascades, and domain checks are enforced at the database engine level.")
    
    sql_ddl = """-- 1. Patient
CREATE TABLE patient (
  patient_id     VARCHAR(20)  PRIMARY KEY,
  full_name      VARCHAR(100) NOT NULL,
  date_of_birth  DATE         NOT NULL,
  gender         CHAR(1)      NOT NULL CHECK (gender IN ('M','F','O')),
  blood_group    VARCHAR(5),
  contact_number VARCHAR(15)  NOT NULL,
  email          VARCHAR(100) UNIQUE
);

-- 2. Hospital
CREATE TABLE hospital (
  hospital_id     VARCHAR(15)  PRIMARY KEY,
  hospital_name   VARCHAR(150) NOT NULL,
  address         VARCHAR(255) NOT NULL,
  contact_number  VARCHAR(15)  NOT NULL,
  registration_no VARCHAR(30)  UNIQUE NOT NULL
);

-- 3. Doctor
CREATE TABLE doctor (
  doctor_id      VARCHAR(15)  PRIMARY KEY,
  hospital_id    VARCHAR(15)  NOT NULL REFERENCES hospital(hospital_id),
  full_name      VARCHAR(100) NOT NULL,
  specialization VARCHAR(80)  NOT NULL,
  license_number VARCHAR(30)  UNIQUE NOT NULL,
  email          VARCHAR(100),
  contact_number VARCHAR(15)
);

-- 4. Visit
CREATE TABLE visit (
  visit_id        SERIAL       PRIMARY KEY,
  patient_id      VARCHAR(20)  NOT NULL REFERENCES patient(patient_id),
  hospital_id     VARCHAR(15)  NOT NULL REFERENCES hospital(hospital_id),
  doctor_id       VARCHAR(15)  NOT NULL REFERENCES doctor(doctor_id),
  visit_date      TIMESTAMP    NOT NULL DEFAULT NOW(),
  visit_type      VARCHAR(20)  NOT NULL CHECK (visit_type IN ('OPD','Emergency','Inpatient')),
  chief_complaint VARCHAR(255)
);

-- 5. Diagnosis
CREATE TABLE diagnosis (
  diagnosis_id   SERIAL       PRIMARY KEY,
  visit_id       INTEGER      NOT NULL REFERENCES visit(visit_id) ON DELETE CASCADE,
  disease_code   VARCHAR(10)  NOT NULL,
  description    VARCHAR(255) NOT NULL,
  diagnosed_date DATE         NOT NULL
);

-- 6. Prescription
CREATE TABLE prescription (
  prescription_id SERIAL       PRIMARY KEY,
  visit_id        INTEGER      NOT NULL REFERENCES visit(visit_id) ON DELETE CASCADE,
  medicine_name   VARCHAR(100) NOT NULL,
  dosage          VARCHAR(50)  NOT NULL,
  frequency       VARCHAR(50)  NOT NULL,
  duration        VARCHAR(50)  NOT NULL
);

-- 7. Laboratory test
CREATE TABLE lab_test (
  lab_test_id SERIAL       PRIMARY KEY,
  visit_id    INTEGER      NOT NULL REFERENCES visit(visit_id) ON DELETE CASCADE,
  test_name   VARCHAR(100) NOT NULL,
  result      VARCHAR(100),
  unit        VARCHAR(30),
  test_date   DATE         NOT NULL
);

-- 8. Consent
CREATE TABLE consent (
  consent_id  SERIAL      PRIMARY KEY,
  patient_id  VARCHAR(20) NOT NULL REFERENCES patient(patient_id),
  hospital_id VARCHAR(15) REFERENCES hospital(hospital_id),
  doctor_id   VARCHAR(15) REFERENCES doctor(doctor_id),
  start_date  DATE        NOT NULL,
  end_date    DATE,
  status      VARCHAR(15) NOT NULL CHECK (status IN ('Active','Revoked')),
  CHECK (hospital_id IS NOT NULL OR doctor_id IS NOT NULL),
  CHECK (end_date IS NULL OR end_date >= start_date)
);

-- 9. Audit log
CREATE TABLE audit_log (
  log_id      SERIAL      PRIMARY KEY,
  patient_id  VARCHAR(20) NOT NULL REFERENCES patient(patient_id),
  doctor_id   VARCHAR(15) REFERENCES doctor(doctor_id),
  action      VARCHAR(30) NOT NULL,
  action_time TIMESTAMP   NOT NULL DEFAULT NOW(),
  details     TEXT
);

-- 10. Administrator
CREATE TABLE admin_user (
  email      VARCHAR(100) PRIMARY KEY,
  full_name  VARCHAR(100) NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);"""
    add_code_block(doc, sql_ddl)

    # =========================================================================
    # APPENDIX B: FUNCTIONS AND TRIGGER
    # =========================================================================
    add_heading_with_break(doc, "APPENDIX B", level=1, page_break=True)
    add_heading_with_break(doc, "FUNCTIONS AND TRIGGER", level=2, page_break=False)
    add_body_p(doc, "This appendix documents the server-side PL/pgSQL and SQL functions and trigger implementations that enforce core governance rules, automated audit generation, and consent checks within the database tier.")
    
    add_heading_with_break(doc, "B.1 CONSENT DECISION FUNCTION", level=3, page_break=False)
    sql_fn_consent = """CREATE OR REPLACE FUNCTION fn_has_consent(
  p_patient_id VARCHAR, p_doctor_id VARCHAR
) RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM consent c
    JOIN doctor d ON d.doctor_id = p_doctor_id
    WHERE c.patient_id = p_patient_id
      AND c.status = 'Active'
      AND c.start_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
      AND (c.end_date IS NULL OR c.end_date >=
           (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date)
      AND (c.doctor_id = p_doctor_id OR c.hospital_id = d.hospital_id)
  );
$$;"""
    add_code_block(doc, sql_fn_consent)

    add_heading_with_break(doc, "B.2 CONSENT GRANT FUNCTION", level=3, page_break=False)
    sql_sp_grant = """CREATE OR REPLACE FUNCTION sp_grant_consent(
  p_patient_id VARCHAR, p_hospital_id VARCHAR, p_doctor_id VARCHAR,
  p_start_date DATE, p_end_date DATE
) RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE new_id INTEGER;
BEGIN
  IF p_hospital_id IS NULL AND p_doctor_id IS NULL THEN
    RAISE EXCEPTION 'Consent must name a hospital or a doctor';
  END IF;
  INSERT INTO consent (patient_id, hospital_id, doctor_id, start_date, end_date, status)
  VALUES (p_patient_id, p_hospital_id, p_doctor_id, p_start_date, p_end_date, 'Active')
  RETURNING consent_id INTO new_id;
  RETURN new_id;
END;
$$;"""
    add_code_block(doc, sql_sp_grant)

    add_heading_with_break(doc, "B.3 VISIT AUDIT TRIGGER", level=3, page_break=False)
    sql_trg = """CREATE OR REPLACE FUNCTION trg_visit_audit() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO audit_log (patient_id, doctor_id, action, details)
  VALUES (NEW.patient_id, NEW.doctor_id, 'VISIT_CREATED',
          format('visit_id=%s type=%s hospital=%s',
                 NEW.visit_id, NEW.visit_type, NEW.hospital_id));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS visit_audit ON visit;
CREATE TRIGGER visit_audit
AFTER INSERT ON visit
FOR EACH ROW EXECUTE FUNCTION trg_visit_audit();"""
    add_code_block(doc, sql_trg)

    # =========================================================================
    # APPENDIX C: DEMONSTRATION GUIDE AND TEAM CONTRIBUTIONS
    # =========================================================================
    add_heading_with_break(doc, "APPENDIX C", level=1, page_break=True)
    add_heading_with_break(doc, "DEMONSTRATION GUIDE AND TEAM CONTRIBUTIONS", level=2, page_break=False)
    add_body_p(doc, "This appendix provides an operational quick reference, health check specifications, security verification checklists, data path integrity procedures, demonstration walkthrough instructions, and the official record of individual team contributions for AarogyaLink.")

    add_heading_with_break(doc, "C.1 SERVICE PORTS", level=3, page_break=False)
    add_body_p(doc, "Table C.1 defines the active local and cloud service ports, protocols, and architectural responsibilities of each deployment component.", space_after=Pt(4))

    # Table C.1
    t_ports = doc.add_table(rows=6, cols=3)
    t_ports.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_ports, color="CBD5E1", sz="4", val="single")
    
    headers_c1 = ["Service", "Default local port / Endpoint", "Purpose"]
    for j, h in enumerate(headers_c1):
        t_ports.cell(0, j).paragraphs[0].text = h
    format_row(t_ports.rows[0], is_header=True, bg_color="F1F5F9", font_size=Pt(10))

    data_c1 = [
        ("FastAPI gateway", "8000", "REST endpoints, authentication, input validation, transaction management, health probes and OpenAPI documentation (/docs)."),
        ("React / Next.js web portal", "3000", "Browser-based clinician, patient, and administrator monitoring portals, server actions, and HMAC-signed session cookies."),
        ("PostgreSQL 17 (Supabase Cloud)", "5432 (Cloud Pooler)", "Authoritative cloud relational database with BCNF relations, PL/pgSQL functions, triggers, views, and row-level security (RLS)."),
        ("PostgreSQL 17 (Local Container)", "5434 (Host) / 5432 (Internal)", "Optional containerized Alpine PostgreSQL instance for fully offline evaluation and local benchmark verification."),
        ("Supabase Auth service", "Cloud HTTPS (443)", "Managed authentication, password hashing, and role-mapped user token issuance.")
    ]

    col_widths_c1 = [Inches(1.8), Inches(1.5), Inches(3.2)]
    for i, row_data in enumerate(data_c1):
        row = t_ports.rows[i+1]
        for j, val in enumerate(row_data):
            row.cells[j].paragraphs[0].text = val
        format_row(row, is_header=False, font_size=Pt(9.5))

    for row in t_ports.rows:
        for j, w in enumerate(col_widths_c1):
            row.cells[j].width = w

    add_body_p(doc, "", space_after=Pt(6))

    add_heading_with_break(doc, "C.2 HEALTH CHECK INTERPRETATION", level=3, page_break=False)
    add_bullet_p(doc, "Liveness: ", "Answers whether the application process is alive (GET /api/health). Returns 200 OK immediately and does not fail solely because an optional external analytics service is offline.")
    add_bullet_p(doc, "Readiness: ", "Checks whether the authoritative relational dependency is available; the /api/stats endpoint returns 503 if it cannot reach the primary relational store, preventing inconsistent mid-transaction states.")
    add_bullet_p(doc, "Relational diagnostic: ", "Verifies connectivity to the configured relational engine (Supabase PostgreSQL / local PostgreSQL) via SQLAlchemy and psycopg 3 connection poolers. Logs engine status upon initialization.")
    add_bullet_p(doc, "Authentication diagnostic: ", "Verifies Supabase Auth reachability, user token resolution, and session signature verification without leaking secrets.")

    add_heading_with_break(doc, "C.3 SECURITY CHECKLIST FOR A DEMO", level=3, page_break=False)
    add_bullet_p(doc, "Secret Management: ", "Use a unique local secret (SESSION_SECRET) and replace any documented sample credential; never deploy using example values.")
    add_bullet_p(doc, "Network and CORS Boundaries: ", "Confirm TLS termination and restrictive CORS settings (http://localhost:3000) before using any non-local network interface.")
    add_bullet_p(doc, "Multi-Persona Access Verification: ", "Test patient self-access, clinician assigned-patient access, and unassigned-patient rejection with separate accounts.")
    add_bullet_p(doc, "Session and Break-Glass Audit: ", "Test expired JWT and session token behavior; confirm unauthorized channel access is rejected and logged as DENIED, while emergency overrides record EMERGENCY_OVERRIDE.")
    add_bullet_p(doc, "Synthetic Data Compliance: ", "Keep simulated clinical records visibly marked and never enter real identifiable patient records into a demonstration environment.")

    add_heading_with_break(doc, "C.4 DATA PATH CHECKS", level=3, page_break=False)
    add_bullet_p(doc, "Schema and Field Validation: ", "Check that timestamps, metric units (e.g. mg/dL, mIU/L), ICD disease codes, and source hospital labels are present before accepting a record.")
    add_bullet_p(doc, "Transaction Atomicity: ", "Check transaction atomicity before saving a multi-table visit; confirm that partial errors trigger a complete rollback leaving zero orphan records.")
    add_bullet_p(doc, "Clinical Duplicate Warning: ", "Check that alerts reference the triggering reading when one exists, and that duplicate-test warnings alert clinicians to prior tests within 90 days.")
    add_bullet_p(doc, "Comprehensive Audit Trail: ", "Check that every read, denial, consent change, and emergency override is recorded immutably in the PostgreSQL audit_log.")

    add_heading_with_break(doc, "C.5 PROJECT EXPLANATION VIDEO", level=3, page_break=False)
    add_body_p(doc, "The project demonstration video is between five and ten minutes in length. All three team members participate in the recording, demonstrating the system architecture, SQL schema execution, consent rules, atomic visit insertion, and role-specific portals.")
    
    # Video Callout Box
    tbl_vid = doc.add_table(rows=1, cols=1)
    tbl_vid.alignment = WD_TABLE_ALIGNMENT.CENTER
    c_vid = tbl_vid.cell(0, 0)
    c_vid.width = Inches(6.5)
    set_cell_background(c_vid, "F0FDF4")
    set_cell_margins(c_vid, top=100, bottom=100, left=150, right=150)
    set_table_borders(tbl_vid, color="86EFAC", sz="6", val="single")
    p_vid = c_vid.paragraphs[0]
    p_vid.paragraph_format.space_before = Pt(0)
    p_vid.paragraph_format.space_after = Pt(0)
    r_vid_title = p_vid.add_run("Project Explanation Video Link: ")
    r_vid_title.font.name = "Times New Roman"
    r_vid_title.font.size = Pt(10.5)
    r_vid_title.font.bold = True
    r_vid_title.font.color.rgb = RGBColor(0x16, 0x65, 0x34)
    r_vid_url = p_vid.add_run("[INSERT VIDEO LINK HERE]")
    r_vid_url.font.name = "Times New Roman"
    r_vid_url.font.size = Pt(10.5)
    r_vid_url.font.bold = True
    r_vid_url.font.color.rgb = RGBColor(0x15, 0x80, 0x3D)

    add_body_p(doc, "", space_after=Pt(6))

    add_heading_with_break(doc, "C.6 TEAM CONTRIBUTIONS", level=3, page_break=False)
    add_body_p(doc, "The development of AarogyaLink was distributed among team members with distinct areas of ownership across database engineering, backend services, frontend portals, and documentation.", space_after=Pt(4))

    # Table C.2 (Team Contributions)
    t_contrib = doc.add_table(rows=4, cols=3)
    t_contrib.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_contrib, color="CBD5E1", sz="4", val="single")

    headers_c2 = ["Member", "Roll Number", "Main Contributions"]
    for j, h in enumerate(headers_c2):
        t_contrib.cell(0, j).paragraphs[0].text = h
    format_row(t_contrib.rows[0], is_header=True, bg_color="F1F5F9", font_size=Pt(10))

    data_c2 = [
        ("Archit Kumar Singh", "25BRS1030", "Frontend portals & dashboards; FastAPI backend & transactions; Supabase cloud hosting & RLS policies; SQL schema, functions & audit triggers; report consolidation."),
        ("Mudit Jha", "25BRS1094", "Data Dictionary; test data preparation; normalization; literature review; research gap."),
        ("Mayank More", "25BRS1154", "Problem analysis and requirements; ER/EER modelling; screenshots and demonstration video.")
    ]

    col_widths_c2 = [Inches(1.8), Inches(1.3), Inches(3.4)]
    for i, row_data in enumerate(data_c2):
        row = t_contrib.rows[i+1]
        for j, val in enumerate(row_data):
            row.cells[j].paragraphs[0].text = val
        format_row(row, is_header=False, font_size=Pt(9.5))

    for row in t_contrib.rows:
        for j, w in enumerate(col_widths_c2):
            row.cells[j].width = w

    add_body_p(doc, "", space_after=Pt(6))
    add_body_p(doc, "All members participated in database design reviews, schema constraint testing, and the live system demonstration. Each team member is capable of explaining the complete relational architecture, transactional visit logic, consent evaluation function, and query performance profiles.")

    # Ensure sectPr remains the very last element of body
    body.append(sectPr)
    
    # Save both files
    out_final = "docs/AarogyaLink_DBMS_ProjectReport_Final.docx"
    doc.save(out_final)
    print(f"Saved: {out_final}")

    # Also update the primary docx
    doc.save(doc_path)
    print(f"Updated: {doc_path}")

if __name__ == "__main__":
    main()
