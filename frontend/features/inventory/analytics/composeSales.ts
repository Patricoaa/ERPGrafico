import type { ProductSales } from "./sales.types"

export const SALES_DROP_THRESHOLD = 0.2
export const SALES_DROP_MIN_PREVIOUS_UNITS = 5
export const CONCENTRATION_THRESHOLD = 70
export const CONCENTRATION_MIN_CUSTOMERS = 4
export const NO_RECENT_SALES_DAYS = 60
export const RETURNS_THRESHOLD = 10

export type SalesFindingId = "sales_drop" | "customer_concentration" | "no_recent_sales" | "high_returns"

export interface SalesFinding {
    id: SalesFindingId
    message: string
}

export interface SalesComposition {
    findings: SalesFinding[]
    sections: Array<"chart" | "customers" | "channels" | "variants" | "uoms">
}

/** Decides findings and which sections of the sales tab have something to show. Pure. */
export function composeSales(data: ProductSales): SalesComposition {
    const { kpis, customers } = data
    const findings: SalesFinding[] = []

    const previous = kpis.previous
    if (previous && previous.units >= SALES_DROP_MIN_PREVIOUS_UNITS) {
        const drop = (previous.units - kpis.units) / previous.units
        if (drop >= SALES_DROP_THRESHOLD) {
            findings.push({
                id: "sales_drop",
                message: `Las unidades vendidas cayeron ${(drop * 100).toFixed(0)} % frente al período anterior.`,
            })
        }
    }
    if (customers.total >= CONCENTRATION_MIN_CUSTOMERS && customers.top3_share_pct >= CONCENTRATION_THRESHOLD) {
        findings.push({
            id: "customer_concentration",
            message: `Los 3 mejores clientes concentran el ${customers.top3_share_pct.toFixed(0)} % del ingreso de clientes identificados.`,
        })
    }
    if (kpis.days_since_last_sale !== null && kpis.days_since_last_sale >= NO_RECENT_SALES_DAYS) {
        findings.push({ id: "no_recent_sales", message: `Hace ${kpis.days_since_last_sale} días que no se vende este producto.` })
    }
    if (kpis.return_rate_pct >= RETURNS_THRESHOLD) {
        findings.push({ id: "high_returns", message: `Las devoluciones son el ${kpis.return_rate_pct.toFixed(1)} % de las unidades vendidas.` })
    }

    const sections: SalesComposition["sections"] = []
    if (data.series.points.length > 0) {
        sections.push("chart")
        if (customers.total > 0) sections.push("customers")
        if (data.channels.length > 1) sections.push("channels")
        if (data.variants.length > 0) sections.push("variants")
        if (data.uoms.length > 0) sections.push("uoms")
    }
    return { findings, sections }
}
