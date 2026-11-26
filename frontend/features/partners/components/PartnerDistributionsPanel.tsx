"use client"

import { useMemo } from "react"
import { Collection, useCollectionQuery, useEntityCollection } from "@/components/entity-view"
import { distributionPartnerEntity, distributionLineToRow, partnerProfitViews, toDistributionSearchRow, type DistributionPartnerSearchRow } from "../entity-view/distributionPartner.entity"
import { distributionPartnerActions } from "./distributionPartnerActions"
import { useOptionalGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { useProfitDistributions } from "../hooks"

/**
 * Pestaña Utilidades: las resoluciones de distribución de utilidades en las que participa el socio,
 * con su reparto (bruto, retiros provisorios compensados, neto y destino) y lo ya pagado; cada fila abre la distribución.
 */
export function PartnerDistributionsPanel({ partnerId }: { partnerId: number }) {
    const { distributions, isLoading, error, refetch } = useProfitDistributions()
    // Own URL keys (`dst_…`): the tab lives in the partner drawer, over the partners list.
    const query = useCollectionQuery(distributionPartnerEntity, { sorting: "client", urlPrefix: "dst_" })
    const { search } = query
    const openEntity = useOptionalGlobalModalActions()?.openEntity
    const rows = useMemo<DistributionPartnerSearchRow[]>(() => distributions.flatMap(d =>
        (d.lines ?? []).filter(l => l.partner === partnerId).map(l => toDistributionSearchRow(distributionLineToRow(l, d))),
    ), [distributions, partnerId])
    const filtered = useMemo(() => search.filterFn(rows), [search, rows])
    const collection = useEntityCollection(
        distributionPartnerEntity,
        { rows: filtered, isLoading, error: !!error, refetch, isFiltered: search.isFiltered },
        { pagination: { mode: "client", pageSize: 10 } },
    )
    return (
        <div className="p-4 h-full min-h-0 flex flex-col gap-3">
            <Collection.Root
                collection={collection}
                query={query}
                actions={distributionPartnerActions.forCollection({ onViewDistribution: id => openEntity?.("contacts.profitdistributionresolution", id) })}
            >
                <Collection.Toolbar />
                <Collection.View
                    table={partnerProfitViews.table}
                    emptyTitle="Sin utilidades"
                    emptyDescription="Este socio no participa en ninguna resolución de distribución de utilidades."
                    onResetFilters={() => void search.clearAll()}
                />
            </Collection.Root>
        </div>
    )
}
