from pathlib import Path
q = Path("_seed_part.sql").read_text(encoding="utf-8")
# Emit as escaped JSON on one line for tooling
import json, sys
sys.stdout.reconfigure(encoding="utf-8")
json.dump({"query": q}, sys.stdout, ensure_ascii=False)
