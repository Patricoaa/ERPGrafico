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
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { GroupManagement } from "@/components/settings/GroupManagement"
import { PageTabs } from "@/components/shared/PageTabs"
import { Users, UserPlus } from "lucide-react"
import { PageHeader as CustomPageHeader } from "@/components/shared/PageHeader"

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
            accessorKey: "groups",
            id: "role",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Rol" />
            ),
            cell: ({ row }) => {
                const groups = row.getValue("role") as string[]
                const roles = ['ADMIN', 'MANAGER', 'OPERATOR', 'READ_ONLY']
                const systemRole = groups?.find(g => roles.includes(g))

                return systemRole ? (
                    <Badge variant={systemRole === 'ADMIN' ? 'default' : 'secondary'}>
                        {systemRole}
                    </Badge>
                ) : null
            },
        },
        {
            accessorKey: "groups",
            id: "functional_groups",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Grupos" />
            ),
            cell: ({ row }) => {
                const groups = row.getValue("functional_groups") as string[]
                const roles = ['ADMIN', 'MANAGER', 'OPERATOR', 'READ_ONLY']
                const functionalGroups = groups?.filter(g => !roles.includes(g)) || []

                return (
                    <div className="flex flex-wrap gap-1">
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

    const tabs = [
        { value: "users", label: "Usuarios", icon: Users },
        { value: "groups", label: "Grupos y Equipos", icon: UserPlus },
    ]

    // ... (Render logic)

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <CustomPageHeader
                title="Usuarios y Permisos"
                description="Gestione el acceso al sistema y los equipos de trabajo."
            />

            <Tabs defaultValue="users" className="space-y-4">
                <PageTabs tabs={tabs} maxWidth="max-w-md" />

                <div className="pt-4">
                    <TabsContent value="users" className="mt-0 outline-none space-y-4">
                        <div className="flex items-center gap-4">
                            <h3 className="text-lg font-semibold">Lista de Usuarios</h3>
                            <UserForm
                                onSuccess={fetchUsers}
                                trigger={
                                    <Button size="icon" className="rounded-full h-8 w-8" title="Nuevo Usuario">
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                }
                            />
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
                                    useAdvancedFilter={true}
                                    facetedFilters={[
                                        {
                                            column: "role",
                                            title: "Rol",
                                            options: [
                                                { label: "Admin", value: "ADMIN" },
                                                { label: "Gerente", value: "MANAGER" },
                                                { label: "Operador", value: "OPERATOR" },
                                                { label: "Lectura", value: "READ_ONLY" },
                                            ],
                                        },
                                    ]}
                                />
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="groups" className="mt-0 outline-none">
                        <GroupManagement />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}
