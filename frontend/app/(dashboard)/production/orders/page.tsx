"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import * as React from "react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { createActionsColumn, DataCell } from "@/components/ui/data-table-cells"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import api from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Pencil, Trash2, Ban, Settings, LayoutGrid, List, Columns, X, Factory } from "lucide-react"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { WorkOrderForm } from "@/features/production/components/forms/WorkOrderForm"
import { WorkOrderWizard } from "@/features/production/components/WorkOrderWizard"
import { WorkOrderKanban } from "@/features/production/components/WorkOrderKanban"
import { TabsContent } from "@/components/ui/tabs"
import { toast } from "sonner"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"
import { PageHeader } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { Input } from "@/components/ui/input"
import { isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns"
import { translateProductionStage } from "@/lib/utils"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"

interface WorkOrder {
    id: number
    number: string
    description: string
    status: string
    current_stage: string
    start_date: string
    due_date: string
    sale_customer_name?: string
    materials?: Record<string, unknown>[]
}

const statusOptions = [
    { label: "Borrador", value: "DRAFT" },
    { label: "Planificada", value: "PLANNED" },
    { label: "En Proceso", value: "IN_PROGRESS" },
    { label: "Terminada", value: "FINISHED" },
    { label: "Anulada", value: "CANCELLED" },
]

const statusMap: Record<string, { label: string, variant: "default" | "secondary" | "outline" | "destructive" }> = {
    'DRAFT': { label: 'Borrador', variant: 'secondary' },
    'PLANNED': { label: 'Planificada', variant: 'default' },
    'IN_PROGRESS': { label: 'En Proceso', variant: 'outline' },
    'FINISHED': { label: 'Terminada', variant: 'outline' },
    'CANCELLED': { label: 'Anulada', variant: 'destructive' },
}

interface WorkOrdersPageProps {
    createAction?: React.ReactNode
}

export default function WorkOrdersPage({ createAction }: WorkOrdersPageProps = {}) {
    const [orders, setOrders] = useState<WorkOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [activeWizardId, setActiveWizardId] = useState<number | null>(null)
    const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>()
    const [viewMode, setViewMode] = useState<string>("kanban")
    const searchParams = useSearchParams()
    const router = useRouter()
    const isNewModalOpen = searchParams.get("modal") === "new"
    const [requestedStage, setRequestedStage] = useState<string | undefined>()

    // Modal state sync with URL
    useEffect(() => {
        if (isNewModalOpen) {
            setIsFormOpen(true)
            setEditingOrder(null)
        }
    }, [isNewModalOpen])

    const handleFormClose = (open: boolean) => {
        setIsFormOpen(open)
        if (!open) {
            setEditingOrder(null)
            if (isNewModalOpen) {
                const params = new URLSearchParams(searchParams.toString())
                params.delete("modal")
                router.push(`?${params.toString()}`, { scroll: false })
            }
        }
    }

    const filteredOrders = orders.filter(order => {
        // Date range filter
        if (!dateRange || !dateRange.from) return true
        if (!order.due_date) return false

        const orderDate = parseISO(order.due_date)
        const start = startOfDay(dateRange.from)
        const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from)

        return isWithinInterval(orderDate, { start, end })
    })

    const fetchOrders = async () => {
        setLoading(true)
        try {
            const response = await api.get('/production/orders/')
            setOrders(response.data.results || response.data)
        } catch (error) {
            console.error("Failed to fetch works orders", error)
            toast.error("Error al cargar las OTs.")
        } finally {
            setLoading(false)
        }
    }

    const deleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            await api.delete(`/production/orders/${id}/`)
            toast.success("OT eliminada correctamente.")
            fetchOrders()
        } catch (error) {
            console.error("Error deleting order:", error)
            toast.error("Error al eliminar la OT.")
        }
    })

    const handleDelete = (id: number) => deleteConfirm.requestConfirm(id)

    const cancelConfirm = useConfirmAction<number>(async (id) => {
        try {
            await api.post(`/production/orders/${id}/transition/`, {
                next_stage: 'CANCELLED'
            })
            toast.success("OT anulada correctamente.")
            fetchOrders()
        } catch (error) {
            console.error("Error canceling order:", error)
            toast.error("Error al anular la OT.")
        }
    })

    const handleCancel = (id: number) => cancelConfirm.requestConfirm(id)

    const handleKanbanTransition = async (orderId: number, nextStage: string) => {
        // Instead of auto-transitioning, open the wizard to validate/confirm details
        setActiveWizardId(orderId)
        setRequestedStage(nextStage)
    }

    useEffect(() => {
        fetchOrders()
    }, [])

    const columns = useMemo<ColumnDef<WorkOrder>[]>(() => [
        {
            accessorKey: "number",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Folio" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <DataCell.DocumentId type="PRODUCTION_ORDER" number={row.getValue("number")} />
                </div>
            ),
        },
        {
            accessorKey: "start_date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha Inicio" className="justify-center" />
            ),
            cell: ({ row }) => <div className="flex justify-center"><DataCell.Date value={row.getValue("start_date")} /></div>,
        },
        {
            accessorKey: "description",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Descripción" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Text className="text-center">{row.getValue("description")}</DataCell.Text>
                </div>
            ),
        },
        {
            accessorKey: "status",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estado" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <StatusBadge status={row.original.status} />
                </div>
            ),
            filterFn: (row, id, value) => {
                return value.includes(row.getValue(id))
            },
        },
        {
            accessorKey: "current_stage",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Etapa" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <DataCell.Badge 
                        variant="outline" 
                        className="text-[9px] uppercase tracking-tighter"
                    >
                        {translateProductionStage(row.original.current_stage)}
                    </DataCell.Badge>
                </div>
            ),
        },
        {
            accessorKey: "due_date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha Entrega" className="justify-center" />
            ),
            cell: ({ row }) => <div className="flex justify-center"><DataCell.Date value={row.getValue("due_date")} /></div>,
        },
        createActionsColumn<WorkOrder>({
            renderActions: (order) => (
                <>
                    <DataCell.Action
                        icon={Settings}
                        title="Gestionar Workflow"
                        onClick={() => setActiveWizardId(order.id)}
                    />
                    {['MATERIAL_ASSIGNMENT', 'MATERIAL_APPROVAL', 'PREPRESS'].includes(order.current_stage) && (
                        <DataCell.Action
                            icon={Pencil}
                            title="Editar"
                            onClick={() => {
                                setEditingOrder(order)
                                setIsFormOpen(true)
                            }}
                        />
                    )}

                    {['MATERIAL_ASSIGNMENT', 'MATERIAL_APPROVAL', 'PREPRESS'].includes(order.current_stage) && (
                        <DataCell.Action
                            icon={Trash2}
                            title="Eliminar"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(order.id)}
                        />
                    )}

                    {!['DRAFT', 'FINISHED', 'CANCELLED'].includes(order.status) && (
                        <DataCell.Action
                            icon={Ban}
                            title="Anular"
                            className="text-warning hover:text-warning"
                            onClick={() => handleCancel(order.id)}
                        />
                    )}
                </>
            )
        }),
    ], [])

    const renderKanbanView = useCallback((table: import("@tanstack/react-table").Table<WorkOrder>) => (
        <div className="relative">
            <div className="min-h-[600px]">
                <WorkOrderKanban
                    orders={table.getFilteredRowModel().rows.map((row: import("@tanstack/react-table").Row<WorkOrder>) => row.original)}
                    onTransition={handleKanbanTransition}
                    onManage={(id) => setActiveWizardId(id)}
                    isLoading={loading}
                />
            </div>
        </div>
    ), [loading, handleKanbanTransition])

    return (
        <div className="space-y-4">

            {/* Hidden Forms */}
            {editingOrder || isFormOpen ? (
                <WorkOrderForm
                    initialData={editingOrder}
                    open={isFormOpen}
                    onOpenChange={handleFormClose}
                    onSuccess={fetchOrders}
                />
            ) : null}
            {activeWizardId && (
                <WorkOrderWizard
                    orderId={activeWizardId}
                    open={!!activeWizardId}
                    onOpenChange={(open) => {
                        if (!open) {
                            setActiveWizardId(null)
                            setRequestedStage(undefined)
                        }
                    }}
                    onSuccess={fetchOrders}
                    targetStage={requestedStage}
                />
            )}

            <div className="mt-2">
                <DataTable
                    columns={columns}
                    data={orders}
                    isLoading={loading}
                    cardMode={viewMode === "list" || viewMode === "grid"}
                    filterColumn="description"
                    defaultPageSize={50}
                    globalFilterFields={["number", "description", "sale_customer_name"]}
                    searchPlaceholder="Buscar por folio, descripción o cliente..."
                    viewOptions={[
                        { label: "Lista", value: "list", icon: List },
                        { label: "Grilla", value: "grid", icon: LayoutGrid },
                        { label: "Tablero", value: "kanban", icon: Columns },
                    ]}
                    currentView={viewMode}
                    onViewChange={setViewMode}
                    facetedFilters={[
                        {
                            column: "status",
                            title: "Estado",
                            options: statusOptions
                        }
                    ]}
                    useAdvancedFilter={true}
                    isCustomFiltered={!!dateRange}
                    customFilterCount={dateRange ? 1 : 0}
                    customFilters={
                        <DateRangeFilter 
                            onRangeChange={setDateRange} 
                            label="Fecha de Entrega" 
                            className="bg-transparent border-none w-full"
                        />
                    }
                    onReset={() => setDateRange(undefined)}
                    renderCustomView={viewMode === "kanban" ? renderKanbanView : undefined}
                    createAction={createAction}
                />
            </div>

            <ActionConfirmModal
                open={deleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) deleteConfirm.cancel() }}
                onConfirm={deleteConfirm.confirm}
                title="Eliminar OT"
                description="¿Está seguro de que desea eliminar esta OT? Esta acción es irreversible."
                variant="destructive"
            />

            <ActionConfirmModal
                open={cancelConfirm.isOpen}
                onOpenChange={(open) => { if (!open) cancelConfirm.cancel() }}
                onConfirm={cancelConfirm.confirm}
                title="Anular OT"
                description="¿Está seguro de que desea ANULAR esta OT? Esto detendrá el proceso y liberará reservas."
                variant="destructive"
            />
        </div >
    )
}
