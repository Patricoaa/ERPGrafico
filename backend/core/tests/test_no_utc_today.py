"""Guard: las fechas de negocio deben usar ``timezone.localdate()``.

``timezone.now().date()``, ``datetime.now().date()`` y ``date.today()`` devuelven
la fecha UTC (o la del SO), que a partir de ~21:00 hora de Chile ya es "mañana".
Si un uso es intencionalmente UTC, marcar la línea con ``# utc-date-ok``.
"""

import re
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]
PATTERN = re.compile(
    r"timezone\.now\(\)\.date\(\)|datetime\.now\(\)\.date\(\)"
    r"|datetime\.datetime\.now\(\)\.date\(\)|\bdate\.today\(\)"
)
EXCLUDED_DIRS = {"tests", "migrations", "venv", ".venv", "node_modules", "__pycache__"}
ALLOW_MARKER = "# utc-date-ok"


def _is_test_file(path: Path) -> bool:
    name = path.name
    return name == "conftest.py" or name.startswith(("test_", "tests"))


def test_no_utc_today_in_app_source():
    offenders = []
    for path in BACKEND.rglob("*.py"):
        rel = path.relative_to(BACKEND)
        if EXCLUDED_DIRS & set(rel.parts[:-1]) or _is_test_file(path):
            continue
        for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if PATTERN.search(line) and ALLOW_MARKER not in line:
                offenders.append(f"{rel}:{lineno}: {line.strip()}")
    assert not offenders, (
        "Usa timezone.localdate() (o marca '# utc-date-ok'):\n" + "\n".join(offenders)
    )
