import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/ui/LoadingFallback"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

const HRSettingsView = lazy(() =>
    import("@/features/settings/components/HRSettingsView").then(module => ({
        default: module.HRSettingsView
    }))
)

export default async function HRSettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "global"

    return (
        <Suspense fallback={<LoadingFallback message="Cargando configuración de RRHH..." />}>
            <HRSettingsView activeTab={activeTab} />
        </Suspense>
    )
}

