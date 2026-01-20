"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, Edit, Trash2, Loader2, UserPlus } from "lucide-react"
import { UserForm } from "@/components/forms/UserForm"

export default function UsersSettingsPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [users, setUsers] = useState<any[]>([])

    const fetchUsers = async () => {
        try {
            const res = await api.get('/core/users/')
            setUsers(res.data.results || res.data)
        } catch (error) {
            toast.error("Error al cargar usuarios")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchUsers()
    }, [])

    const handleDelete = async (id: number) => {
        if (!confirm("¿Está seguro de eliminar este usuario?")) return
        try {
            await api.delete(`/core/users/${id}/`)
            toast.success("Usuario eliminado")
            fetchUsers()
        } catch (error) {
            toast.error("Error al eliminar")
        }
    }

    const columns: ColumnDef<any>[] = [
        {
            accessorKey: "username",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Usuario" />
            ),
            cell: ({ row }) => <div className="font-medium">{row.getValue("username")}</div>,
        },
        {
            accessorKey: "email",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Email" />
            ),
        },
        {
            id: "fullName",
            header: "Nombre Completo",
            cell: ({ row }) => (
                <div>{`${row.original.first_name || ''} ${row.original.last_name || ''}`}</div>
            ),
        },
        {
            accessorKey: "role",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Rol" />
            ),
            cell: ({ row }) => {
                const role = row.getValue("role") as string
                switch (role) {
                    case 'ADMIN': return <Badge variant="default">Admin</Badge>
                    case 'ACCOUNTANT': return <Badge variant="secondary">Contador</Badge>
                    default: return <Badge variant="outline">Operador</Badge>
                }
            },
        },
        {
            accessorKey: "is_active",
            header: "Estado",
            cell: ({ row }) => (
                <Badge variant={row.original.is_active ? "success" : "destructive" as any}>
                    {row.original.is_active ? "Activo" : "Inactivo"}
                </Badge>
            ),
        },
        {
            id: "actions",
            header: () => <div className="text-right">Acciones</div>,
            cell: ({ row }) => (
                <div className="flex justify-end gap-2">
                    <UserForm
                        initialData={row.original}
                        onSuccess={fetchUsers}
                        trigger={
                            <Button variant="ghost" size="icon">
                                <Edit className="h-4 w-4" />
                            </Button>
                        }
                    />
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(row.original.id)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h2 className="text-3xl font-bold tracking-tight">Usuarios y Permisos</h2>
                </div>
                <UserForm onSuccess={fetchUsers} />
            </div>

            <div className="">
                {loading ? (
                    <div className="flex h-[200px] items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <DataTable
                        columns={columns}
                        data={users}
                        globalFilterFields={["username", "email", "first_name", "last_name"]}
                        searchPlaceholder="Buscar usuario por nombre, email o username..."
                        facetedFilters={[
                            {
                                column: "role",
                                title: "Rol",
                                options: [
                                    { label: "Admin", value: "ADMIN" },
                                    { label: "Contador", value: "ACCOUNTANT" },
                                    { label: "Operador", value: "OPERATOR" },
                                ],
                            },
                        ]}
                        useAdvancedFilter={true}
                    />
                )}
            </div>
        </div>
    )
}
