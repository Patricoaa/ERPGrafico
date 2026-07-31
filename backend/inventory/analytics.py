"""
analytics.py — Analytics & aggregated KPIs for the stock-moves (Kardex) view.

Provides decision-oriented metrics over StockMove rows:
  - Flow trend (entries / exits / adjustments / transfers by period).
  - Monetary value trend (quantity × unit_cost by period and direction).
  - Direction distribution (IN / OUT / ADJUSTMENT / TRANSFER / OTHER).
  - Top products (by quantity and by value).
  - Category distribution and location distribution.
  - Consolidated hub data (single response for the analytics panel).

All methods are read-only; no transactions or mutations.
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from typing import Any

from django.db.models import Case, CharField, Count, DecimalField, ExpressionWrapper, F, Q, Sum, Value, When
from django.db.models.functions import TruncDay, TruncMonth, TruncYear
from django.utils.timezone import now

from .models import StockMove


class StockMoveAnalyticsService:
    """Read-only analytics for inventory stock movements."""

    DIRECTIONS = (
        ("IN", "Entrada"),
        ("OUT", "Salida"),
        ("TRANSFER", "Transferencia"),
        ("ADJUSTMENT", "Ajuste"),
        ("OTHER", "Otros"),
    )

    DIRECTION_KEYS = ("IN", "OUT", "TRANSFER", "ADJUSTMENT", "OTHER")

    # Virtual locations that represent inventory adjustments (merma, sobrante, revalorización).
    _ADJUSTMENT_VIRTUAL_NAMES = (
        "Ajuste por Merma/Pérdida",
        "Ajuste por Sobrante/Ganancia",
        "Revalorización",
    )

    # ── Query building ──────────────────────────────────────────

    @staticmethod
    def _base_queryset(
        product_id: int | None = None,
        product_name: str | None = None,
        source_location_id: int | None = None,
        destination_location_id: int | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
        months: int = 12,
    ):
        """
        Base StockMove queryset applying shared filters.

        If ``date_from``/``date_to`` are provided they take precedence over the
        rolling ``months`` window.
        """
        qs = StockMove.objects.select_related(
            "product",
            "product__category",
            "source_location",
            "destination_location",
        )
        if product_id is not None:
            qs = qs.filter(product_id=product_id)
        if product_name:
            qs = qs.filter(product__name__icontains=product_name)
        if source_location_id is not None:
            qs = qs.filter(source_location_id=source_location_id)
        if destination_location_id is not None:
            qs = qs.filter(destination_location_id=destination_location_id)
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
        """Classifies each move into IN/OUT/TRANSFER/ADJUSTMENT/OTHER at DB level.

        Priority:
          - TRANSFER:   source and destination are both INTERNAL.
          - ADJUSTMENT: either side is a VIRTUAL adjustment location
                        (Merma/Pérdida, Sobrante/Ganancia, Revalorización).
          - IN:         destination is INTERNAL (not covered above).
          - OUT:        source is INTERNAL (not covered above).
          - OTHER:      fallback (virtual↔virtual, vendor↔customer, ...).
        """
        adjustment_names = StockMoveAnalyticsService._ADJUSTMENT_VIRTUAL_NAMES

        return Case(
            When(
                source_location__location_type="INTERNAL",
                destination_location__location_type="INTERNAL",
                then=Value("TRANSFER"),
            ),
            When(source_location__name__in=adjustment_names, then=Value("ADJUSTMENT")),
            When(destination_location__name__in=adjustment_names, then=Value("ADJUSTMENT")),
            When(destination_location__location_type="INTERNAL", then=Value("IN")),
            When(source_location__location_type="INTERNAL", then=Value("OUT")),
            default=Value("OTHER"),
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
    def _value_expression():
        return ExpressionWrapper(
            F("quantity") * F("unit_cost"),
            output_field=DecimalField(max_digits=14, decimal_places=2),
        )

    # ── Aggregations ────────────────────────────────────────────

    @staticmethod
    def get_flow_trend(
        granularity: str = "month",
        months: int = 12,
        product_id: int | None = None,
        product_name: str | None = None,
        source_location_id: int | None = None,
        destination_location_id: int | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> list[dict]:
        """
        Movements count + quantity by period and direction.

        Returns list ordered by period ascending::

            {
                'period': 'YYYY-MM',
                'count': int,
                'entradas': str,
                'salidas': str,
                'ajustes': str,
                'transferencias': str,
            }
        """
        qs = StockMoveAnalyticsService._base_queryset(
            product_id=product_id,
            product_name=product_name,
            source_location_id=source_location_id,
            destination_location_id=destination_location_id,
            date_from=date_from,
            date_to=date_to,
            months=months,
        ).annotate(
            period=StockMoveAnalyticsService._period_annotation(granularity),
            direction=StockMoveAnalyticsService._direction_annotation(),
        )

        rows = (
            qs.values("period", "direction")
            .annotate(
                quantity=Sum("quantity"),
                count=Count("id"),
            )
            .order_by("period", "direction")
        )

        buckets: dict[str, dict] = {}
        for row in rows:
            period = StockMoveAnalyticsService._format_period(row["period"])
            bucket = buckets.setdefault(
                period,
                {
                    "period": period,
                    "count": 0,
                    "entradas": Decimal("0"),
                    "salidas": Decimal("0"),
                    "ajustes": Decimal("0"),
                    "transferencias": Decimal("0"),
                },
            )
            bucket["count"] += row["count"]
            qty = row["quantity"] or Decimal("0")
            direction = row["direction"]
            if direction == "IN":
                bucket["entradas"] += qty
            elif direction == "OUT":
                bucket["salidas"] += qty
            elif direction == "ADJUSTMENT":
                bucket["ajustes"] += qty
            elif direction == "TRANSFER":
                bucket["transferencias"] += qty

        return [
            {
                "period": v["period"],
                "count": v["count"],
                "entradas": str(v["entradas"]),
                "salidas": str(v["salidas"]),
                "ajustes": str(v["ajustes"]),
                "transferencias": str(v["transferencias"]),
            }
            for v in buckets.values()
        ]

    @staticmethod
    def get_value_trend(
        granularity: str = "month",
        months: int = 12,
        product_id: int | None = None,
        product_name: str | None = None,
        source_location_id: int | None = None,
        destination_location_id: int | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> list[dict]:
        """
        Monetary value (quantity × unit_cost) by period and direction.

        Returns list ordered by period ascending::

            {
                'period': 'YYYY-MM',
                'entrada': str,
                'salida': str,
                'ajuste': str,
                'transferencia': str,
                'total': str,
            }
        """
        qs = StockMoveAnalyticsService._base_queryset(
            product_id=product_id,
            product_name=product_name,
            source_location_id=source_location_id,
            destination_location_id=destination_location_id,
            date_from=date_from,
            date_to=date_to,
            months=months,
        ).annotate(
            period=StockMoveAnalyticsService._period_annotation(granularity),
            direction=StockMoveAnalyticsService._direction_annotation(),
        )

        rows = (
            qs.annotate(value=StockMoveAnalyticsService._value_expression())
            .values("period", "direction")
            .annotate(total=Sum("value"))
            .order_by("period", "direction")
        )

        buckets: dict[str, dict] = {}
        for row in rows:
            period = StockMoveAnalyticsService._format_period(row["period"])
            bucket = buckets.setdefault(
                period,
                {
                    "period": period,
                    "entrada": Decimal("0"),
                    "salida": Decimal("0"),
                    "ajuste": Decimal("0"),
                    "transferencia": Decimal("0"),
                    "total": Decimal("0"),
                },
            )
            value = row["total"] or Decimal("0")
            direction = row["direction"]
            if direction == "IN":
                bucket["entrada"] += value
            elif direction == "OUT":
                bucket["salida"] += value
            elif direction == "ADJUSTMENT":
                bucket["ajuste"] += value
            elif direction == "TRANSFER":
                bucket["transferencia"] += value
            bucket["total"] += value

        return [
            {
                "period": v["period"],
                "entrada": str(v["entrada"]),
                "salida": str(v["salida"]),
                "ajuste": str(v["ajuste"]),
                "transferencia": str(v["transferencia"]),
                "total": str(v["total"]),
            }
            for v in buckets.values()
        ]

    @staticmethod
    def get_direction_distribution(
        months: int = 12,
        product_id: int | None = None,
        product_name: str | None = None,
        source_location_id: int | None = None,
        destination_location_id: int | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> list[dict]:
        """
        Movement count, quantity and value grouped by direction.

        Returns::

            {
                'id': 'IN',
                'label': 'Entrada',
                'count': int,
                'quantity': str,
                'amount': str,
            }
        """
        qs = StockMoveAnalyticsService._base_queryset(
            product_id=product_id,
            product_name=product_name,
            source_location_id=source_location_id,
            destination_location_id=destination_location_id,
            date_from=date_from,
            date_to=date_to,
            months=months,
        ).annotate(direction=StockMoveAnalyticsService._direction_annotation())

        rows = (
            qs.annotate(value=StockMoveAnalyticsService._value_expression())
            .values("direction")
            .annotate(
                quantity=Sum("quantity"),
                amount=Sum("value"),
                count=Count("id"),
            )
        )

        by_key = {row["direction"]: row for row in rows}
        labels = dict(StockMoveAnalyticsService.DIRECTIONS)
        result = []
        for key in StockMoveAnalyticsService.DIRECTION_KEYS:
            row = by_key.get(key)
            result.append(
                {
                    "id": key,
                    "label": labels[key],
                    "count": row["count"] if row else 0,
                    "quantity": str(row["quantity"] or Decimal("0")) if row else "0",
                    "amount": str(row["amount"] or Decimal("0")) if row else "0",
                }
            )
        return result

    @staticmethod
    def get_top_products(
        limit: int = 10,
        months: int = 12,
        product_id: int | None = None,
        product_name: str | None = None,
        source_location_id: int | None = None,
        destination_location_id: int | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> list[dict]:
        """
        Top-N products by total movement value.

        Returns::

            {
                'product_id': int,
                'product_name': str,
                'quantity': str,
                'amount': str,
            }
        """
        qs = StockMoveAnalyticsService._base_queryset(
            product_id=product_id,
            product_name=product_name,
            source_location_id=source_location_id,
            destination_location_id=destination_location_id,
            date_from=date_from,
            date_to=date_to,
            months=months,
        ).annotate(value=StockMoveAnalyticsService._value_expression())

        rows = (
            qs.values("product_id", "product__name")
            .annotate(
                quantity=Sum("quantity"),
                amount=Sum("value"),
            )
            .order_by("-amount")[:limit]
        )

        return [
            {
                "product_id": row["product_id"],
                "product_name": row["product__name"],
                "quantity": str(row["quantity"] or Decimal("0")),
                "amount": str(row["amount"] or Decimal("0")),
            }
            for row in rows
        ]

    @staticmethod
    def get_category_distribution(
        months: int = 12,
        product_id: int | None = None,
        product_name: str | None = None,
        source_location_id: int | None = None,
        destination_location_id: int | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> list[dict]:
        """
        Total movement value by product category.

        Returns::

            {
                'id': str,       # category name or 'Sin categoría'
                'value': float,
            }
        """
        qs = StockMoveAnalyticsService._base_queryset(
            product_id=product_id,
            product_name=product_name,
            source_location_id=source_location_id,
            destination_location_id=destination_location_id,
            date_from=date_from,
            date_to=date_to,
            months=months,
        ).annotate(value=StockMoveAnalyticsService._value_expression())

        rows = (
            qs.values("product__category__name")
            .annotate(total=Sum("value"))
            .order_by("-total")
        )

        return [
            {
                "id": row["product__category__name"] or "Sin categoría",
                "value": float(row["total"] or Decimal("0")),
            }
            for row in rows
        ]

    @staticmethod
    def get_location_distribution(
        limit: int = 10,
        months: int = 12,
        product_id: int | None = None,
        product_name: str | None = None,
        source_location_id: int | None = None,
        destination_location_id: int | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> list[dict]:
        """
        Top-N warehouses/locations by movement count (both source and destination).

        Returns::

            {
                'id': str,
                'value': int,     # movement count
                'in': int,        # inbound movements
                'out': int,       # outbound movements
            }
        """
        qs = StockMoveAnalyticsService._base_queryset(
            product_id=product_id,
            product_name=product_name,
            source_location_id=source_location_id,
            destination_location_id=destination_location_id,
            date_from=date_from,
            date_to=date_to,
            months=months,
        )

        internal_name = Case(
            When(source_location__location_type="INTERNAL", then="source_location__name"),
            When(destination_location__location_type="INTERNAL", then="destination_location__name"),
            default=Value("Otras ubicaciones"),
            output_field=CharField(),
        )

        rows = (
            qs.annotate(location_name=internal_name)
            .values("location_name")
            .annotate(
                count=Count("id"),
                inbound=Count("id", filter=Q(destination_location__location_type="INTERNAL")),
                outbound=Count("id", filter=Q(source_location__location_type="INTERNAL")),
            )
            .order_by("-count")[:limit]
        )

        return [
            {
                "id": row["location_name"] or "Sin ubicación",
                "value": row["count"],
                "in": row["inbound"],
                "out": row["outbound"],
            }
            for row in rows
        ]

    # ── Consolidated hub data ───────────────────────────────────

    @staticmethod
    def get_consolidated(
        granularity: str = "month",
        months: int = 12,
        product_id: int | None = None,
        product_name: str | None = None,
        source_location_id: int | None = None,
        destination_location_id: int | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> dict:
        """
        Single response aggregating all stock-move analytics dimensions for
        the Kardex analytics panel.

        Keys map to the 4 decision-oriented tabs:

            - flow_trend: period series (entradas/salidas/ajustes/transferencias)
            - value_trend: monetary value period series by direction
            - direction_distribution: IN/OUT/TRANSFER/ADJUSTMENT/OTHER breakdown
            - top_products: top-N products by value
            - category_distribution: value by product category
            - location_distribution: top warehouses/locations by count
            - summary: top-level KPIs
        """
        if granularity not in ("day", "month", "year"):
            granularity = "month"

        flow_trend = StockMoveAnalyticsService.get_flow_trend(
            granularity=granularity,
            months=months,
            product_id=product_id,
            product_name=product_name,
            source_location_id=source_location_id,
            destination_location_id=destination_location_id,
            date_from=date_from,
            date_to=date_to,
        )
        value_trend = StockMoveAnalyticsService.get_value_trend(
            granularity=granularity,
            months=months,
            product_id=product_id,
            product_name=product_name,
            source_location_id=source_location_id,
            destination_location_id=destination_location_id,
            date_from=date_from,
            date_to=date_to,
        )
        direction_distribution = StockMoveAnalyticsService.get_direction_distribution(
            months=months,
            product_id=product_id,
            product_name=product_name,
            source_location_id=source_location_id,
            destination_location_id=destination_location_id,
            date_from=date_from,
            date_to=date_to,
        )
        top_products = StockMoveAnalyticsService.get_top_products(
            limit=10,
            months=months,
            product_id=product_id,
            product_name=product_name,
            source_location_id=source_location_id,
            destination_location_id=destination_location_id,
            date_from=date_from,
            date_to=date_to,
        )
        category_distribution = StockMoveAnalyticsService.get_category_distribution(
            months=months,
            product_id=product_id,
            product_name=product_name,
            source_location_id=source_location_id,
            destination_location_id=destination_location_id,
            date_from=date_from,
            date_to=date_to,
        )
        location_distribution = StockMoveAnalyticsService.get_location_distribution(
            limit=10,
            months=months,
            product_id=product_id,
            product_name=product_name,
            source_location_id=source_location_id,
            destination_location_id=destination_location_id,
            date_from=date_from,
            date_to=date_to,
        )

        by_key = {row["id"]: row for row in direction_distribution}
        total_value = sum(Decimal(row["amount"]) for row in direction_distribution)

        return {
            "flow_trend": flow_trend,
            "value_trend": value_trend,
            "direction_distribution": direction_distribution,
            "top_products": top_products,
            "category_distribution": category_distribution,
            "location_distribution": location_distribution,
            "summary": {
                "total_movements": sum(row["count"] for row in direction_distribution),
                "total_in_qty": by_key["IN"]["quantity"],
                "total_out_qty": by_key["OUT"]["quantity"],
                "total_adjustment_qty": by_key["ADJUSTMENT"]["quantity"],
                "total_value": str(total_value),
            },
        }
