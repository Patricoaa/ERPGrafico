"use client"

import { useState } from "react"
import { ShoppingCart, Ban, RefreshCw, Layers, Pencil, MousePointerClick } from "lucide-react"
import { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { EditProposalDialog } from "./EditProposalDialog"

import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import api from "@/lib/api"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface ReplenishmentProposal {
    id: number
    product: number
    product_name: string
    product_code: string
    warehouse: number
    warehouse_name: string
    qty_to_order: string
    status: string
    status_display: string
    supplier: number | null
    supplier_name: string | null
    created_at: string
    uom_name: string
}

interface ProposalsListProps {
    data: ReplenishmentProposal[]
    onRefresh: () => void
    toolbarAction?: React.ReactNode
    rightAction?: React.ReactNode
}

export function ProposalsList({ data, onRefresh, toolbarAction, rightAction }: ProposalsListProps) {
    const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({})
    const [isProcessing, setIsProcessing] = useState(false)
    const [editingProposal, setEditingProposal] = useState<ReplenishmentProposal | null>(null)

    const selectedIds = Object.keys(selectedRows).filter(id => selectedRows[id]).map(Number)

    const handleCreatePO = async (proposalId?: number) => {
        const ids = proposalId ? [proposalId] : selectedIds
        if (ids.length === 0) return

        setIsProcessing(true)
        try {
            const response = await api.post('/inventory/replenishment-proposals/create_po/', {
                proposal_ids: ids
            })
            const count = Array.isArray(response.data) ? response.data.length : 1
            toast.success(`${count} Órdenes de Compra creadas con éxito`)
            onRefresh()
            setSelectedRows({})
        } catch (error: any) {
            console.error(error)
            toast.error(error.response?.data?.error || "Error al crear Órdenes de Compra")
        } finally {
            setIsProcessing(false)
        }
    }

    const handleIgnore = async (proposalId?: number) => {
        const ids = proposalId ? [proposalId] : selectedIds
        if (ids.length === 0) return

        setIsProcessing(true)
        try {
            await api.post('/inventory/replenishment-proposals/ignore/', {
                proposal_ids: ids
            })
            toast.success("Propuestas ignoradas")
            onRefresh()
            setSelectedRows({})
        } catch (error) {
            toast.error("Error al ignorar propuestas")
        } finally {
            setIsProcessing(false)
        }
    }

    const columns: ColumnDef<ReplenishmentProposal>[] = [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: "product_code",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Producto" />
            ),
            cell: ({ row }) => (
                <div>
                    <div className="font-medium">{row.original.product_code}</div>
                    <div className="text-xs text-muted-foreground">{row.original.product_name}</div>
                </div>
            ),
        },
        {
            accessorKey: "warehouse_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Almacén" />
            ),
        },
        {
            accessorKey: "supplier_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Proveedor Sugerido" />
            ),
            cell: ({ row }) => (
                <div className="text-sm">
                    {row.original.supplier_name || <span className="text-amber-500 font-medium">No asignado</span>}
                </div>
            ),
        },
        {
            accessorKey: "qty_to_order",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Cant. a Pedir" className="justify-end" />
            ),
            cell: ({ row }) => (
                <div className="text-right font-bold text-blue-600">
                    {Number(row.getValue("qty_to_order")).toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">{row.original.uom_name || ''}</span>
                </div>
            ),
        },
        {
            accessorKey: "created_at",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" />
            ),
            cell: ({ row }) => (
                <div className="text-xs text-muted-foreground">
                    {format(new Date(row.original.created_at), "dd MMM yyyy", { locale: es })}
                </div>
            ),
        },
        {
            accessorKey: "status",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estado" />
            ),
            cell: ({ row }) => {
                const status = row.original.status
                return (
                    <Badge variant={status === 'PENDING' ? 'default' : 'outline'} className={
                        status === 'PENDING' ? 'bg-amber-100 text-amber-700 hover:bg-amber-100' : ''
                    }>
                        {row.original.status_display}
                    </Badge>
                )
            },
        },
        {
            id: "actions",
            header: () => <div className="text-right">Acciones</div>,
            cell: ({ row }) => (
                <div className="flex justify-end gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:text-blue-600"
                        title="Editar Propuesta"
                        onClick={() => setEditingProposal(row.original)}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:text-destructive"
                        title="Ignorar"
                        onClick={() => handleIgnore(row.original.id)}
                    >
                        <Ban className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:text-emerald-600"
                        title="Generar OC"
                        onClick={() => handleCreatePO(row.original.id)}
                    >
                        <ShoppingCart className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ]

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between bg-muted/30 p-4 rounded-lg border border-dashed">
                <div className="flex items-center gap-2">
                    <Layers className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm font-medium">
                        {selectedIds.length} propuestas seleccionadas
                    </span>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleIgnore()}
                        disabled={selectedIds.length === 0 || isProcessing}
                        className="text-muted-foreground"
                    >
                        <Ban className="mr-2 h-4 w-4" />
                        Ignorar
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => handleCreatePO()}
                        disabled={selectedIds.length === 0 || isProcessing}
                    >
                        {isProcessing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
                        Generar Órdenes de Compra
                    </Button>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={data.filter(p => p.status === 'PENDING')}
                filterColumn="product_code"
                searchPlaceholder="Filtrar por producto..."
                useAdvancedFilter={true}
                toolbarAction={toolbarAction}
                rightAction={rightAction}
                onRowSelectionChange={(selection: Record<string, boolean>) => {
                    // selection is an object { index: boolean }
                    // We need to map it to IDs
                    const newSelection: Record<string, boolean> = {}
                    Object.keys(selection).forEach(index => {
                        const proposal = data[Number(index)]
                        if (proposal) {
                            newSelection[proposal.id.toString()] = selection[index]
                        }
                    })
                    setSelectedRows(newSelection)
                }}
            />

            <EditProposalDialog
                open={!!editingProposal}
                onOpenChange={(open) => !open && setEditingProposal(null)}
                proposal={editingProposal}
                onSuccess={onRefresh}
            />
        </div>
    )
}
