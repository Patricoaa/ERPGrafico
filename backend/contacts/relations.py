"""Tipos documentales de contactos (ADR-0080, M5)."""

from core.documents import DocumentType, DocumentTypeRegistry, Link, relation_provider
from core.documents.details import join


def _partners():
    from contacts.models import Contact

    return Contact.objects.filter(is_partner=True)


DocumentTypeRegistry.register(DocumentType(label="contacts.partnertransaction", canonical_url="/contacts", status_field=None))
# Contraparte de los documentos (área "contacts" de la ficha documental, ADR-0083).
DocumentTypeRegistry.register(DocumentType(
    label="contacts.contact", status_field=None, amount_field=None, date_field="created_at",
    detail=lambda c: join(c.name, c.tax_id, c.email or c.phone),
))
# Ficha del socio (ADR-0133): etiqueta de vista sobre Contact restringida a socios. Un contacto
# no socio no existe con esta etiqueta (404). Se lee con el permiso de contactos.
DocumentTypeRegistry.register(DocumentType(
    label="contacts.partner", canonical_url="/finances/partners?selected={id}",
    status_field=None, amount_field=None, date_field="partner_since",
    queryset=_partners, permission="contacts.view_contact",
    detail=lambda c: join(c.name, c.tax_id),
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
