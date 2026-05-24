"use client"
import { formatCurrency } from "@/lib/money";
import { formatPlainDate } from "@/lib/utils";

import { SkeletonShell } from "@/components/shared"

import { useState, useMemo } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { DataTable } from "@/components/shared"
import {
    History,
    FileText,
    Receipt
} from "lucide-react"
import { useSubscriptionHistory } from "../hooks/useSubscriptions"
import { EmptyState } from "@/components/shared/EmptyState"
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns"
import { es } from "date-fns/locale"
import { DataCell } from '@/components/shared'
import { StatusBadge } from "@/components/shared/StatusBadge"
import { FormTabs, FormTabsContent } from "@/components/shared"
import type { ColumnDef } from "@tanstack/react-table"
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    Cell
} from 'recharts'
import { Card, CardContent } from "@/components/ui/card"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"
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
                        <FormTabs
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
                                <FormTabsContent value="historial" className="mt-0 space-y-6">
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <Card className="bg-primary/10/30 border-primary/10 shadow-none">
                                                <CardContent className="p-4">
                                                    <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Último Precio</p>
                                                    <DataCell.Currency value={data.price_history[0]?.unit_cost || 0} className="text-2xl font-black text-primary text-left" />
                                                </CardContent>
                                            </Card>
                                            <Card className="bg-warning/10/30 border-warning/10 shadow-none">
                                                <CardContent className="p-4">
                                                    <p className="text-[10px] font-bold text-warning uppercase tracking-wider">OCS Totales</p>
                                                    <div className="flex items-baseline gap-2">
                                                        <p className="text-2xl font-black text-warning">{data.orders.length}</p>
                                                        <span className="text-xs text-warning">documentos</span>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                            <Card className="bg-success/10/30 border-success/10 shadow-none">
                                                <CardContent className="p-4">
                                                    <p className="text-[10px] font-bold text-success uppercase tracking-wider">Estado Actual</p>
                                                    <div className="mt-1">
                                                        <StatusBadge status="SUCCESS" label="ACTIVA" size="md" />
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>

                                        <div className="flex justify-end">
                                            <DateRangeFilter onDateChange={setDateRange} label="Periodo para el gráfico" />
                                        </div>
                                    </div>

                                    <div className="h-[400px] w-full bg-white rounded-md border p-6 shadow-sm">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={filteredPriceHistory}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--muted)" />
                                                <XAxis
                                                    dataKey="date"
                                                    tickFormatter={(str) => format(new Date(str), 'MMM d', { locale: es })}
                                                    fontSize={10}
                                                    tickMargin={10}
                                                    stroke="var(--muted-foreground)"
                                                />
                                                <YAxis fontSize={10} stroke="var(--muted-foreground)" tickFormatter={(val) => formatCurrency(val)} />
                                                <RechartsTooltip
                                                    labelFormatter={(val) => format(new Date(val), 'PPP', { locale: es })}
                                                    formatter={(val: number | undefined) => [val !== undefined ? formatCurrency(val) : '---', 'Costo Unitario']}
                                                    contentStyle={{ borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px', backgroundColor: 'var(--popover)', color: 'var(--popover-foreground)' }}
                                                />
                                                <Bar
                                                    dataKey="unit_cost"
                                                    name="Precio"
                                                    fill="var(--primary)"
                                                    radius={[6, 6, 0, 0]}
                                                    barSize={40}
                                                >
                                                    {filteredPriceHistory.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--primary)' : 'var(--primary)'} fillOpacity={index === 0 ? 1 : 0.7} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    {filteredPriceHistory.length === 0 && (
                                        <EmptyState
                                            context="search"
                                            variant="compact"
                                            title="Sin datos"
                                            description="No hay datos para el periodo seleccionado."
                                        />
                                    )}
                                </FormTabsContent>

                                {/* ORDERS TAB */}
                                <FormTabsContent value="orders" className="mt-0">
                                    <div className="rounded-md border shadow-sm overflow-hidden bg-card">
                                        <OrderTable
                                            orders={data.orders}
                                            onOpenHub={(orderId) => openHub({
                                                orderId,
                                                type: 'purchase' as const,
                                                onActionSuccess: () => refetchHistory()
                                            })}
                                        />
                                    </div>
                                </FormTabsContent>

                                {/* NOTES TAB */}
                                <FormTabsContent value="notes" className="mt-0">
                                    <div className="rounded-md border shadow-sm overflow-hidden bg-card">
                                        <NoteTable
                                            notes={data.notes}
                                            onOpenHub={(invoiceId) => openHub({
                                                invoiceId,
                                                type: 'purchase' as const,
                                                onActionSuccess: () => refetchHistory()
                                            })}
                                        />
                                    </div>
                                </FormTabsContent>
                            </div>
                        </FormTabs>
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
            cell: ({ row }) => (
                <span className="text-xs font-medium">{formatPlainDate(row.original.date)}</span>
            ),
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
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-[0.25rem] border border-border bg-muted/50 text-muted-foreground whitespace-nowrap font-mono">
                    OCS-{row.original.purchase_order_number}
                </span>
            ),
        },
        {
            header: "Fecha",
            cell: ({ row }) => (
                <span className="text-xs font-medium">{formatPlainDate(row.original.date)}</span>
            ),
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
