"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { Plus, Edit, Trash2, Loader2, Users } from "lucide-react"
import { GroupForm } from "@/features/users/components/GroupForm"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"

interface GroupManagementProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function GroupManagement({ externalOpen, onExternalOpenChange, createAction }: GroupManagementProps) {
    const [loading, setLoading] = useState(true)
    const [groups, setGroups] = useState<any[]>([])
    const [deleteId, setDeleteId] = useState<number | null>(null)
    const [showCreateModal, setShowCreateModal] = useState(false)

    const fetchGroups = async () => {
        try {
            const res = await api.get('/core/groups/')
            setGroups(res.data.results || res.data)
        } catch (error) {
            toast.error("Error al cargar grupos")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchGroups()
    }, [])

    useEffect(() => {
        if (externalOpen) {
            setShowCreateModal(true)
        }
    }, [externalOpen])

    const handleDelete = async () => {
        if (!deleteId) return
        try {
            await api.delete(`/core/groups/${deleteId}/`)
            toast.success("Grupo eliminado correctamente")
            fetchGroups()
        } catch (error) {
            toast.error("Error al eliminar grupo")
        } finally {
            setDeleteId(null)
        }
    }

    const columns: ColumnDef<any>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Nombre del Grupo" />
            ),
            cell: ({ row }) => (
                <div className="flex items-center gap-2 font-medium text-xs">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    {row.getValue("name")}
                </div>
            ),
        },
        {
            accessorKey: "user_count",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Miembros" />
            ),
            cell: ({ row }) => <div className="pl-4 text-xs">{row.getValue("user_count")}</div>,
        },
        createActionsColumn<any>({
            renderActions: (group) => (
                <>
                    <GroupForm
                        initialData={group}
                        onSuccess={fetchGroups}
                        trigger={<DataCell.Action icon={Edit} title="Editar" />}
                    />
                    <DataCell.Action 
                        icon={Trash2} 
                        title="Eliminar" 
                        className="text-destructive hover:text-destructive" 
                        onClick={() => setDeleteId(group.id)} 
                    />
                </>
            )
        })
    ]

    return (
        <div className="space-y-4">
            <DataTable
                columns={columns}
                data={groups}
                isLoading={loading}
                variant="embedded"
                filterColumn="name"
                searchPlaceholder="Buscar grupo..."
                useAdvancedFilter={true}
                createAction={createAction}
            />

            <GroupForm
                open={showCreateModal}
                onOpenChange={(open) => {
                    setShowCreateModal(open)
                    if (!open) onExternalOpenChange?.(false)
                }}
                onSuccess={() => {
                    setShowCreateModal(false)
                    onExternalOpenChange?.(false)
                    fetchGroups()
                }}
            />

            <ActionConfirmModal
                open={!!deleteId}
                onOpenChange={(open) => !open && setDeleteId(null)}
                onConfirm={handleDelete}
                title="¿Está seguro?"
                description="Esta acción eliminará el grupo permanentemente. Los usuarios asignados a este grupo dejarán de pertenecer a él, pero no serán eliminados."
                variant="destructive"
                confirmText="Eliminar"
            />
        </div>
    )
}
