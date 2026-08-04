"""
product_analytics.py — Analytics & aggregated KPIs for the products catalog.

Provides decision-oriented metrics over Product rows plus their current stock:

  - Catalog type distribution (STORABLE / CONSUMABLE / SERVICE / MANUFACTURABLE / SUBSCRIPTION).
  - Availability distribution (sellable × purchasable combos).
  - Catalog category distribution (top categories by product count).
  - Price-range distribution (histogram over ``sale_price`` or ``cost_price``,
    selected via ``price_field`` on the consolidated endpoint).
  - Status distribution (active vs archived).
  - Stock summary KPIs (total products, with stock, out-of-stock, units, value).

Stock value = ``Sum(Stock.quantity) × Product.cost_price`` (current snapshot; products
have no temporal dimension, so the analytics panel omits the granularity control).

Only products with ``track_inventory=True`` participate in stock aggregates; the rest
contribute 0 and are excluded from the stock KPIs to keep "agotados" meaningful.

All methods are read-only; no transactions or mutations.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.db.models import (
    Case,
    CharField,
    Count,
    DecimalField,
    ExpressionWrapper,
    F,
    Q,
    Sum,
    Value,
    When,
)
from django.db.models.functions import Coalesce

from .models import Product

PRICE_RANGES = (
    (0, 10_000, "0 – 10.000"),
    (10_000, 50_000, "10.000 – 50.000"),
    (50_000, 100_000, "50.000 – 100.000"),
    (100_000, 500_000, "100.000 – 500.000"),
    (500_000, 1_000_000, "500.000 – 1.000.000"),
    (1_000_000, None, "> 1.000.000"),
)

PRICE_FIELDS = {
    "sale": "sale_price",
    "cost": "cost_price",
}

AVAILABILITY_BUCKETS = (
    (True, True, "Venta y compra"),
    (True, False, "Solo venta"),
    (False, True, "Solo compra"),
    (False, False, "Sin disponibilidad"),
)


class ProductAnalyticsService:
    """Read-only analytics for the products catalog and its current stock."""

    PRODUCT_TYPE_LABELS = {code: label for code, label in Product.Type.choices}

    # ── Query building ──────────────────────────────────────────

    @staticmethod
    def _base_queryset(
        search: str | None = None,
        category_id: int | None = None,
        product_type: str | None = None,
        can_be_sold: bool | None = None,
        can_be_purchased: bool | None = None,
        is_active: bool | None = True,
        include_variants: bool = False,
    ):
        """
        Base Product queryset applying shared filters (mirrors the unified search
        params used by the products list view).
        """
        qs = Product.objects.select_related("category")
        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(code__icontains=search)
                | Q(internal_code__icontains=search)
            )
        if category_id is not None:
            qs = qs.filter(category_id=category_id)
        if product_type:
            qs = qs.filter(product_type=product_type)
        if can_be_sold is not None:
            qs = qs.filter(can_be_sold=can_be_sold)
        if can_be_purchased is not None:
            qs = qs.filter(can_be_purchased=can_be_purchased)
        if is_active is not None:
            qs = qs.filter(is_active=is_active)
        if not include_variants:
            qs = qs.filter(parent_template__isnull=True)
        return qs

    @staticmethod
    def _stock_queryset(qs):
        """
        Annotates each product with its total on-hand stock (across warehouses)
        and its monetary stock value (stock × weighted cost).
        """
        return qs.filter(track_inventory=True).annotate(
            stock_qty=Coalesce(Sum("stocks__quantity"), Value(0, output_field=DecimalField())),
        ).annotate(
            stock_value=ExpressionWrapper(
                F("stock_qty") * F("cost_price"),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            ),
        )

    @staticmethod
    def _price_bucket_annotation(price_field: str = "sale_price") -> Case:
        """Classifies each product's ``price_field`` into a fixed bucket at DB level."""
        whens = []
        for low, high, label in PRICE_RANGES:
            if high is None:
                continue
            whens.append(
                When(
                    Q(**{f"{price_field}__gte": low}) & Q(**{f"{price_field}__lt": high}),
                    then=Value(label),
                )
            )
        return Case(*whens, default=Value(PRICE_RANGES[-1][2]), output_field=CharField())

    @staticmethod
    def _stock_value_expression():
        return ExpressionWrapper(
            F("stocks__quantity") * F("cost_price"),
            output_field=DecimalField(max_digits=14, decimal_places=2),
        )

    # ── Aggregations ────────────────────────────────────────────

    @staticmethod
    def get_catalog_type_distribution(
        search: str | None = None,
        category_id: int | None = None,
        product_type: str | None = None,
        can_be_sold: bool | None = None,
        can_be_purchased: bool | None = None,
        is_active: bool | None = True,
    ) -> list[dict]:
        """Product count by ``product_type``, descending."""
        qs = ProductAnalyticsService._base_queryset(
            search=search,
            category_id=category_id,
            product_type=product_type,
            can_be_sold=can_be_sold,
            can_be_purchased=can_be_purchased,
            is_active=is_active,
        )
        rows = (
            qs.values("product_type")
            .annotate(value=Count("id"))
            .order_by("-value", "product_type")
        )
        return [
            {
                "id": row["product_type"],
                "label": ProductAnalyticsService.PRODUCT_TYPE_LABELS.get(
                    row["product_type"], row["product_type"]
                ),
                "value": row["value"],
            }
            for row in rows
        ]

    @staticmethod
    def get_availability_distribution(
        search: str | None = None,
        category_id: int | None = None,
        product_type: str | None = None,
        can_be_sold: bool | None = None,
        can_be_purchased: bool | None = None,
        is_active: bool | None = True,
    ) -> list[dict]:
        """Product count per sellable × purchasable combo, in canonical order."""
        qs = ProductAnalyticsService._base_queryset(
            search=search,
            category_id=category_id,
            product_type=product_type,
            can_be_sold=can_be_sold,
            can_be_purchased=can_be_purchased,
            is_active=is_active,
        )
        rows = qs.values("can_be_sold", "can_be_purchased").annotate(value=Count("id"))
        by_combo = {(row["can_be_sold"], row["can_be_purchased"]): row["value"] for row in rows}
        return [
            {"id": label, "label": label, "value": by_combo.get((sold, purch), 0)}
            for sold, purch, label in AVAILABILITY_BUCKETS
        ]

    @staticmethod
    def get_catalog_category_distribution(
        limit: int = 8,
        search: str | None = None,
        category_id: int | None = None,
        product_type: str | None = None,
        can_be_sold: bool | None = None,
        can_be_purchased: bool | None = None,
        is_active: bool | None = True,
    ) -> list[dict]:
        """Top categories by product count, descending."""
        qs = ProductAnalyticsService._base_queryset(
            search=search,
            category_id=category_id,
            product_type=product_type,
            can_be_sold=can_be_sold,
            can_be_purchased=can_be_purchased,
            is_active=is_active,
        )
        rows = (
            qs.values("category__name")
            .annotate(value=Count("id"))
            .order_by("-value")[:limit]
        )
        return [{"id": row["category__name"], "value": row["value"]} for row in rows]

    @staticmethod
    def get_price_range_distribution(
        price_field: str = "sale_price",
        search: str | None = None,
        category_id: int | None = None,
        product_type: str | None = None,
        can_be_sold: bool | None = None,
        can_be_purchased: bool | None = None,
        is_active: bool | None = True,
    ) -> list[dict]:
        """Histogram of ``price_field`` buckets, in canonical bucket order."""
        qs = ProductAnalyticsService._base_queryset(
            search=search,
            category_id=category_id,
            product_type=product_type,
            can_be_sold=can_be_sold,
            can_be_purchased=can_be_purchased,
            is_active=is_active,
        )
        rows = (
            qs.annotate(bucket=ProductAnalyticsService._price_bucket_annotation(price_field))
            .values("bucket")
            .annotate(value=Count("id"))
        )
        by_bucket = {row["bucket"]: row["value"] for row in rows}
        return [
            {"id": label, "value": by_bucket.get(label, 0)} for _, _, label in PRICE_RANGES
        ]

    @staticmethod
    def get_status_distribution(
        search: str | None = None,
        category_id: int | None = None,
        product_type: str | None = None,
        can_be_sold: bool | None = None,
        can_be_purchased: bool | None = None,
        is_active: bool | None = True,
    ) -> list[dict]:
        """Active vs archived product counts (respects the active filter)."""
        qs = ProductAnalyticsService._base_queryset(
            search=search,
            category_id=category_id,
            product_type=product_type,
            can_be_sold=can_be_sold,
            can_be_purchased=can_be_purchased,
            is_active=is_active,
        )
        rows = qs.values("is_active").annotate(value=Count("id"))
        labels = {True: "activos", False: "archivados"}
        return [{"id": labels[row["is_active"]], "value": row["value"]} for row in rows]

    @staticmethod
    def get_stock_summary(
        search: str | None = None,
        category_id: int | None = None,
        product_type: str | None = None,
        can_be_sold: bool | None = None,
        can_be_purchased: bool | None = None,
        is_active: bool | None = True,
    ) -> dict:
        """Top-level stock KPIs over trackable products."""
        base = ProductAnalyticsService._base_queryset(
            search=search,
            category_id=category_id,
            product_type=product_type,
            can_be_sold=can_be_sold,
            can_be_purchased=can_be_purchased,
            is_active=is_active,
        )
        total_products = base.count()
        stocked = ProductAnalyticsService._stock_queryset(base)
        agg = stocked.aggregate(
            total_units=Coalesce(Sum("stock_qty"), Value(0, output_field=DecimalField())),
            total_value=Coalesce(Sum("stock_value"), Value(0, output_field=DecimalField())),
            with_stock=Count("id", filter=Q(stock_qty__gt=0), distinct=True),
            out_of_stock=Count("id", filter=Q(stock_qty__lte=0), distinct=True),
        )
        return {
            "total_products": total_products,
            "total_units": str(agg["total_units"]),
            "total_value": str(agg["total_value"]),
            "with_stock": agg["with_stock"],
            "out_of_stock": agg["out_of_stock"],
        }

    @staticmethod
    def get_consolidated(
        search: str | None = None,
        category_id: int | None = None,
        product_type: str | None = None,
        can_be_sold: bool | None = None,
        can_be_purchased: bool | None = None,
        is_active: bool | None = True,
        price_field: str = "sale",
    ) -> dict:
        """
        Single response aggregating all product-analytics dimensions for the
        analytics panel.

        ``price_field`` selects which price is bucketed by the
        ``price_range_distribution`` histogram: ``"sale"`` (sale_price) or
        ``"cost"`` (cost_price). Defaults to ``"sale"``.

        Keys map to the 3 decision-oriented tabs:

            - catalog_type_distribution: product count by type
            - availability_distribution: sellable × purchasable combos
            - catalog_category_distribution: top categories by count
            - price_range_distribution: price histogram (sale or cost)
            - status_distribution: active vs archived
            - summary: top-level KPIs
        """
        is_active_parsed = is_active
        if is_active == "all":
            is_active_parsed = None
        elif is_active in ("true", "false"):
            is_active_parsed = is_active == "true"
        else:
            is_active_parsed = True if is_active is None else is_active

        def _bools(value: Any) -> bool | None:
            if value is None:
                return None
            return str(value).lower() == "true"

        price_field = PRICE_FIELDS.get(price_field, PRICE_FIELDS["sale"])

        return {
            "catalog_type_distribution": ProductAnalyticsService.get_catalog_type_distribution(
                search=search,
                category_id=category_id,
                product_type=product_type,
                can_be_sold=_bools(can_be_sold),
                can_be_purchased=_bools(can_be_purchased),
                is_active=is_active_parsed,
            ),
            "availability_distribution": ProductAnalyticsService.get_availability_distribution(
                search=search,
                category_id=category_id,
                product_type=product_type,
                can_be_sold=_bools(can_be_sold),
                can_be_purchased=_bools(can_be_purchased),
                is_active=is_active_parsed,
            ),
            "catalog_category_distribution": ProductAnalyticsService.get_catalog_category_distribution(
                search=search,
                category_id=category_id,
                product_type=product_type,
                can_be_sold=_bools(can_be_sold),
                can_be_purchased=_bools(can_be_purchased),
                is_active=is_active_parsed,
            ),
            "price_range_distribution": ProductAnalyticsService.get_price_range_distribution(
                price_field=price_field,
                search=search,
                category_id=category_id,
                product_type=product_type,
                can_be_sold=_bools(can_be_sold),
                can_be_purchased=_bools(can_be_purchased),
                is_active=is_active_parsed,
            ),
            "status_distribution": ProductAnalyticsService.get_status_distribution(
                search=search,
                category_id=category_id,
                product_type=product_type,
                can_be_sold=_bools(can_be_sold),
                can_be_purchased=_bools(can_be_purchased),
                is_active=is_active_parsed,
            ),
            "summary": ProductAnalyticsService.get_stock_summary(
                search=search,
                category_id=category_id,
                product_type=product_type,
                can_be_sold=_bools(can_be_sold),
                can_be_purchased=_bools(can_be_purchased),
                is_active=is_active_parsed,
            ),
        }
