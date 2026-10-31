# AarogyaLink — Final Report Change Plan (Supabase version)

**Purpose:** one actionable file listing the final report changes, the context for each change, and the replacement benchmark numbers.  
**Report:** `C:\Users\namei\Downloads\AarogyaLink_DBMS_ProjectReport.docx` (57 pages, 13,811 words)  
**Code audited:** repository `arogya-link`, HEAD `6a5f72f` plus current uncommitted changes, default Supabase stack.  
**Report scope:** describe **only the Supabase deployment**. Remove all alternative setup/deployment descriptions from the report.

---

## 0. Context — why these changes are needed

The report is dated **22 October 2026** and is based on commit `812828f` (20 October). The Supabase migration commit is `6a5f72f` (29 October, “Supabase Changed”). The report therefore describes the older stack:

| Report says | Current Supabase code does |
|---|---|
| Firebase Authentication | Supabase Auth (`frontend/src/lib/supabase.ts`, `AuthCard.tsx`) |
| Three containers: frontend, backend, `db` | Default stack: frontend + backend + hosted Supabase; no `db` container |
| `PostgreSQL localhost:5432`, database `aarogya_db` | Hosted Supabase PostgreSQL; no local database port in the default stack |
| Session cookie is unsigned | HMAC-signed httpOnly cookie (`frontend/src/lib/session.ts`) |
| No row-level security | RLS enabled and forced on all 10 Supabase tables (`database/rls_policies.sql`) |
| 35 REST endpoints | 31 OpenAPI paths / 38 operations |
| Python 3.13 | Docker image is `python:3.12-slim` |
| 5,000-patient benchmark | The 5,000-patient input and generator are not in the submitted repo |
| 4,994 audit entries | Its own Figure 4.6 shows 4,996 |

The report must be updated to the Supabase version. Do not revert the code to Firebase just to match the old report.

---

## 1. Submission blockers — fix first

### 1.1 Add the video link to page 1

**Location:** printed page 1 (PDF page 1), immediately below the project title.  
**Context:** The report has no video URL anywhere; all 9 hyperlinks are bibliographic references. The required link position is below the title with nothing between them.  
**Change:** Add the full clickable URL immediately below “AAROGYALINK MULTI-HOSPITAL HEALTH DATA SHARING PLATFORM”. Nothing between the title and the link. Verify it opens in a private/logged-out window.  
**Why:** Missing link is a submission-rule blocker regardless of report quality.

### 1.2 Replace the six pasted diagrams/charts with native objects

**Locations:** Figures 3.1, 3.2, 3.3, 3.4, 3.5 (printed pages 12, 13, 17, 18, 19) and Figure 5.1 (printed page 34).  
**Context:** `word/media/fig_architecture.png`, `fig_er.png`, `fig_consent_flow.png`, `fig_visit_sequence.png`, `fig_layers.png`, `fig_benchmark.png` are pasted PNGs. The DOCX has 0 native charts, 0 SmartArt, and 0 drawn shapes. The rule allows only final website outputs as screenshots; diagrams/charts must be created inside the report.  
**Change:** Recreate the five diagrams as native Word shapes/SmartArt and the benchmark chart as a native Word chart. Keep the eight real website screenshots (Figures 4.1–4.8) and the VIT logo.  
**Why:** Pasted diagrams/charts are a blocker under the native-table/diagram rule.

---

## 2. Replace the 5,000-patient benchmark with current project numbers

### 2.1 Current database benchmark

**Environment:** current Supabase project, 30 October 2026; 700 patients with visits, 1,324 visits.  
**Method:** `EXPLAIN (ANALYZE, FORMAT JSON)`, median of 40 runs after 5 discarded warm-ups; the four indexes were dropped inside a transaction and the transaction was rolled back.  
**Patient used:** `PAT-IN-1002` for Q1, Q2 and Q4; whole view for Q3.

| Query | Without indexes (ms) | With indexes (ms) | Speed-up | Plan with indexes |
|---|---:|---:|---:|---|
| Patient timeline | 0.211 | 0.083 | 2.5× | Index Scan on `idx_visit_patient` |
| Active consents of a patient | 0.378 | 0.058 | 6.5× | Bitmap Index Scan on `idx_consent_patient_status` |
| Duplicate-test view | 3.915 | 3.798 | 1.0× | Sequential scans + hash joins |
| Audit trail of a patient | 0.550 | 0.045 | 12.2× | Index Scan on `idx_audit_patient_time` |

**Change Table 5.7:** replace all eight rows (700 and 5,000) with the four rows above.  
**Change Figure 5.1:** replace the two-panel chart with a single panel using these four pairs.  
**Change the abstract:** replace “On a 5,000-patient copy … roughly 11 to 68 times” with “On the current Supabase snapshot, the three indexed lookups improved by 2.5–12.2×, while the duplicate-test view did not use its index.”  
**Change Section 5.6:** delete every reference to the 5,000-patient set, the second database, `11.5×`, `68×`, and “5,000-patient source”. Keep the current 700-patient results and the finding that the duplicate view performs sequential scans/hash joins.  
**Change Appendix B.4:** remove the 5,000-patient instructions. Keep the four queries from B.3 and state: run 40 times after 5 warm-ups; drop the four indexes inside a transaction to measure the without-index case; roll back.  
**Why:** The 5,000-patient input files and `report-evidence/` are not in the submitted repository, so those numbers cannot be reproduced; the current 700-patient numbers are reproducible.

### 2.2 Current API latency

**Environment:** current Supabase deployment; requests sent from the backend container to FastAPI, which queries hosted Supabase. Medians of 5 runs on 30 October 2026; re-run 30 iterations for the final version if you want to match the original methodology.

| Endpoint | Median |
|---|---:|
| `GET /api/health` | 1.1 ms |
| `GET /api/consents/check` | 917 ms |
| `GET /api/hospitals/caseload` | 1,007 ms |
| `GET /api/stats` | 2,713 ms |
| `GET /api/audit?limit=100` | 1,226 ms |
| `GET /api/duplicates` | 926 ms |
| `GET /api/patients/PAT-IN-1002/timeline` | 6,803 ms |

**Change Table 5.8:** rename it “Supabase API latency” and replace the old 0.4–6.1 ms values with the current medians.  
**Change Section 5.6 text:** the two-second target is **not met** for `/api/stats` and the timeline.  
**Change Table 6.1 / objective O3:** change “local latency about 6 ms / Met” to “Supabase timeline median about 6.8 s / Partially met”.  
**Why:** The old table measured a laptop/loopback environment. The submitted Supabase deployment includes network and pooler latency; a report claiming 0.4–6.1 ms would be contradicted by the running project.

---

## 3. Make the report Supabase-only

| Location | Context | Change |
|---|---|---|
| **Figure 3.1 / Table 3.2**, printed pages 12–13 | Diagram shows “Firebase Authentication” and three containers including `db`; table repeats Firebase. | Replace with **Supabase Auth** and **hosted Supabase PostgreSQL**. Show frontend + backend + hosted Supabase; remove the `db` container. |
| **Table 3.2**, printed page 13 | Says “nine routers (35 endpoints)”. | Change to “nine routers / 38 API operations across 31 paths”. |
| **Table 4.1**, printed page 20 | Identity row says Firebase SDK 13; packaging says three services with a persistent PostgreSQL volume; text says the code does not import Supabase. | Identity → Supabase Auth JS (`@supabase/supabase-js`); packaging → frontend/backend containers + hosted Supabase; Python → 3.12 in the Docker image. Delete the “does not import Supabase” sentence; the code does import it. |
| **Section 4.6**, printed page 27 | Describes Firebase browser auth and an unsigned `al_session` cookie. | Rewrite: browser signs in with Supabase Auth → `/api/auth/session` maps e-mail to role → HMAC-signed httpOnly cookie. State the open issue: the Supabase access token is not verified server-side, so the route still trusts the submitted e-mail. |
| **Section 4.7 / Appendix A / Appendix B**, printed pages 27–28, 43–46 | Contains a second setup path (database container, `db` service, `localhost:5432`, `arogya_db`) and a “local execution” section. | Remove the alternative setup entirely. Describe only: `docker compose up -d --build` starts frontend/backend; the Supabase project is seeded by running `init_migration_001.sql` → `initial_mock_data_load_fixed.sql` → `seed_demo_consents.sql` → `rls_policies.sql` in the Supabase SQL editor. |
| **Table B.1**, printed page 45 | Lists PostgreSQL `5432`, database `arogya_db`. | Replace the database row with “Supabase PostgreSQL (hosted, HTTPS)”; keep frontend 3000 and backend 8000. |
| **Section 5.1**, printed page 29 | Says measurements were taken on a “local PostgreSQL 17.5” laptop. | State the measurements were taken on the Supabase PostgreSQL 17 instance used by the submitted project. |
| **Section 5.7 / Table 5.9**, printed pages 35–36 | Says “session cookie is unsigned”, “no row-level security”, “audit log is not append-only”. | Update: signed cookie and RLS are now implemented; audit_log is append-only for normal roles. Keep these open: no FastAPI authentication, Supabase access token not verified, CORS `*`, 30-minute UI vs 24-hour emergency check, duplicate view not using its index, no automated tests, “undefined days left” bug. |
| **Figure 3.5**, printed page 19 | Contains mojibake (`â€¢`, `â€”`) and stale “unsigned/no RLS” claims. | Replace the image with native text/shapes and update the claims. |

**Why:** The report currently describes a different authentication provider and a different deployment topology from the submitted Supabase project. The evaluator will compare the report to the code.

---

## 4. Evidence, DA3 and traceability

| Location | Context | Change |
|---|---|---|
| **Chapter 1 / after Chapter 6** | No explicit DA1/DA2/DA3 traceability table; DA3 is never named. | Add a table mapping every DA1, DA2 and DA3 item to the final-report page and code path. |
| **DA3 coverage** | Course plan assigns NoSQL/document database, cloud deployment, SQL-vs-NoSQL comparison, backup/recovery and security to DA3. The report covers indexing/security only. | Add a DA3 section/appendix with the cloud (Supabase) deployment, NoSQL component/comparison, backup/recovery, and security evidence — or obtain written instructor confirmation that DA3 is out of scope. |
| **Section 3.2 / Table 3.1 / Appendix B.4** | References `database/build_seed_700.py`, `initial_mock_data_load.sql`, and `report-evidence/`; none are in the repo. | Add the files and exact commands, or remove the claims. At minimum, use the actual file `initial_mock_data_load_fixed.sql`. |
| **Section 5.1**, printed page 29 | Says there is no automated test suite. | Keep the honest statement, but attach the exact verification scripts or add pytest/SQL tests so the evaluation is reproducible. |
| **References**, printed pages 41–42 | Codd, Elmasri, Silberschatz, PostgreSQL, FastAPI, SQLAlchemy, Next.js, Docker and ABDM are listed but largely uncited in the body. | Add in-text citations where they support a statement, or remove uncited entries. |
| **Table 5.2 / Table 5.7 headers** | “SQLSTA TE” and `idx_consent_patient_stat us` wrap awkwardly. | Widen the columns or reduce header font size. |
| **Figure 4.7 / Figure 4.1**, printed pages 26, 23 | Duplicate-test screenshot has very low contrast; patient dashboard shows “undefined days left”. | Re-capture Figure 4.7; fix the days-left calculation or crop the defect; update the text if fixed. |
| **Page 2** | Authors on page 2; Mudit and Mayank have no surnames; git shows only Archit. | Add full names and a short contribution table; explain non-commit contributions in the video/viva. |

---

## 5. Security, secrets and metadata

| Location | Context | Change |
|---|---|---|
| **`docker-compose.yml` / Appendix A** | A Supabase database password is tracked in the repo (`docker-compose.yml:32`). | Rotate the password, move it to an untracked environment file, and remove it from the report/archive. |
| **DOCX properties** | `docProps/app.xml` still says “AI-Powered Smart Health Monitoring System - BAXXX191 Project Report”; keywords include “Isolation Forest”; description says personal details require completion. | Clear/update Title, Subject, Keywords, Comments and Company. Re-save the DOCX. |
| **TOC/lists** | Word reports `TOC: 0`; the TOC/list of tables/list of figures are manually typed tables. Page numbers are accurate now but will not update. | Apply Heading 1 to chapter titles and insert real Word TOC / List of Tables / List of Figures fields. |
| **Page 1** | The video link is missing. | Add it immediately below the title (Section 1.1). |
| **Turnitin/deadline** | No deadline or Turnitin evidence is in the repo. | Confirm the portal deadline; run a draft Turnitin check if permitted; keep the receipt. Do not claim a similarity/AI score in the report. |

---

## 6. Final numbers to use consistently

Pick one snapshot and use it everywhere. Recommended: **current Supabase snapshot, 30 October 2026**:

- Patients: 703 rows; **700 with visits**
- Doctors: 307
- Hospitals: 50
- Visits: 1,324
- Consents: 3,061
- Audit entries: 5,012

If you instead use the 22 October seed snapshot, keep **700 patients / 306 doctors / 1,324 visits / 3,059 consents / 4,994 audit entries** and re-run the benchmarks on that snapshot. Do not mix the two.

Also reconcile:

- 35 vs **38 API operations** (31 paths)
- 4,994 vs **4,996** audit entries shown in Figure 4.6
- 11 vs **12 commits**
- Python 3.13 vs **3.12 in Docker**

---

## 7. Final submission checklist

- [ ] Video link on page 1, directly below the title, clickable and accessible without permission.
- [ ] Six diagrams/charts replaced with native objects.
- [ ] All Firebase references replaced with Supabase.
- [ ] Architecture, Table 3.2, Table 4.1, Section 4.6, Appendix A/B rewritten for Supabase only.
- [ ] Table 5.7 and Figure 5.1 replaced with current Supabase benchmark values.
- [ ] Abstract, Section 5.6, Appendix B.4, Table 6.1 updated to the current numbers.
- [ ] Table 5.8 relabeled “Supabase API latency” and current values inserted; two-second target corrected.
- [ ] Security section updated: signed cookie/RLS fixed; API auth/token verification open.
- [ ] DA1/DA2/DA3 traceability table added; DA3 evidence added or waiver obtained.
- [ ] 5,000-patient reference removed, or missing files added.
- [ ] Metadata cleared; TOC/heading fields fixed; table headers/figures polished.
- [ ] Supabase database password rotated and removed from the repo/report.
- [ ] Turnitin draft/check completed; receipt saved.
- [ ] Full demo dry-run completed from a clean state before recording.
