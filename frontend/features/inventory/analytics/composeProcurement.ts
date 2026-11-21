import type { ProductProcurement } from "./procurement.types"

export const LOW_COVERAGE_DAYS = 15
export const SUPPLIER_CONCENTRATION = 80

export type ProcurementFindingId = "low_coverage" | "preferred_absent" | "supplier_concentration" | "returns"

export interface ProcurementFinding {
    id: ProcurementFindingId
    message: string
}

export interface ProcurementComposition {
    findings: ProcurementFinding[]
    sections: Array<"coverage" | "chart" | "suppliers" | "pending">
}

/** Decides findings and sections of the procurement tab from recorded facts only. Pure. */
export function composeProcurement(data: ProductProcurement): ProcurementComposition {
    const findings: ProcurementFinding[] = []
    const days = data.coverage?.coverage_days ?? null
    if (days !== null && days <= LOW_COVERAGE_DAYS) {
        findings.push({ id: "low_coverage", message: `El stock alcanza para ${Math.round(days)} días al consumo de los últimos 90 días.` })
    }
    const preferred = data.preferred_supplier
    if (preferred && data.suppliers.length > 0 && !data.suppliers.some((s) => s.id === preferred.id)) {
        findings.push({ id: "preferred_absent", message: `El proveedor preferido (${preferred.name}) no aparece entre las compras del periodo.` })
    }
    const top = data.suppliers[0]
    if (data.suppliers.length >= 2 && top && top.share_pct >= SUPPLIER_CONCENTRATION) {
        findings.push({ id: "supplier_concentration", message: `${top.name} concentra el ${top.share_pct.toFixed(0)} % del gasto del periodo.` })
    }
    if (data.kpis.returned_units > 0) {
        findings.push({ id: "returns", message: `Se devolvieron ${data.kpis.returned_units} unidades a proveedores en el periodo.` })
    }

    const sections: ProcurementComposition["sections"] = []
    if (data.coverage) sections.push("coverage")
    if (data.series.points.length > 0) sections.push("chart")
    if (data.suppliers.length > 0) sections.push("suppliers")
    if (data.pending.length > 0) sections.push("pending")
    return { findings, sections }
}
