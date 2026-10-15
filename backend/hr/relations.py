"""Proveedores de relaciones documentales de RRHH (ADR-0080, M5)."""

from core.documents import DocumentType, DocumentTypeRegistry, Link, relation_provider

DocumentTypeRegistry.register(DocumentType(label="hr.payroll"))


@relation_provider("hr.payroll")
def payroll_relations(payroll):
    for movement in payroll.treasury_movements.all():
        yield Link("settlement", "incoming", "payment", movement, amount=movement.amount)
    for field in ("journal_entry", "previred_journal_entry"):
        if getattr(payroll, f"{field}_id"):
            yield Link("posting", "outgoing", "journal_entry", getattr(payroll, field))


DocumentTypeRegistry.register(DocumentType(label="hr.payrollconcept", canonical_url="/hr/settings/concepts"))
