from __future__ import annotations

from fastapi.responses import Response


def pdf_response(pdf_bytes: bytes, filename: str, *, inline: bool = False) -> Response:
    disposition = "inline" if inline else "attachment"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"{disposition}; filename=\"{filename}\"; filename*=UTF-8''{filename}",
            "Content-Type": "application/pdf",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
