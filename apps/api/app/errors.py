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
    "ACCOUNT_INACTIVE": "החשבון אינו פעיל כרגע. פנו למנהל המערכת לקבלת גישה מחדש.",
    "USER_ARCHIVED": "המשתמש בארכיון. יש להחזיר אותו לפעילות בממשק Admin לפני הזמנה.",
    "ARCHIVE_SELF": "לא ניתן להעביר לארכיון את החשבון שלכם",
    "ARCHIVE_LAST_ADMIN": "לא ניתן להעביר לארכיון את מנהל הפלטפורמה האחרון",
    "ARCHIVE_OWNER_ORPHAN": "לא ניתן להעביר לארכיון — סביבה פעילה תישאר ללא Owner",
    "TENANT_INACTIVE": "הסביבה אינה פעילה",
    "SUBSCRIPTION_INVALID": "המנוי אינו תקין",
    "FEATURE_NOT_INCLUDED": "היכולת אינה כלולה בתוכנית",
    "PLAN_LIMIT_REACHED": "הגעתם למגבלת התוכנית הנוכחית",
    "PERMISSION_DENIED": "אין הרשאה לפעולה זו",
    "SCOPE_DENIED": "אין גישה למשאב זה",
    "RESOURCE_STATE": "לא ניתן לבצע את הפעולה במצב הנוכחי",
    "BUSINESS_RULE": "הפעולה חסומה לפי כללי התוכנית",
    "NOT_FOUND": "לא נמצא",
    "CONFLICT_REVISION": "העיצוב עודכן במקביל — רענון נדרש",
    "INVALID_NAME": "שם לא תקין",
    "INVITE_INVALID": "ההזמנה אינה תקפה",
    "INVITE_EXPIRED": "תוקף ההזמנה פג",
    "INVITE_ALREADY_ACCEPTED": "ההזמנה כבר נוצלה",
    "INVITE_REVOKED": "ההזמנה בוטלה",
    "INVITE_EMAIL_MISMATCH": "ההזמנה שייכת לכתובת דוא״ל אחרת",
    "PORTAL_INVITE_INVALID": "ההזמנה לפורטל אינה תקפה",
    "PORTAL_INVITE_EMAIL_MISMATCH": "ההזמנה לפורטל שייכת לכתובת דוא״ל אחרת",
    "PORTAL_ALREADY_ENABLED": "כבר קיימת גישה פעילה או הזמנה לכתובת הזו",
    "PORTAL_NOT_INVITED": "אין הזמנה פתוחה לפעולה הזו",
    "INVITE_ALREADY_PENDING": "כבר קיימת הזמנה ממתינה לכתובת הזו",
    "INVITE_USER_EXISTS": "הכתובת כבר שייכת לחבר פעיל בסביבה",
    "ROLE_NOT_ALLOWED": "התפקיד בהזמנה אינו מותר בתוכנית הנוכחית",
    "VALIDATION_ERROR": "נתונים לא תקינים",
    "QUOTE_INCOMPLETE": "לא ניתן לשלוח את ההצעה",
    "TEMPLATE_EMPTY": "לתבנית אין שורות להחלה",
    "API_UNAVAILABLE": "השירות אינו זמין",
    "SSP_SCHEMA_UNAVAILABLE": (
        "טבלת האתרים אינה קיימת במסד שאליו מחובר ה־API. "
        "יצירה דורשת Local Supabase ב־127.0.0.1:54321 עם המיגרציות המקומיות. "
        "לא הוחלה סכמה לענן, ואין זו שגיאת הרשאה."
    ),
    "WORKFORCE_SCHEMA_UNAVAILABLE": (
        "טבלאות Workforce Intelligence אינן קיימות במסד שאליו מחובר ה־API. "
        "יש להחיל את המיגרציה המקומית. אין זו שגיאת הרשאה."
    ),
    "WORKFORCE_USERNAME_TAKEN": "שם המשתמש התפעולי כבר בשימוש בסביבה זו",
    "WORKFORCE_ACCOUNT_CONFLICT": "לא ניתן ליצור חשבון עם פרטי ההתחברות האלה",
    "WORKFORCE_USER_CANNOT_CREATE_WORKSPACE": "חשבון עובד אינו יכול לפתוח סביבת עבודה חדשה",
    "WORKFORCE_PARTIAL_RECOVERY": "היצירה נכשלה. נסו שוב עם אותם פרטים לאחר בדיקת הסביבה",
    "WORKFORCE_SELF_DISABLE": "לא ניתן להשבית את החשבון שלכם",
    "WORKFORCE_CROSS_TENANT": "לא ניתן לשייך חשבון שכבר משויך לסביבה אחרת",
    "WORKFORCE_IN_USE": "לא ניתן למחוק — קיימים נתונים תפעוליים מקושרים",

    "ENTITLEMENTS_UNAVAILABLE": "לא ניתן לאמת את הרשאות התוכנית כרגע",
    "PRODUCT_DEFAULTS_UNAVAILABLE": "לא ניתן להגדיר את מוצרי ברירת המחדל לסביבה. נסו שוב או פנו לתמיכה.",
    "WORKSPACE_PRODUCT_DEFAULTS_FAILED": "הסביבה נוצרה אך הגדרת מוצרי ברירת המחדל נכשלה. פנו לתמיכה לפני שימוש.",
}
