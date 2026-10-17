"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { MODULE_ORDER, getModuleConfig, getModuleDefaultUrl } from "@/lib/module-registry"
import { useAuth } from "@/contexts/AuthContext"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Rutas raíz. Redirige al primer módulo disponible para el usuario.
 */
export default function DashboardPage() {
    const router = useRouter()
    const { user, hasPermission } = useAuth()

    useEffect(() => {
        if (!user) return

        const firstAvailable = MODULE_ORDER.find((id) => {
            const permission = getModuleConfig(id)?.permission
            return !permission || hasPermission(permission)
        })

        if (firstAvailable) {
            router.replace(getModuleDefaultUrl(firstAvailable))
        }
    }, [user, hasPermission, router])

    return (
        <div className="flex h-full items-center justify-center p-8">
            <div className="flex flex-col items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-md" />
                <Skeleton className="h-4 w-32" />
            </div>
        </div>
    )
}