"use client"

import React, { useEffect, useState } from "react"
import {
    History,
    ArrowUpRight,
    ArrowDownLeft,
    Calendar,
    ArrowDownCircle,
    ArrowUpCircle,
    Info,
    Receipt,
    Download,
    Plus,
    Wallet,
    LogOut
} from "lucide-react"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { SheetCloseButton } from "@/components/shared/SheetCloseButton"
import { partnersApi } from "@/features/contacts/api/partnersApi"
import { toast } from "sonner"
import { formatCurrency, formatPlainDate as formatDate, cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { Skeleton } from "@/components/ui/skeleton"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { PartnerContributionWizard } from "@/features/settings/components/partners/PartnerContributionWizard"
import { PartnerWithdrawalWizard } from "@/features/settings/components/partners/PartnerWithdrawalWizard"

interface PartnerLedgerModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    partnerId?: number
    partnerName?: string
}

export function PartnerLedgerModal({
    open,
    onOpenChange,
    partnerId,
    partnerName
}: PartnerLedgerModalProps) {
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<any>(null)
    const [isContributionOpen, setIsContributionOpen] = useState(false)
    const [isWithdrawalOpen, setIsWithdrawalOpen] = useState(false)

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
            fetchData()
        } else {
            setData(null)
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

    const columns: ColumnDef<any>[] = [
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
            accessorKey: "description",
            header: "Concepto",
            cell: ({ row }) => (
                <div className="flex flex-col gap-0.5">
                    <Badge variant="outline" className={cn("text-[8px] font-black uppercase tracking-wider w-fit h-4 px-1.5 leading-none", getTransactionColor(row.original.transaction_type))}>
                        {row.original.transaction_type_display}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground italic truncate max-w-[250px] leading-tight">
                        {row.getValue("description")}
                    </span>
                </div>
            )
        },
        {
            accessorKey: "journal_entry_display",
            header: "Asiento",
            cell: ({ row }) => {
                const val = row.getValue("journal_entry_display")
                return val ? (
                    <span className="text-[9px] font-mono py-0.5 px-1 bg-muted rounded border opacity-70">
                        {val as string}
                    </span>
                ) : <span className="text-muted-foreground/30 px-2">-</span>
            }
        },
        {
            accessorKey: "amount",
            header: () => <div className="text-right">Monto</div>,
            cell: ({ row }) => {
                const type = row.original.transaction_type
                const amount = parseFloat(row.getValue("amount"))
                return (
                    <div className="flex items-center justify-end gap-1 font-mono text-[11px] font-black">
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
                <div className="text-right font-mono text-[11px] font-black text-primary bg-primary/5 px-2 py-1 relative ring-1 ring-primary/10">
                    {formatCurrency(row.getValue("balance_after"))}
                </div>
            )
        }
    ]

    // We need to calculate balance_after specifically for this partner's chronological list
    const transactionsWithBalance = React.useMemo(() => {
        if (!data?.transactions) return []
        const sorted = [...data.transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        let balance = 0
        const withBal = sorted.map(tx => {
            const amount = parseFloat(tx.amount) || 0
            if (isInflow(tx.transaction_type)) balance += amount
            else if (isOutflow(tx.transaction_type)) balance -= amount
            return { ...tx, balance_after: balance }
        })
        return withBal.reverse()
    }, [data])

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                hideOverlay={true}
                hideCloseButton={true}
                className="h-[85vh] sm:h-[90vh] p-0 border-t-0 bg-background rounded-t-[2.5rem] shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.25)] flex flex-col"
            >
                {/* Visual Handle for "Drawer" feel */}
                <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full mx-auto my-4 shrink-0 shadow-inner" />

                <SheetCloseButton 
                    onClick={() => onOpenChange(false)}
                    className="absolute top-4 right-8 z-[60]"
                />

                <SheetHeader className="px-8 pb-2 space-y-0">
                    <SheetTitle>
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                <History className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xl font-black tracking-tight text-foreground leading-none">Libro Auxiliar de Socio</span>
                                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-1 opacity-60">{partnerName}</span>
                            </div>
                        </div>
                    </SheetTitle>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-8 pb-8 scrollbar-thin scrollbar-thumb-primary/10 scrollbar-track-transparent">
                    {loading ? (
                        <div className="space-y-6 mt-4">
                            <Skeleton className="h-96 w-full rounded-lg" />
                        </div>
                    ) : (
                        <div className="mt-4 animate-in fade-in duration-500">
                            <DataTable
                                columns={columns}
                                data={transactionsWithBalance}
                                isLoading={loading}
                                cardMode={false}
                                searchPlaceholder="Filtrar por concepto (ej: aporte, retiro)..."
                                filterColumn="description"
                                toolbarAction={
                                    <>
                                        <DropdownMenuItem
                                            onClick={() => setIsContributionOpen(true)}
                                            className="flex items-center px-3 py-2 text-[10px] font-black uppercase tracking-widest text-success focus:bg-success/10 focus:text-success cursor-pointer transition-colors"
                                        >
                                            <Wallet className="h-4 w-4 mr-2" />
                                            Registrar Aporte
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => setIsWithdrawalOpen(true)}
                                            className="flex items-center px-3 py-2 text-[10px] font-black uppercase tracking-widest text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer transition-colors"
                                        >
                                            <LogOut className="h-4 w-4 mr-2" />
                                            Registrar Retiro
                                        </DropdownMenuItem>
                                    </>
                                }
                            />
                        </div>
                    )}
                </div>
            </SheetContent>

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
        </Sheet>
    )
}
