"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { Plus, Edit, Trash2, Loader2, Users } from "lucide-react"
import { GroupForm } from "@/components/forms/GroupForm"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"

interface GroupManagementProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
}

export function GroupManagement({ externalOpen, onExternalOpenChange }: GroupManagementProps) {
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
        {
            id: "actions",
            header: () => <div className="text-right">Acciones</div>,
            cell: ({ row }) => (
                <div className="flex justify-end gap-2">
                    <GroupForm
                        initialData={row.original}
                        onSuccess={fetchGroups}
                        trigger={
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Edit className="h-4 w-4" />
                            </Button>
                        }
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(row.original.id)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ]

    return (
        <div className="space-y-4">
            {loading ? (
                <div className="flex h-[200px] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <DataTable
                    columns={columns}
                    data={groups}
                    cardMode
                    filterColumn="name"
                    searchPlaceholder="Buscar grupo..."
                    useAdvancedFilter={true}
                />
            )}

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
