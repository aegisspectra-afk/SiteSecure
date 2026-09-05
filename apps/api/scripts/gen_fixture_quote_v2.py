from pathlib import Path

from app.pdf_template_sample import build_sample_quote_document
from app.quote_pdf import render_quote_pdf

doc = build_sample_quote_document(
    branding={
        "displayName": "אגיס מערכות",
        "legalName": 'אגיס מערכות בע"מ',
        "businessNumber": "515000000",
        "businessNumberType": "company_number",
        "phone": "03-555",
        "email": "office@aegis.demo",
        "brandPrimary": "#1c4e80",
        "addressLine1": "רח התעשיה 1",
    },
    workspace_name="אגיס מערכות",
)
pdf_bytes, name = render_quote_pdf(doc)
out = Path(__file__).resolve().parent / "_fixture_quote_v2.pdf"
out.write_bytes(pdf_bytes)
print(name, len(pdf_bytes), out)
