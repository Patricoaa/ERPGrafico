import { describe, expect, it } from "vitest"
import { composeProduction } from "../composeProduction"
import type { ProductionInput, ProductionMade, ProductProductionAnalysis } from "../productionAnalysis.types"
import type { SourcingParent } from "../sourcing.types"

function made(over: Partial<ProductionMade> = {}, kpis: Partial<ProductionMade["kpis"]> = {}): ProductionMade {
    return {
        kpis: { orders: 4, units: 40, rectified: 0, rectification_rate: 0, previous: null, ...kpis },
        series: { points: [{ period: "2026-03", orders: 4, units: 40 }], previous_points: [] },
        materials: [{ component_id: 1, name: "Papel", planned_qty: 100, consumed_qty: 105, deviation_qty: 5, deviation_pct: 5 }],
        orders: [{ id: 1, number: "OT-1", date: "2026-03-10", units: 10, rectified: false }],
        ...over,
    }
}
const parent = (over: Partial<SourcingParent> = {}): SourcingParent => ({
    product_id: 9, name: "Tarjeta", qty_per_unit: 2, component_cost: 20, bom_cost: 100, share_pct: 20,
    delta_cost: 2, delta_pct: 2, price_net: 120, margin_pct: 16, margin_pct_after: 14, ...over,
})
function input(over: Partial<ProductionInput> = {}): ProductionInput {
    return {
        kpis: { consumed: 50, orders: 3, previous: null },
        series: { points: [{ period: "2026-03", consumed: 50 }], previous_points: [] },
        by_product: [{ product_id: 9, name: "Tarjeta", qty: 50, share_pct: 100 }],
        used_in: { increase_pct: 10, parents: [parent()] },
        ...over,
    }
}
const ids = (d: ProductProductionAnalysis) => composeProduction(d).findings.map((f) => f.id)

describe("composeProduction findings", () => {
    it("flags rework of 10% or more with at least 3 orders", () => {
        expect(ids({ made: made({}, { orders: 10, rectified: 1, rectification_rate: 10 }), input: null })).toContain("rectification")
        expect(ids({ made: made({}, { orders: 10, rectified: 1, rectification_rate: 9.9 }), input: null })).not.toContain("rectification")
        expect(ids({ made: made({}, { orders: 2, rectified: 1, rectification_rate: 50 }), input: null })).not.toContain("rectification")
    })

    it("flags an input consumed 10% or more over plan", () => {
        const over = made({ materials: [{ component_id: 1, name: "Papel", planned_qty: 100, consumed_qty: 110, deviation_qty: 10, deviation_pct: 10 }] })
        expect(ids({ made: over, input: null })).toContain("overconsumption")
        expect(ids({ made: made(), input: null })).not.toContain("overconsumption")
        const unplanned = made({ materials: [{ component_id: 1, name: "Papel", planned_qty: 0, consumed_qty: 5, deviation_qty: 5, deviation_pct: null }] })
        expect(ids({ made: unplanned, input: null })).not.toContain("overconsumption")
    })

    it("flags a product whose margin turns negative after the price increase", () => {
        const negative = input({ used_in: { increase_pct: 20, parents: [parent({ margin_pct_after: -1 })] } })
        expect(ids({ made: null, input: negative })).toContain("negative_margin")
        expect(composeProduction({ made: null, input: negative }).findings[0].message).toMatch(/Tarjeta/)
        expect(ids({ made: null, input: input() })).not.toContain("negative_margin")
    })
})

describe("composeProduction sections", () => {
    it("lists the manufactured sections then the input sections", () => {
        expect(composeProduction({ made: made(), input: input() }).sections).toEqual([
            "made_chart", "materials", "orders", "input_chart", "by_product", "used_in",
        ])
    })

    it("omits sections without data", () => {
        const empty = made({ series: { points: [], previous_points: [] }, materials: [], orders: [] })
        const idle = input({ series: { points: [], previous_points: [] }, by_product: [], used_in: { increase_pct: 10, parents: [] } })
        expect(composeProduction({ made: empty, input: idle }).sections).toEqual([])
    })
})
