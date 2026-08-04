"use client"

import { useState, useEffect } from "react"
import { useGroups } from "../hooks"
import { ActionConfirmModal, DataTableView, AutoEntityCard } from '@/components/shared'
import { type ColumnDef } from "@tanstack/react-table"
import { Users } from "lucide-react"
import { GroupDrawer } from "@/features/users"
import { groupActions, type GroupActionsCtx } from './groupActions'
import { groupFields } from '../groupFields'
import type { Group } from "../api/types"

import { UnifiedSearchBar, useUnifiedSearch } from "@/components/shared"
import { groupUnifiedSearchDef } from "@/features/settings/unifiedSearchDef"

interface GroupsClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function GroupsClientView({ externalOpen, onExternalOpenChange, createAction }: GroupsClientViewProps) {
    const { groups, loading, fetchGroups, deleteGroup } = useGroups()
    const search = useUnifiedSearch(groupUnifiedSearchDef)
    const [deleteId, setDeleteId] = useState<number | null>(null)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [editingGroup, setEditingGroup] = useState<Group | null>(null)

    useEffect(() => {
        if (externalOpen) {
            requestAnimationFrame(() => {
                setShowCreateModal(true)
            })
        }
    }, [externalOpen])

    const handleDelete = async () => {
        if (!deleteId) return
        await deleteGroup(deleteId)
        setDeleteId(null)
    }

    const groupActionsCtx: GroupActionsCtx = {
        onEdit: (group) => setEditingGroup(group),
        onDelete: (id) => setDeleteId(id),
    }

    const columns: ColumnDef<Group>[] = [
        ...groupFields.toColumns(),
        groupActions.auto(groupActionsCtx)
    ]

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="settings.group"
                    columns={columns}
                    data={search.filterFn(groups)}
                    isLoading={loading}
                    variant="embedded"
                    unifiedSearch={<UnifiedSearchBar
                        config={groupUnifiedSearchDef}
                        chips={search.chips}
                        isFiltered={search.isFiltered}
                        inputValue={search.inputValue}
                        onInputChange={search.setInputValue}
                        onApply={search.applyFilter}
                        onRemove={search.removeFilter}
                        onClearAll={search.clearAll}
                        groupBy={search.groupBy}
                        onGroupBySelect={search.setGroupBy}
                        paramValues={search.paramValues}
                        placeholder="Buscar grupo..."
                    />}
                    unifiedSearchConfig={groupUnifiedSearchDef}
                    currentGroupBy={search.groupBy}
                    showReset={search.isFiltered}
                    onReset={search.clearAll}
                    createAction={createAction}
                    renderCard={(group: Group) => (
                        <AutoEntityCard 
                            key={group.id} 
                            data={group}
                            fields={groupFields}
                            entityLabel="settings.group"
                            onClick={() => groupActionsCtx.onEdit(group)}
                            icon={Users}
                            actions={groupActions.render(group, groupActionsCtx)}

                        />
                    )}
                    cardSkeleton={{ showBody: false }}
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

            <GroupDrawer
                open={!!editingGroup}
                onOpenChange={(open) => { if (!open) setEditingGroup(null) }}
                initialData={editingGroup || undefined}
                onSuccess={() => {
                    setEditingGroup(null)
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
