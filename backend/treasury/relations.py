"""Proveedores de relaciones documentales de tesorería (ADR-0080, contrato document-relations.md)."""

from core.documents import DocumentType, DocumentTypeRegistry, Link, relation_provider
from core.documents.details import display, join

DocumentTypeRegistry.register(DocumentType(
    label="treasury.treasurymovement", canonical_url="/treasury/operaciones/movements?selected={id}",
    amount_field="amount",
    detail=lambda m: join(
        display(m, "movement_type"), display(m, "payment_method"),
        f"ref. {m.reference or m.transaction_number}" if (m.reference or m.transaction_number) else None,
    ),
))


@relation_provider("treasury.treasurymovement")
def treasury_movement_relations(movement):
    for field, role in (("invoice", "invoice"), ("sale_order", "sale_order"), ("purchase_order", "purchase_order")):
        if getattr(movement, f"{field}_id"):
            yield Link("settlement", "outgoing", role, getattr(movement, field), amount=movement.amount)
    for allocation in movement.allocations.select_related("invoice", "sale_order", "purchase_order"):
        for field in ("invoice", "sale_order", "purchase_order"):
            target = getattr(allocation, field)
            if target is not None:
                yield Link("settlement", "outgoing", field, target, amount=allocation.amount)
    if movement.journal_entry_id:
        yield Link("posting", "outgoing", "journal_entry", movement.journal_entry)


DocumentTypeRegistry.register(DocumentType(label="treasury.check"))
DocumentTypeRegistry.register(DocumentType(label="treasury.terminalbatch"))


@relation_provider("treasury.treasurymovement")
def treasury_movement_extra_relations(movement):
    from core.documents import related_or_none

    for accessor, role in (("check_receipt", "check"), ("check_settlement", "check")):
        check = related_or_none(movement, accessor)
        if check is not None:
            yield Link("association", "incoming", role, check, is_dependency=False)
    if movement.terminal_batch_id:
        yield Link("association", "incoming", "terminal_batch", movement.terminal_batch, is_dependency=False)
    if movement.payroll_id:
        yield Link("settlement", "outgoing", "payroll", movement.payroll, amount=movement.amount)


@relation_provider("treasury.check")
def check_relations(check):
    for field, role in (("invoice", "invoice"), ("sale_order", "sale_order")):
        if getattr(check, f"{field}_id"):
            yield Link("settlement", "outgoing", role, getattr(check, field), amount=check.amount)
    for field, role in (("receipt_movement", "payment"), ("settlement_movement", "payment")):
        if getattr(check, f"{field}_id"):
            yield Link("association", "outgoing", role, getattr(check, field), is_dependency=False)


@relation_provider("treasury.terminalbatch")
def terminal_batch_relations(batch):
    for payment in batch.payments.all():
        yield Link("association", "outgoing", "payment", payment, amount=payment.amount, is_dependency=False)
    if batch.settlement_movement_id:
        yield Link("settlement", "outgoing", "payment", batch.settlement_movement, amount=batch.settlement_movement.amount)
    if batch.supplier_invoice_id:
        yield Link("reference", "outgoing", "invoice", batch.supplier_invoice, is_dependency=False)
    if batch.settlement_journal_entry_id:
        yield Link("posting", "outgoing", "journal_entry", batch.settlement_journal_entry)


# Tipos del centro bancario sin ficha propia: se abren en su vista (lista)
for _label in (
    "treasury.bankloan", "treasury.cardpurchasegroup", "treasury.cardpurchaseinstallment",
    "treasury.creditcardstatement", "treasury.creditline", "treasury.loaninstallment",
):
    DocumentTypeRegistry.register(DocumentType(label=_label, canonical_url="/treasury/bank-center"))
DocumentTypeRegistry.register(DocumentType(
    label="treasury.paymentmethod", canonical_url="/treasury/operaciones/methods?selected={id}",
))
