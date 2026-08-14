from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    return {"ok": True, "service": "site-secure-api"}


@router.get("/api/v1/health")
def health_v1() -> dict:
    return {"ok": True, "version": "v1"}
