"use client"

import React, { useEffect, useState } from "react"
import {
    ArrowDownLeft,
    ArrowUpRight,
    Wallet,
    Calendar,
    Package,
    LogOut,
    History
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { TableRow, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { partnersApi } from "@/features/contacts/api/partnersApi"
import { Partner, PartnerTransaction } from "@/features/contacts/types/partner"
import { toast } from "sonner"
import { formatCurrency, formatPlainDate as formatDate, cn } from "@/lib/utils"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PartnerContributionWizard } from "@/features/settings/components/partners/PartnerContributionWizard"
import { PartnerWithdrawalWizard } from "@/features/settings/components/partners/PartnerWithdrawalWizard"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"

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
        fetchData()
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

    const getTransactionIcon = (type: string) => {
        if (isInflow(type)) return <ArrowUpRight className="h-3.5 w-3.5 text-success" />
        if (isOutflow(type)) return <ArrowDownLeft className="h-3.5 w-3.5 text-destructive" />
        return <History className="h-3.5 w-3.5 text-muted-foreground" />
    }

    const getTransactionColor = (type: string) => {
        if (type === 'SUBSCRIPTION') return 'bg-info/10 text-info border-info/20'
        if (type.includes('TRANSFER')) return 'bg-warning/10 text-warning border-warning/20'
        if (isInflow(type)) return 'bg-success/10 text-success border-success/20'
        if (isOutflow(type)) return 'bg-destructive/10 text-destructive border-destructive/20'
        return 'bg-muted/50 text-muted-foreground border-transparent'
    }

    type TransactionWithBalance = PartnerTransaction & { balance_after: number }

    // Calculate Running Balance
    const txsWithBalance = React.useMemo(() => {
        const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        let balance = 0
        const withBal = sorted.map(tx => {
            const amount = parseFloat(tx.amount) || 0
            if (isInflow(tx.transaction_type)) balance += amount
            else if (isOutflow(tx.transaction_type)) balance -= amount
            return { ...tx, balance_after: balance }
        })
        return withBal.reverse() // Display newest first
    }, [transactions])

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
            cell: ({ row }) => <span className="text-[11px] font-black tracking-tight">{row.getValue("partner_name")}</span>,
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
                    <Badge variant="outline" className={cn("text-[8px] font-black uppercase tracking-wider w-fit h-4 px-1.5 leading-none", getTransactionColor(row.original.transaction_type))}>
                        {row.original.transaction_type_display}
                    </Badge>
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
                    <Button variant="ghost" className="h-6 px-2 text-[9px] font-mono hover:bg-primary/5 hover:text-primary transition-all rounded-sm">
                        {val as string}
                    </Button>
                ) : <span className="text-muted-foreground/30 px-2">-</span>
            }
        },
        {
            accessorKey: "amount",
            header: () => <div className="text-right pr-4">Monto</div>,
            cell: ({ row }) => {
                const type = row.original.transaction_type
                const amount = parseFloat(row.getValue("amount"))
                return (
                    <div className="flex items-center justify-end gap-1 font-mono text-[11px] font-black pr-4">
                        {getTransactionIcon(type)}
                        <span className={isOutflow(type) ? 'text-destructive' : 'text-success'}>
                            {isOutflow(type) ? '-' : '+'}{formatCurrency(amount)}
                        </span>
                    </div>
                )
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
        <div className="space-y-4">
            <DataTable
                columns={columns}
                data={txsWithBalance}
                isLoading={loading}
                cardMode={true}
                useAdvancedFilter={true}
                searchPlaceholder="Buscar por descripción..."
                filterColumn="description"
                hiddenColumns={["transaction_type"]}
                facetedFilters={[
                    {
                        column: "partner_name",
                        title: "Socio",
                        options: partners.map(p => ({ label: p.name, value: p.name }))
                    },
                    {
                        column: "transaction_type",
                        title: "Tipo",
                        options: TRANSACTION_TYPE_OPTIONS
                    }
                ]}
                toolbarAction={
                    <>
                        <DropdownMenuItem
                            className="flex items-center px-3 py-2 text-[10px] font-black uppercase tracking-widest text-success focus:bg-success/10 focus:text-success cursor-pointer transition-colors"
                            onClick={() => setIsContributionOpen(true)}
                        >
                            <Wallet className="h-4 w-4 mr-2" />
                            Registrar Aporte
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="flex items-center px-3 py-2 text-[10px] font-black uppercase tracking-widest text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer transition-colors"
                            onClick={() => setIsWithdrawalOpen(true)}
                        >
                            <LogOut className="h-4 w-4 mr-2" />
                            Registrar Retiro
                        </DropdownMenuItem>
                    </>
                }
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
                                        <Badge variant="outline" className="bg-primary/5 text-primary text-[9px] font-mono border-primary/20">
                                            {rows.length} MOVIMIENTOS
                                        </Badge>
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
                            <TableCell className="text-right pr-6 py-4">
                                <div className="flex flex-col items-end">
                                    <span className="text-[9px] font-black uppercase text-primary tracking-[0.2em] mb-1.5 opacity-60">Running Balance</span>
                                    <div className="bg-primary text-primary-foreground px-3 py-1.5 rounded text-sm font-black tracking-tighter shadow-lg shadow-primary/10">
                                        {rows.length > 0 ? formatCurrency(rows[0].original.balance_after) : '$0'}
                                    </div>
                                </div>
                            </TableCell>
                        </TableRow>
                    )
                }}
            />

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
