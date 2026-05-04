"use client"

import { type ReactNode, lazy, Suspense, useState } from "react"
import { TableSkeleton } from "@/components/shared"
import { PageHeader } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { useSearchParams } from "next/navigation"

// Lazy load the UsersSettingsView component
const UsersSettingsView = lazy(() =>
    import("@/features/settings").then(module => ({
        default: module.UsersSettingsView
    }))
)

export default function UsersSettingsPage() {
    const searchParams = useSearchParams()
    const activeTab = searchParams.get("tab") || "users"

    const tabs = [
        { value: "users", label: "Usuarios", iconName: "users", href: "/settings/users?tab=users" },
        { value: "groups", label: "Grupos y Equipos", iconName: "user-plus", href: "/settings/users?tab=groups" },
    ]

    const navigation = {
        tabs,
        activeValue: activeTab
    }

    const getHeaderConfig = () => {
        switch (activeTab) {
            case "users":
                return {
                    title: "Gestión de Usuarios",
                    description: "Administre el acceso de los empleados y sus roles en el sistema.",
                    iconName: "users" as const
                }
            case "groups":
                return {
                    title: "Grupos y Equipos",
                    description: "Organice a sus colaboradores por departamentos o funciones específicas.",
                    iconName: "user-plus" as const
                }
            default:
                return { title: "Usuarios", description: "", iconName: "users" as const }
        }
    }

    const { title, description, iconName } = getHeaderConfig()

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title={title}
                description={description}
                variant="minimal"
                iconName={iconName}
                navigation={navigation}
            />
            
            <div className="mt-6">
                <Suspense fallback={<TableSkeleton rows={10} columns={5} />}>
                    <UsersSettingsView 
                        activeTab={activeTab} 
                    />
                </Suspense>
            </div>
        </div>
    )
}
