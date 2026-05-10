"use client"

import React, { useState, useEffect, useCallback } from "react"
import { 
    getBlacklistedPortfolio, 
    getContactCreditLedger, 
    unblockContact, 
    recoverDebt 
} from '@/features/credits/api/creditsApi'
import { CreditContact, CreditLedgerEntry } from '@/features/credits/api/creditsApi'
import { formatCurrency } from "@/lib/utils"
import { DataTable } from "@/components/ui/data-table"
import { type Table as ReactTable, type Row, type HeaderGroup, type Header, type Cell, ColumnDef, flexRender } from "@tanstack/react-table"
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
import { TableSkeleton } from "@/components/shared"
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
import { DataCell } from "@/components/ui/data-table-cells"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { formatEntityDisplay } from "@/lib/entity-registry"

// ─── Sub-components ──────────────────────────────────────────────────────────

const agingBg: Record<string, string> = {
    'written_off': 'bg-destructive/10 text-destructive border-destructive/20',
    'current': 'bg-success/10 text-success border-success/20',
    'overdue_30': 'bg-warning/10 text-warning border-warning/20',
    'overdue_60': 'bg-warning/10 text-warning border-warning/20',
    'overdue_90': 'bg-destructive/10 text-destructive border-destructive/20',
    'overdue_90plus': 'bg-destructive/20 text-destructive border-destructive/30',
}

function ExpandableBlacklistRow({ row, onRefresh }: { row: Row<CreditContact>, onRefresh: () => void }) {
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
        } catch (error) {
            const e = error as { response?: { data?: { error?: string } } }
            toast.error(e.response?.data?.error || "Error al desbloquear cliente.")
        } finally {
            setUnblocking(false)
        }
    }

    const handleRecover = async () => {
        if (!recoveryAmount) return
        try {
            await recoverDebt(contact.id, recoveryAmount)
            toast.success(`Recuperación de ${formatCurrency(recoveryAmount)} registrada correctamente.`)
            setShowRecoveryDialog(false)
            setRecoveryAmount("")
            onRefresh()
            const data = await getContactCreditLedger(contact.id, true)
            setLedger(data)
        } catch (error) {
            const e = error as { response?: { data?: { error?: string } } }
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
                {row.getVisibleCells().map((cell: Cell<CreditContact, unknown>) => (
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
                                        <TableSkeleton rows={2} />
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
                                                                <DataCell.Code className="font-bold">{formatEntityDisplay('sales.saleorder', entry)}</DataCell.Code>
                                                            </td>
                                                            <td className="py-2 pr-4 text-center">
                                                                <DataCell.Date value={entry.date} className="text-muted-foreground" />
                                                            </td>
                                                            <td className="py-2 pr-4 text-center">
                                                                <DataCell.Currency value={entry.effective_total} />
                                                            </td>
                                                            <td className="py-2 pr-4 text-center">
                                                                <DataCell.Currency value={entry.paid_amount} className="text-success" />
                                                            </td>
                                                            <td className="py-2 pr-4 text-center">
                                                                <DataCell.Currency value={entry.balance} className="font-bold" />
                                                            </td>
                                                            <td className="py-2 text-center">
                                                                <div className="flex justify-center">
                                                                    <StatusBadge status={String(entry.aging_bucket).toUpperCase()} />
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
    const [data, setData] = useState<{ contacts?: CreditContact[] } | null>(null)
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
                <DataCell.ContactLink contactId={row.original.id}>
                    {row.original.name}
                </DataCell.ContactLink>
            ),
        },
        {
            accessorKey: "credit_balance_used",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Deuda Actual" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency value={row.original.credit_balance_used} className="text-destructive font-black" />
                </div>
            ),
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
                renderCustomView={(table: ReactTable<CreditContact>) => {
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
                                    {table.getHeaderGroups().map((headerGroup: HeaderGroup<CreditContact>) => (
                                        <tr key={headerGroup.id}>
                                            {headerGroup.headers.map((header: Header<CreditContact, unknown>) => (
                                                <th key={header.id} className="px-4 py-3 text-muted-foreground font-black text-[10px] uppercase tracking-widest whitespace-nowrap">
                                                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                                </th>
                                            ))}
                                            <th className="px-3 py-3 w-12" />
                                        </tr>
                                    ))}
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {rows.map((row: Row<CreditContact>) => (
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
