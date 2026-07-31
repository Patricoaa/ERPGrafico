"use client"

import React, { useEffect, useState, useMemo } from "react"
import {
    History,
    Wallet,
    LogOut
} from "lucide-react"
import { Drawer, DataTable, SkeletonShell, UnifiedSearchBar, useUnifiedSearch } from "@/components/shared"
import { partnersApi } from "@/features/contacts"
import { type PartnerStatement } from "@/features/contacts"
import { toast } from "sonner"
import { parseDateOnly } from "@/lib/utils"
import type { UnifiedSearchConfig } from '@/types/unified-search'

import {
    partnerLedgerFields,
    isInflowType,
    isOutflowType,
    PARTNER_TRANSACTION_TYPE_OPTIONS,
    type PartnerLedgerRow,
} from "@/features/settings/partnerLedgerFields"
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

    const columns = partnerLedgerFields.toColumns()

    // We need to calculate balance_after specifically for this partner's chronological list
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
                    <DataTable
                        columns={columns}
                        data={filteredTransactions}
                        isLoading={loading}
                        variant="embedded"
                        hiddenColumns={[]}
                        unifiedSearch={<UnifiedSearchBar
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
                        />}
                        showReset={search.isFiltered}
                        onReset={search.clearAll}
                        columnToggle
                        toolbarActions={[
                            { key: 'contribution', label: 'Registrar Aporte', icon: Wallet, onClick: () => setIsContributionOpen(true), intent: 'success' },
                            { key: 'withdrawal', label: 'Registrar Retiro', icon: LogOut, onClick: () => setIsWithdrawalOpen(true), intent: 'destructive' },
                        ]}
                    />
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
