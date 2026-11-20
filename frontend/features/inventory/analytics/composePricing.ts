import type { ProductPricing } from "./pricing.types"
import type { SalesImpactGroupBy } from "./salesImpact.types"

export const COST_RISE_THRESHOLD = 0.05
export const FOREGONE_THRESHOLD = 0.05

export type PricingFindingId = "cost_up_price_flat" | "negative_margin" | "high_foregone"

export interface PricingFinding {
    id: PricingFindingId
    message: string
}

export interface PricingComposition {
    hero: "margin" | "price"
    findings: PricingFinding[]
    sections: Array<"charts" | "effects" | "breakdown">
    defaultGroupBy: SalesImpactGroupBy
}

function findCostRise(data: ProductPricing): PricingFinding | null {
    const sold = data.series.points.filter((p) => p.units > 0 && p.avg_cost > 0)
    if (sold.length < 2 || data.list_price_changes.changes.length > 0) return null
    const first = sold[0].avg_cost
    const rise = (sold[sold.length - 1].avg_cost - first) / first
    if (rise < COST_RISE_THRESHOLD) return null
    return {
        id: "cost_up_price_flat",
        message: `El costo promedio subió ${(rise * 100).toFixed(1)} % en el periodo y el precio de lista no cambió.`,
    }
}

/** Decides hero metric, findings, section order and default breakdown for the pricing tab. Pure. */
export function composePricing(data: ProductPricing, capabilities: { has_variants: boolean }): PricingComposition {
    const findings: PricingFinding[] = []
    if (data.has_cost) {
        const rise = findCostRise(data)
        if (rise) findings.push(rise)
        if (data.series.points.some((p) => p.margin_pct !== null && p.margin_pct < 0)) {
            findings.push({ id: "negative_margin", message: "Hay periodos con margen realizado negativo: se vendió bajo el costo." })
        }
    }
    const { net_revenue: net, foregone_revenue: foregone } = data.kpis
    if (net > 0 && foregone / net >= FOREGONE_THRESHOLD) {
        findings.push({
            id: "high_foregone",
            message: `El ingreso no percibido por vender bajo la lista es el ${((foregone / net) * 100).toFixed(1)} % del ingreso neto.`,
        })
    }

    const hasSales = data.series.points.length > 0
    const sections: PricingComposition["sections"] = []
    if (hasSales) sections.push("charts")
    if (hasSales && data.effects.length > 0) sections.push("effects")
    if (hasSales) sections.push("breakdown")

    return {
        hero: data.has_cost ? "margin" : "price",
        findings,
        sections,
        defaultGroupBy: capabilities.has_variants ? "variant" : "rule",
    }
}
