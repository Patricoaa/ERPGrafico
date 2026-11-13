"use client"

import { useMemo } from "react"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { distributionPartnerEntity, distributionLineToRow, partnerProfitViews, type DistributionPartnerRow } from "../entity-view/distributionPartner.entity"
import { distributionPartnerActions } from "./distributionPartnerActions"
import { useOptionalGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { useProfitDistributions, usePartnerTableSearch } from "../hooks"
import { PartnerTableSearchBar } from "./PartnerTableSearchBar"

const textOf = (r: DistributionPartnerRow) => `${r.resolution?.displayId ?? ""} ${r.resolution?.fiscalYear ?? ""}`
const select = {
    label: "Estado",
    options: [
        { value: "DRAFT", label: "Borrador" }, { value: "APPROVED", label: "Aprobada" },
        { value: "EXECUTED", label: "Ejecutada" }, { value: "CANCELLED", label: "Anulada" },
    ],
    valueOf: (r: DistributionPartnerRow) => r.resolution?.status ?? "",
}

/**
 * Pestaña Utilidades: las resoluciones de distribución de utilidades en las que participa el socio,
 * con su reparto (bruto, retiros provisorios compensados, neto y destino) y lo ya pagado; cada fila abre la distribución.
 */
export function PartnerDistributionsPanel({ partnerId }: { partnerId: number }) {
    const { distributions, isLoading, error, refetch } = useProfitDistributions()
    const table = usePartnerTableSearch({ prefix: "dst", textOf, select })
    const openEntity = useOptionalGlobalModalActions()?.openEntity
    const rows = useMemo<DistributionPartnerRow[]>(() => distributions.flatMap(d =>
        (d.lines ?? []).filter(l => l.partner === partnerId).map(l => distributionLineToRow(l, d)),
    ), [distributions, partnerId])
    const filtered = useMemo(() => table.apply(rows), [table, rows])
    const collection = useEntityCollection(
        distributionPartnerEntity,
        { rows: filtered, isLoading, error: !!error, refetch, isFiltered: table.search.isFiltered },
        { pagination: { mode: "client", pageSize: 10 } },
    )
    return (
        <div className="p-4 h-full min-h-0 flex flex-col gap-3">
            <Collection.Root
                collection={collection}
                actions={distributionPartnerActions.forCollection({ onViewDistribution: id => openEntity?.("contacts.profitdistributionresolution", id) })}
            >
                <Collection.Toolbar>
                    <PartnerTableSearchBar table={table} placeholder="Buscar distribución..." />
                </Collection.Toolbar>
                <Collection.View
                    table={partnerProfitViews.table}
                    emptyTitle="Sin utilidades"
                    emptyDescription="Este socio no participa en ninguna resolución de distribución de utilidades."
                    onResetFilters={() => void table.search.clearAll()}
                />
            </Collection.Root>
        </div>
    )
}
