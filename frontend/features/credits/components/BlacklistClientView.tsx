"use client"

import { useState, useMemo } from "react"
import { type CreditContact } from '@/features/credits/api/creditsApi'
import { useBlacklistedPortfolio } from "../hooks/useCredits"
import { Collection, useCollectionQuery, useEntityCollection } from "@/components/entity-view"
import { creditContactEntity, blacklistContactViews } from "@/features/credits"
import { CreditContactLedgerDrawer } from "./CreditContactLedgerDrawer"

export function BlacklistClientView() {
    const { contacts: rawContacts, isLoading: loading, refetch: fetchData } = useBlacklistedPortfolio()
    const [ledgerContact, setLedgerContact] = useState<CreditContact | null>(null)

    const query = useCollectionQuery(creditContactEntity, { sorting: "client" })
    const { search, groupBy } = query
    const { filterFn } = search
    const contacts = useMemo(() => filterFn(rawContacts), [filterFn, rawContacts])

    const collection = useEntityCollection(
        creditContactEntity,
        { rows: loading ? [] : contacts, isFiltered: search.isFiltered },
        { pagination: { mode: "none" }, sorting: query.sorting, groupBy },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <CreditContactLedgerDrawer
                contact={ledgerContact}
                open={!!ledgerContact}
                onOpenChange={(open) => { if (!open) setLedgerContact(null) }}
                mode="blacklist"
                onRefresh={fetchData}
            />

            <div className="flex-1 flex flex-col min-h-0">
                <Collection.Root
                    collection={collection}
                    query={query}
                    onOpen={(contact) => setLedgerContact(contact)}
                >
                    <Collection.Toolbar />
                    <Collection.View
                        table={blacklistContactViews.table}
                        emptyTitle="Lista Negra Vacía"
                        emptyDescription="No hay clientes bloqueados o en historial de castigos actualmente."
                        onResetFilters={search.clearAll}
                    />
                </Collection.Root>
            </div>
        </div>
    )
}
