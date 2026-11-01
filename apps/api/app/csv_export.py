"""SITE SECURE list CSV export — UTF-8 BOM, formula-injection guard, Hebrew headers."""

from __future__ import annotations

import csv
import io
from collections.abc import Iterable, Sequence
from urllib.parse import quote

from fastapi.responses import Response

EXPORT_PAGE = 200
EXPORT_MAX = 2000
FORMULA_PREFIXES = ("=", "+", "-", "@")


def csv_cell(value: object) -> str:
    if value is None:
        return ""
    text = str(value)
    if text.startswith(FORMULA_PREFIXES):
        return f"'{text}"
    return text


def build_csv(headers: Sequence[str], rows: Iterable[Sequence[object]]) -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\r\n")
    writer.writerow([csv_cell(h) for h in headers])
    for row in rows:
        writer.writerow([csv_cell(cell) for cell in row])
    return ("\ufeff" + buf.getvalue()).encode("utf-8")


def csv_response(
    data: bytes,
    filename: str,
    *,
    row_count: int | None = None,
    truncated: bool = False,
) -> Response:
    safe = filename.replace('"', "").replace("\r", "").replace("\n", "")
    encoded = quote(safe)
    try:
        ascii_name = safe.encode("ascii").decode("ascii")
    except UnicodeEncodeError:
        ascii_name = "export.csv"
    headers = {
        "Content-Disposition": f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{encoded}",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Export-Max-Rows": str(EXPORT_MAX),
        "X-Export-Truncated": "true" if truncated else "false",
    }
    if row_count is not None:
        headers["X-Export-Row-Count"] = str(row_count)
    return Response(
        content=data,
        media_type="text/csv; charset=utf-8",
        headers=headers,
    )


QUOTE_STATUS_HE = {
    "draft": "טיוטה",
    "sent": "נשלחה",
    "viewed": "נצפתה",
    "approved": "אושרה",
    "rejected": "נדחתה",
    "expired": "פג תוקף",
    "cancelled": "בוטלה",
}

CUSTOMER_STATUS_HE = {
    "active": "פעיל",
    "inactive": "לא פעיל",
    "lead": "ליד",
}

TASK_STATUS_HE = {
    "open": "פתוחה",
    "done": "הושלמה",
    "cancelled": "בוטלה",
}
