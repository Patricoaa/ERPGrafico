"use client"

import { useMemo } from "react"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { partnerDistributionEntity, partnerDistributionViews, type PartnerDistributionRow } from "../entity-view/partnerDistribution.entity"
import { useProfitDistributions, usePartnerTableSearch } from "../hooks"
import { PartnerTableSearchBar } from "./PartnerTableSearchBar"

const textOf = (r: PartnerDistributionRow) => `${r.displayId} ${r.fiscalYear}`
const select = {
    label: "Estado",
    options: [
        { value: "DRAFT", label: "Borrador" }, { value: "APPROVED", label: "Aprobada" },
        { value: "EXECUTED", label: "Ejecutada" }, { value: "CANCELLED", label: "Anulada" },
    ],
    valueOf: (r: PartnerDistributionRow) => r.status,
}

/**
 * Pestaña Distribuciones: las resoluciones de distribución de utilidades en las que participa el socio,
 * con su porcentaje, el monto bruto, los retiros provisorios compensados, el neto y lo ya pagado.
 */
export function PartnerDistributionsPanel({ partnerId }: { partnerId: number }) {
    const { distributions, isLoading, error, refetch } = useProfitDistributions()
    const table = usePartnerTableSearch({ prefix: "dst", textOf, select })
    const rows = useMemo<PartnerDistributionRow[]>(() => distributions.flatMap(d =>
        (d.lines ?? []).filter(l => l.partner === partnerId).map(l => ({
            id: l.id,
            distributionId: d.id,
            displayId: d.display_id,
            fiscalYear: d.fiscal_year,
            status: d.status,
            percentage: Number(l.percentage_at_date) || 0,
            gross: Number(l.gross_amount) || 0,
            offset: Number(l.provisional_withdrawals_offset) || 0,
            net: Number(l.net_amount) || 0,
            paid: Number(l.paid_dividend_amount) || 0,
        })),
    ), [distributions, partnerId])
    const filtered = useMemo(() => table.apply(rows), [table, rows])
    const collection = useEntityCollection(
        partnerDistributionEntity,
        { rows: filtered, isLoading, error: !!error, refetch, isFiltered: table.search.isFiltered },
        { pagination: { mode: "client", pageSize: 10 } },
    )
    return (
        <div className="p-4 h-full min-h-0 flex flex-col">
            <Collection.Root collection={collection}>
                <Collection.Toolbar>
                    <PartnerTableSearchBar table={table} placeholder="Buscar distribución..." />
                </Collection.Toolbar>
                <Collection.View
                    table={partnerDistributionViews.table}
                    emptyTitle="Sin distribuciones"
                    emptyDescription="Este socio no participa en ninguna resolución de distribución de utilidades."
                    onResetFilters={() => void table.search.clearAll()}
                />
            </Collection.Root>
        </div>
    )
}
