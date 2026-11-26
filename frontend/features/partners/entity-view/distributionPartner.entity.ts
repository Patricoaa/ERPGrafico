import { defineEditable, defineEntity, formatMoneyValue, type EditableInput, type StatusValue } from "@/components/entity-view"
import { docRef } from "@/features/documents"
import type { ProfitDistribution, ProfitDistributionImpactPartner, ProfitDistributionLine } from "@/features/contacts"

/** Resolución a la que pertenece la fila; solo se informa cuando la tabla mezcla varias (ficha del socio). */
export interface DistributionPartnerResolution {
    id: number
    displayId: string
    fiscalYear: number
    status: string
}

/**
 * Reparto de una distribución a un socio: la misma fila alimenta el paso de impactos del wizard, el detalle
 * de socios del drawer de distribución y la pestaña Utilidades de la ficha del socio.
 */
export interface DistributionPartnerRow {
    id: number
    partnerId: number | null
    partnerName: string
    resolution?: DistributionPartnerResolution
    /** Participación al corte de la resolución y tras ejecutarla (solo si cambió). */
    percentageBefore?: number
    percentageAfter?: number
    gross: number
    offset: number
    net: number
    dividend: number
    reinvest: number
    retained: number
    loss: number
    /** Saldo de retiros provisorios tras ejecutar (solo en la proyección del wizard). */
    balanceAfter?: number
    paid?: number
}

const STATUS_LABEL: Record<string, string> = { DRAFT: "Borrador", APPROVED: "Aprobada", EXECUTED: "Ejecutada", CANCELLED: "Anulada" }
const fixed = { sortable: false } as const
const n = (v: string | number | null | undefined) => Number(v) || 0

/** «40% → 45%» solo cuando hubo reinversión y la participación cambió; en cualquier otro caso, vacío. */
export function participationEvolution(r: DistributionPartnerRow): string {
    if (r.reinvest <= 0 || r.percentageBefore == null || r.percentageAfter == null || r.percentageAfter === r.percentageBefore) return ""
    return `${r.percentageBefore}% → ${r.percentageAfter}%`
}

type Destination = NonNullable<ProfitDistributionLine["destination"]>

function destinationAmount(line: ProfitDistributionLine, destination: Destination): number {
    if (line.destinations && line.destinations.length > 0) {
        return n(line.destinations.find(d => d.destination === destination)?.amount)
    }
    return line.destination === destination ? n(line.net_amount) : 0
}

/** Línea de una resolución guardada → fila de la tabla (con `resolution` cuando la tabla cruza resoluciones). */
export function distributionLineToRow(line: ProfitDistributionLine, resolution?: ProfitDistribution): DistributionPartnerRow {
    return {
        id: line.id,
        partnerId: line.partner,
        partnerName: line.partner_name,
        resolution: resolution && { id: resolution.id, displayId: resolution.display_id, fiscalYear: resolution.fiscal_year, status: resolution.status },
        percentageBefore: n(line.percentage_at_date),
        percentageAfter: line.percentage_after != null ? n(line.percentage_after) : undefined,
        gross: n(line.gross_amount),
        offset: n(line.provisional_withdrawals_offset),
        net: n(line.net_amount),
        dividend: destinationAmount(line, "DIVIDEND"),
        reinvest: destinationAmount(line, "REINVEST"),
        retained: destinationAmount(line, "RETAINED"),
        loss: 0,
        paid: n(line.paid_dividend_amount),
    }
}

/** Proyección por socio de ejecutar la distribución (paso de impactos del wizard) → fila de la tabla. */
export function impactPartnerToRow(p: ProfitDistributionImpactPartner): DistributionPartnerRow {
    return {
        id: p.partner,
        partnerId: p.partner,
        partnerName: p.partner_name,
        gross: n(p.gross_amount),
        offset: n(p.provisional_withdrawals_offset),
        net: n(p.net_amount),
        dividend: n(p.dividend),
        reinvest: n(p.reinvest),
        retained: n(p.retained),
        loss: n(p.loss),
        balanceAfter: n(p.provisional_balance_after),
    }
}

export const distributionPartnerEntity = defineEntity<DistributionPartnerRow>()((f) => ({
    title: "Reparto por socio",
    rowId: (r) => r.id,
    fields: {
        partner: f.text((r) => r.partnerName, { ...fixed, label: "Socio" }),
        resolution: docRef(
            f,
            (r) => r.resolution ? { label: "contacts.profitdistributionresolution", id: r.resolution.id, display: r.resolution.displayId } : null,
            { ...fixed, label: "Resolución", fallback: (r) => r.resolution?.displayId },
        ),
        year: f.text((r) => (r.resolution ? String(r.resolution.fiscalYear) : ""), { ...fixed, label: "Ejercicio" }),
        status: f.status((r) => {
            const status = r.resolution?.status ?? ""
            return {
                status: status === "CANCELLED" ? "DESTRUCTIVE" : status === "EXECUTED" ? "SUCCESS" : "NEUTRAL",
                label: STATUS_LABEL[status] ?? status,
            }
        }, { ...fixed, label: "Estado" }),
        evolution: f.text((r) => participationEvolution(r), { ...fixed, label: "Evolución de participación" }),
        participation: f.text((r) => (r.percentageBefore == null ? "" : `${r.percentageBefore}%`), { ...fixed, label: "Participación", align: "end" }),
        gross: f.money((r) => r.gross, { ...fixed, label: "Bruto" }),
        offset: f.money((r) => r.offset, { ...fixed, label: "Retiros absorbidos" }),
        balanceAfter: f.money((r) => r.balanceAfter ?? 0, { ...fixed, label: "Saldo retiros tras la distribución" }),
        net: f.money((r) => r.net, { ...fixed, label: "Neto" }),
        dividend: f.money((r) => r.dividend, { ...fixed, label: "Dividendos" }),
        reinvest: f.money((r) => r.reinvest, { ...fixed, label: "Reinversión" }),
        retained: f.money((r) => r.retained, { ...fixed, label: "Ut. retenidas" }),
        loss: f.money((r) => r.loss, { ...fixed, label: "Pérdida absorbida" }),
        toAbsorb: f.money((r) => Math.abs(r.net), { ...fixed, label: "Monto a absorber" }),
        paid: f.money((r) => r.paid ?? 0, { ...fixed, label: "Pagado" }),
    },
    // Command bar of the partner record's distributions tab (ADR-0158): it filters
    // `DistributionPartnerSearchRow`, which carries the resolution's status flat.
    query: {
        search: { placeholder: "Buscar distribución…" },
        filters: {
            status: {
                field: "status",
                control: "multi",
                options: [
                    { value: "DRAFT", label: "Borrador" }, { value: "APPROVED", label: "Aprobada" },
                    { value: "EXECUTED", label: "Ejecutada" }, { value: "CANCELLED", label: "Anulada" },
                ],
            },
        },
    },
}))

/** Row of the distributions tab: the resolution's folio, year and status flat, for search and filters. */
export interface DistributionPartnerSearchRow extends DistributionPartnerRow {
    status: string
    resolution_display: string
    fiscal_year: string
}

export const toDistributionSearchRow = (r: DistributionPartnerRow): DistributionPartnerSearchRow => ({
    ...r,
    status: r.resolution?.status ?? "",
    resolution_display: r.resolution?.displayId ?? "",
    fiscal_year: r.resolution ? String(r.resolution.fiscalYear) : "",
})

const tableOf = (columns: Array<keyof typeof distributionPartnerEntity.fields>) => distributionPartnerEntity.views({ table: { columns } })

/** Paso de impactos del wizard (utilidad). */
export const impactProfitViews = tableOf(["partner", "gross", "offset", "balanceAfter", "net", "dividend", "reinvest", "retained"])
/** Paso de impactos del wizard (pérdida). */
export const impactLossViews = tableOf(["partner", "gross", "net", "loss"])
/** Detalle de socios en el drawer de la distribución. */
export const documentPartnerViews = tableOf(["partner", "evolution", "gross", "offset", "net", "dividend", "reinvest", "retained"])
/** Pestaña Utilidades de la ficha del socio: su reparto en cada resolución. */
export const partnerProfitViews = tableOf(["resolution", "year", "status", "evolution", "gross", "offset", "net", "dividend", "reinvest", "retained", "paid"])

// ─── Allocation step of the wizard (ADR-0087 P1) ─────────────────────────────

/** What is left to allocate of a partner's net (negative = over-allocated). */
export const remainingOf = (r: DistributionPartnerRow, v: { dividend: number; reinvest: number; retained: number }) =>
    Math.abs(r.net) - (v.dividend + v.reinvest + v.retained)

function allocationStatus(r: DistributionPartnerRow, v: { dividend: number; reinvest: number; retained: number }): StatusValue {
    const remaining = remainingOf(r, v)
    if (Math.abs(remaining) <= 0.01) return { status: "balanced", label: "Cuadra", intent: "success" }
    return remaining > 0
        ? { status: "pending", label: `Faltan ${formatMoneyValue(remaining)}`, intent: "warning" }
        : { status: "over", label: `Excede ${formatMoneyValue(-remaining)}`, intent: "destructive" }
}

const destinationInput = (header: string): EditableInput<DistributionPartnerRow> => ({
    kind: "money",
    header,
    label: (r) => `${header} — ${r.partnerName}`,
    max: (r) => Math.abs(r.net),
})

/**
 * Profit: each partner's net goes to dividends, reinvestment or retained earnings, and must add up
 * exactly (the row status says what is missing or over). Partners whose provisional withdrawals
 * absorb the whole gross have nothing to allocate.
 */
export const distributionAllocationEditable = defineEditable(distributionPartnerEntity, {
    rowKey: (r) => r.id,
    context: ["partner", "participation", "gross", "offset", "net"],
    inputs: {
        dividend: destinationInput("Dividendos"),
        reinvest: destinationInput("Reinversión"),
        retained: destinationInput("Retenido"),
    },
    eligible: (r) => (r.net <= 0 ? { ok: false, reason: "Los retiros compensan toda la utilidad bruta" } : { ok: true }),
    rowStatus: allocationStatus,
    footer: { sum: ["dividend", "reinvest", "retained"] },
})

/** Loss: each partner absorbs its share automatically (read only). */
export const distributionLossViews = tableOf(["partner", "participation", "gross", "net", "toAbsorb"])
