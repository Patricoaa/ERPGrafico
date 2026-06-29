from datetime import timedelta
from decimal import Decimal

from django.db.models import Q, Sum
from django.utils import timezone

from .models import (
    Bank,
    BankLoan,
    BankStatement,
    BankStatementLine,
    Check,
    CreditCardStatement,
    LoanInstallment,
    POSSession,
    TreasuryAccount,
    TreasuryMovement,
)
from .serializers import BankSerializer


class BankSelector:
    @staticmethod
    def get_overview(bank: Bank) -> dict:
        # Cuentas de tesorería del banco
        accounts = TreasuryAccount.objects.filter(bank=bank).order_by("account_type", "name")
        accounts_data = []
        for acc in accounts:
            try:
                credit_line_credit_limit = float(acc.credit_line.credit_limit)
            except TreasuryAccount.credit_line.RelatedObjectDoesNotExist:
                credit_line_credit_limit = None

            accounts_data.append(
                {
                    "id": acc.id,
                    "name": acc.name,
                    "code": acc.code,
                    "account_number": acc.account_number,
                    "card_number": acc.card_number,
                    "account_type": acc.account_type,
                    "account_type_display": acc.get_account_type_display(),
                    "current_balance": float(acc.current_balance),
                    "currency": acc.currency,
                    "credit_limit": float(acc.credit_limit) if acc.credit_limit else None,
                    "credit_line_credit_limit": credit_line_credit_limit,
                }
            )

        # Tarjetas de crédito del banco (cuentas CREDIT_CARD)
        card_accounts = accounts.filter(account_type=TreasuryAccount.Type.CREDIT_CARD)

        open_statements = CreditCardStatement.objects.filter(
            card_account__in=card_accounts,
            status__in=[CreditCardStatement.Status.OPEN, CreditCardStatement.Status.OVERDUE],
        ).order_by("due_date")
        card_debt = sum(
            (s.total_to_pay for s in open_statements),
            Decimal("0"),
        )

        # Cheques en cartera y propios girados
        portfolio_checks = (
            Check.objects.filter(
                bank=bank,
                direction=Check.Direction.RECEIVED,
                status=Check.Status.IN_PORTFOLIO,
            ).aggregate(total=Sum("amount"))["total"]
            or 0
        )
        issued_checks_qs = Check.objects.filter(
            bank=bank,
            direction=Check.Direction.ISSUED,
            status=Check.Status.ISSUED,
        )
        issued_checks = issued_checks_qs.aggregate(total=Sum("amount"))["total"] or 0

        # Créditos activos
        active_loans = BankLoan.objects.filter(
            lender=bank,
            status=BankLoan.Status.ACTIVE,
        )
        total_loan_debt = LoanInstallment.objects.filter(
            loan__in=active_loans,
        ).exclude(
            status__in=[LoanInstallment.Status.PAID, LoanInstallment.Status.CANCELED]
        ).aggregate(
            s=Sum("principal_amount"),
        )["s"] or Decimal("0")

        # Préstamos activos (hasta 10 items para el dashboard)
        active_loans_data = []
        for loan in active_loans[:10].select_related("lender"):
            next_inst = (
                loan.installments.filter(
                    status=LoanInstallment.Status.PENDING,
                )
                .order_by("due_date")
                .first()
            )
            active_loans_data.append(
                {
                    "id": loan.id,
                    "display_id": loan.display_id,
                    "loan_number": loan.loan_number,
                    "principal": float(loan.principal),
                    "outstanding_balance": float(loan.outstanding_balance),
                    "next_due_date": next_inst.due_date.isoformat() if next_inst else None,
                    "next_installment_amount": float(next_inst.total_amount) if next_inst else None,
                    "installments_count": loan.installments.count(),
                    "paid_installments_count": loan.installments.filter(
                        status=LoanInstallment.Status.PAID
                    ).count(),
                }
            )

        # Cheques girados (hasta 10 items para el dashboard)
        issued_checks_list_data = []
        for chk in issued_checks_qs[:10].select_related("counterparty"):
            issued_checks_list_data.append(
                {
                    "id": chk.id,
                    "display_id": chk.display_id,
                    "check_number": chk.check_number,
                    "amount": float(chk.amount),
                    "issue_date": chk.issue_date.isoformat(),
                    "due_date": chk.due_date.isoformat(),
                    "counterparty_name": chk.counterparty.name if chk.counterparty else None,
                    "drawer_name": chk.drawer_name,
                }
            )

        # Próximos vencimientos (cuotas, cheques, tarjetas) — horizonte 30 días
        today = timezone.now().date()
        horizon = today + timedelta(days=30)
        upcoming = []

        # Cuotas de préstamo
        upcoming_installments = (
            LoanInstallment.objects.filter(
                loan__lender=bank,
                loan__status=BankLoan.Status.ACTIVE,
                status__in=[LoanInstallment.Status.PENDING, LoanInstallment.Status.OVERDUE],
                due_date__lte=horizon,
            )
            .select_related("loan")
            .order_by("due_date")[:20]
        )
        for inst in upcoming_installments:
            upcoming.append(
                {
                    "type": "LOAN_INSTALLMENT",
                    "label": f"Cuota #{inst.number} — {inst.loan.display_id}",
                    "due_date": inst.due_date.isoformat(),
                    "amount": float(inst.total_amount),
                    "entity_id": inst.loan.id,
                    "display_id": inst.loan.display_id,
                }
            )

        # Cheques recibidos por vencer
        expiring_checks = Check.objects.filter(
            bank=bank,
            direction=Check.Direction.RECEIVED,
            status=Check.Status.IN_PORTFOLIO,
            due_date__lte=horizon,
        ).order_by("due_date")[:20]
        for ch in expiring_checks:
            upcoming.append(
                {
                    "type": "CHECK",
                    "label": f"Cheque {ch.check_number}",
                    "due_date": ch.due_date.isoformat(),
                    "amount": float(ch.amount),
                    "entity_id": ch.id,
                    "display_id": ch.display_id,
                }
            )

        # Estados de cuenta de tarjeta por vencer
        upcoming_statements = CreditCardStatement.objects.filter(
            card_account__in=card_accounts,
            status__in=[CreditCardStatement.Status.OPEN, CreditCardStatement.Status.OVERDUE],
            due_date__lte=horizon,
        ).order_by("due_date")[:20]
        for stmt in upcoming_statements:
            upcoming.append(
                {
                    "type": "CARD_STATEMENT",
                    "label": f"Estado {stmt.period_month:02d}/{stmt.period_year}",
                    "due_date": stmt.due_date.isoformat(),
                    "amount": float(stmt.total_to_pay),
                    "entity_id": stmt.id,
                    "display_id": stmt.display_id,
                }
            )

        upcoming.sort(key=lambda x: x["due_date"])

        # Conciliación: último estado de cuenta y líneas sin reconciliar
        latest_statement = (
            BankStatement.objects.filter(
                treasury_account__bank=bank,
            )
            .order_by("-statement_date")
            .first()
        )
        reconciliation_summary = None
        if latest_statement:
            unreconciled_lines = BankStatementLine.objects.filter(
                statement__treasury_account__bank=bank,
                reconciliation_status=BankStatementLine.ReconciliationStatus.UNRECONCILED,
            ).count()
            reconciliation_summary = {
                "latest_statement_id": latest_statement.id,
                "latest_statement_date": latest_statement.statement_date.isoformat(),
                "latest_statement_status": latest_statement.status,
                "unreconciled_lines": unreconciled_lines,
            }

        # Movimientos recientes (últimos 5) de las cuentas del banco
        account_ids = accounts.values_list("id", flat=True)
        recent_movements_list = (
            TreasuryMovement.objects.filter(
                Q(from_account_id__in=account_ids) | Q(to_account_id__in=account_ids),
            )
            .select_related(
                "from_account",
                "to_account",
            )
            .order_by("-date")[:5]
        )
        recent_movements = [
            {
                "id": m.id,
                "display_id": m.display_id,
                "movement_type": m.movement_type,
                "movement_type_display": m.get_movement_type_display(),
                "amount": float(m.amount),
                "date": m.date.isoformat(),
                "from_account_id": m.from_account_id,
                "from_account_name": m.from_account.name if m.from_account else None,
                "to_account_id": m.to_account_id,
                "to_account_name": m.to_account.name if m.to_account else None,
                "payment_method": m.payment_method,
                "payment_method_display": m.get_payment_method_display(),
            }
            for m in recent_movements_list
        ]

        return {
            "bank": BankSerializer(bank).data,
            "accounts": accounts_data,
            "summary": {
                "total_accounts": len(accounts_data),
                "card_count": card_accounts.count(),
                "card_debt": float(card_debt),
                "portfolio_checks": float(portfolio_checks),
                "issued_checks": float(issued_checks),
                "active_loan_count": active_loans.count(),
                "total_loan_debt": float(total_loan_debt),
                "reconciliation": reconciliation_summary,
            },
            "upcoming_maturities": upcoming,
            "recent_movements": recent_movements,
            "active_loans": active_loans_data,
            "issued_checks_list": issued_checks_list_data,
        }

class TreasuryDashboardSelector:
    @staticmethod
    def get_stats():
        bank_balance = sum(
            a.current_balance
            for a in TreasuryAccount.objects.filter(account_type=TreasuryAccount.Type.BANK)
        )
        cash_balance = sum(
            a.current_balance
            for a in TreasuryAccount.objects.filter(account_type=TreasuryAccount.Type.CASH)
        )
        return {
            "bank_total": bank_balance,
            "cash_total": cash_balance,
            "total_available": bank_balance + cash_balance,
        }

    @staticmethod
    def list_dashboard_accounts():
        accounts = TreasuryAccount.objects.all().order_by("account_type", "name")
        from .serializers import TreasuryAccountSerializer
        return TreasuryAccountSerializer(accounts, many=True).data

    @staticmethod
    def get_future_maturities(days: int = 90, treasury_account_id: int = None) -> dict:
        today = timezone.now().date()
        horizon = today + timedelta(days=days)
        items = []

        # Cuotas de préstamo pendientes
        installments_qs = LoanInstallment.objects.filter(
            status__in=[LoanInstallment.Status.PENDING, LoanInstallment.Status.OVERDUE],
            due_date__gte=today,
            due_date__lte=horizon,
        ).select_related("loan", "loan__lender")
        if treasury_account_id:
            installments_qs = installments_qs.filter(
                loan__disbursement_account_id=treasury_account_id
            )
        for inst in installments_qs:
            items.append(
                {
                    "type": "LOAN_INSTALLMENT",
                    "direction": "OUTBOUND",
                    "label": f"Cuota #{inst.number} — {inst.loan.display_id}",
                    "due_date": inst.due_date.isoformat(),
                    "amount": float(inst.total_amount),
                    "account_id": inst.loan.disbursement_account_id,
                }
            )

        # Cheques recibidos en cartera por vencer
        checks_qs = Check.objects.filter(
            direction=Check.Direction.RECEIVED,
            status=Check.Status.IN_PORTFOLIO,
            due_date__gte=today,
            due_date__lte=horizon,
        )
        if treasury_account_id:
            checks_qs = checks_qs.filter(deposit_account_id=treasury_account_id)
        for ch in checks_qs:
            items.append(
                {
                    "type": "CHECK_RECEIVED",
                    "direction": "INBOUND",
                    "label": f"Cheque {ch.check_number} — {ch.display_id}",
                    "due_date": ch.due_date.isoformat(),
                    "amount": float(ch.amount),
                    "account_id": ch.deposit_account_id,
                }
            )

        # Cheques propios girados por vencer
        issued_checks_qs = Check.objects.filter(
            direction=Check.Direction.ISSUED,
            status=Check.Status.ISSUED,
            due_date__gte=today,
            due_date__lte=horizon,
        )
        if treasury_account_id:
            issued_checks_qs = issued_checks_qs.filter(payment_account_id=treasury_account_id)
        for ch in issued_checks_qs:
            items.append(
                {
                    "type": "CHECK_ISSUED",
                    "direction": "OUTBOUND",
                    "label": f"Cheque propio {ch.check_number} — {ch.display_id}",
                    "due_date": ch.due_date.isoformat(),
                    "amount": float(ch.amount),
                    "account_id": ch.payment_account_id,
                }
            )

        # Estados de cuenta de tarjeta por vencer
        statements_qs = CreditCardStatement.objects.filter(
            status__in=[CreditCardStatement.Status.OPEN, CreditCardStatement.Status.OVERDUE],
            due_date__gte=today,
            due_date__lte=horizon,
        ).select_related("card_account")
        if treasury_account_id:
            statements_qs = statements_qs.filter(card_account_id=treasury_account_id)
        for stmt in statements_qs:
            items.append(
                {
                    "type": "CARD_STATEMENT",
                    "direction": "OUTBOUND",
                    "label": f"Estado tarjeta {stmt.period_month:02d}/{stmt.period_year} — {stmt.display_id}",
                    "due_date": stmt.due_date.isoformat(),
                    "amount": float(stmt.total_to_pay),
                    "account_id": stmt.card_account_id,
                }
            )

        items.sort(key=lambda x: x["due_date"])

        # Aggregate by month for the projection
        from collections import defaultdict

        monthly = defaultdict(lambda: {"inbound": 0, "outbound": 0})
        for item in items:
            month_key = item["due_date"][:7]  # YYYY-MM
            if item["direction"] == "INBOUND":
                monthly[month_key]["inbound"] += item["amount"]
            else:
                monthly[month_key]["outbound"] += item["amount"]

        return {
            "items": items,
            "monthly_summary": [
                {
                    "month": k,
                    "inbound": v["inbound"],
                    "outbound": v["outbound"],
                    "net": v["inbound"] - v["outbound"],
                }
                for k, v in sorted(monthly.items())
            ],
        }

    @staticmethod
    def get_cash_flows(flow_type: str = "all", date_from=None, date_to=None, treasury_account_id=None) -> list:
        # Build Query
        query = TreasuryMovement.objects.select_related(
            "treasury_account", "from_account", "to_account", "contact", "invoice__contact"
        ).exclude(journal_entry__status="CANCELLED")

        if date_from:
            query = query.filter(date__gte=date_from)
        if date_to:
            query = query.filter(date__lte=date_to)

        if treasury_account_id:
            query = query.filter(
                Q(treasury_account_id=treasury_account_id)
                | Q(from_account_id=treasury_account_id)
                | Q(to_account_id=treasury_account_id)
            )

        if flow_type == "third_party":
            # Strictly Inbound/Outbound moves with partners or invoices
            query = query.filter(movement_type__in=["INBOUND", "OUTBOUND"])
        elif flow_type == "internal":
            # Transfers, adjustments, etc.
            query = query.filter(movement_type__in=["TRANSFER", "ADJUSTMENT"])

        results = []
        for mv in query:
            # Determine partner name
            partner_name = None
            if mv.contact:
                partner_name = mv.contact.name
            elif mv.invoice and mv.invoice.contact:
                partner_name = mv.invoice.contact.name

            # Determine account name for display
            acc_name = "N/A"
            if mv.treasury_account:
                acc_name = mv.treasury_account.name
            elif mv.from_account and mv.to_account:
                acc_name = f"{mv.from_account.name} -> {mv.to_account.name}"
            elif mv.from_account:
                acc_name = mv.from_account.name
            elif mv.to_account:
                acc_name = mv.to_account.name

            # Map source as 'PAYMENT' if it has partner/invoice, else 'CASH_MOVEMENT'
            source = (
                "PAYMENT"
                if (mv.contact or mv.invoice or mv.sale_order or mv.purchase_order)
                else "CASH_MOVEMENT"
            )

            results.append(
                {
                    "id": mv.id,
                    "source": source,
                    "type": mv.get_movement_type_display(),
                    "date": mv.date,
                    "amount": mv.amount,
                    "description": mv.notes or mv.reference or f"Movimiento {mv.display_id}",
                    "treasury_account_name": acc_name,
                    "partner_name": partner_name,
                    "reference": mv.display_id,
                    "is_internal": mv.movement_type in ["TRANSFER", "ADJUSTMENT"],
                }
            )

        results.sort(key=lambda x: x["date"], reverse=True)
        results = results[:50]
        return results


class POSSelector:
    @staticmethod
    def get_payment_methods_for_terminal(terminal, operation=None):
        methods = terminal.allowed_payment_methods.filter(is_active=True)
        if operation == "sales":
            methods = methods.filter(allow_for_sales=True)
        elif operation == "purchases":
            methods = methods.filter(allow_for_purchases=True)
        return methods

    @staticmethod
    def get_current_session(user):
        session = POSSession.objects.filter(user=user, status="OPEN").first()
        return session

    @staticmethod
    def get_summary(session) -> dict:
        totals = {
            "session_id": session.id,
            "treasury_account_id": session.treasury_account_id
            or (session.terminal.default_treasury_account_id if session.terminal else None),
            "opening_balance": session.opening_balance,
            "total_cash_sales": session.total_cash_sales,
            "total_card_sales": session.total_card_sales,
            "total_transfer_sales": session.total_transfer_sales,
            "total_credit_sales": session.total_credit_sales,
            "expected_cash": session.expected_cash,
            "total_sales": (
                session.total_cash_sales
                + session.total_card_sales
                + session.total_transfer_sales
                + session.total_credit_sales
            ),
        }

        sales_by_category = {}

        movements_with_invoice = session.movements.filter(invoice__isnull=False).select_related(
            "invoice"
        )
        invoices = {m.invoice for m in movements_with_invoice}

        for invoice in invoices:
            lines = []
            if invoice.sale_order:
                lines = invoice.sale_order.lines.all().select_related(
                    "product", "product__category"
                )

            for line in lines:
                category_name = "Sin Categoría"
                if line.product and line.product.category:
                    category_name = line.product.category.name

                if category_name not in sales_by_category:
                    sales_by_category[category_name] = 0

                amount = (
                    line.total if hasattr(line, "total") else (line.quantity * line.unit_price)
                )
                sales_by_category[category_name] += amount or 0

        category_data = [{"name": k, "value": v} for k, v in sales_by_category.items()]
        category_data.sort(key=lambda x: x["value"], reverse=True)

        manual_movements = session.movements.filter(
            invoice__isnull=True, sale_order__isnull=True, purchase_order__isnull=True
        ).order_by("-created_at")
        
        from .serializers import TreasuryMovementSerializer

        manual_movements_data = TreasuryMovementSerializer(manual_movements, many=True).data

        return {
            **totals,
            "total_manual_inflow": session.total_other_cash_inflow,
            "total_manual_outflow": session.total_other_cash_outflow,
            "manual_movements": manual_movements_data,
            "sales_by_category": category_data,
        }

class CardSelector:
    @staticmethod
    def get_unbilled_charges_data(card_account_id: int, cut_off_date=None) -> dict:
        from django.db.models import CharField, IntegerField, OuterRef, Subquery
        from .card_service import CardService
        from .models import TreasuryMovement
        from .serializers import CardPendingChargeSerializer

        card_account = TreasuryAccount.objects.get(
            pk=card_account_id, account_type=TreasuryAccount.Type.CREDIT_CARD
        )
        pending = CardService.get_pending_charges(card_account, cut_off_date=cut_off_date)
        summary = CardService.get_unbilled_summary(card_account, cut_off_date=cut_off_date)
        installments = CardService.get_unbilled_installments(
            card_account, cut_off_date=cut_off_date
        )

        po_subq = Subquery(
            TreasuryMovement.objects.filter(
                card_purchase_group=OuterRef("card_purchase_group"),
                movement_type=TreasuryMovement.Type.OUTBOUND,
            ).values("purchase_order_id")[:1],
            output_field=IntegerField(),
        )
        po_number_subq = Subquery(
            TreasuryMovement.objects.filter(
                card_purchase_group=OuterRef("card_purchase_group"),
                movement_type=TreasuryMovement.Type.OUTBOUND,
            ).values("purchase_order__number")[:1],
            output_field=CharField(max_length=20),
        )
        installments = installments.annotate(po_id=po_subq, po_display_number=po_number_subq)

        installments_data = [
            {
                "id": inst.id,
                "number": inst.number,
                "due_date": inst.due_date.isoformat(),
                "principal_amount": str(inst.principal_amount),
                "group_id": inst.card_purchase_group_id,
                "group_uuid": str(inst.card_purchase_group.uuid),
                "group_display_id": inst.card_purchase_group.display_id,
                "purchase_order_id": inst.po_id,
                "purchase_order_display_id": f"OCS-{inst.po_display_number}"
                if inst.po_display_number
                else None,
                "partner_name": (
                    inst.card_purchase_group.partner.name
                    if inst.card_purchase_group.partner
                    else None
                ),
                "total_installments": inst.card_purchase_group.installments,
            }
            for inst in installments
        ]

        charges_data = []

        for p in CardPendingChargeSerializer(pending, many=True).data:
            charges_data.append(
                {
                    "id": p["id"],
                    "amount": str(p["amount"]),
                    "date": p["date"].isoformat() if hasattr(p["date"], "isoformat") else p["date"],
                    "charge_type": p["charge_type"],
                    "charge_type_display": p["charge_type_display"],
                    "description": p.get("description", ""),
                    "reference": "",
                    "source": "pending",
                    "from_account_name": None,
                    "partner_name": None,
                }
            )

        forecast = CardService.get_forecast(card_account, cut_off_date=cut_off_date)

        return {
            "charges": charges_data,
            "upcoming_installments": installments_data,
            "summary": summary,
            "forecast": forecast,
        }

    @staticmethod
    def get_statement_charges(stmt) -> dict:
        """
        Retorna cargos facturados en un statement específico
        (movimientos + cuotas + pendientes).
        """
        from django.db.models import CharField, IntegerField, OuterRef, Subquery

        from .models import CardPendingCharge, CardPurchaseInstallment, TreasuryMovement
        from .serializers import CardPendingChargeSerializer, TreasuryMovementSerializer

        movements = (
            TreasuryMovement.objects.filter(
                billed_in_statement=stmt,
            )
            .select_related("card_purchase_group", "card_purchase_group__partner")
            .order_by("-date", "-id")
        )
        pending = CardPendingCharge.objects.filter(
            billed_in_statement=stmt,
        ).order_by("-date", "-id")
        installments = (
            CardPurchaseInstallment.objects.filter(
                billed_in_statement=stmt,
            )
            .select_related("card_purchase_group", "card_purchase_group__partner")
            .order_by("-due_date", "-id")
        )

        po_subq = Subquery(
            TreasuryMovement.objects.filter(
                card_purchase_group=OuterRef("card_purchase_group"),
                movement_type=TreasuryMovement.Type.OUTBOUND,
            ).values("purchase_order_id")[:1],
            output_field=IntegerField(),
        )
        po_number_subq = Subquery(
            TreasuryMovement.objects.filter(
                card_purchase_group=OuterRef("card_purchase_group"),
                movement_type=TreasuryMovement.Type.OUTBOUND,
            ).values("purchase_order__number")[:1],
            output_field=CharField(max_length=20),
        )
        installments = installments.annotate(po_id=po_subq, po_display_number=po_number_subq)

        installments_data = [
            {
                "id": inst.id,
                "number": inst.number,
                "due_date": inst.due_date.isoformat(),
                "principal_amount": str(inst.principal_amount),
                "group_uuid": str(inst.card_purchase_group.uuid)
                if inst.card_purchase_group
                else None,
                "group_display_id": inst.card_purchase_group.display_id
                if inst.card_purchase_group
                else None,
                "partner_name": (
                    inst.card_purchase_group.partner.name
                    if inst.card_purchase_group and inst.card_purchase_group.partner
                    else None
                ),
                "total_installments": inst.card_purchase_group.installments
                if inst.card_purchase_group
                else None,
                "purchase_order_id": inst.po_id,
                "purchase_order_display_id": f"OCS-{inst.po_display_number}"
                if inst.po_display_number
                else None,
            }
            for inst in installments
        ]
        return {
            "movements": TreasuryMovementSerializer(movements, many=True).data,
            "installments": installments_data,
            "pending_charges": CardPendingChargeSerializer(pending, many=True).data,
        }

class TreasuryMovementSelector:
    @staticmethod
    def get_cancel_impact(movement) -> dict:
        from .models import TreasuryMovement
        return {
            "document_type": "TreasuryMovement",
            "document_id": movement.id,
            "display_id": movement.display_id,
            "status": movement.status,
            "is_cancellable": movement.status == TreasuryMovement.MovementStatus.DRAFT,
            "warning": "",
        }

    @staticmethod
    def list_treasury_movements(qs, params: dict):
        import re
        from django.db.models import Q
        from .models import PaymentMethod, TreasuryAccount

        qs = qs.select_related(
            "account", "from_account__account", "to_account__account",
            "payment_method_new", "reconciled_by", "created_by", "terminal_batch",
            "contact", "invoice__contact", "invoice__sale_order__customer",
            "invoice__purchase_order__supplier", "sale_order__customer",
            "purchase_order__supplier", "journal_entry", "card_purchase_group__partner",
            "bank_statement_line__statement",
        )

        bank_id = params.get("bank")
        if bank_id:
            bank_accounts = TreasuryAccount.objects.filter(bank_id=bank_id).values_list("id", flat=True)
            qs = qs.filter(Q(from_account_id__in=bank_accounts) | Q(to_account_id__in=bank_accounts))

        treasury_account = params.get("treasury_account")
        if treasury_account:
            qs = qs.filter(Q(from_account_id=treasury_account) | Q(to_account_id=treasury_account))

        if date := params.get("date"): qs = qs.filter(date=date)
        if df := params.get("date_from"): qs = qs.filter(date__gte=df)
        if dt := params.get("date_to"): qs = qs.filter(date__lte=dt)
        if amin := params.get("amount_min"): qs = qs.filter(amount__gte=amin)
        if amax := params.get("amount_max"): qs = qs.filter(amount__lte=amax)

        if val_str := params.get("terminal_batch__isnull"):
            qs = qs.filter(terminal_batch__isnull=(val_str.lower() == "true"))

        if provider := params.get("terminal_provider"):
            qs = qs.filter(
                Q(terminal_device__provider_id=provider) |
                Q(payment_method_new__linked_terminal_device__provider_id=provider),
                payment_method_new__method_type=PaymentMethod.Type.CARD_TERMINAL,
            ).distinct()

        if pm := params.get("payment_method_new"):
            qs = qs.filter(payment_method_new_id=pm)

        if (direction := params.get("direction")) and treasury_account:
            if direction == "IN":
                qs = qs.filter(
                    Q(movement_type="INBOUND") |
                    Q(movement_type="TRANSFER", to_account_id=treasury_account) |
                    Q(movement_type="ADJUSTMENT", amount__gt=0)
                )
            elif direction == "OUT":
                qs = qs.filter(
                    Q(movement_type="OUTBOUND") |
                    Q(movement_type="TRANSFER", from_account_id=treasury_account) |
                    Q(movement_type="ADJUSTMENT", amount__lt=0)
                )

        if display_id := params.get("display_id"):
            if match := re.search(r"(\d+)$", display_id):
                qs = qs.filter(id=match.group(1))

        if search := params.get("search"):
            q = (Q(contact__name__icontains=search) | Q(contact__tax_id__icontains=search) |
                 Q(reference__icontains=search) | Q(description__icontains=search) |
                 Q(notes__icontains=search))
            if search.isdigit(): q |= Q(id=search)
            qs = qs.filter(q)

        return qs

class BankStatementSelector:
    @staticmethod
    def list_statement_lines(qs, params: dict):
        if st := params.get('statement'): qs = qs.filter(statement_id=st)
        if rs := (params.get('reconciliation_status') or params.get('reconciliation_state')):
            qs = qs.filter(reconciliation_status__in=rs.split(',')) if ',' in rs else qs.filter(reconciliation_status=rs)
        if df := params.get('date_from'): qs = qs.filter(transaction_date__gte=df)
        if dt := params.get('date_to'): qs = qs.filter(transaction_date__lte=dt)
        if search := params.get('search'):
            from django.db.models import Q
            qs = qs.filter(Q(description__icontains=search) | Q(reference__icontains=search))
        if d := params.get('direction'):
            qs = qs.filter(credit__gt=0) if d == 'IN' else qs.filter(debit__gt=0) if d == 'OUT' else qs
        from django.db.models import Q
        if amin := params.get('amount_min'): qs = qs.filter(Q(credit__gte=amin) | Q(debit__gte=amin))
        if amax := params.get('amount_max'): qs = qs.filter(Q(credit__lte=amax) | Q(debit__lte=amax))
        return qs

    @staticmethod
    def list_bank_statements(qs, params: dict):
        qs = qs.select_related("treasury_account", "treasury_account__bank")

        if acc := params.get("treasury_account"): qs = qs.filter(treasury_account_id=acc)
        if dt := params.get("statement_date"): qs = qs.filter(statement_date=dt)
        if df := params.get("date_from"): qs = qs.filter(statement_date__gte=df)
        if d_to := params.get("date_to"): qs = qs.filter(statement_date__lte=d_to)
        if s := params.get("status"): qs = qs.filter(status=s)

        # "Reconciling" en UI significa UNRECONCILED u OPEN (en el modelo puede estar mapeado a varios)
        if ui_status := params.get("ui_status"):
            from .models import BankStatement
            if ui_status == "reconciling":
                qs = qs.filter(status__in=[
                    BankStatement.Status.DRAFT, BankStatement.Status.OPEN, BankStatement.Status.UNRECONCILED
                ])
            elif ui_status == "reconciled":
                qs = qs.filter(status=BankStatement.Status.RECONCILED)

        # Match exact month/year
        if m := params.get("month"): qs = qs.filter(statement_date__month=m)
        if y := params.get("year"): qs = qs.filter(statement_date__year=y)

        # Ordering
        if order := params.get("ordering"):
            qs = qs.order_by(order)
        else:
            qs = qs.order_by("-statement_date", "-id")

        return qs

    @staticmethod
    def get_partner_name(obj) -> str:
        if obj.terminal_batch:
            contact_prefix = obj.contact.name if obj.contact else "Liquidación"
            return f"{contact_prefix} (Lote: {obj.terminal_batch.display_id})"
        if obj.contact: return obj.contact.name
        if obj.invoice:
            if obj.invoice.contact: return obj.invoice.contact.name
            if obj.invoice.sale_order and obj.invoice.sale_order.customer: return obj.invoice.sale_order.customer.name
            if obj.invoice.purchase_order and obj.invoice.purchase_order.supplier: return obj.invoice.purchase_order.supplier.name
        if obj.sale_order and obj.sale_order.customer: return obj.sale_order.customer.name
        if obj.purchase_order and obj.purchase_order.supplier: return obj.purchase_order.supplier.name
        return "Particular"

    @staticmethod
    def get_partner_id(obj):
        if obj.contact: return obj.contact.id
        if obj.invoice:
            if obj.invoice.contact: return obj.invoice.contact.id
            if obj.invoice.sale_order and obj.invoice.sale_order.customer: return obj.invoice.sale_order.customer.id
            if obj.invoice.purchase_order and obj.invoice.purchase_order.supplier: return obj.invoice.purchase_order.supplier.id
        if obj.sale_order and obj.sale_order.customer: return obj.sale_order.customer.id
        if obj.purchase_order and obj.purchase_order.supplier: return obj.purchase_order.supplier.id
        return None

    @staticmethod
    def get_document_info(obj) -> dict | None:
        info = {"type": None, "id": None, "number": None, "label": None, "display_id": None}
        if obj.invoice:
            info.update({"type": "invoice", "id": obj.invoice.id, "number": obj.invoice.number, "display_id": obj.invoice.display_id, "label": obj.invoice.display_id})
        elif obj.purchase_order:
            info.update({"type": "purchase_order", "id": obj.purchase_order.id, "number": obj.purchase_order.number, "display_id": obj.purchase_order.display_id, "label": obj.purchase_order.display_id})
        elif obj.sale_order:
            info.update({"type": "sale_order", "id": obj.sale_order.id, "number": obj.sale_order.number, "display_id": obj.sale_order.display_id, "label": obj.sale_order.display_id})
        elif obj.journal_entry:
            info.update({"type": "journal_entry", "id": obj.journal_entry.id, "number": obj.journal_entry.number, "display_id": obj.journal_entry.display_id, "label": obj.journal_entry.display_id})
        return info if info["type"] else None

class ReconciliationMatchSelector:
    @staticmethod
    def get_group_data(obj) -> dict | None:
        if not obj.reconciliation_match: return None
        match = obj.reconciliation_match
        all_movements = (match.movements.all() | obj.matched_movements.all()).distinct()
        batch_ids = all_movements.filter(terminal_batch__isnull=False).values_list("terminal_batch_id", flat=True).distinct()
        
        from .models import TerminalBatch
        batches = TerminalBatch.objects.filter(id__in=batch_ids)
        standalone_movements = all_movements.filter(terminal_batch__isnull=True)
        
        from .serializers import TreasuryMovementSerializer, TerminalBatchSerializer
        return {
            "id": match.id,
            "movements": TreasuryMovementSerializer(standalone_movements, many=True).data,
            "batches": TerminalBatchSerializer(batches, many=True).data,
            "difference_amount": float(obj.difference_amount),
            "difference_type": obj.difference_reason,
            "difference_type_display": obj.difference_reason,
            "difference_journal_entry": obj.difference_journal_entry_id,
        }
