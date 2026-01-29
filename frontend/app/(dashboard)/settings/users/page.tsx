"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Loader2, ChevronLeft } from "lucide-react"
import { UserForm } from "@/components/forms/UserForm"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GroupManagement } from "@/components/settings/GroupManagement"

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
            accessorKey: "groups_list",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Roles y Grupos" />
            ),
            cell: ({ row }) => {
                const groups = row.getValue("groups_list") as string[]

                // Identify system roles vs functional groups
                const roles = ['ADMIN', 'MANAGER', 'OPERATOR', 'READ_ONLY']
                const systemRole = groups?.find(g => roles.includes(g))
                const functionalGroups = groups?.filter(g => !roles.includes(g)) || []

                return (
                    <div className="flex flex-wrap gap-1">
                        {systemRole && (
                            <Badge variant={systemRole === 'ADMIN' ? 'default' : 'secondary'}>
                                {systemRole}
                            </Badge>
                        )}
                        {functionalGroups.map(g => (
                            <Badge key={g} variant="outline" className="text-xs">
                                {g}
                            </Badge>
                        ))}
                    </div>
                )
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
                </div>
            ),
        },
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center gap-4 mb-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Usuarios y Permisos</h2>
                    <p className="text-muted-foreground">Gestione el acceso al sistema y los equipos de trabajo.</p>
                </div>
            </div>

            <Tabs defaultValue="users" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="users">Usuarios</TabsTrigger>
                    <TabsTrigger value="groups">Grupos y Equipos</TabsTrigger>
                </TabsList>

                <TabsContent value="users" className="space-y-4">
                    <div className="flex justify-between items-center bg-card p-4 rounded-lg border shadow-sm">
                        <div>
                            <h3 className="text-lg font-medium">Lista de Usuarios</h3>
                            <p className="text-sm text-muted-foreground">Administre las cuentas de acceso al ERP.</p>
                        </div>
                        <UserForm
                            onSuccess={fetchUsers}
                            trigger={
                                <Button>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Nuevo Usuario
                                </Button>
                            }
                        />
                    </div>

                    <div className="bg-card rounded-md border shadow-sm">
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
                                        column: "groups_list",
                                        title: "Rol",
                                        options: [
                                            { label: "Admin", value: "ADMIN" },
                                            { label: "Gerente", value: "MANAGER" },
                                            { label: "Operador", value: "OPERATOR" },
                                        ],
                                    },
                                ]}
                            />
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="groups">
                    <GroupManagement />
                </TabsContent>
            </Tabs>
        </div>
    )
}
