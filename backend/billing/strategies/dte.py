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

from core.prefix_registry import EntityPrefix
from decimal import Decimal
from typing import TYPE_CHECKING

from accounting.glosa_builder import GlosaBuilder, Roles

if TYPE_CHECKING:
    # Solo para type checkers — evitar import circular en runtime.
    from accounting.models import AccountingSettings
    from billing.models import Invoice


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
    doc_ref: str = None,
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
                Decimal("1"), rounding="ROUND_HALF_UP"
            )

        if net_amount != 0:
            items.append(
                {
                    "account": acc,
                    "debit": Decimal("0.00"),
                    "credit": net_amount,
                    "label": GlosaBuilder.item(Roles.INGRESO, doc_ref=doc_ref),
                }
            )
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
            revenue_gross_grouping.get(rev_acc, Decimal("0.00")) + line.subtotal
        )
    return revenue_gross_grouping


# ---------------------------------------------------------------------------
# Estrategias concretas (pilotos T-18)
# ---------------------------------------------------------------------------


class FacturaStrategy(DTEStrategy):
    """
    DTE 33 — Factura Electrónica.

    Maneja tanto ventas (con sale_order) como compras (con purchase_order).
    La dirección se determina automáticamente según el pedido asociado.

    Asiento (venta):
        Dr  Clientes (CxC)            = invoice.total
        Cr  Ingresos (distribuido)    = invoice.total_net
        Cr  IVA Débito Fiscal         = invoice.total_tax

    Asiento (compra):
        Dr  Existencias               = invoice.total_net
        Dr  IVA Crédito Fiscal        = invoice.total_tax
        Cr  Proveedores (CxP)         = invoice.total
    """

    display_prefix = EntityPrefix.INVOICE_FACTURA
    sii_document_code = 33

    def expected_fields(self) -> set[str]:
        return {"sale_order", "purchase_order"}

    def validate(self, invoice: "Invoice") -> None:
        from django.core.exceptions import ValidationError

        if not invoice.sale_order_id and not invoice.purchase_order_id:
            raise ValidationError("FACTURA requiere una Nota de Venta o una Orden de Compra asociada.")
        if invoice.total <= Decimal("0"):
            raise ValidationError("El total de la FACTURA debe ser mayor a cero.")

    def make_journal_entry(
        self,
        invoice: "Invoice",
        settings: "AccountingSettings",
    ) -> tuple[str, str, JournalItemList]:
        if invoice.purchase_order_id:
            return self._make_purchase_entry(invoice, settings)
        return self._make_sale_entry(invoice, settings)

    def _make_sale_entry(
        self,
        invoice: "Invoice",
        settings: "AccountingSettings",
    ) -> tuple[str, str, JournalItemList]:
        from django.core.exceptions import ValidationError

        order = invoice.sale_order
        receivable_account = settings.default_receivable_account
        if not receivable_account:
            raise ValidationError("Falta configuración de cuenta por cobrar.")

        revenue_gross_grouping = _build_revenue_grouping(invoice)
        tax_divisor = Decimal("1") + (settings.default_vat_rate / Decimal("100.00"))
        doc_id = invoice.display_id
        customer_name = order.customer.name

        items: JournalItemList = [
            {
                "account": receivable_account,
                "debit": invoice.total,
                "credit": Decimal("0.00"),
                "partner": order.customer,
                "partner_name": customer_name,
                "label": GlosaBuilder.item(Roles.CXC, customer_name, doc_id),
            }
        ]

        net_items = _gross_to_net_items(
            revenue_gross_grouping,
            invoice.total_net,
            tax_divisor,
            doc_ref=doc_id,
        )
        items.extend(net_items)

        if invoice.total_tax > Decimal("0"):
            if not settings.default_tax_payable_account:
                raise ValidationError("Falta configuración de cuenta IVA Débito Fiscal.")
            items.append(
                {
                    "account": settings.default_tax_payable_account,
                    "debit": Decimal("0.00"),
                    "credit": invoice.total_tax,
                    "label": GlosaBuilder.item(Roles.IVA_DEBITO, doc_ref=doc_id),
                }
            )

        description = GlosaBuilder.build(
            GlosaBuilder.VENTA, doc_id, customer_name, invoice.total,
            extra=[f"Pedido {order.display_id}"],
        )
        reference = f"{invoice.dte_type[:3]}-{order.number}"
        return description, reference, items

    def _make_purchase_entry(
        self,
        invoice: "Invoice",
        settings: "AccountingSettings",
    ) -> tuple[str, str, JournalItemList]:
        from django.core.exceptions import ValidationError

        order = invoice.purchase_order
        payable_account = settings.default_payable_account
        stock_input_account = settings.stock_input_account
        tax_account = settings.default_tax_receivable_account

        if not payable_account or not stock_input_account:
            raise ValidationError("Falta configuración de cuentas para Factura de Compra.")

        doc_id = invoice.display_id
        supplier_name = order.supplier.name

        items: JournalItemList = [
            {
                "account": payable_account,
                "debit": Decimal("0.00"),
                "credit": invoice.total,
                "partner": order.supplier,
                "partner_name": supplier_name,
                "label": GlosaBuilder.item(Roles.CXP, supplier_name, doc_id),
            },
            {
                "account": stock_input_account,
                "debit": invoice.total_net,
                "credit": Decimal("0.00"),
                "label": GlosaBuilder.item(Roles.PUENTE_RECEPCION, doc_ref=doc_id),
            },
        ]

        if invoice.total_tax > Decimal("0") and tax_account:
            items.append(
                {
                    "account": tax_account,
                    "debit": invoice.total_tax,
                    "credit": Decimal("0.00"),
                    "label": GlosaBuilder.item(Roles.IVA_CREDITO, doc_ref=doc_id),
                }
            )

        description = GlosaBuilder.build(
            GlosaBuilder.COMPRA, doc_id, supplier_name, invoice.total,
            extra=[f"OC {order.display_id}"],
        )
        reference = f"{EntityPrefix.INVOICE_COMPRA}-{invoice.id}"
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

    display_prefix = EntityPrefix.INVOICE_BOLETA
    sii_document_code = 39

    def expected_fields(self) -> set[str]:
        return {"sale_order"}

    def validate(self, invoice: "Invoice") -> None:
        from django.core.exceptions import ValidationError

        if not invoice.sale_order_id:
            raise ValidationError("BOLETA requiere una Nota de Venta asociada.")
        if invoice.total <= Decimal("0"):
            raise ValidationError("El total de la BOLETA debe ser mayor a cero.")

    def make_journal_entry(
        self,
        invoice: "Invoice",
        settings: "AccountingSettings",
    ) -> tuple[str, str, JournalItemList]:
        from django.core.exceptions import ValidationError

        order = invoice.sale_order
        receivable_account = settings.default_receivable_account
        if not receivable_account:
            raise ValidationError("Falta configuración de cuenta por cobrar.")

        revenue_gross_grouping = _build_revenue_grouping(invoice)
        tax_divisor = Decimal("1") + (settings.default_vat_rate / Decimal("100.00"))
        doc_id = invoice.display_id
        customer_name = order.customer.name

        items: JournalItemList = [
            {
                "account": receivable_account,
                "debit": invoice.total,
                "credit": Decimal("0.00"),
                "partner": order.customer,
                "partner_name": customer_name,
                "label": GlosaBuilder.item(Roles.CXC, customer_name, doc_id),
            }
        ]

        net_items = _gross_to_net_items(
            revenue_gross_grouping,
            invoice.total_net,
            tax_divisor,
            doc_ref=doc_id,
        )
        items.extend(net_items)

        if invoice.total_tax > Decimal("0"):
            if not settings.default_tax_payable_account:
                raise ValidationError("Falta configuración de cuenta IVA Débito Fiscal.")
            items.append(
                {
                    "account": settings.default_tax_payable_account,
                    "debit": Decimal("0.00"),
                    "credit": invoice.total_tax,
                    "label": GlosaBuilder.item(Roles.IVA_DEBITO, doc_ref=doc_id),
                }
            )

        description = GlosaBuilder.build(
            GlosaBuilder.VENTA, doc_id, customer_name, invoice.total,
            extra=[f"Pedido {order.display_id}"],
        )
        reference = f"{invoice.dte_type[:3]}-{order.number}"
        return description, reference, items


class FacturaExentaStrategy(DTEStrategy):
    """
    DTE 34 — Factura Exenta.
    """

    display_prefix = EntityPrefix.INVOICE_EXENTA
    sii_document_code = 34

    def expected_fields(self) -> set[str]:
        return {"sale_order"}

    def validate(self, invoice: "Invoice") -> None:
        from django.core.exceptions import ValidationError

        if not invoice.sale_order_id:
            raise ValidationError("FACTURA_EXENTA requiere una Nota de Venta asociada.")
        if invoice.total <= Decimal("0"):
            raise ValidationError("El total de la FACTURA_EXENTA debe ser mayor a cero.")

    def make_journal_entry(
        self, invoice: "Invoice", settings: "AccountingSettings"
    ) -> tuple[str, str, JournalItemList]:
        from django.core.exceptions import ValidationError

        order = invoice.sale_order
        receivable_account = settings.default_receivable_account
        if not receivable_account:
            raise ValidationError("Falta configuración de cuenta por cobrar.")

        revenue_gross_grouping = _build_revenue_grouping(invoice)
        doc_id = invoice.display_id
        customer_name = order.customer.name

        items: JournalItemList = [
            {
                "account": receivable_account,
                "debit": invoice.total,
                "credit": Decimal("0.00"),
                "partner": order.customer,
                "partner_name": customer_name,
                "label": GlosaBuilder.item(Roles.CXC, customer_name, doc_id),
            }
        ]

        for acc, gross_amount in revenue_gross_grouping.items():
            if gross_amount != 0:
                items.append(
                    {
                        "account": acc,
                        "debit": Decimal("0.00"),
                        "credit": gross_amount,
                        "label": GlosaBuilder.item(Roles.INGRESO, f"Exenta {invoice.number or ''}", doc_id),
                    }
                )

        description = GlosaBuilder.build(
            GlosaBuilder.VENTA, doc_id, customer_name, invoice.total,
            extra=[f"Pedido {order.display_id}"],
        )
        reference = f"{invoice.dte_type[:3]}-{order.number}"
        return description, reference, items


class BoletaExentaStrategy(DTEStrategy):
    """
    DTE 41 — Boleta Exenta.
    """

    display_prefix = EntityPrefix.INVOICE_BOLETA_EXENTA
    sii_document_code = 41

    def expected_fields(self) -> set[str]:
        return {"sale_order"}

    def validate(self, invoice: "Invoice") -> None:
        from django.core.exceptions import ValidationError

        if not invoice.sale_order_id:
            raise ValidationError("BOLETA_EXENTA requiere una Nota de Venta asociada.")
        if invoice.total <= Decimal("0"):
            raise ValidationError("El total de la BOLETA_EXENTA debe ser mayor a cero.")

    def make_journal_entry(
        self, invoice: "Invoice", settings: "AccountingSettings"
    ) -> tuple[str, str, JournalItemList]:
        # El asiento es idéntico a Factura Exenta.
        from django.core.exceptions import ValidationError

        order = invoice.sale_order
        receivable_account = settings.default_receivable_account
        if not receivable_account:
            raise ValidationError("Falta configuración de cuenta por cobrar.")

        revenue_gross_grouping = _build_revenue_grouping(invoice)
        doc_id = invoice.display_id
        customer_name = order.customer.name

        items: JournalItemList = [
            {
                "account": receivable_account,
                "debit": invoice.total,
                "credit": Decimal("0.00"),
                "partner": order.customer,
                "partner_name": customer_name,
                "label": GlosaBuilder.item(Roles.CXC, customer_name, doc_id),
            }
        ]

        for acc, gross_amount in revenue_gross_grouping.items():
            if gross_amount != 0:
                items.append(
                    {
                        "account": acc,
                        "debit": Decimal("0.00"),
                        "credit": gross_amount,
                        "label": GlosaBuilder.item(Roles.INGRESO, f"Exenta {invoice.number or ''}", doc_id),
                    }
                )

        description = GlosaBuilder.build(
            GlosaBuilder.VENTA, doc_id, customer_name, invoice.total,
            extra=[f"Pedido {order.display_id}"],
        )
        reference = f"{invoice.dte_type[:3]}-{order.number}"
        return description, reference, items


class ComprobantePagoStrategy(DTEStrategy):
    """
    DTE 48 — Comprobante de Pago Electrónico (Voucher TUU/Transbank válido como boleta).
    """

    display_prefix = EntityPrefix.COMPROBANTE_PAGO
    sii_document_code = 48

    def expected_fields(self) -> set[str]:
        return {"sale_order"}

    def validate(self, invoice: "Invoice") -> None:
        from django.core.exceptions import ValidationError

        if not invoice.sale_order_id:
            raise ValidationError("COMPROBANTE_PAGO requiere una Nota de Venta asociada.")

    def make_journal_entry(
        self, invoice: "Invoice", settings: "AccountingSettings"
    ) -> tuple[str, str, JournalItemList]:
        from django.core.exceptions import ValidationError

        order = invoice.sale_order
        receivable_account = settings.default_receivable_account
        if not receivable_account:
            raise ValidationError("Falta configuración de cuenta por cobrar.")

        revenue_gross_grouping = _build_revenue_grouping(invoice)
        tax_divisor = Decimal("1") + (settings.default_vat_rate / Decimal("100.00"))
        doc_id = invoice.display_id
        customer_name = order.customer.name

        items: JournalItemList = [
            {
                "account": receivable_account,
                "debit": invoice.total,
                "credit": Decimal("0.00"),
                "partner": order.customer,
                "partner_name": customer_name,
                "label": GlosaBuilder.item(Roles.CXC, customer_name, doc_id),
            }
        ]

        net_items = _gross_to_net_items(
            revenue_gross_grouping,
            invoice.total_net,
            tax_divisor,
            doc_ref=doc_id,
        )
        items.extend(net_items)

        if invoice.total_tax > Decimal("0"):
            if not settings.default_tax_payable_account:
                raise ValidationError("Falta configuración de cuenta IVA Débito Fiscal.")
            items.append(
                {
                    "account": settings.default_tax_payable_account,
                    "debit": Decimal("0.00"),
                    "credit": invoice.total_tax,
                    "label": GlosaBuilder.item(Roles.IVA_DEBITO, doc_ref=doc_id),
                }
            )

        description = GlosaBuilder.build(
            GlosaBuilder.VENTA, doc_id, customer_name, invoice.total,
            extra=[f"Pedido {order.display_id}"],
        )
        reference = f"{invoice.dte_type[:3]}-{order.number}"
        return description, reference, items


class PurchaseInvStrategy(DTEStrategy):
    """
    Factura de Compra (PURCHASE_INV). Mapea a DTE 33 (Factura de Compra de proveedores).
    """

    display_prefix = EntityPrefix.INVOICE_COMPRA
    sii_document_code = 33

    def expected_fields(self) -> set[str]:
        return {"purchase_order"}

    def validate(self, invoice: "Invoice") -> None:
        from django.core.exceptions import ValidationError

        if not invoice.purchase_order_id:
            raise ValidationError("PURCHASE_INV requiere una Orden de Compra asociada.")

    def make_journal_entry(
        self, invoice: "Invoice", settings: "AccountingSettings"
    ) -> tuple[str, str, JournalItemList]:
        from django.core.exceptions import ValidationError

        order = invoice.purchase_order
        payable_account = settings.default_payable_account
        stock_input_account = settings.stock_input_account
        tax_account = settings.default_tax_receivable_account

        if not payable_account or not stock_input_account:
            raise ValidationError("Falta configuración de cuentas para Factura de Compra.")

        doc_id = invoice.display_id
        supplier_name = order.supplier.name

        items: JournalItemList = [
            {
                "account": payable_account,
                "debit": Decimal("0.00"),
                "credit": invoice.total,
                "partner": order.supplier,
                "partner_name": supplier_name,
                "label": GlosaBuilder.item(Roles.CXP, supplier_name, doc_id),
            },
            {
                "account": stock_input_account,
                "debit": invoice.total_net,
                "credit": Decimal("0.00"),
                "label": GlosaBuilder.item(Roles.PUENTE_RECEPCION, doc_ref=doc_id),
            },
        ]

        # PURCHASE_INV is always taxable unless extended
        if invoice.total_tax > Decimal("0") and tax_account:
            items.append(
                {
                    "account": tax_account,
                    "debit": invoice.total_tax,
                    "credit": Decimal("0.00"),
                    "label": GlosaBuilder.item(Roles.IVA_CREDITO, doc_ref=doc_id),
                }
            )

        description = GlosaBuilder.build(
            GlosaBuilder.COMPRA, doc_id, supplier_name, invoice.total,
            extra=[f"OC {order.display_id}"],
        )
        reference = f"{EntityPrefix.INVOICE_COMPRA}-{invoice.id}"
        return description, reference, items


def _note_journal_entry(
    invoice: "Invoice", settings: "AccountingSettings", is_credit: bool
) -> tuple[str, str, JournalItemList]:
    """Helper para Nota de Crédito y Nota de Débito."""
    from django.core.exceptions import ValidationError

    from inventory.models import Product

    workflow = getattr(invoice, "note_workflow", None)
    if not workflow:
        raise ValidationError(
            "La nota requiere un NoteWorkflow asociado para generar contabilidad."
        )

    is_sale = workflow.sale_order is not None
    contact = workflow.corrected_invoice.contact

    if is_sale:
        partner_account = settings.default_receivable_account
    else:
        partner_account = settings.default_payable_account

    if not partner_account:
        partner_type = "por cobrar" if is_sale else "por pagar"
        raise ValidationError(f"No se encontró cuenta {partner_type} por defecto.")

    total_amount = invoice.total
    doc_id = invoice.display_id
    contact_name = contact.name if contact else ""

    if is_credit:
        debit_amount = Decimal("0") if is_sale else total_amount
        credit_amount = total_amount if is_sale else Decimal("0")
    else:
        debit_amount = total_amount if is_sale else Decimal("0")
        credit_amount = Decimal("0") if is_sale else total_amount

    partner_role = Roles.CXC if is_sale else Roles.CXP

    items: JournalItemList = [
        {
            "account": partner_account,
            "debit": debit_amount,
            "credit": credit_amount,
            "partner": contact,
            "partner_name": contact_name,
            "label": GlosaBuilder.item(partner_role, contact_name, doc_id),
        }
    ]

    for item in workflow.selected_items:
        product = Product.objects.get(id=item["product_id"])
        line_net = Decimal(str(item["line_net"]))

        from billing.models import Invoice

        is_purchase_boleta = (
            not is_sale and workflow.corrected_invoice.dte_type == Invoice.DTEType.BOLETA
        )
        line_amount = line_net
        if is_purchase_boleta:
            line_tax = Decimal(str(item.get("line_tax", 0)))
            line_amount += line_tax

        if product.product_type == "SERVICE":
            product_account = product.get_income_account or settings.default_revenue_account
        elif product.product_type == "CONSUMABLE":
            product_account = product.get_expense_account or settings.default_expense_account
        elif product.track_inventory:
            if is_sale:
                product_account = product.get_income_account or settings.default_revenue_account
            else:
                product_account = settings.stock_input_account or settings.default_expense_account
        else:
            product_account = settings.default_expense_account

        if not product_account:
            account_req = "Ingresos" if is_sale else "Gastos"
            raise ValidationError(f"No se encontró cuenta de {account_req} para '{product.name}'.")

        if is_credit:
            item_debit = line_amount if is_sale else Decimal("0")
            item_credit = Decimal("0") if is_sale else line_amount
        else:
            item_debit = Decimal("0") if is_sale else line_amount
            item_credit = line_amount if is_sale else Decimal("0")

        label_text = f"{product.name} - {item['reason']}" if item.get("reason") else product.name

        items.append(
            {
                "account": product_account,
                "debit": item_debit,
                "credit": item_credit,
                "label": GlosaBuilder.item(
                    Roles.INGRESO if is_sale else Roles.GASTO,
                    detail=label_text,
                    doc_ref=doc_id,
                ),
            }
        )

    from billing.models import Invoice

    is_purchase_boleta = (
        not is_sale and workflow.corrected_invoice.dte_type == Invoice.DTEType.BOLETA
    )
    if invoice.total_tax > Decimal("0") and not is_purchase_boleta:
        tax_account = (
            settings.default_tax_payable_account
            if is_sale
            else settings.default_tax_receivable_account
        )
        if not tax_account:
            tax_type = "IVA Débito" if is_sale else "IVA Crédito"
            raise ValidationError(f"No se encontró cuenta de {tax_type} por defecto.")

        if is_credit:
            tax_debit = invoice.total_tax if is_sale else Decimal("0")
            tax_credit = Decimal("0") if is_sale else invoice.total_tax
        else:
            tax_debit = Decimal("0") if is_sale else invoice.total_tax
            tax_credit = invoice.total_tax if is_sale else Decimal("0")

        items.append(
            {
                "account": tax_account,
                "debit": tax_debit,
                "credit": tax_credit,
                "label": GlosaBuilder.item(
                    Roles.IVA_DEBITO if is_sale else Roles.IVA_CREDITO,
                    doc_ref=doc_id,
                ),
            }
        )

    action = GlosaBuilder.NOTA_CREDITO if is_credit else GlosaBuilder.NOTA_DEBITO
    description = GlosaBuilder.build(action, doc_id, contact_name, total_amount)
    reference = f"WORKFLOW-{workflow.id}"
    return description, reference, items


class NotaCreditoStrategy(DTEStrategy):
    """
    DTE 61 — Nota de Crédito.
    """

    display_prefix = EntityPrefix.NOTA_CREDITO
    sii_document_code = 61

    def expected_fields(self) -> set[str]:
        return {"corrected_invoice"}

    def validate(self, invoice: "Invoice") -> None:
        from django.core.exceptions import ValidationError

        if not invoice.corrected_invoice_id:
            raise ValidationError(
                "NOTA_CREDITO requiere una factura rectificada (corrected_invoice)."
            )
        if not hasattr(invoice, "note_workflow"):
            raise ValidationError("NOTA_CREDITO requiere un NoteWorkflow asociado.")

    def make_journal_entry(
        self, invoice: "Invoice", settings: "AccountingSettings"
    ) -> tuple[str, str, JournalItemList]:
        return _note_journal_entry(invoice, settings, is_credit=True)


class NotaDebitoStrategy(DTEStrategy):
    """
    DTE 56 — Nota de Débito.
    """

    display_prefix = EntityPrefix.NOTA_DEBITO
    sii_document_code = 56

    def expected_fields(self) -> set[str]:
        return {"corrected_invoice"}

    def validate(self, invoice: "Invoice") -> None:
        from django.core.exceptions import ValidationError

        if not invoice.corrected_invoice_id:
            raise ValidationError(
                "NOTA_DEBITO requiere una factura rectificada (corrected_invoice)."
            )
        if not hasattr(invoice, "note_workflow"):
            raise ValidationError("NOTA_DEBITO requiere un NoteWorkflow asociado.")

    def make_journal_entry(
        self, invoice: "Invoice", settings: "AccountingSettings"
    ) -> tuple[str, str, JournalItemList]:
        return _note_journal_entry(invoice, settings, is_credit=False)


# ---------------------------------------------------------------------------
# Registro de strategies por DTEType
# ---------------------------------------------------------------------------

#: Mapa de dte_type → DTEStrategy class.
#: T-19 completará los tipos faltantes.
DTE_STRATEGY_REGISTRY: dict[str, type[DTEStrategy]] = {
    "FACTURA": FacturaStrategy,
    "BOLETA": BoletaStrategy,
    "FACTURA_EXENTA": FacturaExentaStrategy,
    "BOLETA_EXENTA": BoletaExentaStrategy,
    "COMPROBANTE_PAGO": ComprobantePagoStrategy,
    "PURCHASE_INV": PurchaseInvStrategy,
    "NOTA_CREDITO": NotaCreditoStrategy,
    "NOTA_DEBITO": NotaDebitoStrategy,
}


def get_dte_strategy(dte_type: str) -> DTEStrategy:
    """
    Devuelve una instancia de la strategy para el ``dte_type`` dado.

    Raises:
        KeyError: si el tipo no está registrado aún.
    """
    strategy_cls = DTE_STRATEGY_REGISTRY[dte_type]
    return strategy_cls()
