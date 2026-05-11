"""
T-16 — core/strategies/totals.py
Patrón: P-02.A (TotalsStrategy)
Fase: F3 — Strategy Pattern + extracción de side-effects

Reemplaza el antipatrón:
    is_sales = self.__class__.__name__ in ['SaleOrder', 'SaleDelivery', 'DraftCart']
en core/mixins.py::TotalsCalculationMixin.recalculate_totals().

Cada documento declara su strategy como atributo de clase:
    class SaleOrder(TransactionalDocument, TotalsCalculationMixin):
        totals_strategy = GrossFirstTotals

    class PurchaseOrder(TransactionalDocument, TotalsCalculationMixin):
        totals_strategy = NetFirstTotals

El mixin luego delega:
    def recalculate_totals(self, commit=True):
        return self.totals_strategy().compute(self, commit=commit)

Ver: docs/50-audit/Arquitectura Django/30-patterns.md#p-02a--totalsstrategy
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from decimal import Decimal
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    # Evitar import circular en runtime; solo para type checkers.
    from django.db import models as django_models


class TotalsStrategy(ABC):
    """
    Estrategia de cálculo de totales para documentos cabecera+líneas.

    Contrato:
    - Recibe un ``document`` que expone un reverse manager ``lines`` con objetos
      que opcionalmente implementan ``calculate_subtotal()`` y tienen un campo
      ``subtotal`` y ``tax_rate``.
    - Calcula y, si ``commit=True``, persiste ``total_net``, ``total_tax``, ``total``
      usando ``document.save(update_fields=[...])``.
    - Retorna dict con los valores calculados: ``{'net': ..., 'tax': ..., 'total': ...}``.
    """

    @abstractmethod
    def compute(self, document, *, commit: bool = True) -> dict:
        """
        Calcula totales del ``document`` y opcionalmente los persiste.

        Args:
            document: instancia de un modelo con ``lines`` reverse manager y
                      campos ``total_net``, ``total_tax``, ``total``.
            commit: si True, llama a ``document.save(update_fields=[...])``
                    al terminar.

        Returns:
            dict con claves ``net``, ``tax``, ``total``.
        """
        ...

    @property
    @abstractmethod
    def invoice_field(self) -> str:
        """Nombre del campo FK en Invoice que apunta al documento origen."""
        ...


class GrossFirstTotals(TotalsStrategy):
    """
    Lógica Gross-first (ventas al consumidor final).

    Aplica a: ``SaleOrder``, ``SaleDelivery``, ``SaleReturn``.

    Las líneas ya tienen precio bruto (con IVA incluido). Se extrae el neto
    dividiendo por (1 + tasa). El IVA es la diferencia Bruto - Neto.

    Algoritmo idéntico al bloque ``if is_sales:`` que existía en
    ``TotalsCalculationMixin.recalculate_totals()`` (core/mixins.py:91-103).
    """
    invoice_field = 'sale_order'

    def compute(self, document, *, commit: bool = True) -> dict:
        total_sum = Decimal('0.00')
        tax_rate = Decimal('19.00')

        # Sumar subtotales de cada línea
        for line in document.lines.all():
            if hasattr(line, 'calculate_subtotal'):
                line.calculate_subtotal()
            total_sum += getattr(line, 'subtotal', Decimal('0.00'))

        # La tasa se lee de la primera línea; todas deberían ser iguales (ver R-04)
        first_line = document.lines.first()
        if first_line and hasattr(first_line, 'tax_rate'):
            tax_rate = getattr(first_line, 'tax_rate', tax_rate)

        # Aplicar descuento global si el documento lo tiene (solo SaleOrder)
        total_discount = getattr(document, 'total_discount_amount', Decimal('0.00'))
        document.total = max(Decimal('0'), total_sum - total_discount)

        # Extraer neto: Neto = Bruto / (1 + tasa%)
        divisor = Decimal('1') + (tax_rate / Decimal('100.0'))
        net_raw = document.total / divisor
        document.total_net = net_raw.quantize(Decimal('1'), rounding='ROUND_HALF_UP')

        # IVA = diferencia (evita acumulación de errores de redondeo)
        document.total_tax = document.total - document.total_net

        if commit:
            document.save(update_fields=['total_net', 'total_tax', 'total'])

        return {
            'net': document.total_net,
            'tax': document.total_tax,
            'total': document.total,
        }


class NetFirstTotals(TotalsStrategy):
    """
    Lógica Net-first (compras / documentos de proveedor).

    Aplica a: ``PurchaseOrder``, ``PurchaseReceipt``, ``PurchaseReturn``.

    Las líneas tienen precio neto (sin IVA). El IVA se calcula sobre el neto
    y se redondea al peso entero (requerimiento DTE SII chileno).

    Algoritmo idéntico al bloque ``else:`` que existía en
    ``TotalsCalculationMixin.recalculate_totals()`` (core/mixins.py:104-112).
    """
    invoice_field = 'purchase_order'

    def compute(self, document, *, commit: bool = True) -> dict:
        total_sum = Decimal('0.00')
        tax_rate = Decimal('19.00')

        # Sumar subtotales de cada línea
        for line in document.lines.all():
            if hasattr(line, 'calculate_subtotal'):
                line.calculate_subtotal()
            total_sum += getattr(line, 'subtotal', Decimal('0.00'))

        # La tasa se lee de la primera línea
        first_line = document.lines.first()
        if first_line and hasattr(first_line, 'tax_rate'):
            tax_rate = getattr(first_line, 'tax_rate', tax_rate)

        document.total_net = total_sum

        # IVA sobre el neto, redondeado al peso (DTE SII)
        tax_raw = document.total_net * (tax_rate / Decimal('100.0'))
        document.total_tax = tax_raw.quantize(Decimal('1'), rounding='ROUND_HALF_UP')

        document.total = document.total_net + document.total_tax

        if commit:
            document.save(update_fields=['total_net', 'total_tax', 'total'])

        return {
            'net': document.total_net,
            'tax': document.total_tax,
            'total': document.total,
        }
