"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useServerDate } from "@/hooks/useServerDate"
import { Book, ArrowUpRight, ArrowDownRight, Scale, Calculator, Printer } from "lucide-react"
import { useDrawerIdentity } from "@/features/_shared"
import { DataCell, DataTable, DataTableColumnHeader, DateRangeFilter, Drawer, IconButton, MoneyDisplay, SkeletonShell, SegmentationBar, SmartSearchBar, StatCard, useClientSearch } from '@/components/shared'
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { type ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { useReactToPrint } from "react-to-print"
import { PrintableLayout } from "@/features/_shared"
import { formDrawerWidth } from "@/lib/form-widths"
import { formatCurrency } from "@/lib/money"
import type { SearchDefinition } from "@/types/search"

const ledgerMovementSearchDef: SearchDefinition = {
    fields: [
        {
            key: 'description',
            label: 'Descripción',
            type: 'text',
            serverParam: 'search',
            clientKey: ['description', 'label'],
        },
    ],
}

import { JournalEntryDrawer } from "@/features/accounting/components/JournalEntryDrawer"

import { format } from "date-fns"
import { useLedger } from "@/features/accounting/hooks/useLedger"
import { es } from "date-fns/locale"

import type { LedgerData, LedgerMovement } from "@/features/accounting/types"
import { ledgerMovementActions, type LedgerMovementActionsCtx } from './ledgerMovementActions'

interface LedgerDrawerProps {
    accountId: number
    accountName: string
    accountCode: string
    trigger?: React.ReactNode
    noTrigger?: boolean
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function LedgerDrawer({ accountId, accountName, accountCode, trigger, noTrigger, open: openProp, onOpenChange }: LedgerDrawerProps) {
    const { serverDate } = useServerDate()
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const ledgerAccountParam = searchParams.get("ledger_account")
    const openUrl = ledgerAccountParam === String(accountId)
    const open = openProp !== undefined ? openProp : openUrl

    const setOpen = (newOpen: boolean) => {
        if (onOpenChange) {
            onOpenChange(newOpen)
        } else {
            const params = new URLSearchParams(searchParams.toString())
            if (newOpen) {
                params.set("ledger_account", String(accountId))
            } else {
                params.delete("ledger_account")
            }
            router.push(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }

    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })

    const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>(undefined)

    useEffect(() => {
        if (serverDate && !dateRange) {
            requestAnimationFrame(() => {
                setDateRange({
                    from: new Date(serverDate.getFullYear(), serverDate.getMonth(), 1),
                    to: serverDate
                })
            })
        }
    }, [serverDate])

    const startStr = dateRange ? format(dateRange.from, 'yyyy-MM-dd') : ''
    const endStr = dateRange ? format(dateRange.to, 'yyyy-MM-dd') : ''

    // Fetch ledger data
    const { data, isLoading, refetch } = useLedger(accountId, startStr, endStr)

    const identity = useDrawerIdentity('accounting.account', 'view', { code: accountCode, name: accountName }, {
        overrideTitle: "Libro Mayor",
    })

    return (
        <>
            {!noTrigger && (trigger ? (
                React.isValidElement(trigger) ? (
                    React.cloneElement(trigger as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>, {
                        onClick: (e: React.MouseEvent) => {
                            e.stopPropagation();
                            setOpen(true);
                            const triggerProps = (trigger as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>).props
                            if (triggerProps.onClick) {
                                triggerProps.onClick(e);
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
            ))}
            {open && data && (
                <PrintableLayout
                    ref={printRef}
                    title="Libro Mayor"
                    displayId={`${accountCode} - ${accountName}`}
                >
                    <div className="text-[9px] space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>Desde:</span>
                            <span>{startStr ? format(new Date(startStr + 'T00:00:00'), 'dd/MM/yyyy') : '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Hasta:</span>
                            <span>{endStr ? format(new Date(endStr + 'T00:00:00'), 'dd/MM/yyyy') : '-'}</span>
                        </div>
                    </div>
                    <div className="text-[9px]">
                        <div className="grid grid-cols-[60px,1fr,50px,50px,50px] gap-1 font-bold border-b mb-1 pb-1">
                            <span>Fecha</span>
                            <span>Descripción</span>
                            <span className="text-right">Debe</span>
                            <span className="text-right">Haber</span>
                            <span className="text-right">Saldo</span>
                        </div>
                        {(data.movements || []).map((item, idx) => (
                            <div key={idx} className="grid grid-cols-[60px,1fr,50px,50px,50px] gap-1 border-b border-dashed py-0.5 break-inside-avoid">
                                <span>{format(new Date(item.date + 'T00:00:00'), 'dd/MM/yyyy')}</span>
                                <span className="truncate">{item.label || item.description || '-'}</span>
                                <span className="text-right">{Number(item.debit) > 0 ? formatCurrency(Number(item.debit)) : '-'}</span>
                                <span className="text-right">{Number(item.credit) > 0 ? formatCurrency(Number(item.credit)) : '-'}</span>
                                <span className="text-right">{formatCurrency(Number(item.balance))}</span>
                            </div>
                        ))}
                    </div>
                </PrintableLayout>
            )}
            <Drawer
                open={open}
                onOpenChange={setOpen}
                icon={identity.icon}
                title={identity.title}
                subtitle={identity.subtitle}
                side="left"
                boundary="embedded"
                resizable={false}
                showOverlay={true}
                defaultSize={formDrawerWidth("master", false)}
                mode="view"
                contentClassName="p-0"
                headerActions={<Button variant="ghost" size="icon" onClick={() => handlePrint()}><Printer className="h-4 w-4" /></Button>}
            >
                 {open && dateRange && (
                     <SkeletonShell isLoading={isLoading} ariaLabel="Cargando libro mayor" className="flex-1 flex flex-col h-full">
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
    data: LedgerData | undefined;
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

    const ledgerMovementActionsCtx: LedgerMovementActionsCtx = {
        onViewEntry: (entryId) => openEntry(entryId),
    }

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
        ledgerMovementActions.column(ledgerMovementActionsCtx)
    ]

    const { filterFn } = useClientSearch<LedgerMovement>(ledgerMovementSearchDef)
    const filteredMovements = useMemo(
        () => filterFn(data?.movements ?? []),
        [filterFn, data?.movements],
    )

    return (
        <div className="flex-1 flex flex-col gap-4 pt-4 px-6 pb-6 min-h-0 h-full overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0 items-start">
                <StatCard
                    variant="minimal"
                    accent="muted"
                    label="Saldo Inicial"
                    icon={Calculator}
                    value={<MoneyDisplay amount={data?.opening_balance} />}
                    subtext={`Al ${dateRange?.from ? format(dateRange.from, 'dd/MM/yy', { locale: es }) : '-'}`}
                    className="p-2"
                />
                <StatCard
                    variant="minimal"
                    accent="info"
                    label="Cargos (Debe)"
                    icon={ArrowUpRight}
                    value={<MoneyDisplay amount={data?.period_debit} />}
                    subtext="Total del periodo"
                    className="p-2"
                />
                <StatCard
                    variant="minimal"
                    accent="warning"
                    label="Abonos (Haber)"
                    icon={ArrowDownRight}
                    value={<MoneyDisplay amount={data?.period_credit} />}
                    subtext="Total del periodo"
                    className="p-2"
                />
                <StatCard
                    variant="minimal"
                    accent="primary"
                    label="Saldo Final"
                    icon={Scale}
                    value={<MoneyDisplay amount={data?.closing_balance} showColor />}
                    subtext={`Al ${dateRange?.to ? format(dateRange.to, 'dd/MM/yy', { locale: es }) : '-'}`}
                    className="p-2"
                />
            </div>

            <div className="flex-1 overflow-hidden">
                <DataTable
                    columns={columns}
                    data={filteredMovements}
                    isLoading={isLoading}
                    variant="embedded"
                    defaultPageSize={100}
                    smartSearch={
                        <SmartSearchBar
                            searchDef={ledgerMovementSearchDef}
                            placeholder="Buscar por descripción..."
                            className="w-full"
                        />
                    }
                    segmentation={
                        <SegmentationBar def={{
                            segments: [
                                {
                                    key: 'date_range',
                                    label: 'Fecha',
                                    type: 'custom',
                                    render: () => (
                                        <DateRangeFilter
                                            variant="ghost"
                                            onDateChange={(range) => {
                                                if (range?.from && range?.to) {
                                                    setDateRange({ from: range.from, to: range.to })
                                                }
                                            }}
                                            defaultRange={dateRange || undefined}
                                        />
                                    ),
                                },
                            ],
                        }} />
                    }
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
            </div>

            {viewingEntry && (
                <JournalEntryDrawer
                    journalEntryId={Number(viewingEntry.id)}
                    mode="view"
                    open={!!viewingEntry}
                    onOpenChange={(open) => !open && closeEntry()}
                />
            )}
        </div>
    )
}
