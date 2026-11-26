"use client"

import React, {useState, useEffect, useMemo} from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useServerDate } from "@/hooks/useServerDate"
import { Book } from "lucide-react"
import { useDrawerIdentity, usePrintableDrawer, PrintableLayout } from "@/features/_shared"
import { Drawer, IconButton, PeriodPicker, SkeletonShell } from '@/components/shared'
import { datesOf, periodOf, presetsOf, REPORT_PERIOD_PRESETS } from '@/lib/date-presets'
import { Collection, useCollectionQuery, useEntityCollection } from "@/components/entity-view"
import { formDrawerWidth } from "@/lib/form-widths"
import { formatCurrency } from "@/lib/money"

import { JournalEntryDrawer } from "@/features/accounting/components/JournalEntryDrawer"

import { format } from "date-fns"
import { useLedger } from "@/features/accounting/hooks/useLedger"
import { LedgerSummaryPanel } from "@/features/accounting/components/LedgerSummaryPanel"

import type { LedgerData, LedgerMovement } from "@/features/accounting/types"
import { ledgerMovementActions, type LedgerMovementActionsCtx } from './ledgerMovementActions'
import { ledgerMovementEntity, ledgerMovementDrawerViews } from "@/features/accounting"

const LEDGER_PERIOD_PRESETS = presetsOf(REPORT_PERIOD_PRESETS)

/**
 * Libro Mayor. The Debe/Haber/Saldo summary uses MetricStrip (ADR-0149)
 * with dedicated cue icons for Debe, Haber, and Saldo Final (see LedgerSummaryPanel).
 */
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
                    className="h-control-sm w-8 p-0"
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
                    <div className="text-4xs space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>Desde:</span>
                            <span>{startStr ? format(new Date(startStr + 'T00:00:00'), 'dd/MM/yyyy') : '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Hasta:</span>
                            <span>{endStr ? format(new Date(endStr + 'T00:00:00'), 'dd/MM/yyyy') : '-'}</span>
                        </div>
                    </div>
                    <div className="text-4xs">
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
                fillContent
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
                     <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
                         <SkeletonShell isLoading={isLoading} ariaLabel="Cargando libro mayor">
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
                     </div>
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

    // Own URL keys (`ledger_…`): the drawer opens over another list and must not touch its search.
    const query = useCollectionQuery(ledgerMovementEntity, { sorting: "client", urlPrefix: "ledger_" })
    const { search } = query

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

    const filteredMovements = useMemo(
        () => search.filterFn(data?.movements ?? []),
        [search.filterFn, data?.movements],
    )

    const collection = useEntityCollection(
        ledgerMovementEntity,
        { rows: filteredMovements, isFiltered: search.isFiltered },
        { pagination: { mode: "none" } },
    )

    return (
        <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden gap-4 p-6">
            <LedgerSummaryPanel
                openingBalance={data?.opening_balance}
                periodDebit={data?.period_debit}
                periodCredit={data?.period_credit}
                closingBalance={data?.closing_balance}
                fromDate={dateRange?.from}
                toDate={dateRange?.to}
            />

            {/* Table — fills remaining height */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <Collection.Root
                    collection={collection}
                    query={query}
                    actions={ledgerMovementActions.forCollection(ledgerMovementActionsCtx)}
                    onOpen={(mov) => openEntry(mov.entry_id)}
                >
                    <Collection.Toolbar
                        action={
                            <PeriodPicker
                                name="Período"
                                value={periodOf(dateRange)}
                                presets={LEDGER_PERIOD_PRESETS}
                                clearable={false}
                                onChange={(period) => period && setDateRange(datesOf(period))}
                            />
                        }
                    />
                    <Collection.View
                        table={ledgerMovementDrawerViews.table}
                        emptyTitle="Sin movimientos"
                        emptyDescription="No hay movimientos para el período seleccionado."
                    />
                </Collection.Root>
            </div>

            {viewingEntry && (
                <JournalEntryDrawer
                    journalEntryId={Number(viewingEntry.id)}
                    mode="view"
                    open={!!viewingEntry}
                    onOpenChange={(open) => !open && closeEntry()}
                    side="left"
                />
            )}
        </div>
    )
}

