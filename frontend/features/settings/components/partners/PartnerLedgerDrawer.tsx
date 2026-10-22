"use client"

import React, { useEffect, useState, useMemo } from "react"
import {
    History,
    Wallet,
    LogOut
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Drawer, SkeletonShell, UnifiedSearchBar, useUnifiedSearch } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { partnersApi } from "@/features/contacts"
import { type PartnerStatement } from "@/features/contacts"
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
} from "@/features/settings"
import { PartnerContributionWizard } from "@/features/settings/components/partners/PartnerContributionWizard"
import { PartnerWithdrawalWizard } from "@/features/settings/components/partners/PartnerWithdrawalWizard"

interface PartnerLedgerDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    partnerId?: number
    partnerName?: string
}

export function PartnerLedgerDrawer({
    open,
    onOpenChange,
    partnerId,
    partnerName
}: PartnerLedgerDrawerProps) {
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<PartnerStatement | null>(null)
    const [isContributionOpen, setIsContributionOpen] = useState(false)
    const [isWithdrawalOpen, setIsWithdrawalOpen] = useState(false)

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

    const fetchData = async () => {
        if (!partnerId) return
        setLoading(true)
        try {
            const statement = await partnersApi.getStatement(partnerId)
            setData(statement)
        } catch (error) {
            console.error(error)
            toast.error("Error al cargar movimientos del socio")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (open && partnerId) {
            requestAnimationFrame(() => {
                fetchData()
            })
        } else {
            setTimeout(() => setData(null), 0)
        }
    }, [open, partnerId])

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

    const toolbarAction = (
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-2 border-success/20 text-success hover:bg-success/5" onClick={() => setIsContributionOpen(true)}>
                <Wallet className="h-3.5 w-3.5" />
                Registrar Aporte
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-2 border-destructive/20 text-destructive hover:bg-destructive/5" onClick={() => setIsWithdrawalOpen(true)}>
                <LogOut className="h-3.5 w-3.5" />
                Registrar Retiro
            </Button>
        </div>
    )

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            title="Libro Auxiliar de Socio"
            subtitle={partnerName}
            icon={History}
            side="bottom"
            boundary="embedded"
            resizable={false}
            showOverlay={true}
            defaultSize="80%"
            viewportClassName="!overflow-hidden [&>div]:!block [&>div]:h-full [&>div]:min-h-0 [&>div]:overflow-hidden"
        >
            {loading ? (
                <div className="p-4">
                    <SkeletonShell isLoading ariaLabel="Cargando..." />
                </div>
            ) : (
                <div className="p-4 animate-in fade-in duration-500 h-full min-h-0 flex flex-col">
                    <Collection.Root collection={collection}>
                        <Collection.Toolbar action={toolbarAction}>
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
            )}

            <PartnerContributionWizard
                open={isContributionOpen}
                onOpenChange={setIsContributionOpen}
                onSuccess={fetchData}
                initialPartnerId={partnerId?.toString()}
            />
            <PartnerWithdrawalWizard
                open={isWithdrawalOpen}
                onOpenChange={setIsWithdrawalOpen}
                onSuccess={fetchData}
                initialPartnerId={partnerId?.toString()}
            />
        </Drawer>
    )
}
