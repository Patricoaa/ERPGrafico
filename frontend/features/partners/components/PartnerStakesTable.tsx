"use client"

import { useMemo } from "react"
import { Collection, useEntityCollection } from "@/components/entity-view"
import type { PartnerEquityStake } from "@/features/contacts"
import { usePartnerStakes, usePartnerTableSearch } from "../hooks"
import { partnerStakeEntity, partnerStakeViews } from "../entity-view/partnerStake.entity"
import { PartnerTableSearchBar } from "./PartnerTableSearchBar"

const textOf = (s: PartnerEquityStake) => `${s.effective_from} ${s.effective_until ?? ""} ${s.percentage} ${s.is_active ? "vigente" : "histórica"}`
const select = {
    label: "Estado",
    options: [{ value: "active", label: "Vigente" }, { value: "history", label: "Histórica" }],
    valueOf: (s: PartnerEquityStake) => (s.is_active ? "active" : "history"),
}

/** Vigencias históricas de la participación del socio, con búsqueda y paginación. */
export function PartnerStakesTable({ partnerId }: { partnerId: number }) {
    const { data: stakes = [], isLoading, isError, refetch } = usePartnerStakes(partnerId)
    const table = usePartnerTableSearch({ prefix: "stk", textOf, select })
    const filtered = useMemo(() => table.apply(stakes), [table, stakes])
    const collection = useEntityCollection(
        partnerStakeEntity,
        { rows: filtered, isLoading, error: isError, refetch, isFiltered: table.search.isFiltered },
        { pagination: { mode: "client", pageSize: 5 } },
    )
    return (
        <Collection.Root collection={collection}>
            <Collection.Toolbar>
                <PartnerTableSearchBar table={table} placeholder="Buscar vigencia..." />
            </Collection.Toolbar>
            <Collection.View table={partnerStakeViews.table} emptyTitle="Sin historial" emptyDescription="Aún no hay vigencias de participación registradas." onResetFilters={() => void table.search.clearAll()} />
        </Collection.Root>
    )
}
