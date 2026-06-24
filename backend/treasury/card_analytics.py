"""
card_analytics.py — Analytics & aggregated KPIs for credit-card management.

Provides decision-oriented metrics across all dimensions:
  - Financial costs (interest + fees per period across statements).
  - Payment performance (history, lateness, punitory interest).
  - Credit utilization (current + projected).
  - Consolidated hub data (single response for the front-end hub).

All methods are read-only; no transactions or mutations.
"""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from django.db.models import Prefetch, Sum

from .models import (
    CardPurchaseGroup,
    CardPurchaseInstallment,
    CreditCardStatement,
)

if TYPE_CHECKING:
    from .models import TreasuryAccount


class CardAnalyticsService:
    """Read-only analytics for credit-card management decisions."""

    # ── Financial costs ─────────────────────────────────────────

    @staticmethod
    def get_financial_costs_by_month(
        card_account: TreasuryAccount | None = None,
        months: int = 12,
    ) -> list[dict]:
        """
        Returns aggregated interest + fees by calendar month for the
        last N months.  Each entry::

            {
                'period': 'YYYY-MM',
                'interest': str,
                'fees': str,
                'total': str,
            }
        """
        from datetime import timedelta

        from django.utils.timezone import now

        since = (now() - timedelta(days=months * 31)).date()
        qs = CreditCardStatement.objects.filter(
            cut_off_date__gte=since,
        )
        if card_account is not None:
            qs = qs.filter(card_account=card_account)
        qs = qs.exclude(status=CreditCardStatement.Status.CANCELED)

        aggregated: dict[str, dict] = {}
        for stmt in qs:
            period = f"{stmt.period_year}-{stmt.period_month:02d}"
            bucket = aggregated.setdefault(
                period,
                {
                    "interest": Decimal("0"),
                    "fees": Decimal("0"),
                    "total": Decimal("0"),
                },
            )
            interest = stmt.interest_charged or Decimal("0")
            fees = stmt.fees_charged or Decimal("0")
            bucket["interest"] += interest
            bucket["fees"] += fees
            bucket["total"] += interest + fees

        result = [
            {
                "period": k,
                "interest": str(v["interest"]),
                "fees": str(v["fees"]),
                "total": str(v["total"]),
            }
            for k, v in sorted(aggregated.items())
        ]
        return result[-months:] if months else result

    # ── Payment performance ─────────────────────────────────────

    @staticmethod
    def get_payment_performance(
        card_account: TreasuryAccount | None = None,
        months: int = 12,
        granularity: str = "month",
    ) -> list[dict]:
        """
        Payment history across statements: how much was due, how much
        was paid, how late (days), and punitory interest accrued.

        When `granularity` is 'month' or 'year', rows are aggregated
        by period summing total_to_pay, amount_paid, outstanding.

        Returns list ordered by period ascending::

            {
                'statement_id': int | None,
                'display_id': str | None,
                'due_date': str,
                'total_to_pay': str,
                'amount_paid': str,
                'outstanding': str,
                'paid_at': str | None,
                'days_late': int | None,
                'status': str | None,
                'punitory_interest': str | None,
            }
        """
        from datetime import timedelta

        from django.utils.timezone import now

        since = (now() - timedelta(days=months * 31)).date()
        qs = CreditCardStatement.objects.filter(
            cut_off_date__gte=since,
        )
        if card_account is not None:
            qs = qs.filter(card_account=card_account)
        qs = qs.select_related("card_account").order_by("-due_date")

        result = []
        for stmt in qs:
            due = stmt.due_date
            paid = stmt.paid_at.date() if stmt.paid_at else None
            days_late = (paid - due).days if paid and paid > due else None

            if granularity == "month":
                period_key = f"{due.year}-{due.month:02d}"
            elif granularity == "year":
                period_key = str(due.year)
            else:
                period_key = due.isoformat()

            result.append(
                {
                    "period_key": period_key,
                    "statement_id": stmt.id,
                    "display_id": stmt.display_id,
                    "due_date": due.isoformat(),
                    "total_to_pay": stmt.total_to_pay,
                    "amount_paid": stmt.amount_paid,
                    "outstanding": stmt.outstanding_balance,
                    "paid_at": paid.isoformat() if paid else None,
                    "days_late": days_late,
                    "status": stmt.status,
                }
            )

        # Aggregate by period_key if granularity is month or year
        if granularity in ("month", "year"):
            from collections import OrderedDict

            buckets: dict[str, dict] = OrderedDict()
            for r in result:
                pk = r["period_key"]
                if pk not in buckets:
                    buckets[pk] = {
                        "due_date": pk,
                        "total_to_pay": Decimal("0"),
                        "amount_paid": Decimal("0"),
                        "outstanding": Decimal("0"),
                    }
                buckets[pk]["total_to_pay"] += r["total_to_pay"]
                buckets[pk]["amount_paid"] += r["amount_paid"]
                buckets[pk]["outstanding"] += r["outstanding"]
            result = [
                {
                    "statement_id": None,
                    "display_id": None,
                    "due_date": v["due_date"],
                    "total_to_pay": str(v["total_to_pay"]),
                    "amount_paid": str(v["amount_paid"]),
                    "outstanding": str(v["outstanding"]),
                    "paid_at": None,
                    "days_late": None,
                    "status": None,
                    "punitory_interest": None,
                }
                for v in buckets.values()
            ]

        return result

    # ── Credit utilization ──────────────────────────────────────

    @staticmethod
    def get_credit_utilization(
        card_account: TreasuryAccount | None = None,
    ) -> list[dict]:
        """
        Current utilization per card: limit, current debt, unbilled,
        available, utilization %.  If card_account is None, returns
        data for ALL credit-card accounts.

        Returns::

            {
                'card_account_id': int,
                'card_name': str,
                'credit_limit': str | None,
                'current_debt': str,
                'total_unbilled': str,
                'available_credit': str | None,
                'utilization_pct': float,
            }
        """
        from .models import TreasuryAccount

        qs = TreasuryAccount.objects.filter(
            account_type=TreasuryAccount.Type.CREDIT_CARD,
        )
        if card_account is not None:
            qs = qs.filter(pk=card_account.pk)

        result = []
        for acct in qs:
            limit = acct.credit_limit or Decimal("0")
            current_debt = abs(acct.current_balance) if acct.current_balance else Decimal("0")
            available = acct.available_credit or Decimal("0")

            # unbilled = pending charges + upcoming installments
            from .card_service import CardService

            summary = CardService.get_unbilled_summary(acct)
            total_unbilled = Decimal(str(summary["total"]))

            total_used = current_debt + total_unbilled
            utilization_pct = (
                float((total_used / limit * 100).quantize(Decimal("0.1"))) if limit > 0 else 0.0
            )

            result.append(
                {
                    "card_account_id": acct.id,
                    "card_name": acct.name,
                    "credit_limit": str(limit) if limit else None,
                    "current_debt": str(current_debt),
                    "total_unbilled": str(total_unbilled),
                    "available_credit": str(available) if available else None,
                    "utilization_pct": utilization_pct,
                }
            )

        return result

    # ── Purchase-group cost analysis ────────────────────────────

    @staticmethod
    def get_purchase_group_analysis(
        card_account: TreasuryAccount | None = None,
        months: int = 12,
        limit: int = 20,
    ) -> list[dict]:
        """
        Recent purchase groups with cost breakdown limited to billed
        installments only.  `total_amount` reflects only installments
        where `is_billed=True`; interest is prorated proportionally.

        Returns::

            {
                'group_id': int,
                'display_id': str,
                'partner_name': str | None,
                'total_amount': str,
                'installments': int,
                'monthly_rate': str,
                'total_interest': str,
                'total_payable': str,
                'effective_cost_pct': float | None,
            }
        """
        from datetime import timedelta

        from django.utils.timezone import now

        since = (now() - timedelta(days=months * 31)).date()
        qs = CardPurchaseGroup.objects.select_related("partner").prefetch_related(
            Prefetch("schedule", queryset=CardPurchaseInstallment.objects.filter(is_billed=True)),
        )
        if card_account is not None:
            qs = qs.filter(card_account=card_account)
        qs = qs.filter(created_at__date__gte=since)
        qs = qs.filter(schedule__is_billed=True)
        qs = qs.order_by("-created_at").distinct()[:limit]

        result = []
        for g in qs:
            billed_inst = [inst for inst in g.schedule.all() if inst.is_billed]
            billed_principal = sum((inst.principal_amount for inst in billed_inst), Decimal("0"))
            billed_count = len(billed_inst)
            if billed_principal == 0:
                continue

            ratio = billed_principal / g.total_amount if g.total_amount > 0 else Decimal("0")
            prorated_interest = (g.total_interest * ratio).quantize(Decimal("0.01"))
            prorated_payable = billed_principal + prorated_interest
            effective_cost_pct = float(
                (prorated_interest / billed_principal * 100).quantize(Decimal("0.01"))
            )

            result.append(
                {
                    "group_id": g.id,
                    "display_id": g.display_id,
                    "partner_name": g.partner.name if g.partner else None,
                    "total_amount": str(billed_principal),
                    "installments": billed_count,
                    "monthly_rate": str(g.monthly_rate),
                    "total_interest": str(prorated_interest),
                    "total_payable": str(prorated_payable),
                    "effective_cost_pct": effective_cost_pct,
                }
            )

        return result

    # ── Consolidated hub data ───────────────────────────────────

    @staticmethod
    def get_consolidated_hub_data(
        card_account: TreasuryAccount | None = None,
        months: int = 12,
        granularity: str = "month",
    ) -> dict:
        """
        Single response aggregating all analytics dimensions for the
        front-end TC Hub.  Keys match the 4 decision-oriented tabs:

            - financial_costs:  list by month
            - payment_performance: list of past statements
            - credit_utilization: per-card metrics
            - purchase_group_analysis: recent groups with costs
            - summary: top-level KPIs (total debt, open count, etc.)
        """
        financial_costs = CardAnalyticsService.get_financial_costs_by_month(
            card_account=card_account,
            months=months,
        )
        payment_performance = CardAnalyticsService.get_payment_performance(
            card_account=card_account,
            months=months,
            granularity=granularity,
        )
        credit_utilization = CardAnalyticsService.get_credit_utilization(
            card_account=card_account,
        )
        purchase_group_analysis = CardAnalyticsService.get_purchase_group_analysis(
            card_account=card_account,
            months=months,
        )

        # Summary KPIs
        total_debt = Decimal("0")
        open_count = 0
        overdue_count = 0
        total_unbilled = Decimal("0")

        qs = CreditCardStatement.objects.exclude(
            status=CreditCardStatement.Status.CANCELED,
        )
        if card_account is not None:
            qs = qs.filter(card_account=card_account)

        for stmt in qs:
            total_debt += stmt.outstanding_balance
            if stmt.status == CreditCardStatement.Status.OPEN:
                open_count += 1
            elif stmt.status == CreditCardStatement.Status.OVERDUE:
                overdue_count += 1

        if card_account is not None:
            from .card_service import CardService

            summary = CardService.get_unbilled_summary(card_account)
            total_unbilled = Decimal(str(summary["total"]))

        # Total billed amount within the same time window (for composition breakdown).
        from datetime import timedelta

        from django.utils.timezone import now

        since = (now() - timedelta(days=months * 31)).date()
        billed_qs = CreditCardStatement.objects.filter(
            cut_off_date__gte=since,
        ).exclude(status=CreditCardStatement.Status.CANCELED)
        if card_account is not None:
            billed_qs = billed_qs.filter(card_account=card_account)
        total_billed = billed_qs.aggregate(
            total=Sum("billed_amount"),
        )["total"] or Decimal("0")

        return {
            "financial_costs": financial_costs,
            "payment_performance": payment_performance,
            "credit_utilization": credit_utilization,
            "purchase_group_analysis": purchase_group_analysis,
            "summary": {
                "total_debt": str(total_debt),
                "total_unbilled": str(total_unbilled),
                "open_statements": open_count,
                "overdue_statements": overdue_count,
                "total_past_due": str(
                    sum(
                        Decimal(p["outstanding"])
                        for p in payment_performance
                        if p.get("days_late") and p["days_late"] > 0
                    )
                ),
                "total_billed": str(total_billed),
            },
        }
