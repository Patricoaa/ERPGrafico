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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function GroupManagement() {
    const [loading, setLoading] = useState(true)
    const [groups, setGroups] = useState<any[]>([])
    const [deleteId, setDeleteId] = useState<number | null>(null)

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
                <div className="flex items-center gap-2 font-medium">
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
            cell: ({ row }) => <div className="pl-4">{row.getValue("user_count")}</div>,
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
                            <Button variant="ghost" size="icon">
                                <Edit className="h-4 w-4" />
                            </Button>
                        }
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
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
            <div className="flex justify-between items-center bg-muted/40 p-4 rounded-lg border">
                <div>
                    <h3 className="text-lg font-medium">Grupos y Equipos</h3>
                    <p className="text-sm text-muted-foreground">
                        Gestiona los equipos funcionales para asignación de tareas y workflows.
                    </p>
                </div>
                <GroupForm
                    onSuccess={fetchGroups}
                    trigger={
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Nuevo Grupo
                        </Button>
                    }
                />
            </div>

            {loading ? (
                <div className="flex h-[200px] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <DataTable
                    columns={columns}
                    data={groups}
                    searchPlaceholder="Buscar grupo..."
                />
            )}

            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará el grupo permanentemente. Los usuarios asignados a este grupo dejarán de pertenecer a él, pero no serán eliminados.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
