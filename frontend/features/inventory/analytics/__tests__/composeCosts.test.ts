import { describe, expect, it } from "vitest"
import { composeCosts } from "../composeCosts"
import type { CostsBomLine, CostsWorkOrder, ProductCosts } from "../costs.types"

const line = (name: string): CostsBomLine => ({
    component_id: name.length, name, qty_per_unit: 1, qty_display: 1, uom_singular: "Unidad", uom_plural: "Unidades", unit_cost: 10, cost: 10, share_pct: 50, change_pct: 0, is_outsourced: false,
})
const order = (deviation: number | null, units = 10, unitReal = 20): CostsWorkOrder => ({
    id: units, number: "OT", date: "2026-03-10", units, unit_real_cost: unitReal, unit_bom_cost: 18, deviation_pct: deviation,
})

function costs(over: Partial<ProductCosts> = {}): ProductCosts {
    return {
        mode: "purchased",
        today: {
            weighted_cost: 100, bom_cost: null,
            last_purchase: { date: "2026-06-01", unit_cost: 102, supplier: "Proveedor" },
            stock_qty: 10, stock_value: 1000,
        },
        kpis: { cost_change_pct: 2, replacement_gap_pct: 2 },
        series: [{ period: "2026-01", weighted_cost: 100, bom_cost: null, purchase_avg: 100, real_avg: null }],
        purchases: {
            min: 90, max: 110, avg: 100, count: 3,
            items: [{ date: "2026-06-01", number: "REC-0001", supplier: "Proveedor", qty: 5, unit_cost: 100, total: 500 }],
        },
        bom: null,
        work_orders: [],
        ...over,
    }
}
const ids = (d: ProductCosts) => composeCosts(d).findings.map((f) => f.id)

describe("composeCosts hero", () => {
    it("uses the weighted cost for purchased, stock-only and stocked manufactured products", () => {
        for (const mode of ["purchased", "stock_only", "manufactured_stock"] as const) {
            expect(composeCosts(costs({ mode })).hero).toEqual({ label: "Costo ponderado", value: 100 })
        }
    })

    it("uses the BOM cost for on-demand manufactured products", () => {
        const data = costs({ mode: "manufactured_on_demand", today: { ...costs().today, bom_cost: 80 } })
        expect(composeCosts(data).hero).toEqual({ label: "Costo de LdM", value: 80 })
    })

    it("uses the unit-weighted real cost per order without a BOM", () => {
        const data = costs({ mode: "manufactured_no_bom", work_orders: [order(null, 10, 20), order(null, 30, 40)] })
        expect(composeCosts(data).hero).toEqual({ label: "Costo real promedio", value: 35 })
        expect(composeCosts(costs({ mode: "manufactured_no_bom" })).hero.value).toBeNull()
    })
})

describe("composeCosts secondary figures", () => {
    it("shows last purchase and stock value for purchased products", () => {
        expect(composeCosts(costs()).secondary).toEqual(["last_purchase", "stock_value"])
    })

    it("shows only the LdM cost (no tied-up capital) for stocked manufactured products", () => {
        const data = costs({ mode: "manufactured_stock", today: { ...costs().today, bom_cost: 110 } })
        expect(composeCosts(data).secondary).toEqual(["bom_today"])
    })

    it("omits figures without data", () => {
        const data = costs({ today: { ...costs().today, last_purchase: null, stock_qty: null, stock_value: null } })
        expect(composeCosts(data).secondary).toEqual([])
    })
})

describe("composeCosts findings", () => {
    it("flags replacement 5% or more above the weighted cost, not 4.9%", () => {
        expect(ids(costs({ kpis: { cost_change_pct: 0, replacement_gap_pct: 5 } }))).toContain("replacement_above")
        expect(ids(costs({ kpis: { cost_change_pct: 0, replacement_gap_pct: 4.9 } }))).not.toContain("replacement_above")
    })

    it("flags a cost rise of 10% or more, not 9.9%", () => {
        expect(ids(costs({ kpis: { cost_change_pct: 10, replacement_gap_pct: null } }))).toContain("cost_rising")
        expect(ids(costs({ kpis: { cost_change_pct: 9.9, replacement_gap_pct: null } }))).not.toContain("cost_rising")
    })

    it("flags a manufacturing deviation of 10% or more only with at least 3 orders", () => {
        const three = costs({ mode: "manufactured_on_demand", work_orders: [order(10), order(12), order(8)] })
        const two = costs({ mode: "manufactured_on_demand", work_orders: [order(20), order(20)] })
        const low = costs({ mode: "manufactured_on_demand", work_orders: [order(5), order(9), order(10)] })
        expect(ids(three)).toContain("mfg_deviation")
        expect(ids(two)).not.toContain("mfg_deviation")
        expect(ids(low)).not.toContain("mfg_deviation")
    })

    it("flags a component that explains half or more of the BOM increase", () => {
        const bom = (deltas: number[]) => costs({
            mode: "manufactured_on_demand",
            bom: {
                lines: [line("Papel"), line("Tinta")],
                drivers: deltas.map((delta, i) => ({ component_id: i, name: i ? "Tinta" : "Papel", delta })),
            },
        })
        expect(ids(bom([6, 4]))).toContain("dominant_component")
        expect(ids(bom([4, 4, 4]))).not.toContain("dominant_component")
        expect(composeCosts(bom([6, 4])).findings.find((f) => f.id === "dominant_component")?.message).toMatch(/Papel/)
    })

    it("flags a manufactured product without BOM", () => {
        expect(ids(costs({ mode: "manufactured_no_bom" }))).toContain("no_bom")
        expect(ids(costs())).not.toContain("no_bom")
    })
})

describe("composeCosts sections", () => {
    it("lists chart, purchases for purchased products", () => {
        expect(composeCosts(costs()).sections).toEqual(["chart", "purchases"])
    })

    it("lists chart, bom and work orders for manufactured products with data", () => {
        const data = costs({ mode: "manufactured_stock", bom: { lines: [line("Papel")], drivers: [] }, work_orders: [order(5)], purchases: { min: null, max: null, avg: null, count: 0, items: [] } })
        expect(composeCosts(data).sections).toEqual(["chart", "bom", "work_orders"])
    })

    it("omits the chart when no point has a value", () => {
        const data = costs({ series: [{ period: "2026-01", weighted_cost: null, bom_cost: null, purchase_avg: null, real_avg: null }], purchases: { min: null, max: null, avg: null, count: 0, items: [] } })
        expect(composeCosts(data).sections).toEqual([])
    })
})
