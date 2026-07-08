from django.db.models import (
    BooleanField,
    Count,
    DecimalField,
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

    queryset = (
        Product.objects.select_related(
            "category",
            "uom",
            "sale_uom",
            "purchase_uom",
            "parent_template",
            "receiving_warehouse",
            "preferred_supplier",
            "subscription_supplier",
        )
        .prefetch_related(
            "attribute_values",
            "attribute_values__attribute",
            "allowed_sale_uoms",
            "attachments",
            Prefetch(
                "variants",
                queryset=Product.objects.filter(is_active=True)
                .select_related("uom")
                .prefetch_related("attribute_values", "attribute_values__attribute"),
            ),
        )
        .annotate(
            annotated_current_stock=Sum("stock_moves__quantity"),
            variants_count=Count("variants"),
        )
    )

    # Último precio de compra: Subquery O(1) para evitar N+1 en get_last_purchase_price
    from purchasing.models import PurchaseLine

    last_purchase_qs = (
        PurchaseLine.objects.filter(product=OuterRef("pk"))
        .order_by("-order__date", "-id")
        .values("unit_cost")[:1]
    )
    queryset = queryset.annotate(
        annotated_last_purchase_price=Subquery(
            last_purchase_qs,
            output_field=DecimalField(max_digits=14, decimal_places=4),
        )
    )

    if user and user.is_authenticated:
        queryset = queryset.annotate(
            is_favorite=Exists(ProductFavorite.objects.filter(user=user, product=OuterRef("id")))
        )
    else:
        queryset = queryset.annotate(is_favorite=Value(False, output_field=BooleanField()))

    active_param = params.get("is_active")
    if active_param == "all":
        pass
    elif active_param == "false":
        queryset = queryset.filter(is_active=False)
    else:
        queryset = queryset.filter(is_active=True)

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
        from sales.models import SaleLine, SaleOrder

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
            sales_count=Coalesce(Subquery(sales_subquery), Value(0), output_field=IntegerField())
        ).order_by("-is_favorite", "-sales_count", "name")
    else:
        queryset = queryset.order_by("-is_favorite", "-id")

    return queryset


def get_product_base_queryset(*, user) -> QuerySet:
    """
    Fully annotated queryset with no active filter.
    Used for detail/update/delete so archived products are accessible.
    """
    queryset = (
        Product.objects.select_related(
            "category",
            "uom",
            "sale_uom",
            "purchase_uom",
            "parent_template",
            "receiving_warehouse",
            "preferred_supplier",
            "subscription_supplier",
        )
        .prefetch_related(
            "attribute_values",
            "attribute_values__attribute",
            "allowed_sale_uoms",
            "attachments",
            Prefetch(
                "variants",
                queryset=Product.objects.filter(is_active=True)
                .select_related("uom")
                .prefetch_related("attribute_values", "attribute_values__attribute"),
            ),
        )
        .annotate(
            annotated_current_stock=Sum("stock_moves__quantity"),
            variants_count=Count("variants"),
        )
    )

    # Último precio de compra para que no haga N+1 en vistas de detalle
    from purchasing.models import PurchaseLine

    last_purchase_qs = (
        PurchaseLine.objects.filter(product=OuterRef("pk"))
        .order_by("-order__date", "-id")
        .values("unit_cost")[:1]
    )
    queryset = queryset.annotate(
        annotated_last_purchase_price=Subquery(
            last_purchase_qs,
            output_field=DecimalField(max_digits=14, decimal_places=4),
        )
    )

    if user and user.is_authenticated:
        queryset = queryset.annotate(
            is_favorite=Exists(ProductFavorite.objects.filter(user=user, product=OuterRef("id")))
        )
    else:
        queryset = queryset.annotate(is_favorite=Value(False, output_field=BooleanField()))

    return queryset


def get_stock_report_data(warehouse_id: int | None = None) -> list[dict]:
    """
    Raw stock report: one dict per trackable product.
    Called by stock_report action; result is Redis-cached upstream.
    When warehouse_id is provided, quantities are scoped to that warehouse.
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
        if warehouse_id:
            moves_qs = p.stock_moves.filter(warehouse_id=warehouse_id)
            moves_in_qs = moves_qs.filter(quantity__gt=0)
            moves_out_qs = moves_qs.filter(quantity__lt=0)
        else:
            moves_qs = p.stock_moves.all()
            moves_in_qs = p.stock_moves.filter(quantity__gt=0)
            moves_out_qs = p.stock_moves.filter(quantity__lt=0)

        stock_qty = moves_qs.aggregate(total=Sum("quantity"))["total"] or 0
        moves_in = moves_in_qs.aggregate(total=Sum("quantity"))["total"] or 0
        moves_out = abs(moves_out_qs.aggregate(total=Sum("quantity"))["total"] or 0)

        qty_reserved = float(p.qty_reserved)
        unit_cost = float(p.cost_price) if stock_qty > 0 else 0.0
        total_value = float(stock_qty * Decimal(str(unit_cost)))
        qty_available = float(stock_qty) - qty_reserved

        report.append(
            {
                "id": p.id,
                "code": p.code,
                "internal_code": p.internal_code,
                "name": p.name,
                "category_id": p.category_id,
                "category_name": p.category.name,
                "uom_id": p.uom.id if p.uom else None,
                "uom_category_id": p.uom.category_id if p.uom else None,
                "uom_name": p.uom.name if p.uom else "",
                "stock_qty": float(stock_qty),
                "unit_cost": unit_cost,
                "total_value": total_value,
                "moves_in": float(moves_in),
                "moves_out": float(moves_out),
                "qty_reserved": qty_reserved,
                "qty_available": qty_available,
            }
        )
    return report


class ProductSelector:
    @staticmethod
    def filter_suggestions(q: str) -> list[str]:
        from .models import Product

        names = (
            Product.objects.filter(is_active=True, name__icontains=q)
            .values_list("name", flat=True)
            .distinct()
            .order_by("name")[:10]
        )
        return list(names)

    @staticmethod
    def get_insights(instance: Product) -> dict:
        product_ids = [instance.id]
        if instance.has_variants:
            product_ids += list(instance.variants.values_list("id", flat=True))

        history = instance.history.select_related("history_user").all().order_by("history_date")
        price_history = []
        last_sale = None
        last_cost = None
        for h in history:
            if h.sale_price != last_sale or h.cost_price != last_cost:
                price_history.append(
                    {
                        "date": h.history_date.date().isoformat(),
                        "sale_price": float(h.sale_price),
                        "cost_price": float(h.cost_price),
                        "user": h.history_user.username if h.history_user else "System",
                    }
                )
                last_sale = h.sale_price
                last_cost = h.cost_price
        price_history.reverse()

        from inventory.models import StockMove

        moves = (
            StockMove.objects.filter(product_id__in=product_ids)
            .select_related("warehouse", "uom", "product")
            .prefetch_related(
                "sale_delivery_line",
                "purchase_receipt_line",
                "sale_return_line",
                "purchase_return_line",
            )
            .all()
            .order_by("-date", "-id")[:100]
        )

        kardex = []
        for m in moves:
            unit_price = float(m.unit_cost or 0)

            if unit_price == 0 or m.move_type == "OUT":
                if hasattr(m, "purchase_receipt_line") and m.purchase_receipt_line:
                    unit_price = float(m.purchase_receipt_line.unit_cost)
                elif hasattr(m, "sale_delivery_line") and m.sale_delivery_line:
                    unit_price = float(m.sale_delivery_line.unit_price)
                elif hasattr(m, "sale_return_line") and m.sale_return_line:
                    unit_price = float(m.sale_return_line.unit_price)
                elif hasattr(m, "purchase_return_line") and m.purchase_return_line:
                    unit_price = float(m.purchase_return_line.unit_cost)

            if unit_price == 0 and m.unit_cost:
                unit_price = float(m.unit_cost)

            if unit_price == 0:
                unit_price = float(m.product.cost_price)

            description = m.description
            if instance.has_variants and m.product_id != instance.id:
                variant_name = m.product.variant_display_name or m.product.name
                description = f"[{variant_name}] {description}"

            display_id = m.display_id
            related_id = m.id
            related_type = "inventory"

            if hasattr(m, "sale_delivery_line") and m.sale_delivery_line:
                display_id = m.sale_delivery_line.delivery.display_id
                related_id = m.sale_delivery_line.delivery.id
                related_type = "sale_delivery"
            elif hasattr(m, "purchase_receipt_line") and m.purchase_receipt_line:
                display_id = m.purchase_receipt_line.receipt.display_id
                related_id = m.purchase_receipt_line.receipt.id
                related_type = "purchase_receipt"
            elif hasattr(m, "sale_return_line") and m.sale_return_line:
                from core.prefix_registry import EntityPrefix
                display_id = f"{EntityPrefix.SALE_RETURN}-{m.sale_return_line.return_doc.number}"
                related_id = m.sale_return_line.return_doc.id
                related_type = "sale_return"
            elif hasattr(m, "purchase_return_line") and m.purchase_return_line:
                from core.prefix_registry import EntityPrefix
                display_id = f"{EntityPrefix.PURCHASE_RETURN}-{m.purchase_return_line.return_doc.number}"
                related_id = m.purchase_return_line.return_doc.id
                related_type = "purchase_return"

            kardex.append(
                {
                    "id": m.id,
                    "display_id": display_id,
                    "related_id": related_id,
                    "related_type": related_type,
                    "date": m.date,
                    "type": m.move_type,
                    "quantity": float(m.quantity),
                    "unit_price": unit_price,
                    "total_price": abs(float(m.quantity) * unit_price),
                    "warehouse": m.warehouse.name,
                    "description": description,
                    "uom": m.uom.name if m.uom else "",
                }
            )

        from django.db import models
        from django.db.models import Avg, F, Sum
        from sales.models import SaleDeliveryLine, SaleReturnLine

        delivery_stats = SaleDeliveryLine.objects.filter(
            product_id__in=product_ids, delivery__status="CONFIRMED"
        ).aggregate(
            avg_price=Avg("unit_price", filter=models.Q(unit_price__gt=0)),
            avg_cost=Avg("unit_cost", filter=models.Q(unit_cost__gt=0)),
            total_qty=Sum("quantity"),
            total_revenue=Sum(F("quantity") * F("unit_price")),
            total_cost_basis=Sum(F("quantity") * F("unit_cost")),
        )

        return_stats = SaleReturnLine.objects.filter(
            product_id__in=product_ids, return_doc__status="CONFIRMED"
        ).aggregate(
            total_qty=Sum("quantity"),
            total_revenue=Sum(F("quantity") * F("unit_price")),
            total_cost_basis=Sum(F("quantity") * F("unit_cost")),
        )

        net_qty = (delivery_stats["total_qty"] or 0) - (return_stats["total_qty"] or 0)
        net_revenue = (delivery_stats["total_revenue"] or 0) - (return_stats["total_revenue"] or 0)
        net_cost_basis = (delivery_stats["total_cost_basis"] or 0) - (
            return_stats["total_cost_basis"] or 0
        )

        avg_price = float(delivery_stats["avg_price"] or 0)
        avg_cost = float(delivery_stats["avg_cost"] or 0)

        from production.models import ProductionConsumption

        consumptions = (
            ProductionConsumption.objects.filter(product_id__in=product_ids)
            .select_related("work_order", "product")
            .all()
            .order_by("-date")[:20]
        )

        production_usage = []
        for c in consumptions:
            from core.prefix_registry import EntityPrefix
            desc = f"Consumo en {EntityPrefix.WORK_ORDER}-{c.work_order.number}"
            if instance.has_variants and c.product_id != instance.id:
                variant_name = c.product.variant_display_name or c.product.name
                desc = f"[{variant_name}] {desc}"

            production_usage.append(
                {
                    "date": c.date,
                    "ot_id": c.work_order.id,
                    "ot_number": c.work_order.number,
                    "quantity": float(c.quantity),
                    "description": desc,
                }
            )

        return {
            "price_history": price_history,
            "kardex": kardex,
            "sales_analysis": {
                "avg_price": avg_price,
                "avg_cost": avg_cost,
                "total_sold": float(net_qty),
                "total_revenue": float(net_revenue),
                "total_cost_basis": float(net_cost_basis),
            },
            "production_usage": production_usage,
        }

class SubscriptionSelector:
    @staticmethod
    def list_subscriptions(*, params: dict) -> QuerySet:
        from django.utils import timezone

        queryset = Subscription.objects.all().select_related("product", "supplier").order_by("-created_at")

        status_filter = params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        supplier_id = params.get("supplier")
        if supplier_id:
            queryset = queryset.filter(supplier_id=supplier_id)

        upcoming_days = params.get("upcoming_days")
        if upcoming_days:
            try:
                days = int(upcoming_days)
                threshold = timezone.now().date() + timezone.timedelta(days=days)
                queryset = queryset.filter(
                    status=Subscription.Status.ACTIVE, next_payment_date__lte=threshold
                )
            except (ValueError, TypeError):
                pass

        return queryset

    @staticmethod
    def get_stats():
        from django.db.models import Count, Sum, Q

        now = timezone.now()
        threshold_30 = now.date() + timezone.timedelta(days=30)

        agg = Subscription.objects.aggregate(
            active_count=Count("pk", filter=Q(status=Subscription.Status.ACTIVE)),
            paused_count=Count("pk", filter=Q(status=Subscription.Status.PAUSED)),
            cancelled_count=Count("pk", filter=Q(status=Subscription.Status.CANCELLED)),
            total_monthly_cost=Sum("amount", filter=Q(status=Subscription.Status.ACTIVE)),
            upcoming_renewals=Count(
                "pk",
                filter=Q(
                    status=Subscription.Status.ACTIVE,
                    next_payment_date__lte=threshold_30,
                ),
            ),
        )

        return {
            "active_subscriptions": agg["active_count"],
            "paused_subscriptions": agg["paused_count"],
            "cancelled_subscriptions": agg["cancelled_count"],
            "total_monthly_cost": float(agg["total_monthly_cost"] or 0),
            "upcoming_renewals_30_days": agg["upcoming_renewals"],
        }

    @staticmethod
    def get_full_history(subscription):
        from billing.models import Invoice
        from purchasing.models import PurchaseLine, PurchaseOrder

        product = subscription.product
        supplier = subscription.supplier

        orders_qs = (
            PurchaseOrder.objects.filter(supplier=supplier, lines__product=product)
            .distinct()
            .order_by("-date")
        )

        orders_data = [
            {
                "id": o.id,
                "number": o.number,
                "display_id": o.display_id,
                "date": o.date,
                "status": o.status,
                "total": float(o.total),
                "receiving_status": o.receiving_status,
            }
            for o in orders_qs
        ]

        price_history_qs = PurchaseLine.objects.filter(
            product=product,
            order__supplier=supplier,
            order__status__in=[PurchaseOrder.Status.CONFIRMED, PurchaseOrder.Status.RECEIVED],
        ).order_by("-order__date")[:20]

        price_history = [
            {
                "date": line.order.date,
                "unit_cost": float(line.unit_cost),
                "order_number": line.order.number,
            }
            for line in price_history_qs
        ]

        order_ids = [o["id"] for o in orders_data]
        notes_qs = Invoice.objects.filter(
            purchase_order__in=order_ids,
            dte_type__in=[Invoice.DTEType.NOTA_CREDITO, Invoice.DTEType.NOTA_DEBITO],
        ).order_by("-date")

        notes_data = [
            {
                "id": n.id,
                "number": n.number,
                "display_id": n.display_id,
                "date": n.date,
                "status": n.status,
                "dte_type": n.dte_type,
                "total": float(n.total),
                "purchase_order_number": n.purchase_order.number if n.purchase_order else None,
            }
            for n in notes_qs
        ]

        return {
            "orders": orders_data,
            "price_history": price_history,
            "notes": notes_data,
            "product_name": product.name,
            "supplier_name": supplier.name,
        }


class StockMoveSelector:
    @staticmethod
    def stock_level(product_id: int, warehouse_id: int) -> str:
        from decimal import Decimal
        from django.db.models import Sum
        from .models import StockMove

        total = StockMove.objects.filter(
            product_id=product_id,
            warehouse_id=warehouse_id,
        ).aggregate(total=Sum("quantity"))["total"] or Decimal("0.0")
        return str(total)
    @staticmethod
    def get_related_documents(obj):
        docs = obj.journal_entry.get_source_documents if obj.journal_entry else []
        if hasattr(obj, 'purchase_receipt_line') and obj.purchase_receipt_line.receipt.purchase_order:
            po = obj.purchase_receipt_line.receipt.purchase_order
            docs.append({'type': 'purchase_order', 'id': po.id, 'name': str(po), 'url': '/purchasing/orders'})
            docs.extend([{'type': 'invoice', 'id': i.id, 'name': str(i), 'url': '/billing/purchases'} for i in po.invoices.all()])
        if hasattr(obj, 'sale_delivery_line') and obj.sale_delivery_line.delivery.sale_order:
            so = obj.sale_delivery_line.delivery.sale_order
            docs.append({'type': 'sale_order', 'id': so.id, 'name': str(so), 'url': '/sales/orders'})
            docs.extend([{'type': 'invoice', 'id': i.id, 'name': str(i), 'url': '/billing/sales'} for i in so.invoices.all()])
        
        seen = set()
        return [d for d in docs if not (d['type'] == 'inventory' or (d['type'], d['id']) in seen or seen.add((d['type'], d['id'])))]
