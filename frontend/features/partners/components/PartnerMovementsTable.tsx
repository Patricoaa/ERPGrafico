"use client"

import { useMemo, type ReactNode } from "react"
import { Collection, useEntityCollection } from "@/components/entity-view"
import type { PartnerTransaction } from "@/features/contacts"
import { partnerMovementEntity, partnerMovementViews } from "../entity-view/partnerMovement.entity"
import { PARTNER_TRANSACTION_TYPE_OPTIONS } from "../entity-view/partnerLedger.entity"
import { usePartnerTableSearch } from "../hooks"
import { partnerTransactionActions } from "./partnerTransactionActions"
import { PartnerTableSearchBar } from "./PartnerTableSearchBar"
import { useOptionalGlobalModalActions } from "@/components/providers/GlobalModalProvider"

interface PartnerMovementsTableProps {
    rows: PartnerTransaction[]
    isLoading: boolean
    isError: boolean
    refetch: () => void
    /** Acción secundaria a la derecha de la barra de búsqueda (p. ej. transferir capital). */
    action?: ReactNode
}

const textOf = (tx: PartnerTransaction) => `${tx.transaction_type_display} ${tx.description ?? ""} ${tx.date}`
const select = { label: "Tipo", options: PARTNER_TRANSACTION_TYPE_OPTIONS, valueOf: (tx: PartnerTransaction) => tx.transaction_type }

/** Todos los movimientos del socio con búsqueda, filtro por tipo y paginación; loading/empty/error los resuelve `Collection`. */
export function PartnerMovementsTable({ rows, isLoading, isError, refetch, action }: PartnerMovementsTableProps) {
    const openEntity = useOptionalGlobalModalActions()?.openEntity
    const table = usePartnerTableSearch({ prefix: "mov", textOf, select })
    const filtered = useMemo(() => table.apply(rows), [table, rows])
    const collection = useEntityCollection(
        partnerMovementEntity,
        { rows: filtered, isLoading, error: isError, refetch, isFiltered: table.search.isFiltered },
        { pagination: { mode: "client", pageSize: 10 } },
    )
    return (
        <Collection.Root
            collection={collection}
            actions={partnerTransactionActions.forCollection({ onViewDocument: (label, id) => openEntity?.(label, id) })}
        >
            <Collection.Toolbar action={action}>
                <PartnerTableSearchBar table={table} placeholder="Buscar movimiento..." />
            </Collection.Toolbar>
            <Collection.View
                table={partnerMovementViews.table}
                emptyTitle="Sin movimientos"
                emptyDescription="Este socio no tiene movimientos registrados."
                onResetFilters={() => void table.search.clearAll()}
            />
        </Collection.Root>
    )
}
