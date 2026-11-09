"""Proveedores de relaciones documentales de tesorería (ADR-0080, contrato document-relations.md)."""

from core.documents import DocumentType, DocumentTypeRegistry, Link, relation_provider
from core.documents.details import display, join


def _line_detail(line):
    desc = (line.description or "").strip()
    desc = desc[:40] + "…" if len(desc) > 40 else desc
    return join(f"Línea {line.line_number}", line.transaction_date.strftime("%d-%m-%Y"), desc)


def _installment_detail(installment):
    return join(f"Cuota {installment.number}/{installment.loan.term_months}", f"vence {installment.due_date.strftime('%d-%m-%Y')}")


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

DocumentTypeRegistry.register(DocumentType(
    label="treasury.possession",
    canonical_url="/treasury/sessions/{id}",
    domain="origin",
    status_field="status",
    date_field="opened_at",
    amount_field=None,
    detail=lambda s: join(
        getattr(getattr(s, "terminal", None), "name", None),
        getattr(getattr(s, "user", None), "get_full_name", lambda: None)(),
    ),
))

DocumentTypeRegistry.register(DocumentType(
    label="treasury.posterminal",
    domain="origin",
    status_field=None,
    amount_field=None,
    detail=lambda t: join(t.code, t.location if t.location else None),
))


@relation_provider("treasury.possession")
def pos_session_relations(session):
    for order in session.sale_orders.all():
        yield Link("derivation", "outgoing", "pos_sale", order, is_dependency=False)


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

    # Préstamos bancarios: cuotas, desembolsos y prepagos.
    installment = related_or_none(movement, "installment_payment")
    if installment is not None:
        yield Link("settlement", "incoming", "bank_loan", installment.loan, amount=movement.amount,
                   detail=_installment_detail(installment))
    loan_disb = related_or_none(movement, "loan_disbursement")
    if loan_disb is not None:
        yield Link("association", "incoming", "bank_loan", loan_disb, is_dependency=False, detail="Desembolso")
    loan_prepay = related_or_none(movement, "loan_prepayment")
    if loan_prepay is not None:
        yield Link("settlement", "incoming", "bank_loan", loan_prepay, amount=movement.amount, detail="Prepago total")

    # Tarjeta de crédito — compras en cuotas.
    if movement.card_purchase_group_id:
        semantic = "association" if movement.is_installment_interest else "settlement"
        yield Link(semantic, "incoming", "card_purchase_group", movement.card_purchase_group, amount=movement.amount, is_dependency=False)

    # Tarjeta de crédito — pagos y cargos de estado de cuenta.
    if movement.from_card_statement_id:
        yield Link("settlement", "outgoing", "card_statement", movement.from_card_statement, amount=movement.amount)
    card_charges = related_or_none(movement, "card_statement_charges")
    if card_charges is not None:
        yield Link("posting", "incoming", "card_statement", card_charges, is_dependency=False)

    # Línea de crédito — disposiciones y pagos.
    if movement.credit_line_id:
        yield Link("association", "incoming", "credit_line", movement.credit_line, is_dependency=False)

    # Conciliación bancaria — cartola y líneas asociadas (todas las del grupo si hay match).
    if movement.bank_statement_line_id:
        line = movement.bank_statement_line
        lines = list(line.reconciliation_match.lines.all()) if line.reconciliation_match_id else [line]
        same_statement = sorted(
            (item for item in lines if item.statement_id == line.statement_id), key=lambda item: item.line_number
        )
        detail = "; ".join(_line_detail(item) for item in same_statement)
        yield Link("association", "incoming", "bank_statement", line.statement, is_dependency=False, detail=detail)


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


DocumentTypeRegistry.register(DocumentType(
    label="treasury.bankloan",
    canonical_url=lambda loan: f"/treasury/bank-center/{loan.lender_id}/loans?selected={loan.id}",
    amount_field="principal",
    status_field="status",
))


@relation_provider("treasury.bankloan")
def bank_loan_relations(loan):
    if loan.disbursement_movement_id:
        yield Link(
            "association", "outgoing", "disbursement",
            loan.disbursement_movement,
            amount=loan.disbursement_movement.amount,
            is_dependency=False,
            detail="Desembolso",
        )
    for installment in loan.installments.select_related("payment_movement", "loan").filter(
        payment_movement__isnull=False
    ):
        yield Link(
            "settlement", "outgoing", "installment_payment",
            installment.payment_movement,
            amount=installment.payment_movement.amount,
            detail=_installment_detail(installment),
        )
    if loan.prepay_movement_id:
        yield Link(
            "settlement", "outgoing", "prepay",
            loan.prepay_movement,
            amount=loan.prepay_movement.amount,
            detail="Prepago total",
        )


DocumentTypeRegistry.register(DocumentType(
    label="treasury.creditcardstatement",
    canonical_url="/treasury/bank-center?selected={id}",
    amount_field="billed_amount",
    status_field="status",
))


@relation_provider("treasury.creditcardstatement")
def card_statement_relations(stmt):
    if stmt.charges_movement_id:
        yield Link("posting", "outgoing", "charges_movement", stmt.charges_movement, amount=stmt.charges_movement.amount)
    for m in stmt.payment_movements.all():
        yield Link("settlement", "outgoing", "payment", m, amount=m.amount)


DocumentTypeRegistry.register(DocumentType(
    label="treasury.cardpurchasegroup",
    canonical_url="/treasury/bank-center?selected={id}",
    amount_field="total_amount",
))


@relation_provider("treasury.cardpurchasegroup")
def card_purchase_group_relations(group):
    for m in group.movements.all():
        semantic = "association" if m.is_installment_interest else "settlement"
        yield Link(semantic, "outgoing", "installment_payment", m, amount=m.amount, is_dependency=False)


DocumentTypeRegistry.register(DocumentType(
    label="treasury.creditline",
    canonical_url="/treasury/bank-center?selected={id}",
    amount_field="credit_limit",
    status_field="status",
))


@relation_provider("treasury.creditline")
def credit_line_relations(line):
    for m in line.movements.order_by("-date")[:50]:
        yield Link("association", "outgoing", "movement", m, amount=m.amount, is_dependency=False)


DocumentTypeRegistry.register(DocumentType(
    label="treasury.bankstatement",
    canonical_url="/treasury/bank-center/reconciliation?selected={id}",
    status_field="status",
))


@relation_provider("treasury.bankstatement")
def bank_statement_relations(statement):
    lines = statement.lines.prefetch_related("matched_movements").order_by("line_number")
    for line in lines:
        for movement in line.matched_movements.all():
            yield Link("association", "outgoing", "reconciled_movement", movement,
                       amount=movement.amount, is_dependency=False, detail=_line_detail(line))

# Tipos del centro bancario sin ficha propia: se abren en su vista (lista)
for _label in (
    "treasury.cardpurchaseinstallment",
    "treasury.loaninstallment",
):
    DocumentTypeRegistry.register(DocumentType(label=_label, canonical_url="/treasury/bank-center"))
DocumentTypeRegistry.register(DocumentType(
    label="treasury.paymentmethod", canonical_url="/treasury/operaciones/methods?selected={id}",
))
