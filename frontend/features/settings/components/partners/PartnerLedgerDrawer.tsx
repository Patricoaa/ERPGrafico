"use client"

import React, { useEffect, useState, useMemo } from "react"
import {
    History,
    Wallet,
    LogOut
} from "lucide-react"
import { Drawer, DataTable, SkeletonShell, DataCell, UnifiedSearchBar, useUnifiedSearch } from "@/components/shared"
import { partnersApi } from "@/features/contacts"
import { type PartnerStatement, type PartnerTransaction } from "@/features/contacts"
import { toast } from "sonner"
import {parseDateOnly} from "@/lib/utils"
import type { UnifiedSearchConfig } from '@/types/unified-search'

import { type ColumnDef } from "@tanstack/react-table"
import { PartnerContributionWizard } from "@/features/settings/components/partners/PartnerContributionWizard"
import { PartnerWithdrawalWizard } from "@/features/settings/components/partners/PartnerWithdrawalWizard"

const TRANSACTION_TYPE_OPTIONS = [
    { value: "SUBSCRIPTION", label: "Suscripción de Capital" },
    { value: "REDUCTION", label: "Reducción de Capital" },
    { value: "CAPITAL_CASH", label: "Aporte Efectivo" },
    { value: "CAPITAL_INVENTORY", label: "Aporte en Bienes" },
    { value: "PROV_WITHDRAWAL", label: "Retiro Provisorio" },
    { value: "WITHDRAWAL", label: "Retiro de Utilidades" },
    { value: "DIVIDEND", label: "Distribución" },
    { value: "DIVIDEND_PAY", label: "Pago de Dividendo" },
    { value: "REINVESTMENT", label: "Reinversión" },
    { value: "RETAINED", label: "Utilidades Retenidas" },
    { value: "LOSS_ABSORB", label: "Absorción" },
    { value: "TRANSFER_IN", label: "Transferencia (In)" },
    { value: "TRANSFER_OUT", label: "Transferencia (Out)" },
]

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
                options: TRANSACTION_TYPE_OPTIONS,
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

    const isInflow = (type: string) => [
        'SUBSCRIPTION', 'CAPITAL_CASH', 'CAPITAL_INVENTORY',
        'TRANSFER_IN', 'REINVESTMENT', 'RETAINED'
    ].includes(type)

    const isOutflow = (type: string) => [
        'WITHDRAWAL', 'PROV_WITHDRAWAL', 'REDUCTION',
        'TRANSFER_OUT', 'LOSS_ABSORB', 'DIVIDEND_PAY'
    ].includes(type)

    const getTransactionIntent = (type: string): "info" | "warning" | "success" | "destructive" | "neutral" => {
        if (type === 'SUBSCRIPTION') return 'info'
        if (type.includes('TRANSFER')) return 'warning'
        if (isInflow(type)) return 'success'
        if (isOutflow(type)) return 'destructive'
        return 'neutral'
    }

    type TransactionWithBalance = PartnerTransaction & { balance_after: number }

    const columns: ColumnDef<TransactionWithBalance>[] = [
        {
            accessorKey: "date",
            header: "Fecha",
            cell: ({ row }) => (
                <DataCell.Date value={row.getValue("date")} />
            )
        },
        {
            accessorKey: "transaction_type",
            header: "Tipo",
            cell: ({ row }) => (
                <DataCell.Chip intent={getTransactionIntent(row.original.transaction_type)}>
                    {row.original.transaction_type_display}
                </DataCell.Chip>
            )
        },
        {
            accessorKey: "amount",
            header: () => <div className="text-right">Monto</div>,
            cell: ({ row }) => {
                const type = row.original.transaction_type
                const direction = isInflow(type) ? 'inflow' : isOutflow(type) ? 'outflow' : 'neutral' as const
                return <DataCell.CurrencyFlow value={row.getValue("amount")} direction={direction} />
            }
        },
        {
            accessorKey: "balance_after",
            header: () => <div className="text-right">Saldo</div>,
            cell: ({ row }) => (
                <DataCell.Currency value={row.getValue("balance_after")} className="text-right font-mono text-[11px] font-black text-primary" />
            )
        },
    ]

    // We need to calculate balance_after specifically for this partner's chronological list
    const transactionsWithBalance = React.useMemo(() => {
        if (!data?.transactions) return []
        const sorted = [...data.transactions].sort((a, b) => parseDateOnly(a.date).getTime() - parseDateOnly(b.date).getTime())
        let balance = 0
        const withBal = sorted.map(tx => {
            const amount = parseFloat(tx.amount) || 0
            if (isInflow(tx.transaction_type)) balance += amount
            else if (isOutflow(tx.transaction_type)) balance -= amount
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
        >
            {loading ? (
                <div className="p-4">
                    <SkeletonShell isLoading ariaLabel="Cargando..." />
                </div>
            ) : (
                <div className="p-4 animate-in fade-in duration-500 flex-1 min-h-0 flex flex-col">
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
