"""
T-56 — Suite de regresión financiera con snapshots versionados.

Compara el output de los selectors financieros (Balance, ER, Cash Flow, Trial
Balance, Mayor por cuenta, Auxiliares, F29) contra snapshots JSON congelados en
git. Cualquier divergencia indica una regresión potencial en el cálculo
contable y bloquea CI.

Workflow:

    Primera vez (o tras cambio intencional):
        UPDATE_SNAPSHOTS=1 python manage.py test core.tests.test_financial_baseline

    En CI / cada PR:
        python manage.py test core.tests.test_financial_baseline

Cuando un test falla por divergencia:
    1. Inspeccionar el diff entre snapshot esperado y real.
    2. Si el cambio es **regresión**: arreglar el código que la introdujo.
    3. Si el cambio es **intencional** (nuevo campo en reporte, fix de bug
       de cálculo): regenerar con `UPDATE_SNAPSHOTS=1`, revisar el diff del
       JSON en el PR y obtener aprobación explícita del stakeholder financiero.

Ver: docs/50-audit/Arquitectura Django/50-testing-strategy.md
     docs/50-audit/Arquitectura Django/20-task-list.md (T-56)
     core/tests/SNAPSHOTS.md (operación)
"""
from __future__ import annotations

import json
import os
from datetime import date
from decimal import Decimal
from pathlib import Path

from django.test import TestCase

from core.tests.fixtures.financial_baseline import (
    END_DATE,
    START_DATE,
    YEAR,
    build_baseline_dataset,
)
from contacts.selectors import (
    customer_aging_report,
    supplier_aging_report,
)


SNAPSHOT_DIR = Path(__file__).parent / 'snapshots'
UPDATE_SNAPSHOTS = os.environ.get('UPDATE_SNAPSHOTS', '').strip() in {'1', 'true', 'TRUE'}


def _json_default(obj):
    """JSON encoder for Decimal/date objects emitted by the selectors."""
    if isinstance(obj, Decimal):
        # Round-trip exact representation — `str(Decimal)` preserves precision.
        return str(obj)
    if isinstance(obj, date):
        return obj.isoformat()
    raise TypeError(f'Type {type(obj)} not serialisable')


def _normalise(payload):
    """
    Walks the report payload and removes/replaces values that are not stable
    across runs (typically: primary keys, timestamps, ids of generated rows).

    The selectors return PKs of accounts; PKs ARE deterministic per-test
    because each test runs inside its own transaction starting from a clean
    DB. However if a test framework switches to TransactionTestCase with
    --keepdb the PKs would drift — better to strip them upfront.

    Strategy: replace any dict key named 'id' or 'entry_id' with a sentinel
    string so the snapshot only locks down the structure + amounts.
    """
    if isinstance(payload, dict):
        return {
            k: ('<id>' if k in {'id', 'entry_id', 'contact_id'} else _normalise(v))
            for k, v in payload.items()
        }
    if isinstance(payload, list):
        return [_normalise(item) for item in payload]
    return payload


class _SnapshotMixin:
    """
    Mixin que agrega `assertSnapshot` con soporte de UPDATE_SNAPSHOTS.

    Modos de operación:

    - `UPDATE_SNAPSHOTS=1`: escribe el archivo silenciosamente, sin assert
      ni skip. Sirve para regenerar **todos** los snapshots de una corrida
      (incluyendo loops como `test_general_ledger_per_leaf_account` que
      generan ~15 snapshots distintos en un mismo método).

    - Sin `UPDATE_SNAPSHOTS` y archivo NO existe: falla con mensaje claro
      pidiendo correr con `UPDATE_SNAPSHOTS=1`. No auto-genera para que
      la primera generación sea un acto deliberado del operador.

    - Sin `UPDATE_SNAPSHOTS` y archivo existe: compara serialización exacta.
    """

    def assertSnapshot(self, name: str, actual):  # noqa: N802
        SNAPSHOT_DIR.mkdir(exist_ok=True)
        path = SNAPSHOT_DIR / f'{name}.json'

        normalised = _normalise(actual)
        serialised = json.dumps(
            normalised,
            indent=2,
            sort_keys=True,
            default=_json_default,
            ensure_ascii=False,
        )

        if UPDATE_SNAPSHOTS:
            path.write_text(serialised + '\n', encoding='utf-8')
            return  # Generation mode — never asserts, never skips.

        if not path.exists():
            self.fail(
                f'Snapshot {name!r} no encontrado en {path}.\n'
                f'  Ejecuta primero: UPDATE_SNAPSHOTS=1 ./manage.py test '
                f'core.tests.test_financial_baseline'
            )

        expected = path.read_text(encoding='utf-8').rstrip('\n')
        if serialised != expected:
            self.fail(
                f'Snapshot mismatch para {name!r}.\n'
                f'  Esperado ({len(expected)} chars) en {path}\n'
                f'  Obtenido ({len(serialised)} chars).\n'
                f'  Si el cambio es intencional, regenera con '
                f'UPDATE_SNAPSHOTS=1 y revisa el diff JSON en el PR.'
            )


class FinancialBaselineTests(_SnapshotMixin, TestCase):
    """
    Tests de caracterización financiera. Construyen el baseline dataset una
    sola vez por clase (en `setUpTestData`) y comparan los reportes contra
    snapshots versionados.

    Cobertura mínima exigida por T-56:
        - Balance General (1 snapshot)
        - Estado de Resultados (1 snapshot)
        - Estado de Flujo de Efectivo (1 snapshot)
        - Balance de Comprobación (1 snapshot)
        - Mayor por cuenta hoja (~30 snapshots)
        - Análisis financiero (1 snapshot — ratios)

    Snapshots adicionales (Auxiliar Clientes/Proveedores, F29) se agregan
    en T-56 fase 2 cuando la integración con esos selectors esté disponible.
    """

    @classmethod
    def setUpTestData(cls):
        cls.dataset = build_baseline_dataset(seed=42)

    # ----- Estados financieros -----

    def test_balance_sheet(self):
        from finances.services import FinanceService
        report = FinanceService.get_balance_sheet(end_date=END_DATE)
        self.assertSnapshot('balance_sheet', report)

    def test_income_statement(self):
        from finances.services import FinanceService
        report = FinanceService.get_income_statement(
            start_date=START_DATE,
            end_date=END_DATE,
        )
        self.assertSnapshot('income_statement', report)

    def test_cash_flow(self):
        from finances.services import FinanceService
        report = FinanceService.get_cash_flow(
            start_date=START_DATE,
            end_date=END_DATE,
        )
        self.assertSnapshot('cash_flow', report)

    def test_trial_balance(self):
        from finances.services import FinanceService
        report = FinanceService.get_trial_balance(
            start_date=START_DATE,
            end_date=END_DATE,
        )
        self.assertSnapshot('trial_balance', report)

    # ----- Mayor (Libro Mayor) por cuenta hoja con movimientos -----

    def test_general_ledger_per_leaf_account(self):
        """
        Genera un snapshot por cuenta hoja con movimientos durante el año.
        Cubre ~15-20 cuentas dependiendo del dataset (las que efectivamente
        tienen `JournalItem`s).
        """
        from accounting.models import Account
        from accounting.selectors import get_account_ledger

        # Solo cuentas hoja con journal items (evita generar 100 snapshots vacíos)
        leaf_accounts_with_movement = (
            Account.objects
            .filter(children__isnull=True, journal_items__isnull=False)
            .distinct()
            .order_by('code')
        )

        for account in leaf_accounts_with_movement:
            report = get_account_ledger(
                account=account,
                start_date=START_DATE.isoformat(),
                end_date=END_DATE.isoformat(),
            )
            # Code de la cuenta como nombre de snapshot, sanitizado
            safe_code = account.code.replace('.', '_')
            self.assertSnapshot(f'ledger_{safe_code}', report)

    # ----- Análisis financiero (ratios) -----

    def test_financial_analysis_ratios(self):
        from finances.services import FinanceService
        report = FinanceService.get_financial_analysis(
            start_date=START_DATE,
            end_date=END_DATE,
        )
        self.assertSnapshot('financial_analysis', report)


class FinancialBaselineQuarterlyTests(_SnapshotMixin, TestCase):
    """
    Variantes trimestrales de los reportes principales para detectar bugs de
    filtrado por fecha (común durante la migración a `TransactionalDocument`).
    """

    @classmethod
    def setUpTestData(cls):
        cls.dataset = build_baseline_dataset(seed=42)

    def test_balance_sheet_q1(self):
        from finances.services import FinanceService
        report = FinanceService.get_balance_sheet(end_date=date(YEAR, 3, 31))
        self.assertSnapshot('balance_sheet_q1', report)

    def test_balance_sheet_q2(self):
        from finances.services import FinanceService
        report = FinanceService.get_balance_sheet(end_date=date(YEAR, 6, 30))
        self.assertSnapshot('balance_sheet_q2', report)

    def test_balance_sheet_q3(self):
        from finances.services import FinanceService
        report = FinanceService.get_balance_sheet(end_date=date(YEAR, 9, 30))
        self.assertSnapshot('balance_sheet_q3', report)

    def test_income_statement_h1(self):
        from finances.services import FinanceService
        report = FinanceService.get_income_statement(
            start_date=date(YEAR, 1, 1),
            end_date=date(YEAR, 6, 30),
        )
        self.assertSnapshot('income_statement_h1', report)

    def test_income_statement_h2(self):
        from finances.services import FinanceService
        report = FinanceService.get_income_statement(
            start_date=date(YEAR, 7, 1),
            end_date=date(YEAR, 12, 31),
        )
        self.assertSnapshot('income_statement_h2', report)

    def test_cash_flow_q4(self):
        from finances.services import FinanceService
        report = FinanceService.get_cash_flow(
            start_date=date(YEAR, 10, 1),
            end_date=date(YEAR, 12, 31),
        )
        self.assertSnapshot('cash_flow_q4', report)


class FinancialBaselineAgingTests(_SnapshotMixin, TestCase):
    """
    T-56 Fase 2 — Tests de Auxiliar de Clientes y Proveedores.

    Congela el reporte de aging (saldos por tramo de mora) para los
    5 clientes y 3 proveedores del dataset baseline.

    Uso de `cutoff_date=END_DATE`:
        Los buckets de mora dependen de `today - due_date`. Para que los
        snapshots sean estables sin importar cuándo se corre el test, se
        pasa `cutoff_date=END_DATE` (2026-12-31) como fecha de corte fija.
        Esto es coherente con los otros snapshots del año 2026.

    Cobertura exigida por T-56 fase 2:
        - customer_aging (top-20 clientes por saldo) — 1 snapshot
        - supplier_aging (top-20 proveedores por saldo) — 1 snapshot
    """

    @classmethod
    def setUpTestData(cls):
        cls.dataset = build_baseline_dataset(seed=42)

    def test_customer_aging(self):
        """
        Auxiliar de Clientes al 31-12-2026.

        El dataset crea 100 SaleOrders distribuidas entre 5 clientes.
        60% PAID (saldo 0), 30% CONFIRMED (saldo pendiente), 10% CANCELLED.
        Solo los CONFIRMED deben aparecer con saldo > 0.
        """
        report = customer_aging_report(cutoff_date=END_DATE, limit=20)
        self.assertIsInstance(report, list)
        # Hay 5 clientes en el dataset; los que tienen CONFIRMED tienen saldo
        self.assertGreater(len(report), 0, 'Se esperan clientes con saldo pendiente')
        # Cada entrada tiene la estructura correcta
        if report:
            first = report[0]
            for key in ('name', 'tax_id', 'credit_days', 'current',
                        'overdue_30', 'overdue_60', 'overdue_90',
                        'overdue_90plus', 'total'):
                self.assertIn(key, first, f'Falta clave {key!r} en customer_aging')
            # Ordenado descendente por total
            totals = [r['total'] for r in report]
            self.assertEqual(totals, sorted(totals, reverse=True),
                             'customer_aging debe estar ordenado por total desc')
        self.assertSnapshot('customer_aging', report)

    def test_supplier_aging(self):
        """
        Auxiliar de Proveedores al 31-12-2026.

        El dataset crea 50 PurchaseOrders distribuidas entre 3 proveedores,
        todas en estado RECEIVED. Ninguna tiene pagos registrados, por lo que
        todo el monto queda pendiente.
        """
        report = supplier_aging_report(cutoff_date=END_DATE, limit=20)
        self.assertIsInstance(report, list)
        self.assertGreater(len(report), 0, 'Se esperan proveedores con saldo pendiente')
        if report:
            first = report[0]
            for key in ('name', 'tax_id', 'credit_days', 'current',
                        'overdue_30', 'overdue_60', 'overdue_90',
                        'overdue_90plus', 'total'):
                self.assertIn(key, first, f'Falta clave {key!r} en supplier_aging')
            totals = [r['total'] for r in report]
            self.assertEqual(totals, sorted(totals, reverse=True),
                             'supplier_aging debe estar ordenado por total desc')
        self.assertSnapshot('supplier_aging', report)
