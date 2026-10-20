"use client"

import { useState, useMemo } from "react"
import { type CreditContact } from '@/features/credits/api/creditsApi'
import { UnifiedSearchBar, useUnifiedSearch } from '@/components/shared'
import type { UnifiedSearchConfig } from '@/types/unified-search'
import { useBlacklistedPortfolio } from "../hooks/useCredits"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { creditContactEntity, blacklistContactViews } from "@/features/credits"
import { CreditContactLedgerDrawer } from "./CreditContactLedgerDrawer"

export function BlacklistClientView() {
    const { contacts: rawContacts, isLoading: loading, refetch: fetchData } = useBlacklistedPortfolio()
    const [ledgerContact, setLedgerContact] = useState<CreditContact | null>(null)

    const config: UnifiedSearchConfig = useMemo(() => ({
        searchFields: [
            { key: 'search', label: 'Cliente / RUT', serverParam: 'search', clientKey: ['name', 'tax_id'] },
        ],
        filters: [
            { key: 'risk_level', label: 'Riesgo', type: 'single', serverParam: 'risk_level', options: [
                { label: 'Bajo', value: 'LOW' },
                { label: 'Medio', value: 'MEDIUM' },
                { label: 'Alto', value: 'HIGH' },
                { label: 'Crítico', value: 'CRITICAL' },
            ]},
        ],
        groupBy: [
            { key: 'credit_risk_level', label: 'Riesgo', field: 'credit_risk_level' },
        ],
    }), [])
    const search = useUnifiedSearch(config)
    const contacts = useMemo(() => {
        let result = rawContacts
        if (search.filters.risk_level) result = result.filter(c => c.credit_risk_level === search.filters.risk_level)
        return search.filterFn(result)
    }, [rawContacts, search.filterFn, search.filters.risk_level])

    const collection = useEntityCollection(
        creditContactEntity,
        { rows: loading ? [] : contacts },
        { pagination: { mode: "none" } },
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
                    onOpen={(contact) => setLedgerContact(contact)}
                >
                    <Collection.Toolbar>
                        <UnifiedSearchBar
                            config={config}
                            chips={search.chips}
                            isFiltered={search.isFiltered}
                            inputValue={search.inputValue}
                            onInputChange={search.setInputValue}
                            onApply={search.applyFilter}
                            onRemove={search.removeFilter}
                            onClearAll={search.clearAll}
                            groupBy={search.groupBy}
                            onGroupBySelect={search.setGroupBy}
                            paramValues={search.paramValues}
                            placeholder="Cliente o RUT..."
                        />
                    </Collection.Toolbar>
                    <Collection.View
                        table={blacklistContactViews.table}
                        emptyTitle="Lista Negra Vacía"
                        emptyDescription="No hay clientes bloqueados o en historial de castigos actualmente."
                    />
                </Collection.Root>
            </div>
        </div>
    )
}
