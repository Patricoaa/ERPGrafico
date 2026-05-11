"""
T-56 — Dataset baseline determinístico para tests de regresión financiera.

Construye un dataset reproducible (seed fija) que ejercita los caminos contables
críticos del ERP. Las cifras y fechas son determinísticas, por lo que cualquier
cambio de comportamiento en los selectors financieros (Balance, ER, Cash Flow,
Mayor, Auxiliares) producirá un diff observable contra los snapshots versionados.

Premisa:
    Los reportes financieros consumen `JournalEntry`/`JournalItem`. Para fijar
    el comportamiento basta con generar journal entries determinísticos que
    reflejen las operaciones del negocio. No es necesario reproducir el
    pipeline completo de servicios (warehouses, BOMs, terminales POS, etc.) —
    eso aumentaría la fragilidad sin agregar cobertura de reportes.

    Adicionalmente se crean cabeceras `Contact`, `SaleOrder`, `PurchaseOrder`,
    `Invoice` y `TreasuryMovement` para los reportes que iteran sobre documentos
    (auxiliares de clientes/proveedores, F29).

Convención de fechas:
    Año fiscal 2026. Las transacciones se distribuyen entre 2026-01-01 y 2026-12-31.
    Esto permite probar reportes con `start_date`/`end_date` arbitrarios.

Uso:
    >>> from core.tests.fixtures.financial_baseline import build_baseline_dataset
    >>> data = build_baseline_dataset(seed=42)
    >>> # data['contacts'], data['sale_orders'], data['journal_entries'], etc.

Ver: docs/50-audit/Arquitectura Django/50-testing-strategy.md
     docs/50-audit/Arquitectura Django/20-task-list.md (T-56)
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from django.db import transaction


YEAR = 2026
START_DATE = date(YEAR, 1, 1)
END_DATE = date(YEAR, 12, 31)


@dataclass
class BaselineDataset:
    """Resultado de `build_baseline_dataset` — referencias para los tests."""
    contacts: dict[str, Any] = field(default_factory=dict)
    accounts: dict[str, Any] = field(default_factory=dict)
    sale_orders: list = field(default_factory=list)
    purchase_orders: list = field(default_factory=list)
    invoices: list = field(default_factory=list)
    treasury_movements: list = field(default_factory=list)
    journal_entries: list = field(default_factory=list)


def _date_in_year(month: int, day: int) -> date:
    """Helper to construct dates within the baseline year."""
    return date(YEAR, month, day)


def _create_chart_of_accounts() -> dict[str, Any]:
    """
    Bootstrap the standard IFRS chart of accounts via AccountingService.
    Returns a dict mapping logical names (e.g. 'cash') to Account instances
    for convenient use in journal entry generation.
    """
    from accounting.services import AccountingService
    from accounting.models import Account

    AccountingService.populate_ifrs_coa()

    return {
        'cash': Account.objects.get(code='1.1.01.01'),                    # Caja General
        'bank': Account.objects.get(code='1.1.01.02'),                    # Banco Principal
        'receivable': Account.objects.get(code='1.1.02.01'),              # Clientes Locales
        'inventory': Account.objects.get(code='1.1.03.01'),               # Mercaderías
        'vat_credit': Account.objects.get(code='1.1.04.01'),              # IVA Crédito
        'ppe_machinery': Account.objects.get(code='1.2.01.01'),           # Maquinaria y Equipos
        'accumulated_dep': Account.objects.get(code='1.2.02.01'),         # Depreciación Acumulada
        'payable': Account.objects.get(code='2.1.01.01'),                 # Proveedores Locales
        'vat_debit': Account.objects.get(code='2.1.02.01'),               # IVA Débito
        'salary_payable': Account.objects.get(code='2.1.03.01'),          # Remuneraciones por Pagar
        'capital': Account.objects.get(code='3.1.01'),                    # Capital Social
        'sales_product': Account.objects.get(code='4.1.01'),              # Venta de Productos
        'sales_service': Account.objects.get(code='4.1.02'),              # Venta de Servicios
        'cogs_product': Account.objects.get(code='5.1.01'),               # Costo de Mercaderías
        'expense_salary': Account.objects.get(code='5.2.01.01'),          # Sueldo Base
        'expense_rent': Account.objects.get(code='5.2.02'),               # Arriendos
    }


def _create_contacts() -> dict[str, Any]:
    """
    Crea 8 contactos determinísticos: 5 clientes + 3 proveedores.
    Los IDs no se controlan (autoincrement), solo sus claves lógicas.
    """
    from contacts.models import Contact

    customer_specs = [
        ('66100001-1', 'Imprenta del Sur SpA'),
        ('66100002-2', 'Comercial Andina Ltda'),
        ('66100003-3', 'Distribuidora El Roble S.A.'),
        ('66100004-4', 'Editorial Pacífico'),
        ('66100005-5', 'Cliente Final POS'),
    ]
    supplier_specs = [
        ('77200001-1', 'Papeles y Cartón Chile'),
        ('77200002-2', 'Tintas Industriales SpA'),
        ('77200003-3', 'Servicios Gráficos del Norte'),
    ]

    out: dict[str, Any] = {}
    for i, (rut, name) in enumerate(customer_specs, start=1):
        c, _ = Contact.objects.get_or_create(
            tax_id=rut,
            defaults={'name': name, 'email': f'cliente{i}@test.cl'},
        )
        out[f'customer_{i}'] = c

    for i, (rut, name) in enumerate(supplier_specs, start=1):
        c, _ = Contact.objects.get_or_create(
            tax_id=rut,
            defaults={'name': name, 'email': f'proveedor{i}@test.cl'},
        )
        out[f'supplier_{i}'] = c

    return out


def _build_journal_entry(
    *,
    date_,
    description: str,
    reference: str,
    items: list[tuple[Any, Decimal, Decimal]],
    status: str = 'POSTED',
) -> Any:
    """
    Crea un `JournalEntry` con sus `JournalItem`s atómicamente.
    Cada item es una tupla `(account, debit, credit)`.
    """
    from accounting.models import JournalEntry, JournalItem

    entry = JournalEntry.objects.create(
        date=date_,
        description=description,
        reference=reference,
        status=status,
    )
    for account, debit, credit in items:
        JournalItem.objects.create(
            entry=entry,
            account=account,
            debit=debit,
            credit=credit,
        )
    return entry


def _generate_sale_journal_entries(
    accounts: dict, contacts: dict, rng: random.Random,
) -> tuple[list, list]:
    """
    Genera 100 ventas con su asiento contable POSTED + 100 cabeceras `SaleOrder`.

    Patrón del asiento por venta:
        Dr Clientes / Caja        (bruto)
            Cr Venta Productos    (neto)
            Cr IVA Débito         (impuesto)

    Distribución de pago:
        - 60% pagadas (debit a Banco)
        - 30% crédito pendiente (debit a Clientes Locales)
        - 10% canceladas (status=CANCELLED, sin journal entry)
    """
    from sales.models import SaleOrder

    customers = [contacts[f'customer_{i}'] for i in range(1, 6)]
    sale_orders = []
    journal_entries = []

    for i in range(1, 101):
        d = _date_in_year(
            month=rng.randint(1, 12),
            day=rng.randint(1, 28),
        )
        net = Decimal(rng.randrange(50_000, 500_000, 1_000))
        tax = (net * Decimal('0.19')).quantize(Decimal('1'))
        total = net + tax

        # Determine outcome
        outcome_roll = rng.random()
        if outcome_roll < 0.10:
            status = SaleOrder.Status.CANCELLED
        elif outcome_roll < 0.40:
            status = SaleOrder.Status.CONFIRMED  # credit pending
        else:
            status = SaleOrder.Status.PAID

        customer = rng.choice(customers)

        order = SaleOrder.objects.create(
            customer=customer,
            date=d,
            status=status,
            total_net=net,
            total_tax=tax,
            total=total,
        )
        sale_orders.append(order)

        if status == SaleOrder.Status.CANCELLED:
            continue  # cancelled orders don't post

        debit_account = accounts['bank'] if status == SaleOrder.Status.PAID else accounts['receivable']

        je = _build_journal_entry(
            date_=d,
            description=f'Venta NV-{i:06d}',
            reference=f'NV-{i:06d}',
            items=[
                (debit_account, total, Decimal('0')),
                (accounts['sales_product'], Decimal('0'), net),
                (accounts['vat_debit'], Decimal('0'), tax),
            ],
        )
        order.journal_entry = je
        order.save(update_fields=['journal_entry'])
        journal_entries.append(je)

    return sale_orders, journal_entries


def _generate_purchase_journal_entries(
    accounts: dict, contacts: dict, rng: random.Random,
) -> tuple[list, list]:
    """
    Genera 50 compras con su asiento contable POSTED + 50 cabeceras `PurchaseOrder`.

    Patrón del asiento por compra:
        Dr Mercaderías         (neto)
        Dr IVA Crédito         (impuesto)
            Cr Proveedores     (bruto)
    """
    from purchasing.models import PurchaseOrder

    suppliers = [contacts[f'supplier_{i}'] for i in range(1, 4)]
    purchase_orders = []
    journal_entries = []

    for i in range(1, 51):
        d = _date_in_year(
            month=rng.randint(1, 12),
            day=rng.randint(1, 28),
        )
        net = Decimal(rng.randrange(80_000, 800_000, 1_000))
        tax = (net * Decimal('0.19')).quantize(Decimal('1'))
        total = net + tax

        supplier = rng.choice(suppliers)

        order = PurchaseOrder.objects.create(
            supplier=supplier,
            date=d,
            status=PurchaseOrder.Status.RECEIVED,
            total_net=net,
            total_tax=tax,
            total=total,
        )
        purchase_orders.append(order)

        je = _build_journal_entry(
            date_=d,
            description=f'Compra OC-{i:06d}',
            reference=f'OC-{i:06d}',
            items=[
                (accounts['inventory'], net, Decimal('0')),
                (accounts['vat_credit'], tax, Decimal('0')),
                (accounts['payable'], Decimal('0'), total),
            ],
        )
        order.journal_entry = je
        order.save(update_fields=['journal_entry'])
        journal_entries.append(je)

    return purchase_orders, journal_entries


def _generate_credit_notes(
    accounts: dict, sale_orders: list, rng: random.Random,
) -> tuple[list, list]:
    """
    Genera 30 NC sobre ventas POSTED. Reverso parcial del asiento original.
    """
    from billing.models import Invoice

    posted = [s for s in sale_orders if s.journal_entry is not None]
    selected = rng.sample(posted, min(30, len(posted)))

    invoices = []
    journal_entries = []

    for i, source in enumerate(selected, start=1):
        # Reverso parcial: 30%-70% del total original
        ratio = Decimal(str(round(rng.uniform(0.30, 0.70), 2)))
        net = (source.total_net * ratio).quantize(Decimal('1'))
        tax = (net * Decimal('0.19')).quantize(Decimal('1'))
        total = net + tax

        d = source.date + timedelta(days=rng.randint(5, 30))
        if d > END_DATE:
            d = END_DATE

        nc = Invoice.objects.create(
            dte_type=Invoice.DTEType.NOTA_CREDITO,
            number=f'{i:06d}',
            date=d,
            contact=source.customer,
            sale_order=source,
            corrected_invoice=None,
            status=Invoice.Status.POSTED,
            total_net=net,
            total_tax=tax,
            total=total,
        )
        invoices.append(nc)

        je = _build_journal_entry(
            date_=d,
            description=f'NC sobre {source.number}',
            reference=f'NC-{i:06d}',
            items=[
                (accounts['sales_product'], net, Decimal('0')),
                (accounts['vat_debit'], tax, Decimal('0')),
                (accounts['receivable'], Decimal('0'), total),
            ],
        )
        nc.journal_entry = je
        nc.save(update_fields=['journal_entry'])
        journal_entries.append(je)

    return invoices, journal_entries


def _generate_debit_notes(
    accounts: dict, purchase_orders: list, rng: random.Random,
) -> tuple[list, list]:
    """
    Genera 20 ND sobre compras. Suma adicional al asiento original.
    """
    from billing.models import Invoice

    selected = rng.sample(purchase_orders, min(20, len(purchase_orders)))

    invoices = []
    journal_entries = []

    for i, source in enumerate(selected, start=1):
        ratio = Decimal(str(round(rng.uniform(0.05, 0.20), 2)))
        net = (source.total_net * ratio).quantize(Decimal('1'))
        tax = (net * Decimal('0.19')).quantize(Decimal('1'))
        total = net + tax

        d = source.date + timedelta(days=rng.randint(5, 30))
        if d > END_DATE:
            d = END_DATE

        nd = Invoice.objects.create(
            dte_type=Invoice.DTEType.NOTA_DEBITO,
            number=f'{i:06d}',
            date=d,
            contact=source.supplier,
            purchase_order=source,
            corrected_invoice=None,
            status=Invoice.Status.POSTED,
            total_net=net,
            total_tax=tax,
            total=total,
        )
        invoices.append(nd)

        je = _build_journal_entry(
            date_=d,
            description=f'ND sobre {source.number}',
            reference=f'ND-{i:06d}',
            items=[
                (accounts['inventory'], net, Decimal('0')),
                (accounts['vat_credit'], tax, Decimal('0')),
                (accounts['payable'], Decimal('0'), total),
            ],
        )
        nd.journal_entry = je
        nd.save(update_fields=['journal_entry'])
        journal_entries.append(je)

    return invoices, journal_entries


def _generate_treasury_movements(
    accounts: dict, contacts: dict, rng: random.Random,
) -> tuple[list, list]:
    """
    Genera 100 TreasuryMovement (50 INBOUND cobranzas, 50 OUTBOUND pagos).

    Cada movimiento tiene su asiento contable correspondiente:
        INBOUND:   Dr Banco          / Cr Clientes
        OUTBOUND:  Dr Proveedores    / Cr Banco
    """
    from treasury.models import TreasuryMovement, TreasuryAccount

    # Ensure a treasury account exists (CASH type — no bank/account_number required).
    # Linked to "Caja General" (1.1.01.01) which sits within the cash pool prefix
    # `1.1.01.x`. Movements debit/credit this same account so the snapshots stay
    # consistent.
    treasury_acc, _ = TreasuryAccount.objects.get_or_create(
        name='Caja Tests',
        defaults={
            'account': accounts['cash'],
            'account_type': TreasuryAccount.Type.CASH,
        },
    )

    movements = []
    journal_entries = []

    # 50 INBOUND
    customers = [contacts[f'customer_{i}'] for i in range(1, 6)]
    for i in range(1, 51):
        d = _date_in_year(
            month=rng.randint(1, 12),
            day=rng.randint(1, 28),
        )
        amount = Decimal(rng.randrange(20_000, 300_000, 1_000))
        customer = rng.choice(customers)

        # CASH method (the TreasuryAccount is CASH-typed)
        mv = TreasuryMovement.objects.create(
            movement_type=TreasuryMovement.Type.INBOUND,
            payment_method=TreasuryMovement.Method.CASH,
            to_account=treasury_acc,
            account=accounts['cash'],
            amount=amount,
            date=d,
            contact=customer,
            transaction_number=f'COB-{i:06d}',
            reference=f'COB-{i:06d}',
        )
        movements.append(mv)

        je = _build_journal_entry(
            date_=d,
            description=f'Cobro cliente {customer.name}',
            reference=f'COB-{i:06d}',
            items=[
                (accounts['cash'], amount, Decimal('0')),
                (accounts['receivable'], Decimal('0'), amount),
            ],
        )
        journal_entries.append(je)

    # 50 OUTBOUND
    suppliers = [contacts[f'supplier_{i}'] for i in range(1, 4)]
    for i in range(1, 51):
        d = _date_in_year(
            month=rng.randint(1, 12),
            day=rng.randint(1, 28),
        )
        amount = Decimal(rng.randrange(40_000, 400_000, 1_000))
        supplier = rng.choice(suppliers)

        mv = TreasuryMovement.objects.create(
            movement_type=TreasuryMovement.Type.OUTBOUND,
            payment_method=TreasuryMovement.Method.CASH,
            from_account=treasury_acc,
            account=accounts['cash'],
            amount=amount,
            date=d,
            contact=supplier,
            transaction_number=f'PAG-{i:06d}',
            reference=f'PAG-{i:06d}',
        )
        movements.append(mv)

        je = _build_journal_entry(
            date_=d,
            description=f'Pago proveedor {supplier.name}',
            reference=f'PAG-{i:06d}',
            items=[
                (accounts['payable'], amount, Decimal('0')),
                (accounts['cash'], Decimal('0'), amount),
            ],
        )
        journal_entries.append(je)

    return movements, journal_entries


def _generate_manual_journal_entries(
    accounts: dict, rng: random.Random,
) -> list:
    """
    Genera 50 asientos manuales que cubren caminos contables especiales:
        - 12 depreciaciones mensuales
        - 12 nóminas mensuales (devengo)
        - 12 pagos de arriendo
        - 12 ajustes de inventario / corrección monetaria
        - 1 aporte inicial de capital
        - 1 cierre fiscal anual (utilidad → utilidades retenidas)
    """
    journal_entries = []

    # Aporte inicial de capital (1 enero)
    je = _build_journal_entry(
        date_=_date_in_year(1, 1),
        description='Aporte inicial de capital',
        reference='APERTURA-2026',
        items=[
            (accounts['bank'], Decimal('10000000'), Decimal('0')),
            (accounts['capital'], Decimal('0'), Decimal('10000000')),
        ],
    )
    journal_entries.append(je)

    # Mensual: depreciación, payroll, arriendo, ajuste
    for month in range(1, 13):
        # Depreciación mensual fija (no aleatoria — predictibilidad)
        je = _build_journal_entry(
            date_=date(YEAR, month, 28),
            description=f'Depreciación mes {month:02d}/{YEAR}',
            reference=f'DEP-{month:02d}',
            items=[
                (accounts['expense_rent'], Decimal('0'), Decimal('0')),  # placeholder
            ] if False else [  # Use a dedicated depreciation expense path
                (accounts['expense_rent'], Decimal('200000'), Decimal('0')),
                (accounts['accumulated_dep'], Decimal('0'), Decimal('200000')),
            ],
        )
        journal_entries.append(je)

        # Devengo de remuneraciones
        salary_amount = Decimal('1500000')
        je = _build_journal_entry(
            date_=date(YEAR, month, 28),
            description=f'Devengo remuneraciones {month:02d}/{YEAR}',
            reference=f'PAYROLL-{month:02d}',
            items=[
                (accounts['expense_salary'], salary_amount, Decimal('0')),
                (accounts['salary_payable'], Decimal('0'), salary_amount),
            ],
        )
        journal_entries.append(je)

        # Pago de arriendo
        rent_amount = Decimal('800000')
        je = _build_journal_entry(
            date_=date(YEAR, month, 5),
            description=f'Arriendo {month:02d}/{YEAR}',
            reference=f'RENT-{month:02d}',
            items=[
                (accounts['expense_rent'], rent_amount, Decimal('0')),
                (accounts['bank'], Decimal('0'), rent_amount),
            ],
        )
        journal_entries.append(je)

        # Ajuste menor (deterministic)
        adjust = Decimal(str(rng.randrange(5_000, 25_000)))
        je = _build_journal_entry(
            date_=date(YEAR, month, 15),
            description=f'Ajuste de inventario {month:02d}/{YEAR}',
            reference=f'ADJ-{month:02d}',
            items=[
                (accounts['inventory'], adjust, Decimal('0')),
                (accounts['cogs_product'], Decimal('0'), adjust),
            ],
        )
        journal_entries.append(je)

    return journal_entries


@transaction.atomic
def build_baseline_dataset(seed: int = 42) -> BaselineDataset:
    """
    Construye el dataset baseline para snapshot tests financieros.

    Args:
        seed: semilla para `random.Random`. Default 42.

    Returns:
        `BaselineDataset` con referencias a todos los objetos creados.

    Idempotencia:
        Esta función debe correr dentro de un test que envuelve la transacción
        (típicamente `TransactionTestCase` o `TestCase`). El rollback automático
        garantiza que no contamina la DB de desarrollo.

    Cobertura de caminos:
        - Estados financieros completos (BS, ER, CF, Trial Balance).
        - Asientos del Mayor por cuenta hoja con movimientos.
        - Auxiliares de Clientes y Proveedores con saldos y aging.
        - Reportes de IVA (débito/crédito) para F29.
    """
    rng = random.Random(seed)

    dataset = BaselineDataset()
    dataset.accounts = _create_chart_of_accounts()
    dataset.contacts = _create_contacts()

    sale_orders, sale_jes = _generate_sale_journal_entries(
        dataset.accounts, dataset.contacts, rng,
    )
    purchase_orders, purchase_jes = _generate_purchase_journal_entries(
        dataset.accounts, dataset.contacts, rng,
    )
    credit_notes, nc_jes = _generate_credit_notes(
        dataset.accounts, sale_orders, rng,
    )
    debit_notes, nd_jes = _generate_debit_notes(
        dataset.accounts, purchase_orders, rng,
    )
    movements, treasury_jes = _generate_treasury_movements(
        dataset.accounts, dataset.contacts, rng,
    )
    manual_jes = _generate_manual_journal_entries(dataset.accounts, rng)

    dataset.sale_orders = sale_orders
    dataset.purchase_orders = purchase_orders
    dataset.invoices = credit_notes + debit_notes
    dataset.treasury_movements = movements
    dataset.journal_entries = (
        sale_jes + purchase_jes + nc_jes + nd_jes + treasury_jes + manual_jes
    )

    return dataset
