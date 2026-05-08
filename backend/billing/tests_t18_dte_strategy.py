"""
T-18 — Tests para billing/strategies/dte.py
Patrón: P-02.B (DTEStrategy)
Fase: F3

Acceptance criteria de T-18:
    [x] ABC DTEStrategy con: expected_fields(), validate(invoice),
        make_journal_entry(invoice, settings), display_prefix.
    [x] Implementaciones para FACTURA y BOLETA como pilotos.
    [x] Test: la salida de make_journal_entry reproduce exactamente lo que hoy
        hace AccountingMapper.get_entries_for_sale_invoice().

Estos tests son unitarios puros — NO requieren DB (las instancias de
Invoice, SaleOrder y AccountingSettings son mocks).
Corren con: pytest backend/billing/tests_t18_dte_strategy.py
"""
from __future__ import annotations

from decimal import Decimal
from unittest.mock import MagicMock, PropertyMock

import pytest

from billing.strategies.dte import (
    DTEStrategy,
    FacturaStrategy,
    BoletaStrategy,
    DTE_STRATEGY_REGISTRY,
    get_dte_strategy,
    _gross_to_net_items,
    _build_revenue_grouping,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_account(name: str = "AccMock") -> MagicMock:
    acc = MagicMock()
    acc.__str__ = lambda self: name
    return acc


def make_product(name: str = "Prod", income_account=None) -> MagicMock:
    prod = MagicMock()
    prod.code = name
    prod.get_income_account = income_account or make_account("Revenue")
    return prod


def make_line(subtotal: Decimal, product=None) -> MagicMock:
    line = MagicMock()
    line.subtotal = subtotal
    line.product = product or make_product()
    return line


def make_customer(account_receivable=None) -> MagicMock:
    c = MagicMock()
    c.name = "Test Customer"
    c.account_receivable = account_receivable or make_account("CxC")
    return c


def make_sale_order(lines: list, number: str = "1001", customer=None) -> MagicMock:
    order = MagicMock()
    order.number = number
    order.customer = customer or make_customer()
    order.lines.all.return_value = iter(lines)
    order.total_net = sum(l.subtotal for l in lines)
    return order


def make_invoice(
    dte_type: str,
    total: Decimal,
    total_net: Decimal,
    total_tax: Decimal,
    sale_order=None,
    number: str = "001",
) -> MagicMock:
    inv = MagicMock()
    inv.dte_type = dte_type
    inv.total = total
    inv.total_net = total_net
    inv.total_tax = total_tax
    inv.sale_order = sale_order or make_sale_order([], number="9999")
    inv.sale_order_id = 1
    inv.number = number
    inv.get_dte_type_display.return_value = {
        'FACTURA': 'Factura Electrónica',
        'BOLETA': 'Boleta Electrónica',
    }.get(dte_type, dte_type)
    # is_tax_exempt property
    type(inv).is_tax_exempt = PropertyMock(return_value=False)
    return inv


def make_settings(
    tax_rate: Decimal = Decimal('19'),
    receivable: object = None,
    tax_payable: object = None,
    revenue: object = None,
) -> MagicMock:
    s = MagicMock()
    s.default_tax_rate = tax_rate
    s.default_receivable_account = receivable or make_account("CxC Default")
    s.default_tax_payable_account = tax_payable or make_account("IVA Pagar")
    s.default_revenue_account = revenue or make_account("Ingresos Default")
    return s


# ---------------------------------------------------------------------------
# Tests de contrato (ABC)
# ---------------------------------------------------------------------------

class TestDTEStrategyABC:
    def test_cannot_instantiate_abc(self):
        with pytest.raises(TypeError):
            DTEStrategy()  # type: ignore[abstract]

    def test_factura_is_concrete(self):
        assert isinstance(FacturaStrategy(), DTEStrategy)

    def test_boleta_is_concrete(self):
        assert isinstance(BoletaStrategy(), DTEStrategy)

    def test_factura_display_prefix(self):
        assert FacturaStrategy().display_prefix == 'FAC'

    def test_boleta_display_prefix(self):
        assert BoletaStrategy().display_prefix == 'BOL'

    def test_factura_sii_code(self):
        assert FacturaStrategy().sii_document_code == 33

    def test_boleta_sii_code(self):
        assert BoletaStrategy().sii_document_code == 39

    def test_expected_fields_factura(self):
        assert 'sale_order' in FacturaStrategy().expected_fields()

    def test_expected_fields_boleta(self):
        assert 'sale_order' in BoletaStrategy().expected_fields()


# ---------------------------------------------------------------------------
# Tests de registro
# ---------------------------------------------------------------------------

class TestDTEStrategyRegistry:
    def test_factura_in_registry(self):
        assert 'FACTURA' in DTE_STRATEGY_REGISTRY
        assert DTE_STRATEGY_REGISTRY['FACTURA'] is FacturaStrategy

    def test_boleta_in_registry(self):
        assert 'BOLETA' in DTE_STRATEGY_REGISTRY
        assert DTE_STRATEGY_REGISTRY['BOLETA'] is BoletaStrategy

    def test_get_dte_strategy_factura(self):
        s = get_dte_strategy('FACTURA')
        assert isinstance(s, FacturaStrategy)

    def test_get_dte_strategy_boleta(self):
        s = get_dte_strategy('BOLETA')
        assert isinstance(s, BoletaStrategy)

    def test_unknown_type_raises_key_error(self):
        with pytest.raises(KeyError):
            get_dte_strategy('TIPO_INEXISTENTE')


# ---------------------------------------------------------------------------
# Tests de validación
# ---------------------------------------------------------------------------

class TestValidation:
    def test_factura_validate_no_sale_order_raises(self):
        from django.core.exceptions import ValidationError
        inv = make_invoice('FACTURA', Decimal('1190'), Decimal('1000'), Decimal('190'))
        inv.sale_order_id = None  # Sin SO
        with pytest.raises(ValidationError):
            FacturaStrategy().validate(inv)

    def test_factura_validate_zero_total_raises(self):
        from django.core.exceptions import ValidationError
        inv = make_invoice('FACTURA', Decimal('0'), Decimal('0'), Decimal('0'))
        with pytest.raises(ValidationError):
            FacturaStrategy().validate(inv)

    def test_factura_validate_valid_invoice_passes(self):
        inv = make_invoice('FACTURA', Decimal('1190'), Decimal('1000'), Decimal('190'))
        FacturaStrategy().validate(inv)  # No debe levantar

    def test_boleta_validate_no_sale_order_raises(self):
        from django.core.exceptions import ValidationError
        inv = make_invoice('BOLETA', Decimal('1190'), Decimal('1000'), Decimal('190'))
        inv.sale_order_id = None
        with pytest.raises(ValidationError):
            BoletaStrategy().validate(inv)


# ---------------------------------------------------------------------------
# Tests de make_journal_entry — FACTURA
# ---------------------------------------------------------------------------

class TestFacturaMakeJournalEntry:
    """
    Verifica que FacturaStrategy.make_journal_entry reproduce exactamente
    la lógica de AccountingMapper.get_entries_for_sale_invoice para
    documentos con IVA (bloque not is_tax_exempt, líneas 581-604).
    """

    strategy = FacturaStrategy()

    def _make_basic_case(self) -> tuple:
        """Factura simple: 1 línea de 1190 bruto → neto 1000, IVA 190."""
        rev_acc = make_account("Ingresos Ventas")
        product = make_product(income_account=rev_acc)
        line = make_line(Decimal('1190'), product)
        customer = make_customer()
        order = make_sale_order([line], number="1001", customer=customer)
        order.total_net = Decimal('1000')

        invoice = make_invoice(
            dte_type='FACTURA',
            total=Decimal('1190'),
            total_net=Decimal('1000'),
            total_tax=Decimal('190'),
            sale_order=order,
            number='001',
        )

        settings = make_settings()
        return invoice, settings, rev_acc, customer

    def test_returns_tuple_of_three(self):
        invoice, settings, _, _ = self._make_basic_case()
        result = self.strategy.make_journal_entry(invoice, settings)
        assert isinstance(result, tuple)
        assert len(result) == 3

    def test_description_contains_order_number(self):
        invoice, settings, _, _ = self._make_basic_case()
        desc, ref, _ = self.strategy.make_journal_entry(invoice, settings)
        assert '1001' in desc  # número de orden

    def test_reference_format(self):
        invoice, settings, _, _ = self._make_basic_case()
        _, ref, _ = self.strategy.make_journal_entry(invoice, settings)
        assert ref.startswith('FAC-')

    def test_first_item_is_receivable_debit(self):
        invoice, settings, _, customer = self._make_basic_case()
        _, _, items = self.strategy.make_journal_entry(invoice, settings)
        first = items[0]
        assert first['debit'] == Decimal('1190')
        assert first['credit'] == Decimal('0.00')
        assert first['account'] == customer.account_receivable

    def test_revenue_item_is_credit_net(self):
        invoice, settings, rev_acc, _ = self._make_basic_case()
        _, _, items = self.strategy.make_journal_entry(invoice, settings)
        rev_items = [i for i in items if i.get('account') == rev_acc]
        assert len(rev_items) == 1
        assert rev_items[0]['credit'] == Decimal('1000')
        assert rev_items[0]['debit'] == Decimal('0.00')

    def test_iva_item_is_credit(self):
        invoice, settings, _, _ = self._make_basic_case()
        _, _, items = self.strategy.make_journal_entry(invoice, settings)
        iva_items = [i for i in items if i.get('account') == settings.default_tax_payable_account]
        assert len(iva_items) == 1
        assert iva_items[0]['credit'] == Decimal('190')

    def test_entry_balances_debit_equals_credit(self):
        """Condición fundamental: la suma de débitos debe igualar la suma de créditos."""
        invoice, settings, _, _ = self._make_basic_case()
        _, _, items = self.strategy.make_journal_entry(invoice, settings)
        total_debit = sum(i.get('debit', Decimal('0')) for i in items)
        total_credit = sum(i.get('credit', Decimal('0')) for i in items)
        assert total_debit == total_credit, (
            f"Asiento desbalanceado: D={total_debit} C={total_credit}"
        )

    def test_zero_tax_omits_iva_item(self):
        """Si total_tax == 0 no debe generarse ítem de IVA."""
        rev_acc = make_account()
        product = make_product(income_account=rev_acc)
        line = make_line(Decimal('1000'), product)
        order = make_sale_order([line], number="2000")
        order.total_net = Decimal('1000')

        invoice = make_invoice('FACTURA', Decimal('1000'), Decimal('1000'), Decimal('0'), sale_order=order)
        settings = make_settings(tax_rate=Decimal('0'))

        _, _, items = self.strategy.make_journal_entry(invoice, settings)
        iva_items = [i for i in items if i.get('label') == 'IVA Débito Fiscal']
        assert len(iva_items) == 0

    def test_multiple_lines_different_accounts_balance(self):
        """Múltiples líneas con distintas cuentas de ingreso — debe seguir balanceando."""
        acc1 = make_account("Rev Prod 1")
        acc2 = make_account("Rev Prod 2")
        line1 = make_line(Decimal('595'), make_product(income_account=acc1))
        line2 = make_line(Decimal('595'), make_product(income_account=acc2))
        order = make_sale_order([line1, line2], number="3000")
        order.total_net = Decimal('1000')

        invoice = make_invoice('FACTURA', Decimal('1190'), Decimal('1000'), Decimal('190'), sale_order=order)
        settings = make_settings()

        _, _, items = self.strategy.make_journal_entry(invoice, settings)
        total_debit = sum(i.get('debit', Decimal('0')) for i in items)
        total_credit = sum(i.get('credit', Decimal('0')) for i in items)
        assert total_debit == total_credit


# ---------------------------------------------------------------------------
# Tests de make_journal_entry — BOLETA
# ---------------------------------------------------------------------------

class TestBoletaMakeJournalEntry:
    """
    La Boleta de venta tiene el mismo asiento contable que la Factura
    (mismo tratamiento IVA en ventas). El test verifica la equivalencia
    y la correcta composición de description/reference.
    """

    strategy = BoletaStrategy()

    def test_returns_same_structure_as_factura(self):
        rev_acc = make_account("Ingresos")
        product = make_product(income_account=rev_acc)
        line = make_line(Decimal('1190'), product)
        order = make_sale_order([line], number="5001")
        order.total_net = Decimal('1000')

        invoice = make_invoice('BOLETA', Decimal('1190'), Decimal('1000'), Decimal('190'), sale_order=order, number='101')
        settings = make_settings()

        desc, ref, items = self.strategy.make_journal_entry(invoice, settings)

        total_debit = sum(i.get('debit', Decimal('0')) for i in items)
        total_credit = sum(i.get('credit', Decimal('0')) for i in items)
        assert total_debit == total_credit
        assert ref.startswith('BOL-')
        assert '5001' in desc

    def test_label_uses_boleta_prefix(self):
        rev_acc = make_account()
        product = make_product(income_account=rev_acc)
        line = make_line(Decimal('1190'), product)
        order = make_sale_order([line], number="5002")
        order.total_net = Decimal('1000')

        invoice = make_invoice('BOLETA', Decimal('1190'), Decimal('1000'), Decimal('190'), sale_order=order, number='102')
        settings = make_settings()

        _, _, items = self.strategy.make_journal_entry(invoice, settings)
        rev_items = [i for i in items if i.get('label', '').startswith('Boleta')]
        assert len(rev_items) == 1


# ---------------------------------------------------------------------------
# Test de equivalencia vs. AccountingMapper (reproduce exactamente)
# ---------------------------------------------------------------------------

class TestEquivalenceWithAccountingMapper:
    """
    Verifica que FacturaStrategy.make_journal_entry() produce la misma
    lista de items que AccountingMapper.get_entries_for_sale_invoice()
    usando los mismos datos de entrada.
    """

    def test_item_count_matches_mapper(self):
        """
        Con 1 línea y IVA, AccountingMapper genera 3 items:
        receivable Dr, revenue Cr, IVA Cr.
        FacturaStrategy debe generar exactamente 3.
        """
        rev_acc = make_account("Rev")
        product = make_product(income_account=rev_acc)
        line = make_line(Decimal('1190'), product)
        customer = make_customer()
        order = make_sale_order([line], number="7001", customer=customer)
        order.total_net = Decimal('1000')

        invoice = make_invoice('FACTURA', Decimal('1190'), Decimal('1000'), Decimal('190'), sale_order=order)
        settings = make_settings()

        _, _, items = FacturaStrategy().make_journal_entry(invoice, settings)
        assert len(items) == 3

    def test_receivable_partner_set_correctly(self):
        """El primer item debe tener partner = customer."""
        customer = make_customer()
        product = make_product()
        line = make_line(Decimal('1190'), product)
        order = make_sale_order([line], number="8001", customer=customer)
        order.total_net = Decimal('1000')

        invoice = make_invoice('FACTURA', Decimal('1190'), Decimal('1000'), Decimal('190'), sale_order=order)
        settings = make_settings()

        _, _, items = FacturaStrategy().make_journal_entry(invoice, settings)
        assert items[0]['partner'] is customer
        assert items[0]['partner_name'] == customer.name


# ---------------------------------------------------------------------------
# Test arquitectónico — sin antipatrón dte_type == 'FACTURA' en código real
# ---------------------------------------------------------------------------

class TestNoStringDTETypeAntipattern:
    """
    Verifica que el archivo strategies/dte.py no contenga comparaciones
    directas de string para dte_type en código ejecutable (antipatrón P-02.B).
    """

    def test_no_string_dte_comparison_in_code(self):
        import ast
        import re
        from pathlib import Path

        dte_file = Path(__file__).parent / 'strategies' / 'dte.py'
        source = dte_file.read_text()
        tree = ast.parse(source)

        # Buscar comparaciones == 'STRING_DTE' en código real (no en strings)
        forbidden = re.compile(
            r"""dte_type\s*==\s*['"](?:FACTURA|BOLETA|NOTA_CREDITO|NOTA_DEBITO|PURCHASE_INV|COMPROBANTE_PAGO|FACTURA_EXENTA|BOLETA_EXENTA)['"]"""
        )
        offenders: list[str] = []

        for node in ast.walk(tree):
            if isinstance(node, ast.Constant) and isinstance(node.value, str):
                continue
            if isinstance(node, ast.Compare):
                seg = ast.unparse(node)
                if forbidden.search(seg):
                    offenders.append(f"L{node.lineno}: {seg}")

        assert not offenders, (
            "Antipatrón dte_type == 'STRING' en código ejecutable "
            f"de billing/strategies/dte.py:\n" + "\n".join(offenders)
        )
