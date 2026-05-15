"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { createActionsColumn, DataCell } from "@/components/ui/data-table-cells"
import { ColumnDef } from "@tanstack/react-table"
import { Pencil, Trash2, Ban, Settings, List, Columns, Copy } from "lucide-react"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { WorkOrderForm } from "@/features/production/components/forms/WorkOrderForm"
import { WorkOrderWizard } from "@/features/production/components/WorkOrderWizard"
import { WorkOrderKanban } from "@/features/production/components/WorkOrderKanban"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { isWorkOrderOverdue } from "@/features/production/utils"

import { ToolbarCreateButton, SmartSearchBar, useSmartSearch } from "@/components/shared"
import { translateProductionStage } from "@/lib/utils"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { usePathname } from "next/navigation"
import { useWorkOrders } from "@/features/production/hooks/useWorkOrders"
import { useWorkOrderListActions } from "@/features/production/hooks"
import { workOrderSearchDef } from "@/features/production/searchDef"

import type { WorkOrder } from "@/features/production/types"

export default function WorkOrdersPage() {
    const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [activeWizardId, setActiveWizardId] = useState<number | null>(null)
    const [viewMode, setViewMode] = useState<string>("list")
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const [myTasks, setMyTasks] = useState(searchParams.get('my_tasks') === 'true')

    const handleMyTasksChange = (checked: boolean) => {
        setMyTasks(checked)
        const params = new URLSearchParams(searchParams.toString())
        if (checked) {
            params.set('my_tasks', 'true')
        } else {
            params.delete('my_tasks')
        }
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const { filters } = useSmartSearch(workOrderSearchDef)
    const { orders, isLoading: loading, refetch: refetchOrders } = useWorkOrders({
        ...(filters as any),
        my_tasks: myTasks
    })
    const { deleteOrder, annulOrder, duplicateOrder } = useWorkOrderListActions({ onSuccess: refetchOrders })

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<WorkOrder>({
        endpoint: '/production/orders'
    })

    useEffect(() => {
        if (selectedFromUrl) {
            setActiveWizardId(selectedFromUrl.id)
        }
    }, [selectedFromUrl])

    const isNewModalOpen = searchParams.get("modal") === "new"
    const [requestedStage, setRequestedStage] = useState<string | undefined>()

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

    const deleteConfirm = useConfirmAction<number>(async (id) => {
        await deleteOrder({ id })
    })

    const handleDelete = (id: number) => deleteConfirm.requestConfirm(id)

    const cancelConfirm = useConfirmAction<number>(async (id) => {
        await annulOrder({ id })
    })

    const handleCancel = (id: number) => cancelConfirm.requestConfirm(id)

    const duplicateConfirm = useConfirmAction<number>(async (id) => {
        await duplicateOrder({ id })
    })

    const handleDuplicate = (id: number) => duplicateConfirm.requestConfirm(id)

    const handleKanbanTransition = async (orderId: number, nextStage: string) => {
        setActiveWizardId(orderId)
        setRequestedStage(nextStage)
    }

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
                <div className="flex justify-center gap-1.5 items-center flex-wrap">
                    <StatusBadge status={row.original.status} />
                    {isWorkOrderOverdue(row.original) && (
                        <Badge variant="destructive" className="h-5 text-[9px] px-1.5 uppercase tracking-wider font-bold">
                            Atrasada
                        </Badge>
                    )}
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
                        onClick={() => {
                            const params = new URLSearchParams(searchParams.toString())
                            params.set('selected', String(order.id))
                            router.push(`${pathname}?${params.toString()}`, { scroll: false })
                        }}
                    />
                    <DataCell.Action
                        icon={Copy}
                        title="Duplicar OT"
                        onClick={() => handleDuplicate(order.id)}
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
                    initialData={editingOrder as any}
                    open={isFormOpen}
                    onOpenChange={handleFormClose}
                    onSuccess={refetchOrders}
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
                            clearSelection()
                        }
                    }}
                    onSuccess={refetchOrders}
                    targetStage={requestedStage}
                />
            )}

            <div className="mt-2">
                <DataTable
                    columns={columns}
                    data={orders}
                    isLoading={loading}
                    variant="embedded"
                    defaultPageSize={50}
                    leftAction={
                        <div className="flex items-center gap-6">
                            <SmartSearchBar searchDef={workOrderSearchDef} placeholder="Buscar OTs..." className="w-[300px]" />
                            <div className="flex items-center gap-2 whitespace-nowrap bg-background p-1.5 px-3 rounded-md border border-border shadow-sm">
                                <Switch id="my-tasks-mode" checked={myTasks} onCheckedChange={handleMyTasksChange} />
                                <Label htmlFor="my-tasks-mode" className="text-sm cursor-pointer font-medium">Solo mis OTs</Label>
                            </div>
                        </div>
                    }
                    viewOptions={[
                        { label: "Lista", value: "list", icon: List },
                        { label: "Tablero", value: "kanban", icon: Columns },
                    ]}
                    currentView={viewMode}
                    onViewChange={setViewMode}
                    renderCustomView={viewMode === "kanban" ? renderKanbanView : undefined}
                    createAction={<ToolbarCreateButton label="Nueva OT" href="/production/orders?modal=new" />}
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

            <ActionConfirmModal
                open={duplicateConfirm.isOpen}
                onOpenChange={(open) => { if (!open) duplicateConfirm.cancel() }}
                onConfirm={duplicateConfirm.confirm}
                title="Duplicar OT"
                description="Se creará una nueva OT en Borrador con los mismos materiales y configuración. No se vinculará a la Nota de Venta original."
                variant="default"
            />
        </div >
    )
}
