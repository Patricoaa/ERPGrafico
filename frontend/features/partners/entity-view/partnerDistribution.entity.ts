import { defineEntity } from "@/components/entity-view"
import { docRef } from "@/features/documents"

/** Línea de una resolución de distribución vista desde un socio (ficha, pestaña Distribuciones). */
export interface PartnerDistributionRow {
    id: number
    distributionId: number
    displayId: string
    fiscalYear: number
    status: string
    percentage: number
    gross: number
    offset: number
    net: number
    paid: number
}

const STATUS_LABEL: Record<string, string> = { DRAFT: "Borrador", APPROVED: "Aprobada", EXECUTED: "Ejecutada", CANCELLED: "Anulada" }
const fixed = { sortable: false } as const

export const partnerDistributionEntity = defineEntity<PartnerDistributionRow>()((f) => ({
    title: "Distribuciones del socio",
    rowId: (r) => r.id,
    fields: {
        resolution: docRef(
            f,
            (r) => ({ label: "contacts.profitdistributionresolution", id: r.distributionId, display: r.displayId }),
            { ...fixed, label: "Resolución", fallback: (r) => r.displayId },
        ),
        year: f.text((r) => String(r.fiscalYear), { ...fixed, label: "Ejercicio" }),
        status: f.status((r) => ({
            status: r.status === "CANCELLED" ? "DESTRUCTIVE" : r.status === "EXECUTED" ? "SUCCESS" : "NEUTRAL",
            label: STATUS_LABEL[r.status] ?? r.status,
        }), { ...fixed, label: "Estado" }),
        percentage: f.number("percentage", { ...fixed, label: "Participación", suffix: "%" }),
        gross: f.money("gross", { ...fixed, label: "Monto bruto" }),
        offset: f.money("offset", { ...fixed, label: "Retiros absorbidos" }),
        net: f.money("net", { ...fixed, label: "Monto neto" }),
        paid: f.money("paid", { ...fixed, label: "Pagado" }),
    },
}))

export const partnerDistributionViews = partnerDistributionEntity.views({
    table: { columns: ["resolution", "year", "status", "percentage", "gross", "offset", "net", "paid"] },
})
