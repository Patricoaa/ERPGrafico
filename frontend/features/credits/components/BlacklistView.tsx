"use client"

import React, { useState, useEffect, useCallback } from "react"
import { 
    getBlacklistedPortfolio, 
    getContactCreditLedger, 
    unblockContact, 
    recoverDebt 
} from "@/lib/credits/api"
import { CreditContact, CreditLedgerEntry } from "@/lib/credits/api"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef, flexRender } from "@tanstack/react-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
    ChevronDown, 
    ChevronRight, 
    UserCheck, 
    DollarSign, 
    AlertCircle,
    CheckCircle2,
    Clock,
    AlertTriangle
} from "lucide-react"
import { cn } from "@/lib/utils"
import { 
    Tooltip, 
    TooltipContent, 
    TooltipProvider, 
    TooltipTrigger 
} from "@/components/ui/tooltip"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { Skeleton } from "@/components/ui/skeleton"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { TableCell, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/components/shared/EmptyState"
import { LoadingFallback } from "@/components/shared/LoadingFallback"

const fmt = (v: any) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(v || 0))

const agingLabel: Record<string, string> = {
    'written_off': 'Castigado',
    'current': 'Vigente',
    'overdue_30': '1–30 días',
    'overdue_60': '31–60 días',
    'overdue_90': '61–90 días',
    'overdue_90plus': '+90 días',
}

const agingBg: Record<string, string> = {
    'written_off': 'bg-destructive/10 text-destructive border-destructive/20',
    'current': 'bg-success/10 text-success border-success/20',
    'overdue_30': 'bg-warning/10 text-warning border-warning/20',
    'overdue_60': 'bg-orange-500/10 text-orange-700 border-orange-200',
    'overdue_90': 'bg-destructive/10 text-destructive border-destructive/20',
    'overdue_90plus': 'bg-destructive/20 text-destructive border-destructive/30',
}

function ExpandableBlacklistRow({ row, onRefresh }: { row: any, onRefresh: () => void }) {
    const contact = row.original as CreditContact
    const [expanded, setExpanded] = useState(false)
    const [ledger, setLedger] = useState<CreditLedgerEntry[] | null>(null)
    const [loadingLedger, setLoadingLedger] = useState(false)
    const [unblocking, setUnblocking] = useState(false)
    const [recoveryAmount, setRecoveryAmount] = useState("")
    const [showRecoveryDialog, setShowRecoveryDialog] = useState(false)

    const handleExpand = useCallback(async () => {
        const next = !expanded
        setExpanded(next)
        if (next && !ledger) {
            setLoadingLedger(true)
            try {
                const data = await getContactCreditLedger(contact.id, true)
                setLedger(data)
            } catch (error) {
                console.error("Error fetching credit ledger:", error)
            } finally {
                setLoadingLedger(false)
            }
        }
    }, [expanded, ledger, contact.id])

    const handleUnblock = async () => {
        setUnblocking(true)
        try {
            await unblockContact(contact.id)
            toast.success("Cliente desbloqueado correctamente.")
            onRefresh()
        } catch (e: any) {
            toast.error(e.response?.data?.error || "Error al desbloquear cliente.")
        } finally {
            setUnblocking(false)
        }
    }

    const handleRecover = async () => {
        if (!recoveryAmount) return
        try {
            await recoverDebt(contact.id, recoveryAmount)
            toast.success(`Recuperación de ${fmt(recoveryAmount)} registrada correctamente.`)
            setShowRecoveryDialog(false)
            setRecoveryAmount("")
            onRefresh()
            const data = await getContactCreditLedger(contact.id, true)
            setLedger(data)
        } catch (e: any) {
            toast.error(e.response?.data?.error || "Error al registrar recuperación.")
        }
    }

    return (
        <>
            <TableRow
                className={cn(
                    "cursor-pointer hover:bg-muted/30 transition-colors text-sm",
                    expanded && "bg-muted/20"
                )}
                onClick={handleExpand}
            >
                {row.getVisibleCells().map((cell: any) => (
                    <TableCell key={cell.id} className="py-3 px-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                ))}
                <TableCell className="px-3 py-3 text-muted-foreground w-12 cursor-pointer text-center">
                    {expanded ? <ChevronDown className="h-4 w-4 mx-auto" /> : <ChevronRight className="h-4 w-4 mx-auto" />}
                </TableCell>
            </TableRow>

            <AnimatePresence>
                {expanded && (
                    <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={row.getVisibleCells().length + 1} className="p-0 border-b">
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden bg-background border-b border-border/50"
                            >
                                <div className="px-8 py-4 bg-background">
                                    <div className="mb-6 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-2">
                                            <AlertCircle className="h-4 w-4 text-destructive" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Historial de Castigos</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 gap-2 border-destructive/20 text-destructive hover:bg-destructive/5"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setShowRecoveryDialog(true)
                                                }}
                                            >
                                                <DollarSign className="h-3.5 w-3.5" />
                                                Registrar Pago
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 gap-2 border-success/20 text-success hover:bg-success/5"
                                                disabled={unblocking}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleUnblock()
                                                }}
                                            >
                                                <UserCheck className="h-3.5 w-3.5" />
                                                Rehabilitar Crédito
                                            </Button>
                                        </div>
                                    </div>

                                    {loadingLedger ? (
                                        <div className="space-y-2">
                                            {[1, 2].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
                                        </div>
                                    ) : ledger && ledger.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50">
                                                        <th className="pb-2 text-center">N° Documento</th>
                                                        <th className="pb-2 text-center">Fecha</th>
                                                        <th className="pb-2 text-center">Total</th>
                                                        <th className="pb-2 text-center">Pagado</th>
                                                        <th className="pb-2 text-center">Saldo</th>
                                                        <th className="pb-2 text-center">Estado</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border/20">
                                                    {ledger.map((entry) => (
                                                        <tr key={entry.id} className="text-[12px] group">
                                                            <td className="py-2 pr-4 text-center">
                                                                <span className="font-bold">NV-{entry.number}</span>
                                                            </td>
                                                            <td className="py-2 pr-4 text-muted-foreground text-center">{entry.date}</td>
                                                            <td className="py-2 pr-4 text-center font-mono">{fmt(entry.effective_total)}</td>
                                                            <td className="py-2 pr-4 text-center font-mono text-success font-medium">{fmt(entry.paid_amount)}</td>
                                                            <td className="py-2 pr-4 text-center font-mono font-bold">{fmt(entry.balance)}</td>
                                                            <td className="py-2 text-center">
                                                                <div className="flex justify-center">
                                                                    <span className={cn("text-[10px] items-center gap-1.5 font-bold px-2 py-0.5 rounded border inline-flex", agingBg[entry.aging_bucket as string])}>
                                                                        {(entry.aging_bucket as string) === 'written_off' ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                                                        {agingLabel[entry.aging_bucket as string]}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <p className="text-[12px] text-muted-foreground italic text-center py-4">Sin registros de deudas castigadas.</p>
                                    )}

                                    <AlertDialog open={showRecoveryDialog} onOpenChange={setShowRecoveryDialog}>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle className="font-black">Recuperación de Deuda</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Ingrese el monto recaudado para este cliente incobrable.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <div className="py-4">
                                                <Input 
                                                    type="number" 
                                                    placeholder="Ingrese monto..." 
                                                    value={recoveryAmount}
                                                    onChange={(e) => setRecoveryAmount(e.target.value)}
                                                    className="font-mono text-lg"
                                                />
                                            </div>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel className="font-bold">Cancelar</AlertDialogCancel>
                                                <AlertDialogAction
                                                    className="bg-primary font-bold"
                                                    onClick={handleRecover}
                                                    disabled={!recoveryAmount}
                                                >
                                                    Registrar Pago
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </motion.div>
                        </TableCell>
                    </TableRow>
                )}
            </AnimatePresence>
        </>
    )
}

export function BlacklistView() {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const res = await getBlacklistedPortfolio()
            setData(res)
        } catch (error) {
            console.error("Error fetching blacklist:", error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const columns: ColumnDef<CreditContact>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full text-center font-semibold text-[13px]">
                    <div>
                        <div className="font-bold text-foreground">
                            {row.original.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{row.original.tax_id}</div>
                    </div>
                </div>
            ),
        },
        {
            accessorKey: "credit_balance_used",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Deuda Actual" className="justify-center" />,
            cell: ({ row }) => {
                const val = Number(row.original.credit_balance_used)
                return (
                    <div className="flex justify-center w-full">
                        <div className="text-center font-mono font-bold text-[13px] text-destructive">{fmt(val)}</div>
                    </div>
                )
            },
        },
        {
            accessorKey: "credit_last_evaluated",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Bloqueado desde" className="justify-center text-muted-foreground" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <div className="text-center text-[11px] text-muted-foreground font-medium">{row.original.credit_last_evaluated ? new Date(row.original.credit_last_evaluated).toLocaleDateString() : "—"}</div>
                </div>
            ),
        }
    ]

    const contacts = data?.contacts || []

    return (
        <div className="space-y-6">
            <DataTable
                columns={columns}
                data={contacts}
                useAdvancedFilter
                searchPlaceholder="Buscar por cliente o RUT..."
                globalFilterFields={["name", "tax_id"]}
                cardMode
                isLoading={loading}
                renderCustomView={(table) => {
                    const rows = table.getRowModel().rows
                    if (rows.length === 0 && !loading) {
                        return (
                            <EmptyState
                                context="search"
                                title="Lista Negra Vacía"
                                description="No hay clientes bloqueados o en historial de castigos actualmente."
                            />
                        )
                    }
                    return (
                        <div className="overflow-x-auto pb-4">
                            <table className="w-full text-left">
                                <thead className="border-b border-border/50">
                                    {table.getHeaderGroups().map((headerGroup: any) => (
                                        <tr key={headerGroup.id}>
                                            {headerGroup.headers.map((header: any) => (
                                                <th key={header.id} className="px-4 py-3 text-muted-foreground font-black text-[10px] uppercase tracking-widest whitespace-nowrap">
                                                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                                </th>
                                            ))}
                                            <th className="px-3 py-3 w-12" />
                                        </tr>
                                    ))}
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {rows.map((row: any) => (
                                        <ExpandableBlacklistRow key={row.id} row={row} onRefresh={fetchData} />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                }}
            />
        </div>
    )
}
