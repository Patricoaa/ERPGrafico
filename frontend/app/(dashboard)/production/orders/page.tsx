"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { DataTable } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { createActionsColumn, DataCell } from '@/components/shared'
import { ColumnDef } from "@tanstack/react-table"
import { List, Columns, CalendarDays, Printer, User } from "lucide-react"
import {
    WorkOrderWizard,
    WorkOrderKanban,
    WorkOrderTimelineView,
    useWorkOrders,
    useWorkOrderListActions,
} from "@/features/production"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { BulkActionDock, Chip, FadeIn } from "@/components/shared"
import { isWorkOrderOverdue } from "@/features/production/utils"
import { ToolbarCreateButton, SmartSearchBar, useSmartSearch } from "@/components/shared"
import { cn, translateProductionStage } from "@/lib/utils"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { usePathname } from "next/navigation"
import { workOrderSearchDef } from "@/features/production/searchDef"

import type { WorkOrder, WizardMode, StageId } from "@/features/production/types"

function WorkOrdersClient() {
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
    const { deleteOrder, annulOrder, duplicateOrder, bulkPrint, isBulkPrinting } = useWorkOrderListActions({ onSuccess: refetchOrders })

    const isNew = searchParams.get('new') === 'true' || searchParams.get('modal') === 'new'
    const selectedId = searchParams.get('selected')
    const requestedType = searchParams.get('type')
    const requestedProductId = searchParams.get('product_id') || undefined
    const requestedStage = searchParams.get('step') || undefined

    const wizardMode = useMemo((): WizardMode | null => {
        if (isNew) {
            return {
                kind: 'create',
                defaultOtType: requestedType === 'stock' ? 'NONE' : requestedType === 'sale' ? 'LINKED' : undefined,
                defaultProductId: requestedProductId ? String(requestedProductId) : undefined,
            }
        }
        if (selectedId) {
            return {
                kind: 'manage',
                orderId: Number(selectedId),
                targetStage: requestedStage as StageId | undefined,
            }
        }
        return null
    }, [isNew, selectedId, requestedType, requestedProductId, requestedStage])

    const handleManage = useCallback((id: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('selected', String(id))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, [router, pathname, searchParams])

    const closeWizard = useCallback(() => {
        const params = new URLSearchParams(searchParams.toString())
            ;['new', 'modal', 'selected', 'type', 'product_id', 'step'].forEach(p => params.delete(p))
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }, [router, pathname, searchParams])


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



    const columns = useMemo<ColumnDef<WorkOrder>[]>(() => [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                    className="translate-y-[2px]"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                    className="translate-y-[2px]"
                />
            ),
            enableSorting: false,
            enableHiding: false,
            size: 40,
            minSize: 40,
        },
        {
            accessorKey: "number",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Folio" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <DataCell.Entity
                        entityLabel="production.workorder"
                        number={row.getValue("number")}
                    />
                </div>
            ),
            meta: { title: "Folio" },
        },
        {
            id: "sale_order_number",
            accessorFn: (row) => row.sale_order_number ?? null,
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="NV Asociada" className="justify-center" />
            ),
            cell: ({ row }) => {
                const nvNumber = row.original.sale_order_number
                if (!nvNumber) return <div className="flex justify-center"></div>
                return (
                    <div className="flex justify-center">
                        <DataCell.Entity
                            entityLabel="sales.saleorder"
                            number={nvNumber}

                        />
                    </div>
                )
            },
            meta: { title: "NV Asociada" },
        },
        {
            accessorKey: "start_date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha Inicio" className="justify-center" />
            ),
            cell: ({ row }) => <div className="flex justify-center"><DataCell.Date value={row.getValue("start_date")} /></div>,
            meta: { title: "Fecha Inicio" },
        },
        {
            accessorKey: "product_description",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Descripción del Trabajo" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Text className="text-center">{row.getValue("product_description")}</DataCell.Text>
                </div>
            ),
            meta: { title: "Descripción del Trabajo" },
        },
        {
            accessorKey: "status",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estado" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center gap-1.5 items-center flex-wrap">
                    <DataCell.Status status={row.original.status} />
                    {isWorkOrderOverdue(row.original) && (
                        <Chip size="sm" intent="destructive">Atrasada</Chip>
                    )}
                </div>
            ),
            filterFn: (row, id, value) => {
                return value.includes(row.getValue(id))
            },
            meta: { title: "Estado" },
        },
        {
            accessorKey: "current_stage",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Etapa" className="justify-center" />
            ),
            cell: ({ row }) => (
                <DataCell.Text>
                    {translateProductionStage(row.original.current_stage)}
                </DataCell.Text>
            ),
            meta: { title: "Etapa" },
        },
        {
            accessorKey: "due_date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha Entrega" className="justify-center" />
            ),
            cell: ({ row }) => <div className="flex justify-center"><DataCell.Date value={row.getValue("due_date")} /></div>,
            meta: { title: "Fecha Entrega" },
        },
        createActionsColumn<WorkOrder>({
            renderActions: (order) => {
                const isEditable = ['MATERIAL_ASSIGNMENT', 'MATERIAL_APPROVAL', 'PREPRESS'].includes(order.current_stage)
                const canAnnul = !['DRAFT', 'FINISHED', 'CANCELLED'].includes(order.status)
                const overflow = [
                    { action: 'duplicate' as const, onClick: () => handleDuplicate(order.id) },
                    ...(canAnnul ? [{ action: 'annul' as const, onClick: () => handleCancel(order.id) }] : []),
                    ...(isEditable ? [{ action: 'delete' as const, onClick: () => handleDelete(order.id) }] : []),
                ]
                return (
                    <>
                        <DataCell.Action
                            action="edit"
                            onClick={() => {
                                const params = new URLSearchParams(searchParams.toString())
                                params.set('selected', String(order.id))
                                router.push(`${pathname}?${params.toString()}`, { scroll: false })
                            }}
                        />
                        <DataCell.ActionMenu items={overflow} />
                    </>
                )
            }
        }),
    ], [handleDuplicate, handleCancel, handleDelete, searchParams, router, pathname])

    const renderKanbanView = useCallback((table: import("@tanstack/react-table").Table<WorkOrder>) => (
        <div className="relative">
            <div className="min-h-[600px]">
                <WorkOrderKanban
                    orders={table.getFilteredRowModel().rows.map((row: import("@tanstack/react-table").Row<WorkOrder>) => row.original)}
                    onManage={handleManage}
                    onDuplicate={handleDuplicate}
                    onAnnul={handleCancel}
                    onDelete={handleDelete}
                    isLoading={loading}
                />
            </div>
        </div>
    ), [loading, handleManage, handleDuplicate, handleCancel, handleDelete])

    const renderTimelineView = useCallback((table: import("@tanstack/react-table").Table<WorkOrder>) => (
        <WorkOrderTimelineView
            orders={table.getFilteredRowModel().rows.map((row: import("@tanstack/react-table").Row<WorkOrder>) => row.original)}
            onManage={handleManage}
            isLoading={loading}
        />
    ), [loading, handleManage])

    return (
        <div className="space-y-4 h-full flex flex-col">

            {/* Unified WorkOrderWizard */}
            {wizardMode && (
                <WorkOrderWizard
                    mode={wizardMode}
                    open={true}
                    onOpenChange={(open) => {
                        if (!open) closeWizard()
                    }}
                    onSuccess={() => {
                        refetchOrders()
                    }}
                />
            )}


            <div className="mt-2 flex-1 min-h-0">
                <FadeIn key={viewMode} className="h-full">
                    <DataTable
                        columns={columns}
                        data={orders}
                        isLoading={loading}
                        variant="embedded"
                        defaultPageSize={50}
                        leftAction={
                            <SmartSearchBar searchDef={workOrderSearchDef} placeholder="Buscar OTs..." className="w-full" />
                        }
                        rightButtonGroupAction={
                            <Button
                                variant="ghost"
                                className={cn(
                                    "h-full px-3 rounded-none text-[10px] font-black uppercase tracking-widest hover:bg-muted/50 transition-all border-0 ring-0 focus-visible:ring-0",
                                    myTasks && "bg-primary/5 text-primary hover:bg-primary/10"
                                )}
                                onClick={() => handleMyTasksChange(!myTasks)}
                            >
                                <User className={cn("h-3.5 w-3.5 mr-2", myTasks ? "text-primary" : "opacity-50")} />
                                Mis OTs
                            </Button>
                        }
                        viewOptions={[
                            { label: "Lista", value: "list", icon: List },
                            { label: "Tablero", value: "kanban", icon: Columns },
                            { label: "Cronograma", value: "timeline", icon: CalendarDays },
                        ]}
                        currentView={viewMode}
                        onViewChange={setViewMode}
                        renderCustomView={
                            viewMode === "kanban" ? renderKanbanView :
                                viewMode === "timeline" ? renderTimelineView :
                                    undefined
                        }
                        createAction={<ToolbarCreateButton label="Nueva OT" href="/production/orders?modal=new" />}
                        bulkDock={(items, clear) => (
                            <BulkActionDock selectedCount={items.length} onClear={clear}>
                                <div className="flex items-center gap-2">

                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        disabled={isBulkPrinting}
                                        className="h-8 rounded-full px-4 text-xs"
                                        onClick={() => bulkPrint({ ids: items.map(o => o.id) })}
                                    >
                                        <Printer className="h-3.5 w-3.5 mr-1.5" />
                                        {isBulkPrinting ? 'Generando…' : 'Imprimir todas'}
                                    </Button>
                                </div>
                            </BulkActionDock>
                        )}
                    />
                </FadeIn>
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

export default function WorkOrdersPage() {
    return (
        <div className="pt-2 flex-1 min-h-0 flex flex-col">
            <WorkOrdersClient />
        </div>
    )
}

