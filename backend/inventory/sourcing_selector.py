"""Decisiones de abastecimiento por producto: fabricar vs comprar y uso como insumo (ADR-0147).

Definiciones en ``docs/superpowers/specs/2026-11-19-product-sourcing-decisions-design.md``.
"""
from __future__ import annotations

from collections import defaultdict
from decimal import Decimal


def _pct(part: float, whole: float) -> float | None:
    return part / whole * 100 if whole else None


class SourcingSelector:
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
