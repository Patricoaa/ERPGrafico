"""Rendimiento de fabricación por producto: costo real vs BOM, desviación por insumo, etapas y margen por OT.

Solo OT terminadas. Definiciones en
``docs/superpowers/specs/2026-11-19-product-production-performance-design.md``.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db.models import Count, ExpressionWrapper, FloatField, Min, Q, Sum, Value
from django.db.models.functions import Cast, Coalesce
from django.utils import timezone

from .models import Product, UoM
from .sales_impact_selector import discount_ratio_expression
from .services import UoMService

_SECONDS_PER_DAY = 86400.0


def _f(expression):
    return Cast(expression, output_field=FloatField())


def _pct(part: float, whole: float) -> float:
    return part / whole * 100 if whole else 0.0


class ProductionPerformanceSelector:
    @staticmethod
    def get_performance(product: Product, date_from: date | None = None, date_to: date | None = None) -> dict:
        from production.models import (
            ProductionConsumption,
            WorkOrder,
            WorkOrderHistory,
            WorkOrderMaterial,
        )

        from .selectors import ProductSelector

        product_ids = [product.id]
        if product.has_variants:
            product_ids += list(product.variants.values_list("id", flat=True))
        express = ProductSelector.get_capabilities(product)["express"]

        date_to = date_to or date.today()
        date_from = date_from or (date_to - timedelta(days=365))

        orders_qs = (
            WorkOrder.objects.filter(status="FINISHED")
            .filter(Q(sale_line__product_id__in=product_ids) | Q(product_id__in=product_ids))
            .annotate(
                finished_at=Min("stage_history__created_at", filter=Q(stage_history__stage="FINISHED")),
                first_event_at=Min("stage_history__created_at"),
                # Net of IVA and line discount (same basis as the sales-impact block).
                revenue_net=ExpressionWrapper(
                    _f("sale_line__quantity") * _f("sale_line__unit_price")
                    * (Value(1.0, output_field=FloatField()) - discount_ratio_expression()),
                    output_field=FloatField(),
                ),
            )
            .values(
                "id", "number", "is_rectified", "actual_quantity_produced", "stage_data",
                "sale_line__quantity", "sale_line__uom_id", "sale_line__product__uom_id", "product__uom_id",
                "sale_line_id", "revenue_net", "finished_at", "first_event_at",
            )
            .order_by("-finished_at", "-id")
        )
        orders = [
            o for o in orders_qs
            if o["finished_at"] is None or date_from <= timezone.localtime(o["finished_at"]).date() <= date_to
        ]
        ids = [o["id"] for o in orders]

        consumption = {
            row["work_order_id"]: row
            for row in ProductionConsumption.objects.filter(work_order_id__in=ids)
            .values("work_order_id")
            .annotate(
                real=Sum(_f("quantity") * Coalesce(_f("stock_move__unit_cost"), _f("product__cost_price"))),
                estimated=Count("id", filter=Q(stock_move__isnull=True)),
            )
        }
        consumed_by_component = {
            row["product_id"]: row
            for row in ProductionConsumption.objects.filter(work_order_id__in=ids)
            .values("product_id", "product__name")
            .annotate(
                qty=Sum(_f("quantity")),
                real=Sum(_f("quantity") * Coalesce(_f("stock_move__unit_cost"), _f("product__cost_price"))),
            )
        }

        uoms = {u.id: u for u in UoM.objects.all()}
        failed_conversion: set[int] = set()

        def convert(qty: Decimal, from_id, to_id, order_id: int) -> Decimal:
            from_uom, to_uom = uoms.get(from_id), uoms.get(to_id)
            if from_uom and to_uom and from_uom.id != to_uom.id:
                try:
                    return UoMService.convert_quantity(qty, from_uom, to_uom)
                except ValidationError:
                    failed_conversion.add(order_id)
            return qty

        planned_by_order: dict[int, float] = defaultdict(float)
        service_real_by_order: dict[int, float] = defaultdict(float)
        planned_by_component: dict[int, dict] = defaultdict(lambda: {"qty": 0.0, "cost": 0.0, "name": ""})
        service_real_by_component: dict[int, dict] = defaultdict(lambda: {"qty": 0.0, "cost": 0.0})
        for m in WorkOrderMaterial.objects.filter(work_order_id__in=ids).values(
            "work_order_id", "component_id", "component__name", "component__uom_id", "component__product_type",
            "component__cost_price", "uom_id", "quantity_planned", "unit_cost_snapshot", "is_outsourced", "unit_price",
        ):
            qty = convert(Decimal(m["quantity_planned"]), m["uom_id"], m["component__uom_id"], m["work_order_id"])
            is_service = m["component__product_type"] == Product.Type.SERVICE
            # Services have no stock move: finalize books them at the PO price (outsourced) or the component cost.
            unit = Decimal(m["unit_price"]) if is_service and m["is_outsourced"] else Decimal(m["unit_cost_snapshot"])
            cost = float(qty * unit)
            planned_by_order[m["work_order_id"]] += cost
            entry = planned_by_component[m["component_id"]]
            entry["qty"] += float(qty)
            entry["cost"] += cost
            entry["name"] = m["component__name"]
            if is_service:
                real_unit = Decimal(m["unit_price"]) if m["is_outsourced"] else Decimal(m["component__cost_price"])
                real = float(qty * real_unit)
                service_real_by_order[m["work_order_id"]] += real
                service_real_by_component[m["component_id"]]["qty"] += float(qty)
                service_real_by_component[m["component_id"]]["cost"] += real

        rows = []
        for o in orders:
            raw = o["actual_quantity_produced"] or o["sale_line__quantity"] or (o["stage_data"] or {}).get("quantity") or 0
            if o["actual_quantity_produced"]:
                qty = float(raw)  # declared in the product's base unit
            else:
                from_uom = o["sale_line__uom_id"] or (o["stage_data"] or {}).get("uom_id")
                base_uom = o["sale_line__product__uom_id"] or o["product__uom_id"]
                qty = float(convert(Decimal(str(raw)), from_uom, base_uom, o["id"]))
            has_cost = o["id"] in consumption or o["id"] in service_real_by_order
            real = float((consumption.get(o["id"]) or {}).get("real") or 0) + service_real_by_order.get(o["id"], 0.0) if has_cost else None
            planned = planned_by_order.get(o["id"], 0.0)
            revenue = float(o["revenue_net"]) if o["sale_line_id"] and o["revenue_net"] is not None else None
            rows.append({
                "id": o["id"], "number": o["number"], "rectified": bool(o["is_rectified"]),
                "date": timezone.localtime(o["finished_at"]).date().isoformat() if o["finished_at"] else None,
                "qty": qty, "planned_cost": planned, "real_cost": real,
                "deviation": real - planned if real is not None else None,
                "deviation_pct": _pct(real - planned, planned) if real is not None else None,
                "revenue": revenue, "margin": (revenue - real) if revenue is not None and real is not None else None,
                "estimated": ((consumption.get(o["id"]) or {}).get("estimated") or 0) > 0
                or o["id"] in failed_conversion,
                "_costed": has_cost and qty > 0,
            })

        costed = [r for r in rows if r["_costed"]]
        unit_real = sum(r["real_cost"] for r in costed) / sum(r["qty"] for r in costed) if costed else 0.0
        # get_bom_cost() reads the active BOM line by line: prefetch it so the cost does not query each component.
        bom_product = Product.objects.prefetch_related("boms__lines__component__uom", "boms__lines__uom").get(pk=product.pk)
        bom_cost = float(bom_product.get_bom_cost() or 0)
        with_plan = [r for r in rows if r["_costed"] and r["planned_cost"] > 0]
        lead_times = [
            (o["finished_at"] - o["first_event_at"]).total_seconds() / _SECONDS_PER_DAY
            for o in orders if o["finished_at"] and o["first_event_at"]
        ]

        stages = [] if express else ProductionPerformanceSelector._stages(WorkOrderHistory, ids)
        materials = []
        for cid in set(consumed_by_component) | set(planned_by_component):
            cons = consumed_by_component.get(cid)
            svc = service_real_by_component.get(cid, {"qty": 0.0, "cost": 0.0})
            planned = planned_by_component.get(cid, {"qty": 0.0, "cost": 0.0, "name": ""})
            real = float((cons or {}).get("real") or 0) + svc["cost"]
            materials.append({
                "component_id": cid, "name": (cons or {}).get("product__name") or planned["name"],
                "planned_qty": planned["qty"], "consumed_qty": float((cons or {}).get("qty") or 0) + svc["qty"],
                "planned_cost": planned["cost"], "real_cost": real, "deviation": real - planned["cost"],
            })
        materials.sort(key=lambda m: -abs(m["deviation"]))

        for r in rows:
            r.pop("_costed")
        return {
            "kpis": {
                "orders": len(rows),
                "unit_real_cost": unit_real,
                "bom_cost": bom_cost,
                "bom_gap_pct": _pct(unit_real - bom_cost, bom_cost) if bom_cost and unit_real else 0.0,
                "deviation_pct": _pct(sum(r["deviation"] for r in with_plan), sum(r["planned_cost"] for r in with_plan)),
                "lead_time_days": None if express or not lead_times else sum(lead_times) / len(lead_times),
                "rectification_rate": _pct(sum(1 for o in orders if o["is_rectified"]), len(orders)),
            },
            "orders": rows,
            "materials": materials,
            "stages": stages,
        }

    @staticmethod
    def _stages(history_model, order_ids: list[int]) -> list[dict]:
        """Average days spent in each stage: gap between a stage entry and the next entry of the same order."""
        events = history_model.objects.filter(
            work_order_id__in=order_ids, event__in=("ENTERED", "REOPENED")
        ).order_by("work_order_id", "created_at", "id").values("work_order_id", "stage", "created_at")
        by_order: dict[int, list[tuple[str, datetime]]] = defaultdict(list)
        for e in events:
            by_order[e["work_order_id"]].append((e["stage"], e["created_at"]))

        # Days per stage per order, summing every segment (notes logged in the same stage add up to the stage total).
        per_order: dict[str, dict[int, float]] = defaultdict(lambda: defaultdict(float))
        for order_id, seq in by_order.items():
            for (stage, started), (_, ended) in zip(seq, seq[1:], strict=False):
                per_order[stage][order_id] += (ended - started).total_seconds() / _SECONDS_PER_DAY

        labels = dict(history_model._meta.get_field("work_order").related_model.Stage.choices)
        return [
            {"stage": s, "label": str(labels.get(s, s)), "avg_days": sum(days.values()) / len(days), "orders": len(days)}
            for s, days in per_order.items()
        ]
