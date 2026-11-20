import { describe, expect, it } from "vitest"
import { composeStock } from "../composeStock"
import type { ProductStockAnalysis, StockWarehouseRow } from "../stockAnalysis.types"

const warehouse = (id: number, idle = false): StockWarehouseRow => ({ id, name: `B${id}`, on_hand: 5, last_move_date: "2026-06-01", idle })

function stock(over: Partial<ProductStockAnalysis> = {}): ProductStockAnalysis {
    return {
        today: { on_hand: 20, value: 2000, reserved: 5, available: 15 },
        rotation: {
            in_qty: 30, out_qty: 10, avg_stock: 20, turnover: 0.5, days_of_inventory: 730,
            last_in_date: "2026-01-10", last_out_date: "2026-11-01", idle: false, idle_days: 90,
        },
        series: [{ period: "2026-01", stock_end: 20, in_qty: 30, out_qty: 10 }],
        flows: { outflows: [{ key: "sale", label: "Ventas", qty: 10 }], inflows: [{ key: "purchase", label: "Compras", qty: 30 }] },
        adjustments: [],
        loss_pct: null,
        warehouses: [warehouse(1)],
        variants: [],
        ...over,
    }
}
const ids = (d: ProductStockAnalysis) => composeStock(d).findings.map((f) => f.id)

describe("composeStock findings", () => {
    it("flags idle stock", () => {
        expect(ids(stock({ rotation: { ...stock().rotation, idle: true } }))).toContain("idle")
        expect(ids(stock())).not.toContain("idle")
    })

    it("flags a loss of 2% or more of outflows, not 1.9% nor unknown", () => {
        expect(ids(stock({ loss_pct: 2 }))).toContain("loss")
        expect(ids(stock({ loss_pct: 1.9 }))).not.toContain("loss")
        expect(ids(stock({ loss_pct: null }))).not.toContain("loss")
    })

    it("flags more reserved than on hand", () => {
        expect(ids(stock({ today: { on_hand: 2, value: 0, reserved: 3, available: -1 } }))).toContain("over_reserved")
        expect(ids(stock({ today: { on_hand: 3, value: 0, reserved: 3, available: 0 } }))).not.toContain("over_reserved")
    })

    it("flags an idle warehouse only when there is more than one warehouse", () => {
        expect(ids(stock({ warehouses: [warehouse(1), warehouse(2, true)] }))).toContain("idle_warehouse")
        expect(ids(stock({ warehouses: [warehouse(1, true)] }))).not.toContain("idle_warehouse")
    })
})

describe("composeStock sections", () => {
    it("lists every section with data", () => {
        const full = stock({
            adjustments: [{ key: "loss", label: "Merma", qty: 1, value: 10 }],
            warehouses: [warehouse(1), warehouse(2)],
            variants: [{ id: 3, name: "A4", on_hand: 5, reserved: 0, available: 5 }],
        })
        expect(composeStock(full).sections).toEqual(["chart", "flows", "adjustments", "warehouses", "variants"])
    })

    it("omits chart and flows without movements, and warehouses with a single one", () => {
        const quiet = stock({
            series: [{ period: "2026-01", stock_end: 20, in_qty: 0, out_qty: 0 }],
            flows: { outflows: [], inflows: [] },
        })
        expect(composeStock(quiet).sections).toEqual([])
    })
})
