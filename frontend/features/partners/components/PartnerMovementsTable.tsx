"use client"

import type { ReactNode } from "react"
import { Collection, useEntityCollection } from "@/components/entity-view"
import type { PartnerTransaction } from "@/features/contacts"
import { partnerMovementEntity, partnerMovementViews } from "../entity-view/partnerMovement.entity"
import { partnerTransactionActions } from "./partnerTransactionActions"
import { useOptionalGlobalModalActions } from "@/components/providers/GlobalModalProvider"

interface PartnerMovementsTableProps {
    rows: PartnerTransaction[]
    isLoading: boolean
    isError: boolean
    refetch: () => void
    emptyTitle: string
    emptyDescription: string
    toolbar?: ReactNode
}

/** Tabla de movimientos del socio (capital o resultados); loading/empty/error los resuelve `Collection`. */
export function PartnerMovementsTable({ rows, isLoading, isError, refetch, emptyTitle, emptyDescription, toolbar }: PartnerMovementsTableProps) {
    const openEntity = useOptionalGlobalModalActions()?.openEntity
    const collection = useEntityCollection(
        partnerMovementEntity,
        { rows, isLoading, error: isError, refetch },
        { pagination: { mode: "none" } },
    )
    return (
        <Collection.Root
            collection={collection}
            actions={partnerTransactionActions.forCollection({ onViewDocument: (label, id) => openEntity?.(label, id) })}
        >
            {toolbar && <Collection.Toolbar>{toolbar}</Collection.Toolbar>}
            <Collection.View table={partnerMovementViews.table} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
        </Collection.Root>
    )
}
