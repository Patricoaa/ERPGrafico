"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Book, Calendar, ArrowUpRight, ArrowDownRight, Scale, Calculator, Eye, Trash2 } from "lucide-react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { Card, CardContent } from "@/components/ui/card"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import api from "@/lib/api"
import { toast } from "sonner"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"

interface LedgerModalProps {
    accountId: number
    accountName: string
    accountCode: string
    trigger?: React.ReactNode
}

export function LedgerModal({ accountId, accountName, accountCode, trigger }: LedgerModalProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<any>(null)
    const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
        from: new Date(new Date().getFullYear(), new Date().getMonth(), 1), // Start of current month
        to: new Date()
    })
    const [viewingEntry, setViewingEntry] = useState<{ id: number | string } | null>(null)

    const fetchLedger = useCallback(async () => {
        setLoading(true)
        try {
            const startStr = format(dateRange.from, 'yyyy-MM-dd')
            const endStr = format(dateRange.to, 'yyyy-MM-dd')
            const res = await api.get(`/accounting/accounts/${accountId}/ledger/?start_date=${startStr}&end_date=${endStr}`)
            setData(res.data)
        } catch (error) {
            toast.error("Error al cargar el libro mayor")
            console.error(error)
        } finally {
            setLoading(false)
        }
    }, [accountId, dateRange])

    useEffect(() => {
        if (open) {
            fetchLedger()
        }
    }, [open, fetchLedger])

    const handleDeleteEntry = async (entryId: number) => {
        if (!confirm("¿Está seguro de eliminar este asiento contable? Esta acción revertirá todos los movimientos asociados.")) return
        try {
            await api.delete(`/accounting/entries/${entryId}/`)
            toast.success("Asiento eliminado correctamente")
            fetchLedger()
        } catch (error) {
            console.error("Error deleting entry:", error)
            toast.error("Error al eliminar el asiento")
        }
    }

    const columns: ColumnDef<any>[] = [
        {
            accessorKey: "date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" />
            ),
            cell: ({ row }) => <span className="text-xs">{format(new Date(row.original.date), 'dd/MM/yyyy')}</span>
        },
        {
            accessorKey: "description",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Descripción" />
            ),
            cell: ({ row }) => {
                const mov = row.original
                const glosa = mov.label || mov.description
                return (
                    <div className="max-w-[400px] text-xs leading-relaxed" title={glosa}>
                        {glosa}
                    </div>
                )
            },
        },
        {
            accessorKey: "debit",
            header: ({ column }) => (
                <div className="text-right"><DataTableColumnHeader column={column} title="Debe" /></div>
            ),
            cell: ({ row }) => {
                const val = parseFloat(row.getValue("debit"))
                return <div className="text-right font-mono text-xs">{val > 0 ? val.toLocaleString() : '-'}</div>
            },
        },
        {
            accessorKey: "credit",
            header: ({ column }) => (
                <div className="text-right"><DataTableColumnHeader column={column} title="Haber" /></div>
            ),
            cell: ({ row }) => {
                const val = parseFloat(row.getValue("credit"))
                return <div className="text-right font-mono text-xs">{val > 0 ? val.toLocaleString() : '-'}</div>
            },
        },
        {
            accessorKey: "balance",
            header: ({ column }) => (
                <div className="text-right"><DataTableColumnHeader column={column} title="Saldo" /></div>
            ),
            cell: ({ row }) => {
                const val = parseFloat(row.getValue("balance"))
                return (
                    <div className={`text-right font-mono text-xs font-bold ${val < 0 ? 'text-red-500' : ''}`}>
                        ${val.toLocaleString()}
                    </div>
                )
            },
        },
        {
            id: "actions",
            header: "Acciones",
            cell: ({ row }) => {
                const mov = row.original
                return (
                    <div className="flex items-center justify-end gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setViewingEntry({ id: mov.entry_id })}
                            title="Ver Asiento"
                        >
                            <Eye className="h-4 w-4 text-primary" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteEntry(mov.entry_id)}
                            title="Eliminar Asiento"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                )
            }
        }
    ]

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="sm" title="Libro Mayor">
                        <Book className="h-4 w-4 mr-1" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b">
                    <div className="flex justify-between items-center">
                        <div className="space-y-1">
                            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                <Book className="h-6 w-6 text-primary" />
                                Libro Mayor
                            </DialogTitle>
                            <p className="text-sm text-muted-foreground font-mono">
                                {accountCode} | <span className="text-foreground font-sans font-semibold">{accountName}</span>
                            </p>
                        </div>
                        <div className="flex items-center gap-2 pr-8">
                            <DateRangeFilter
                                onRangeChange={(range) => {
                                    if (range?.from && range?.to) {
                                        setDateRange({ from: range.from, to: range.to })
                                    }
                                }}
                                defaultRange={dateRange}
                            />
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {loading && <div className="text-center py-10 text-muted-foreground">Cargando datos...</div>}
                    {!loading && data && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Card className="bg-muted/30 border-none shadow-none">
                                <CardContent className="pt-6">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-medium text-muted-foreground uppercase">Saldo Inicial</p>
                                        <Calculator className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <div className={`text-xl font-bold mt-1 ${data.opening_balance < 0 ? 'text-red-500' : ''}`}>
                                        ${data.opening_balance.toLocaleString()}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        Al {format(dateRange.from, "PPP", { locale: es })}
                                    </p>
                                </CardContent>
                            </Card>
                            <Card className="bg-green-50/50 border-none shadow-none">
                                <CardContent className="pt-6">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-medium text-green-600 uppercase">Débitos (Debe)</p>
                                        <ArrowUpRight className="h-4 w-4 text-green-500" />
                                    </div>
                                    <div className="text-xl font-bold mt-1 text-green-700">
                                        ${data.period_debit.toLocaleString()}
                                    </div>
                                    <p className="text-[10px] text-green-600/70 mt-1">Total del periodo</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-red-50/50 border-none shadow-none">
                                <CardContent className="pt-6">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-medium text-red-600 uppercase">Créditos (Haber)</p>
                                        <ArrowDownRight className="h-4 w-4 text-red-500" />
                                    </div>
                                    <div className="text-xl font-bold mt-1 text-red-700">
                                        ${data.period_credit.toLocaleString()}
                                    </div>
                                    <p className="text-[10px] text-red-600/70 mt-1">Total del periodo</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-primary/5 border-none shadow-none">
                                <CardContent className="pt-6">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-medium text-primary uppercase">Saldo Final</p>
                                        <Scale className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className={`text-xl font-bold mt-1 ${data.closing_balance < 0 ? 'text-red-500' : 'text-primary'}`}>
                                        ${data.closing_balance.toLocaleString()}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        Al {format(dateRange.to, "PPP", { locale: es })}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {!loading && (

                        <DataTable
                            columns={columns}
                            data={data?.movements || []}
                            useAdvancedFilter={false}
                            globalFilterFields={["description", "partner", "reference"]}
                            searchPlaceholder="Filtrar movimientos..."
                            defaultPageSize={100}
                        />

                    )}

                    {!loading && data?.movements.length === 0 && (
                        <div className="text-center py-20 bg-muted/20 rounded-lg">
                            <Book className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                            <p className="text-muted-foreground">No hay movimientos en este periodo</p>
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t bg-muted/10 flex justify-between items-center text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                    <span>Libro Mayor • {accountName}</span>
                    <span>{data?.movements.length || 0} Registros</span>
                </div>
            </DialogContent>

            {viewingEntry && (
                <TransactionViewModal
                    open={!!viewingEntry}
                    onOpenChange={(open) => !open && setViewingEntry(null)}
                    type="journal_entry"
                    id={viewingEntry.id}
                />
            )}
        </Dialog>
    )
}
