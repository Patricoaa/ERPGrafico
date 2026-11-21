import type { ProductStockAnalysis } from "./stockAnalysis.types"

export const LOSS_THRESHOLD = 2

export type StockFindingId = "idle" | "loss" | "over_reserved" | "idle_warehouse"

export interface StockFinding {
    id: StockFindingId
    message: string
}

export interface StockComposition {
    findings: StockFinding[]
    sections: Array<"chart" | "flows" | "adjustments" | "warehouses" | "variants">
}

/** Decides findings and sections of the inventory tab. Pure. */
export function composeStock(data: ProductStockAnalysis): StockComposition {
    const { today, rotation } = data
    const findings: StockFinding[] = []
    if (rotation.idle) {
        findings.push({
            id: "idle",
            message: rotation.last_out_date
                ? `Stock inmóvil: sin salidas desde hace ${rotation.idle_days} días o más.`
                : "Stock inmóvil: el producto tiene existencia y nunca registró salidas.",
        })
    }
    if (data.loss_pct !== null && data.loss_pct >= LOSS_THRESHOLD) {
        findings.push({ id: "loss", message: `La merma del periodo es el ${data.loss_pct.toFixed(1)} % de las salidas.` })
    }
    if (today.available < 0) {
        findings.push({ id: "over_reserved", message: `Hay ${Math.abs(today.available)} unidades más comprometidas que en existencia.` })
    }
    const idleWarehouses = data.warehouses.filter((w) => w.idle)
    if (data.warehouses.length > 1 && idleWarehouses.length > 0) {
        findings.push({
            id: "idle_warehouse",
            message: `Sin movimientos en ${rotation.idle_days} días: ${idleWarehouses.map((w) => w.name).join(", ")}.`,
        })
    }

    const moved = data.series.some((p) => p.in_qty > 0 || p.out_qty > 0)
    const sections: StockComposition["sections"] = []
    if (moved) sections.push("chart")
    if (data.flows.outflows.length + data.flows.inflows.length > 0) sections.push("flows")
    if (data.adjustments.length > 0) sections.push("adjustments")
    if (data.warehouses.length > 1) sections.push("warehouses")
    if (data.variants.length > 0) sections.push("variants")
    return { findings, sections }
}
