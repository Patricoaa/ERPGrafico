"use client"
import { formatCurrency } from "@/lib/money";

import { BaseModal, Chip, DateRangeFilter, EmptyState, SkeletonShell, StatusBadge } from '@/components/shared'

import { useState, useMemo } from "react"

import { DataTable, StatCard } from "@/components/shared"
import {
    History,
    FileText,
    Receipt
} from "lucide-react"
import { useSubscriptionHistory } from "../hooks/useSubscriptions"

import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns"
import { es } from "date-fns/locale"
import { DataCell } from '@/components/shared'

import { UnderlineTabs, UnderlineTabsContent } from "@/components/shared"
import type { ColumnDef } from "@tanstack/react-table"
import { BarChart } from "@/components/shared"
import { useHubPanel } from "@/components/providers/HubPanelProvider"

import { translateStatus } from "@/lib/utils"

interface SubscriptionHistoryModalProps {
    subscriptionId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

interface PriceHistoryEntry {
    date: string
    unit_cost: number
    order_number: string
}

interface OrderHistoryEntry {
    id: number
    number: string
    display_id: string
    date: string
    status: string
    total: number
    receiving_status: string
}

interface NoteHistoryEntry {
    id: number
    number: string
    display_id: string
    date: string
    status: string
    dte_type: string
    total: number
    purchase_order_number: string | null
}

interface SubscriptionHistory {
    orders: OrderHistoryEntry[]
    price_history: PriceHistoryEntry[]
    notes: NoteHistoryEntry[]
    product_name: string
    supplier_name: string
}

// Placeholder tipado para el esqueleto - sigue el patrón del contrato
const SUBSCRIPTION_HISTORY_SKELETON: SubscriptionHistory = {
    orders: [],
    price_history: [],
    notes: [],
    product_name: "————————————",
    supplier_name: "————————————"
}

export function SubscriptionHistoryModal({ subscriptionId, open, onOpenChange }: SubscriptionHistoryModalProps) {
    // useSubscriptionHistory cachea por subscriptionId; al cerrar y reabrir
    // misma sub dentro del staleTime devuelve cache. refetch se usa como
    // callback de éxito desde acciones del Hub que mutan datos vinculados.
    const { data, isLoading: loading, refetch: refetchHistory } = useSubscriptionHistory<SubscriptionHistory>(open ? subscriptionId : null)
    const { openHub } = useHubPanel()
    const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>()
    const [activeTab, setActiveTab] = useState("historial")

    // El fetch lo dispara useSubscriptionHistory automáticamente cuando
    // (open && subscriptionId). No hace falta efecto imperativo.

    const filteredPriceHistory = useMemo(() => {
        if (!data) return []
        let items = [...data.price_history].reverse()

        if (dateRange?.from) {
            const from = startOfDay(dateRange.from)
            const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(new Date())
            items = items.filter(item => {
                const itemDate = new Date(item.date)
                return isWithinInterval(itemDate, { start: from, end: to })
            })
        }

        return items
    }, [data, dateRange])

    if (!open) return null

    return (
        <>
            <BaseModal
                open={open}
                onOpenChange={onOpenChange}
                size="full"
                hideScrollArea={true}
                allowOverflow={true}
                className="max-w-5xl"
                variant="form-tabs"
                icon={History}
                title="Historial de Suscripción"
                description={data ? `${data.product_name} | ${data.supplier_name}` : undefined}
            >
                <div className="flex flex-col h-full overflow-visible">
                    {(!open || !subscriptionId) ? null : (
                        <SkeletonShell isLoading={loading} ariaLabel="Cargando historial de suscripción">
                            {!data ? (
                                <div className="flex-1 flex items-center justify-center py-20">
                                    <p className="text-muted-foreground">Error al cargar datos.</p>
                                </div>
                            ) : (
                                <UnderlineTabs
                                    value={activeTab}
                                    onValueChange={setActiveTab}
                                    orientation="horizontal"
                                    variant="underline"
                                    items={[
                                        { value: "historial", label: "Historial de Costos", icon: History },
                                        { value: "orders", label: "Órdenes de Compra (OCS)", icon: FileText },
                                        { value: "notes", label: "Notas de Crédito / Débito", icon: Receipt }
                                    ]}
                                    className="flex-1 overflow-visible"
                                >
                                    <div className="flex-1 overflow-auto p-6 scrollbar-thin">

                                        {/* HISTORIAL TAB */}
                                        <UnderlineTabsContent value="historial" className="mt-0 space-y-6">
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <StatCard
                                                        label="Último Precio"
                                                        value={<DataCell.Currency value={data.price_history[0]?.unit_cost || 0} className="text-2xl font-black text-left" />}
                                                        variant="compact"
                                                        accent="primary"
                                                        className="shadow-none"
                                                    />
                                                    <StatCard
                                                        label="OCS Totales"
                                                        value={<>{data.orders.length} <span className="text-xs">documentos</span></>}
                                                        variant="compact"
                                                        accent="warning"
                                                        className="shadow-none"
                                                    />
                                                    <StatCard
                                                        label="Estado Actual"
                                                        value={<StatusBadge status="SUCCESS" label="ACTIVA" size="md" />}
                                                        variant="compact"
                                                        accent="success"
                                                        className="shadow-none"
                                                    />
                                                </div>

                                                <div className="flex justify-end">
                                                    <DateRangeFilter onDateChange={setDateRange} label="Periodo para el gráfico" />
                                                </div>
                                            </div>

                                            <div className="h-[400px] w-full bg-card rounded-md border p-6 shadow-card">
                                                <BarChart
                                                    data={filteredPriceHistory as unknown as { date: string; unit_cost: number }[]}
                                                    keys={["unit_cost"]}
                                                    indexBy="date"
                                                    colors={{ scheme: "blues" }}
                                                    enableGridY
                                                    axisBottom={{
                                                        tickSize: 0,
                                                        tickPadding: 10,
                                                        format: (v: string) => format(new Date(v), 'MMM d', { locale: es }),
                                                    }}
                                                    axisLeft={{
                                                        tickSize: 0,
                                                        tickPadding: 10,
                                                        format: (v: number) => formatCurrency(v),
                                                    }}
                                                    renderTooltip={({ value, indexValue }) => (
                                                        <>
                                                            <p className="font-medium">{format(new Date(indexValue as string), 'PPP', { locale: es })}</p>
                                                            <p className="font-bold">Costo Unitario: {formatCurrency(value)}</p>
                                                        </>
                                                    )}
                                                />
                                            </div>
                                            {filteredPriceHistory.length === 0 && (
                                                <EmptyState
                                                    context="search"
                                                    variant="compact"
                                                    title="Sin datos"
                                                    description="No hay datos para el periodo seleccionado."
                                                />
                                            )}
                                        </UnderlineTabsContent>

                                        {/* ORDERS TAB */}
                                        <UnderlineTabsContent value="orders" className="mt-0">
                                            <div className="rounded-md border shadow-card overflow-hidden bg-card">
                                                <OrderTable
                                                    orders={data.orders}
                                                    onOpenHub={(orderId) => openHub({
                                                        orderId,
                                                        type: 'purchase' as const,
                                                        onActionSuccess: () => refetchHistory()
                                                    })}
                                                />
                                            </div>
                                        </UnderlineTabsContent>

                                        {/* NOTES TAB */}
                                        <UnderlineTabsContent value="notes" className="mt-0">
                                            <div className="rounded-md border shadow-card overflow-hidden bg-card">
                                                <NoteTable
                                                    notes={data.notes}
                                                    onOpenHub={(invoiceId) => openHub({
                                                        invoiceId,
                                                        type: 'purchase' as const,
                                                        onActionSuccess: () => refetchHistory()
                                                    })}
                                                />
                                            </div>
                                        </UnderlineTabsContent>
                                    </div>
                                </UnderlineTabs>
                            )}
                        </SkeletonShell>
                    )}
                </div>
            </BaseModal>
        </>
    )
}

function OrderTable({ orders, onOpenHub }: { orders: OrderHistoryEntry[]; onOpenHub: (orderId: number) => void }) {
    const columns: ColumnDef<OrderHistoryEntry>[] = [
        {
            header: "Documento",
            cell: ({ row }) => (
                <span className="font-black text-sm text-primary">{row.original.display_id}</span>
            ),
        },
        {
            header: "Fecha",
            cell: ({ row }) => <DataCell.Date value={row.original.date} />,
        },
        {
            header: "Estado",
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <StatusBadge
                        status={row.original.status === 'PAID' || row.original.status === 'RECEIVED' ? 'SUCCESS' : 'NEUTRAL'}
                        label={translateStatus(row.original.status)}
                    />
                </div>
            ),
        },
        {
            header: "Monto Total",
            cell: ({ row }) => (
                <DataCell.Currency value={row.original.total} className="text-right font-black" />
            ),
        },
        {
            header: "Acciones",
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <DataCell.ActionGroup>
                        <DataCell.Action
                            action="hub"
                            title="Gestionar OCS"
                            onClick={() => onOpenHub(row.original.id)}
                        />
                    </DataCell.ActionGroup>
                </div>
            ),
        },
    ]

    return (
        <DataTable
            columns={columns}
            data={orders}
            variant="embedded"
            hidePagination
            emptyState={{
                context: "search",
                title: "Sin órdenes",
                description: "No se encontraron órdenes de compra para esta suscripción.",
            }}
        />
    )
}

function NoteTable({ notes, onOpenHub }: { notes: NoteHistoryEntry[]; onOpenHub: (invoiceId: number) => void }) {
    const columns: ColumnDef<NoteHistoryEntry>[] = [
        {
            header: "Nota",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-black text-sm text-primary">{row.original.display_id}</span>
                    <span className="text-[9px] text-muted-foreground font-bold uppercase">{row.original.dte_type.replace('_', ' ')}</span>
                </div>
            ),
        },
        {
            header: "OCS Relacionada",
            cell: ({ row }) => (
                <Chip size="xs" className="whitespace-nowrap">
                    OCS-{row.original.purchase_order_number}
                </Chip>
            ),
        },
        {
            header: "Fecha",
            cell: ({ row }) => <DataCell.Date value={row.original.date} />,
        },
        {
            header: "Estado",
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <StatusBadge
                        status={row.original.status === 'PAID' || row.original.status === 'POSTED' ? 'SUCCESS' : 'NEUTRAL'}
                        label={translateStatus(row.original.status)}
                    />
                </div>
            ),
        },
        {
            header: "Monto Total",
            cell: ({ row }) => (
                <DataCell.Currency value={row.original.total} className="text-right font-black" />
            ),
        },
        {
            header: "Acciones",
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <DataCell.ActionGroup>
                        <DataCell.Action
                            action="hub"
                            title="Gestionar nota"
                            onClick={() => onOpenHub(row.original.id)}
                        />
                    </DataCell.ActionGroup>
                </div>
            ),
        },
    ]

    return (
        <DataTable
            columns={columns}
            data={notes}
            variant="embedded"
            hidePagination
            emptyState={{
                context: "search",
                title: "Sin notas",
                description: "No se encontraron notas asociadas a este producto.",
            }}
        />
    )
}
