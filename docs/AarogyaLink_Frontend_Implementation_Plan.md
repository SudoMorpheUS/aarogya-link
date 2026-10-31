# AarogyaLink --- Frontend & Full-Stack Implementation Plan

**Project:** Multi-Hospital Health Data Sharing Platform\
**Purpose:** Build a working web application on top of the existing
PostgreSQL database and demonstrate patient records, visits, clinical
history, consent-based access, cross-hospital sharing, duplicate-test
detection, and audit trails.

> **Implementation baseline:** React + Next.js (Node.js) frontend, FastAPI (Python,
> managed with `uv`) backend, PostgreSQL database, Docker Compose for
> local development. Keep the existing database schema and SQL objects
> as the source of truth; implement APIs that map to them rather than
> recreating database logic in the browser.

------------------------------------------------------------------------

## 1. What the final application should do

AarogyaLink should let authorized users from multiple hospitals retrieve
a patient's relevant medical history without giving every user
unrestricted access to every record.

The main demo flow should be:

1.  A user signs in.
2.  The user lands on a dashboard showing useful system counts and
    recent activity.
3.  The user searches for a patient using a patient ID or another
    permitted identifier.
4.  The backend checks whether the signed-in user is allowed to access
    the patient.
5.  If access is permitted, the user opens the patient's longitudinal
    timeline: visits, diagnoses, prescriptions, and lab tests from
    participating hospitals.
6.  The user can review or request/grant consent according to their role
    and the project's consent workflow.
7.  The user can view potential duplicate lab tests performed at
    different hospitals.
8.  Important reads and changes are written to the audit log.
9.  The UI displays clear success, empty, loading, and error states.

Use **synthetic/demo patient data only** for development and
demonstrations. Do not use real patient records in screenshots, seed
data, or public repositories.

------------------------------------------------------------------------

## 2. Existing database: entities the UI must support

The supplied SQL file describes PostgreSQL tables and supporting
database objects. Use these existing names in the backend's data-access
layer.

  ------------------------------------------------------------------------------
  Database object           Purpose in the application   Main screens / API use
  ------------------------- ---------------------------- -----------------------
  `patient`                 Patient identity and         Patient search, patient
                            contact/profile fields       summary

  `hospital`                Participating hospitals      Hospital directory,
                                                         filters, admin views

  `doctor`                  Doctors, their hospital, and Doctor directory, visit
                            specialization               details

  `visit`                   Patient encounter at a       Timeline, visit
                            hospital                     details, create visit

  `diagnosis`               Diagnoses associated with a  Clinical timeline and
                            visit                        visit detail

  `prescription`            Medicine, dosage, frequency, Visit detail
                            duration                     

  `lab_test`                Test name, result, unit, and Lab history and
                            date                         duplicate-test review

  `consent`                 Patient-to-hospital/doctor   Consent management and
                            access permissions           access checks

  `audit_log`               Logged actions and           Audit history/admin
                            timestamps                   review

  `v_patient_timeline`      Joined patient visit history Timeline API (verify
                            and counts                   the view exists)

  `v_duplicate_lab_tests`   Potential repeated tests     Duplicate-test
                            across hospitals             dashboard (verify the
                                                         view exists)

  `v_hospital_caseload`     Hospital-level activity      Dashboard (verify the
                            aggregates                   view exists)

  `fn_has_consent(...)`     Database consent check       Backend authorization
                                                         service

  `sp_grant_consent(...)`   Creates an active consent    Consent service
                            row                          

  `visit_audit` trigger     Automatically records visit  Audit verification
                            inserts                      

  Consent audit trigger     Implied by the SQL notes,    Implement and test
                            definition not included      before relying on it
  ------------------------------------------------------------------------------

**Important schema checks before building screens**

-   Confirm the actual database/view/function names in the running
    database. The supplied SQL notes say some view definitions were
    missing from the original assignment and provide suggested
    definitions.
-   The `patient` table has no login credentials. Do not authenticate a
    user by collecting a patient ID alone.
-   The schema does not currently define an application-user/role table.
    Add an `app_user` table or equivalent identity provider integration
    before implementing real login and role-based access. For the demo,
    seed clearly labelled test accounts with hashed passwords.
-   The schema does not include a dedicated `consent_request` table or a
    detailed patient self-service workflow. If the UI needs pending
    requests, either add a designed request table/API or clearly limit
    the first version to granting/revoking active consent.
-   A database function is not a substitute for endpoint-level
    authorization. Every protected API must identify the authenticated
    user and check their permissions.

------------------------------------------------------------------------

## 3. Technology and repository layout

### Stack

-   **Frontend:** React, Next.js (App Router), TypeScript. Routing is built into Next.js.
-   **UI and styling:** CSS modules or a consistent global CSS design
    system. Use reusable components rather than styling every page
    independently.
-   **API calls:** `fetch` or Axios, with one shared API client.
-   **Backend:** FastAPI, Python, `uv`, Pydantic request/response
    models.
-   **Database:** PostgreSQL, using the existing schema and SQL
    functions/views.
-   **Database access:** SQLAlchemy 2.x or psycopg 3. Choose one
    approach and use it consistently. If writing SQL directly, use
    parameterized queries.
-   **Authentication:** Secure server-managed session cookie or a
    well-designed token approach. For a browser application, an
    HttpOnly, Secure-in-production cookie is a strong default.
-   **Deployment for development:** Docker Compose for `frontend`,
    `backend`, and `db`.

### Suggested structure

``` text
aarogya-link/
├── docker-compose.yml
├── .env.example
├── README.md
├── database/
│   ├── initial_mock_data_load.sql
│   ├── migrations/
│   └── seed_demo_data.sql
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── uv.lock
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   └── permissions.py
│   │   ├── db/
│   │   │   ├── session.py
│   │   │   └── queries/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── repositories/
│   │   ├── services/
│   │   └── routers/
│   │       ├── auth.py
│   │       ├── dashboard.py
│   │       ├── patients.py
│   │       ├── visits.py
│   │       ├── hospitals.py
│   │       ├── doctors.py
│   │       ├── consents.py
│   │       ├── duplicate_tests.py
│   │       └── audit.py
│   └── tests/
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── next.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── routes/
        ├── layouts/
        ├── pages/
        ├── components/
        ├── features/
        │   ├── auth/
        │   ├── dashboard/
        │   ├── patients/
        │   ├── timeline/
        │   ├── consent/
        │   ├── duplicate-tests/
        │   └── audit/
        ├── api/
        │   ├── client.ts
        │   └── endpoints.ts
        ├── hooks/
        ├── types/
        ├── utils/
        └── styles/
```

Keep business rules in the backend. The frontend should render API
results and provide a usable workflow; it must not directly connect to
PostgreSQL or decide that access is allowed.

------------------------------------------------------------------------

## 4. Frontend pages and exact requirements

### 4.1 Sign-in page

**Purpose:** Establish the identity of the person using the application.

**UI elements** - AarogyaLink logo/name and short explanation. -
Email/username and password fields. - Show/hide password control. -
Sign-in button, inline validation, and an error message for invalid
credentials. - Loading state while the request is in progress. -
Optional demo-account information in a clearly marked development-only
area.

**Behavior** - Submit credentials to `POST /api/v1/auth/login`. - On
success, load the authenticated user and role, then navigate to the
dashboard. - On failure, show a generic message; do not reveal whether a
particular account exists. - Do not store plaintext passwords or
long-lived secrets in browser storage.

### 4.2 Main application layout

**Purpose:** Provide consistent navigation and identity context on all
protected pages.

**Components** - Sidebar navigation: Dashboard, Patient Search,
Hospitals, Doctors, Duplicate Tests, Consent, Audit Log
(role-dependent). - Top bar: current hospital, signed-in user, role
badge, profile/menu, sign-out. - Main content area with page title and
breadcrumbs. - Responsive sidebar that collapses on narrow screens. -
Toast/alert area for action feedback.

Navigation visibility is a convenience, not a security boundary. The
backend must enforce access regardless of which page a user opens.

### 4.3 Dashboard

**Purpose:** Give a quick overview of activity across the network.

**Recommended cards** - Total registered patients. - Total hospitals and
doctors. - Visits in the selected period. - Active consent count (only
if the query and definition are agreed). - Potential duplicate-test
cases requiring review. - Recent audit events, limited by role.

**Visuals** - Visits by hospital. - OPD / Emergency / Inpatient
breakdown. - Recent activity table.

**Behavior** - Load dashboard data from one aggregated endpoint. -
Include loading skeletons, empty states, and a retry option. - Label all
figures as demo data if the seed dataset is being used. - Avoid
displaying patient names or sensitive details in aggregate widgets
unnecessarily.

### 4.4 Patient search

**Purpose:** Find the correct patient before opening clinical records.

**UI elements** - Search input for patient ID or name, subject to the
access policy. - Search button and Enter-to-search support. - Optional
filters: hospital, visit date range, and blood group only if
justified. - Results table: patient ID, patient name, date of birth/age,
and permitted summary fields. - Pagination and clear "no results" state.

**Behavior** - Call
`GET /api/v1/patients?query=...&page=...&page_size=...`. - Do not
download the full patient table to filter it in the browser. - Avoid
exposing contact details in the search result unless required. -
Selecting a result opens the patient profile. The profile endpoint must
perform its own authorization check.

### 4.5 Patient profile and clinical timeline

**Purpose:** Show a consolidated, chronological view of a patient's
encounters across hospitals.

**Header/summary** - Patient ID and name. - Date of birth, gender, blood
group, and only those contact fields the current role is allowed to
see. - Consent/access status for the current user/hospital. - Clear
indicator when access is denied or consent is absent.

**Timeline** - Visit date and visit type. - Hospital and doctor. - Chief
complaint. - Diagnoses attached to the visit. - Prescriptions with
medicine, dosage, frequency, and duration. - Lab tests with result,
unit, and test date. - Expand/collapse each visit to keep the page
readable. - Sort newest first by default; optionally let users switch
order.

**Behavior** - Fetch patient summary and timeline through separate or
well-designed combined endpoints. - Use `v_patient_timeline` only if it
exists and returns the fields needed; fetch diagnoses, prescriptions,
and labs using related endpoints or a response assembled by the
backend. - Clearly distinguish "no records found" from "records
unavailable because permission is missing." - Do not interpret lab
results or provide diagnosis/treatment recommendations. This is a
records-sharing tool.

### 4.6 Visit details and visit entry

**Purpose:** Allow authorized staff to inspect an encounter and, if
included in scope, record a new one.

**Read view** - Visit ID, date, visit type, hospital, doctor, and
complaint. - Diagnoses, prescriptions, and lab results linked to that
visit. - Audit information when appropriate.

**Create visit (optional for first demo, recommended if CRUD is
assessed)** - Patient selector/search. - Doctor selector restricted to
the user's hospital where applicable. - Visit type: OPD, Emergency,
Inpatient. - Chief complaint. - Optional diagnosis, prescription, and
lab-test sections.

**Validation** - Enforce required fields and valid visit types in both
frontend and backend. - Ensure the selected doctor/hospital relationship
is valid. - Use a transaction if a single workflow creates a visit plus
associated records. - Confirm success and refresh the timeline. The
database's visit audit trigger should create the relevant audit record.

### 4.7 Consent management

**Purpose:** Make patient permission visible and manageable.

**Consent table** - Patient ID/name where permitted. - Authorized
hospital and/or doctor. - Start date and end date. - Status: Active or
Revoked. - Actions available to the current role.

**Grant consent form** - Patient. - Target hospital and/or doctor. -
Start date. - Optional end date. - Clear explanation of what access the
permission enables. - Confirmation step before submission.

**Revoke consent** - Show the active permission and its scope. - Require
confirmation before revocation. - Update the displayed state only after
the server confirms success.

**Behavior** - Use `POST /api/v1/consents` to grant consent and a
dedicated revoke endpoint to revoke it. - Call `fn_has_consent` or
equivalent backend service before protected record retrieval. - Check
consent scope, status, start date, and end date on the server. - The
supplied schema uses `Active` and `Revoked`; match these exact values
unless a migration changes them. - The schema has no pending-request
entity. Do not display "pending requests" as if persisted unless a
request workflow/table is implemented. - Log grants/revocations in
`audit_log`. Confirm whether the consent trigger exists; the source SQL
only describes it as implied.

### 4.8 Duplicate lab-test review

**Purpose:** Help staff identify tests that may have been repeated at
different hospitals.

**Table columns** - Patient ID/name, if permitted. - Test name. - Number
of times run. - First and latest test dates. - Number of hospitals
involved. - Hospital names.

**Behavior** - Use `GET /api/v1/duplicate-tests`. - Back the endpoint
with `v_duplicate_lab_tests` or a tested equivalent query. - Filters:
test name, date range, hospital, and patient, where appropriate. -
Clicking a row should open the relevant patient's timeline if the user
is authorized. - Describe results as **potential duplicates for
review**, not proof that a test was unnecessary. Clinical context and
timing matter.

### 4.9 Hospital directory and caseload

**Purpose:** Show participating hospitals and their activity.

**Hospital directory** - Hospital name, address, and public/contact
fields required for the demo. - Search and sort. - Detail view with
doctors and summary statistics, subject to role.

**Caseload** - Doctor count, visit count, patient count. - OPD,
Emergency, and Inpatient totals.

**Behavior** - Use the hospital list endpoint and `v_hospital_caseload`
if the view is present and verified. - Prevent a regular hospital user
from seeing restricted cross-hospital operational data unless the access
policy permits it.

### 4.10 Doctor directory

**Purpose:** Find doctors by hospital and specialization.

**Columns** - Doctor name, specialization, hospital. - License number
only for roles that need it.

**Behavior** - Search by name, specialization, or hospital. - Use
`GET /api/v1/doctors`. - Filter doctors by the current hospital for
hospital-scoped users when appropriate.

### 4.11 Audit log

**Purpose:** Provide accountability for access and data changes.

**Columns** - Timestamp. - Patient ID. - Acting doctor/user where
available. - Action. - Details. - Filters by date, action, patient, and
hospital where supported.

**Behavior** - Use `GET /api/v1/audit-logs` with server-side
pagination. - Restrict access to authorized roles. - Never allow the
frontend to edit or delete audit events. - Ensure successful
patient-record reads are logged if the project's requirements call for
access auditing; the current `visit_audit` trigger logs visit inserts,
not all reads. - Consider adding an authenticated application-user ID
and request metadata to audit events through a migration if required. Do
not claim the current schema captures data it does not contain.

### 4.12 Access denied, not found, and system states

Build reusable pages/components for: - 401: sign-in required. - 403:
access denied / consent not sufficient. - 404: patient or record not
found. - 422: validation errors. - 500/network errors: generic error
with retry. - Empty table: no matching records. - Loading skeletons and
disabled submit buttons during requests.

Avoid revealing whether a patient exists when the caller is not
permitted to know that fact, if that is part of the security policy.

------------------------------------------------------------------------

## 5. Reusable frontend components

Build these once and reuse them:

-   `AppLayout`, `Sidebar`, `Topbar`, `Breadcrumbs`
-   `PageHeader`, `StatCard`, `DataTable`, `Pagination`
-   `SearchInput`, `FilterBar`, `DateRangeFilter`
-   `StatusBadge`, `ConsentStatus`, `VisitTypeBadge`
-   `Modal`, `ConfirmDialog`, `FormField`
-   `LoadingSkeleton`, `EmptyState`, `ErrorState`
-   `ToastProvider` or a small alert system
-   `ProtectedRoute`, `RoleGuard` (UI-only convenience; backend remains
    authoritative)
-   `PatientSummaryCard`, `VisitTimeline`, `VisitCard`
-   `DiagnosisList`, `PrescriptionList`, `LabResultTable`
-   `ConsentForm`, `ConsentTable`
-   `DuplicateTestTable`, `AuditLogTable`

Use accessible labels, keyboard navigation, visible focus states,
adequate contrast, and responsive layouts. Do not rely on color alone to
communicate consent or error status.

------------------------------------------------------------------------

## 6. Backend API contract

Use a versioned prefix such as `/api/v1`. Define request/response
schemas and consistent error responses before connecting every screen.

  --------------------------------------------------------------------------------------------
  Method            Endpoint                              Purpose           Access notes
  ----------------- ------------------------------------- ----------------- ------------------
  `POST`            `/auth/login`                         Authenticate a    Rate-limit;
                                                          user              generic
                                                                            invalid-login
                                                                            error

  `POST`            `/auth/logout`                        End session       Authenticated
                                                                            session

  `GET`             `/auth/me`                            Current user,     Authenticated
                                                          role, hospital    
                                                          scope             

  `GET`             `/dashboard/summary`                  Aggregate         Role-scoped
                                                          dashboard figures 

  `GET`             `/patients`                           Search/list       Permission-aware
                                                          patients with     
                                                          pagination        

  `GET`             `/patients/{patient_id}`              Patient summary   Check
                                                                            authorization

  `GET`             `/patients/{patient_id}/timeline`     Visits and        Check consent and
                                                          clinical history  role

  `GET`             `/visits/{visit_id}`                  Visit plus        Check
                                                          associated        authorization
                                                          details           

  `POST`            `/visits`                             Create a visit    Authorized
                                                                            clinical staff
                                                                            only

  `GET`             `/hospitals`                          Search/list       Role-scoped fields
                                                          hospitals         

  `GET`             `/hospitals/{hospital_id}/caseload`   Hospital          Role-scoped
                                                          statistics        

  `GET`             `/doctors`                            Search/list       Role-scoped fields
                                                          doctors           

  `GET`             `/consents`                           List relevant     Patient/role scope
                                                          permissions       

  `POST`            `/consents`                           Grant consent     Validate scope and
                                                                            dates

  `POST` or `PATCH` `/consents/{consent_id}/revoke`       Revoke consent    Authorized actor;
                                                                            audit action

  `GET`             `/duplicate-tests`                    Potential         Check permission
                                                          duplicate tests   for patient
                                                                            details

  `GET`             `/audit-logs`                         Paginated audit   Restricted roles
                                                          history           

  `GET`             `/health`                             Service health    No sensitive
                                                                            details
  --------------------------------------------------------------------------------------------

**Suggested response conventions** - Use Pydantic schemas; do not return
database rows blindly. - Use `limit`/`page_size` and cursor/page
pagination for large result sets. - Return ISO-8601 timestamps and
dates. - Return stable IDs as strings/numbers consistent with the
schema. - Use `401` for unauthenticated, `403` for authenticated but
unauthorized, `404` for not found, and `422` for invalid input. - Keep
error messages helpful but avoid returning SQL, stack traces,
credentials, or sensitive record data.

------------------------------------------------------------------------

## 7. Authentication, authorization, and privacy requirements

This application handles sensitive health records. Treat these as core
requirements, not optional polish.

1.  **Identity:** Add an application-user model/table or use a managed
    identity provider. At minimum, a demo user should have an ID,
    username/email, password hash, role, and hospital scope.
2.  **Password security:** Hash passwords with a suitable
    password-hashing algorithm (for example Argon2id or bcrypt); never
    store plaintext passwords.
3.  **Authorization:** Define roles such as `admin`, `doctor`,
    `hospital_staff`, and optionally `patient`. Document which endpoints
    and fields each role may access.
4.  **Consent:** Validate consent on the backend for every protected
    cross-hospital record request. Check target doctor/hospital, active
    status, start/end dates, and any role-specific rules.
5.  **Least privilege:** Return only fields needed for a screen. Do not
    return contact information, license numbers, or full clinical
    history by default.
6.  **Sessions:** Prefer HttpOnly cookies for browser sessions,
    configure CORS narrowly, use CSRF protection when cookie-based auth
    requires it, and expire sessions.
7.  **Transport and secrets:** Use HTTPS in production. Keep secrets in
    environment variables; commit only `.env.example`.
8.  **Audit:** Log sensitive reads and all important writes if required
    by the policy. Record actor, patient, action, timestamp, and
    sufficient context without copying excessive clinical detail into
    logs.
9.  **Input safety:** Parameterize SQL, validate IDs and filters,
    enforce request-size limits, and never interpolate user input into
    SQL strings.
10. **Data minimization:** Use synthetic records for development. Avoid
    placing health information in browser logs, analytics, URLs, or
    error telemetry.
11. **Production warning:** A classroom/demo implementation is not
    automatically compliant or safe for real patient data. A real
    deployment needs formal security review, privacy/legal review,
    operational controls, backups, and monitoring.

------------------------------------------------------------------------

## 8. Frontend-to-backend integration rules

-   Put the API base URL in `API_BASE_URL` (server-side env); do not hard-code it in
    each component.
-   In Docker Compose, the browser normally calls the published host
    address (for example `http://localhost:8000`), not the internal
    Docker service name `backend`. Container-to-container calls use
    service names; browser-to-container calls use exposed host ports.
-   Create one API client that attaches credentials consistently, parses
    JSON, and normalizes errors.
-   Use React Query/TanStack Query or a consistent custom hook pattern
    for loading, caching, refetching, and invalidating data.
-   Keep API types in `src/types` and share a documented contract; do
    not duplicate business logic in the frontend.
-   Never put PostgreSQL credentials in `NEXT_PUBLIC_*` environment
    variables. Any `NEXT_PUBLIC_*` value is exposed to the browser bundle.
-   Handle expired sessions by redirecting to sign-in and clearing
    cached protected data.
-   After a consent or visit mutation succeeds, invalidate the relevant
    patient/timeline/dashboard queries.
-   Avoid showing optimistic success for access-control changes; wait
    for the server response.

------------------------------------------------------------------------

## 9. Database readiness checklist

Before connecting the UI, verify the database can support every page.

-   [ ] PostgreSQL starts successfully using Docker Compose.
-   [ ] All nine core tables exist: `patient`, `hospital`, `doctor`,
    `visit`, `diagnosis`, `prescription`, `lab_test`, `consent`,
    `audit_log`.
-   [ ] Foreign keys and uniqueness constraints are present.
-   [ ] Demo rows exist for visits, diagnoses, prescriptions, lab tests,
    and consents---not just patients/hospitals/doctors.
-   [ ] The seed data contains cross-hospital visits for at least one
    synthetic patient.
-   [ ] `v_patient_timeline`, `v_duplicate_lab_tests`, and
    `v_hospital_caseload` exist and return expected columns.
-   [ ] `sp_grant_consent` and `fn_has_consent` exist and are tested
    against valid, expired, revoked, hospital-scoped, and doctor-scoped
    consent cases.
-   [ ] `visit_audit` trigger works.
-   [ ] Consent-change audit behavior is implemented and tested if
    required.
-   [ ] Application-user/role storage exists, or external identity
    integration is configured.
-   [ ] Database migrations are versioned. Do not depend on manually
    running an undocumented SQL sequence every time.
-   [ ] Seed data is repeatable or has a clear reset procedure.
-   [ ] Tests cover invalid foreign keys and duplicate unique values.

**Source note:** The provided SQL notes use PostgreSQL-specific
features. Keep PostgreSQL as the database; do not try to run these
scripts unchanged on MySQL or SQLite.

------------------------------------------------------------------------

## 10. Implementation phases and deliverables

### Phase 1 --- Confirm the foundation

-   Start all three Docker Compose services.
-   Verify `/health`, FastAPI `/docs`, and the frontend dev server.
-   Confirm the database schema, views, functions, triggers, and mock
    data.
-   Add migrations for missing application-user and audit fields if
    needed.

**Done when:** all services start reproducibly and database checks pass.

### Phase 2 --- Build the frontend shell

-   Configure React Router.
-   Build sign-in page, protected application layout, sidebar, top bar,
    page headers, table, status badge, loading/empty/error components.
-   Establish visual tokens for typography, spacing, borders, and
    colors.

**Done when:** every planned page has a navigable placeholder and the
layout works on desktop and mobile.

### Phase 3 --- Authentication and roles

-   Implement login/logout/current-user APIs.
-   Add password hashing, session handling, and role/hospital scope.
-   Add frontend protected routes and sign-out behavior.

**Done when:** unauthenticated users cannot access protected APIs and
role restrictions are tested server-side.

### Phase 4 --- Patient search and profile

-   Implement patient search, patient summary, and timeline endpoints.
-   Connect search page, profile header, and visit timeline.
-   Add pagination, empty states, and permission-denied handling.

**Done when:** a seeded synthetic patient can be searched and their
permitted cross-hospital history displays correctly.

### Phase 5 --- Consent workflow

-   Implement listing, granting, and revoking consent.
-   Apply consent checks to the timeline/visit endpoints.
-   Add audit logging for consent changes.
-   Test active, expired, revoked, doctor-scoped, and hospital-scoped
    cases.

**Done when:** access changes on the backend as soon as consent changes,
and the UI accurately reflects the result.

### Phase 6 --- Dashboard and directories

-   Add dashboard summary, hospital directory/caseload, and doctor
    directory APIs.
-   Add dashboard cards, chart(s), and filterable tables.

**Done when:** figures reconcile with SQL queries and respect the
signed-in user's scope.

### Phase 7 --- Duplicate tests and audit log

-   Verify duplicate-test view/query.
-   Build duplicate-test review table and audit-log table.
-   Ensure access to patient-linked details is authorized.

**Done when:** a seeded cross-hospital repeated test appears and the
audit page shows real recorded actions.

### Phase 8 --- Optional clinical CRUD

-   Add create-visit and, if required, diagnosis/prescription/lab entry
    forms.
-   Validate transactions and verify triggers.
-   Add confirmation and error recovery.

**Done when:** authorized staff can create a test encounter and see it
on the timeline with an audit entry.

### Phase 9 --- Testing and final demo

-   Run backend tests, frontend checks, and end-to-end demo flow.
-   Test responsive layouts and common failures.
-   Prepare a resettable demo dataset and presentation script.

**Done when:** a fresh checkout can be started from documented commands
and the complete demo works without manual database repair.

------------------------------------------------------------------------

## 11. Test plan

### Backend/API tests

-   Login success, invalid credentials, logout, expired session.
-   Patient search pagination and invalid filters.
-   A user cannot read a patient outside their permissions.
-   Active consent allows the defined access; expired/revoked consent
    does not.
-   Doctor-specific and hospital-specific consent scopes are
    distinguished correctly.
-   A doctor cannot create a visit under an unrelated hospital.
-   Invalid visit type and missing foreign-key records are rejected.
-   Grant/revoke consent creates correct state and audit evidence.
-   Duplicate-test results match the SQL view/query.
-   Audit endpoints are restricted and paginated.

### Frontend tests

-   Form validation and disabled/loading submit state.
-   API errors display an actionable message without exposing sensitive
    details.
-   Empty search results are clear.
-   Access-denied state is different from a network error.
-   Tables work with long names and small screens.
-   Keyboard navigation and visible focus work.
-   Sign-out clears protected data from the current UI.

### End-to-end demo scenario

1.  Sign in as a seeded doctor at Hospital A.
2.  Search for a synthetic patient with records at Hospital A and
    Hospital B.
3.  Verify the timeline only appears when the authorization policy
    allows it.
4.  Revoke or expire the relevant demo consent and retry; access should
    be denied.
5.  Grant the correct consent and retry; access should work.
6.  Show a potential duplicate lab test for the same patient across
    hospitals.
7.  Create a demo visit if CRUD is in scope and verify the audit entry.
8.  Sign in with a restricted role and verify that restricted pages/data
    are unavailable.

------------------------------------------------------------------------

## 12. UI design direction

Aim for a clean clinical operations dashboard, not a marketing landing
page.

-   **Visual hierarchy:** compact sidebar, simple top bar, clear page
    title, summary cards, then tables/timeline.
-   **Color:** restrained navy/blue with teal or green accents; reserve
    strong red for errors/revocation warnings.
-   **Typography:** readable sans-serif, clear table headings,
    consistent number/date formatting.
-   **Data density:** prioritize scanning; use badges for visit type and
    consent status, and expandable visit cards for detailed clinical
    data.
-   **Responsive:** desktop-first for hospital staff, but usable on
    tablet and mobile.
-   **Accessibility:** labels for every form field, semantic buttons,
    keyboard support, sufficient contrast, and non-color status cues.
-   **Trust:** show which hospital/doctor is accessing records and make
    consent status easy to understand.

Suggested main navigation order: 1. Dashboard 2. Patient Search 3.
Duplicate Tests 4. Consent Management 5. Hospitals 6. Doctors 7. Audit
Log

Hide or disable navigation based on role, while still enforcing all
permissions in the API.

------------------------------------------------------------------------

## 13. Environment variables and local run

Use an `.env.example` file with placeholders only. Names may be adapted
to the current Compose file.

``` dotenv
DATABASE_URL=postgresql+psycopg://<supabase-user>:<password>@<pooler-host>:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-key>
API_BASE_URL=http://localhost:8000
SESSION_SECRET=replace_with_a_long_random_secret
```

Do not commit a real `.env` file. `DATABASE_URL` is the Supabase pooler
string. The browser uses the host-published API URL.

Typical local workflow (adjust to the repository's current files):

``` powershell
docker compose up --build
```

Then check: - Frontend: `http://localhost:3000` - API health:
`http://localhost:8000/health` - API documentation:
`http://localhost:8000/docs`

Use the project's actual Compose service names and ports if they differ.
For a fresh database, use the documented migration/seed procedure; do
not repeatedly apply non-idempotent inserts to an already-populated
database.

------------------------------------------------------------------------

## 14. Definition of done

The project is ready for demonstration when:

-   [ ] The app runs through Docker Compose from a clean setup.
-   [ ] Sign-in, sign-out, and role-aware navigation work.
-   [ ] Patient search and profile pages use live backend data.
-   [ ] A patient timeline shows visits, diagnoses, prescriptions, and
    labs.
-   [ ] Consent is checked server-side for cross-hospital access.
-   [ ] Grant/revoke actions update the database and produce audit
    evidence.
-   [ ] Duplicate lab tests can be reviewed from a real query/view.
-   [ ] Dashboard figures match database results.
-   [ ] Hospital and doctor directories work.
-   [ ] Errors, loading, empty, and denied-access states are handled.
-   [ ] Core backend authorization rules have automated tests.
-   [ ] The README explains setup, demo accounts, database reset, and
    the demo flow.
-   [ ] Only synthetic data and placeholder secrets are included in the
    repository.

------------------------------------------------------------------------

## 15. Recommended build order for the actual coding work

Do not build all pages at once. Build one end-to-end slice at a time:

1.  **Application shell + `/auth/me`** --- establish routing and the API
    client.
2.  **Patient search API + page** --- prove frontend/backend/database
    connectivity.
3.  **Patient timeline API + page** --- prove joins and clinical record
    rendering.
4.  **Authentication + consent enforcement** --- secure the records
    before broadening access.
5.  **Consent UI + audit trail** --- demonstrate the project's core
    access-control concept.
6.  **Dashboard + hospital/doctor directories** --- reuse tested APIs
    and components.
7.  **Duplicate tests** --- connect the view/query and add review
    filters.
8.  **Clinical CRUD (if required)** --- add create-visit and related
    forms.
9.  **Automated tests, responsive polish, and demo rehearsal.**

**Priority:** Patient search → authorized patient timeline → consent
enforcement → audit trail. These form the core AarogyaLink use case. The
dashboard is useful, but it should not delay a secure, working
patient-record-sharing flow.
