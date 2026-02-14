import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

// Lazy load the SalesSettingsView component
const SalesSettingsView = lazy(() =>
    import("@/components/settings/SalesSettingsView").then(module => ({
        default: module.SalesSettingsView
    }))
)

export default async function SalesSettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "revenue"

    return (
        <Suspense fallback={<LoadingFallback message="Cargando configuración..." />}>
            <SalesSettingsView activeTab={activeTab} />
        </Suspense>
    )
}
