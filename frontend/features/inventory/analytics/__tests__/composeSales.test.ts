import { describe, expect, it } from "vitest"
import { composeSales } from "../composeSales"
import type { ProductSales, SalesKpis, SalesShareRow } from "../sales.types"

const row = (key: string): SalesShareRow => ({ key, label: key, units: 1, net_revenue: 1, share_pct: 50 })

function sales(over: Partial<Omit<ProductSales, "kpis">> & { kpis?: Partial<SalesKpis> } = {}): ProductSales {
    const { kpis, ...rest } = over
    return {
        kpis: {
            units: 100, net_revenue: 100000, customers: 6, return_units: 0, return_rate_pct: 0,
            last_sale_date: "2026-11-10", days_since_last_sale: 10,
            previous: { units: 100, net_revenue: 100000, customers: 6 },
            ...kpis,
        },
        series: { points: [{ period: "2026-10", units: 50, net_revenue: 50000 }], previous_points: [] },
        customers: { total: 6, top3_share_pct: 50, top: [] },
        channels: [row("SYSTEM"), row("POS")],
        variants: [],
        uoms: [],
        ...rest,
    }
}
const ids = (d: ProductSales) => composeSales(d).findings.map((f) => f.id)
const previous = (units: number) => ({ units, net_revenue: 0, customers: 0 })

describe("composeSales findings", () => {
    it("flags a unit drop of 20% or more, not 19%", () => {
        expect(ids(sales({ kpis: { units: 80, previous: previous(100) } }))).toContain("sales_drop")
        expect(ids(sales({ kpis: { units: 81, previous: previous(100) } }))).not.toContain("sales_drop")
    })

    it("does not flag a drop with fewer than 5 units before or without a previous period", () => {
        expect(ids(sales({ kpis: { units: 0, previous: previous(4) } }))).not.toContain("sales_drop")
        expect(ids(sales({ kpis: { units: 0, previous: null } }))).not.toContain("sales_drop")
    })

    it("flags customer concentration of 70% or more, not 69%", () => {
        expect(ids(sales({ customers: { total: 6, top3_share_pct: 70, top: [] } }))).toContain("customer_concentration")
        expect(ids(sales({ customers: { total: 6, top3_share_pct: 69, top: [] } }))).not.toContain("customer_concentration")
    })

    it("does not flag concentration with 3 customers or fewer", () => {
        expect(ids(sales({ customers: { total: 3, top3_share_pct: 100, top: [] } }))).not.toContain("customer_concentration")
    })

    it("flags 60 days or more without sales, not 59 nor unknown", () => {
        expect(ids(sales({ kpis: { days_since_last_sale: 60 } }))).toContain("no_recent_sales")
        expect(ids(sales({ kpis: { days_since_last_sale: 59 } }))).not.toContain("no_recent_sales")
        expect(ids(sales({ kpis: { days_since_last_sale: null, last_sale_date: null } }))).not.toContain("no_recent_sales")
    })

    it("flags no recent sales for a product that sold only before the range", () => {
        const stale = sales({ kpis: { units: 0, days_since_last_sale: 200 }, series: { points: [], previous_points: [] } })
        expect(ids(stale)).toContain("no_recent_sales")
    })

    it("flags returns of 10% or more, not 9%", () => {
        expect(ids(sales({ kpis: { return_rate_pct: 10 } }))).toContain("high_returns")
        expect(ids(sales({ kpis: { return_rate_pct: 9 } }))).not.toContain("high_returns")
    })
})

describe("composeSales sections", () => {
    it("lists every section that has data", () => {
        const full = sales({
            customers: { total: 2, top3_share_pct: 80, top: [{ id: 1, name: "A", units: 1, net_revenue: 1, share_pct: 100 }] },
            variants: [row("v1")],
            uoms: [row("u1"), row("u2")],
        })
        expect(composeSales(full).sections).toEqual(["chart", "customers", "channels", "variants", "uoms"])
    })

    it("omits channels with a single channel and customers when there are none", () => {
        const single = sales({ channels: [row("SYSTEM")], customers: { total: 0, top3_share_pct: 0, top: [] } })
        expect(composeSales(single).sections).toEqual(["chart"])
    })

    it("has no sections when the range has no sales", () => {
        const empty = sales({ kpis: { units: 0 }, series: { points: [], previous_points: [] }, channels: [], customers: { total: 0, top3_share_pct: 0, top: [] } })
        expect(composeSales(empty).sections).toEqual([])
    })
})
