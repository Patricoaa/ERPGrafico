"use client"

import React, { useState, useEffect, useCallback } from "react"
import { 
    getBlacklistedPortfolio, 
    getContactCreditLedger, 
    unblockContact, 
    recoverDebt 
} from "@/lib/credits/api"
import { CreditContact, CreditLedgerEntry } from "@/lib/credits/api"
import ContactModal from "@/features/contacts/components/ContactModal"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef, flexRender } from "@tanstack/react-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/PageHeader"
import { 
    ChevronDown, 
    ChevronRight, 
    UserCheck, 
    DollarSign, 
    RefreshCw, 
    AlertCircle,
    Info,
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
    'written_off': 'bg-rose-100 text-rose-700 border-rose-200',
    'current': 'bg-emerald-50 text-emerald-700 border-emerald-100',
    'overdue_30': 'bg-blue-50 text-blue-700 border-blue-100',
    'overdue_60': 'bg-amber-50 text-amber-700 border-amber-100',
    'overdue_90': 'bg-orange-50 text-orange-700 border-orange-100',
    'overdue_90plus': 'bg-rose-50 text-rose-700 border-rose-100',
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
                // For blacklist, we want to see written-off documents
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
            // reload ledger
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
                                            <AlertCircle className="h-4 w-4 text-rose-500" />
                                            <span className="text-xs font-bold text-rose-700 uppercase tracking-tighter">Historial de Castigos y Deuda</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 gap-2 border-rose-200 text-rose-600 hover:bg-rose-50"
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
                                                className="h-8 gap-2 border-emerald-200 text-emerald-600 hover:bg-emerald-50"
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
                                            {[1, 2].map(i => <Skeleton key={i} className="h-8 w-full" />)}
                                        </div>
                                    ) : ledger && ledger.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50">
                                                        <th className="pb-2 pr-4 text-center">N° Documento</th>
                                                        <th className="pb-2 pr-4 text-center">Fecha</th>
                                                        <th className="pb-2 pr-4 text-center">Total</th>
                                                        <th className="pb-2 pr-4 text-center">Pagado</th>
                                                        <th className="pb-2 pr-4 text-center">Saldo</th>
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
                                                            <td className="py-2 pr-4 text-center font-mono text-emerald-600">{fmt(entry.paid_amount)}</td>
                                                            <td className="py-2 pr-4 text-center font-mono font-bold">{fmt(entry.balance)}</td>
                                                            <td className="py-2 text-center">
                                                                <TooltipProvider><Tooltip><TooltipTrigger asChild>
                                                                    <div className="flex justify-center">
                                                                        <span className={cn("text-[10px] items-center gap-1.5 font-bold px-2 py-0.5 rounded border inline-flex cursor-help", agingBg[entry.aging_bucket as string])}>
                                                                            {(entry.aging_bucket as string) === 'written_off' ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                                                            {agingLabel[entry.aging_bucket as string]}
                                                                        </span>
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent className="p-2 text-[10px]">
                                                                    {(entry.aging_bucket as string) === 'written_off' ? "Deuda castigada como pérdida incobrable." : "Documento regularizado."}
                                                                </TooltipContent>
                                                                </Tooltip></TooltipProvider>
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
                                                <AlertDialogTitle className="font-black">Registrar Recuperación de Deuda</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Ingrese el monto que el cliente está pagando. Este ingreso se registrará como una recuperación de incobrables.
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
                                                    className="bg-emerald-600 font-bold"
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
    const [selectedContact, setSelectedContact] = useState<CreditContact | null>(null)

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
                <div className="text-center font-semibold text-[13px]">
                    <button
                        className="hover:underline font-bold text-primary"
                        onClick={(e) => {
                            e.stopPropagation()
                            setSelectedContact(row.original)
                        }}
                    >
                        {row.original.name}
                    </button>
                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{row.original.tax_id}</div>
                </div>
            ),
        },
        {
            accessorKey: "credit_balance_used",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Deuda Actual" className="justify-center" />,
            cell: ({ row }) => {
                const val = Number(row.original.credit_balance_used)
                return <div className="text-center font-mono font-bold text-[13px] text-rose-600">{fmt(val)}</div>
            },
        },
        {
            accessorKey: "credit_last_evaluated",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Bloqueado desde" className="justify-center text-muted-foreground" />,
            cell: ({ row }) => <div className="text-center text-[11px] text-muted-foreground">{row.original.credit_last_evaluated ? new Date(row.original.credit_last_evaluated).toLocaleDateString() : '—'}</div>,
        }
    ]

    if (loading) return (
        <div className="rounded-2xl border bg-card/50 p-24 flex flex-col items-center justify-center gap-4 border-dashed">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground font-medium">Cargando lista negra...</p>
        </div>
    )

    return (
        <div className="space-y-6">
            <PageHeader 
                title="Lista Negra"
                description="Clientes con historial de impago o riesgo crediticio."
                iconName="user-x"
            />
            <DataTable
                columns={columns}
                data={data?.contacts || []}
                useAdvancedFilter
                searchPlaceholder="Buscar por cliente o RUT..."
                globalFilterFields={["name", "tax_id"]}
                cardMode
                renderCustomView={(table) => (
                    <div className="overflow-x-auto pb-4">
                        <table className="w-full text-left">
                            <thead className="bg-transparent border-b border-border/50">
                                {table.getHeaderGroups().map((headerGroup: any) => (
                                    <tr key={headerGroup.id}>
                                        {headerGroup.headers.map((header: any) => (
                                            <th key={header.id} className="px-4 py-3 h-9 align-middle text-muted-foreground font-medium text-xs whitespace-nowrap">
                                                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                            </th>
                                        ))}
                                        <th className="px-3 py-3 w-12 text-center" />
                                    </tr>
                                ))}
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {table.getRowModel().rows.map((row: any) => (
                                    <ExpandableBlacklistRow key={row.id} row={row} onRefresh={fetchData} />
                                ))}
                                {table.getRowModel().rows.length === 0 && (
                                    <tr>
                                        <td colSpan={columns.length + 1} className="h-24 text-center text-muted-foreground">
                                            No se encontraron clientes bloqueados.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            />

            <ContactModal
                open={!!selectedContact}
                onOpenChange={(open) => !open && setSelectedContact(null)}
                contact={selectedContact}
                onSuccess={() => {
                    setSelectedContact(null)
                    fetchData()
                }}
            />
        </div>
    )
}
