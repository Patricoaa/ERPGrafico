from django.db.models import (
    BooleanField,
    Count,
    Exists,
    IntegerField,
    OuterRef,
    Prefetch,
    QuerySet,
    Subquery,
    Sum,
    Value,
)
from django.db.models.functions import Coalesce

from .models import Product, ProductFavorite


def list_products(*, user, params: dict) -> QuerySet:
    """
    Main product list queryset. Handles:
    - favorites annotation (per user)
    - active/archived filtering
    - variant vs template filtering
    - BOM prefetch for stock planning
    - popularity sort (POS)
    """
    from production.models import BillOfMaterials, BillOfMaterialsLine

    queryset = Product.objects.select_related(
        "category",
        "uom",
        "sale_uom",
        "purchase_uom",
        "receiving_warehouse",
        "preferred_supplier",
        "subscription_supplier",
    ).prefetch_related(
        "attribute_values",
        "attribute_values__attribute",
        "allowed_sale_uoms",
        "product_custom_fields",
        "attachments",
        Prefetch("variants", queryset=Product.objects.filter(active=True).select_related("uom").prefetch_related("attribute_values", "attribute_values__attribute"))
    ).annotate(
        annotated_current_stock=Sum("stock_moves__quantity"),
        variants_count=Count("variants"),
    )

    if user and user.is_authenticated:
        queryset = queryset.annotate(
            is_favorite=Exists(
                ProductFavorite.objects.filter(user=user, product=OuterRef("id"))
            )
        )
    else:
        queryset = queryset.annotate(
            is_favorite=Value(False, output_field=BooleanField())
        )

    active_param = params.get("active")
    if active_param == "all":
        pass
    elif active_param == "false":
        queryset = queryset.filter(active=False)
    else:
        queryset = queryset.filter(active=True)

    # Variant visibility
    if "parent_template__isnull" not in params and "parent_template" not in params:
        show_technical = params.get("show_technical_variants", "false") == "true"
        if not show_technical:
            queryset = queryset.filter(parent_template__isnull=True)

    if params.get("exclude_variant_templates", "false") == "true":
        queryset = queryset.filter(has_variants=False)

    # BOM prefetch for stock planning UI
    bom_qs = BillOfMaterials.objects.filter(active=True).prefetch_related(
        Prefetch(
            "lines",
            queryset=BillOfMaterialsLine.objects.select_related("uom").prefetch_related(
                Prefetch(
                    "component",
                    queryset=Product.objects.annotate(
                        annotated_current_stock=Sum("stock_moves__quantity")
                    ).select_related("uom"),
                )
            ),
        )
    )
    queryset = queryset.prefetch_related(Prefetch("boms", queryset=bom_qs))

    # Sorting
    if params.get("sort") == "popular":
        from django.db.models import Q
        from sales.models import SaleOrder, SaleLine

        sales_subquery = (
            SaleLine.objects.filter(
                product=OuterRef("id"),
                order__status__in=[
                    SaleOrder.Status.CONFIRMED,
                    SaleOrder.Status.INVOICED,
                    SaleOrder.Status.PAID,
                ],
            )
            .values("product")
            .annotate(count=Count("id"))
            .values("count")
        )
        queryset = queryset.annotate(
            sales_count=Coalesce(
                Subquery(sales_subquery), Value(0), output_field=IntegerField()
            )
        ).order_by("-is_favorite", "-sales_count", "name")
    else:
        queryset = queryset.order_by("-is_favorite", "-id")

    return queryset


def get_product_base_queryset(*, user) -> QuerySet:
    """
    Fully annotated queryset with no active filter.
    Used for detail/update/delete so archived products are accessible.
    """
    queryset = Product.objects.select_related(
        "category",
        "uom",
        "sale_uom",
        "purchase_uom",
        "receiving_warehouse",
        "preferred_supplier",
        "subscription_supplier",
    ).prefetch_related(
        "attribute_values",
        "attribute_values__attribute",
        "allowed_sale_uoms",
        "product_custom_fields",
        "attachments",
        Prefetch("variants", queryset=Product.objects.filter(active=True).select_related("uom").prefetch_related("attribute_values", "attribute_values__attribute"))
    ).annotate(
        annotated_current_stock=Sum("stock_moves__quantity"),
        variants_count=Count("variants"),
    )

    if user and user.is_authenticated:
        queryset = queryset.annotate(
            is_favorite=Exists(
                ProductFavorite.objects.filter(user=user, product=OuterRef("id"))
            )
        )
    else:
        queryset = queryset.annotate(
            is_favorite=Value(False, output_field=BooleanField())
        )

    return queryset


def get_stock_report_data() -> list[dict]:
    """
    Raw stock report: one dict per trackable product.
    Called by stock_report action; result is Redis-cached upstream.
    """
    from decimal import Decimal
    from django.db.models import Q

    products = Product.objects.filter(
        Q(product_type__in=[Product.Type.STORABLE, Product.Type.CONSUMABLE])
        | Q(product_type=Product.Type.MANUFACTURABLE, track_inventory=True)
        | Q(
            product_type=Product.Type.MANUFACTURABLE,
            requires_advanced_manufacturing=False,
            mfg_auto_finalize=False,
        )
    ).select_related("category")

    report = []
    for p in products:
        stock_qty = p.stock_moves.aggregate(total=Sum("quantity"))["total"] or 0
        moves_in = (
            p.stock_moves.filter(quantity__gt=0).aggregate(total=Sum("quantity"))["total"] or 0
        )
        moves_out = abs(
            p.stock_moves.filter(quantity__lt=0).aggregate(total=Sum("quantity"))["total"] or 0
        )
        unit_cost = float(p.cost_price) if stock_qty > 0 else 0.0
        total_value = float(stock_qty * Decimal(str(unit_cost)))

        report.append(
            {
                "id": p.id,
                "code": p.code,
                "internal_code": p.internal_code,
                "name": p.name,
                "category_name": p.category.name,
                "uom_id": p.uom.id if p.uom else None,
                "uom_category_id": p.uom.category_id if p.uom else None,
                "uom_name": p.uom.name if p.uom else "",
                "stock_qty": float(stock_qty),
                "unit_cost": unit_cost,
                "total_value": total_value,
                "moves_in": float(moves_in),
                "moves_out": float(moves_out),
                "qty_reserved": float(p.qty_reserved),
                "qty_available": float(p.qty_available),
            }
        )
    return report
