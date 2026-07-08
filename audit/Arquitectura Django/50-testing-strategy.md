# 50 — Estrategia de Testing

> **Audiencia:** ingenieros, QA, SREs.
> **Pregunta que responde:** ¿Cómo probamos que esta refactorización no introduce regresiones, especialmente en lógica contable y operativa?
> **Premisa:** un ERP que produce reportes financieros incorrectos pierde la confianza del cliente — la primera regresión es la última oportunidad. Los tests son obligatorios, no opcionales.

---

## Pirámide aplicada a este proyecto

```
                  ┌─────────────────┐
                  │    E2E (5%)     │  Playwright/Cypress: flujos críticos
                  │                 │  Lentos, frágiles, costosos
                  └─────────────────┘
              ┌─────────────────────────┐
              │  Caracterización (15%)  │  Snapshot de reportes financieros
              │                         │  Reproduce comportamiento legacy
              └─────────────────────────┘
        ┌───────────────────────────────────┐
        │   Integración / API (25%)         │  pytest-django + DRF
        │                                   │  Modelos + servicios + DB
        └───────────────────────────────────┘
   ┌───────────────────────────────────────────────┐
   │             Unit (55%)                        │  pytest, vitest
   │  Strategies, helpers, serializers, hooks      │  Rápidos y aislados
   └───────────────────────────────────────────────┘
```

---

## Tests de Caracterización Financiera (suite obligatoria)

> Esta es la **suite no negociable** que congela el comportamiento contable actual antes de cualquier refactor. Si después de un refactor estos tests cambian de output, la fase NO se mergea.

### Cómo se construye

#### Paso 1 — Generar dataset semilla (una sola vez)

```python
# backend/core/tests/fixtures/financial_baseline.py
"""
Dataset realista que cubre los flujos contables más comunes del ERP.
Genera ~500 transacciones que tocan todos los caminos críticos.
"""

def build_baseline_dataset(seed=42):
    """Genera dataset determinístico para snapshot tests."""
    fake = Faker(locale='es_CL')
    Faker.seed(seed)
    random.seed(seed)

    contacts = ContactFactory.create_batch(50)
    products = ProductFactory.create_batch(100)

    # Caminos a cubrir:
    # - 100 SaleOrder (60% pagadas, 30% pendientes, 10% canceladas)
    # - 50 PurchaseOrder con recepción + factura + pago
    # - 30 NC sobre ventas existentes
    # - 20 ND sobre compras
    # - 100 TreasuryMovement (50% INBOUND, 30% OUTBOUND, 20% TRANSFER)
    # - 10 cierres de caja POS
    # - 1 cierre fiscal
    # - 50 JournalEntry manuales (asientos de ajuste)

    # ... lógica de generación
    return {
        'contacts': contacts,
        'products': products,
        'sales': sales,
        'purchases': purchases,
        # ...
    }
```

#### Paso 2 — Generar snapshots base (antes de cualquier refactor)

```python
# backend/core/tests/test_financial_baseline.py
import json
import pytest
from pathlib import Path

from accounting.selectors import (
    generate_balance_sheet,
    generate_income_statement,
    generate_cash_flow,
    generate_trial_balance,
    generate_general_ledger,
)
from contacts.selectors import (
    customer_aging_report,
    supplier_aging_report,
)


SNAPSHOT_DIR = Path(__file__).parent / 'snapshots'


@pytest.mark.django_db(transaction=True)
class TestFinancialBaseline:
    """
    Suite de caracterización: corre los reportes principales sobre el
    dataset baseline y compara contra snapshots versionados.
    """

    @pytest.fixture(autouse=True)
    def setup(self):
        from .fixtures.financial_baseline import build_baseline_dataset
        self.data = build_baseline_dataset(seed=42)
        self.year = 2026
        self.cutoff = date(2026, 12, 31)

    def assert_snapshot(self, name: str, actual: dict):
        path = SNAPSHOT_DIR / f"{name}.json"
        if not path.exists() or os.environ.get('UPDATE_SNAPSHOTS'):
            path.write_text(json.dumps(actual, indent=2, default=str, sort_keys=True))
            pytest.skip(f"Snapshot generated: {name}")

        expected = json.loads(path.read_text())
        assert actual == expected, f"Snapshot mismatch for {name}"

    def test_balance_sheet(self):
        actual = generate_balance_sheet(year=self.year)
        self.assert_snapshot('balance_sheet', actual)

    def test_income_statement(self):
        actual = generate_income_statement(year=self.year)
        self.assert_snapshot('income_statement', actual)

    def test_cash_flow(self):
        actual = generate_cash_flow(year=self.year)
        self.assert_snapshot('cash_flow', actual)

    def test_trial_balance(self):
        actual = generate_trial_balance(cutoff=self.cutoff)
        self.assert_snapshot('trial_balance', actual)

    def test_customer_aging(self):
        actual = customer_aging_report(cutoff=self.cutoff)
        self.assert_snapshot('customer_aging', actual)

    def test_supplier_aging(self):
        actual = supplier_aging_report(cutoff=self.cutoff)
        self.assert_snapshot('supplier_aging', actual)

    def test_general_ledger_per_account(self):
        from accounting.models import Account
        for account in Account.objects.filter(parent__isnull=False)[:30]:  # cuentas hoja
            actual = generate_general_ledger(account=account, year=self.year)
            self.assert_snapshot(f'ledger_{account.code}', actual)
```

#### Paso 3 — Workflow

1. **Pre-F2 (línea base):** correr suite con `UPDATE_SNAPSHOTS=1` para generar todos los `.json` versionados en git.
2. **Durante refactor:** la suite corre en CI. Si un snapshot diverge: hay un bug.
3. **Si la divergencia es intencional** (ej: nuevo campo agregado al reporte): commit explícito con `UPDATE_SNAPSHOTS=1` y review del cambio en el `.json`.

#### Cobertura objetivo

| Reporte | # snapshots |
|---------|-------------|
| Balance General | 1 |
| Estado de Resultados | 1 |
| Estado de Flujo de Efectivo | 1 |
| Balance de Comprobación | 1 |
| Mayor por cuenta hoja | ~30 |
| Customer Aging (5 buckets) | 1 |
| Supplier Aging | 1 |
| Auxiliar de Proveedores (top 20) | 20 |
| Auxiliar de Clientes (top 20) | 20 |
| F29 (libro IVA) | 1 |
| **Total** | **~75 snapshots** |

---

## Tests por capa de patrón

### P-01 (BaseModel)

```python
class TestTransactionalDocumentInheritance:
    def test_sale_order_inherits_universal_fields(self):
        order = SaleOrderFactory()
        for field in ['number', 'status', 'notes', 'total_net', 'total_tax', 'total',
                       'created_at', 'updated_at', 'journal_entry']:
            assert hasattr(order, field), f"Missing inherited field: {field}"

    def test_history_works_through_inheritance(self):
        order = SaleOrderFactory(notes='initial')
        order.notes = 'updated'
        order.save()
        assert order.history.count() == 2
        assert order.history.earliest().notes == 'initial'

    def test_no_duplicate_historical_table(self):
        """Regression: simple_history with inherit=True must not create
        HistoricalTransactionalDocument table."""
        from django.contrib.contenttypes.models import ContentType
        cts = ContentType.objects.filter(model__startswith='historical')
        names = {ct.model for ct in cts}
        assert 'historicaltransactionaldocument' not in names

    def test_serializer_output_matches_legacy(self):
        """Golden test: JSON output must match pre-migration shape."""
        order = SaleOrderFactory()
        actual = SaleOrderSerializer(order).data
        # Comparar contra un dict literal versionado
        expected_keys = {'id', 'number', 'customer', 'date', 'status', 'total',
                          'total_net', 'total_tax', 'created_at', 'updated_at', ...}
        assert set(actual.keys()) == expected_keys
```

### P-02 (Strategy)

```python
class TestTotalsStrategy:
    def test_gross_first_extracts_iva_correctly(self):
        order = SaleOrderFactory(total_discount_amount=Decimal('0'))
        SaleLineFactory(order=order, quantity=10, unit_price_gross=119, tax_rate=19)
        order.totals_strategy().compute(order)
        assert order.total == Decimal('1190')
        assert order.total_net == Decimal('1000')
        assert order.total_tax == Decimal('190')

    def test_net_first_adds_iva(self):
        po = PurchaseOrderFactory()
        PurchaseLineFactory(order=po, quantity=10, unit_price=100, tax_rate=19)
        po.totals_strategy().compute(po)
        assert po.total_net == Decimal('1000')
        assert po.total_tax == Decimal('190')
        assert po.total == Decimal('1190')

    def test_no_class_name_check_in_codebase(self):
        """Architectural test: no __class__.__name__ checks for type discrimination."""
        import subprocess
        result = subprocess.run(
            ['grep', '-r', '__class__.__name__ in', 'backend/core/'],
            capture_output=True, text=True
        )
        assert result.returncode == 1, f"Found forbidden pattern:\n{result.stdout}"
```

### P-03 (GenericFK)

```python
class TestJournalEntryGFKMigration:
    def test_all_entries_have_source_after_backfill(self):
        from django.core.management import call_command
        call_command('backfill_journal_source_documents', verbosity=0)

        orphans = JournalEntry.objects.filter(
            source_content_type__isnull=True,
            fiscal_year_closing__isnull=True,
            fiscal_year_opening__isnull=True,
        )
        assert not orphans.exists(), \
            f"Found {orphans.count()} orphan entries: {list(orphans.values_list('id', flat=True))[:10]}"

    def test_source_document_resolves_correctly(self):
        invoice = InvoiceFactory()
        je = JournalEntryFactory()
        invoice.journal_entry = je
        invoice.save()
        # After cutover:
        assert je.source_document == invoice
```

### P-04 (DocumentService)

```python
class TestDocumentRegistry:
    def test_register_and_resolve(self):
        @DocumentRegistry.register('sales.saleorder')
        class _DummyService(DocumentService):
            def confirm(self, doc, *, user): return doc.journal_entry
            def cancel(self, doc, *, user, reason=''): pass

        order = SaleOrderFactory()
        service = DocumentRegistry.for_instance(order)
        assert isinstance(service, _DummyService)

    def test_unknown_model_raises(self):
        with pytest.raises(NotImplementedError):
            DocumentRegistry.for_label('unknown.entity')


class TestDocumentEndpoint:
    def test_confirm_via_universal_endpoint(self, authenticated_client):
        order = SaleOrderFactory(status='DRAFT')
        ct = ContentType.objects.get_for_model(SaleOrder)
        url = f'/api/documents/{ct.id}/{order.id}/confirm/'
        resp = authenticated_client.post(url)
        assert resp.status_code == 200
        order.refresh_from_db()
        assert order.status == 'CONFIRMED'

    def test_permission_denied_without_change(self, viewer_client):
        order = SaleOrderFactory()
        ct = ContentType.objects.get_for_model(SaleOrder)
        resp = viewer_client.post(f'/api/documents/{ct.id}/{order.id}/confirm/')
        assert resp.status_code == 403
```

### P-05 (UniversalRegistry)

```python
class TestUniversalSearch:
    def test_finds_sale_order_by_number(self, authenticated_client):
        order = SaleOrderFactory(number='000123')
        resp = authenticated_client.get('/api/search/?q=000123')
        assert resp.status_code == 200
        results = resp.json()['results']
        assert any(r['url'].endswith(str(order.id)) for r in results)

    def test_respects_permissions(self, viewer_client):
        order = SaleOrderFactory()
        # viewer_client doesn't have sales.view_saleorder
        resp = viewer_client.get(f'/api/search/?q={order.number}')
        assert order.number not in str(resp.json())

    def test_throttle(self, authenticated_client):
        for i in range(60):
            authenticated_client.get('/api/search/?q=test')
        resp = authenticated_client.get('/api/search/?q=test')
        assert resp.status_code == 429

    def test_all_apps_register_at_least_one_entity(self):
        """Architectural test: each app's ready() registers something."""
        from core.registry import UniversalRegistry
        labels = {label.split('.')[0] for label in UniversalRegistry._entities}
        expected_apps = {'core', 'contacts', 'sales', 'purchasing', 'billing',
                         'inventory', 'accounting', 'treasury', 'production',
                         'hr', 'tax', 'workflow'}
        assert expected_apps.issubset(labels), f"Apps without registry: {expected_apps - labels}"
```

### P-06 (Metadata Schema)

```python
class TestMetadataSchema:
    def test_schema_for_simple_model(self, authenticated_client):
        resp = authenticated_client.get('/api/registry/accounting.budget/schema/')
        assert resp.status_code == 200
        schema = resp.json()
        assert schema['label'] == 'accounting.budget'
        assert 'name' in schema['fields']
        assert schema['fields']['name']['type'] == 'string'
        assert schema['fields']['start_date']['type'] == 'date'

    def test_no_secret_fields_exposed(self, authenticated_client):
        """R-03: never expose pin/password/secret fields."""
        resp = authenticated_client.get('/api/registry/core.user/schema/')
        schema = resp.json()
        forbidden = {'pos_pin', 'password', 'secret', 'token'}
        assert not (set(schema['fields']) & forbidden), \
            f"Schema exposes sensitive fields: {set(schema['fields']) & forbidden}"

    def test_fk_field_includes_target(self, authenticated_client):
        resp = authenticated_client.get('/api/registry/sales.saleorder/schema/')
        schema = resp.json()
        assert schema['fields']['customer']['type'] == 'fk'
        assert schema['fields']['customer']['target'] == 'contacts.contact'

    def test_choices_field_exposed(self, authenticated_client):
        resp = authenticated_client.get('/api/registry/sales.saleorder/schema/')
        schema = resp.json()
        status_choices = schema['fields']['status']['choices']
        assert any(c['value'] == 'DRAFT' for c in status_choices)
```

---

## Tests E2E (5% — solo flujos críticos)

Usar Playwright (verificar si ya está configurado en el repo, si no, agregarlo en F4).

### Flujos cubiertos

1. **Flujo de Venta completo:** crear NV → confirmar → emitir Factura → cobrar → ver Estado de Resultados que refleja el ingreso.
2. **Flujo POS:** abrir sesión → 3 ventas (una con NC) → cerrar caja → verificar diferencias.
3. **Flujo de Compra completo:** crear OCS → recepción de stock → factura proveedor → pago → ver Mayor de Cuentas por Pagar.
4. **Cierre Fiscal:** cierre de periodo mensual → generación de F29 → cierre fiscal anual → asiento de apertura del nuevo año.
5. **Búsqueda Universal (post-F1):** Ctrl+K → buscar por número de factura → navegar al detalle.
6. **EntityForm (post-F4):** crear Budget desde `<EntityForm />` → verificar que se guarda correctamente.

### Anti-patrón en E2E

- ❌ NO testear formularios complejos (POS) en E2E. Eso vive en tests de componente.
- ❌ NO esperar `setTimeout` o `sleep`. Usar `waitFor` por estado.
- ❌ NO depender de datos de seed mutables. Cada test crea su propio escenario.

---

## Tests de Performance

### Benchmarks obligatorios por fase

| Fase | Métrica | Línea base | Objetivo |
|------|---------|-----------|----------|
| F1 | `/api/search/?q=...` p95 | n/a | <300ms con 50k contactos |
| F2 | Listado de SaleOrder con 5k filas | medir antes | <±10% post-merge |
| F3 | Generación de Estado de Resultados | medir antes | <±10% post-merge |
| F4 | `/api/registry/<label>/schema/` (cold) | n/a | <200ms |
| F4 | `/api/registry/<label>/schema/` (warm cache) | n/a | <30ms |
| F5 | Auxiliar de Proveedores con 100k movimientos | medir antes | <+20% (acepta degradación moderada por GFK) |
| F5 | Mayor de cuenta con 50k movimientos | medir antes | <+20% |

### Cómo correr

```bash
# Setup
python manage.py shell -c "from core.tests.fixtures.financial_baseline import build_baseline_dataset; build_baseline_dataset(seed=42)"

# Benchmark
pytest backend/core/tests/test_performance.py --benchmark-only --benchmark-save=baseline
# Tras refactor:
pytest backend/core/tests/test_performance.py --benchmark-only --benchmark-compare=baseline
```

---

## Linters arquitectónicos (custom)

Agregar a CI un test que falle si se introducen antipatrones:

```python
# backend/core/tests/test_architectural_invariants.py
import re
from pathlib import Path

import pytest


BACKEND = Path(__file__).resolve().parents[2]


class TestArchitecturalInvariants:
    def test_no_class_name_discrimination(self):
        """No __class__.__name__ in/== 'X' for type checks."""
        forbidden = re.compile(r'__class__\.__name__\s*(in|==)')
        offenders = []
        for py in BACKEND.rglob('*.py'):
            if 'migrations' in py.parts or 'tests' in py.parts:
                continue
            for i, line in enumerate(py.read_text().splitlines(), 1):
                if forbidden.search(line):
                    offenders.append(f'{py}:{i}: {line.strip()}')
        assert not offenders, '\n'.join(offenders)

    def test_no_isinstance_for_polymorphism(self):
        """No isinstance(x, ConcreteModel) outside services that explicitly need it."""
        # Whitelist: archivos donde isinstance(x, Model) es legítimo
        whitelist = {'serializers.py', 'admin.py'}
        forbidden = re.compile(r'isinstance\([^,]+,\s*(SaleOrder|PurchaseOrder|Invoice|TreasuryMovement)\b')
        offenders = []
        for py in BACKEND.rglob('*.py'):
            if py.name in whitelist or 'tests' in py.parts:
                continue
            for i, line in enumerate(py.read_text().splitlines(), 1):
                if forbidden.search(line):
                    offenders.append(f'{py}:{i}: {line.strip()}')
        assert not offenders, '\n'.join(offenders)

    def test_views_under_20_lines(self):
        """Regla #9 de CLAUDE.md: views ≤ 20 lines per Django action."""
        # ... implementación

    def test_no_raw_tailwind_colors_in_components(self):
        """Regla #2 de CLAUDE.md: no bg-red-500, text-blue-600, etc."""
        # ... (esto vive en frontend)
```

---

## Cobertura objetivo

| Capa | Coverage objetivo |
|------|-------------------|
| `core/strategies/` | >90% |
| `core/registry.py` | >90% |
| `core/services/document.py` | >85% |
| `core/serializers/metadata.py` | >85% |
| Modelos migrados a `TransactionalDocument` | mantener coverage actual |
| Reports (selectors) | mantener coverage actual |
| Total backend | no decae más de 2 puntos vs línea base |

CI debe fallar si:
- Coverage de los nuevos módulos cae bajo el objetivo.
- Coverage total cae más de 2 puntos.
- Algún test arquitectónico falla.

---

## Manejo de tests "flaky" durante el refactor

- **No `@pytest.mark.skip` sin issue trackeado.** Si un test queda flaky por el refactor, abrir issue y ponerle `xfail` con motivo, no skip.
- **Si un test falla de forma intermitente:** investigar antes de re-correr. Race conditions en signals son una causa común durante F3.
- **Tests dependientes del orden:** prohibidos. Usar `pytest-randomly` en CI.

---

## Resumen — Definición de "Done" para una fase

Una fase NO se marca como completa hasta que:

- [ ] Todos los tests de caracterización financiera pasan.
- [ ] Tests específicos del patrón pasan al 100%.
- [ ] Linters arquitectónicos no detectan regresiones.
- [ ] Benchmark de performance no excede el objetivo.
- [ ] Coverage de módulos nuevos cumple objetivo.
- [ ] E2E del flujo crítico pasa.
- [ ] Demo realizada al equipo + stakeholder de finanzas.
- [ ] CHANGELOG actualizado.
