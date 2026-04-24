"use client"

import React, { useState, useEffect } from "react"
import { useServerDate } from "@/hooks/useServerDate"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { Book, Calendar, ArrowUpRight, ArrowDownRight, Scale, Calculator, Eye, Trash2 } from "lucide-react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { Card, CardContent } from "@/components/ui/card"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { format } from "date-fns"
import { useLedger } from "@/features/accounting/hooks/useLedger"
import { useDeleteJournalEntry } from "@/features/accounting/hooks/useJournalEntries"
import { es } from "date-fns/locale"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { CardSkeleton } from "@/components/shared"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"

import type { LedgerMovement } from "@/features/accounting/types"

interface LedgerModalProps {
    accountId: number
    accountName: string
    accountCode: string
    trigger?: React.ReactNode
}

export function LedgerModal({ accountId, accountName, accountCode, trigger }: LedgerModalProps) {
    const { serverDate } = useServerDate()
    const [open, setOpen] = useState(false)
    const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>(undefined)
    const [viewingEntry, setViewingEntry] = useState<{ id: number | string } | null>(null)

    useEffect(() => {
        if (serverDate && !dateRange) {
            setDateRange({
                from: new Date(serverDate.getFullYear(), serverDate.getMonth(), 1),
                to: serverDate
            })
        }
    }, [serverDate])

    const startStr = dateRange ? format(dateRange.from, 'yyyy-MM-dd') : ''
    const endStr = dateRange ? format(dateRange.to, 'yyyy-MM-dd') : ''
    const { data, isFetching: loading, refetch } = useLedger(accountId, startStr, endStr, { enabled: open })

    const deleteMutation = useDeleteJournalEntry({ onSuccess: refetch })
    const deleteConfirm = useConfirmAction<number>((entryId) => deleteMutation.mutateAsync(entryId))

    const handleDeleteEntry = (entryId: number) => deleteConfirm.requestConfirm(entryId)

    const columns: ColumnDef<LedgerMovement>[] = [
        {
            accessorKey: "date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <span className="text-xs">{format(new Date(row.original.date), 'dd/MM/yyyy')}</span>
                </div>
            )
        },
        {
            accessorKey: "description",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Descripción" className="justify-center" />
            ),
            cell: ({ row }) => {
                const mov = row.original
                const glosa = mov.label || mov.description
                return (
                    <div className="flex justify-center w-full">
                        <div className="max-w-[400px] text-xs leading-relaxed text-center" title={glosa}>
                            {glosa}
                        </div>
                    </div>
                )
            },
        },
        {
            accessorKey: "debit",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Debe" className="justify-center" />
            ),
            cell: ({ row }) => {
                const val = parseFloat(row.getValue("debit"))
                return (
                    <div className="flex justify-center w-full">
                        <MoneyDisplay amount={val} showZeroAsDash />
                    </div>
                )
            },
        },
        {
            accessorKey: "credit",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Haber" className="justify-center" />
            ),
            cell: ({ row }) => {
                const val = parseFloat(row.getValue("credit"))
                return (
                    <div className="flex justify-center w-full">
                        <MoneyDisplay amount={val} showZeroAsDash />
                    </div>
                )
            },
        },
        {
            accessorKey: "balance",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Saldo" className="justify-center" />
            ),
            cell: ({ row }) => {
                const val = parseFloat(row.getValue("balance"))
                return (
                    <div className="flex justify-center w-full">
                        <MoneyDisplay amount={val} showColor={true} />
                    </div>
                )
            },
        },
        createActionsColumn<LedgerMovement>({
            renderActions: (mov) => (
                <>
                    <DataCell.Action
                        icon={Eye}
                        title="Ver Asiento"
                        color="text-primary"
                        onClick={() => setViewingEntry({ id: mov.entry_id })}
                    />
                    <DataCell.Action
                        icon={Trash2}
                        title="Eliminar Asiento"
                        className="text-destructive"
                        onClick={() => handleDeleteEntry(mov.entry_id)}
                    />
                </>
            ),
        })
    ]

    return (
        <>
            {trigger ? (
                React.isValidElement(trigger) ? (
                    React.cloneElement(trigger as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>, {
                        onClick: (e: React.MouseEvent) => {
                            e.stopPropagation();
                            setOpen(true);
                            if ((trigger as any).props.onClick) {
                                (trigger as any).props.onClick(e);
                            }
                        }
                    })
                ) : (
                    <div onClick={(e) => { e.stopPropagation(); setOpen(true); }} className="inline-block cursor-pointer">
                        {trigger}
                    </div>
                )
            ) : (
                <Button
                    variant="ghost"
                    size="sm"
                    title="Ver Libro Mayor"
                    className="h-8 w-8 p-0"
                    onClick={() => setOpen(true)}
                >
                    <Book className="h-4 w-4 text-primary" />
                </Button>
            )}
            <BaseModal
                open={open}
                onOpenChange={setOpen}
                size="2xl"
                title={
                    <>
                        <Book className="h-6 w-6 text-primary" />
                        Libro Mayor
                    </>
                }
                description={
                    <span className="text-sm text-muted-foreground font-mono">
                        {accountCode} | <span className="text-foreground font-sans font-semibold">{accountName}</span>
                    </span>
                }
                footer={
                    <div className="w-full flex justify-between items-center text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                        <span>Libro Mayor • {accountName}</span>
                        <span>{data?.movements?.length || 0} Registros</span>
                    </div>
                }
                headerActions={
                    <DateRangeFilter
                        onRangeChange={(range) => {
                            if (range?.from && range?.to) {
                                setDateRange({ from: range.from, to: range.to })
                            }
                        }}
                        defaultRange={dateRange || undefined}
                    />
                }
            >
                <div className="flex flex-col gap-6">

                    {loading ? (
                        <CardSkeleton count={4} variant="grid" />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Card className="bg-muted/30 border-none shadow-none">
                                <CardContent className="pt-6">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-medium text-muted-foreground uppercase">Saldo Inicial</p>
                                        <Calculator className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <div className={`text-xl font-bold mt-1 ${data?.opening_balance && data.opening_balance < 0 ? 'text-destructive' : ''}`}>
                                        ${data?.opening_balance?.toLocaleString() || '0'}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        Al {dateRange?.from ? format(dateRange.from, "PPP", { locale: es }) : '-'}
                                    </p>
                                </CardContent>
                            </Card>
                            <Card className="bg-success/5 border-none shadow-none">
                                <CardContent className="pt-6">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-medium text-success uppercase">Cargos (Debe)</p>
                                        <ArrowUpRight className="h-4 w-4 text-success" />
                                    </div>
                                    <div className="text-xl font-bold mt-1 text-success">
                                        ${data?.period_debit?.toLocaleString() || '0'}
                                    </div>
                                    <p className="text-[10px] text-success/70 mt-1">Total del periodo</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-destructive/5 border-none shadow-none">
                                <CardContent className="pt-6">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-medium text-destructive uppercase">Abonos (Haber)</p>
                                        <ArrowDownRight className="h-4 w-4 text-destructive" />
                                    </div>
                                    <div className="text-xl font-bold mt-1 text-destructive">
                                        ${data?.period_credit?.toLocaleString() || '0'}
                                    </div>
                                    <p className="text-[10px] text-destructive/70 mt-1">Total del periodo</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-primary/5 border-none shadow-none">
                                <CardContent className="pt-6">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-medium text-primary uppercase">Saldo Final</p>
                                        <Scale className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className={`text-xl font-bold mt-1 ${data?.closing_balance && data.closing_balance < 0 ? 'text-destructive' : 'text-primary'}`}>
                                        ${data?.closing_balance?.toLocaleString() || '0'}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        Al {dateRange?.to ? format(dateRange.to, "PPP", { locale: es }) : '-'}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    <DataTable
                        columns={columns}
                        data={data?.movements || []}
                        cardMode
                        isLoading={loading}
                        useAdvancedFilter={false}
                        globalFilterFields={["description", "partner", "reference"]}
                        searchPlaceholder="Filtrar movimientos..."
                        defaultPageSize={100}
                    />
                </div>
            </BaseModal>

            {viewingEntry && (
                <TransactionViewModal
                    open={!!viewingEntry}
                    onOpenChange={(open) => !open && setViewingEntry(null)}
                    type="journal_entry"
                    id={viewingEntry.id}
                />
            )}

            <ActionConfirmModal
                open={deleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) deleteConfirm.cancel() }}
                onConfirm={deleteConfirm.confirm}
                title="Eliminar Asiento Contable"
                description="¿Está seguro de eliminar este asiento contable? Esta acción revertirá todos los movimientos asociados y no se puede deshacer."
                variant="destructive"
            />
        </>
    )
}
