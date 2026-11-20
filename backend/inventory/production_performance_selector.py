"""Rendimiento de fabricación por producto: costo real vs BOM, desviación por insumo, etapas y margen por OT.

Solo OT terminadas. Definiciones en
``docs/superpowers/specs/2026-11-19-product-production-performance-design.md``.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.db.models import Count, FloatField, Min, Q, Sum
from django.db.models.functions import Cast, Coalesce

from .models import Product, UoM
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
            )
            .values(
                "id", "number", "is_rectified", "actual_quantity_produced", "stage_data",
                "sale_line__quantity", "sale_line__subtotal", "sale_line_id", "finished_at", "first_event_at",
            )
            .order_by("-finished_at", "-id")
        )
        orders = [
            o for o in orders_qs
            if o["finished_at"] is None or date_from <= o["finished_at"].date() <= date_to
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
        planned_by_order: dict[int, float] = defaultdict(float)
        planned_by_component: dict[int, dict] = defaultdict(lambda: {"qty": 0.0, "cost": 0.0})
        for m in WorkOrderMaterial.objects.filter(work_order_id__in=ids).values(
            "work_order_id", "component_id", "component__uom_id", "uom_id", "quantity_planned", "unit_cost_snapshot"
        ):
            qty = Decimal(m["quantity_planned"])
            base_uom, from_uom = uoms.get(m["component__uom_id"]), uoms.get(m["uom_id"])
            if base_uom and from_uom and base_uom.id != from_uom.id:
                try:
                    qty = UoMService.convert_quantity(qty, from_uom, base_uom)
                except Exception:
                    pass
            cost = float(qty * Decimal(m["unit_cost_snapshot"]))
            planned_by_order[m["work_order_id"]] += cost
            planned_by_component[m["component_id"]]["qty"] += float(qty)
            planned_by_component[m["component_id"]]["cost"] += cost

        rows = []
        for o in orders:
            qty = float(o["actual_quantity_produced"] or o["sale_line__quantity"] or (o["stage_data"] or {}).get("quantity") or 0)
            has_consumption = o["id"] in consumption
            real = float(consumption[o["id"]]["real"] or 0) if has_consumption else 0.0
            planned = planned_by_order.get(o["id"], 0.0)
            revenue = float(o["sale_line__subtotal"]) if o["sale_line_id"] else None
            rows.append({
                "id": o["id"], "number": o["number"],
                "date": o["finished_at"].date().isoformat() if o["finished_at"] else None,
                "qty": qty, "planned_cost": planned, "real_cost": real,
                "deviation": real - planned, "deviation_pct": _pct(real - planned, planned),
                "revenue": revenue, "margin": (revenue - real) if revenue is not None else None,
                "estimated": has_consumption and consumption[o["id"]]["estimated"] > 0,
                "_costed": has_consumption and qty > 0,
            })

        costed = [r for r in rows if r["_costed"]]
        unit_real = sum(r["real_cost"] for r in costed) / sum(r["qty"] for r in costed) if costed else 0.0
        bom_cost = float(product.get_bom_cost() or 0)
        with_plan = [r for r in rows if r["_costed"] and r["planned_cost"] > 0]
        lead_times = [
            (o["finished_at"] - o["first_event_at"]).total_seconds() / _SECONDS_PER_DAY
            for o in orders if o["finished_at"] and o["first_event_at"]
        ]

        stages = [] if express else ProductionPerformanceSelector._stages(WorkOrderHistory, ids)
        materials = [
            {
                "component_id": cid, "name": row["product__name"],
                "planned_qty": planned_by_component[cid]["qty"], "consumed_qty": float(row["qty"] or 0),
                "planned_cost": planned_by_component[cid]["cost"], "real_cost": float(row["real"] or 0),
                "deviation": float(row["real"] or 0) - planned_by_component[cid]["cost"],
            }
            for cid, row in consumed_by_component.items()
        ]
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
                "lead_time_days": 0.0 if express or not lead_times else sum(lead_times) / len(lead_times),
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

        totals: dict[str, float] = defaultdict(float)
        counts: dict[str, int] = defaultdict(int)
        orders_seen: dict[str, set[int]] = defaultdict(set)
        for order_id, seq in by_order.items():
            for (stage, started), (_, ended) in zip(seq, seq[1:], strict=False):
                totals[stage] += (ended - started).total_seconds() / _SECONDS_PER_DAY
                counts[stage] += 1
                orders_seen[stage].add(order_id)

        labels = dict(history_model._meta.get_field("work_order").related_model.Stage.choices)
        return [
            {"stage": s, "label": str(labels.get(s, s)), "avg_days": totals[s] / counts[s], "orders": len(orders_seen[s])}
            for s in totals
        ]
