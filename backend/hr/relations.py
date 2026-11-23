"""Proveedores de relaciones documentales de RRHH (ADR-0080, M5; dominio `hr`, ADR-0155)."""

from django.db.models import Prefetch

from core.documents import DocumentType, DocumentTypeRegistry, Link, related_or_none, relation_provider
from core.documents.details import join

# Vínculos de asociación (empleado ↔ sus documentos): no son cadenas de dependencia, por lo que
# la ventana reciente puede ocultar los antiguos (`Link.is_dependency` es True por defecto).
_LOOSE = {"is_dependency": False}

DocumentTypeRegistry.register(DocumentType(
    label="hr.employee", status_field=None, amount_field=None, date_field="start_date",
    partner_path="contact", detail=lambda e: join(e.position, e.department),
))
DocumentTypeRegistry.register(DocumentType(label="hr.payroll"))
DocumentTypeRegistry.register(DocumentType(
    label="hr.absence", status_field=None, amount_field=None, date_field="start_date",
    partner_path="employee.contact", detail=lambda a: join(a.get_absence_type_display(), a.days and f"{a.days} d"),
))
DocumentTypeRegistry.register(DocumentType(
    label="hr.salaryadvance", date_field="date", partner_path="employee.contact",
))
DocumentTypeRegistry.register(DocumentType(
    label="hr.payrollpayment", date_field="date", partner_path="payroll.employee.contact",
    canonical_url=lambda p: f"/hr/payrolls/{p.payroll_id}",
    detail=lambda p: p.get_payment_type_display(),
))
DocumentTypeRegistry.register(DocumentType(label="hr.payrollconcept", canonical_url="/hr/settings/concepts"))


@relation_provider("hr.employee")
def employee_relations(employee):
    from .models import PayrollPayment

    # Asientos y contraparte precargados: el servicio los lee por cada destino (zero-N+1, ADR-0118).
    payments = Prefetch("payments", queryset=PayrollPayment.objects.select_related("journal_entry"))
    payrolls = employee.payrolls.select_related("journal_entry", "previred_journal_entry").prefetch_related(payments)
    for payroll in payrolls:
        yield Link("association", "outgoing", "payroll", payroll, **_LOOSE)
        for payment in payroll.payments.all():
            yield Link("association", "outgoing", "payroll_payment", payment, amount=payment.amount, **_LOOSE)
    for advance in employee.advances.select_related("journal_entry"):
        yield Link("association", "outgoing", "salary_advance", advance, amount=advance.amount, **_LOOSE)
    for absence in employee.absences.all():
        yield Link("association", "outgoing", "absence", absence, **_LOOSE)


@relation_provider("hr.payroll")
def payroll_relations(payroll):
    yield Link("association", "outgoing", "employee", payroll.employee, **_LOOSE)
    for movement in payroll.treasury_movements.all():
        yield Link("settlement", "incoming", "payment", movement, amount=movement.amount)
    for field in ("journal_entry", "previred_journal_entry"):
        if getattr(payroll, f"{field}_id"):
            yield Link("posting", "outgoing", "journal_entry", getattr(payroll, field))


@relation_provider("hr.salaryadvance")
def salary_advance_relations(advance):
    yield Link("association", "outgoing", "employee", advance.employee, **_LOOSE)
    if advance.payroll_id:
        yield Link("association", "outgoing", "payroll", advance.payroll, **_LOOSE)
    if advance.journal_entry_id:
        yield Link("posting", "outgoing", "journal_entry", advance.journal_entry)
        movement = related_or_none(advance.journal_entry, "treasury_movement")
        if movement is not None:
            yield Link("settlement", "incoming", "payment", movement, amount=movement.amount)


@relation_provider("hr.absence")
def absence_relations(absence):
    yield Link("association", "outgoing", "employee", absence.employee, **_LOOSE)


@relation_provider("hr.payrollpayment")
def payroll_payment_relations(payment):
    yield Link("association", "outgoing", "payroll", payment.payroll, **_LOOSE)
    yield Link("association", "outgoing", "employee", payment.payroll.employee, **_LOOSE)
    if payment.journal_entry_id:
        yield Link("posting", "outgoing", "journal_entry", payment.journal_entry)
        movement = related_or_none(payment.journal_entry, "treasury_movement")
        if movement is not None:
            yield Link("settlement", "incoming", "payment", movement, amount=movement.amount)
