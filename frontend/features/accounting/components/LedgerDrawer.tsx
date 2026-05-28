"use client"

import React, { useState, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useServerDate } from "@/hooks/useServerDate"
import { Book, ArrowUpRight, ArrowDownRight, Scale, Calculator, Eye, Trash2 } from "lucide-react"
import { Drawer, DataTable, DataTableColumnHeader, DataCell, createActionsColumn, IconButton, SkeletonShell } from "@/components/shared"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ColumnDef } from "@tanstack/react-table"
import { Card, CardContent } from "@/components/ui/card"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"
import { JournalEntryDrawer } from "@/features/accounting/components/JournalEntryDrawer"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { format } from "date-fns"
import { useLedger } from "@/features/accounting/hooks/useLedger"
import { useDeleteJournalEntry } from "@/features/accounting/hooks/useJournalEntries"
import { es } from "date-fns/locale"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"


import type { LedgerMovement } from "@/features/accounting/types"

interface LedgerDrawerProps {
    accountId: number
    accountName: string
    accountCode: string
    trigger?: React.ReactNode
}

export function LedgerDrawer({ accountId, accountName, accountCode, trigger }: LedgerDrawerProps) {
    const { serverDate } = useServerDate()
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const ledgerAccountParam = searchParams.get("ledger_account")
    const open = ledgerAccountParam === String(accountId)

    const setOpen = (newOpen: boolean) => {
        const params = new URLSearchParams(searchParams.toString())
        if (newOpen) {
            params.set("ledger_account", String(accountId))
        } else {
            params.delete("ledger_account")
        }
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>(undefined)

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

    // Fetch ledger data
    const { data, isLoading, refetch } = useLedger(accountId, startStr, endStr)

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
                <IconButton
                    title="Ver Libro Mayor"
                    className="h-8 w-8 p-0"
                    onClick={() => setOpen(true)}
                >
                    <Book className="h-4 w-4 text-primary" />
                </IconButton>
            )}
            <Drawer
                open={open}
                onOpenChange={setOpen}
                title="Libro Mayor"
                subtitle={`${accountCode} | ${accountName}`}
                icon={Book}
                side="left"
                boundary="embedded"
                resizable={false}
                showOverlay={true}
                defaultSize="50%"
            >
                 {open && dateRange && (
                     <SkeletonShell isLoading={isLoading} ariaLabel="Cargando libro mayor">
                         <LedgerContent
                             accountId={accountId}
                             startDate={startStr}
                             endDate={endStr}
                             dateRange={dateRange}
                             setDateRange={setDateRange}
                             data={data}
                             isLoading={isLoading}
                             refetch={refetch}
                         />
                     </SkeletonShell>
                 )}
             </Drawer>
        </>
    )
}

function LedgerContent({
    accountId,
    startDate,
    endDate,
    dateRange,
    setDateRange,
    data,
    isLoading,
    refetch
}: {
    accountId: number;
    startDate: string;
    endDate: string;
    dateRange: { from: Date; to: Date };
    setDateRange: (range: { from: Date; to: Date } | undefined) => void;
    data: any;
    isLoading: boolean;
    refetch: () => void;
}) {
    const { serverDate } = useServerDate()

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [viewingEntry, setViewingEntry] = useState<{ id: number | string } | null>(null)

    const openEntry = (id: number | string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('selected', String(id))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const closeEntry = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('selected')
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        setViewingEntry(null)
    }

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
                <DataCell.Date value={row.original.date} />
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
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="max-w-[400px] text-xs leading-relaxed text-center">
                                    {glosa}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="top">{glosa}</TooltipContent>
                        </Tooltip>
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
                        onClick={() => openEntry(mov.entry_id)}
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
        <div className="flex flex-col gap-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-muted/30 border-none shadow-none">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-muted-foreground uppercase">Saldo Inicial</p>
                            <Calculator className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className={`text-xl font-bold mt-1 ${data?.opening_balance && data.opening_balance < 0 ? 'text-destructive' : ''}`}>
                            <MoneyDisplay amount={data?.opening_balance} />
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
                            <MoneyDisplay amount={data?.period_debit} />
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
                            <MoneyDisplay amount={data?.period_credit} />
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
                            <MoneyDisplay amount={data?.closing_balance} />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                            Al {dateRange?.to ? format(dateRange.to, "PPP", { locale: es }) : '-'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <DataTable
                columns={columns}
                data={data?.movements || []}
                isLoading={isLoading}
                variant="embedded"
                useAdvancedFilter={true}
                globalFilterFields={["description", "partner", "reference"]}
                searchPlaceholder="Buscar movimientos..."
                defaultPageSize={100}
                customFilters={
                    <div className="px-1 py-1">
                        <DateRangeFilter
                            onDateChange={(range) => {
                                if (range?.from && range?.to) {
                                    setDateRange({ from: range.from, to: range.to })
                                }
                            }}
                            defaultRange={dateRange || undefined}
                        />
                    </div>
                }
                isCustomFiltered={!!dateRange}
                onReset={() => {
                    if (serverDate) {
                        setDateRange({
                            from: new Date(serverDate.getFullYear(), serverDate.getMonth(), 1),
                            to: serverDate
                        })
                    } else {
                        setDateRange(undefined)
                    }
                }}
            />

            {viewingEntry && (
                <JournalEntryDrawer
                    journalEntryId={Number(viewingEntry.id)}
                    mode="view"
                    open={!!viewingEntry}
                    onOpenChange={(open) => !open && closeEntry()}
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
        </div>
    )
}
