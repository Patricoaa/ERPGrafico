"""
T-16 — Tests para core/strategies/totals.py
Patrón: P-02.A (TotalsStrategy)
Fase: F3

Acceptance criteria de T-16:
    [x] ABC TotalsStrategy con método compute(document) -> dict.
    [x] GrossFirstTotals y NetFirstTotals implementan toda la lógica actual.
    [x] Tests con casos: descuento por línea, descuento total, IVA exento, redondeo.

Estos tests son unitarios puros — NO requieren DB (las instancias de documento
son mocks simples). Corren con: pytest backend/core/tests_t16_totals_strategy.py
"""
from __future__ import annotations

from decimal import Decimal
from unittest.mock import MagicMock, PropertyMock

import pytest

from core.strategies.totals import GrossFirstTotals, NetFirstTotals, TotalsStrategy


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_line(subtotal: Decimal, tax_rate: Decimal = Decimal('19.00')) -> MagicMock:
    """Línea mock con subtotal fijo (calculate_subtotal no hace nada)."""
    line = MagicMock()
    line.subtotal = subtotal
    line.tax_rate = tax_rate
    line.calculate_subtotal = MagicMock()  # no-op (ya calculado)
    return line


def make_document(lines: list, total_discount_amount: Decimal = Decimal('0')) -> MagicMock:
    """
    Documento mock con reverse manager 'lines'.
    Expone total_net, total_tax, total como atributos mutable y
    total_discount_amount para compatibilidad con GrossFirstTotals.
    """
    doc = MagicMock()
    doc.lines.all.return_value = iter(lines)
    doc.lines.first.return_value = lines[0] if lines else None
    doc.total_discount_amount = total_discount_amount
    doc.total_net = Decimal('0')
    doc.total_tax = Decimal('0')
    doc.total = Decimal('0')
    # save() no debe levantar excepción
    doc.save = MagicMock()
    return doc


# ---------------------------------------------------------------------------
# Tests de contrato (ABC)
# ---------------------------------------------------------------------------

class TestTotalsStrategyABC:
    def test_cannot_instantiate_abc(self):
        with pytest.raises(TypeError):
            TotalsStrategy()  # type: ignore[abstract]

    def test_gross_first_is_concrete(self):
        strategy = GrossFirstTotals()
        assert isinstance(strategy, TotalsStrategy)

    def test_net_first_is_concrete(self):
        strategy = NetFirstTotals()
        assert isinstance(strategy, TotalsStrategy)


# ---------------------------------------------------------------------------
# GrossFirstTotals
# ---------------------------------------------------------------------------

class TestGrossFirstTotals:
    strategy = GrossFirstTotals()

    def test_basic_single_line(self):
        """Gross 1190 → Net 1000, Tax 190."""
        lines = [make_line(Decimal('1190'), Decimal('19.00'))]
        doc = make_document(lines)

        result = self.strategy.compute(doc, commit=False)

        assert doc.total == Decimal('1190')
        assert doc.total_net == Decimal('1000')
        assert doc.total_tax == Decimal('190')
        assert result == {'net': Decimal('1000'), 'tax': Decimal('190'), 'total': Decimal('1190')}

    def test_multiple_lines(self):
        """Dos líneas de 1190 → total 2380, net 2000, tax 380."""
        lines = [
            make_line(Decimal('1190'), Decimal('19.00')),
            make_line(Decimal('1190'), Decimal('19.00')),
        ]
        doc = make_document(lines)

        self.strategy.compute(doc, commit=False)

        assert doc.total == Decimal('2380')
        assert doc.total_net == Decimal('2000')
        assert doc.total_tax == Decimal('380')

    def test_total_discount_applied(self):
        """Descuento global de 190 sobre total de 1190 → total final 1000."""
        lines = [make_line(Decimal('1190'), Decimal('19.00'))]
        doc = make_document(lines, total_discount_amount=Decimal('190'))

        self.strategy.compute(doc, commit=False)

        # Total bruto post-descuento = 1000 (exento de IVA por debajo del umbral)
        assert doc.total == Decimal('1000')
        # Net = 1000 / 1.19 = 840.33... → redondeado → 840
        assert doc.total_net == Decimal('840')
        assert doc.total_tax == Decimal('160')

    def test_total_discount_cannot_go_negative(self):
        """Descuento mayor al total → total = 0, net = 0, tax = 0."""
        lines = [make_line(Decimal('500'))]
        doc = make_document(lines, total_discount_amount=Decimal('1000'))

        self.strategy.compute(doc, commit=False)

        assert doc.total == Decimal('0')
        assert doc.total_net == Decimal('0')
        assert doc.total_tax == Decimal('0')

    def test_iva_exento_tax_rate_zero(self):
        """Tasa 0% → todo el total es neto, sin impuesto."""
        lines = [make_line(Decimal('1000'), Decimal('0.00'))]
        doc = make_document(lines)

        self.strategy.compute(doc, commit=False)

        assert doc.total == Decimal('1000')
        assert doc.total_net == Decimal('1000')
        assert doc.total_tax == Decimal('0')

    def test_rounding_half_up(self):
        """
        Caso de redondeo: 595 bruto / 1.19 = 500.0 exacto (sin fracción).
        Otro caso: 100 / 1.19 = 84.033... → 84 (ROUND_HALF_UP).
        """
        lines = [make_line(Decimal('100'), Decimal('19.00'))]
        doc = make_document(lines)

        self.strategy.compute(doc, commit=False)

        # 100 / 1.19 = 84.0336... → 84
        assert doc.total_net == Decimal('84')
        # IVA = 100 - 84 = 16
        assert doc.total_tax == Decimal('16')

    def test_no_lines_yields_zero(self):
        """Sin líneas → todos los totales en cero."""
        doc = make_document([])

        self.strategy.compute(doc, commit=False)

        assert doc.total == Decimal('0')
        assert doc.total_net == Decimal('0')
        assert doc.total_tax == Decimal('0')

    def test_calls_calculate_subtotal_on_lines(self):
        """Se llama calculate_subtotal en cada línea antes de sumar."""
        line = make_line(Decimal('1190'))
        doc = make_document([line])

        self.strategy.compute(doc, commit=False)

        line.calculate_subtotal.assert_called_once()

    def test_commit_true_calls_save(self):
        """commit=True debe llamar doc.save(update_fields=[...])."""
        lines = [make_line(Decimal('1190'))]
        doc = make_document(lines)

        self.strategy.compute(doc, commit=True)

        doc.save.assert_called_once()
        call_kwargs = doc.save.call_args[1]
        assert set(call_kwargs.get('update_fields', [])) == {'total_net', 'total_tax', 'total'}

    def test_commit_false_does_not_save(self):
        """commit=False no debe llamar doc.save."""
        lines = [make_line(Decimal('1190'))]
        doc = make_document(lines)

        self.strategy.compute(doc, commit=False)

        doc.save.assert_not_called()


# ---------------------------------------------------------------------------
# NetFirstTotals
# ---------------------------------------------------------------------------

class TestNetFirstTotals:
    strategy = NetFirstTotals()

    def test_basic_single_line(self):
        """Net 1000 → Tax 190 (19%), Total 1190."""
        lines = [make_line(Decimal('1000'), Decimal('19.00'))]
        doc = make_document(lines)

        result = self.strategy.compute(doc, commit=False)

        assert doc.total_net == Decimal('1000')
        assert doc.total_tax == Decimal('190')
        assert doc.total == Decimal('1190')
        assert result == {'net': Decimal('1000'), 'tax': Decimal('190'), 'total': Decimal('1190')}

    def test_multiple_lines(self):
        """Dos líneas de 1000 → net 2000, tax 380, total 2380."""
        lines = [
            make_line(Decimal('1000'), Decimal('19.00')),
            make_line(Decimal('1000'), Decimal('19.00')),
        ]
        doc = make_document(lines)

        self.strategy.compute(doc, commit=False)

        assert doc.total_net == Decimal('2000')
        assert doc.total_tax == Decimal('380')
        assert doc.total == Decimal('2380')

    def test_iva_exento_tax_rate_zero(self):
        """Tasa 0% → IVA = 0, total = neto."""
        lines = [make_line(Decimal('500'), Decimal('0.00'))]
        doc = make_document(lines)

        self.strategy.compute(doc, commit=False)

        assert doc.total_net == Decimal('500')
        assert doc.total_tax == Decimal('0')
        assert doc.total == Decimal('500')

    def test_rounding_half_up_iva(self):
        """
        Net 100, tasa 19% → IVA crudo = 19.0 exacto.
        Caso con fracción: Net 10, tasa 19% → IVA = 1.9 → redondeado = 2.
        """
        lines = [make_line(Decimal('10'), Decimal('19.00'))]
        doc = make_document(lines)

        self.strategy.compute(doc, commit=False)

        assert doc.total_net == Decimal('10')
        assert doc.total_tax == Decimal('2')   # 1.9 → ROUND_HALF_UP → 2
        assert doc.total == Decimal('12')

    def test_no_lines_yields_zero(self):
        """Sin líneas → todos los totales en cero."""
        doc = make_document([])

        self.strategy.compute(doc, commit=False)

        assert doc.total_net == Decimal('0')
        assert doc.total_tax == Decimal('0')
        assert doc.total == Decimal('0')

    def test_calls_calculate_subtotal_on_lines(self):
        """Se llama calculate_subtotal en cada línea antes de sumar."""
        line = make_line(Decimal('1000'))
        doc = make_document([line])

        self.strategy.compute(doc, commit=False)

        line.calculate_subtotal.assert_called_once()

    def test_commit_true_calls_save(self):
        """commit=True debe llamar doc.save(update_fields=[...])."""
        lines = [make_line(Decimal('1000'))]
        doc = make_document(lines)

        self.strategy.compute(doc, commit=True)

        doc.save.assert_called_once()
        call_kwargs = doc.save.call_args[1]
        assert set(call_kwargs.get('update_fields', [])) == {'total_net', 'total_tax', 'total'}

    def test_commit_false_does_not_save(self):
        """commit=False no debe llamar doc.save."""
        lines = [make_line(Decimal('1000'))]
        doc = make_document(lines)

        self.strategy.compute(doc, commit=False)

        doc.save.assert_not_called()

    def test_no_discount_field_required(self):
        """NetFirstTotals no depende de total_discount_amount — no debe fallar si falta."""
        lines = [make_line(Decimal('1000'))]
        doc = MagicMock()
        doc.lines.all.return_value = iter(lines)
        doc.lines.first.return_value = lines[0]
        # SIN total_discount_amount
        del doc.total_discount_amount
        doc.total_net = Decimal('0')
        doc.total_tax = Decimal('0')
        doc.total = Decimal('0')
        doc.save = MagicMock()

        self.strategy.compute(doc, commit=False)

        assert doc.total_net == Decimal('1000')


# ---------------------------------------------------------------------------
# Test arquitectónico (smoke test de antipatrón)
# ---------------------------------------------------------------------------

class TestNoClassNameAntipattern:
    """
    Verifica que el antipatrón no haya sido re-introducido en código real
    de core/strategies/. Usa AST para ignorar docstrings y string literals.

    La verificación completa del codebase es responsabilidad del test en
    50-testing-strategy.md :: TestArchitecturalInvariants.
    """

    def test_strategy_file_has_no_class_name_check(self):
        """
        Parsea el módulo con ast y busca el patrón
        ``__class__.__name__ in/== ...`` solo en nodos de código ejecutable,
        excluyendo string literals y docstrings.
        """
        import ast
        import re
        from pathlib import Path

        strategy_file = Path(__file__).parent / 'strategies' / 'totals.py'
        source = strategy_file.read_text()
        tree = ast.parse(source)

        forbidden = re.compile(r'__class__\.__name__\s*(in|==)')
        offenders: list[str] = []

        for node in ast.walk(tree):
            # Ignorar nodos que son strings puros (docstrings / string literals)
            if isinstance(node, ast.Constant) and isinstance(node.value, str):
                continue
            # Solo analizar nodos de comparación y expresiones de nombre
            if isinstance(node, ast.Compare):
                src_segment = ast.unparse(node)
                if forbidden.search(src_segment):
                    offenders.append(
                        f"L{node.lineno}: {src_segment}"
                    )

        assert not offenders, (
            "Antipatrón __class__.__name__ detectado en código ejecutable "
            f"de core/strategies/totals.py:\n" + "\n".join(offenders)
        )

