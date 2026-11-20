"""Decisiones de abastecimiento por producto: fabricar vs comprar y uso como insumo (ADR-0147).

Definiciones en ``docs/superpowers/specs/2026-11-19-product-sourcing-decisions-design.md``.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError

from .models import Product, UoM
from .production_performance_selector import ProductionPerformanceSelector
from .selectors import ProductSelector
from .services import UoMService


def _pct(part: float, whole: float) -> float | None:
    return part / whole * 100 if whole else None


class SourcingSelector:
    @staticmethod
    def get_sourcing(
        product: Product, date_from: date | None = None, date_to: date | None = None, increase_pct: float = 10,
    ) -> dict:
        date_to = date_to or date.today()
        date_from = date_from or (date_to - timedelta(days=365))
        product_ids = [product.id]
        if product.has_variants:
            product_ids += list(product.variants.values_list("id", flat=True))
        caps = ProductSelector.get_capabilities(product)
        uoms = {u.id: u for u in UoM.objects.all()}

        def to_base(qty: Decimal, from_id, to_id) -> Decimal:
            from_uom, to_uom = uoms.get(from_id), uoms.get(to_id)
            if from_uom and to_uom and from_uom.id != to_uom.id:
                try:
                    return UoMService.convert_quantity(qty, from_uom, to_uom)
                except ValidationError:
                    return qty
            return qty

        return {
            "make_vs_buy": (
                SourcingSelector._make_vs_buy(product, product_ids, date_from, date_to, to_base)
                if caps["manufactures"] and caps["buys"] else None
            ),
            "used_in": (
                SourcingSelector._used_in(product_ids, increase_pct, to_base) if caps["used_in_production"] else None
            ),
        }

    @staticmethod
    def _make_vs_buy(product, product_ids, date_from, date_to, to_base) -> dict:
        from purchasing.models import PurchaseReceiptLine

        perf = ProductionPerformanceSelector.get_performance(product, date_from, date_to)
        make = {
            "unit_cost": perf["kpis"]["unit_real_cost"],
            "bom_cost": perf["kpis"]["bom_cost"],
            "units_made": sum(o["qty"] for o in perf["orders"]),
            "orders": perf["kpis"]["orders"],
        }

        total_cost = total_qty = 0.0
        last: tuple[date, int, float] | None = None
        receipts = 0
        for line in PurchaseReceiptLine.objects.filter(
            product_id__in=product_ids, receipt__status="CONFIRMED",
            receipt__receipt_date__range=(date_from, date_to),
        ).values("id", "quantity_received", "uom_id", "unit_cost", "product__uom_id", "receipt__receipt_date"):
            base_qty = float(to_base(Decimal(line["quantity_received"]), line["uom_id"], line["product__uom_id"]))
            cost = float(Decimal(line["quantity_received"]) * Decimal(line["unit_cost"]))
            if base_qty <= 0:
                continue
            receipts += 1
            total_cost += cost
            total_qty += base_qty
            key = (line["receipt__receipt_date"], line["id"], cost / base_qty)
            if last is None or key[:2] > last[:2]:
                last = key
        avg = total_cost / total_qty if total_qty else 0.0
        buy = {
            "avg_unit_cost": avg,
            "last_unit_cost": last[2] if last else 0.0,
            "last_date": last[0].isoformat() if last else None,
            "units_bought": total_qty,
            "receipts": receipts,
        }

        comparable = avg > 0 and make["unit_cost"] > 0
        saving = avg - make["unit_cost"] if comparable else None
        return {
            "make": make,
            "buy": buy,
            "saving_per_unit": saving,
            "saving_total": saving * make["units_made"] if saving is not None else None,
            "cheaper": None if saving is None or saving == 0 else ("MAKE" if saving > 0 else "BUY"),
        }

    @staticmethod
    def _used_in(product_ids, increase_pct, to_base) -> dict:
        from production.models import BillOfMaterialsLine

        factor = increase_pct / 100
        mine = list(
            BillOfMaterialsLine.objects.filter(component_id__in=product_ids, bom__active=True).values(
                "bom_id", "bom__product_id", "bom__product__name", "bom__product__sale_price",
                "bom__yield_quantity", "component__cost_price", "component__uom_id", "quantity", "uom_id",
                "is_outsourced", "unit_price",
            )
        )
        bom_ids = {m["bom_id"] for m in mine}

        def line_cost(line: dict) -> tuple[Decimal, Decimal]:
            """(quantity in the component's base unit, cost) of one BOM line, per batch.

            Same rule as the BOM screen (`BillOfMaterialsSerializer.get_total_cost`): outsourced lines cost
            `quantity × unit_price`; the rest cost the converted quantity × the component's weighted cost.
            """
            qty = Decimal(line["quantity"])
            if line["is_outsourced"]:
                return qty, qty * Decimal(line["unit_price"])
            qty = to_base(qty, line["uom_id"], line["component__uom_id"])
            return qty, qty * Decimal(line["component__cost_price"])

        bom_cost: dict[int, Decimal] = defaultdict(Decimal)
        yields: dict[int, Decimal] = {}
        for line in BillOfMaterialsLine.objects.filter(bom_id__in=bom_ids).values(
            "bom_id", "bom__yield_quantity", "component__cost_price", "component__uom_id", "quantity", "uom_id",
            "is_outsourced", "unit_price",
        ):
            bom_cost[line["bom_id"]] += line_cost(line)[1]
            yields[line["bom_id"]] = Decimal(line["bom__yield_quantity"] or 1)

        def per_unit(bom_id: int, value: Decimal) -> float:
            batch = yields.get(bom_id) or Decimal(1)
            return float(value / batch) if batch > 0 else float(value)

        # One row per parent product: its active BOM (the model keeps a single active BOM per product).
        chosen: dict[int, int] = {}
        for m in sorted(mine, key=lambda row: row["bom_id"]):
            chosen.setdefault(m["bom__product_id"], m["bom_id"])

        parents: dict[int, dict] = {}
        for m in mine:
            if chosen[m["bom__product_id"]] != m["bom_id"]:
                continue
            qty, cost = line_cost(m)
            row = parents.setdefault(m["bom__product_id"], {
                "product_id": m["bom__product_id"], "name": m["bom__product__name"],
                "price_net": float(m["bom__product__sale_price"] or 0), "bom_id": m["bom_id"],
                "qty_per_unit": 0.0, "component_cost": 0.0,
            })
            row["qty_per_unit"] += per_unit(m["bom_id"], qty)
            row["component_cost"] += per_unit(m["bom_id"], cost)

        result = []
        for row in parents.values():
            bom = per_unit(row["bom_id"], bom_cost[row.pop("bom_id")])
            delta = row["component_cost"] * factor
            price = row["price_net"]
            row.update({
                "bom_cost": bom,
                "share_pct": _pct(row["component_cost"], bom),
                "delta_cost": delta,
                "delta_pct": _pct(delta, bom),
                "margin_pct": _pct(price - bom, price) if price else None,
                "margin_pct_after": _pct(price - bom - delta, price) if price else None,
            })
            result.append(row)
        result.sort(key=lambda r: -r["delta_cost"])
        return {"increase_pct": increase_pct, "parents": result}
