"""DEMO-6: reset «SITE SECURE – DEMO» to the seeded baseline.

Wrapper around demo_workspace_seed.py --reset.

  python apps/api/scripts/demo_workspace_reset.py
"""

from __future__ import annotations

import runpy
import sys
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent / "demo_workspace_seed.py"


def main() -> int:
    sys.argv = [str(SCRIPT), "--reset", *[a for a in sys.argv[1:] if a != "--reset"]]
    runpy.run_path(str(SCRIPT), run_name="__main__")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
