from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from src.core.config import AUTH_MODE, DEBUG
from src.core.database import SessionLocal
from src.core.identity import ensure_admin_table
from src.core.local_auth import ensure_local_auth
from src.routers.audit import router as audit_router
from src.routers.auth import router as auth_router
from src.routers.consents import router as consents_router
from src.routers.doctors import router as doctors_router
from src.routers.duplicates import router as duplicates_router
from src.routers.hospitals import router as hospitals_router
from src.routers.patients import router as patients_router
from src.routers.stats import router as stats_router
from src.routers.visits import router as visits_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        ensure_admin_table()
    except Exception as e:
        print(f"Warning: failed to prepare admin_user table: {e}")
    if AUTH_MODE == "local":
        try:
            ensure_local_auth()
        except Exception as e:
            print(f"Warning: failed to prepare local auth_user table: {e}")
    # Startup: Ensure all PostgreSQL SERIAL sequences are synced to MAX(id) + 1
    try:
        with SessionLocal() as db:
            db.execute(text("""
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'consent_consent_id_seq') THEN
                        PERFORM setval('consent_consent_id_seq', (SELECT COALESCE(MAX(consent_id), 0) + 1 FROM consent), false);
                    END IF;
                    IF EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'visit_visit_id_seq') THEN
                        PERFORM setval('visit_visit_id_seq', (SELECT COALESCE(MAX(visit_id), 0) + 1 FROM visit), false);
                    END IF;
                    IF EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'diagnosis_diagnosis_id_seq') THEN
                        PERFORM setval('diagnosis_diagnosis_id_seq', (SELECT COALESCE(MAX(diagnosis_id), 0) + 1 FROM diagnosis), false);
                    END IF;
                    IF EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'prescription_prescription_id_seq') THEN
                        PERFORM setval('prescription_prescription_id_seq', (SELECT COALESCE(MAX(prescription_id), 0) + 1 FROM prescription), false);
                    END IF;
                    IF EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'lab_test_lab_test_id_seq') THEN
                        PERFORM setval('lab_test_lab_test_id_seq', (SELECT COALESCE(MAX(lab_test_id), 0) + 1 FROM lab_test), false);
                    END IF;
                    IF EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'audit_log_log_id_seq') THEN
                        PERFORM setval('audit_log_log_id_seq', (SELECT COALESCE(MAX(log_id), 0) + 1 FROM audit_log), false);
                    END IF;
                END $$;
            """))
            db.commit()
    except Exception as e:
        print(f"Warning: Failed to sync database sequences on startup: {e}")
    yield


app = FastAPI(
    title="AarogyaLink API",
    description="Consent-Driven Multi-Hospital Health Data Sharing API",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for Next.js frontend and external clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(hospitals_router)
app.include_router(doctors_router)
app.include_router(patients_router)
app.include_router(consents_router)
app.include_router(visits_router)
app.include_router(audit_router)
app.include_router(duplicates_router)
app.include_router(auth_router)
app.include_router(stats_router)

if DEBUG:
    from src.routers.debug import router as debug_router
    app.include_router(debug_router)


@app.get("/")
@app.get("/health")
@app.get("/api/health")
async def read_root():
    return {
        "service": "AarogyaLink FastAPI Backend",
        "status": "operational",
        "docs": "/docs",
        "database": "PostgreSQL 17 (BCNF)",
    }

