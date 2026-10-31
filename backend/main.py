from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.requests import Request

from src.core.access import authorize_request
from src.core.actor import resolve_actor
from src.core.config import CORS_ORIGINS, DEBUG
from src.core.database import SessionLocal
from src.core.identity import ensure_admin_table
from src.routers.audit import router as audit_router
from src.routers.auth import router as auth_router
from src.routers.consents import router as consents_router
from src.routers.doctors import router as doctors_router
from src.routers.duplicates import router as duplicates_router
from src.routers.hospitals import router as hospitals_router
from src.routers.patients import router as patients_router
from src.routers.stats import router as stats_router
from src.routers.visits import router as visits_router


def _prepare_database() -> None:
    """Create the default admin row and align SERIAL sequences with loaded keys."""
    ensure_admin_table()
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        _prepare_database()
    except Exception as exc:
        print(f"Warning: database preparation failed: {exc}")
    yield


app = FastAPI(
    title="AarogyaLink API",
    description="Consent-Driven Multi-Hospital Health Data Sharing API",
    version="1.0.0",
    lifespan=lifespan,
)

def _is_public(method: str, path: str) -> bool:
    if path in {"/", "/health", "/api/health", "/openapi.json"} or path.startswith("/docs") or path.startswith("/redoc"):
        return True
    if method == "GET" and path == "/api/hospitals":
        return True
    if method == "GET" and path.startswith("/api/hospitals/"):
        rest = path[len("/api/hospitals/"):]
        if rest and "/" not in rest and rest != "caseload":
            return True
    return False


@app.middleware("http")
async def require_authenticated_api(request: Request, call_next):
    """Every data route needs a signed session or a verified Supabase token."""
    if request.method == "OPTIONS" or _is_public(request.method, request.url.path):
        return await call_next(request)
    if request.url.path.startswith("/debug") and not DEBUG:
        return JSONResponse(status_code=404, content={"detail": "Not Found"})

    try:
        actor = resolve_actor(
            request.headers.get("authorization"),
            request.headers.get("x-aarogya-session"),
        )
    except HTTPException as exc:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    if actor is None:
        return JSONResponse(status_code=401, content={"detail": "Authentication required"})
    try:
        authorize_request(request.method, request.url.path, actor)
    except HTTPException as exc:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    request.state.actor = actor
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Aarogya-Session"],
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

