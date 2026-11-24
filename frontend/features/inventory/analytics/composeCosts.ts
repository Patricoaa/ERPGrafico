import type { ProductCosts } from "./costs.types"

export const REPLACEMENT_GAP_THRESHOLD = 5
export const COST_RISE_THRESHOLD = 10
export const MFG_DEVIATION_THRESHOLD = 10
export const MFG_MIN_ORDERS = 3
export const DOMINANT_COMPONENT_SHARE = 0.5

export type CostsFindingId = "replacement_above" | "cost_rising" | "mfg_deviation" | "dominant_component" | "no_bom"

export interface CostsFinding {
    id: CostsFindingId
    message: string
}

export interface CostsComposition {
    hero: { label: string; value: number | null }
    secondary: Array<"bom_today" | "last_purchase">
    findings: CostsFinding[]
    sections: Array<"chart" | "bom" | "work_orders" | "purchases">
}

function hero(data: ProductCosts): CostsComposition["hero"] {
    if (data.mode === "manufactured_on_demand") return { label: "Costo de LdM", value: data.today.bom_cost }
    if (data.mode === "manufactured_no_bom") {
        const units = data.work_orders.reduce((sum, o) => sum + o.units, 0)
        const value = units ? data.work_orders.reduce((sum, o) => sum + o.unit_real_cost * o.units, 0) / units : null
        return { label: "Costo real promedio", value }
    }
    return { label: "Costo ponderado", value: data.today.weighted_cost }
}

function secondary(data: ProductCosts): CostsComposition["secondary"] {
    const figures: CostsComposition["secondary"] = []
    if (data.mode === "manufactured_stock" && data.today.bom_cost !== null) figures.push("bom_today")
    if (data.mode === "purchased" && data.today.last_purchase) figures.push("last_purchase")
    return figures
}

function findings(data: ProductCosts): CostsFinding[] {
    const found: CostsFinding[] = []
    const { replacement_gap_pct: gap, cost_change_pct: change } = data.kpis
    if (gap !== null && gap >= REPLACEMENT_GAP_THRESHOLD) {
        const source = data.mode === "purchased" ? "La última compra" : "El costo de la LdM hoy"
        found.push({ id: "replacement_above", message: `${source} supera al costo ponderado en ${gap.toFixed(1)} %: el costo va a subir.` })
    }
    if (change !== null && change >= COST_RISE_THRESHOLD) {
        found.push({ id: "cost_rising", message: `El costo subió ${change.toFixed(1)} % en el periodo.` })
    }
    const deviations = data.work_orders.map((o) => o.deviation_pct).filter((d): d is number => d !== null)
    if (deviations.length >= MFG_MIN_ORDERS) {
        const mean = deviations.reduce((sum, d) => sum + d, 0) / deviations.length
        if (mean >= MFG_DEVIATION_THRESHOLD) {
            found.push({ id: "mfg_deviation", message: `Las órdenes cuestan en promedio ${mean.toFixed(1)} % más que lo planificado en la LdM.` })
        }
    }
    const drivers = data.bom?.drivers ?? []
    const increase = drivers.reduce((sum, d) => sum + d.delta, 0)
    if (drivers.length > 0 && increase > 0 && (data.bom?.lines.length ?? 0) > 1) {
        const top = drivers[0]
        const share = top.delta / increase
        if (share >= DOMINANT_COMPONENT_SHARE) {
            found.push({ id: "dominant_component", message: `${top.name} explica el ${(share * 100).toFixed(0)} % del alza del costo de la LdM.` })
        }
    }
    if (data.mode === "manufactured_no_bom") {
        found.push({ id: "no_bom", message: "Sin LdM activa: no hay costo estándar para comparar las órdenes." })
    }
    return found
}

/** Decides hero figure, secondary figures, findings and sections of the costs tab by cost mode. Pure. */
export function composeCosts(data: ProductCosts): CostsComposition {
    const sections: CostsComposition["sections"] = []
    const hasPoint = data.series.some((p) =>
        [p.weighted_cost, p.bom_cost, p.purchase_avg, p.real_avg].some((v) => v !== null))
    if (hasPoint) sections.push("chart")
    if (data.bom && data.bom.lines.length > 0) sections.push("bom")
    if (data.work_orders.length > 0) sections.push("work_orders")
    if (data.mode === "purchased" && data.purchases.items.length > 0) sections.push("purchases")
    return { hero: hero(data), secondary: secondary(data), findings: findings(data), sections }
}
