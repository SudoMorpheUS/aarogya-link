# AarogyaLink frontend

Next.js (App Router) + React + TypeScript, running on Node.js. It implements the platform from *Digital Assignment 1 & 2*: one patient profile across hospitals, patient-controlled consent, a consent-gated unified chart, duplicate lab-test checks and a full audit trail.

The UI follows the `hospital-dashboard-design` system: a strict 60-30-10 palette (white, light blue, and maroon only for things a person must act on), Inter type, soft cards, and a responsive shell that switches layout mode by aspect ratio (`tall`, `portrait`, `standard`, `wide`, `ultra`, set as `data-shell` on `<html>`). The 3D tower loader (`src/components/TowerLoader*`) is the loading state and brand mark, coloured with the palette's blue ramp.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

```bash
npm run build && npm start   # production server on Node.js
npm run lint
npm run typecheck
```

Or with Docker, from the repository root: `docker compose up --build frontend`.

## How it works

- **Authentication & Sessions**: The browser authenticates through **Supabase Auth** (`@supabase/supabase-js`). The session route handler (`/api/auth/session`) resolves identity through `GET /api/auth/lookup`, maps it to an authorized role (`patient`, `doctor`, or `admin`), and establishes an **HMAC-signed httpOnly session cookie** (`al_session`) valid for 8 hours.
- **Database Connection**: Reads and writes directly to hosted **Supabase PostgreSQL** through the FastAPI backend and Next.js route handlers.
- **Offline / Standalone Fallback**: If the database is unreachable, `src/lib/store.ts` provides an in-memory mock store preserving the SQL logic (`fn_has_consent`, `sp_grant_consent`, triggers, and analytical views) for offline demonstration.
- **Server Actions** (`src/lib/actions.ts`): Coordinates authentication, dynamic consent granting/revocation, encounter creation, patient registration, and break-glass emergency access.
- **Route Handlers** (`src/app/api/*`): Server-side REST endpoints: `/api/auth/session`, `/api/health`, `/api/hospitals`, `/api/doctors`, `/api/patients`, `/api/patients/[id]/history`, and `/api/duplicates`.
- **Demo Personas**: 1-Click Instant Login panel on `/` with pre-configured personas (Archit Singh, Karthik Iyer, Devansh Gupta, Meera Nair, Dr. Rohan Mehta, Dr. Nisha Kapoor, Dr. Vikram Sharma, Central Admin). Universal demo password: `AarogyaLink@123`.

## Roles

| Role | Can do |
|---|---|
| Patient | See own timeline, results and medicines, grant/revoke consent (with confirmation), read access history |
| Doctor | Search patients, open a consented chart (or use audited emergency access), record visits, see repeat-test alerts |
| Administrator | Network overview, hospitals and doctors, patient registry, full audit log (no clinical records) |

## Design-system details

- **Attention system** (`src/lib/attention.ts`, `src/lib/lab-ranges.ts`): each role gets a "Needs attention (n)" summary, nav badges and a bell dot. Rules include critical lab values, consents ending soon, medicines about to run out, emergency overrides and blocked access attempts. Lab thresholds are illustrative, not clinical guidance.
- **Privacy in the UI**: patient IDs and phone numbers are masked until revealed, page titles and URLs carry no names or diagnoses, consented views say who can see them, and doctor/admin screens blur after two idle minutes.
- **Zero overflow**: tables scroll inside a wrapper or turn into stacked cards in narrow containers, grids use `minmax(0, 1fr)` and `min(100%, N)`, and every layout was checked at 320x640 up to 5120x1440.
- **Keyboard (doctors)**: `/` search, `]` next patient, `[` previous patient.
