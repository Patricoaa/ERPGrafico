"""
T-18 — billing/strategies/dte.py
Patrón: P-02.B (DTEStrategy)
Fase: F3 — Strategy Pattern + extracción de side-effects

Encapsula el comportamiento por tipo de DTE que hoy vive disperso en
`billing/services.py` (if/elif sobre dte_type) y en
`accounting/services.py::AccountingMapper`.

Estructura:

    DTEStrategy (ABC)
    ├── expected_fields()       → campos requeridos al crear Invoice
    ├── validate(invoice)       → validaciones de negocio previas al POSTED
    ├── make_journal_entry(invoice, settings) → (description, reference, items)
    └── display_prefix          → prefijo de display_id (ej. "FAC", "BOL")

    FacturaStrategy    — DTE 33 (Factura Electrónica, ventas afectas)
    BoletaStrategy     — DTE 39 (Boleta Electrónica, ventas afectas)

Las demás implementaciones vienen en T-19:
    FacturaExentaStrategy, BoletaExentaStrategy, PurchaseInvStrategy,
    NotaCreditoStrategy, NotaDebitoStrategy, ComprobantePagoStrategy.

Ver: docs/50-audit/Arquitectura Django/30-patterns.md#p-02b--dtestrategy
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from decimal import Decimal
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    # Solo para type checkers — evitar import circular en runtime.
    from billing.models import Invoice
    from accounting.models import AccountingSettings


# ---------------------------------------------------------------------------
# Tipo de los items de asiento (mismo contrato que AccountingMapper)
# ---------------------------------------------------------------------------
# list[dict] con claves: account, debit, credit, partner?, partner_name?, label?
JournalItemList = list


class DTEStrategy(ABC):
    """
    Estrategia de comportamiento por tipo de DTE.

    Permite polimorfismo sin if-elif en BillingService y elimina el
    antipatrón ``dte_type == 'FACTURA'`` en el service layer.

    Contrato de métodos:
    - ``expected_fields()`` → set de nombres de campo requeridos en Invoice
      al momento de creación (ejemplo: {'sale_order'} para ventas).
    - ``validate(invoice)`` → lanza ValidationError si el documento no está
      listo para ser POSTED.
    - ``make_journal_entry(invoice, settings)`` → (description, reference, items)
      reproduciendo exactamente la lógica de AccountingMapper para este DTE.
    - ``display_prefix`` → prefijo para display_id (e.g. "FAC", "BOL", "NC").
    - ``sii_document_code`` → código numérico SII del documento.
    """

    @property
    @abstractmethod
    def display_prefix(self) -> str:
        """Prefijo de display_id. Ejemplo: 'FAC', 'BOL', 'NC'."""
        ...

    @property
    @abstractmethod
    def sii_document_code(self) -> int:
        """Código oficial SII del tipo de DTE."""
        ...

    def expected_fields(self) -> set[str]:
        """
        Conjunto de campos de Invoice que deben estar presentes.
        Subclases pueden extender para requerir campos adicionales.
        """
        return set()

    def validate(self, invoice: "Invoice") -> None:
        """
        Validaciones de negocio antes de hacer POSTED.
        Lanza ``django.core.exceptions.ValidationError`` si falla.
        """
        pass  # Por defecto no hay validación adicional

    @abstractmethod
    def make_journal_entry(
        self,
        invoice: "Invoice",
        settings: "AccountingSettings",
    ) -> tuple[str, str, JournalItemList]:
        """
        Genera el asiento contable para este DTE.

        Returns:
            Tupla ``(description, reference, items)`` lista para pasar a
            ``JournalEntryService.create_entry()``.
        """
        ...


# ---------------------------------------------------------------------------
# Utilidades internas compartidas
# ---------------------------------------------------------------------------

def _gross_to_net_items(
    revenue_gross_grouping: dict,
    total_net: Decimal,
    tax_divisor: Decimal,
    label_prefix: str,
) -> tuple[list, Decimal]:
    """
    Distribuye el neto entre cuentas de ingresos según el peso bruto de cada
    una, usando el último bucket para absorber el redondeo.

    Returns:
        (items_list, tax_amount) donde tax_amount = total_bruto - total_neto.
    """
    items = []
    total_net_remaining = total_net
    accounts = list(revenue_gross_grouping.items())

    for i, (acc, gross_amount) in enumerate(accounts):
        if i == len(accounts) - 1:
            net_amount = total_net_remaining
        else:
            net_amount = (gross_amount / tax_divisor).quantize(
                Decimal('1'), rounding='ROUND_HALF_UP'
            )

        if net_amount != 0:
            items.append({
                'account': acc,
                'debit': Decimal('0.00'),
                'credit': net_amount,
                'label': label_prefix,
            })
            total_net_remaining -= net_amount

    return items


def _build_revenue_grouping(invoice: "Invoice") -> dict:
    """
    Agrupa el importe bruto de cada línea por cuenta de ingresos del producto.
    Usado por estrategias de facturas de ventas.
    """
    from django.core.exceptions import ValidationError

    revenue_gross_grouping: dict = {}
    for line in invoice.sale_order.lines.all():
        rev_acc = line.product.get_income_account
        if not rev_acc:
            from accounting.models import AccountingSettings
            settings = AccountingSettings.get_solo()
            rev_acc = settings.default_revenue_account
        if not rev_acc:
            raise ValidationError(
                f"Falta configurar cuenta de ingresos para el producto {line.product.code}."
            )
        revenue_gross_grouping[rev_acc] = (
            revenue_gross_grouping.get(rev_acc, Decimal('0.00')) + line.subtotal
        )
    return revenue_gross_grouping


# ---------------------------------------------------------------------------
# Estrategias concretas (pilotos T-18)
# ---------------------------------------------------------------------------

class FacturaStrategy(DTEStrategy):
    """
    DTE 33 — Factura Electrónica (ventas afectas, consumidores con RUT).

    Asiento:
        Dr  Clientes (CxC)            = invoice.total
        Cr  Ingresos (distribuido)    = invoice.total_net
        Cr  IVA Débito Fiscal         = invoice.total_tax

    Lógica idéntica al bloque ``not is_tax_exempt`` de
    ``AccountingMapper.get_entries_for_sale_invoice()``
    (accounting/services.py:581-604).
    """

    display_prefix = 'FAC'
    sii_document_code = 33

    def expected_fields(self) -> set[str]:
        return {'sale_order'}

    def validate(self, invoice: "Invoice") -> None:
        from django.core.exceptions import ValidationError
        if not invoice.sale_order_id:
            raise ValidationError("FACTURA requiere una Nota de Venta asociada.")
        if invoice.total <= Decimal('0'):
            raise ValidationError("El total de la FACTURA debe ser mayor a cero.")

    def make_journal_entry(
        self,
        invoice: "Invoice",
        settings: "AccountingSettings",
    ) -> tuple[str, str, JournalItemList]:
        from django.core.exceptions import ValidationError

        order = invoice.sale_order
        receivable_account = (
            order.customer.account_receivable or settings.default_receivable_account
        )
        if not receivable_account:
            raise ValidationError("Falta configuración de cuenta por cobrar.")

        revenue_gross_grouping = _build_revenue_grouping(invoice)
        tax_divisor = Decimal('1') + (settings.default_tax_rate / Decimal('100.00'))

        items: JournalItemList = [
            {
                'account': receivable_account,
                'debit': invoice.total,
                'credit': Decimal('0.00'),
                'partner': order.customer,
                'partner_name': order.customer.name,
            }
        ]

        net_items = _gross_to_net_items(
            revenue_gross_grouping,
            invoice.total_net,
            tax_divisor,
            label_prefix=f"Factura {invoice.number or ''}",
        )
        items.extend(net_items)

        if invoice.total_tax > Decimal('0'):
            if not settings.default_tax_payable_account:
                raise ValidationError("Falta configuración de cuenta IVA Débito Fiscal.")
            items.append({
                'account': settings.default_tax_payable_account,
                'debit': Decimal('0.00'),
                'credit': invoice.total_tax,
                'label': 'IVA Débito Fiscal',
            })

        description = (
            f"{invoice.get_dte_type_display()} {invoice.number or ''} "
            f"- Pedido {order.number}"
        )
        reference = f"{invoice.dte_type[:3]}-{order.number}"
        return description, reference, items


class BoletaStrategy(DTEStrategy):
    """
    DTE 39 — Boleta Electrónica (ventas afectas, consumidor final sin RUT).

    Asiento idéntico a FACTURA (mismo modelo contable para ventas afectas).
    La diferencia con FACTURA está en el folio (auto-generado) y en el flujo
    de capitalización de IVA para compras (no aplica aquí).

    Lógica idéntica al bloque ``not is_tax_exempt`` de
    ``AccountingMapper.get_entries_for_sale_invoice()``
    (accounting/services.py:581-604).
    """

    display_prefix = 'BOL'
    sii_document_code = 39

    def expected_fields(self) -> set[str]:
        return {'sale_order'}

    def validate(self, invoice: "Invoice") -> None:
        from django.core.exceptions import ValidationError
        if not invoice.sale_order_id:
            raise ValidationError("BOLETA requiere una Nota de Venta asociada.")
        if invoice.total <= Decimal('0'):
            raise ValidationError("El total de la BOLETA debe ser mayor a cero.")

    def make_journal_entry(
        self,
        invoice: "Invoice",
        settings: "AccountingSettings",
    ) -> tuple[str, str, JournalItemList]:
        from django.core.exceptions import ValidationError

        order = invoice.sale_order
        receivable_account = (
            order.customer.account_receivable or settings.default_receivable_account
        )
        if not receivable_account:
            raise ValidationError("Falta configuración de cuenta por cobrar.")

        revenue_gross_grouping = _build_revenue_grouping(invoice)
        tax_divisor = Decimal('1') + (settings.default_tax_rate / Decimal('100.00'))

        items: JournalItemList = [
            {
                'account': receivable_account,
                'debit': invoice.total,
                'credit': Decimal('0.00'),
                'partner': order.customer,
                'partner_name': order.customer.name,
            }
        ]

        net_items = _gross_to_net_items(
            revenue_gross_grouping,
            invoice.total_net,
            tax_divisor,
            label_prefix=f"Boleta {invoice.number or ''}",
        )
        items.extend(net_items)

        if invoice.total_tax > Decimal('0'):
            if not settings.default_tax_payable_account:
                raise ValidationError("Falta configuración de cuenta IVA Débito Fiscal.")
            items.append({
                'account': settings.default_tax_payable_account,
                'debit': Decimal('0.00'),
                'credit': invoice.total_tax,
                'label': 'IVA Débito Fiscal',
            })

        description = (
            f"{invoice.get_dte_type_display()} {invoice.number or ''} "
            f"- Pedido {order.number}"
        )
        reference = f"{invoice.dte_type[:3]}-{order.number}"
        return description, reference, items


class FacturaExentaStrategy(DTEStrategy):
    """
    DTE 34 — Factura Exenta.
    """
    display_prefix = 'FAC-EX'
    sii_document_code = 34

    def expected_fields(self) -> set[str]:
        return {'sale_order'}

    def validate(self, invoice: "Invoice") -> None:
        from django.core.exceptions import ValidationError
        if not invoice.sale_order_id:
            raise ValidationError("FACTURA_EXENTA requiere una Nota de Venta asociada.")
        if invoice.total <= Decimal('0'):
            raise ValidationError("El total de la FACTURA_EXENTA debe ser mayor a cero.")

    def make_journal_entry(self, invoice: "Invoice", settings: "AccountingSettings") -> tuple[str, str, JournalItemList]:
        from django.core.exceptions import ValidationError
        order = invoice.sale_order
        receivable_account = order.customer.account_receivable or settings.default_receivable_account
        if not receivable_account:
            raise ValidationError("Falta configuración de cuenta por cobrar.")

        revenue_gross_grouping = _build_revenue_grouping(invoice)

        items: JournalItemList = [
            {
                'account': receivable_account,
                'debit': invoice.total,
                'credit': Decimal('0.00'),
                'partner': order.customer,
                'partner_name': order.customer.name,
            }
        ]

        for acc, gross_amount in revenue_gross_grouping.items():
            if gross_amount != 0:
                items.append({
                    'account': acc,
                    'debit': Decimal('0.00'),
                    'credit': gross_amount,
                    'label': f"Venta Exenta {invoice.number or ''}"
                })

        description = f"{invoice.get_dte_type_display()} {invoice.number or ''} - Pedido {order.number}"
        reference = f"{invoice.dte_type[:3]}-{order.number}"
        return description, reference, items


class BoletaExentaStrategy(DTEStrategy):
    """
    DTE 41 — Boleta Exenta.
    """
    display_prefix = 'BE'
    sii_document_code = 41

    def expected_fields(self) -> set[str]:
        return {'sale_order'}

    def validate(self, invoice: "Invoice") -> None:
        from django.core.exceptions import ValidationError
        if not invoice.sale_order_id:
            raise ValidationError("BOLETA_EXENTA requiere una Nota de Venta asociada.")
        if invoice.total <= Decimal('0'):
            raise ValidationError("El total de la BOLETA_EXENTA debe ser mayor a cero.")

    def make_journal_entry(self, invoice: "Invoice", settings: "AccountingSettings") -> tuple[str, str, JournalItemList]:
        # El asiento es idéntico a Factura Exenta.
        from django.core.exceptions import ValidationError
        order = invoice.sale_order
        receivable_account = order.customer.account_receivable or settings.default_receivable_account
        if not receivable_account:
            raise ValidationError("Falta configuración de cuenta por cobrar.")

        revenue_gross_grouping = _build_revenue_grouping(invoice)

        items: JournalItemList = [
            {
                'account': receivable_account,
                'debit': invoice.total,
                'credit': Decimal('0.00'),
                'partner': order.customer,
                'partner_name': order.customer.name,
            }
        ]

        for acc, gross_amount in revenue_gross_grouping.items():
            if gross_amount != 0:
                items.append({
                    'account': acc,
                    'debit': Decimal('0.00'),
                    'credit': gross_amount,
                    'label': f"Boleta Exenta {invoice.number or ''}"
                })

        description = f"{invoice.get_dte_type_display()} {invoice.number or ''} - Pedido {order.number}"
        reference = f"{invoice.dte_type[:3]}-{order.number}"
        return description, reference, items


class ComprobantePagoStrategy(DTEStrategy):
    """
    DTE 48 — Comprobante de Pago Electrónico (Voucher TUU/Transbank válido como boleta).
    """
    display_prefix = 'CPE'
    sii_document_code = 48

    def expected_fields(self) -> set[str]:
        return {'sale_order'}

    def validate(self, invoice: "Invoice") -> None:
        from django.core.exceptions import ValidationError
        if not invoice.sale_order_id:
            raise ValidationError("COMPROBANTE_PAGO requiere una Nota de Venta asociada.")

    def make_journal_entry(self, invoice: "Invoice", settings: "AccountingSettings") -> tuple[str, str, JournalItemList]:
        # Para ventas afectas pagadas con DTE 48, el asiento de la venta es el mismo que una Boleta
        # (se asume gravado). En sistemas complejos podría ser exento, pero por ahora se modela 
        # como Boleta estándar.
        from django.core.exceptions import ValidationError
        order = invoice.sale_order
        receivable_account = order.customer.account_receivable or settings.default_receivable_account
        if not receivable_account:
            raise ValidationError("Falta configuración de cuenta por cobrar.")

        revenue_gross_grouping = _build_revenue_grouping(invoice)
        tax_divisor = Decimal('1') + (settings.default_tax_rate / Decimal('100.00'))

        items: JournalItemList = [
            {
                'account': receivable_account,
                'debit': invoice.total,
                'credit': Decimal('0.00'),
                'partner': order.customer,
                'partner_name': order.customer.name,
            }
        ]

        net_items = _gross_to_net_items(
            revenue_gross_grouping,
            invoice.total_net,
            tax_divisor,
            label_prefix=f"Comprobante Pago {invoice.number or ''}",
        )
        items.extend(net_items)

        if invoice.total_tax > Decimal('0'):
            if not settings.default_tax_payable_account:
                raise ValidationError("Falta configuración de cuenta IVA Débito Fiscal.")
            items.append({
                'account': settings.default_tax_payable_account,
                'debit': Decimal('0.00'),
                'credit': invoice.total_tax,
                'label': 'IVA Débito Fiscal',
            })

        description = f"{invoice.get_dte_type_display()} {invoice.number or ''} - Pedido {order.number}"
        reference = f"{invoice.dte_type[:3]}-{order.number}"
        return description, reference, items


class PurchaseInvStrategy(DTEStrategy):
    """
    Factura de Compra (PURCHASE_INV). Mapea a DTE 33 (Factura de Compra de proveedores).
    """
    display_prefix = 'FAC'
    sii_document_code = 33

    def expected_fields(self) -> set[str]:
        return {'purchase_order'}

    def validate(self, invoice: "Invoice") -> None:
        from django.core.exceptions import ValidationError
        if not invoice.purchase_order_id:
            raise ValidationError("PURCHASE_INV requiere una Orden de Compra asociada.")

    def make_journal_entry(self, invoice: "Invoice", settings: "AccountingSettings") -> tuple[str, str, JournalItemList]:
        from django.core.exceptions import ValidationError
        order = invoice.purchase_order
        payable_account = order.supplier.account_payable or settings.default_payable_account
        stock_input_account = settings.stock_input_account or settings.default_inventory_account
        tax_account = settings.default_tax_receivable_account

        if not payable_account or not stock_input_account:
            raise ValidationError("Falta configuración de cuentas para Factura de Compra.")

        items: JournalItemList = [
            {
                'account': payable_account,
                'debit': Decimal('0.00'),
                'credit': invoice.total,
                'partner': order.supplier,
                'partner_name': order.supplier.name,
            },
            {
                'account': stock_input_account,
                'debit': invoice.total_net,
                'credit': Decimal('0.00'),
                'label': "Limpieza Cuenta Puente Recepción"
            }
        ]

        # PURCHASE_INV is always taxable unless extended
        if invoice.total_tax > Decimal('0') and tax_account:
            items.append({
                'account': tax_account,
                'debit': invoice.total_tax,
                'credit': Decimal('0.00'),
                'label': "IVA Compras (Crédito Fiscal)"
            })

        description = f"{invoice.get_dte_type_display()} Compra {invoice.number or '(Pendiente)'} - OC {order.number}"
        reference = f"FCP-{invoice.id}"
        return description, reference, items


def _note_journal_entry(invoice: "Invoice", settings: "AccountingSettings", is_credit: bool) -> tuple[str, str, JournalItemList]:
    """Helper para Nota de Crédito y Nota de Débito."""
    from django.core.exceptions import ValidationError
    from inventory.models import Product

    workflow = getattr(invoice, 'note_workflow', None)
    if not workflow:
        raise ValidationError("La nota requiere un NoteWorkflow asociado para generar contabilidad.")
        
    is_sale = workflow.sale_order is not None
    contact = workflow.corrected_invoice.contact

    if is_sale:
        partner_account = (contact.account_receivable if contact else None) or settings.default_receivable_account
    else:
        partner_account = (contact.account_payable if contact else None) or settings.default_payable_account

    if not partner_account:
        partner_type = "por cobrar" if is_sale else "por pagar"
        raise ValidationError(f"No se encontró cuenta {partner_type} por defecto.")

    total_amount = invoice.total
    
    if is_credit:
        # Credit Note: Reduces debt
        debit_amount = Decimal('0') if is_sale else total_amount
        credit_amount = total_amount if is_sale else Decimal('0')
    else:
        # Debit Note: Increases debt
        debit_amount = total_amount if is_sale else Decimal('0')
        credit_amount = Decimal('0') if is_sale else total_amount

    items: JournalItemList = [
        {
            'account': partner_account,
            'debit': debit_amount,
            'credit': credit_amount,
            'partner': contact,
            'partner_name': contact.name if contact else "",
            'label': f"{invoice.display_id}"
        }
    ]

    for item in workflow.selected_items:
        product = Product.objects.get(id=item['product_id'])
        line_net = Decimal(str(item['line_net']))
        
        from billing.models import Invoice
        is_purchase_boleta = not is_sale and workflow.corrected_invoice.dte_type == Invoice.DTEType.BOLETA
        line_amount = line_net
        if is_purchase_boleta:
            line_tax = Decimal(str(item.get('line_tax', 0)))
            line_amount += line_tax

        if product.product_type == 'SERVICE':
            product_account = product.income_account or settings.default_service_revenue_account or settings.default_revenue_account
        elif product.product_type == 'CONSUMABLE':
            product_account = product.expense_account or settings.default_consumable_account or settings.default_expense_account
        elif product.track_inventory:
            if is_sale:
                product_account = product.income_account or settings.default_revenue_account
            else:
                product_account = settings.stock_input_account or settings.default_expense_account
        else:
            product_account = settings.default_expense_account

        if not product_account:
            account_req = "Ingresos" if is_sale else "Gastos"
            raise ValidationError(f"No se encontró cuenta de {account_req} para '{product.name}'.")

        if is_credit:
            item_debit = line_amount if is_sale else Decimal('0')
            item_credit = Decimal('0') if is_sale else line_amount
        else:
            item_debit = Decimal('0') if is_sale else line_amount
            item_credit = line_amount if is_sale else Decimal('0')

        label_text = f"{product.name} - {item['reason']}" if item.get('reason') else product.name

        items.append({
            'account': product_account,
            'debit': item_debit,
            'credit': item_credit,
            'label': label_text
        })

    from billing.models import Invoice
    is_purchase_boleta = not is_sale and workflow.corrected_invoice.dte_type == Invoice.DTEType.BOLETA
    if invoice.total_tax > Decimal('0') and not is_purchase_boleta:
        tax_account = settings.default_tax_payable_account if is_sale else settings.default_tax_receivable_account
        if not tax_account:
            tax_type = "IVA Débito" if is_sale else "IVA Crédito"
            raise ValidationError(f"No se encontró cuenta de {tax_type} por defecto.")

        if is_credit:
            tax_debit = invoice.total_tax if is_sale else Decimal('0')
            tax_credit = Decimal('0') if is_sale else invoice.total_tax
        else:
            tax_debit = Decimal('0') if is_sale else invoice.total_tax
            tax_credit = invoice.total_tax if is_sale else Decimal('0')

        items.append({
            'account': tax_account,
            'debit': tax_debit,
            'credit': tax_credit,
            'label': "Impuesto (IVA)"
        })

    description = f"{invoice.get_dte_type_display()} {invoice.number}"
    reference = f"WORKFLOW-{workflow.id}"
    return description, reference, items


class NotaCreditoStrategy(DTEStrategy):
    """
    DTE 61 — Nota de Crédito.
    """
    display_prefix = 'NC'
    sii_document_code = 61

    def expected_fields(self) -> set[str]:
        return {'corrected_invoice'}

    def validate(self, invoice: "Invoice") -> None:
        from django.core.exceptions import ValidationError
        if not invoice.corrected_invoice_id:
            raise ValidationError("NOTA_CREDITO requiere una factura rectificada (corrected_invoice).")
        if not hasattr(invoice, 'note_workflow'):
            raise ValidationError("NOTA_CREDITO requiere un NoteWorkflow asociado.")

    def make_journal_entry(self, invoice: "Invoice", settings: "AccountingSettings") -> tuple[str, str, JournalItemList]:
        return _note_journal_entry(invoice, settings, is_credit=True)


class NotaDebitoStrategy(DTEStrategy):
    """
    DTE 56 — Nota de Débito.
    """
    display_prefix = 'ND'
    sii_document_code = 56

    def expected_fields(self) -> set[str]:
        return {'corrected_invoice'}

    def validate(self, invoice: "Invoice") -> None:
        from django.core.exceptions import ValidationError
        if not invoice.corrected_invoice_id:
            raise ValidationError("NOTA_DEBITO requiere una factura rectificada (corrected_invoice).")
        if not hasattr(invoice, 'note_workflow'):
            raise ValidationError("NOTA_DEBITO requiere un NoteWorkflow asociado.")

    def make_journal_entry(self, invoice: "Invoice", settings: "AccountingSettings") -> tuple[str, str, JournalItemList]:
        return _note_journal_entry(invoice, settings, is_credit=False)



# ---------------------------------------------------------------------------
# Registro de strategies por DTEType
# ---------------------------------------------------------------------------

#: Mapa de dte_type → DTEStrategy class.
#: T-19 completará los tipos faltantes.
DTE_STRATEGY_REGISTRY: dict[str, type[DTEStrategy]] = {
    'FACTURA': FacturaStrategy,
    'BOLETA': BoletaStrategy,
    'FACTURA_EXENTA': FacturaExentaStrategy,
    'BOLETA_EXENTA': BoletaExentaStrategy,
    'COMPROBANTE_PAGO': ComprobantePagoStrategy,
    'PURCHASE_INV': PurchaseInvStrategy,
    'NOTA_CREDITO': NotaCreditoStrategy,
    'NOTA_DEBITO': NotaDebitoStrategy,
}


def get_dte_strategy(dte_type: str) -> DTEStrategy:
    """
    Devuelve una instancia de la strategy para el ``dte_type`` dado.

    Raises:
        KeyError: si el tipo no está registrado aún.
    """
    strategy_cls = DTE_STRATEGY_REGISTRY[dte_type]
    return strategy_cls()
