"use client"
import { formatCurrency } from "@/lib/money"

import React, { useEffect, useState, useMemo } from "react"
import {
    Wallet,
    Calendar,
    LogOut
} from "lucide-react"
import { TableRow, TableCell } from "@/components/ui/table"

import { DataCell } from "@/components/shared"
import { partnersApi } from "@/features/contacts"
import { type Partner, type PartnerTransaction } from "@/features/contacts"
import { toast } from "sonner"
import {formatPlainDate as formatDate, parseDateOnly} from "@/lib/utils"
import { PartnerContributionWizard } from "@/features/settings/components/partners/PartnerContributionWizard"
import { PartnerWithdrawalWizard } from "@/features/settings/components/partners/PartnerWithdrawalWizard"
import { DataTable, UnifiedSearchBar, useUnifiedSearch } from '@/components/shared'
import { type ColumnDef } from "@tanstack/react-table"
import type { UnifiedSearchConfig } from '@/types/unified-search'

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

export function PartnerLedgerTab() {
    const [loading, setLoading] = useState(true)
    const [transactions, setTransactions] = useState<PartnerTransaction[]>([])
    const [partners, setPartners] = useState<Partner[]>([])

    // Movement Modals
    const [isContributionOpen, setIsContributionOpen] = useState(false)
    const [isWithdrawalOpen, setIsWithdrawalOpen] = useState(false)

    const fetchData = async () => {
        setLoading(true)
        try {
            const [pData, tData] = await Promise.all([
                partnersApi.getPartners(),
                partnersApi.getTransactions()
            ])
            setPartners(pData)
            setTransactions(tData)
        } catch (error) {
            console.error(error)
            toast.error("Error al cargar el libro auxiliar")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        requestAnimationFrame(() => {
            fetchData()
        })
    }, [])

    // Identify Inflow vs Outflow types for UI and Balance
    const isInflow = (type: string) => [
        'SUBSCRIPTION', 'CAPITAL_CASH', 'CAPITAL_INVENTORY',
        'TRANSFER_IN', 'REINVESTMENT', 'RETAINED'
    ].includes(type)

    const isOutflow = (type: string) => [
        'WITHDRAWAL', 'PROV_WITHDRAWAL', 'REDUCTION',
        'TRANSFER_OUT', 'LOSS_ABSORB', 'DIVIDEND_PAY'
    ].includes(type)

    const getTransactionColor = (type: string) => {
        if (type === 'SUBSCRIPTION') return 'bg-info/10 text-info border-info/20'
        if (type.includes('TRANSFER')) return 'bg-warning/10 text-warning border-warning/20'
        if (isInflow(type)) return 'bg-success/10 text-success border-success/20'
        if (isOutflow(type)) return 'bg-destructive/10 text-destructive border-destructive/20'
        return 'bg-muted/50 text-muted-foreground border-transparent'
    }

    const getTransactionIntent = (type: string): "info" | "warning" | "success" | "destructive" | "neutral" => {
        if (type === 'SUBSCRIPTION') return 'info'
        if (type.includes('TRANSFER')) return 'warning'
        if (isInflow(type)) return 'success'
        if (isOutflow(type)) return 'destructive'
        return 'neutral'
    }

    const partnerSearchConfig = useMemo<UnifiedSearchConfig>(() => ({
        searchFields: [],
        filters: [
            {
                type: 'single',
                key: 'partner',
                label: 'Socio',
                serverParam: 'partner',
                options: partners.map(p => ({ label: p.name, value: p.name })),
            },
            {
                type: 'single',
                key: 'transaction_type',
                label: 'Tipo',
                serverParam: 'transaction_type',
                options: TRANSACTION_TYPE_OPTIONS.map(o => ({ label: o.label, value: o.value })),
            },
        ],
    }), [partners])

    const search = useUnifiedSearch(partnerSearchConfig)

    type TransactionWithBalance = PartnerTransaction & { balance_after: number }

    // Calculate Running Balance
    const txsWithBalance = React.useMemo(() => {
        const sorted = [...transactions].sort((a, b) => parseDateOnly(a.date).getTime() - parseDateOnly(b.date).getTime())
        const { result } = sorted.reduce<{ result: Array<PartnerTransaction & { balance_after: number }>, balance: number }>(
            (acc, tx) => {
                const amount = parseFloat(tx.amount) || 0
                let newBalance = acc.balance
                if (isInflow(tx.transaction_type)) newBalance += amount
                else if (isOutflow(tx.transaction_type)) newBalance -= amount
                return { result: [...acc.result, { ...tx, balance_after: newBalance }], balance: newBalance }
            },
            { result: [], balance: 0 }
        )
        return result.reverse() // Display newest first
    }, [transactions])

    const filteredTxsWithBalance = useMemo(() => {
        let result = txsWithBalance
        if (search.filters.partner) {
            result = result.filter(tx =>
                tx.partner_name === search.filters.partner || tx.partner?.toString() === search.filters.partner
            )
        }
        if (search.filters.transaction_type) {
            result = result.filter(tx => tx.transaction_type === search.filters.transaction_type)
        }
        return result
    }, [txsWithBalance, search.filters])

    const columns: ColumnDef<TransactionWithBalance>[] = [
        {
            accessorKey: "date",
            header: "Fecha",
            cell: ({ row }) => (
                <div className="flex items-center gap-2 text-[10px] font-mono whitespace-nowrap opacity-80">
                    <Calendar className="h-3 w-3 opacity-40 shrink-0" />
                    {formatDate(row.getValue("date"))}
                </div>
            )
        },
        {
            accessorKey: "partner_name",
            header: "Socio",
            cell: ({ row }) => <DataCell.Text>{row.getValue("partner_name") as string}</DataCell.Text>,
            filterFn: (row, id, value) => {
                // value comes from selection
                return value.length === 0 || value.includes(row.original.partner?.toString()) || value.includes(row.original.partner_name)
            }
        },
        {
            accessorKey: "description",
            header: "Concepto",
            cell: ({ row }) => (
                <div className="flex flex-col gap-0.5">
                    <DataCell.Chip intent={getTransactionIntent(row.original.transaction_type)}>{row.original.transaction_type_display}</DataCell.Chip>
                    <span className="text-[10px] text-muted-foreground italic truncate max-w-[180px] leading-tight">
                        {row.getValue("description")}
                    </span>
                </div>
            )
        },
        {
            accessorKey: "journal_entry_display",
            header: "Referencia",
            cell: ({ row }) => {
                const val = row.getValue("journal_entry_display")
                return val ? (
                    <DataCell.Code>{val as string}</DataCell.Code>
                ) : <DataCell.Code>{''}</DataCell.Code>
            }
        },
        {
            accessorKey: "amount",
            header: () => <div className="text-right pr-4">Monto</div>,
            cell: ({ row }) => {
                const type = row.original.transaction_type
                const direction = isInflow(type) ? 'inflow' : isOutflow(type) ? 'outflow' : 'neutral' as const
                return <DataCell.CurrencyFlow value={row.getValue("amount")} direction={direction} className="pr-4" />
            }
        },
        {
            accessorKey: "balance_after",
            header: () => <div className="text-right">Saldo</div>,
            cell: ({ row }) => (
                <div className="text-right font-mono text-[11px] font-black text-primary bg-primary/5 px-2 py-1 relative after:absolute after:left-0 after:top-0 after:bottom-0 after:w-[2px] after:bg-primary/30">
                    {formatCurrency(row.getValue("balance_after"))}
                </div>
            )
        },
        {
            accessorKey: "transaction_type",
            header: "Tipo",
            // We'll hide this column via DataTable props
        }
    ]

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTable
                columns={columns}
                data={filteredTxsWithBalance}
                isLoading={loading}
                variant="embedded"
                hiddenColumns={["transaction_type"]}
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
                toolbarActions={[
                    { key: 'contribution', label: 'Registrar Aporte', icon: Wallet, onClick: () => setIsContributionOpen(true), intent: 'success' },
                    { key: 'withdrawal', label: 'Registrar Retiro', icon: LogOut, onClick: () => setIsWithdrawalOpen(true), intent: 'destructive' },
                ]}
                renderFooter={(table) => {
                    const rows = table.getFilteredRowModel().rows
                    const totals = rows.reduce((acc, row) => {
                        const amount = parseFloat(row.original.amount) || 0
                        if (isInflow(row.original.transaction_type)) acc.inflows += amount
                        else if (isOutflow(row.original.transaction_type)) acc.outflows += amount
                        return acc
                    }, { inflows: 0, outflows: 0 })

                    return (
                        <TableRow className="bg-muted/10 font-bold hover:bg-muted/10 border-t-2">
                            <TableCell colSpan={3} className="pl-6 py-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Resumen de Selección</p>
                                    <div className="flex items-center gap-2">
                                        <DataCell.Chip intent="primary" className="bg-primary/5 border-primary/20">
                                            {rows.length} MOVIMIENTOS
                                        </DataCell.Chip>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex flex-col gap-0.5 text-[9px] font-black uppercase text-muted-foreground/60 pr-2">
                                    <span className="text-success/70">Entradas (+)</span>
                                    <span className="text-destructive/70">Salidas (-)</span>
                                    <span className="text-primary border-t border-primary/10 pt-1 mt-1 uppercase">Saldo Neto</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-[11px] pr-4">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-success font-bold">+{formatCurrency(totals.inflows)}</span>
                                    <span className="text-destructive font-bold">-{formatCurrency(totals.outflows)}</span>
                                    <span className="text-primary border-t border-primary/10 pt-1 mt-1 font-black text-xs leading-none">
                                        {formatCurrency(totals.inflows - totals.outflows)}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell className="text-right py-4">
                                <div className="flex flex-col items-end">
                                    <span className="text-[9px] font-black uppercase text-primary tracking-[0.2em] mb-1.5 opacity-60">Running Balance</span>
                                    <div className="bg-primary text-primary-foreground px-3 py-1.5 rounded text-sm font-black tracking-tighter shadow-floating shadow-primary/10">
                                        {rows.length > 0 ? formatCurrency(rows[0].original.balance_after) : '$0'}
                                    </div>
                                </div>
                            </TableCell>
                        </TableRow>
                    )
                }}
            />
            </div>

            {/* Movement Wizard Modals */}
            <PartnerContributionWizard
                open={isContributionOpen}
                onOpenChange={setIsContributionOpen}
                onSuccess={fetchData}
            />

            <PartnerWithdrawalWizard
                open={isWithdrawalOpen}
                onOpenChange={setIsWithdrawalOpen}
                onSuccess={fetchData}
            />
        </div>
    )
}
