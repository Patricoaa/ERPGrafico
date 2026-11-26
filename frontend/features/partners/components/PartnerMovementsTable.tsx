"use client"

import { useMemo } from "react"
import { Collection, useCollectionQuery, useEntityCollection } from "@/components/entity-view"
import type { PartnerTransaction } from "@/features/contacts"
import { partnerMovementEntity, partnerMovementViews } from "../entity-view/partnerMovement.entity"
import { partnerTransactionActions } from "./partnerTransactionActions"
import { useOptionalGlobalModalActions } from "@/components/providers/GlobalModalProvider"

interface PartnerMovementsTableProps {
    rows: PartnerTransaction[]
    isLoading: boolean
    isError: boolean
    refetch: () => void
}

/**
 * Todos los movimientos del socio con barra de comandos (búsqueda, tipo, orden y agrupación) en el navegador
 * y paginación; claves de URL propias (`mov_…`). loading/empty/error los resuelve `Collection`.
 */
export function PartnerMovementsTable({ rows, isLoading, isError, refetch }: PartnerMovementsTableProps) {
    const openEntity = useOptionalGlobalModalActions()?.openEntity
    const query = useCollectionQuery(partnerMovementEntity, { sorting: "client", urlPrefix: "mov_" })
    const { search, groupBy } = query
    const filtered = useMemo(() => search.filterFn(rows), [search, rows])
    const collection = useEntityCollection(
        partnerMovementEntity,
        { rows: filtered, isLoading, error: isError, refetch, isFiltered: search.isFiltered },
        { pagination: groupBy ? { mode: "none" } : { mode: "client", pageSize: 10 }, groupBy, sorting: query.sorting },
    )
    return (
        <Collection.Root
            collection={collection}
            query={query}
            actions={partnerTransactionActions.forCollection({ onViewDocument: (label, id) => openEntity?.(label, id) })}
        >
            <Collection.Toolbar />
            <Collection.View
                table={partnerMovementViews.table}
                emptyTitle="Sin movimientos"
                emptyDescription="Este socio no tiene movimientos registrados."
                onResetFilters={() => void search.clearAll()}
            />
        </Collection.Root>
    )
}
