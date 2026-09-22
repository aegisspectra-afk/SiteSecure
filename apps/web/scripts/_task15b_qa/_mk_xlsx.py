
from openpyxl import Workbook
wb = Workbook()
menu = wb.active
menu.title = "תפריט"
menu.append(["מחירון דמו QA"])
cam = wb.create_sheet("IPC מצלמות")
cam.append(["חזרה"])
cam.append(['מק"ט', "דגם", "מחיר מתקין", "תאור מקוצר", "רזולוציה", "סוג מצלמה", "גודל עדשה"])
cam.append([None, "Series Banner"])
cam.append(["QA-on2gnh", "IPC-QA", 227, "מצלמת QA", "4MP", "צינור", "2.8mm"])
wb.save(r"C:\\Users\\shimd\\OneDrive\\Desktop\\אגיס מערכות\\SiteSecureV1\\apps\\web\\scripts\\_task15b_qa\\disposable-import.xlsx")
print("QA-on2gnh")
