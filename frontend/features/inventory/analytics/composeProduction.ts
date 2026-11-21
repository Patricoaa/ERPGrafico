import type { ProductProductionAnalysis } from "./productionAnalysis.types"

export const RECTIFICATION_THRESHOLD = 10
export const RECTIFICATION_MIN_ORDERS = 3
export const OVERCONSUMPTION_THRESHOLD = 10

export type ProductionFindingId = "rectification" | "overconsumption" | "negative_margin"

export interface ProductionFinding {
    id: ProductionFindingId
    message: string
}

export interface ProductionComposition {
    findings: ProductionFinding[]
    sections: Array<"made_chart" | "materials" | "orders" | "input_chart" | "by_product" | "used_in">
}

/** Decides findings and sections of the production tab for the manufactured and input roles. Pure. */
export function composeProduction(data: ProductProductionAnalysis): ProductionComposition {
    const findings: ProductionFinding[] = []
    const sections: ProductionComposition["sections"] = []
    const { made, input } = data

    if (made) {
        const { orders, rectification_rate: rate } = made.kpis
        if (orders >= RECTIFICATION_MIN_ORDERS && rate >= RECTIFICATION_THRESHOLD) {
            findings.push({ id: "rectification", message: `El ${rate.toFixed(0)} % de las órdenes del periodo se rectificó.` })
        }
        const over = made.materials.filter((m) => m.deviation_pct !== null && m.deviation_pct >= OVERCONSUMPTION_THRESHOLD)
        if (over.length > 0) {
            findings.push({
                id: "overconsumption",
                message: `Se consumió más de lo planificado: ${over.map((m) => `${m.name} (+${(m.deviation_pct ?? 0).toFixed(0)} %)`).join(", ")}.`,
            })
        }
        if (made.series.points.length > 0) sections.push("made_chart")
        if (made.materials.length > 0) sections.push("materials")
        if (made.orders.length > 0) sections.push("orders")
    }

    if (input) {
        const negative = input.used_in.parents.filter((p) => p.margin_pct_after !== null && p.margin_pct_after < 0)
        if (negative.length > 0) {
            findings.push({
                id: "negative_margin",
                message: `Si este insumo sube ${input.used_in.increase_pct} %, quedan con margen negativo: ${negative.map((p) => p.name).join(", ")}.`,
            })
        }
        if (input.series.points.length > 0) sections.push("input_chart")
        if (input.by_product.length > 0) sections.push("by_product")
        if (input.used_in.parents.length > 0) sections.push("used_in")
    }
    return { findings, sections }
}
