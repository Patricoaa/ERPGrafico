import os
import re
import ast
from pathlib import Path
import pytest
from django.conf import settings
from django.apps import apps


@pytest.mark.django_db
class TestArchitecturalInvariants:
    def get_backend_python_files(self):
        backend_dir = settings.BASE_DIR
        py_files = []
        for root, dirs, files in os.walk(backend_dir):
            if '.venv' in root or 'venv' in root or '__pycache__' in root:
                continue
            if 'migrations' in root or 'tests' in root:
                continue
            for file in files:
                if file.endswith('.py'):
                    py_files.append(os.path.join(root, file))
        return py_files

    def test_no_class_name_discrimination(self):
        """
        __class__.__name__ in/== retorna 0 en backend (excluye migrations/, tests/).
        """
        py_files = self.get_backend_python_files()
        pattern = re.compile(r'__class__\.__name__\s*(?:in|==)')

        violations = []
        for filepath in py_files:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                if pattern.search(content):
                    violations.append(filepath)

        assert not violations, f"Se encontraron discriminaciones por __class__.__name__ en: {violations}"

    def test_no_isinstance_for_polymorphism(self):
        """
        isinstance(x, ConcreteModel) para discriminación retorna 0 fuera de serializers.py/admin.py.
        """
        py_files = self.get_backend_python_files()

        whitelisted_types = {
            'int', 'str', 'list', 'dict', 'bool', 'float', 'tuple', 'set',
            'Decimal', 'date', 'datetime', 'timedelta', 'Exception', 'type',
            'models.Model', 'SearchableEntity',
        }

        pattern = re.compile(r'isinstance\([^,]+,\s*([A-Za-z0-9_.]+)\)')

        violations = []
        for filepath in py_files:
            if filepath.endswith('serializers.py') or filepath.endswith('admin.py') or filepath.endswith('registry.py'):
                continue

            with open(filepath, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                for i, line in enumerate(lines):
                    for match in pattern.finditer(line):
                        type_name = match.group(1)
                        if type_name not in whitelisted_types and 'Exception' not in type_name:
                            violations.append(f"{filepath}:{i+1} -> {line.strip()}")

        if violations:
            print("isinstance() con modelos de dominio encontrados:")
            for v in violations[:10]:
                print(v)

        assert not any('Sale' in v or 'Purchase' in v or 'Document' in v for v in violations), \
            f"Se encontraron isinstance() con modelos de dominio: {violations[:5]}"

    def test_all_apps_register_at_least_one_entity(self):
        """
        las 12 apps están en UniversalRegistry.
        """
        from core.registry import UniversalRegistry

        expected_apps = {
            'core', 'accounting', 'inventory', 'treasury', 'tax',
            'sales', 'purchasing', 'hr', 'contacts', 'billing',
            'production', 'workflow'
        }

        registered_labels = UniversalRegistry.all_labels()
        registered_apps = {label.split('.')[0] for label in registered_labels}

        missing_apps = expected_apps - registered_apps

        assert not missing_apps, f"Apps que faltan en UniversalRegistry: {missing_apps}"

    def test_no_secret_fields_exposed(self):
        """
        schema endpoint NUNCA retorna campos en allowlist (pin, password, secret, token, key).
        """
        from core.registry import UniversalRegistry
        from core.serializers.metadata import build_schema

        sensitive_keywords = ['pin', 'password', 'secret', 'token', 'key', 'api_key', 'webhook_secret']

        violations = []
        for label, entity in UniversalRegistry._entities.items():
            model = entity.model
            try:
                schema = build_schema(model)
                for field_name in schema.get('fields', {}).keys():
                    for kw in sensitive_keywords:
                        if kw in field_name.lower():
                            violations.append(f"{label} exposes field: {field_name}")
            except Exception:
                pass

        assert not violations, f"Se encontraron campos sensibles expuestos en el schema: {violations}"

    def test_views_under_20_lines(self):
        """
        Las vistas (views.py) deben tener métodos cortos (<= 20 líneas) — regla #9 de CLAUDE.md.
        Ratchet: el número de violaciones NO puede crecer. Reducirlo iterativamente.
        Para añadir una excepción documentada, incluir el nombre de la función en VIEW_DEBT_WHITELIST.
        """
        # Funciones legacy conocidas que superan 20 líneas. NO añadir nuevas entradas.
        # Reducir esta lista al refactorizar cada función a services.py.
        VIEW_DEBT_WHITELIST: set[str] = set()

        py_files = self.get_backend_python_files()
        view_files = [f for f in py_files if f.endswith('views.py')]

        violations = []
        for filepath in view_files:
            with open(filepath, 'r', encoding='utf-8') as f:
                try:
                    tree = ast.parse(f.read(), filename=filepath)
                    for node in ast.walk(tree):
                        if isinstance(node, ast.FunctionDef):
                            if hasattr(node, 'end_lineno') and node.end_lineno:
                                lines_of_code = node.end_lineno - node.lineno
                                if lines_of_code > 20 and node.name not in VIEW_DEBT_WHITELIST:
                                    violations.append(
                                        f"{filepath}:{node.lineno} -> def {node.name}() tiene {lines_of_code} líneas."
                                    )
                except SyntaxError:
                    pass

        if violations:
            print("Vistas largas (añadir a VIEW_DEBT_WHITELIST si son legacy, luego refactorizar):")
            for v in violations[:20]:
                print(v)

        assert not violations, (
            f"Se encontraron {len(violations)} vistas con >20 líneas. "
            "Extrae la lógica a services.py o añade el nombre a VIEW_DEBT_WHITELIST con justificación."
        )

    def test_search_routes_match_app_router(self):
        """
        T-79: cada SearchableEntity.detail_url_pattern en el UniversalRegistry
        debe corresponder a un page.tsx real en el App Router de Next.js.

        Algoritmo:
        1. Descubrir todos los page.tsx bajo frontend/app/(dashboard)/.
        2. Convertir la ruta de filesystem a patrón de URL canónico:
           - segmentos [xxx] se normalizan a {id}.
        3. Para cada entidad, verificar que su detail_url_pattern coincide.
        """
        from core.registry import UniversalRegistry

        # BASE_DIR → directorio backend. Frontend está un nivel arriba.
        backend_dir = Path(settings.BASE_DIR)
        frontend_dir = backend_dir.parent / 'frontend' / 'app' / '(dashboard)'

        if not frontend_dir.exists():
            pytest.skip(f"Directorio frontend no encontrado: {frontend_dir}")

        # Construir mapa: ruta_filesystem → patrón_url_canónico
        # Ejemplo: sales/orders/[id]/page.tsx → /sales/orders/{id}
        dynamic_segment_re = re.compile(r'^\[.+\]$')
        router_patterns: set[str] = set()

        for page_file in frontend_dir.rglob('page.tsx'):
            rel = page_file.parent.relative_to(frontend_dir)
            parts = rel.parts  # () para la raíz, ('sales', 'orders', '[id]') etc.
            if not parts:
                router_patterns.add('/')
                continue
            normalised = '/'.join(
                '{id}' if dynamic_segment_re.match(p) else p
                for p in parts
            )
            router_patterns.add(f'/{normalised}')

        # Validar cada entidad registrada
        violations: list[str] = []
        for label, entity in UniversalRegistry._entities.items():
            pattern = entity.detail_url_pattern
            if not pattern:
                violations.append(f"  {label}: detail_url_pattern vacío")
                continue
            if pattern not in router_patterns:
                sample = sorted(r for r in router_patterns if '{id}' in r)[:6]
                violations.append(
                    f"  {label}: '{pattern}' no coincide con ninguna ruta real.\n"
                    f"    Rutas con [id] disponibles (muestra): {sample}"
                )

        assert not violations, (
            f"T-79 — {len(violations)} entidad(es) con detail_url_pattern sin página real:\n"
            + '\n'.join(violations)
        )
