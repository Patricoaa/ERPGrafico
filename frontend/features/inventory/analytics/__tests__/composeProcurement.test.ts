import { describe, expect, it } from "vitest"
import { composeProcurement } from "../composeProcurement"
import type { ProcurementSupplierRow, ProductProcurement } from "../procurement.types"

const supplier = (id: number, share: number, over: Partial<ProcurementSupplierRow> = {}): ProcurementSupplierRow => ({
    id, name: `S${id}`, units: 1, spend: share, share_pct: share, avg_unit_cost: 1, receipts: 1,
    last_date: "2026-03-01", returned_units: 0, preferred: false, ...over,
})

function proc(over: Partial<ProductProcurement> = {}): ProductProcurement {
    return {
        coverage: { stock_now: 100, daily_out: 2, coverage_days: 50 },
        kpis: {
            units: 10, spend: 1000, orders: 2, suppliers: 2, last_purchase_date: "2026-03-01",
            days_since_last_purchase: 30, returned_units: 0, previous: null,
        },
        series: { points: [{ period: "2026-03", units: 10, spend: 1000 }], previous_points: [] },
        suppliers: [supplier(1, 60), supplier(2, 40)],
        preferred_supplier: null,
        pending: [],
        ...over,
    }
}
const ids = (d: ProductProcurement) => composeProcurement(d).findings.map((f) => f.id)
const coverage = (days: number | null) => ({ stock_now: 10, daily_out: 1, coverage_days: days })

describe("composeProcurement findings", () => {
    it("flags coverage of 15 days or less, not 16 nor unknown", () => {
        expect(ids(proc({ coverage: coverage(15) }))).toContain("low_coverage")
        expect(ids(proc({ coverage: coverage(16) }))).not.toContain("low_coverage")
        expect(ids(proc({ coverage: coverage(null) }))).not.toContain("low_coverage")
        expect(ids(proc({ coverage: null }))).not.toContain("low_coverage")
    })

    it("flags a preferred supplier missing from the period's purchases", () => {
        expect(ids(proc({ preferred_supplier: { id: 9, name: "Preferido" } }))).toContain("preferred_absent")
        const bought = proc({ preferred_supplier: { id: 1, name: "S1" }, suppliers: [supplier(1, 60, { preferred: true }), supplier(2, 40)] })
        expect(ids(bought)).not.toContain("preferred_absent")
    })

    it("does not flag the preferred supplier when there are no purchases in the period", () => {
        expect(ids(proc({ preferred_supplier: { id: 9, name: "P" }, suppliers: [] }))).not.toContain("preferred_absent")
    })

    it("flags a supplier with 80% or more of the spend only with at least 2 suppliers", () => {
        expect(ids(proc({ suppliers: [supplier(1, 80), supplier(2, 20)] }))).toContain("supplier_concentration")
        expect(ids(proc({ suppliers: [supplier(1, 79), supplier(2, 21)] }))).not.toContain("supplier_concentration")
        expect(ids(proc({ suppliers: [supplier(1, 100)] }))).not.toContain("supplier_concentration")
    })

    it("flags returns to suppliers in the period", () => {
        expect(ids(proc({ kpis: { ...proc().kpis, returned_units: 2 } }))).toContain("returns")
        expect(ids(proc())).not.toContain("returns")
    })
})

describe("composeProcurement sections", () => {
    it("lists coverage, chart, suppliers and pending when there is data", () => {
        const pending = [{ order_id: 1, number: "PO-1", supplier: "S1", date: "2026-06-01", ordered: 10, received: 4, pending: 6 }]
        expect(composeProcurement(proc({ pending })).sections).toEqual(["coverage", "chart", "suppliers", "pending"])
    })

    it("omits coverage without stock and chart/suppliers without purchases", () => {
        const empty = proc({ coverage: null, series: { points: [], previous_points: [] }, suppliers: [] })
        expect(composeProcurement(empty).sections).toEqual([])
    })
})
