"use client"
import { formatCurrency } from "@/lib/money"
import { parseDateOnly } from "@/lib/utils"

import { BaseModal, DateRangeFilter, EmptyState, SkeletonShell, StatusBadge } from '@/components/shared'

import { useState, useMemo } from "react"

import { StatCard } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { subscriptionOrderEntity, subscriptionOrderViews, type SubscriptionOrderEntry } from "../entity-view/subscriptionOrder.entity"
import { subscriptionNoteEntity, subscriptionNoteViews, type SubscriptionNoteEntry } from "../entity-view/subscriptionNote.entity"
import {
    History,
    FileText,
    Receipt
} from "lucide-react"
import { useSubscriptionHistory } from "../hooks/useSubscriptions"

import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns"
import { es } from "date-fns/locale"
import { DataCell } from '@/components/shared'

import { TabBar, TabBarContent } from "@/components/shared"
import { BarChart } from "@/components/shared"
import { useOnEntityStackClose } from "@/hooks/useOnEntityStackClose"


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
    /** Eje de pago (ADR-0084). */
    payment_status?: string
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



export function SubscriptionHistoryModal({ subscriptionId, open, onOpenChange }: SubscriptionHistoryModalProps) {
    // useSubscriptionHistory cachea por subscriptionId; al cerrar y reabrir
    // misma sub dentro del staleTime devuelve cache. refetch se usa como
    // callback de éxito desde acciones del Hub que mutan datos vinculados.
    const { data, isLoading: loading, refetch: refetchHistory } = useSubscriptionHistory<SubscriptionHistory>(open ? subscriptionId : null)
    // Fichas documentales (ADR-0083); al volver se refresca el historial
    useOnEntityStackClose(() => { void refetchHistory() })
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
                const itemDate = parseDateOnly(item.date)
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
                                <TabBar
                                    value={activeTab}
                                    onValueChange={setActiveTab}
                                    orientation="horizontal"
                                    items={[
                                        { value: "historial", label: "Historial de Costos", icon: History },
                                        { value: "orders", label: "Órdenes de Compra (OCS)", icon: FileText },
                                        { value: "notes", label: "Notas de Crédito / Débito", icon: Receipt }
                                    ]}
                                    className="flex-1 overflow-visible"
                                >
                                    <div className="flex-1 overflow-auto p-6 scrollbar-thin">

                                        {/* HISTORIAL TAB */}
                                        <TabBarContent value="historial" className="mt-0 space-y-6">
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <StatCard
                                                        label="Último Precio"
                                                        value={<DataCell.Currency value={data.price_history[0]?.unit_cost || 0} weight="black" className="text-2xl text-left" />}
                                                        variant="compact"
                                                        accent="primary"
                                                    />
                                                    <StatCard
                                                        label="OCS Totales"
                                                        value={<>{data.orders.length} <span className="text-xs">documentos</span></>}
                                                        variant="compact"
                                                        accent="warning"
                                                    />
                                                    <StatCard
                                                        label="Estado Actual"
                                                        value={<StatusBadge status="SUCCESS" label="ACTIVA" size="md" variant="badge" />}
                                                        variant="compact"
                                                        accent="success"
                                                    />
                                                </div>

                                                <div className="flex justify-end">
                                                    <DateRangeFilter onDateChange={setDateRange} label="Periodo para el gráfico" />
                                                </div>
                                            </div>

                                            <div className="surface-panel h-[400px] w-full p-6 shadow-card">
                                                <BarChart
                                                    data={filteredPriceHistory as unknown as { date: string; unit_cost: number }[]}
                                                    keys={["unit_cost"]}
                                                    indexBy="date"
                                                    tooltipFormat="currency"
                                                    axisBottom={{
                                                        tickSize: 0,
                                                        tickPadding: 10,
                                                        format: (v: string) => format(parseDateOnly(v.split('T')[0]), 'MMM d', { locale: es }),
                                                    }}
                                                    axisLeft={{
                                                        tickSize: 0,
                                                        tickPadding: 10,
                                                        format: (v: number) => formatCurrency(v),
                                                    }}
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
                                        </TabBarContent>

                                        {/* ORDERS TAB */}
                                        <TabBarContent value="orders" className="mt-0">
                                            <div className="surface-panel shadow-card overflow-hidden">
                                                <OrderTable orders={data.orders} />
                                            </div>
                                        </TabBarContent>

                                        {/* NOTES TAB */}
                                        <TabBarContent value="notes" className="mt-0">
                                            <div className="surface-panel shadow-card overflow-hidden">
                                                <NoteTable notes={data.notes} />
                                            </div>
                                        </TabBarContent>
                                    </div>
                                </TabBar>
                            )}
                        </SkeletonShell>
                    )}
                </div>
            </BaseModal>
        </>
    )
}

function OrderTable({ orders }: { orders: OrderHistoryEntry[] }) {
    const collection = useEntityCollection(
        subscriptionOrderEntity,
        { rows: orders as SubscriptionOrderEntry[] },
        { pagination: { mode: "none" } }
    )
    return (
        <Collection.Root collection={collection} label="Órdenes de compra">
            <Collection.View
                table={subscriptionOrderViews.table}
                emptyTitle="Sin órdenes"
                emptyDescription="No se encontraron órdenes de compra para esta suscripción."
            />
        </Collection.Root>
    )
}

function NoteTable({ notes }: { notes: NoteHistoryEntry[] }) {
    const collection = useEntityCollection(
        subscriptionNoteEntity,
        { rows: notes as SubscriptionNoteEntry[] },
        { pagination: { mode: "none" } }
    )
    return (
        <Collection.Root collection={collection} label="Notas de crédito / débito">
            <Collection.View
                table={subscriptionNoteViews.table}
                emptyTitle="Sin notas"
                emptyDescription="No se encontraron notas asociadas a este producto."
            />
        </Collection.Root>
    )
}
