from __future__ import annotations

import logging
import time
import uuid
from collections import defaultdict, deque

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .errors import ApiError, error_response
from .routers import (
    admin,
    auth,
    catalog,
    catalog_import,
    cctv,
    customers,
    dashboard,
    documents,
    feedback,
    fleet,
    fleet_ops,
    fleet_reports,
    health,
    jobs,
    ops_modules,
    platform_home,
    public_quotes,
    public_ssp,
    public_ssp_site,
    quote_cpq,
    quotes,
    ssp_forms,
    ssp_ops,
    ssp_org,
    ssp_site_activation,
    ssp_sites,
    system_designs,
    search,
    sites,
    systems,
    team,
    telemetry,
    workforce,
    workspace_products,
    workspace_settings,
    workspaces,
)

logger = logging.getLogger("site-secure")

_SECRET_ERROR_KEYS = frozenset({"password", "password_confirm", "new_password", "old_password", "secret", "token"})


def _redact_validation_errors(errors: list) -> list:
    cleaned: list = []
    for item in errors:
        copy = dict(item)
        loc = copy.get("loc") or ()
        if any(str(part).lower() in _SECRET_ERROR_KEYS for part in loc):
            copy["input"] = "[redacted]"
            ctx = copy.get("ctx")
            if isinstance(ctx, dict):
                copy["ctx"] = {
                    key: "[redacted]" if str(key).lower() in _SECRET_ERROR_KEYS or "password" in str(key).lower() else value
                    for key, value in ctx.items()
                }
        cleaned.append(copy)
    return cleaned


def create_app() -> FastAPI:
    settings = get_settings()
    logging.basicConfig(level=settings.log_level)

    app = FastAPI(
        title="SITE SECURE V2 API",
        version="0.7.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    buckets: dict[str, deque[float]] = defaultdict(deque)

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = request_id
        key = request.client.host if request.client else "unknown"
        now = time.time()
        window = buckets[key]
        while window and now - window[0] > 60:
            window.popleft()
        if len(window) > 120:
            return JSONResponse(
                status_code=429,
                content={"error": {"code": "RATE_LIMITED", "message": "יותר מדי בקשות", "details": {}}},
                headers={"X-Request-Id": request_id},
            )
        window.append(now)
        started = time.perf_counter()
        response = await call_next(request)
        response.headers["X-Request-Id"] = request_id
        logger.info(
            "request",
            extra={
                "request_id": request_id,
                "path": request.url.path,
                "status": response.status_code,
                "latency_ms": int((time.perf_counter() - started) * 1000),
            },
        )
        return response

    @app.exception_handler(ApiError)
    async def api_error_handler(request: Request, exc: ApiError):
        return error_response(request, exc)

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError):
        request_id = getattr(request.state, "request_id", "")
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "נתונים לא תקינים",
                    "details": {"errors": _redact_validation_errors(exc.errors())},
                }
            },
            headers={"X-Request-Id": request_id},
        )

    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(platform_home.router)
    app.include_router(workspaces.router)
    app.include_router(workspace_settings.router)
    app.include_router(workspace_products.router)
    app.include_router(feedback.router)
    app.include_router(telemetry.router)
    app.include_router(admin.router)
    app.include_router(team.router)
    app.include_router(customers.router)
    app.include_router(sites.router)
    app.include_router(systems.router)
    app.include_router(search.router)
    app.include_router(jobs.router)
    app.include_router(ops_modules.router)
    app.include_router(quotes.router)
    app.include_router(quote_cpq.router)
    app.include_router(system_designs.router)
    app.include_router(catalog.router)
    app.include_router(catalog_import.router)
    app.include_router(cctv.router)
    app.include_router(public_quotes.router)
    app.include_router(documents.router)
    app.include_router(dashboard.router)
    app.include_router(fleet.router)
    app.include_router(fleet_ops.router)
    app.include_router(fleet_reports.router)
    app.include_router(ssp_forms.router)
    app.include_router(ssp_ops.router)
    app.include_router(ssp_org.router)
    app.include_router(ssp_sites.router)
    app.include_router(ssp_site_activation.router)
    app.include_router(public_ssp.router)
    app.include_router(public_ssp_site.router)
    app.include_router(workforce.router)
    return app


app = create_app()
