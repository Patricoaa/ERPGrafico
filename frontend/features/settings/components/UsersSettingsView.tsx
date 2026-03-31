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
import { Plus, Edit, Loader2, ChevronLeft, Users, UserPlus } from "lucide-react"
import { UserForm } from "@/components/forms/UserForm"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { GroupManagement } from "@/features/settings/components/GroupManagement"
import { ServerPageTabs } from "@/components/shared/ServerPageTabs"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"

interface UsersSettingsViewProps {
    activeTab: string
}

export function UsersSettingsView({ activeTab }: UsersSettingsViewProps) {
    const [loading, setLoading] = useState(true)
    const [users, setUsers] = useState<any[]>([])
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)

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
        { value: "users", label: "Usuarios", iconName: "users", href: "/settings/users?tab=users" },
        { value: "groups", label: "Grupos y Equipos", iconName: "user-plus", href: "/settings/users?tab=groups" },
    ]

    const getHeaderConfig = () => {
        switch (activeTab) {
            case "users":
                return {
                    title: "Gestión de Usuarios",
                    description: "Administre el acceso de los empleados y sus roles en el sistema.",
                    actions: (
                        <UserForm
                            onSuccess={fetchUsers}
                            trigger={
                                <PageHeaderButton
                                    icon={Plus}
                                    circular
                                    title="Nuevo Usuario"
                                />
                            }
                        />
                    )
                }
            case "groups":
                return {
                    title: "Grupos y Equipos",
                    description: "Organice a sus colaboradores por departamentos o funciones específicas.",
                    actions: (
                        <PageHeaderButton
                            onClick={() => setIsGroupModalOpen(true)}
                            icon={Plus}
                            circular
                            title="Nuevo Grupo"
                        />
                    )
                }
            default:
                return { title: "Usuarios", description: "", actions: null }
        }
    }

    const { title, description, actions } = getHeaderConfig()

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <Tabs value={activeTab} className="space-y-4">
                <ServerPageTabs tabs={tabs} activeValue={activeTab} maxWidth="max-w-md" />

                <PageHeader
                    title={title}
                    description={description}
                    titleActions={actions}
                />

                <div className="pt-4">
                    <TabsContent value="users" className="mt-0 outline-none space-y-4">
                        {loading ? (
                            <div className="flex h-[200px] items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <DataTable
                                columns={columns}
                                data={users}
                                cardMode
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
                    </TabsContent>

                    <TabsContent value="groups" className="mt-0 outline-none">
                        <GroupManagement externalOpen={isGroupModalOpen} onExternalOpenChange={setIsGroupModalOpen} />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}
