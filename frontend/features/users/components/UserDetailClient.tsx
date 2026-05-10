"use client"

import React, { useState, useEffect } from "react"
import { notFound, useRouter } from "next/navigation"
import { EntityDetailPage, FormSkeleton, FormFooter, CancelButton, ActionSlideButton } from "@/components/shared"
import { formatEntityDisplay } from "@/lib/entity-registry"
import api from "@/lib/api"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { UserForm } from "@/features/users/components/UserForm"

interface UserDetailClientProps {
    userId: string
}

export function UserDetailClient({ userId }: UserDetailClientProps) {
    const router = useRouter()
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<number | null>(null)

    const fetchUser = async () => {
        try {
            const response = await api.get(`/users/${userId}/`)
            setUser(response.data)
        } catch (err: any) {
            setError(err.response?.status || 500)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchUser()
    }, [userId])

    if (error === 404) return notFound()
    if (error) return (
        <div className="flex-1 flex items-center justify-center p-8 text-destructive text-sm">
            Error al cargar usuario
        </div>
    )

    if (loading || !user) {
        return (
            <div className="flex-1 p-8">
                <FormSkeleton />
            </div>
        )
    }

    const displayId = formatEntityDisplay('core.user', user)

    return (
        <EntityDetailPage
            entityLabel="core.user"
            displayId={displayId}
            breadcrumb={[
                { label: "Usuarios", href: "/settings/users" },
                { label: displayId, href: `/settings/users/${userId}` },
            ]}
            instanceId={parseInt(userId)}
            readonly={true}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => router.push("/settings/users")}>Volver</CancelButton>
                            <UserForm 
                                initialData={user} 
                                onSuccess={() => {
                                    fetchUser()
                                    router.refresh()
                                }} 
                                trigger={
                                    <ActionSlideButton>
                                        Editar Usuario
                                    </ActionSlideButton>
                                } 
                            />
                        </>
                    }
                />
            }
        >
            <div className="max-w-4xl mx-auto w-full p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Nombre de Usuario</p>
                        <p className="font-semibold">{user.username}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Nombre Completo</p>
                        <p className="font-semibold">{user.first_name} {user.last_name}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-semibold">{user.email || "—"}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Rol Principal</p>
                        <div>
                            {user.primary_role ? (
                                <StatusBadge status={user.primary_role.name} label={user.primary_role.name} size="sm" />
                            ) : "—"}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Estado</p>
                        <p className="font-semibold">{user.is_active ? "Activo" : "Inactivo"}</p>
                    </div>
                </div>
            </div>
        </EntityDetailPage>
    )
}
