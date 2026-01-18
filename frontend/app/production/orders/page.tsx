"use client"

import { useEffect, useState } from "react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import api from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Pencil, Trash2, Ban, Settings, LayoutGrid, List, X } from "lucide-react"
import { WorkOrderForm } from "@/components/forms/WorkOrderForm"
import { WorkOrderWizard } from "@/components/production/WorkOrderWizard"
import { WorkOrderKanban } from "@/components/production/WorkOrderKanban"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"
import { FacetedFilter } from "@/components/shared/FacetedFilter"
import { Input } from "@/components/ui/input"
import { isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns"

interface WorkOrder {
    id: number
    number: string
    description: string
    status: string
    current_stage: string
    start_date: string
    due_date: string
    sale_customer_name?: string
    materials?: any[]
}

const statusMap: Record<string, { label: string, variant: "default" | "secondary" | "outline" | "destructive" }> = {
    'DRAFT': { label: 'Borrador', variant: 'secondary' },
    'PLANNED': { label: 'Planificada', variant: 'default' },
    'IN_PROGRESS': { label: 'En Proceso', variant: 'outline' },
    'FINISHED': { label: 'Terminada', variant: 'outline' },
    'CANCELLED': { label: 'Anulada', variant: 'destructive' },
}

export default function WorkOrdersPage() {
    const [orders, setOrders] = useState<WorkOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [editingOrder, setEditingOrder] = useState<any | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [activeWizardId, setActiveWizardId] = useState<number | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilters, setStatusFilters] = useState<string[]>([])
    const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>()

    const filteredOrders = orders.filter(order => {
        // Search filter
        const matchesSearch = searchTerm === "" ||
            order.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (order.sale_customer_name?.toLowerCase() || "").includes(searchTerm.toLowerCase())

        if (!matchesSearch) return false

        // Status filter
        const matchesStatus = statusFilters.length === 0 || statusFilters.includes(order.status)
        if (!matchesStatus) return false

        // Date range filter
        if (!dateRange || !dateRange.from) return true
        if (!order.due_date) return false // Cannot filter if no due date

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

    const handleDelete = async (id: number) => {
        if (!confirm("¿Está seguro de que desea eliminar esta OT? Esta acción es irreversible.")) return
        try {
            await api.delete(`/production/orders/${id}/`)
            toast.success("OT eliminada correctamente.")
            fetchOrders()
        } catch (error) {
            console.error("Error deleting order:", error)
            toast.error("Error al eliminar la OT.")
        }
    }

    const handleCancel = async (id: number) => {
        if (!confirm("¿Está seguro de que desea ANULAR esta OT? Esto detendrá el proceso y liberará reservas.")) return
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
    }

    const handleKanbanTransition = async (orderId: number, nextStage: string) => {
        // Instead of auto-transitioning, open the wizard to validate/confirm details
        setActiveWizardId(orderId)
        setRequestedStage(nextStage)
    }

    useEffect(() => {
        fetchOrders()
    }, [])

    const columns: ColumnDef<WorkOrder>[] = [
        {
            accessorKey: "number",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Número" />
            ),
            cell: ({ row }) => <div className="font-medium">OT-{row.getValue("number")}</div>,
        },
        {
            accessorKey: "start_date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha Inicio" />
            ),
            cell: ({ row }) => <div>{row.getValue("start_date") || '-'}</div>,
        },
        {
            accessorKey: "description",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Descripción" />
            ),
        },
        {
            accessorKey: "status",
            header: "Estado",
            // We can keep it or hide it, but we need it for faceted filter to work easily
            // Actually, if we use it in facetedFilters, DataTable needs this column.
            cell: ({ row }) => null,
            enableHiding: true,
        },
        {
            id: "status_stage",
            header: "Estado / Etapa",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <Badge variant={statusMap[row.original.status as string]?.variant || ("default" as any)}>
                        {statusMap[row.original.status as string]?.label || row.original.status}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] uppercase">
                        {row.original.current_stage?.replace('_', ' ')}
                    </Badge>
                </div>
            ),
        },
        {
            accessorKey: "due_date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha Entrega" />
            ),
            cell: ({ row }) => <div>{row.getValue("due_date") || '-'}</div>,
        },
        {
            id: "actions",
            header: () => <div className="text-center">Acciones</div>,
            cell: ({ row }) => (
                <div className="flex justify-center space-x-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary"
                        onClick={() => setActiveWizardId(row.original.id)}
                        title="Gestionar Workflow"
                    >
                        <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                            setEditingOrder(row.original)
                            setIsFormOpen(true)
                        }}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>

                    {row.original.status === 'DRAFT' && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(row.original.id)}
                            title="Eliminar"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}

                    {!['DRAFT', 'FINISHED', 'CANCELLED'].includes(row.original.status) && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-orange-500 hover:text-orange-600"
                            onClick={() => handleCancel(row.original.id)}
                            title="Anular"
                        >
                            <Ban className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            ),
        },
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Ordenes de Trabajo (OT)</h2>
                    <p className="text-muted-foreground mt-1">Gestión de flujo de producción</p>
                </div>

                <div className="flex items-center space-x-4">
                    <Tabs value={viewMode} onValueChange={setViewMode} className="w-auto">
                        <TabsList>
                            <TabsTrigger value="kanban" className="flex items-center gap-2">
                                <LayoutGrid className="h-4 w-4" />
                                <span className="hidden sm:inline">Tablero</span>
                            </TabsTrigger>
                            <TabsTrigger value="list" className="flex items-center gap-2">
                                <List className="h-4 w-4" />
                                <span className="hidden sm:inline">Lista</span>
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="h-8 w-[1px] bg-border hidden sm:block"></div>

                    <WorkOrderForm
                        onSuccess={fetchOrders}
                        open={isFormOpen && !editingOrder}
                        onOpenChange={(open) => {
                            setIsFormOpen(open)
                            if (!open) setEditingOrder(null)
                        }}
                    />
                    {editingOrder && (
                        <WorkOrderForm
                            initialData={editingOrder}
                            open={isFormOpen && !!editingOrder}
                            onOpenChange={(open) => {
                                setIsFormOpen(open)
                                if (!open) setEditingOrder(null)
                            }}
                            onSuccess={fetchOrders}
                        />
                    )}
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
                </div>
            </div>

            <div className="mt-2 space-y-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-1 items-center space-x-2">
                        <Input
                            placeholder="Buscar por número, descripción o cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-9 w-[250px] lg:w-[350px] rounded-xl bg-background/50"
                        />
                        <FacetedFilter
                            title="Estado"
                            options={[
                                { label: "Borrador", value: "DRAFT" },
                                { label: "Planificada", value: "PLANNED" },
                                { label: "En Proceso", value: "IN_PROGRESS" },
                                { label: "Terminada", value: "FINISHED" },
                                { label: "Anulada", value: "CANCELLED" },
                            ]}
                            selectedValues={statusFilters}
                            onSelect={setStatusFilters}
                        />
                        <DateRangeFilter onRangeChange={setDateRange} label="Fecha de Entrega" />

                        {(searchTerm || statusFilters.length > 0 || dateRange) && (
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setSearchTerm("")
                                    setStatusFilters([])
                                    setDateRange(undefined)
                                }}
                                className="h-9 px-2 lg:px-3 rounded-xl"
                            >
                                Resetear
                                <X className="ml-2 h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>

                {viewMode === "kanban" ? (
                    <div className="bg-muted/30 rounded-xl p-4 min-h-[600px] border relative">
                        {loading ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10 rounded-xl">
                                <p className="text-muted-foreground animate-pulse font-medium">Actualizando tablero...</p>
                            </div>
                        ) : null}
                        <WorkOrderKanban
                            orders={filteredOrders}
                            onTransition={handleKanbanTransition}
                            onManage={(id) => setActiveWizardId(id)}
                        />
                    </div>
                ) : (
                    <div className="">
                        <DataTable
                            columns={columns}
                            data={filteredOrders}
                            defaultPageSize={20}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}
