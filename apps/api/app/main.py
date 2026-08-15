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
    auth,
    customers,
    dashboard,
    documents,
    health,
    jobs,
    quotes,
    sites,
    team,
    workspaces,
)

logger = logging.getLogger("site-secure")


def create_app() -> FastAPI:
    settings = get_settings()
    logging.basicConfig(level=settings.log_level)

    app = FastAPI(
        title="SITE SECURE V2 API",
        version="0.6.0",
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
                    "details": {"errors": exc.errors()},
                }
            },
            headers={"X-Request-Id": request_id},
        )

    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(workspaces.router)
    app.include_router(team.router)
    app.include_router(customers.router)
    app.include_router(sites.router)
    app.include_router(jobs.router)
    app.include_router(quotes.router)
    app.include_router(documents.router)
    app.include_router(dashboard.router)
    return app


app = create_app()
