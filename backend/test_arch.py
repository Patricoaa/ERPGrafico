import re
from pathlib import Path
from core.registry import UniversalRegistry

frontend_dir = Path('../frontend/app/(dashboard)')
dynamic_segment_re = re.compile(r'^\[.+\]$')
router_patterns = set()

for page_file in frontend_dir.rglob('page.tsx'):
    rel = page_file.parent.relative_to(frontend_dir)
    parts = rel.parts
    if not parts:
        router_patterns.add('/')
        continue
    normalised = '/'.join('{id}' if dynamic_segment_re.match(p) else p for p in parts)
    router_patterns.add(f'/{normalised}')

violations = []
for label, entity in UniversalRegistry._entities.items():
    pattern = entity.detail_url_pattern
    if not pattern:
        violations.append(f"  {label}: detail_url_pattern vacío")
        continue
    if pattern not in router_patterns:
        violations.append(f"  {label}: '{pattern}' no coincide con ninguna ruta real.")

if violations:
    print("FAIL:", violations)
else:
    print("PASS: Todas las rutas de UniversalRegistry existen en frontend")
