"use client"

import React, {useState, useEffect, useMemo} from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useServerDate } from "@/hooks/useServerDate"
import { Book, ArrowUpRight, ArrowDownRight, Scale, Calculator } from "lucide-react"
import { useDrawerIdentity, usePrintableDrawer, PrintableLayout } from "@/features/_shared"
import { DataTable, DateRangeFilter, Drawer, IconButton, MoneyDisplay, SkeletonShell, UnifiedSearchBar, useUnifiedSearch } from '@/components/shared'
import { formDrawerWidth } from "@/lib/form-widths"
import { formatCurrency } from "@/lib/money"
import type { UnifiedSearchConfig } from '@/types/unified-search'

import { JournalEntryDrawer } from "@/features/accounting/components/JournalEntryDrawer"

import { format } from "date-fns"
import { useLedger } from "@/features/accounting/hooks/useLedger"
import { es } from "date-fns/locale"

import type { LedgerData, LedgerMovement } from "@/features/accounting/types"
import { ledgerMovementActions, type LedgerMovementActionsCtx } from './ledgerMovementActions'
import { ledgerMovementFields } from "@/features/accounting/ledgerMovementFields"

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

    const { printRef, handlePrint } = usePrintableDrawer()

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
    }, [serverDate, dateRange])

    const startStr = dateRange ? format(dateRange.from, 'yyyy-MM-dd') : ''
    const endStr = dateRange ? format(dateRange.to, 'yyyy-MM-dd') : ''

    // Fetch ledger data
    const { data, isLoading } = useLedger(accountId, startStr, endStr)

    const identity = useDrawerIdentity('accounting.account', 'view', { code: accountCode, name: accountName }, {
        overrideTitle: "Libro Mayor",
        overrideSubtitle: accountCode && accountName ? `${accountCode} — ${accountName}` : accountName || accountCode || undefined,
        onPrint: handlePrint,
        printable: open && !!data,
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
                headerActions={identity.headerActions}
            >
                 {open && dateRange && (
                     <SkeletonShell isLoading={isLoading} ariaLabel="Cargando libro mayor" className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
                         <LedgerContent
                             accountId={accountId}
                             startDate={startStr}
                             endDate={endStr}
                             dateRange={dateRange}
                             setDateRange={setDateRange}
                             data={data}
                             isLoading={isLoading}
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
    isLoading
}: {
    accountId: number;
    startDate: string;
    endDate: string;
    dateRange: { from: Date; to: Date };
    setDateRange: (range: { from: Date; to: Date } | undefined) => void;
    data: LedgerData | undefined;
    isLoading: boolean;
}) {
    const { serverDate } = useServerDate()

    const ledgerSearchConfig = useMemo<UnifiedSearchConfig>(() => ({
        searchFields: [
            {
                key: 'description',
                label: 'Descripción',
                serverParam: 'search',
                clientKey: ['description', 'label'],
            },
        ],
    }), [])

    const search = useUnifiedSearch(ledgerSearchConfig)

    const [viewingEntry, setViewingEntry] = useState<{ id: number | string } | null>(null)

    const openEntry = (id: number | string) => {
        setViewingEntry({ id })
    }

    const closeEntry = () => {
        setViewingEntry(null)
    }

    const ledgerMovementActionsCtx: LedgerMovementActionsCtx = {
        onViewEntry: (entryId) => openEntry(entryId),
    }

    const columns = [
        ...ledgerMovementFields.toColumns(),
        ledgerMovementActions.auto(ledgerMovementActionsCtx),
    ]

    const filteredMovements = useMemo(
        () => search.filterFn(data?.movements ?? []),
        [search.filterFn, data?.movements],
    )

    return (
        <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden gap-4 p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
                {/* Black/Base — Saldo Inicial */}
                <div className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2.5 flex items-start gap-2.5">
                    <div className="rounded-md bg-foreground/10 p-1.5 shrink-0">
                        <Calculator className="h-3.5 w-3.5 text-foreground" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/80">Saldo Inicial</p>
                        <p className="text-sm font-bold text-foreground font-mono truncate">
                            <MoneyDisplay amount={data?.opening_balance} showColor={false} />
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                            Al {dateRange?.from ? format(dateRange.from, 'dd/MM/yy', { locale: es }) : '-'}
                        </p>
                    </div>
                </div>

                {/* Cyan — Cargos (Debe) */}
                <div className="rounded-lg border border-cyan/30 bg-cyan/10 px-3 py-2.5 flex items-start gap-2.5">
                    <div className="rounded-md bg-cyan/20 p-1.5 shrink-0">
                        <ArrowUpRight className="h-3.5 w-3.5 text-cyan" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan">Cargos (Debe)</p>
                        <p className="text-sm font-bold text-foreground font-mono truncate">
                            <MoneyDisplay amount={data?.period_debit} showColor={false} />
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Total del periodo</p>
                    </div>
                </div>

                {/* Magenta — Abonos (Haber) */}
                <div className="rounded-lg border border-magenta/30 bg-magenta/10 px-3 py-2.5 flex items-start gap-2.5">
                    <div className="rounded-md bg-magenta/20 p-1.5 shrink-0">
                        <ArrowDownRight className="h-3.5 w-3.5 text-magenta" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-magenta">Abonos (Haber)</p>
                        <p className="text-sm font-bold text-foreground font-mono truncate">
                            <MoneyDisplay amount={data?.period_credit} showColor={false} />
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Total del periodo</p>
                    </div>
                </div>

                {/* Yellow — Saldo Final */}
                <div className="rounded-lg border border-yellow/40 bg-yellow/10 px-3 py-2.5 flex items-start gap-2.5">
                    <div className="rounded-md bg-yellow/20 p-1.5 shrink-0">
                        <Scale className="h-3.5 w-3.5 text-yellow" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-yellow">Saldo Final</p>
                        <p className="text-sm font-bold text-foreground font-mono truncate">
                            <MoneyDisplay amount={data?.closing_balance} showColor={false} />
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                            Al {dateRange?.to ? format(dateRange.to, 'dd/MM/yy', { locale: es }) : '-'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Table — fills remaining height */}
            <div className="flex-1 min-h-0 overflow-hidden">
                <DataTable
                    columns={columns}
                    data={filteredMovements}
                    isLoading={isLoading}
                    variant="embedded"
                    defaultPageSize={100}
                    defaultAction={(mov: LedgerMovement) => openEntry(mov.entry_id)}
                    unifiedSearch={<UnifiedSearchBar
                        config={ledgerSearchConfig}
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
                        placeholder="Buscar por descripción..."
                        toolbarActions={
                            <DateRangeFilter
                                defaultRange={dateRange || undefined}
                                onDateChange={(range) => {
                                    if (range?.from && range?.to) {
                                        setDateRange({ from: range.from, to: range.to })
                                    }
                                }}
                                className="bg-background border-none shadow-none rounded-sm"
                                variant="outline"
                            />
                        }
                    />}
                    showReset={search.isFiltered}
                    onReset={() => {
                        search.clearAll()
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

