"use client"

import { useState, useEffect } from "react"
import { useGroups } from "../hooks"
import { ActionConfirmModal, DataTable } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { ColumnDef } from "@tanstack/react-table"
import { DataCell, createActionsColumn } from '@/components/shared'
import { Users } from "lucide-react"
import { GroupDrawer } from "@/features/users/components/GroupDrawer"

import { SmartSearchBar, useClientSearch } from "@/components/shared"
import { groupSearchDef } from "@/features/settings/searchDef"

interface GroupManagementProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function GroupManagement({ externalOpen, onExternalOpenChange, createAction }: GroupManagementProps) {
    const { groups, loading, fetchGroups, deleteGroup } = useGroups()
    const { filterFn } = useClientSearch<Record<string, unknown>>(groupSearchDef)
    const [deleteId, setDeleteId] = useState<number | null>(null)
    const [showCreateModal, setShowCreateModal] = useState(false)

    useEffect(() => {
        if (externalOpen) {
            requestAnimationFrame(() => {
                setShowCreateModal(true)
            })
        }
    }, [externalOpen])

    const handleDelete = async () => {
        if (!deleteId) return
        const success = await deleteGroup(deleteId)
        if (success) setDeleteId(null)
    }

    const columns: ColumnDef<Record<string, unknown>>[] = [
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
            cell: ({ row }) => <DataCell.Number value={row.getValue("user_count")} />,
        },
        createActionsColumn<Record<string, unknown>>({
            renderActions: (group) => (
                <>
                    <GroupDrawer
                        initialData={group as { id: number; name: string }}
                        onSuccess={fetchGroups}
                        trigger={<DataCell.Action action="edit" />}
                    />
                    <DataCell.Action
                        action="delete"
                        onClick={() => setDeleteId(group.id as number)}
                    />
                </>
            )
        })
    ]

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTable
                    columns={columns}
                    data={filterFn(groups as unknown as Record<string, unknown>[])}
                    isLoading={loading}
                    variant="embedded"
                    leftAction={<SmartSearchBar searchDef={groupSearchDef} placeholder="Buscar grupo..." className="w-full" />}
                    createAction={createAction}
                />
            </div>

            <GroupDrawer
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
