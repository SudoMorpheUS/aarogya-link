# Final Report Audit — AarogyaLink (Supabase version)

**Audit time:** 2026-10-30 02:10 IST / 2026-10-29 20:40 UTC  
**Report audited:** `C:\Users\namei\Downloads\AarogyaLink_DBMS_ProjectReport.docx`  
— 57 pages, 13,811 words, 28 native tables, 16 inline pictures, 1.5 MB  
**Code audited:** `D:\Projects\DBMS\arogya-link_new\arogya-link_new\arogya-link`  
— branch `fix/registration-and-data`, HEAD `6a5f72f` plus uncommitted changes, default Supabase stack  
**Scope:** the report is checked against the **Supabase version** (`docker compose up -d --build`), not the optional local PostgreSQL stack.

---

## 1. Verdict

# NOT READY

| Severity | Count |
|---|---:|
| BLOCKER | 2 |
| MAJOR | 9 |
| MINOR | 6 |

The two blockers alone are enough to stop submission: the mandatory video link is absent from page 1, and six diagrams/charts are pasted PNGs rather than native report objects. The report is also written against the pre-Supabase codebase (Firebase Authentication, a local `db` container, unsigned cookie, no RLS), while the audited Supabase version uses Supabase Auth/Postgres, a signed cookie, and RLS policies.

---

## 2. Time budget

No deadline is documented in the repository, the report, or the course plan. If the stated deadline is **1 November 2026 at 12:00 AM (midnight)**, the safe reading is before **23:59 on 31 October 2026 IST**.

| Reading | Time left from 2026-10-30 02:10 IST |
|---|---:|
| Safe reading: 31 Oct 2026 23:59 IST | **45 h 49 m** |
| Unsafe reading: 1 Nov 2026 23:59 IST | 69 h 49 m |

UTC equivalents: safe deadline **2026-10-31 18:29 UTC**; current time **2026-10-29 20:40 UTC**. Confirm the exact portal deadline; do not rely on the later reading.

**Triage order:** video link + recording (B-01) → native diagrams (B-02) → Supabase/Firebase reconciliation and security text (M-01/M-02/M-08) → missing benchmark evidence (M-03) → DA3 traceability (M-04) → rotate committed secret (M-05) → metadata/Figure 3.5/minor fixes.

---

## 3. Requirement table

| Req | Status | Evidence | Fix | Effort |
|---|---|---|---|---|
| Code review (Step 1) | **PARTIAL** | `docker compose up -d --build` stack runs; `/api/health` 200 and `/api/stats` returns current counts; `npm run typecheck` passes; no test files in `git ls-files`; `docker-compose.yml:32` contains a tracked Supabase DB password. | Add tests or evidence scripts; rotate secret; reconcile report with code. | 4–8 h |
| R1 — one consolidated report | **PARTIAL** | One 57-page DOCX; DA1/DA2 content is incorporated; no explicit DA1/DA2/DA3 traceability table; DA3 advanced-DB requirements are not covered. | Add traceability matrix and DA3 section/evidence. | 4–6 h |
| R2 — native tables/diagrams | **FAIL** | 28 real tables; 6 pasted diagram/chart PNGs (Figures 3.1–3.5, 5.1); 0 native charts, 0 SmartArt, 0 drawn shapes. | Rebuild diagrams/chart natively. | 4–8 h |
| R3 — plagiarism/AI | **CANNOT VERIFY** | Self-overlap proxies: DA1 1.4%, DA2 1.8%, README 4.0%, change.md 2.1% (8-word runs, not Turnitin). AI-style indicators MEDIUM; metadata leftover from another project. | Run Turnitin draft if permitted; add authorship evidence; remove template metadata. | 2–4 h |
| R4 — formatting/alignment | **PARTIAL** | Body Times New Roman 12 pt justified; code Courier New; page numbers present; 0 tracked changes/comments. Chapter titles are Normal style, TOC/lists are static text, Figure 3.5 has mojibake, some table headers wrap. | Normalize heading styles/fields and fix the visual defects. | 2–3 h |
| R5 — mandatory video | **FAIL** | Page 1 contains only course/title/subtitle/logo/VIT/date; no URL anywhere in the report; 9 hyperlinks are all reference links; no project video file in repo or user folders searched. | Add full clickable link immediately below title; record 5–10 min video with all members. | 3–6 h |
| R6 — Turnitin readiness/deadline | **CANNOT VERIFY** | DOCX is 1.5 MB / 57 pages, not password-protected, selectable text; no PDF; no deadline/Turnitin evidence; portal requirements unknown. | Confirm deadline/required files; run Turnitin; download receipt. | 1–2 h |
| R7 — evaluation scorecard | **NOT READY** | Presentation/demo cannot be verified without video; report has blockers; DA3 coverage missing. | Clear blockers, then rehearse viva/demo. | — |

---

## 4. Findings by severity

### BLOCKER

**B-01 — Mandatory video link is missing from page 1 (R5.1).**  
Evidence: report page 1 (PDF page 1) contains only “BACSE202 / DATABASE SYSTEMS PROJECT REPORT”, the project title, subtitle, VIT logo, “VIT CHENNAI / School of Computer Science and Engineering / October 2026”. There is no URL. Full-text search finds **0** occurrences of “video”, “YouTube”, “youtu.be”, “Drive”, or “OneDrive”. All 9 hyperlinks in the DOCX are bibliographic/reference URLs (`word/_rels/document.xml.rels`).  
Fix: put the full, clickable video URL immediately below the project title, with nothing between them; use YouTube unlisted or Drive “Anyone with the link – Viewer”; verify in a private window.  
Effort: 15 min to place the link; 3–6 h to record if not already done.

**B-02 — Six diagrams/charts are pasted PNGs, not native report objects (R2).**  
Evidence: `word/media/fig_architecture.png`, `fig_er.png`, `fig_consent_flow.png`, `fig_visit_sequence.png`, `fig_layers.png`, `fig_benchmark.png`; 16 inline pictures; `word/charts/` empty; `word/diagrams/data` absent; `<wps:wsp>` count 0. The six appear as Figures 3.1–3.5 and 5.1 (printed pages 12, 13, 17, 18, 19, 34).  
Fix: recreate each as native Word shapes/SmartArt, a native Word chart, or build-time-rendered TikZ; do not paste exported PNGs. Keep only the eight real website screenshots and the VIT logo.  
Effort: 4–8 h.

### MAJOR

**M-01 — The report describes the pre-Supabase stack, not the audited Supabase version (R1.4).**  
Evidence: report pages 12, 19, 20, 27, 43–45 say “Firebase Authentication”, “three containers (frontend, backend, db)”, “PostgreSQL: localhost:5432, database aarogya_db”, and “the application code does not import the Supabase client library”. The audited code imports and uses Supabase (`frontend/src/lib/supabase.ts:1-16`; `frontend/src/components/AuthCard.tsx:4-10,103-116`); `docker-compose.yml:1-37` has only `frontend` and `backend`, with a Supabase pooler URL on line 32; `frontend/src/lib/firebase.ts` was deleted in commit `6a5f72f` (“Supabase Changed”, 29 Oct 2026), one week after the report date (22 Oct 2026).  
Fix: rewrite Chapter 3 architecture, Table 3.2, Section 4.6, Appendix A/B, and the architecture/security diagrams for Supabase Auth + hosted PostgreSQL (or state clearly that the report describes the local fallback and the submission uses a different stack). Re-capture the screenshots if the visible layout/IDs changed.  
Effort: 3–5 h.

**M-02 — Security findings are partly false now: signed cookie and RLS were implemented (R1.4).**  
Evidence: report pages 19, 35–36, and Table 5.9 say “Session cookie is plain, unsigned data”, “No row-level security policies”, and “Unsigned session cookie; token not verified”. `frontend/src/lib/session.ts:9-40` now HMAC-signs the cookie; `database/rls_policies.sql:204-223` enables and forces RLS on all ten Supabase tables, with 33–34 policies and append-only audit rules; live query shows `relrowsecurity=true` and `relforcerowsecurity=true` for every table. What remains true: the Supabase API route does not verify the Supabase access token, so a POST containing only an existing e-mail still establishes a session (`frontend/src/app/api/auth/session/route.ts`, Supabase branch); the FastAPI endpoints still have no authentication of their own.  
Fix: update the security section and Table 5.9 to separate **fixed** controls (signed cookie, RLS, append-only audit policies) from **open** controls (API auth, Supabase token verification, CORS, emergency-window consistency). Do not claim “unsigned” or “no RLS”.  
Effort: 1–2 h.

**M-03 — Benchmark/reproducibility evidence is missing, and Appendix A is wrong for Supabase (R1.4/R6.2).**  
Evidence: report pages 11, 43–46 and 54–57 refer to `database/build_seed_700.py`, `initial_mock_data_load.sql`, and a `report-evidence/` folder. `git ls-files` contains none of these; the repo has only `database/initial_mock_data_load_fixed.sql`. Appendix A says `docker compose up -d --build` starts the database and loads three SQL files automatically; the audited `docker-compose.yml` starts only frontend/backend against an already-seeded Supabase project. The 5,000-patient benchmark (Table 5.7 / Figure 5.1) cannot be reproduced from the submitted repo.  
Fix: either add the generator, the 5,000-patient input, and `report-evidence/` (with exact commands), or remove the 5,000-patient claim and state that the 700-patient measurements are the reproducible ones. Rewrite Appendix A for the Supabase setup: apply `init_migration_001.sql`, `initial_mock_data_load_fixed.sql`, `seed_demo_consents.sql`, and `rls_policies.sql` to the Supabase SQL editor in that order.  
Effort: 3–5 h.

**M-04 — DA3 advanced-database outcomes and DA1/DA2/DA3 traceability are absent (R1.2/R1.5).**  
Evidence: the report says the project had “three stages … Digital Assignment 1 … Digital Assignment 2 … and this final project” (page 1); “DA3” appears **0** times. The course plan (`DIGITAL_ASSIGNMENT_PLAN_Final_Updated.docx`, not in the repo) assigns DA3 to NoSQL/MongoDB-Firebase collections, cloud deployment (Firebase/MongoDB Atlas/Supabase/Azure/AWS), SQL-vs-NoSQL comparison, backup/recovery, and security. The final report has no NoSQL section, no cloud-deployment evidence beyond an optional Supabase mention, no SQL-vs-NoSQL comparison, and no backup/recovery section. There is no traceability table mapping DA1/DA2/DA3 items to report pages/code.  
Fix: add a DA3 chapter or appendix with the cloud/Supabase deployment, NoSQL component/comparison, backup/recovery, and role/security evidence; add a traceability table. If the instructor confirms DA3 is not part of this report, record that confirmation in writing.  
Effort: 4–6 h, or instructor clarification.

**M-05 — A database secret is committed to the repository.**  
Evidence: `docker-compose.yml:32` tracks `postgresql+psycopg://postgres.izgtbzxrruajihrbxzyx:RFXsx2YSQQ%25_m.m@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`; the report’s Appendix A tells readers the compose file contains a development password. The Supabase anon/publishable key on lines 12–14 is not a secret; the database password is. `backend/.env` and `frontend/.env.local` are untracked but present on disk and could appear in a terminal screenshot/video.  
Fix: rotate the Supabase database password now, move it to an untracked `.env`, and purge it from the submitted archive/history if the repo is shared. Keep only the publishable anon key in the frontend.  
Effort: 30 min plus password rotation.

**M-06 — Figure 3.5 contains mojibake and stale security claims.**  
Evidence: `word/media/fig_layers.png` and report page 19 (PDF page 30) visibly show `â€¢`, `â€”`, `â€“` instead of bullets/dashes; the same figure says “Session cookie is plain, unsigned data”, “No row-level security policies”, and “audit_log is not append-only”. This is both a visual defect and a content contradiction (see M-02).  
Fix: replace the image with native text/shapes (also resolves part of B-02) and update the claims.  
Effort: 30–60 min.

**M-07 — DOCX metadata/template leftovers from another project.**  
Evidence: `docProps/app.xml` title is “AI-Powered Smart Health Monitoring System - BAXXX191 Project Report”; `docProps/core.xml` keywords are “Smart Health Monitoring, Isolation Forest, FastAPI, React, database”; the description says “Prepared from public repository documentation; personal and guide details require completion.” None belongs to AarogyaLink. This is unprofessional and an AI/template-reuse red flag.  
Fix: clear/update the document properties (Title, Subject, Keywords, Comments, Company), remove all old-project text, and re-save.  
Effort: 10–15 min.

**M-08 — Version/number drift between report and current Supabase code.**  
Evidence:
- Report page 5 says “35 REST endpoints”; the audited OpenAPI has **31 paths / 38 operations** (the two `/api/auth/local/*` endpoints are additional).
- Report page 20 says “Python 3.13”; the Docker image is `python:3.12-slim` (`backend/Dockerfile:1`), while `backend/.python-version` says 3.13.
- Report page 5 says 4,994 audit entries; its own Figure 4.6 on page 26 shows **4,996**.
- Report page 1 says eleven commits between 11 and 20 October; current repo has 12 commits and HEAD `6a5f72f` (29 Oct), after the report.
- Report says 306 doctors / 700 patients; those match the seed files, but the live Supabase project currently has 307/703 because of post-report test rows. State the snapshot instead of implying the live database is identical.
Fix: choose one snapshot (commit + date + DB state), update all counts/versions, and add a “snapshot” note near the evaluation.  
Effort: 1–2 h.

**M-09 — No automated tests or in-repo verification scripts.**  
Evidence: `git ls-files` contains no test/spec paths; the report admits “the repository contains no automated test suite (there are no test files in the backend or the frontend)” (page 29). All verification is manual/scripted outside the submitted repo; the `report-evidence/` folder is missing (M-03).  
Fix: add at least pytest tests for `fn_has_consent`, visit transaction/rollback, and one API flow, plus SQL tests for the nine constraint cases; or submit the exact verification scripts with the report.  
Effort: 4–8 h.

### MINOR

**m-01 — Chapter titles are not real Heading 1 styles; TOC and lists are static text.**  
Evidence: 58 `Heading2`, 5 `Heading3`, **0** `Heading1`; chapter titles (“CHAPTER 1”, etc.) are Normal style. Word reports `TOC: 0` and `Indexes: 0`; the TOC/list of tables/list of figures are manually typed tables. They are accurate at this snapshot but will not update after edits.  
Fix: apply Heading 1 to chapter titles and insert real TOC/list-of-figures/list-of-tables fields.  
Effort: 30–45 min.

**m-02 — Table header wrapping.**  
Evidence: “SQLSTA TE” on page 30 (Table 5.2) and “idx_consent_patient_stat us” on page 34 (Table 5.7).  
Fix: widen the column or reduce the header font.  
Effort: 10 min.

**m-03 — Screenshot legibility and the admitted UI defect.**  
Evidence: Figure 4.7 (duplicate-test report, page 26) has very low-contrast row text; Figure 4.1 (page 23) shows “undefined days left” in the medicines panel, which the report itself calls a defect.  
Fix: re-capture Figure 4.7 with readable contrast; fix the days-left calculation or crop the defect out of the screenshot; update the text if fixed.  
Effort: 20–40 min.

**m-04 — Several references are not cited in the body.**  
Evidence: references 7–15 (Codd, Chen, Elmasri, Silberschatz, PostgreSQL, FastAPI, SQLAlchemy, Next.js, Docker) and 6 (ABDM) are largely uncited; in-text author-year citations exist only for the five studies and Kim (e.g., page 6). The reference list is consistent in style but not fully mapped to the text.  
Fix: add in-text citations where those sources support statements, or remove uncited entries.  
Effort: 30 min.

**m-05 — Page 37 (printed page 26) is images-only and figures precede their discussion.**  
Evidence: Figures 4.6 and 4.7 occupy page 37 with only captions; the discussion starts on page 38 (printed 27). No blank page, but the layout is unbalanced.  
Fix: reflow the figures with their paragraphs or add a short lead-in on page 37.  
Effort: 20 min.

**m-06 — Title-page/team identity details.**  
Evidence: page 1 has no author block; authors appear on page 2. “MUDIT” and “MAYANK” have no surnames, while `git shortlog` shows only Archit Kumar Singh (17 commits) plus “git stash” (3); there is no contribution table.  
Fix: add full names and a contribution table; explain non-commit contributions in the video.  
Effort: 20 min + evidence gathering.

---

## 5. Cannot-verify list

| Item | Why it cannot be verified here | Exact manual step | Owner |
|---|---|---|---|
| Turnitin similarity | Only Turnitin can produce the score; no submission receipt/report is in the repo. | If the course allows a draft, submit the exact final file and read the Turnitin report; otherwise upload early and keep the receipt. | Team |
| AI-detection percentage | Only Turnitin’s AI indicator can measure it; the audit only rates style risk (MEDIUM). | Run the same draft/final through the portal’s AI checker; keep the report. | Team |
| Video accessibility/duration/coverage | No URL on page 1 and no video file in the repo or searched folders. | Add the link, then open it in a private/logged-out window; confirm “Anyone with the link” and 5:00–10:00 duration; tick intro/problem/objectives/methodology/implementation/demo/results. | Team |
| All-member participation | Git history shows only Archit; Mudit/Mayank have no commits, which can be legitimate (design/testing/docs). | Provide a contribution matrix and ensure each member speaks in the video; be ready to explain in viva. | Team |
| Exact deadline | No deadline/Turnitin instruction is in the repo or report. | Read the portal/LMS instruction and screenshot the deadline; confirm the timezone. | Team |
| 5,000-patient benchmark | `initial_mock_data_load.sql`, `database/build_seed_700.py`, and `report-evidence/` are absent. | Add the files and exact commands, or remove the claim (M-03). | Team |
| Clean-clone Supabase demo | The default compose does not create/seed the Supabase database; the hosted project is already seeded. | Create a fresh Supabase project, run the four SQL files in order, point the backend at it, and repeat the demo. | Team |
| DA3 instructor scope | The course plan assigns NoSQL/cloud/SQL-vs-NoSQL/backup to DA3, but the report/repo do not cover them. | Ask the instructor whether DA3 is part of this report; record the answer. | Team |
| Print-size screenshot legibility | The PDF was rendered and inspected, but the evaluator’s print/zoom settings are unknown. | Print page 26 and page 23 at 100%; if the table text is unreadable, re-capture. | Team |

---

## 6. Traceability table and feature ledger

### 6.1 DA1 / DA2 / DA3 → final report → code

| Item | DA1 | DA2 | DA3 | Final report (printed page) | Code / evidence | Verdict |
|---|---|---|---|---|---|---|
| Problem statement, actors, objectives | Yes (`DA1_Report.docx` §1–2) | — | — | Ch. 1, pp. 1–3; Table 1.1 p. 2 | README; report | PASS |
| Literature survey (5 studies) | Yes (`DA1_Report.docx` §3) | — | — | Ch. 2, pp. 6–9; Table 2.1 | References 1–5 | PASS |
| Requirements | Yes (`DA1_Report.docx` §2) | — | — | Table 1.2 p. 4 | Report/README | PASS |
| ER/EER model, data dictionary | Yes | — | — | Fig. 3.2 p. 13; Table 3.3 p. 14 | `database/init_migration_001.sql` | PASS (diagram is pasted PNG → R2 FAIL) |
| Normalization/BCNF | Yes | — | — | §3.4 pp. 13–15 | Schema/tables | PASS |
| Schema, keys, constraints | — | Yes (`docs/AarogyaLink_DA2_SQL_Queries.md` §2–3) | — | Ch. 3–4; Table 5.2 p. 30 | `init_migration_001.sql` | PASS |
| CRUD/joins/nested/aggregate queries | — | Yes | — | Ch. 3, App. B | `docs/AarogyaLink_DA2_SQL_Queries.md` | PASS |
| Views/functions/triggers/indexes | — | Yes | — | §3.6 pp. 15–17; Table 3.5 | SQL files | PASS |
| Transactions/rollback | — | Yes | — | §3.7, §5.3 pp. 31–32 | Backend + SQL | PASS |
| NoSQL / document database | — | — | Required by course plan | **Absent** | No Mongo/Firebase/NoSQL code | FAIL |
| Cloud database deployment | — | — | Supabase/Firebase/Atlas/Azure/AWS | Only optional mentions; default now Supabase but not documented | `docker-compose.yml`; `supabase.ts` | PARTIAL |
| SQL vs NoSQL performance | — | — | Required | **Absent** | No benchmark | FAIL |
| Backup/recovery, roles, security | — | — | Required | Security partial; no backup | RLS/security code; no backup script | PARTIAL |
| Frontend/portal implementation | — | — | Final project | Ch. 4 pp. 20–28 | `frontend/src/app/**`, `components/**` | PASS |
| Evaluation/results | — | — | — | Ch. 5 pp. 29–36 | Manual scripts outside repo | PARTIAL (5,000 evidence missing) |
| Mandatory video | — | — | — | **Absent** | No file/URL | FAIL |

### 6.2 Feature ledger (ground truth)

- **Pages:** `/`, `/dashboard`, `/consents`, `/patients`, `/patients/[id]`, `/visits/new`, `/duplicates`, `/hospitals`, `/hospitals/[id]`, `/audit`.
- **API:** 31 OpenAPI paths / 38 operations, including patients, doctors, hospitals, consents, visits, audit, duplicates, stats, auth, health. The report says 35 endpoints.
- **Database (Supabase):** `admin_user`, `audit_log`, `consent`, `diagnosis`, `doctor`, `hospital`, `lab_test`, `patient`, `prescription`, `visit`; view `v_duplicate_lab_tests`; `fn_has_consent`, `sp_grant_consent`, trigger `tr_visit_audit`; four B-tree indexes; RLS enabled + forced on all ten tables (33–34 policies).
- **Local-only additive table:** `auth_user` (created by `database/local/00_local_auth_compat.sql`; not present in the audited Supabase database).
- **Auth/roles:** default Supabase Auth; browser signs in, `/api/auth/session` resolves the role and sets an HMAC-signed httpOnly cookie; roles patient/doctor/admin; local password mode exists only with `AUTH_MODE=local`.
- **External services:** Supabase Auth + Supabase PostgreSQL (default); Docker for frontend/backend; local PostgreSQL optional.
- **Versions:** Next.js 16.4.2, React 19.3.0, TypeScript 5, FastAPI ≥0.143, Python 3.12 in Docker (`.python-version` 3.13), SQLAlchemy 2.x, psycopg 3.x, PostgreSQL 17.
- **Tests:** none tracked; no pytest/vitest/playwright configuration.
- **Seeded demo data:** 50 hospitals, 306 doctors, 700 patients, 1,324 visits, 3,059 consents, 4,994 audit entries per the report/seed; live Supabase currently shows 703/307/3,061/5,012 because of post-report/test rows. The report must state which snapshot it describes.
- **Demo path (for the video):** landing → Karthik Iyer persona (Supabase password `AarogyaLink@123`) → dashboard → consent page (grant/revoke) → sign in as Dr. Rohan Mehta → open Karthik’s chart → open Devansh Gupta (blocked) → break-glass with reason → admin duplicates/hospitals/audit. A direct Supabase Auth check for the Karthik persona returned a valid access token; the full browser click-path still needs a dry run.

---

## 7. Viva questions (12–15)

1. The report says Firebase Authentication, but the code uses Supabase Auth. Which is the submitted architecture, and why was the switch not documented?
2. Show the `db` service that Appendix A says `docker compose up -d --build` starts. If it is absent, how does a clean clone create and seed the Supabase database?
3. The report says the session cookie is unsigned; `frontend/src/lib/session.ts` signs it. Which statement is current, and what remains unverified (Supabase access token / API auth)?
4. The report says there are no RLS policies; `database/rls_policies.sql` enables and forces RLS on every table. Explain the doctor/hospital consent policy and why it is safe.
5. Walk through `fn_has_consent('PAT-IN-1006','DOC-01')`. Why is it false, and which row in Table 5.4 proves it?
6. Why does `v_duplicate_lab_tests` ignore `idx_lab_test_name_date`? What would you change to make the duplicate view scale?
7. Explain the BCNF decomposition of one table and the functional dependency that drove it.
8. How does `tr_visit_audit` guarantee exactly one audit row per visit? What happens to the audit row if the transaction rolls back?
9. The report records a 30-minute emergency window but the emergency check looks back 24 hours. Is this fixed? What is the correct rule?
10. How are identities and passwords handled in Supabase mode vs local mode? Which mode will the demo/video use?
11. Where is the 5,000-patient data set? Reproduce one timing from Table 5.7 using the submitted repository.
12. The code exposes 38 API operations across 31 paths; the report says 35 endpoints. Which three are missing from the report, and does that matter?
13. Why is `admin_user` outside the nine BCNF tables, and how is it protected now that RLS is enabled?
14. Which DA3 outcomes (NoSQL, cloud deployment, SQL-vs-NoSQL comparison, backup/recovery) are demonstrated, and on which page?
15. Git history shows only Archit; explain Mudit’s and Mayank’s contributions and their speaking slots in the video.

---

## 8. Bottom line

Fix the two blockers first. Then reconcile the report to the Supabase version; otherwise the evaluator will find a report that describes Firebase, a local `db` container, an unsigned cookie, and no RLS while the submitted code uses Supabase Auth/Postgres, a signed cookie, and 33–34 RLS policies. Do not submit until the video link is on page 1 and the six pasted diagrams/charts are native.
