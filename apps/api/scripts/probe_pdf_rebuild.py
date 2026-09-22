from pathlib import Path

from pypdf import PdfReader

from app.quote_pdf import render_quote_pdf
from tests.test_quote_pdf import _doc

doc = _doc()
doc["title"] = "הצעת מחיר למערכת מצלמות"
doc["payment_terms"] = "40% בעת סגירת ההזמנה\n60% בגמר העבודה"
doc["warranty"] = "12 חודשים על ציוד והתקנה"
doc["general_terms"] = "ההצעה בתוקף 14 יום. עבודות נוספות יתומחרו בנפרד."
pdf, name = render_quote_pdf(doc)
out = Path("_test_quote_rebuilt.pdf")
out.write_bytes(pdf)
print(name, len(pdf), out.resolve())

reader = PdfReader(str(out))
text = "\n".join((page.extract_text() or "") for page in reader.pages)
needles = ["הצעת מחיר", "שנידי", "40%", "מע", "סה", "Q-00012", "אגיס", "אישור"]
for needle in needles:
    print(needle, "OK" if needle in text else "MISSING")
print("pages", len(reader.pages))
print("---TEXT---")
print(text)
