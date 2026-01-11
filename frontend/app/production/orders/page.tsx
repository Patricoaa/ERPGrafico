"use client"

import { useEffect, useState } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import api from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Pencil, Trash2, Printer, Settings, LayoutGrid, List } from "lucide-react"
import { WorkOrderForm } from "@/components/forms/WorkOrderForm"
import { WorkOrderWizard } from "@/components/production/WorkOrderWizard"
import { WorkOrderKanban } from "@/components/production/WorkOrderKanban"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"

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
    const [viewMode, setViewMode] = useState<string>("kanban")

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
        if (!confirm("¿Está seguro de que desea eliminar esta OT?")) return
        try {
            await api.delete(`/production/orders/${id}/`)
            toast.success("OT eliminada correctamente.")
            fetchOrders()
        } catch (error) {
            console.error("Error deleting order:", error)
            toast.error("Error al eliminar la OT.")
        }
    }

    const handleKanbanTransition = async (orderId: number, nextStage: string) => {
        try {
            await api.post(`/production/orders/${orderId}/transition/`, {
                next_stage: nextStage
            })
            fetchOrders()
            toast.success("OT movida de etapa")
        } catch (error: any) {
            toast.error(error.response?.data?.error || "No se pudo cambiar la etapa")
        }
    }

    useEffect(() => {
        fetchOrders()
    }, [])

    const handlePrint = async (order: WorkOrder) => {
        try {
            const response = await api.get(`/production/orders/${order.id}/print_pdf/`, {
                responseType: 'blob'
            })
            const url = window.URL.createObjectURL(new Blob([response.data]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `OT-${order.number}.pdf`)
            document.body.appendChild(link)
            link.click()
            link.remove()
        } catch (error) {
            toast.error("Error al generar el PDF")
        }
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0 border-b pb-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Ordenes de Trabajo (OT)</h2>
                    <p className="text-muted-foreground mt-1">Gestión de flujo de producción para industria gráfica.</p>
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
                            onOpenChange={(open) => !open && setActiveWizardId(null)}
                            onSuccess={fetchOrders}
                        />
                    )}
                </div>
            </div>

            <div className="mt-4">
                {viewMode === "kanban" ? (
                    <div className="bg-muted/30 rounded-xl p-4 min-h-[600px] border relative">
                        {loading ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10 rounded-xl">
                                <p className="text-muted-foreground animate-pulse font-medium">Actualizando tablero...</p>
                            </div>
                        ) : null}
                        <WorkOrderKanban
                            orders={orders}
                            onTransition={handleKanbanTransition}
                            onManage={(id) => setActiveWizardId(id)}
                        />
                    </div>
                ) : (
                    <div className="rounded-md border bg-white">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Número</TableHead>
                                    <TableHead>Fecha Inicio</TableHead>
                                    <TableHead>Descripción</TableHead>
                                    <TableHead>Estado / Etapa</TableHead>
                                    <TableHead>Fecha Entrega</TableHead>
                                    <TableHead className="w-[150px] text-center">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orders.map((order) => (
                                    <TableRow key={order.id}>
                                        <TableCell className="font-medium">OT-{order.number}</TableCell>
                                        <TableCell>{order.start_date || '-'}</TableCell>
                                        <TableCell>{order.description}</TableCell>
                                        <TableCell className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Badge variant={statusMap[order.status]?.variant || ("default" as any)}>
                                                    {statusMap[order.status]?.label || order.status}
                                                </Badge>
                                                <Badge variant="outline" className="text-[10px] uppercase">
                                                    {order.current_stage?.replace('_', ' ')}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell>{order.due_date || '-'}</TableCell>
                                        <TableCell>
                                            <div className="flex justify-center space-x-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-primary"
                                                    onClick={() => setActiveWizardId(order.id)}
                                                    title="Gestionar Workflow"
                                                >
                                                    <Settings className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => handlePrint(order)}
                                                    title="Imprimir"
                                                >
                                                    <Printer className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => {
                                                        setEditingOrder(order)
                                                        setIsFormOpen(true)
                                                    }}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                    onClick={() => handleDelete(order.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {loading && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center">Cargando OTs...</TableCell>
                                    </TableRow>
                                )}
                                {!loading && orders.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center">No hay OTs registradas.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
        </div>
    )
}
