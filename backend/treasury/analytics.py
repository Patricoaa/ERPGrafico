"""
analytics.py — Analytics & aggregated KPIs for treasury movements.

Provides decision-oriented metrics over TreasuryMovement rows:
  - Flow trend (ingresos / egresos / ajustes / transferencias by period).
  - Direction distribution (IN / OUT / TRANSFER / ADJUSTMENT).
  - Account distribution (by treasury account).
  - Payment-method distribution.
  - Movement-type distribution.
  - Consolidated hub data (single response for the analytics panel).

All methods are read-only; no transactions or mutations. Cancelled movements
are excluded (they do not represent real cash flow).

Pattern: server-side aggregation mirroring ``inventory.analytics``
(ADR 0058) — DB does the grouping, the frontend consumes chart-ready shapes.
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from typing import Any

from django.db.models import Case, CharField, Count, F, IntegerField, Q, Sum, Value, When
from django.db.models.functions import Coalesce, TruncDay, TruncMonth, TruncYear
from django.utils.timezone import now

from .models import TreasuryMovement


class TreasuryMovementAnalyticsService:
    """Read-only analytics for treasury movements."""

    DIRECTIONS = (
        ("IN", "Ingresos"),
        ("OUT", "Egresos"),
        ("TRANSFER", "Transferencias"),
        ("ADJUSTMENT", "Ajustes"),
    )

    DIRECTION_KEYS = ("IN", "OUT", "TRANSFER", "ADJUSTMENT")

    # ── Query building ──────────────────────────────────────────

    @staticmethod
    def _base_queryset(
        treasury_account: int | None = None,
        bank: int | None = None,
        movement_type: str | None = None,
        payment_method: str | None = None,
        amount_min: str | None = None,
        amount_max: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
        months: int = 12,
    ):
        """
        Base TreasuryMovement queryset applying shared filters.

        If ``date_from``/``date_to`` are provided they take precedence over the
        rolling ``months`` window. Cancelled movements are always excluded.
        """
        qs = TreasuryMovement.objects.exclude(status=TreasuryMovement.MovementStatus.CANCELLED)
        if treasury_account is not None:
            qs = qs.filter(Q(from_account_id=treasury_account) | Q(to_account_id=treasury_account))
        if bank is not None:
            qs = qs.filter(Q(from_account__bank_id=bank) | Q(to_account__bank_id=bank))
        if movement_type:
            qs = qs.filter(movement_type=movement_type)
        if payment_method:
            qs = qs.filter(payment_method=payment_method)
        if amount_min:
            qs = qs.filter(amount__gte=amount_min)
        if amount_max:
            qs = qs.filter(amount__lte=amount_max)
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)
        if not date_from and not date_to and months:
            since = (now() - timedelta(days=months * 31)).date()
            qs = qs.filter(date__gte=since)
        return qs

    @staticmethod
    def _direction_annotation() -> Case:
        """
        Classifies each movement into IN/OUT/TRANSFER/ADJUSTMENT at DB level.

          - TRANSFER:   internal transfer between treasury accounts.
          - ADJUSTMENT: adjustments (amount may be negative).
          - IN:         inbound collections and credit-line repayments.
          - OUT:        outbound payments and credit-line draws.
        """
        return Case(
            When(movement_type="TRANSFER", then=Value("TRANSFER")),
            When(movement_type="ADJUSTMENT", then=Value("ADJUSTMENT")),
            When(movement_type__in=["INBOUND", "CREDIT_LINE_REPAY"], then=Value("IN")),
            When(movement_type__in=["OUTBOUND", "CREDIT_LINE_DRAW"], then=Value("OUT")),
            default=Value("OUT"),
            output_field=CharField(),
        )

    @staticmethod
    def _period_annotation(granularity: str):
        truncator = {
            "day": TruncDay,
            "year": TruncYear,
            "month": TruncMonth,
        }.get(granularity, TruncMonth)
        return truncator("date")

    @staticmethod
    def _format_period(value: Any) -> str:
        """Formats a truncated date as the canonical period key."""
        return value.strftime("%Y-%m-%d") if hasattr(value, "strftime") else str(value)

    @staticmethod
    def _account_expression():
        """Picks the movement's "main" treasury account (mirrors the model property)."""
        return Case(
            When(movement_type="INBOUND", then=F("to_account_id")),
            When(movement_type="CREDIT_LINE_REPAY", then=F("to_account_id")),
            When(movement_type="TRANSFER", then=F("from_account_id")),
            When(movement_type="ADJUSTMENT", then=Coalesce("from_account_id", "to_account_id")),
            default=F("from_account_id"),
            output_field=IntegerField(),
        )

    @staticmethod
    def _account_name_expression():
        return Case(
            When(movement_type="INBOUND", then=F("to_account__name")),
            When(movement_type="CREDIT_LINE_REPAY", then=F("to_account__name")),
            When(movement_type="TRANSFER", then=F("from_account__name")),
            When(movement_type="ADJUSTMENT", then=Coalesce("from_account__name", "to_account__name")),
            default=F("from_account__name"),
            output_field=CharField(),
        )

    # ── Aggregations ────────────────────────────────────────────

    @staticmethod
    def get_flow_trend(
        granularity: str = "month",
        months: int = 12,
        treasury_account: int | None = None,
        bank: int | None = None,
        movement_type: str | None = None,
        payment_method: str | None = None,
        amount_min: str | None = None,
        amount_max: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> list[dict]:
        """
        Movement count and amount by period and direction.

        Returns list ordered by period ascending::

            {
                'period': 'YYYY-MM',
                'count': int,
                'ingresos': str,
                'egresos': str,
                'ajustes': str,
                'transferencias': str,
            }
        """
        qs = TreasuryMovementAnalyticsService._base_queryset(
            treasury_account=treasury_account,
            bank=bank,
            movement_type=movement_type,
            payment_method=payment_method,
            amount_min=amount_min,
            amount_max=amount_max,
            date_from=date_from,
            date_to=date_to,
            months=months,
        ).annotate(
            period=TreasuryMovementAnalyticsService._period_annotation(granularity),
            direction=TreasuryMovementAnalyticsService._direction_annotation(),
        )

        rows = (
            qs.values("period", "direction")
            .annotate(amount=Sum("amount"), count=Count("id"))
            .order_by("period", "direction")
        )

        buckets: dict[str, dict] = {}
        for row in rows:
            period = TreasuryMovementAnalyticsService._format_period(row["period"])
            bucket = buckets.setdefault(
                period,
                {
                    "period": period,
                    "count": 0,
                    "ingresos": Decimal("0"),
                    "egresos": Decimal("0"),
                    "ajustes": Decimal("0"),
                    "transferencias": Decimal("0"),
                },
            )
            bucket["count"] += row["count"]
            amount = row["amount"] or Decimal("0")
            direction = row["direction"]
            if direction == "IN":
                bucket["ingresos"] += amount
            elif direction == "OUT":
                bucket["egresos"] += amount
            elif direction == "ADJUSTMENT":
                bucket["ajustes"] += amount
            elif direction == "TRANSFER":
                bucket["transferencias"] += amount

        return [
            {
                "period": v["period"],
                "count": v["count"],
                "ingresos": str(v["ingresos"]),
                "egresos": str(v["egresos"]),
                "ajustes": str(v["ajustes"]),
                "transferencias": str(v["transferencias"]),
            }
            for v in buckets.values()
        ]

    @staticmethod
    def get_direction_distribution(
        months: int = 12,
        treasury_account: int | None = None,
        bank: int | None = None,
        movement_type: str | None = None,
        payment_method: str | None = None,
        amount_min: str | None = None,
        amount_max: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> list[dict]:
        """
        Movement count and amount grouped by direction.

        Returns::

            {
                'id': 'IN',
                'label': 'Ingresos',
                'count': int,
                'amount': str,
            }
        """
        qs = TreasuryMovementAnalyticsService._base_queryset(
            treasury_account=treasury_account,
            bank=bank,
            movement_type=movement_type,
            payment_method=payment_method,
            amount_min=amount_min,
            amount_max=amount_max,
            date_from=date_from,
            date_to=date_to,
            months=months,
        ).annotate(direction=TreasuryMovementAnalyticsService._direction_annotation())

        rows = (
            qs.values("direction")
            .annotate(amount=Sum("amount"), count=Count("id"))
        )

        by_key = {row["direction"]: row for row in rows}
        labels = dict(TreasuryMovementAnalyticsService.DIRECTIONS)
        result = []
        for key in TreasuryMovementAnalyticsService.DIRECTION_KEYS:
            row = by_key.get(key)
            result.append(
                {
                    "id": key,
                    "label": labels[key],
                    "count": row["count"] if row else 0,
                    "amount": str(row["amount"] or Decimal("0")) if row else "0",
                }
            )
        return result

    @staticmethod
    def get_account_distribution(
        limit: int = 10,
        months: int = 12,
        treasury_account: int | None = None,
        bank: int | None = None,
        movement_type: str | None = None,
        payment_method: str | None = None,
        amount_min: str | None = None,
        amount_max: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> list[dict]:
        """
        Top-N treasury accounts by movement count, with in/out amounts.

        Returns::

            {
                'id': int | None,
                'account_name': str,
                'count': int,
                'in': str,
                'out': str,
            }
        """
        qs = TreasuryMovementAnalyticsService._base_queryset(
            treasury_account=treasury_account,
            bank=bank,
            movement_type=movement_type,
            payment_method=payment_method,
            amount_min=amount_min,
            amount_max=amount_max,
            date_from=date_from,
            date_to=date_to,
            months=months,
        ).annotate(direction=TreasuryMovementAnalyticsService._direction_annotation())

        rows = (
            qs.annotate(
                treasury_account_id=TreasuryMovementAnalyticsService._account_expression(),
                account_name=TreasuryMovementAnalyticsService._account_name_expression(),
            )
            .values("treasury_account_id", "account_name")
            .annotate(
                count=Count("id"),
                in_amount=Sum("amount", filter=Q(direction="IN")),
                out_amount=Sum("amount", filter=Q(direction="OUT")),
            )
            .order_by("-count")[:limit]
        )

        return [
            {
                "id": row["treasury_account_id"],
                "account_name": row["account_name"] or "Sin cuenta",
                "count": row["count"],
                "in": str(row["in_amount"] or Decimal("0")),
                "out": str(row["out_amount"] or Decimal("0")),
            }
            for row in rows
        ]

    @staticmethod
    def get_payment_method_distribution(
        months: int = 12,
        treasury_account: int | None = None,
        bank: int | None = None,
        movement_type: str | None = None,
        payment_method: str | None = None,
        amount_min: str | None = None,
        amount_max: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> list[dict]:
        """
        Movement count and amount grouped by payment method.

        Returns::

            {
                'id': 'CASH',
                'label': 'Efectivo',
                'count': int,
                'amount': str,
            }
        """
        qs = TreasuryMovementAnalyticsService._base_queryset(
            treasury_account=treasury_account,
            bank=bank,
            movement_type=movement_type,
            payment_method=payment_method,
            amount_min=amount_min,
            amount_max=amount_max,
            date_from=date_from,
            date_to=date_to,
            months=months,
        )

        rows = (
            qs.values("payment_method")
            .annotate(amount=Sum("amount"), count=Count("id"))
        )

        by_key = {row["payment_method"]: row for row in rows}
        result = []
        for key, label in TreasuryMovement.Method.choices:
            row = by_key.get(key)
            result.append(
                {
                    "id": key,
                    "label": label,
                    "count": row["count"] if row else 0,
                    "amount": str(row["amount"] or Decimal("0")) if row else "0",
                }
            )
        return result

    @staticmethod
    def get_type_distribution(
        months: int = 12,
        treasury_account: int | None = None,
        bank: int | None = None,
        movement_type: str | None = None,
        payment_method: str | None = None,
        amount_min: str | None = None,
        amount_max: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> list[dict]:
        """
        Movement count and amount grouped by movement type.

        Returns::

            {
                'id': 'INBOUND',
                'label': 'Entrante (Cobro/Venta)',
                'count': int,
                'amount': str,
            }
        """
        qs = TreasuryMovementAnalyticsService._base_queryset(
            treasury_account=treasury_account,
            bank=bank,
            movement_type=movement_type,
            payment_method=payment_method,
            amount_min=amount_min,
            amount_max=amount_max,
            date_from=date_from,
            date_to=date_to,
            months=months,
        )

        rows = (
            qs.values("movement_type")
            .annotate(amount=Sum("amount"), count=Count("id"))
        )

        by_key = {row["movement_type"]: row for row in rows}
        result = []
        for key, label in TreasuryMovement.Type.choices:
            row = by_key.get(key)
            result.append(
                {
                    "id": key,
                    "label": label,
                    "count": row["count"] if row else 0,
                    "amount": str(row["amount"] or Decimal("0")) if row else "0",
                }
            )
        return result

    # ── Consolidated hub data ───────────────────────────────────

    @staticmethod
    def get_consolidated(
        granularity: str = "month",
        months: int = 12,
        treasury_account: int | None = None,
        bank: int | None = None,
        movement_type: str | None = None,
        payment_method: str | None = None,
        amount_min: str | None = None,
        amount_max: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> dict:
        """
        Single response aggregating all treasury-movement analytics dimensions
        for the analytics panel.

        Keys map to the 4 decision-oriented tabs:

            - flow_trend: period series (ingresos/egresos/ajustes/transferencias)
            - direction_distribution: IN/OUT/TRANSFER/ADJUSTMENT breakdown
            - account_distribution: top treasury accounts by count
            - payment_method_distribution: count/amount by payment method
            - type_distribution: count/amount by movement type
            - summary: top-level KPIs
        """
        if granularity not in ("day", "month", "year"):
            granularity = "month"

        flow_trend = TreasuryMovementAnalyticsService.get_flow_trend(
            granularity=granularity,
            months=months,
            treasury_account=treasury_account,
            bank=bank,
            movement_type=movement_type,
            payment_method=payment_method,
            amount_min=amount_min,
            amount_max=amount_max,
            date_from=date_from,
            date_to=date_to,
        )
        direction_distribution = TreasuryMovementAnalyticsService.get_direction_distribution(
            months=months,
            treasury_account=treasury_account,
            bank=bank,
            movement_type=movement_type,
            payment_method=payment_method,
            amount_min=amount_min,
            amount_max=amount_max,
            date_from=date_from,
            date_to=date_to,
        )
        account_distribution = TreasuryMovementAnalyticsService.get_account_distribution(
            limit=10,
            months=months,
            treasury_account=treasury_account,
            bank=bank,
            movement_type=movement_type,
            payment_method=payment_method,
            amount_min=amount_min,
            amount_max=amount_max,
            date_from=date_from,
            date_to=date_to,
        )
        payment_method_distribution = TreasuryMovementAnalyticsService.get_payment_method_distribution(
            months=months,
            treasury_account=treasury_account,
            bank=bank,
            movement_type=movement_type,
            payment_method=payment_method,
            amount_min=amount_min,
            amount_max=amount_max,
            date_from=date_from,
            date_to=date_to,
        )
        type_distribution = TreasuryMovementAnalyticsService.get_type_distribution(
            months=months,
            treasury_account=treasury_account,
            bank=bank,
            movement_type=movement_type,
            payment_method=payment_method,
            amount_min=amount_min,
            amount_max=amount_max,
            date_from=date_from,
            date_to=date_to,
        )

        by_key = {row["id"]: row for row in direction_distribution}
        ingresos = Decimal(by_key["IN"]["amount"])
        egresos = Decimal(by_key["OUT"]["amount"])
        ajustes = Decimal(by_key["ADJUSTMENT"]["amount"])

        return {
            "flow_trend": flow_trend,
            "direction_distribution": direction_distribution,
            "account_distribution": account_distribution,
            "payment_method_distribution": payment_method_distribution,
            "type_distribution": type_distribution,
            "summary": {
                "total_movements": sum(row["count"] for row in direction_distribution),
                "ingresos_count": by_key["IN"]["count"],
                "egresos_count": by_key["OUT"]["count"],
                "ingresos_amount": str(ingresos),
                "egresos_amount": str(egresos),
                "ajustes_amount": str(ajustes),
                "transfer_amount": str(Decimal(by_key["TRANSFER"]["amount"])),
                "net_flow": str(ingresos + ajustes - egresos),
            },
        }
