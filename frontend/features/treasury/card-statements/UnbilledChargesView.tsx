"use client"

import { Button } from "@/components/ui/button"
import { useMemo, useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
    Receipt, CreditCard,
    Gauge,
} from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import {
    DataTableView,
    DataTableColumnHeader,
    DataCell,
    MoneyDisplay,
    EntityCard,
    StatusBadge,
    UnifiedSearchBar,
    useUnifiedSearch,
    StatCard,
    SummaryTable,
    Skeleton,
    EmptyState,
    ToolbarCreateButton,
    type ToolbarActionItem,
} from '@/components/shared'
import type { UnifiedSearchConfig } from '@/types/unified-search'
import { useBankOverview } from '../hooks/useBankOverview'
import type { BankOverviewData } from '../hooks/useBankOverview'
import type { PendingChargeRow, UpcomingInstallment, UnbilledItemRow } from '../types'
import { mapToUnbilledItemRows } from './utils'
import { CardPendingChargeDrawer } from './CardPendingChargeDrawer'
import { BillChargesModal } from './BillChargesModal'
import { PieChart } from "@/components/shared"
import { useHubPanel } from '@/components/providers'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { useEntityRouteActions } from '@/hooks/useEntityRouteActions'
import { useUnbilledCharges } from '../hooks/useUnbilledCharges'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { today, thisWeek, thisMonth, thisQuarter, thisYear } from '@/lib/date-presets'

interface UnbilledChargesViewProps {
    bankId: number
}

const chargeTypeColorMap: Record<string, string> = {
    COMMISSION: 'bg-warning text-warning-foreground',
    TAX: 'bg-destructive text-destructive-foreground',
    FEE: 'bg-info text-info-foreground',
    INSURANCE: 'bg-accent text-accent-foreground',
    INTEREST: 'bg-success text-success-foreground',
    OTHER: 'bg-muted text-muted-foreground',
}

const CHARGE_TYPE_COLORS: Record<string, string> = {
    COMMISSION: "#f59e0b",
    TAX: "#ef4444",
    FEE: "#3b82f6",
    INSURANCE: "#8b5cf6",
    INTEREST: "#10b981",
    OTHER: "#6b7280",
}

interface UnbilledSummary {
    total: number
    count: number
    charges: number
    installments: number
}

export function UnbilledChargesView({
    bankId,
}: UnbilledChargesViewProps) {
    const [chargeDrawerOpen, setChargeDrawerOpen] = useState(false)
    const [showBillCharges, setShowBillCharges] = useState(false)
    const queryClient = useQueryClient()
    const { openHub } = useHubPanel()
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const router = useRouter()
    const { selectedId, openSelected, clearActions } = useEntityRouteActions()
    const isNewModal = searchParams.get('modal') === 'new'

    const { data: overview, isLoading: overviewLoading } = useBankOverview(bankId)
    const overviewData = (overview && !overviewLoading ? overview : null) as BankOverviewData | null

    const creditCardAccounts = useMemo(
        () => (overviewData?.accounts?.filter(
            (acc) => acc.account_type === 'CREDIT_CARD'
        ).map(a => ({ id: a.id, name: a.name, currency: a.currency })) ?? []),
        [overviewData],
    )

    const unifiedConfig: UnifiedSearchConfig = useMemo(() => ({
        searchFields: [
            { key: 'contact', label: 'Contacto / OC', type: 'text', serverParam: 'search', clientKey: ['partnerName', 'purchaseOrderDisplayId', 'reference'] },
            { key: 'amount', label: 'Monto', type: 'text', serverParam: 'search' },
        ],
        filters: [
            {
                type: 'single',
                key: 'scope',
                label: 'Alcance',
                serverParam: 'scope',
                defaultValue: 'month',
                options: [
                    { label: 'Cargos del mes', value: 'month' },
                    { label: 'Todos los cargos', value: 'all' },
                ],
            },
            {
                type: 'single',
                key: 'card',
                label: 'Tarjeta',
                serverParam: 'card',
                defaultValue: String(creditCardAccounts[0]?.id ?? ''),
                options: creditCardAccounts.map(a => ({ label: a.name, value: String(a.id) })),
            },
        ],
        dateFilters: [
            {
                type: 'date',
                key: 'charge_date',
                label: 'Fecha del cargo',
                options: [
                    { label: 'Hoy', serverParamFrom: 'charge_date_from', serverParamTo: 'charge_date_to', getValue: today },
                    { label: 'Esta semana', serverParamFrom: 'charge_date_from', serverParamTo: 'charge_date_to', getValue: thisWeek },
                    { label: 'Este mes', serverParamFrom: 'charge_date_from', serverParamTo: 'charge_date_to', getValue: thisMonth },
                    { label: 'Este trimestre', serverParamFrom: 'charge_date_from', serverParamTo: 'charge_date_to', getValue: thisQuarter },
                    { label: 'Este año', serverParamFrom: 'charge_date_from', serverParamTo: 'charge_date_to', getValue: thisYear },
                ],
            },
        ],
        basePeriod: { serverParamFrom: 'date_from', serverParamTo: 'date_to' },
    }), [creditCardAccounts])

    const search = useUnifiedSearch(unifiedConfig)

    const selectedCardAccount = search.filters.card ? Number(search.filters.card) : (creditCardAccounts[0]?.id ?? 0)
    const currentAccount = creditCardAccounts.find(a => a.id === selectedCardAccount)
    const cardAccountName = currentAccount?.name ?? ''
    const currency = currentAccount?.currency ?? 'CLP'

    const cutOffDate = (search.filters.scope ?? 'month') !== 'all' ? new Date().toISOString().split('T')[0] : undefined

    const { data: result, isLoading } = useUnbilledCharges(selectedCardAccount, cutOffDate)

    const charges: PendingChargeRow[] = result?.charges ?? []
    // ── Derive chargeToEdit from URL param (selectedId) ───────────
    const chargeToEdit = useMemo(
        () => selectedId ? charges.find(c => String(c.id) === selectedId) ?? null : null,
        [selectedId, charges],
    )
    const upcomingInstallments: UpcomingInstallment[] = result?.upcoming_installments ?? []
    const summary: UnbilledSummary | undefined = result?.summary
    const forecast = result?.forecast

    const mergedRows = useMemo(
        () => mapToUnbilledItemRows(charges, upcomingInstallments),
        [charges, upcomingInstallments],
    )

    const filteredRows = useMemo(() => {
        let result = search.filterFn(mergedRows)
        const { charge_date_from, charge_date_to } = search.filters
        if (charge_date_from) {
            result = result.filter(r => r.date >= charge_date_from)
        }
        if (charge_date_to) {
            result = result.filter(r => r.date <= charge_date_to)
        }
        return result
    }, [mergedRows, search.filterFn, search.filters])

    // ── Sync URL params with drawer state (adjust during render) ──
    if (selectedId && chargeToEdit && !chargeDrawerOpen) {
        setChargeDrawerOpen(true)
    }
    if (isNewModal && !chargeDrawerOpen) {
        setChargeDrawerOpen(true)
    }

    // Side effect only: clear URL when selectedId points to a missing charge
    useEffect(() => {
        if (selectedId && !chargeToEdit) {
            clearActions()
        }
    }, [selectedId, chargeToEdit, clearActions])

    const handleChargeDrawerOpenChange = (open: boolean) => {
        setChargeDrawerOpen(open)
        if (!open) {
            clearActions()
            if (isNewModal) {
                const params = new URLSearchParams(searchParams.toString())
                params.delete('modal')
                const q = params.toString()
                router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
            }
        }
    }

    const handleChargeDrawerSuccess = () => {
        handleChargeDrawerOpenChange(false)
        invalidateCrossFeature(queryClient, [['unbilled-charges', selectedCardAccount]])
    }

    const handleAddChargeClick = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('modal', 'new')
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const handleBillChargesSuccess = () => {
        setShowBillCharges(false)
        invalidateCrossFeature(queryClient, [['unbilled-charges', selectedCardAccount], ['card-statements']])
        toast.success('Cargos facturados exitosamente')
    }

    const columns: ColumnDef<UnbilledItemRow, unknown>[] = [
        {
            accessorKey: 'date',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Date value={row.original.date} />
                </div>
            ),
            sortingFn: 'datetime',
        },
        {
            id: 'cuota',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Cuota" className="justify-center" />
            ),
            cell: ({ row }) => {
                const item = row.original
                if (item.source === 'pending') {
                    return (
                        <div className="flex justify-center w-full">
                            <span className="text-xs text-muted-foreground">N/A</span>
                        </div>
                    )
                }
                if (!item.installmentNumber || !item.totalInstallments) return null
                return (
                    <div className="flex justify-center w-full">
                        <span className="text-xs font-medium tabular-nums">
                            {item.installmentNumber}/{item.totalInstallments}
                        </span>
                    </div>
                )
            },
            enableSorting: false,
        },
        {
            id: 'compra',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Compra asociada" className="justify-center" />
            ),
            cell: ({ row }) => {
                const item = row.original
                if (item.source !== 'installment' || !item.originalInstallment) return null
                const inst = item.originalInstallment
                return (
                    <div className="flex flex-col items-center gap-0.5 w-full">
                        {inst.partner_name && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[140px] leading-tight">
                                {inst.partner_name}
                            </span>
                        )}
                        <Button
                            variant="ghost"
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                if (inst.purchase_order_id) {
                                    openHub({ orderId: inst.purchase_order_id, type: 'purchase' })
                                }
                            }}
                            className="inline-block outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md transition-shadow h-auto w-auto p-0 border-none bg-transparent hover:bg-transparent shadow-none"
                        >
                            <StatusBadge
                                status={inst.purchase_order_display_id ? 'info' : 'muted'}
                                label={inst.purchase_order_display_id || 'Sin OC'}
                            />
                        </Button>
                    </div>
                )
            },
            enableSorting: false,
        },
        {
            accessorKey: 'amount',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Monto" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency
                        value={row.original.amount}
                        currency={currency}
                        className="font-bold"
                    />
                </div>
            ),
            sortingFn: 'basic',
        },
        {
            id: 'tipo',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />
            ),
            cell: ({ row }) => {
                const item = row.original
                const colorClass = item.source === 'pending'
                    ? (chargeTypeColorMap[item.chargeType ?? ''] || 'bg-muted text-muted-foreground')
                    : 'bg-info text-info-foreground'
                const label = item.chargeTypeDisplay || item.chargeType || (item.source === 'installment' ? 'Cuota' : '')
                return (
                    <div className="flex justify-center w-full">
                        <StatusBadge
                            status={item.chargeType || item.source}
                            label={label}
                        />
                    </div>
                )
            },
        },
    ]

    const toolbarActions: ToolbarActionItem[] = [
        ...(summary && summary.count > 0 ? [{
            key: 'bill',
            label: 'Facturar Cargos',
            icon: Receipt,
            onClick: () => setShowBillCharges(true),
        }] : []),
    ]

    const fmt = (n: number) => new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(n)

    // ── Charge type helpers for hub ──
    const chargeTypeDistribution = useMemo(() => {
        const groups: Record<string, { count: number; amount: number; display: string }> = {}
        for (const c of charges) {
            const t = c.charge_type || 'OTHER'
            if (!groups[t]) groups[t] = { count: 0, amount: 0, display: c.charge_type_display || t }
            groups[t].count++
            groups[t].amount += Number(c.amount)
        }
        return Object.entries(groups)
            .map(([id, v]) => ({ id, display: v.display, count: v.count, amount: v.amount, color: CHARGE_TYPE_COLORS[id] ?? CHARGE_TYPE_COLORS.OTHER }))
            .sort((a, b) => b.amount - a.amount)
    }, [charges])

    const totalInstAmount = useMemo(
        () => upcomingInstallments.reduce((s, i) => s + Number(i.principal_amount), 0),
        [upcomingInstallments],
    )
    const totalInstCount = upcomingInstallments.length

    const usedPercent = forecast?.credit_limit ? (parseFloat(forecast.total_used) / parseFloat(forecast.credit_limit)) * 100 : 0

    if (overviewLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="space-y-3 w-full max-w-md">
                    <Skeleton className="h-8 w-48 mx-auto" />
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        )
    }

    if (creditCardAccounts.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <EmptyState
                    title="No hay tarjetas de crédito"
                    description="Cree una cuenta de tipo Tarjeta de Crédito."
                    icon={CreditCard}
                />
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.unbilled-charge"
                    columns={columns}
                    data={filteredRows}
                    isLoading={isLoading}
                    variant="embedded"
                    unifiedSearch={<UnifiedSearchBar
                        config={unifiedConfig}
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
                        placeholder="Buscar por contacto, OC o monto..."
                    />}
                    unifiedSearchConfig={unifiedConfig}
                    showReset={search.isFiltered}
                    isFiltered={search.isFiltered}
                    onReset={search.clearAll}
                    onRowClick={(row: UnbilledItemRow) => {
                        if (row.source === 'pending' && row.originalPendingCharge) {
                            openSelected(row.originalPendingCharge.id)
                        }
                    }}
                    analyticsPanel={{
                        screen: {
                            entityName: "Gestión TC",
                            tabs: [
                                {
                                    value: 'cupo',
                                    label: 'Cupo y Cargos',
                                    icon: Gauge,
                                    columns: [
                                        {
                                            id: 'cupo-col',
                                            weight: 2,
                                            sections: [
                                                {
                                                    id: 'cupo-unified',
                                                    content: {
                                                        type: 'custom',
                                                         render: forecast?.credit_limit ? (
                                                            <StatCard
                                                                label="Cupo"
                                                                variant="chart"
                                                                className="flex-1"
                                                                chart={
                                                                    <div className="flex flex-col gap-4">
                                                                        <div className="flex flex-col gap-1.5">
                                                                            <div className="flex justify-between items-center text-xs">
                                                                                <span className="font-bold text-foreground">
                                                                                    <MoneyDisplay amount={parseFloat(forecast.total_used)} inline /> usado
                                                                                </span>
                                                                                <span className="font-bold text-muted-foreground">
                                                                                    <MoneyDisplay amount={parseFloat(forecast.available_credit ?? '0')} inline /> disp.
                                                                                </span>
                                                                            </div>
                                                                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                                                <div
                                                                                    className="h-full rounded-full bg-warning transition-all"
                                                                                    style={{ width: `${Math.min(usedPercent, 100)}%` }}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        <SummaryTable
                                                                            rows={[
                                                                                { label: 'Límite de Crédito', value: <MoneyDisplay amount={parseFloat(forecast.credit_limit)} inline /> },
                                                                                { label: 'Total Usado', value: <MoneyDisplay amount={parseFloat(forecast.total_used)} inline /> },
                                                                                { label: 'Disponible', value: <MoneyDisplay amount={parseFloat(forecast.available_credit ?? '0')} inline /> },
                                                                                { label: '% Usado', value: `${usedPercent.toFixed(1)}%` },
                                                                            ]}
                                                                        />
                                                                    </div>
                                                                }
                                                            />
                                                        ) : (
                                                            <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de cupo</p>
                                                        ),
                                                    },
                                                },
                                            ],
                                        },
                                        {
                                            id: 'cargos-col',
                                            weight: 1,
                                            sections: [
                                                {
                                                    id: 'charge-types-pie',
                                                    content: chargeTypeDistribution.length > 0 || totalInstCount > 0 ? {
                                                        type: 'custom',
                                                        render: (
                                                            <StatCard label="Distribución de Cargos" variant="chart" className="flex-1" chart={
                                                                <div className="flex flex-col gap-3">
                                                                    <div className="flex-1 min-h-0" style={{ minHeight: 160 }}>
                                                                        <PieChart
                                                                            data={[...chargeTypeDistribution.map((d) => ({ id: d.display, value: d.amount })), ...(totalInstCount > 0 ? [{ id: 'Cuotas', value: totalInstAmount }] : [])]}
                                                                            legends={[{
                                                                                anchor: "bottom",
                                                                                direction: "row",
                                                                                translateY: 28,
                                                                                itemWidth: 100,
                                                                                itemHeight: 14,
                                                                                itemsSpacing: 8,
                                                                                symbolSize: 8,
                                                                            }]}
                                                                        />
                                                                    </div>
                                                                    <div className="shrink-0">
                                                                        <SummaryTable
                                                                            rows={[
                                                                                ...chargeTypeDistribution.map(ct => ({
                                                                                    label: ct.display,
                                                                                    value: <span className="text-xs font-bold">${fmt(ct.amount)} ({ct.count} cargos)</span>,
                                                                                })),
                                                                                ...(totalInstCount > 0 ? [{
                                                                                    label: 'Cuotas',
                                                                                    value: <span className="text-xs font-bold">${fmt(totalInstAmount)} ({totalInstCount} cuotas)</span>,
                                                                                }] : []),
                                                                            ]}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            } />
                                                        ),
                                                    } : {
                                                        type: 'custom',
                                                        render: (
                                                            <p className="text-sm text-muted-foreground italic py-4 text-center">Sin cargos ni cuotas</p>
                                                        ),
                                                    },
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                            cardAccounts: creditCardAccounts,
                            cardAccountId: selectedCardAccount,
                            onCardAccountChange: (id) => search.applyFilter('card', String(id)),
                            scope: (search.filters.scope ?? 'month') as 'month' | 'all',
                            onScopeChange: (v) => search.applyFilter('scope', v),
                        },
                    }}
                    createAction={<ToolbarCreateButton label="Agregar Cargo" onClick={handleAddChargeClick} />}
                    toolbarActions={toolbarActions}
                    emptyState={{
                        context: 'treasury',
                        icon: CreditCard,
                        title: 'No hay cargos no facturados',
                        description: 'Los cargos de esta tarjeta de crédito aparecerán aquí antes de ser facturados.',
                    }}
                    renderCard={(item: UnbilledItemRow) => (
                        <EntityCard>
                            <EntityCard.Header
                                title={item.reference || (item.source === 'pending' ? (item.chargeTypeDisplay || 'Cargo') : `Cuota ${item.installmentNumber}/${item.totalInstallments}`)}
                                subtitle={item.date}
                                trailing={
                                    <StatusBadge
                                        status={item.chargeType || item.source}
                                        label={item.chargeTypeDisplay || item.source}
                                    />
                                }
                            />
                            <EntityCard.Body>
                                {item.source === 'pending' && item.notes && (
                                    <EntityCard.Field label="Descripción" value={item.notes} full />
                                )}
                            </EntityCard.Body>
                            <EntityCard.Footer className="justify-between items-center border-t bg-muted/10 py-2 px-4">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                    Monto
                                </span>
                                <DataCell.Currency
                                    value={item.amount}
                                    currency={currency}
                                    className="font-bold text-base"
                                />
                            </EntityCard.Footer>
                        </EntityCard>
                    )}
                    cardSkeleton={{ showFooter: true }}
                />
            </div>

            <CardPendingChargeDrawer
                open={chargeDrawerOpen}
                onOpenChange={handleChargeDrawerOpenChange}
                cardAccountId={selectedCardAccount}
                cardAccountName={cardAccountName}
                currency={currency}
                charge={chargeToEdit}
                onSuccess={handleChargeDrawerSuccess}
            />

            {showBillCharges && (
                <BillChargesModal
                    cardAccountId={selectedCardAccount}
                    cardAccountName={cardAccountName}
                    total={summary?.total || 0}
                    charges={charges}
                    installments={upcomingInstallments}
                    currency={currency}
                    onSuccess={handleBillChargesSuccess}
                    onCancel={() => setShowBillCharges(false)}
                />
            )}

        </div>
    )
}
