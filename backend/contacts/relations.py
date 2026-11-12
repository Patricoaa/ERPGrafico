"""Tipos documentales de contactos (ADR-0080, M5)."""

from core.documents import DocumentType, DocumentTypeRegistry, Link, relation_provider
from core.documents.details import join


def _partners():
    from contacts.models import Contact

    return Contact.objects.filter(is_partner=True)


DocumentTypeRegistry.register(DocumentType(
    label="contacts.partnertransaction",
    canonical_url=lambda tx: f"/finances/partners/composition?selected={tx.partner_id}",
    domain="capital",
    status_field=None,
    amount_field="amount",
    date_field="date",
))
# Contraparte de los documentos (área "contacts" de la ficha documental, ADR-0083).
DocumentTypeRegistry.register(DocumentType(
    label="contacts.contact", status_field=None, amount_field=None, date_field="created_at",
    detail=lambda c: join(c.name, c.tax_id, c.email or c.phone),
))
# Ficha del socio (ADR-0133): etiqueta de vista sobre Contact restringida a socios. Un contacto
# no socio no existe con esta etiqueta (404). Se lee con el permiso de contactos.
DocumentTypeRegistry.register(DocumentType(
    label="contacts.partner", canonical_url="/finances/partners/composition?selected={id}",
    status_field=None, amount_field=None, date_field="partner_since",
    domain="capital",
    queryset=_partners, permission="contacts.view_contact",
    detail=lambda c: join(c.name, c.tax_id),
))
# Ficha de distribución de utilidades (ADR-0083): resolución contable del resultado de un ejercicio.
DocumentTypeRegistry.register(DocumentType(
    label="contacts.profitdistributionresolution",
    canonical_url="/finances/partners/distributions?selected={id}",
    status_field="status",
    amount_field="net_result",
    date_field="resolution_date",
    domain="capital",
    permission="contacts.view_profitdistributionresolution",
    detail=lambda r: f"Año {r.fiscal_year} · {r.acta_number or 'Sin Acta'}",
))


_ENTRY_PARTNERS = ("sale_order", "purchase_order")


@relation_provider("contacts.partner")
def partner_relations(partner):
    """Contacto, asientos de sus movimientos de socio (sin duplicar) y distribuciones en que participa."""
    from accounting.models import JournalEntry
    from contacts.partner_models import ProfitDistributionResolution

    yield Link("association", "incoming", "contact", partner, is_dependency=False)
    # sale_order/purchase_order: reversos O2O que el DocumentRef del asiento lee como contraparte.
    entries = JournalEntry.objects.filter(partner_transactions__partner=partner).distinct()
    for entry in entries.select_related(*_ENTRY_PARTNERS).order_by("-date", "-id"):
        yield Link("derivation", "outgoing", "journal_entry", entry, is_dependency=False)
    # journal_entry: el servicio agrega el asiento de cada distribución como relación indirecta.
    distributions = ProfitDistributionResolution.objects.filter(lines__partner=partner).distinct()
    related = ("journal_entry", *(f"journal_entry__{name}" for name in _ENTRY_PARTNERS))
    for resolution in distributions.select_related(*related).order_by("-fiscal_year", "-id"):
        yield Link("association", "outgoing", "profit_distribution", resolution, is_dependency=False)


@relation_provider("contacts.profitdistributionresolution")
def profit_distribution_relations(resolution):
    """Asiento de ejecución, ejercicio fiscal, socios participantes, movimientos de socio y pagos."""
    from contacts.models import Contact

    # 1. Asiento contable de ejecución
    if resolution.journal_entry_id:
        yield Link("posting", "outgoing", "journal_entry", resolution.journal_entry)

    # 2. Ejercicio fiscal de origen
    if resolution.fiscal_year_obj_id:
        yield Link("association", "incoming", "fiscal_year", resolution.fiscal_year_obj)

    # 3. Socios involucrados en la resolución
    partner_ids = list(resolution.lines.values_list("partner_id", flat=True).distinct())
    if partner_ids:
        for partner in Contact.objects.filter(id__in=partner_ids, is_partner=True):
            yield Link("association", "outgoing", "partner", partner)

    # 4. Movimientos de socio originados por la distribución
    for tx in resolution.partner_transactions.select_related("partner").all():
        yield Link("settlement", "outgoing", "partner_transaction", tx, amount=tx.amount)

    # 5. Pagos de dividendos (tesorería)
    for payment in resolution.payments.select_related("treasury_movement").all():
        if payment.treasury_movement_id:
            yield Link("settlement", "outgoing", "payment", payment.treasury_movement, amount=payment.amount)
        else:
            yield Link("settlement", "outgoing", "payment", payment, amount=payment.amount)
