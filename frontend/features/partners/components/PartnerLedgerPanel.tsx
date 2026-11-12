"use client"

import React, { useEffect, useMemo } from "react"
import { SkeletonShell, UnifiedSearchBar, useUnifiedSearch } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { usePartnerStatement } from "../hooks"
import { toast } from "sonner"
import { parseDateOnly } from "@/lib/utils"
import type { UnifiedSearchConfig } from '@/types/unified-search'

import {
    partnerLedgerEntity,
    partnerLedgerViews,
    isInflowType,
    isOutflowType,
    PARTNER_TRANSACTION_TYPE_OPTIONS,
    type PartnerLedgerRow,
} from "../entity-view/partnerLedger.entity"

interface PartnerLedgerPanelProps {
    partnerId: number
}

/** Libro auxiliar del socio: pestaña «Libro» de `PartnerDrawer`. */
export function PartnerLedgerPanel({ partnerId }: PartnerLedgerPanelProps) {
    const { data: statement, isLoading: loading, isError } = usePartnerStatement(partnerId)
    const data = statement ?? null

    useEffect(() => {
        if (isError) toast.error("Error al cargar movimientos del socio")
    }, [isError])

    const partnerSearchConfig = useMemo<UnifiedSearchConfig>(() => ({
        searchFields: [],
        filters: [
            {
                type: 'single',
                key: 'transaction_type',
                label: 'Tipo',
                serverParam: 'transaction_type',
                options: PARTNER_TRANSACTION_TYPE_OPTIONS,
            },
        ],
    }), [])

    const search = useUnifiedSearch(partnerSearchConfig)

    const transactionsWithBalance = React.useMemo<PartnerLedgerRow[]>(() => {
        if (!data?.transactions) return []
        const sorted = [...data.transactions].sort((a, b) => {
            const dateDiff = parseDateOnly(a.date).getTime() - parseDateOnly(b.date).getTime()
            if (dateDiff !== 0) return dateDiff
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        })
        let balance = 0
        const withBal = sorted.map(tx => {
            const amount = parseFloat(tx.amount) || 0
            if (isInflowType(tx.transaction_type)) balance += amount
            else if (isOutflowType(tx.transaction_type)) balance -= amount
            return { ...tx, balance_after: balance }
        })
        return withBal.reverse()
    }, [data])

    const filteredTransactions = useMemo(() => {
        if (!search.filters.transaction_type) return transactionsWithBalance
        return transactionsWithBalance.filter(tx => tx.transaction_type === search.filters.transaction_type)
    }, [transactionsWithBalance, search.filters])

    const collection = useEntityCollection(
        partnerLedgerEntity,
        { rows: filteredTransactions },
        { pagination: { mode: "none" } },
    )

    if (loading) {
        return (
            <div className="p-4">
                <SkeletonShell isLoading ariaLabel="Cargando libro del socio" />
            </div>
        )
    }

    return (
        <div className="p-4 h-full min-h-0 flex flex-col">
            <Collection.Root collection={collection}>
                <Collection.Toolbar>
                    <UnifiedSearchBar
                        config={partnerSearchConfig}
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
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={partnerLedgerViews.table}
                    emptyTitle="Sin movimientos"
                    emptyDescription="Este socio no tiene transacciones registradas."
                />
            </Collection.Root>
        </div>
    )
}
