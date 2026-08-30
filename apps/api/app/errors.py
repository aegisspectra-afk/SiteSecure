from typing import Any

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel


class ErrorBody(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = {}


class ApiError(HTTPException):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.details = details or {}
        super().__init__(status_code=status_code, detail=message)


def error_response(request: Request, exc: ApiError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", "")
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message, "details": exc.details}},
        headers={"X-Request-Id": request_id},
    )


MESSAGES = {
    "UNAUTHENTICATED": "נדרשת התחברות",
    "TENANT_INACTIVE": "הסביבה אינה פעילה",
    "SUBSCRIPTION_INVALID": "המנוי אינו תקין",
    "FEATURE_NOT_INCLUDED": "היכולת אינה כלולה בתוכנית",
    "PLAN_LIMIT_REACHED": "הגעתם למגבלת התוכנית הנוכחית",
    "PERMISSION_DENIED": "אין הרשאה לפעולה זו",
    "SCOPE_DENIED": "אין גישה למשאב זה",
    "RESOURCE_STATE": "לא ניתן לבצע את הפעולה במצב הנוכחי",
    "BUSINESS_RULE": "הפעולה חסומה לפי כללי התוכנית",
    "NOT_FOUND": "לא נמצא",
    "INVALID_NAME": "שם לא תקין",
    "INVITE_INVALID": "ההזמנה אינה תקפה",
    "INVITE_EXPIRED": "תוקף ההזמנה פג",
    "INVITE_ALREADY_ACCEPTED": "ההזמנה כבר נוצלה",
    "INVITE_EMAIL_MISMATCH": "ההזמנה שייכת לכתובת דוא״ל אחרת",
    "INVITE_ALREADY_PENDING": "כבר קיימת הזמנה ממתינה לכתובת הזו",
    "INVITE_USER_EXISTS": "הכתובת כבר שייכת לחבר פעיל בסביבה",
    "ROLE_NOT_ALLOWED": "התפקיד בהזמנה אינו מותר בתוכנית הנוכחית",
    "VALIDATION_ERROR": "נתונים לא תקינים",
    "QUOTE_INCOMPLETE": "לא ניתן לשלוח את ההצעה",
    "TEMPLATE_EMPTY": "לתבנית אין שורות להחלה",
    "API_UNAVAILABLE": "השירות אינו זמין",
    "ENTITLEMENTS_UNAVAILABLE": "לא ניתן לאמת את הרשאות התוכנית כרגע",
}
